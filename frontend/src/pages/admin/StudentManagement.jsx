import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { Link } from 'react-router-dom';
import { Search, Users, User, Plus, X, LogOut, AlertTriangle, DoorClosed, History, KeyRound } from 'lucide-react';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import PasswordField, { passwordProblem } from '../../components/PasswordField';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';

const StudentManagement = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Outpass Modal State
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    reason: '', leave_datetime: '', return_datetime: '', destination: '', parent_consent: true, pass_type: 'Outing',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [wardens, setWardens] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [roomDraft, setRoomDraft] = useState('');
  const [assignError, setAssignError] = useState('');
  const [hostelRooms, setHostelRooms] = useState([]);
  const [checkout, setCheckout] = useState(null); // { reason, error, busy, needsConfirm }
  const [resetPw, setResetPw] = useState(null); // admin: { password, confirm, error, busy, done }
  // Wardens may only issue outpasses for today — taken from the SERVER's date,
  // never the device clock (the server enforces it too).
  const [serverToday, setServerToday] = useState('');
  const [exitForm, setExitForm] = useState(null); // warden: { reason, exit_date, remarks, error, busy }
  const [flash, setFlash] = useState('');

  const isWarden = user?.role === 'warden';
  const prefix = isWarden ? '/warden' : '/admin';

  const fetchStudents = async (q = '') => {
    setLoading(true);
    try {
      const res = await api.get(`${prefix}/students?search=${encodeURIComponent(q)}${isWarden ? '' : '&status=active'}`);
      setStudents(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchStudents(search); 
    if (isWarden) {
      api.get('/warden/dashboard').then((r) => setServerToday(r.data.current_date)).catch(() => {});
    } else {
      api.get('/admin/dashboard').then((r) => setServerToday(r.data.current_date)).catch(() => {});
    }
    if (!isWarden) {
      api.get('/admin/wardens').then(res => setWardens(res.data)).catch(console.error);
      // 503 until hostel_tracking.sql has been run — hostel picker just stays hidden.
      api.get('/admin/hostels').then(res => setHostels(res.data)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWarden, prefix]);

  const loadRooms = async (hostelId) => {
    if (!hostelId || isWarden) { setHostelRooms([]); return; }
    try {
      const res = await api.get(`/admin/rooms?hostel_id=${hostelId}`);
      setHostelRooms(res.data.rooms);
    } catch { setHostelRooms([]); }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    fetchStudents(e.target.value);
  };

  const openDetail = async (id) => {
    setSelected(id);
    setDetailLoading(true);
    try {
      const res = await api.get(`${prefix}/students/${id}`);
      setDetail(res.data);
      setRoomDraft(res.data.student.room_no || '');
      setAssignError('');
      loadRooms(res.data.student.hostel_id);
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  const assignWarden = async (wardenId) => {
    try {
      await api.put(`/admin/students/${selected}/warden`, { assigned_warden: wardenId });
      openDetail(selected);
    } catch (e) { setAssignError(e.response?.data?.message || 'Could not assign warden.'); }
  };

  // Either { hostel_id } (and free-text room for hostels without rooms) or { room_id }.
  const assignHostel = async (payload) => {
    try {
      await api.put(`/admin/students/${selected}/hostel`, payload);
      openDetail(selected);
      fetchStudents(search);
    } catch (e) { setAssignError(e.response?.data?.message || 'Could not update hostel.'); }
  };

  const runCheckout = async (force = false) => {
    setCheckout((c) => ({ ...c, busy: true, error: '' }));
    try {
      const res = await api.post(`/admin/students/${selected}/checkout`, { reason: checkout.reason, force });
      setCheckout(null);
      setFlash(res.data.message);
      setTimeout(() => setFlash(''), 6000);
      setSelected(null);
      setDetail(null);
      fetchStudents(search);
    } catch (e) {
      setCheckout((c) => ({ ...c, busy: false, error: e.response?.data?.message || 'Could not check out.', needsConfirm: Boolean(e.response?.data?.needs_confirmation) }));
    }
  };

  // Warden: ask the admin to permanently exit this student.
  const submitExitRequest = async () => {
    setExitForm((f) => ({ ...f, busy: true, error: '' }));
    try {
      await api.post('/exit-requests', {
        student_id: selected,
        reason: exitForm.reason,
        exit_date: exitForm.exit_date || null,
        remarks: exitForm.remarks,
      });
      setExitForm(null);
      setFlash('Exit request sent to the admin. The student stays active until it is approved.');
      setTimeout(() => setFlash(''), 6000);
      openDetail(selected);
      fetchStudents(search);
    } catch (e) {
      setExitForm((f) => ({ ...f, busy: false, error: e.response?.data?.message || 'Could not send the request.' }));
    }
  };

  const handleApplyOutpass = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/outpasses', { ...form, student_id: selected });
      setShowModal(false);
      setForm({ reason: '', leave_datetime: '', return_datetime: '', destination: '', parent_consent: true, pass_type: 'Outing' });
      // Refresh details to show new outpass
      openDetail(selected);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Student Management</h1>
        <p className="text-slate-500 mt-1">View and manage all registered students</p>
      </div>

      {flash && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 mb-5">{flash}</div>}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Student List */}
        <div className="lg:col-span-2 space-y-3">
          {!isWarden && (
            <Link to="/admin/past-students" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
              <History size={14} /> Past Students History
            </Link>
          )}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="student-search"
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="Search by name, roll, email..."
              className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {loading ? (
              <SkeletonRows rows={4} />
            ) : students.length === 0 ? (
              <EmptyState icon={Users} title="No students found" />
            ) : (
              <div className="divide-y divide-slate-50 max-h-[65vh] overflow-y-auto">
                {students.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => openDetail(s._id)}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition text-left ${selected === s._id ? 'bg-indigo-50' : ''}`}
                  >
                    <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                      {s.name[0].toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                      <p className="text-xs text-slate-400 truncate">{s.roll_no} · Room {s.room_no || '—'}</p>
                    </div>
                    {s.exit_request_pending && <span className="ml-auto text-[10px] font-semibold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 flex-shrink-0">Exit pending</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Student Detail */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 h-64 flex items-center justify-center text-center p-6">
              <div>
                <User className="mx-auto text-slate-200 mb-3" size={48} />
                <p className="text-slate-400 text-sm">Select a student to view their full profile</p>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 h-64 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* Profile Info */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative">
                
                {/* Apply Outpass Button */}
                {detail.student.is_active !== false && <button
                  onClick={() => setShowModal(true)}
                  className="absolute top-5 right-5 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition shadow-sm"
                >
                  <Plus size={14} /> Apply Outpass
                </button>}

                <ExitRequestBanner request={detail.student.latest_exit_request} isWarden={isWarden} />

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-2xl font-bold text-indigo-600">
                    {detail.student.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg pr-24">{detail.student.name}</h3>
                    <p className="text-slate-400 text-sm">{detail.student.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    ['Roll No.', detail.student.roll_no],
                    ['Room', detail.student.room_no],
                    ['Course', detail.student.course_year],
                    ['Phone', detail.student.phone],
                    ['Parent Contact', detail.student.parent_contact],
                    ...(detail.student.hostel_name !== undefined ? [['Hostel', detail.student.hostel_name]] : []),
                  ].map(([label, value]) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-slate-400 text-xs">{label}</p>
                      <p className="text-slate-700 text-sm font-medium mt-0.5">{value || 'N/A'}</p>
                    </div>
                  ))}
                  
                  {'home_address' in detail.student && (
                    <div className="bg-slate-50 rounded-xl p-3 col-span-2 sm:col-span-3">
                      <p className="text-slate-400 text-xs">Home Address</p>
                      <p className="text-slate-700 text-sm font-medium mt-0.5 whitespace-pre-line">{detail.student.home_address || 'N/A'}</p>
                    </div>
                  )}

                  {detail.student.location && (
                    <div className="bg-slate-50 rounded-xl p-3 col-span-2 sm:col-span-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Attendance today</p>
                        <StatusBadge status={detail.student.attendance_today === 'Pending' ? 'Not Marked' : detail.student.attendance_today} />
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Hostel status (live)</p>
                        <StatusBadge status={detail.student.location} />
                      </div>
                      <div className="text-xs text-slate-500">
                        <p>Last exit: {detail.student.last_exit ? new Date(detail.student.last_exit).toLocaleString('en-IN') : '—'}</p>
                        <p>Last entry: {detail.student.last_entry ? new Date(detail.student.last_entry).toLocaleString('en-IN') : '—'}</p>
                      </div>
                    </div>
                  )}

                  {assignError && (
                    <div className="col-span-2 sm:col-span-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{assignError}</div>
                  )}

                  {!isWarden && hostels.length > 0 && detail.student.is_active !== false && (
                    <div className="bg-slate-50 rounded-xl p-3 col-span-2 sm:col-span-3 grid sm:grid-cols-2 gap-2">
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Assigned Hostel</p>
                        <select
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                          value={detail.student.hostel_id || ''}
                          onChange={(e) => assignHostel({ hostel_id: e.target.value || null })}
                          aria-label="Hostel"
                        >
                          <option value="">-- No Hostel Assigned --</option>
                          {hostels.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Room</p>
                        {hostelRooms.length > 0 ? (
                          <select
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                            value={detail.student.room_id || ''}
                            onChange={(e) => e.target.value && assignHostel({ room_id: e.target.value })}
                            aria-label="Room"
                          >
                            <option value="">-- Pick a room --</option>
                            {hostelRooms.map((r) => {
                              const mine = r._id === detail.student.room_id;
                              return (
                                <option key={r._id} value={r._id} disabled={!mine && r.vacant === 0}>
                                  {r.room_no} — {mine ? 'current' : r.vacant === 0 ? 'full' : `${r.vacant} of ${r.capacity} free`}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <input
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none disabled:bg-slate-100"
                            value={roomDraft}
                            disabled={!detail.student.hostel_id}
                            placeholder={detail.student.hostel_id ? 'Room number' : 'Pick a hostel first'}
                            onChange={(e) => setRoomDraft(e.target.value)}
                            onBlur={() => roomDraft !== (detail.student.room_no || '') && assignHostel({ hostel_id: detail.student.hostel_id, room_no: roomDraft })}
                            aria-label="Room number"
                          />
                        )}
                        {detail.student.hostel_id && hostelRooms.length === 0 && (
                          <p className="text-[11px] text-slate-400 mt-1">Add rooms on the Rooms page to enforce capacity.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {!isWarden && (
                    <div className="bg-slate-50 rounded-xl p-3 col-span-2 sm:col-span-3">
                      <p className="text-slate-400 text-xs mb-1">Assigned Warden</p>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                        value={detail.student.assigned_warden || ''}
                        onChange={(e) => assignWarden(e.target.value)}
                      >
                        <option value="">-- No Warden Assigned --</option>
                        {wardens.map(w => (
                          <option key={w._id} value={w._id} disabled={w.is_active === false && w._id !== detail.student.assigned_warden}>
                            {w.name} ({w.email}){w.is_active === false ? ' — inactive' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isWarden && (
                    <div className="col-span-2 sm:col-span-3 flex justify-end">
                      <button
                        onClick={() => setExitForm({ reason: '', exit_date: '', remarks: '', error: '', busy: false })}
                        disabled={detail.student.latest_exit_request?.status === 'Pending'}
                        title={detail.student.latest_exit_request?.status === 'Pending' ? 'A request is already waiting for the admin' : undefined}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <DoorClosed size={14} /> Request Permanent Exit
                      </button>
                    </div>
                  )}

                  {!isWarden && detail.student.is_active !== false && (
                    <div className="col-span-2 sm:col-span-3 flex justify-end gap-2">
                      <button
                        onClick={() => setResetPw({ password: '', confirm: '', error: '', busy: false, done: '' })}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg px-3 py-1.5 transition"
                      >
                        <KeyRound size={14} /> Reset password
                      </button>
                      <button
                        onClick={() => setCheckout({ reason: '', error: '', busy: false, needsConfirm: false })}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 transition"
                      >
                        <LogOut size={14} /> Check out of hostel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Complaint History */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <h4 className="font-semibold text-slate-700 mb-3">Complaint History ({detail.complaints.length})</h4>
                {detail.complaints.length === 0 ? (
                  <p className="text-sm text-slate-400">No complaints.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {detail.complaints.map((c) => (
                      <div key={c._id} className="flex justify-between items-center text-sm bg-slate-50 rounded-lg px-3 py-2">
                        <span className="capitalize text-slate-700">{c.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'Resolved' ? 'bg-green-100 text-green-700' : c.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{c.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outpass History */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <h4 className="font-semibold text-slate-700 mb-3">Outpass History ({detail.outpasses.length})</h4>
                {detail.outpasses.length === 0 ? (
                  <p className="text-sm text-slate-400">No outpass requests.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {detail.outpasses.map((o) => (
                      <div key={o._id} className="flex justify-between items-center text-sm bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-slate-700 truncate max-w-48">{o.reason}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${o.status === 'Approved' ? 'bg-green-100 text-green-700' : o.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{o.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {checkout && (
        <Modal title={`Check out ${detail?.student?.name}`} onClose={() => setCheckout(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Use this when a student leaves the hostel for good and no warden request is needed. Their profile and history are archived to <b>Past Students</b>, their bed is freed, open outpass requests are cancelled and they can no longer log in. You can re-admit them later from Past Students.</p>
            {checkout.error && (
              <div className={`text-sm rounded-xl p-3 border ${checkout.needsConfirm ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-600'}`}>
                {checkout.needsConfirm && <AlertTriangle size={14} className="inline mr-1" />}{checkout.error}
              </div>
            )}
            <div>
              <label htmlFor="checkout-reason" className="block text-sm font-medium text-slate-600 mb-1.5">Reason</label>
              <input id="checkout-reason" value={checkout.reason} maxLength={300} onChange={(e) => setCheckout({ ...checkout, reason: e.target.value })} placeholder="e.g. Course completed" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCheckout(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button
                onClick={() => runCheckout(checkout.needsConfirm)}
                disabled={checkout.busy || checkout.reason.trim().length < 5}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition"
              >
                {checkout.busy ? 'Saving...' : checkout.needsConfirm ? 'Check out anyway' : 'Check out'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {exitForm && (
        <Modal title={`Request permanent exit — ${detail?.student?.name}`} onClose={() => setExitForm(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              This sends a request to the admin. The student stays active and in your list until the admin approves it; after approval their records move to the admin's Past Students History.
            </p>
            {exitForm.error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{exitForm.error}</div>}
            <div>
              <label htmlFor="exit-reason" className="block text-sm font-medium text-slate-600 mb-1.5">Reason for leaving *</label>
              <textarea id="exit-reason" rows={3} maxLength={500} value={exitForm.reason} onChange={(e) => setExitForm({ ...exitForm, reason: e.target.value })} placeholder="e.g. Course completed / transferred / withdrew admission" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="exit-date" className="block text-sm font-medium text-slate-600 mb-1.5">Last day in hostel</label>
                <input id="exit-date" type="date" value={exitForm.exit_date} onChange={(e) => setExitForm({ ...exitForm, exit_date: e.target.value })} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label htmlFor="exit-remarks" className="block text-sm font-medium text-slate-600 mb-1.5">Remarks</label>
                <input id="exit-remarks" maxLength={500} value={exitForm.remarks} onChange={(e) => setExitForm({ ...exitForm, remarks: e.target.value })} placeholder="e.g. Room keys returned" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setExitForm(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button
                onClick={submitExitRequest}
                disabled={exitForm.busy || exitForm.reason.trim().length < 5}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition"
              >
                {exitForm.busy ? 'Sending...' : 'Send to admin'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {resetPw && (
        <Modal title={`Reset password — ${detail?.student?.name}`} onClose={() => setResetPw(null)}>
          {resetPw.done ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3">{resetPw.done}</div>
              <button onClick={() => setResetPw(null)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl transition">Done</button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const problem = passwordProblem(resetPw.password);
                if (problem) return setResetPw({ ...resetPw, error: `Password: ${problem}` });
                if (resetPw.password !== resetPw.confirm) return setResetPw({ ...resetPw, error: 'Passwords do not match.' });
                setResetPw({ ...resetPw, busy: true, error: '' });
                try {
                  const r = await api.put(`/admin/users/${selected}/password`, { password: resetPw.password });
                  setResetPw({ ...resetPw, busy: false, done: r.data.message });
                } catch (err) {
                  setResetPw({ ...resetPw, busy: false, error: err.response?.data?.message || 'Could not reset the password.' });
                }
              }}
            >
              <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3">For a student who forgot their password. Give them the new password in person — it is stored hashed and never shown again. They'll be signed out everywhere and can change it from the sidebar.</p>
              {resetPw.error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{resetPw.error}</div>}
              <PasswordField id="student-reset-pw" label="New password" value={resetPw.password} onChange={(v) => setResetPw({ ...resetPw, password: v })} showStrength />
              <PasswordField id="student-reset-pw2" label="Confirm new password" value={resetPw.confirm} onChange={(v) => setResetPw({ ...resetPw, confirm: v })} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setResetPw(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={resetPw.busy} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">{resetPw.busy ? 'Saving...' : 'Reset Password'}</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Admin Apply Outpass Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">Issue Outpass for {detail?.student?.name}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleApplyOutpass} className="space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Reason for leaving</label>
                <input
                  type="text"
                  required
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Family function"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Outpass type</label>
                <select
                  value={form.pass_type}
                  onChange={(e) => setForm({ ...form, pass_type: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Outing">Outing (local, same day)</option>
                  <option value="Home">Home visit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Destination</label>
                <input
                  type="text"
                  required
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  placeholder="e.g. Home - Hyderabad"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Leave Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.leave_datetime}
                    min={serverToday ? `${serverToday}T00:00` : undefined}
                    max={serverToday ? `${serverToday}T23:59` : undefined}
                    onChange={(e) => setForm({ ...form, leave_datetime: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Return Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.return_datetime}
                    onChange={(e) => setForm({ ...form, return_datetime: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">
                  {submitting ? 'Issuing...' : 'Issue Outpass & Mark Absent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

// Latest permanent-exit request for the open student (pending or recently rejected).
const ExitRequestBanner = ({ request, isWarden }) => {
  if (!request || !['Pending', 'Rejected'].includes(request.status)) return null;
  const link = isWarden ? '/warden/exit-requests' : '/admin/exit-requests';
  if (request.status === 'Pending') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800 pr-28">
        <p className="flex-1"><span className="font-semibold">Permanent exit requested</span>{request.requester?.name ? ` by ${request.requester.name}` : ''} on {new Date(request.created_at).toLocaleDateString('en-IN')} — waiting for admin approval. Reason: {request.reason}</p>
        <Link to={link} className="text-xs font-semibold underline flex-shrink-0">{isWarden ? 'View status' : 'Review'}</Link>
      </div>
    );
  }
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-sm text-slate-600 pr-28">
      <span className="font-semibold text-red-600">Exit request rejected</span> on {request.decided_at ? new Date(request.decided_at).toLocaleDateString('en-IN') : '—'}: {request.rejection_reason}
    </div>
  );
};

export default StudentManagement;
