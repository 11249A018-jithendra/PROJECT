import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';
import Pager from '../../components/Pager';
import { istTimestamp } from '../../utils/format';
import { FileText, X, Filter, MapPin, Calendar } from 'lucide-react';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';

const statuses = ['All', 'Pending', 'Approved', 'Checked Out', 'Returned', 'Rejected'];

const AdminOutpasses = () => {
  const [outpasses, setOutpasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ status: '', admin_remarks: '' });
  const [updating, setUpdating] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);

  const fetchOutpasses = async () => {
    setLoading(true);
    try {
      // Server-side paging + status filter (lists grow with every request).
      const res = await api.get(`/outpasses?page=${page}&limit=20&status=${encodeURIComponent(filterStatus)}`);
      setOutpasses(res.data.items);
      setMeta(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOutpasses(); }, [page, filterStatus]);

  const handleSelect = (o) => {
    setSelected(o);
    setForm({ status: o.status, admin_remarks: o.admin_remarks || '' });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await api.put(`/outpasses/${selected._id}`, form);
      setSelected(null);
      fetchOutpasses();
    } catch (err) { console.error(err); }
    finally { setUpdating(false); }
  };

  const filtered = outpasses;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Outpass Management</h1>
        <p className="text-slate-500 mt-1">Approve or reject student outpass requests</p>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <Filter size={14} className="text-slate-400" />
          <select
            id="outpass-filter-status"
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="text-sm text-slate-700 bg-transparent focus:outline-none"
          >
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <span className="ml-auto text-sm text-slate-400 self-center">{meta?.total ?? 0} result(s)</span>
      </div>

      {/* Outpass List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No outpass requests found" />
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((o) => (
              <div key={o._id} className="flex items-start justify-between gap-4 p-4 hover:bg-slate-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">{o.student?.name}</span>
                    <span className="text-xs text-slate-400">· Room {o.student?.room_no} · {o.student?.roll_no}</span>
                  </div>
                  <p className="text-sm text-slate-600">{o.reason}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><MapPin size={11} /> {o.destination}{o.pass_type === 'Home' ? ' · Home visit' : ''}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} /> Leave: {new Date(o.leave_datetime).toLocaleDateString('en-IN')}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} /> Return: {new Date(o.return_datetime).toLocaleDateString('en-IN')}</span>
                    {o.issued_at && <span className="text-indigo-500">Issued {istTimestamp(o.issued_at)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={o.status} />
                  <button
                    onClick={() => handleSelect(o)}
                    className="text-xs text-indigo-600 hover:text-indigo-500 border border-indigo-200 hover:border-indigo-400 rounded-lg px-2.5 py-1 transition"
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {meta && <Pager page={meta.page} pages={meta.pages} total={meta.total} onChange={setPage} label="outpasses" />}
      </div>

      {/* Review Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Review Outpass</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-1.5 text-sm text-slate-600">
              <p><span className="font-medium">Student:</span> {selected.student?.name}</p>
              <p><span className="font-medium">Reason:</span> {selected.reason}</p>
              <p><span className="font-medium">Destination:</span> {selected.destination}</p>
              <p><span className="font-medium">Leave:</span> {new Date(selected.leave_datetime).toLocaleString('en-IN')}</p>
              <p><span className="font-medium">Return:</span> {new Date(selected.return_datetime).toLocaleString('en-IN')}</p>
              {selected.issued_at && <p><span className="font-medium">Issued:</span> {istTimestamp(selected.issued_at)}</p>}
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Decision</label>
                <select
                  id="outpass-decision"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option>Pending</option>
                  <option>Approved</option>
                  <option>Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Remarks (optional)</label>
                <textarea
                  id="outpass-admin-remarks"
                  rows={3}
                  value={form.admin_remarks}
                  onChange={(e) => setForm({ ...form, admin_remarks: e.target.value })}
                  placeholder="Reason for approval / rejection..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setSelected(null)}
                  className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button id="outpass-review-submit" type="submit" disabled={updating}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">
                  {updating ? 'Saving...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminOutpasses;
