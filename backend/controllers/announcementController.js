const supabase = require('../supabase');
const { fetchAll } = require('../utils/schema');
const { notifyUsers } = require('../utils/notify');
const { storedPath } = require('../middleware/upload');

const SELECT = '*, author:users!created_by(name, role), hostel:hostels(name)';

const decorate = (a) => ({
  ...a,
  users: a.author ? { name: a.author.name } : null, // old shape some screens read
  author_name: a.author?.name || null,
  author_role: a.author?.role || null,
  hostel_name: a.hostel?.name || null,
  is_expired: Boolean(a.expires_at && new Date(a.expires_at) <= new Date()),
  author: undefined,
  hostel: undefined,
});

// @desc    Announcements visible to the caller
//          student: unexpired, for everyone or their hostel
//          warden:  unexpired for everyone/their hostel, plus their own posts
//          admin:   everything (incl. expired, flagged)
// @route   GET /api/announcements
// @access  Private
const getAnnouncements = async (req, res) => {
  try {
    const { role, hostel_id: myHostel, _id: me } = req.user;
    const nowIso = new Date().toISOString();
    let q = supabase.from('announcements').select(SELECT).order('created_at', { ascending: false }).limit(200);

    if (role !== 'admin') {
      q = q.or(`expires_at.is.null,expires_at.gt.${nowIso}${role === 'warden' ? `,created_by.eq.${me}` : ''}`);
      q = myHostel ? q.or(`hostel_id.is.null,hostel_id.eq.${myHostel}`) : q.is('hostel_id', null);
    }
    const { data, error } = await q;
    if (error) throw error;
    res.status(200).json((data || []).map(decorate));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create an announcement and notify the students it targets
// @route   POST /api/announcements   body: { title, message, priority, hostel_id?, expires_at? }
// @access  Private (admin: any audience; warden: their own hostel only)
const createAnnouncement = async (req, res) => {
  try {
    const { title, message, priority, expires_at } = req.body;
    let hostelId = req.body.hostel_id || null;

    if (req.user.role === 'warden') {
      if (!req.user.hostel_id) {
        return res.status(400).json({ message: 'You need to be assigned to a hostel before posting announcements. Ask the admin.' });
      }
      hostelId = req.user.hostel_id; // wardens always post to their own hostel
    } else if (hostelId) {
      const { data: hostel } = await supabase.from('hostels').select('_id').eq('_id', hostelId).maybeSingle();
      if (!hostel) return res.status(400).json({ message: 'Hostel not found.' });
    }
    if (expires_at && new Date(expires_at) <= new Date()) {
      return res.status(400).json({ message: 'Expiry must be in the future.' });
    }

    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        title: title.trim(),
        message: message.trim(),
        priority: priority || 'Normal',
        created_by: req.user._id,
        hostel_id: hostelId,
        expires_at: expires_at || null,
        photo: storedPath(req.file), // optional photo (images only, 5 MB — middleware/upload.js)
      })
      .select(SELECT)
      .single();
    if (error) throw error;

    // Fan out to every active student in the audience, in batches.
    const students = await fetchAll(() => {
      let sq = supabase.from('users').select('_id').eq('role', 'student').eq('is_active', true);
      if (hostelId) sq = sq.eq('hostel_id', hostelId);
      return sq;
    });
    const ids = students.map((s) => s._id);
    for (let i = 0; i < ids.length; i += 500) {
      await notifyUsers(ids.slice(i, i + 500), {
        type: 'ANNOUNCEMENT',
        title: `${announcement.priority !== 'Normal' ? `[${announcement.priority}] ` : ''}${announcement.title}`,
        message: announcement.message.slice(0, 140),
        link: '/announcements',
      });
    }

    res.status(201).json({ ...decorate(announcement), notified: ids.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an announcement
// @route   DELETE /api/announcements/:id
// @access  Private (admin: any; warden: only their own)
const deleteAnnouncement = async (req, res) => {
  try {
    let q = supabase.from('announcements').delete().eq('_id', req.params.id);
    if (req.user.role === 'warden') q = q.eq('created_by', req.user._id);
    const { data, error } = await q.select('_id');
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ message: 'Announcement not found (or not yours to delete).' });
    res.status(200).json({ message: 'Announcement removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAnnouncements, createAnnouncement, deleteAnnouncement };
