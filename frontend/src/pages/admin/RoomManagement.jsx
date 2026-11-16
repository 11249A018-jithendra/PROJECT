import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import api from '../../api/axios';
import { EmptyState, SkeletonCards } from '../../components/ui/Feedback';
import { toast } from '../../components/ui/Toast';
import { confirmAction } from '../../components/ui/ConfirmDialog';
import {
  BedDouble, Plus, Layers, Pencil, Trash2, Building2, DoorOpen, Users, Search, LayoutGrid, List, Eraser, AlertTriangle,
  ChevronDown, CheckSquare, Square, X, User,
} from 'lucide-react';

const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const byRoomNo = (a, b) => a.room_no.localeCompare(b.room_no, undefined, { numeric: true });

// A room is empty, partly filled or full; every colour on the page follows this.
const statusOf = (r) => (r.occupied === 0 ? 'empty' : r.vacant === 0 ? 'full' : 'partial');
const STATUS = {
  empty: { label: 'Empty', tile: 'border-green-200 hover:border-green-400', badge: 'bg-green-50 text-green-700', bed: 'bg-green-100 text-green-600' },
  partial: { label: 'Partly filled', tile: 'border-amber-200 hover:border-amber-400', badge: 'bg-amber-50 text-amber-700', bed: 'bg-amber-100 text-amber-600' },
  full: { label: 'Full', tile: 'border-slate-200 hover:border-slate-400', badge: 'bg-slate-100 text-slate-600', bed: 'bg-slate-200 text-slate-600' },
};
const FILTERS = [
  ['all', 'All'],
  ['free', 'Has free beds'],
  ['empty', 'Empty'],
  ['full', 'Full'],
];
const matchesFilter = (r, f) => f === 'all' || (f === 'free' ? r.vacant > 0 : statusOf(r) === f);

// Ground floor first, then 1, 2, 3…, named floors after, "no floor" last.
const floorRank = (floor) => (!floor ? 3 : /^(g|ground|0)$/i.test(floor.trim()) ? 0 : /^\d+$/.test(floor) ? 1 : 2);

const floorLabel = (floor) => {
  if (!floor) return 'No floor set';
  if (/^\d+$/.test(floor)) return `Floor ${floor}`;
  return `${floor.charAt(0).toUpperCase()}${floor.slice(1)} floor`.replace(/ floor floor$/i, ' floor');
};

