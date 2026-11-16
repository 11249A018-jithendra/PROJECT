import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import Pager from '../../components/Pager';
import api from '../../api/axios';
import { History, CheckCircle2, XCircle, Filter } from 'lucide-react';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { formatDateTime } from '../../utils/format';

const fmt = formatDateTime;
const selectCls = 'text-sm py-2.5 bg-transparent focus:outline-none';

const ScanHistory = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState('');
  const [method, setMethod] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (result) params.set('result', result);
    if (method) params.set('method', method);
    api.get(`/security/scan-history?${params}`)
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, result, method]);

  const rows = data?.items || [];
  const changeFilter = (setter) => (e) => { setter(e.target.value); setPage(1); };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <History size={24} className="text-indigo-600" /> Scan History
        </h1>
        <p className="text-slate-500 mt-1">Audit log of every gate scan and manual entry</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3">
          <Filter size={14} className="text-slate-400" />
          <select value={result} onChange={changeFilter(setResult)} className={selectCls} aria-label="Filter by result">
            <option value="">All results</option>
            <option value="SUCCESS">Successful</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3">
          <Filter size={14} className="text-slate-400" />
          <select value={method} onChange={changeFilter(setMethod)} className={selectCls} aria-label="Filter by method">
            <option value="">QR + manual</option>
            <option value="QR">QR scans</option>
            <option value="MANUAL">Manual entries</option>
            <option value="TOKEN">Typed tokens</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState title="No scans recorded yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 font-medium">Scanned By</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.student?.name || '—'}</div>
                      <div className="text-xs text-slate-400">{r.student?.roll_no}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.action || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${r.method === 'MANUAL' || r.method === 'TOKEN' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {r.method || 'QR'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.result === 'SUCCESS' ? (
                        <span className="flex items-center gap-1 text-green-600 font-medium text-xs"><CheckCircle2 size={13} /> Success</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 font-medium text-xs"><XCircle size={13} /> Failed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.security_guard?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(r.scan_time || r.created_at)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.failure_reason || r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="entries" />}
      </div>
    </Layout>
  );
};

export default ScanHistory;
