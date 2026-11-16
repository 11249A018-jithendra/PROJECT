import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import api, { API_ROOT_URL } from '../../api/axios';
import { Search, LogOut, LogIn, AlertTriangle, CheckCircle2, QrCode, Smartphone } from 'lucide-react';
import { EmptyState } from '../../components/ui/Feedback';
import { formatDateTime } from '../../utils/format';

const fmt = formatDateTime;
const REASONS = ['Phone battery dead', 'QR code not loading', 'Phone forgotten / lost', 'Camera scanner not working'];

// Gate entry without a QR scan. Same rules as a scan; every entry needs a
// reason and is logged as MANUAL under the guard's name.
const ManualGate = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { student, outpass, action }
  const [reason, setReason] = useState(REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults(null); return undefined; }
    const id = setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const res = await api.get(`/outpasses/gate-lookup?q=${encodeURIComponent(q)}`);
        setResults(res.data);
      } catch (e) {
        setError(e.response?.data?.message || 'Search failed.');
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [query]);

  const submit = async () => {
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (finalReason.length < 5) { setError('Please describe the reason (at least 5 characters).'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/outpasses/${confirm.outpass._id}/manual`, { action: confirm.action, reason: finalReason });
      setDone({ ...res.data, student: confirm.student });
      setConfirm(null);
      setResults(null);
      setQuery('');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not record the entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manual Gate Entry</h1>
          <p className="text-slate-500 mt-1">For students who can't show their QR code (dead phone, lost phone)</p>
        </div>
        <Link to="/security/scan" className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition text-sm">
          <QrCode size={16} /> Back to QR scanner
        </Link>
      </div>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 mb-5 text-sm">
        <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
        <p>Check the student's ID card or face against the photo before recording. Manual entries follow the same outpass rules as a scan and are logged under your name with the reason.</p>
      </div>

      {done && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-5 flex items-start gap-3">
          <CheckCircle2 size={22} className="text-green-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-green-800">{done.message}</p>
            <p className="text-green-700">{done.student.name} ({done.student.roll_no}) · {done.action === 'EXIT' ? `expected back ${fmt(done.outpass.return_datetime)}` : 'welcome back'}</p>
          </div>
          <button onClick={() => setDone(null)} className="ml-auto text-xs text-green-700 hover:underline">Dismiss</button>
        </div>
      )}

      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type roll number or name..."
          aria-label="Search student by roll number or name"
          className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        />
      </div>

      {error && !confirm && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">{error}</div>}

      {searching && <p className="text-sm text-slate-400 mb-3">Searching...</p>}
      {results && results.length === 0 && !searching && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100"><EmptyState title="No students found" message="Check the roll number or try part of the name." /></div>
      )}

      <div className="space-y-3">
        {results?.map(({ student, outpass, action }) => (
          <div key={student._id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {student.profile_photo ? (
                <img src={`${API_ROOT_URL}/${student.profile_photo}`} alt={`Photo of ${student.name}`} className="w-16 h-16 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-indigo-100 text-indigo-600 text-2xl font-bold flex items-center justify-center flex-shrink-0">{student.name?.[0]}</div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{student.name}</p>
                <p className="text-sm text-slate-500">{student.roll_no || '—'} · Room {student.room_no || '—'}</p>
                {outpass ? (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={outpass.status} />
                    {outpass.pass_type === 'Home' ? 'Home visit' : 'Outing'} to {outpass.destination} · back by {fmt(outpass.return_datetime)}
                  </p>
                ) : (
                  <p className="text-xs text-red-600 mt-1">No approved outpass — the student cannot leave.</p>
                )}
              </div>
            </div>
            {outpass && action && (
              <button
                onClick={() => { setConfirm({ student, outpass, action }); setError(''); }}
                className={`flex items-center justify-center gap-2 text-white font-medium px-5 py-3 rounded-xl transition ${action === 'EXIT' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-green-600 hover:bg-green-500'}`}
              >
                {action === 'EXIT' ? <LogOut size={18} /> : <LogIn size={18} />}
                Record {action === 'EXIT' ? 'Exit' : 'Return'}
              </button>
            )}
          </div>
        ))}
      </div>

      {confirm && (
        <Modal title={`Record ${confirm.action === 'EXIT' ? 'Exit' : 'Return'} — ${confirm.student.name}`} onClose={() => setConfirm(null)}>
          <div className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
            <p className="text-sm text-slate-600 flex items-center gap-2"><Smartphone size={16} /> Why can't the QR be scanned?</p>
            <div className="space-y-2">
              {[...REASONS, 'Other'].map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                  {r}
                </label>
              ))}
            </div>
            {reason === 'Other' && (
              <input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                maxLength={300}
                placeholder="Describe the reason"
                aria-label="Other reason"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setConfirm(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button onClick={submit} disabled={submitting} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">
                {submitting ? 'Recording...' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
};

export default ManualGate;
