const supabase = require('../supabase');

const STUDENT_COLS = '_id, name, email, role, roll_no, room_no, room_id, hostel_id, course_year, phone, parent_contact, assigned_warden, is_active';

const occupantsOf = async (roomIds) => {
  if (!roomIds.length) return {};
  const { data } = await supabase
    .from('users')
    .select('_id, name, roll_no, room_id')
    .eq('role', 'student')
    .eq('is_active', true)
    .in('room_id', roomIds);
  const map = {};
  for (const s of data || []) (map[s.room_id] ||= []).push({ _id: s._id, name: s.name, roll_no: s.roll_no });
  return map;
};

const cleanRoomNo = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 20);

// @desc    Rooms with occupancy (vacancy view)
// @route   GET /api/admin/rooms?hostel_id=&vacant=true
// @access  Private (admin)
const getRooms = async (req, res) => {
  try {
    let q = supabase.from('rooms').select('*, hostel:hostels(name)').order('room_no');
    if (req.query.hostel_id) q = q.eq('hostel_id', req.query.hostel_id);
    const { data: rooms, error } = await q;
    if (error) throw error;

    const occupants = await occupantsOf((rooms || []).map((r) => r._id));
    let rows = (rooms || [])
      .map((r) => {
        const people = occupants[r._id] || [];
        return { ...r, hostel_name: r.hostel?.name || null, hostel: undefined, occupants: people, occupied: people.length, vacant: Math.max(0, r.capacity - people.length) };
      })
      .sort((a, b) => (a.hostel_name || '').localeCompare(b.hostel_name || '') || a.room_no.localeCompare(b.room_no, undefined, { numeric: true }));
    if (req.query.vacant === 'true') rows = rows.filter((r) => r.vacant > 0);

    const totals = rows.reduce((t, r) => ({ rooms: t.rooms + 1, beds: t.beds + r.capacity, occupied: t.occupied + r.occupied }), { rooms: 0, beds: 0, occupied: 0 });
    res.json({ totals: { ...totals, vacant: totals.beds - totals.occupied }, rooms: rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create one room
// @route   POST /api/admin/rooms   body: { hostel_id, room_no, capacity, floor? }
const createRoom = async (req, res) => {
  try {
    const { hostel_id, capacity, floor } = req.body;
    const room_no = cleanRoomNo(req.body.room_no);
    const { data, error } = await supabase
      .from('rooms')
      .insert({ hostel_id, room_no, capacity: Number(capacity), floor: floor ? String(floor).trim() : null })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return res.status(400).json({ message: `Room ${room_no} already exists in this hostel.` });
      if (error.code === '23503') return res.status(400).json({ message: 'Hostel not found.' });
      throw error;
    }
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a numbered range of rooms, e.g. A-101 … A-120 (existing ones are skipped)
// @route   POST /api/admin/rooms/bulk   body: { hostel_id, from, to, prefix?, capacity, floor? }
const createRoomsBulk = async (req, res) => {
  try {
    const { hostel_id, capacity, floor } = req.body;
    const from = Number(req.body.from);
    const to = Number(req.body.to);
    const prefix = cleanRoomNo(req.body.prefix || '');
    if (to < from || to - from >= 500) return res.status(400).json({ message: 'Range must be 1–500 rooms with "to" ≥ "from".' });

    const rows = [];
    for (let n = from; n <= to; n++) {
      rows.push({ hostel_id, room_no: `${prefix}${n}`, capacity: Number(capacity), floor: floor ? String(floor).trim() : null });
    }
    const { data, error } = await supabase
      .from('rooms')
      .upsert(rows, { onConflict: 'hostel_id,room_no', ignoreDuplicates: true })
      .select('_id');
    if (error) {
      if (error.code === '23503') return res.status(400).json({ message: 'Hostel not found.' });
      throw error;
    }
    res.status(201).json({ created: data.length, skipped: rows.length - data.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a room (capacity can't drop below current occupants)
// @route   PUT /api/admin/rooms/:id
const updateRoom = async (req, res) => {
  try {
    const updates = { updated_at: new Date().toISOString() };
    if (req.body.room_no !== undefined) updates.room_no = cleanRoomNo(req.body.room_no);
    if (req.body.floor !== undefined) updates.floor = req.body.floor ? String(req.body.floor).trim() : null;
    if (req.body.capacity !== undefined) {
      updates.capacity = Number(req.body.capacity);
      const occupied = (await occupantsOf([req.params.id]))[req.params.id]?.length || 0;
      if (updates.capacity < occupied) {
        return res.status(400).json({ message: `${occupied} student(s) live here — capacity can't be lower than that.` });
      }
    }
    const { data, error } = await supabase.from('rooms').update(updates).eq('_id', req.params.id).select().maybeSingle();
    if (error) {
      if (error.code === '23505') return res.status(400).json({ message: 'Another room in this hostel has that number.' });
      throw error;
    }
    if (!data) return res.status(404).json({ message: 'Room not found' });
    // Keep the denormalized room_no on residents in sync with a renamed room.
    if (updates.room_no) await supabase.from('users').update({ room_no: updates.room_no }).eq('room_id', data._id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an empty room
// @route   DELETE /api/admin/rooms/:id
const deleteRoom = async (req, res) => {
  try {
    const occupied = (await occupantsOf([req.params.id]))[req.params.id]?.length || 0;
    if (occupied) return res.status(409).json({ message: `Move the ${occupied} student(s) out of this room first.` });
    const { error } = await supabase.from('rooms').delete().eq('_id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Room deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign a student to a hostel and room, enforcing room capacity.
//          Hostels that have rooms set up require picking one of them;
//          hostels without rooms still accept a free-text room number.
// @route   PUT /api/admin/students/:id/hostel   body: { hostel_id, room_id?, room_no? }
// @access  Private (admin)
const assignStudentRoom = async (req, res) => {
  try {
    const { hostel_id, room_id } = req.body;
    const { data: student } = await supabase
      .from('users')
      .select('_id, hostel_id, room_id, room_no, is_active')
      .eq('_id', req.params.id)
      .eq('role', 'student')
      .maybeSingle();
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!student.is_active) return res.status(400).json({ message: 'Re-admit this student before assigning a room.' });

    const updates = { updated_at: new Date().toISOString() };
    let room = null;

    if (room_id) {
      const { data } = await supabase.from('rooms').select('*').eq('_id', room_id).maybeSingle();
      if (!data) return res.status(400).json({ message: 'Room not found.' });
      room = data;
      const others = ((await occupantsOf([room._id]))[room._id] || []).filter((o) => o._id !== student._id);
      if (others.length >= room.capacity) {
        return res.status(409).json({ message: `Room ${room.room_no} is full (${room.capacity}/${room.capacity}).` });
      }
      Object.assign(updates, { hostel_id: room.hostel_id, room_id: room._id, room_no: room.room_no });
    } else if (hostel_id) {
      const { data: hostel } = await supabase.from('hostels').select('_id').eq('_id', hostel_id).maybeSingle();
      if (!hostel) return res.status(400).json({ message: 'Hostel not found.' });
      const { count: roomCount } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('hostel_id', hostel_id);
      updates.hostel_id = hostel_id;
      updates.room_id = null;
      // With rooms set up, a room must be picked from the list; otherwise free text is fine.
      updates.room_no = roomCount ? null : (req.body.room_no !== undefined ? cleanRoomNo(req.body.room_no) || null : student.room_no);
    } else {
      Object.assign(updates, { hostel_id: null, room_id: null });
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update(updates)
      .eq('_id', student._id)
      .select(STUDENT_COLS)
      .single();
    if (error) throw error;

    // Race guard: two admins filling the last bed at the same moment.
    if (room) {
      const occupied = (await occupantsOf([room._id]))[room._id]?.length || 0;
      if (occupied > room.capacity) {
        await supabase.from('users').update({ hostel_id: student.hostel_id, room_id: student.room_id, room_no: student.room_no }).eq('_id', student._id);
        return res.status(409).json({ message: `Room ${room.room_no} just filled up. Pick another room.` });
      }
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a numbered range of rooms, e.g. A-101 … A-120.
//          Without confirm: returns a preview. With confirm: deletes the EMPTY
//          rooms in the range; rooms where students live are always skipped.
// @route   POST /api/admin/rooms/bulk-delete   body: { hostel_id, prefix?, from, to, confirm? }
const deleteRoomsRange = async (req, res) => {
  try {
    const { hostel_id } = req.body;
    const from = Number(req.body.from);
    const to = Number(req.body.to);
    const prefix = cleanRoomNo(req.body.prefix || '');
    if (to < from || to - from >= 500) return res.status(400).json({ message: 'Range must be 1–500 rooms with "to" ≥ "from".' });

    const wanted = [];
    for (let n = from; n <= to; n++) wanted.push(`${prefix}${n}`);
    const { data: rooms, error } = await supabase.from('rooms').select('_id, room_no').eq('hostel_id', hostel_id).in('room_no', wanted);
    if (error) throw error;

    const occupants = await occupantsOf((rooms || []).map((r) => r._id));
    const occupied = (rooms || []).filter((r) => occupants[r._id]?.length);
    const deletable = (rooms || []).filter((r) => !occupants[r._id]?.length);
    const found = new Set((rooms || []).map((r) => r.room_no));
    const sortNo = (a, b) => a.localeCompare(b, undefined, { numeric: true });
    const preview = {
      will_delete: deletable.map((r) => r.room_no).sort(sortNo),
      skipped_occupied: occupied.map((r) => ({ room_no: r.room_no, students: occupants[r._id].length })).sort((a, b) => sortNo(a.room_no, b.room_no)),
      not_found: wanted.filter((n) => !found.has(n)),
    };
    if (!req.body.confirm) return res.json({ ...preview, deleted: 0 });

    let deleted = 0;
    if (deletable.length) {
      // Re-check right before deleting: skip any room someone moved into meanwhile
      // (deleting it would silently clear that student's room).
      const fresh = await occupantsOf(deletable.map((r) => r._id));
      const stillEmpty = deletable.filter((r) => !fresh[r._id]?.length);
      if (!stillEmpty.length) return res.json({ ...preview, deleted: 0 });
      const { data: gone, error: delErr } = await supabase
        .from('rooms')
        .delete()
        .in('_id', stillEmpty.map((r) => r._id))
        .select('_id');
      if (delErr) throw delErr;
      deleted = gone.length;
    }
    res.json({ ...preview, deleted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getRooms, createRoom, createRoomsBulk, updateRoom, deleteRoom, deleteRoomsRange, assignStudentRoom };