const RoomTile = ({ r, selecting, isSelected, onOpen, onToggle }) => {
  const s = STATUS[statusOf(r)];
  const selectable = r.occupied === 0;
  const onClick = () => {
    if (!selecting) return onOpen(r);
    if (selectable) onToggle(r);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecting ? isSelected : undefined}
      title={selecting && !selectable ? 'Students live here — move them out before deleting' : `Room ${r.room_no}`}
      className={`group relative text-left bg-white rounded-xl border-2 p-3 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500
        ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : s.tile}
        ${selecting && !selectable ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-slate-800 text-lg leading-none">{r.room_no}</p>
        {selecting ? (
          selectable && (isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} className="text-slate-300" />)
        ) : (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${s.badge}`}>{r.vacant ? `${r.vacant} free` : 'Full'}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-2.5" aria-label={`${r.occupied} of ${r.capacity} beds taken`}>
        {Array.from({ length: r.capacity }).map((_, i) => (
          <span key={i} className={`w-6 h-6 rounded-md flex items-center justify-center ${i < r.occupied ? STATUS.partial.bed : 'bg-slate-50 text-slate-300 border border-dashed border-slate-200'}`}>
            {i < r.occupied ? <User size={12} /> : <BedDouble size={12} />}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2 truncate">
        {r.occupants.length ? r.occupants.map((o) => o.name).join(', ') : 'No one yet'}
      </p>
    </button>
  );
};

const RoomManagement = () => {
  const [hostels, setHostels] = useState([]);
  const [hostelId, setHostelId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('rooms_view') || 'cards'; } catch { return 'cards'; }
  });
  const [collapsed, setCollapsed] = useState({});
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [modal, setModal] = useState(null); // { type: 'one' | 'bulk' | 'edit' | 'delete-range' | 'details' | 'delete-selected', room? }
  const [form, setForm] = useState({});
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/hostels').then((r) => {
      setHostels(r.data);
      if (r.data.length) setHostelId((h) => h || r.data[0]._id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(() => {
    if (!hostelId) return;
    api.get(`/admin/rooms?hostel_id=${hostelId}`).then((r) => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [hostelId]);
  useEffect(() => { load(); }, [load]);

  const chooseHostel = (id) => {
    setHostelId(id);
    setSelected(new Set());
    setCollapsed({});
  };

  const chooseView = (v) => {
    setView(v);
    try { localStorage.setItem('rooms_view', v); } catch { /* private mode */ }
  };

  const flash = (text) => {
    setNotice(text);
    setTimeout(() => setNotice(''), 6000);
  };

  // Show deletions straight away; the reload that follows confirms them.
  const dropRooms = (ids) => {
    const gone = new Set(ids);
    setData((d) => {
      if (!d) return d;
      const rooms = d.rooms.filter((r) => !gone.has(r._id));
      const totals = rooms.reduce((t, r) => ({ rooms: t.rooms + 1, beds: t.beds + r.capacity, occupied: t.occupied + r.occupied }), { rooms: 0, beds: 0, occupied: 0 });
      return { ...d, rooms, totals: { ...totals, vacant: totals.beds - totals.occupied } };
    });
  };

  const open = (type, room = null) => {
    setError('');
    setPreview(null);
    setForm(
      type === 'bulk' ? { prefix: '', from: 101, to: 110, capacity: 2, floor: '' }
        : type === 'delete-range' ? { prefix: '', from: '', to: '' }
        : room ? { room_no: room.room_no, capacity: room.capacity, floor: room.floor || '' }
        : { room_no: '', capacity: 2, floor: '' }
    );
    setModal({ type, room });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (modal.type === 'bulk') {
        const r = await api.post('/admin/rooms/bulk', { ...form, hostel_id: hostelId });
        flash(`Created ${r.data.created} room(s)${r.data.skipped ? `, skipped ${r.data.skipped} that already existed` : ''}.`);
      } else if (modal.type === 'edit') {
        await api.put(`/admin/rooms/${modal.room._id}`, form);
        flash(`Room ${form.room_no || modal.room.room_no} saved.`);
      } else {
        await api.post('/admin/rooms', { ...form, hostel_id: hostelId });
        flash(`Room ${form.room_no} added.`);
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  // Range delete: first a preview, then a confirmed delete (occupied rooms always skipped).
  const runRangeDelete = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError('');
    try {
      const confirm = Boolean(preview);
      const r = await api.post('/admin/rooms/bulk-delete', { ...form, hostel_id: hostelId, confirm });
      if (confirm) {
        setModal(null);
        const goneNos = new Set(r.data.will_delete);
        dropRooms((data?.rooms || []).filter((room) => goneNos.has(room.room_no)).map((room) => room._id));
        flash(`Deleted ${r.data.deleted} room(s).${r.data.skipped_occupied.length ? ` Kept ${r.data.skipped_occupied.length} room(s) where students live.` : ''}`);
        load();
      } else {
        setPreview(r.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (room) => {
    if (!(await confirmAction({ title: `Delete room ${room.room_no}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.delete(`/admin/rooms/${room._id}`);
      setModal(null);
      dropRooms([room._id]);
      flash(`Room ${room.room_no} deleted.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete.');
    }
  };

  const toggleSelect = (room) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(room._id)) next.delete(room._id);
      else next.add(room._id);
      return next;
    });
  };

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const deleteSelected = async () => {
    setSaving(true);
    setError('');
    const ids = [...selected];
    // All at once: each delete waits on the database, so one-by-one is slow.
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/admin/rooms/${id}`)));
    const done = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failed = results.flatMap((res, i) => {
      if (res.status === 'fulfilled') return [];
      const room = data?.rooms.find((r) => r._id === ids[i]);
      return [`${room?.room_no || '?'}: ${res.reason?.response?.data?.message || 'could not delete'}`];
    });
    setSaving(false);
    dropRooms(done);
    setModal(null);
    stopSelecting();
    flash(`Deleted ${done.length} room(s).${failed.length ? ` Not deleted — ${failed.join('; ')}` : ''}`);
    load();
  };

  const allRooms = data?.rooms || [];
  const t = data?.totals;
  const q = search.trim().toLowerCase();
  const rooms = allRooms
    .filter((r) => {
      if (!matchesFilter(r, statusFilter)) return false;
      if (q && !r.room_no.toLowerCase().includes(q) && !r.occupants.some((o) => o.name.toLowerCase().includes(q) || (o.roll_no || '').toLowerCase().includes(q))) return false;
      return true;
    })
    .sort(byRoomNo);
  const counts = Object.fromEntries(FILTERS.map(([key]) => [key, allRooms.filter((r) => matchesFilter(r, key)).length]));

  // Group by floor (rooms without a floor go last).
  const floors = [...new Set(rooms.map((r) => r.floor || ''))].sort((a, b) => floorRank(a) - floorRank(b) || a.localeCompare(b, undefined, { numeric: true }));
  const occupancy = t?.beds ? Math.round((t.occupied / t.beds) * 100) : 0;
  const selectedRooms = allRooms.filter((r) => selected.has(r._id));

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rooms & Vacancy</h1>
          <p className="text-slate-500 mt-1">Rooms, bed capacity and who lives where</p>
        </div>
        {hostelId && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => (selecting ? stopSelecting() : setSelecting(true))} className={`flex items-center gap-2 border px-4 py-2.5 rounded-xl transition text-sm ${selecting ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
              {selecting ? <X size={16} /> : <CheckSquare size={16} />} {selecting ? 'Cancel selecting' : 'Select rooms'}
            </button>
            <button onClick={() => open('delete-range')} className="flex items-center gap-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 px-4 py-2.5 rounded-xl transition text-sm"><Eraser size={16} /> Delete range</button>
            <button onClick={() => open('bulk')} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition text-sm"><Layers size={16} /> Add range</button>
            <button onClick={() => open('one')} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-200 text-sm"><Plus size={16} /> Add room</button>
          </div>
        )}
      </div>

      {notice && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 mb-5" role="status">{notice}</div>}

      {hostels.length === 0 && !loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center">
          <Building2 className="mx-auto text-slate-300 mb-3" size={40} />
          <h3 className="font-semibold text-slate-700 text-base mb-1">No Hostels Found</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-5">Create a hostel on the Hostels page first, then add its rooms here.</p>
          <Link to="/admin/hostels" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium transition shadow-md shadow-indigo-200 text-sm">
            <Plus size={16} /> Go to Hostels Page
          </Link>
        </div>
      ) : (
        <>
          {/* Hostel tabs (a dropdown when there are many hostels) */}
          {hostels.length > 1 && (hostels.length <= 6 ? (
            <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="Hostel">
              {hostels.map((h) => (
                <button key={h._id} role="tab" aria-selected={hostelId === h._id} onClick={() => chooseHostel(h._id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition ${hostelId === h._id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Building2 size={15} /> {h.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-5 inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3">
              <Building2 size={14} className="text-slate-400" />
              <select value={hostelId} onChange={(e) => chooseHostel(e.target.value)} className="text-sm py-2 bg-transparent focus:outline-none" aria-label="Hostel">
                {hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
              </select>
            </div>
          ))}

          {t && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              {[
                ['Rooms', t.rooms, DoorOpen, 'bg-indigo-50 text-indigo-600'],
                ['Beds', t.beds, BedDouble, 'bg-slate-100 text-slate-600'],
                ['Occupied', t.occupied, Users, 'bg-amber-50 text-amber-600'],
                ['Vacant beds', t.vacant, BedDouble, 'bg-green-50 text-green-600'],
              ].map(([label, value, Icon, tone]) => (
                <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}><Icon size={20} /></div>
                  <div><p className="text-xl font-bold text-slate-800">{value}</p><p className="text-slate-500 text-xs">{label}</p></div>
                </div>
              ))}
              <div className="col-span-2 lg:col-span-4 bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>Occupancy</span>
                  <span className="font-semibold text-slate-700">{occupancy}% full</span>
                </div>
                <div className="h-2 bg-green-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${occupancy}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 mb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a room number or student..." aria-label="Search rooms" className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex border border-slate-200 rounded-xl overflow-hidden" role="group" aria-label="View">
                <button onClick={() => chooseView('cards')} className={`px-3 py-2 ${view === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`} aria-label="Room map" aria-pressed={view === 'cards'}><LayoutGrid size={16} /></button>
                <button onClick={() => chooseView('table')} className={`px-3 py-2 ${view === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`} aria-label="Table view" aria-pressed={view === 'table'}><List size={16} /></button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map(([key, label]) => (
                <button key={key} onClick={() => setStatusFilter(key)} aria-pressed={statusFilter === key}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${statusFilter === key ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {label} <span className="ml-1 text-slate-400">{counts[key]}</span>
                </button>
              ))}
              <div className="flex items-center gap-3 ml-auto text-xs text-slate-500">
                {Object.entries(STATUS).map(([key, s]) => (
                  <span key={key} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded border-2 ${s.tile.split(' ')[0]}`} />{s.label}</span>
                ))}
              </div>
            </div>
          </div>

          {selecting && (
            <div className="sticky top-2 z-20 bg-indigo-600 text-white rounded-2xl shadow-lg px-4 py-3 mb-5 flex flex-wrap items-center gap-3">
              <span className="text-sm flex-1">
                {selected.size ? <><b>{selected.size}</b> room(s) selected</> : 'Tap empty rooms to select them. Rooms where students live can\'t be selected.'}
              </span>
              {selected.size > 0 && <button onClick={() => setSelected(new Set())} className="text-sm text-indigo-100 hover:text-white">Clear</button>}
              <button disabled={!selected.size} onClick={() => setModal({ type: 'delete-selected' })} className="flex items-center gap-2 bg-white text-red-600 disabled:opacity-50 px-4 py-2 rounded-xl text-sm font-semibold">
                <Trash2 size={15} /> Delete selected
              </button>
            </div>
          )}

          {loading ? (
            <SkeletonCards cards={3} />
          ) : rooms.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <EmptyState icon={BedDouble} title={allRooms.length ? 'No rooms match your search or filter' : 'No rooms yet'} message={allRooms.length ? undefined : 'Use "Add range" to create many at once (e.g. 101–120).'} />
            </div>
          ) : view === 'table' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Room</th>
                    <th className="px-4 py-3 font-semibold">Floor</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-center">Beds</th>
                    <th className="px-4 py-3 font-semibold">Students</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rooms.map((r) => {
                    const s = STATUS[statusOf(r)];
                    return (
                      <tr key={r._id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{r.room_no}</td>
                        <td className="px-4 py-2.5 text-slate-500">{r.floor ? floorLabel(r.floor) : '—'}</td>
                        <td className="px-4 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${s.badge}`}>{s.label}</span></td>
                        <td className="px-4 py-2.5 text-center text-slate-600">{r.occupied}/{r.capacity}</td>
                        <td className="px-4 py-2.5 text-slate-600">{r.occupants.map((o) => o.name).join(', ') || <span className="text-slate-400">—</span>}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => open('edit', r)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" aria-label={`Edit room ${r.room_no}`}><Pencil size={14} /></button>
                            <button onClick={() => remove(r)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" aria-label={`Delete room ${r.room_no}`}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-4">
              {floors.map((floor) => {
                const onFloor = rooms.filter((r) => (r.floor || '') === floor);
                const beds = onFloor.reduce((n, r) => n + r.capacity, 0);
                const taken = onFloor.reduce((n, r) => n + r.occupied, 0);
                const key = floor || 'none';
                const isOpen = !collapsed[key];
                return (
                  <section key={key} className="bg-white rounded-2xl shadow-sm border border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => ({ ...c, [key]: isOpen }))}
                      aria-expanded={isOpen}
                      className="w-full flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left"
                    >
                      <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                      <h3 className="font-semibold text-slate-800">{floorLabel(floor)}</h3>
                      <span className="text-xs text-slate-500">{onFloor.length} room{onFloor.length === 1 ? '' : 's'} · {beds - taken} free of {beds} beds</span>
                      <span className="flex-1 min-w-[80px] max-w-xs h-1.5 bg-green-100 rounded-full overflow-hidden ml-auto">
                        <span className="block h-full bg-amber-400 rounded-full" style={{ width: `${beds ? (taken / beds) * 100 : 0}%` }} />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {onFloor.map((r) => (
                          <RoomTile key={r._id} r={r} selecting={selecting} isSelected={selected.has(r._id)} onOpen={(room) => setModal({ type: 'details', room })} onToggle={toggleSelect} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {modal?.type === 'details' && (() => {
        const r = modal.room;
        const s = STATUS[statusOf(r)];
        return (
          <Modal title={`Room ${r.room_no}`} onClose={() => setModal(null)}>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`font-semibold px-2 py-1 rounded-md ${s.badge}`}>{s.label}</span>
                <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600">{r.occupied} of {r.capacity} beds taken</span>
                {r.floor && <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600">{floorLabel(r.floor)}</span>}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 mb-2">Students</p>
                {r.occupants.length ? (
                  <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                    {r.occupants.map((o) => (
                      <li key={o._id} className="flex items-center gap-3 px-3 py-2">
                        <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-semibold">{o.name.charAt(0).toUpperCase()}</span>
                        <span className="text-sm text-slate-800 flex-1">{o.name}</span>
                        {o.roll_no && <span className="text-xs text-slate-400">{o.roll_no}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400 bg-slate-50 rounded-xl p-3">No one lives here yet.</p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => open('edit', r)} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl"><Pencil size={15} /> Edit room</button>
                <button onClick={() => remove(r)} disabled={r.occupied > 0} title={r.occupied ? 'Move the students out first' : undefined} className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 font-medium py-2.5 rounded-xl"><Trash2 size={15} /> Delete</button>
              </div>
              {r.occupied > 0 && <p className="text-xs text-slate-400">A room can only be deleted when nobody lives in it.</p>}
            </div>
          </Modal>
        );
      })()}

      {modal?.type === 'delete-selected' && (
        <Modal title="Delete selected rooms" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700">These <b>{selectedRooms.length}</b> empty room(s) will be deleted:</p>
            <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 max-h-24 overflow-y-auto">{selectedRooms.sort(byRoomNo).map((r) => r.room_no).join(', ')}</p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={deleteSelected} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl">{saving ? 'Deleting...' : `Delete ${selectedRooms.length} room(s)`}</button>
            </div>
          </div>
        </Modal>
      )}

      {modal?.type === 'delete-range' && (
        <Modal title="Delete a range of rooms" onClose={() => setModal(null)}>
          <form onSubmit={runRangeDelete} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Prefix"><input value={form.prefix} maxLength={10} disabled={Boolean(preview)} onChange={(e) => setForm({ ...form, prefix: e.target.value })} placeholder="none" className={inputCls} /></Field>
              <Field label="From"><input type="number" required value={form.from} disabled={Boolean(preview)} onChange={(e) => setForm({ ...form, from: e.target.value })} placeholder="101" className={inputCls} /></Field>
              <Field label="To"><input type="number" required value={form.to} disabled={Boolean(preview)} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="120" className={inputCls} /></Field>
            </div>
            {!preview ? (
              <p className="text-xs text-slate-500">
                Prefix is only for room numbers like "A-101"; leave it empty for plain numbers.
                {allRooms.length > 0 && <> This hostel's rooms go from <b>{[...allRooms].sort(byRoomNo)[0].room_no}</b> to <b>{[...allRooms].sort(byRoomNo)[allRooms.length - 1].room_no}</b>.</>}
                {' '}You'll see exactly which rooms will be deleted before anything happens. Rooms where students live are never deleted.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {preview.will_delete.length ? (
                  <>
                    <p className="text-slate-700"><b>{preview.will_delete.length}</b> empty room(s) will be deleted:</p>
                    <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 max-h-24 overflow-y-auto">{preview.will_delete.join(', ')}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">
                    Nothing to delete in this range.{' '}
                    {preview.skipped_occupied.length ? 'Every room found has students living in it.' : 'No room numbers in this range exist in this hostel — check the numbers and the prefix.'}
                  </p>
                )}
                {preview.skipped_occupied.length > 0 && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex gap-1.5">
                    <AlertTriangle size={14} className="flex-shrink-0" />
                    Kept because students live there (move them out first to delete): {preview.skipped_occupied.map((r) => `${r.room_no} (${r.students})`).join(', ')}
                  </p>
                )}
                {preview.not_found.length > 0 && <p className="text-xs text-slate-400">{preview.not_found.length} number(s) in this range don't exist: {preview.not_found.slice(0, 15).join(', ')}{preview.not_found.length > 15 ? '…' : ''}</p>}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => (preview ? setPreview(null) : setModal(null))} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">{preview ? 'Back' : 'Cancel'}</button>
              <button type="submit" disabled={saving || (preview && !preview.will_delete.length)} className={`flex-1 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition ${preview ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                {saving ? 'Working...' : preview ? `Delete ${preview.will_delete.length} room(s)` : 'Preview'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal && ['one', 'bulk', 'edit'].includes(modal.type) && (
        <Modal title={modal.type === 'bulk' ? 'Add a range of rooms' : modal.type === 'edit' ? `Edit room ${modal.room.room_no}` : 'Add room'} onClose={() => setModal(null)}>
          <form onSubmit={save} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
            {modal.type === 'bulk' ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Prefix"><input value={form.prefix} maxLength={10} onChange={(e) => setForm({ ...form, prefix: e.target.value })} placeholder="none" className={inputCls} /></Field>
                  <Field label="From"><input type="number" required value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className={inputCls} /></Field>
                  <Field label="To"><input type="number" required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className={inputCls} /></Field>
                </div>
                <p className="text-xs text-slate-500">Creates {form.prefix}{form.from} … {form.prefix}{form.to} ({Math.max(0, Number(form.to) - Number(form.from) + 1)} rooms). Existing rooms are skipped.</p>
              </>
            ) : (
              <Field label="Room number"><input required maxLength={20} value={form.room_no} onChange={(e) => setForm({ ...form, room_no: e.target.value })} placeholder="e.g. A-101" className={inputCls} /></Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Beds per room"><input type="number" min="1" max="50" required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className={inputCls} /></Field>
              <Field label="Floor (optional)"><input maxLength={20} value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="e.g. Ground, 1, 2" className={inputCls} /></Field>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
};

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
    {children}
  </div>
);

export default RoomManagement;
