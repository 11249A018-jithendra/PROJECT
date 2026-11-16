import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';
import { Check, X, AlertTriangle, Clock } from 'lucide-react';

const TABS = ['Pending', 'Approved', 'Rejected', 'Currently Outside', 'Returned', 'Overdue'];

import { istTimestamp, formatDateTime } from '../../utils/format';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';

const fmt = formatDateTime;

const WardenOutpasses = () => {
  const [tab, setTab] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState([]);
  const [currentlyOutside, setCurrentlyOutside] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [outpasses, outside, over] = await Promise.all([
        api.get('/outpasses'),
        api.get('/security/currently-outside'),
        api.get('/outpasses/overdue'),
      ]);
      setAll(outpasses.data);
      setCurrentlyOutside(outside.data);
      setOverdue(over.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleApprove = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await api.put(`/outpasses/${id}/approve`);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve outpass.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    setBusyId(rejectTarget._id);
    setError('');
    try {
      await api.put(`/outpasses/${rejectTarget._id}/reject`, { rejection_reason: rejectReason.trim() });
      setRejectTarget(null);
      setRejectReason('');
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject outpass.');
    } finally {
      setBusyId(null);
    }
  };

  const rows = (() => {
    if (tab === 'Currently Outside') return currentlyOutside;
    if (tab === 'Overdue') return overdue;
    return all.filter((o) => o.status === tab);
  })();

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Outpass Requests</h1>
        <p className="text-slate-500 mt-1">Review student outpass applications</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 mb-4 text-sm">{error}</div>}

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState title={`No ${tab.toLowerCase()} outpasses`} />
        ) : (
          <div className="divide-y divide-slate-50">
            {rows.map((o) => (
              <div key={o._id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-slate-800">{o.student?.name}</span>
                    <span className="text-xs text-slate-400">{o.student?.roll_no} · Room {o.student?.room_no}</span>
                    <StatusBadge status={tab === 'Overdue' ? 'Overdue' : o.status} />
                  </div>
                  <p className="text-sm text-slate-600">{o.reason} · {o.destination}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                    <span>Exit: {fmt(o.leave_datetime)}</span>
                    <span>Return by: {fmt(o.return_datetime)}</span>
                    {o.issued_at && <span className="text-indigo-600">Issued: {istTimestamp(o.issued_at)}</span>}
                    {o.actual_exit_time && <span>Actual exit: {fmt(o.actual_exit_time)}</span>}
                    {(tab === 'Currently Outside' || tab === 'Overdue') && o.duration_outside_minutes != null && (
                      <span className="flex items-center gap-1 text-orange-600 font-medium">
                        <Clock size={11} /> Out {Math.floor(o.duration_outside_minutes / 60)}h {o.duration_outside_minutes % 60}m
                      </span>
                    )}
                  </div>
                  {o.rejection_reason && <p className="text-xs text-red-500 mt-1">Rejected: {o.rejection_reason}</p>}
                </div>

                {tab === 'Pending' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(o._id)}
                      disabled={busyId === o._id}
                      className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-medium rounded-lg px-3 py-2 transition"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => { setRejectTarget(o); setRejectReason(''); }}
                      disabled={busyId === o._id}
                      className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-600 font-medium rounded-lg px-3 py-2 transition border border-red-200"
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" /> Reject Outpass
              </h3>
              <button onClick={() => setRejectTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Rejecting {rejectTarget.student?.name}'s request for "{rejectTarget.reason}". A reason is required — the student will see it.
            </p>
            <form onSubmit={handleReject} className="space-y-4">
              <textarea
                required
                autoFocus
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Insufficient notice, missing parent consent..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setRejectTarget(null)}
                  className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={busyId === rejectTarget._id}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default WardenOutpasses;
