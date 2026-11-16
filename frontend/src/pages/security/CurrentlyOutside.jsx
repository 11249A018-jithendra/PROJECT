import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';
import { DoorOpen, Clock } from 'lucide-react';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { formatDateTime } from '../../utils/format';

const fmt = formatDateTime;

const durationLabel = (mins) => {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

const CurrentlyOutside = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/security/currently-outside');
        setRows(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <DoorOpen size={24} className="text-orange-600" /> Currently Outside
        </h1>
        <p className="text-slate-500 mt-1">Students who have exited and not yet returned</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState title="No students are currently outside" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium">Destination</th>
                  <th className="px-4 py-3 font-medium">Exit Time</th>
                  <th className="px-4 py-3 font-medium">Expected Return</th>
                  <th className="px-4 py-3 font-medium">Duration Outside</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((o) => {
                  const overdue = o.return_datetime && new Date(o.return_datetime).getTime() < Date.now();
                  return (
                    <tr key={o._id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{o.student?.name}</div>
                        <div className="text-xs text-slate-400">{o.student?.roll_no}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{o.student?.room_no || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{o.destination}</td>
                      <td className="px-4 py-3 text-slate-600">{fmt(o.actual_exit_time)}</td>
                      <td className="px-4 py-3 text-slate-600">{fmt(o.return_datetime)}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 font-medium ${overdue ? 'text-red-600' : 'text-orange-600'}`}>
                          <Clock size={12} /> {durationLabel(o.duration_outside_minutes)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={overdue ? 'Overdue' : 'Checked Out'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CurrentlyOutside;
