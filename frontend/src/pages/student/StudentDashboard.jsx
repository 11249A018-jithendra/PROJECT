import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';
import EmergencyHelpCard from '../../components/EmergencyHelpCard';
import DashboardHeader from '../../components/ui/DashboardHeader';
import useDashboardData from '../../hooks/useDashboardData';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { formatDate } from '../../utils/format';
import { AlertCircle, FileText, Home, ArrowRight, UtensilsCrossed, Sun, Coffee, Moon, Sandwich } from 'lucide-react';

const MESS_TIMINGS = [
  { label: 'Breakfast', time: '7:30 AM – 9:00 AM', icon: Sun, color: '#f59e0b', bg: '#fffbeb' },
  { label: 'Lunch', time: '12:30 PM – 2:00 PM', icon: Sandwich, color: '#10b981', bg: '#ecfdf5' },
  { label: 'Evening Snacks', time: '4:30 PM – 5:00 PM', icon: Coffee, color: '#8b5cf6', bg: '#f5f3ff' },
  { label: 'Dinner', time: '7:30 PM – 9:00 PM', icon: Moon, color: '#3b82f6', bg: '#eff6ff' },
];

const FIELDS = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅', color: 'text-amber-700', bg: '#fffbeb' },
  { key: 'lunch', label: 'Lunch', emoji: '🍱', color: 'text-emerald-700', bg: '#ecfdf5' },
  { key: 'snacks', label: 'Evening Snacks', emoji: '☕', color: 'text-violet-700', bg: '#f5f3ff' },
  { key: 'dinner', label: 'Dinner', emoji: '🌙', color: 'text-blue-700', bg: '#eff6ff' },
];

const StudentDashboard = () => {
  const { user, updateUser } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [outpasses, setOutpasses] = useState([]);
  const [messMenu, setMessMenu] = useState([]);
  const [contactsKey, setContactsKey] = useState(0); // bumps so the emergency contacts reload too

  // Loaded on open, by the Refresh button, and every 45 s while the tab is open.
  const refresh = useDashboardData(async ({ initial }) => {
    const [c, o, menu, me] = await Promise.all([
      api.get('/complaints'),
      api.get('/outpasses'),
      api.get('/mess/menu').catch(() => null),
      // Profile (name, room, hostel…) as the server has it now; optional.
      api.get('/auth/me').catch(() => null),
    ]);
    setComplaints(c.data);
    setOutpasses(o.data);
    if (menu) setMessMenu(menu.data);
    if (me) updateUser(me.data);
    if (!initial) setContactsKey((k) => k + 1);
  }, { intervalMs: 45000 });
  const { loading } = refresh;
  const messLoading = loading;

  const statCards = [
    { label: 'Total Complaints', value: complaints.length, icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Pending Complaints', value: complaints.filter(c => c.status === 'Pending').length, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Outpass Requests', value: outpasses.length, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Approved Outpasses', value: outpasses.filter(o => o.status === 'Approved').length, icon: FileText, color: 'text-green-500', bg: 'bg-green-50' },
  ];

  return (
    <Layout>
      {/* Welcome */}
      <DashboardHeader title={`Welcome back, ${user?.name?.split(' ')[0]}`} subtitle="Here's an overview of your hostel activity." refresh={refresh} />

      {/* Profile Summary */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white mb-8 shadow-lg shadow-indigo-200">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-indigo-200 text-xs">Name</p>
              <p className="font-semibold text-sm">{user?.name}</p>
            </div>
            <div>
              <p className="text-indigo-200 text-xs">Roll No.</p>
              <p className="font-semibold text-sm">{user?.roll_no || 'N/A'}</p>
            </div>
            <div>
              <p className="text-indigo-200 text-xs">Room</p>
              <p className="font-semibold text-sm flex items-center gap-1"><Home size={12} /> {user?.room_no || 'N/A'}</p>
            </div>
            <div>
              <p className="text-indigo-200 text-xs">Course</p>
              <p className="font-semibold text-sm">{user?.course_year || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={20} className={color} />
            </div>
            <p className="text-2xl font-bold text-slate-800">{loading ? '—' : value}</p>
            <p className="text-slate-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Emergency Help: one-tap calls + SOS */}
      <div className="mb-8">
        <EmergencyHelpCard refreshKey={contactsKey} />
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Complaints */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Recent Complaints</h3>
            <Link to="/complaints" className="text-indigo-600 text-sm flex items-center gap-1 hover:gap-2 transition-all min-h-6 px-1 -mx-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              <SkeletonRows rows={3} />
            ) : complaints.length === 0 ? (
              <EmptyState icon={AlertCircle} title="No complaints filed yet" message="Something broken in your room? Let the warden know." actionLabel="File a complaint" to="/complaints" />
            ) : (
              complaints.slice(0, 4).map((c) => (
                <div key={c._id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700 capitalize">{c.category}</p>
                    <p className="text-xs text-slate-500 truncate max-w-48">{c.description}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Outpasses */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Recent Outpass Requests</h3>
            <Link to="/outpasses" className="text-indigo-600 text-sm flex items-center gap-1 hover:gap-2 transition-all min-h-6 px-1 -mx-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              <SkeletonRows rows={3} />
            ) : outpasses.length === 0 ? (
              <EmptyState icon={FileText} title="No outpass requests yet" message="Going out or home? Apply and your warden will review it." actionLabel="Apply for an outpass" to="/outpasses" />
            ) : (
              outpasses.slice(0, 4).map((o) => (
                <div key={o._id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{o.reason}</p>
                    <p className="text-xs text-slate-500">{formatDate(o.leave_datetime)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mess timetable */}
      {(() => {
        const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
        return (
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header Banner */}
            <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5986 100%)' }} className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <UtensilsCrossed size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">Hostel Mess Timetable</h3>
                <p className="text-blue-200 text-xs mt-0.5">Good Food • Healthy Life • Happy Stay</p>
              </div>
            </div>

            {/* Mess Timings Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b border-slate-100">
              {MESS_TIMINGS.map(({ label, time, icon: Icon, color, bg }) => (
                <div
                  key={label}
                  style={{ background: bg, border: `1px solid ${color}22` }}
                  className="rounded-xl p-3 flex flex-col items-center text-center gap-1.5"
                >
                  <div style={{ background: `${color}18` }} className="w-9 h-9 rounded-full flex items-center justify-center">
                    <Icon size={18} style={{ color }} />
                  </div>
                  <p style={{ color }} className="text-xs font-semibold">{label}</p>
                  <p className="text-slate-600 text-xs font-medium">{time}</p>
                </div>
              ))}
            </div>

            {messLoading ? (
              <SkeletonRows rows={4} />
            ) : messMenu.length === 0 ? (
              <EmptyState icon={UtensilsCrossed} title="Menu not available" message="The mess menu hasn't been published yet." />
            ) : (
              <>
                {/* Phones: one card per day */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {messMenu.map((row) => {
                    const isToday = row.day === todayName;
                    return (
                      <div
                        key={row.day}
                        style={
                          isToday
                            ? { background: 'linear-gradient(90deg, #b0bce3ff 0%, #44a561ff 100%)', borderLeft: '3px solid #4f46e5' }
                            : { borderLeft: '3px solid transparent' }
                        }
                        className="p-4"
                      >
                        <p className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isToday ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {row.day}
                          {isToday && <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">Today</span>}
                        </p>
                        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-xs">
                          {FIELDS.map(f => (
                            <div key={f.key} className="contents">
                              <dt className={`font-semibold flex items-center gap-1 ${f.color}`}>
                                <span>{f.emoji}</span> {f.label}
                              </dt>
                              <dd className="text-slate-600">{row[f.key]}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  })}
                </div>

                {/* Larger screens: weekly table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr style={{ background: '#a36e79ff' }}>
                        <th className="text-left px-4 py-3 text-slate-600 font-semibold text-xs uppercase tracking-wide w-28">Day</th>
                        {FIELDS.map(f => (
                          <th
                            key={f.key}
                            style={{ background: f.bg }}
                            className={`px-4 py-3 ${f.color} font-semibold text-xs uppercase tracking-wide text-center`}
                          >
                            {f.emoji} {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {messMenu.map((row) => {
                        const isToday = row.day === todayName;
                        return (
                          <tr
                            key={row.day}
                            style={
                              isToday
                                ? { background: 'linear-gradient(90deg, #7186c8ff 0%, #5ba270ff 100%)', borderLeft: '3px solid #656393ff' }
                                : { borderLeft: '3px solid transparent' }
                            }
                            className="border-b border-slate-50 transition-colors hover:bg-slate-50/70"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold text-sm ${isToday ? 'text-indigo-700' : 'text-slate-700'}`}>{row.day}</span>
                                {isToday && <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">Today</span>}
                              </div>
                            </td>
                            {FIELDS.map(f => (
                              <td key={f.key} className="px-4 py-3 text-center text-slate-600 text-xs leading-relaxed">
                                {row[f.key]}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 text-center bg-slate-50/50">
                  <p className="text-slate-400 text-xs italic">— Eat Well • Study Well • Grow Well —</p>
                </div>
              </>
            )}
          </div>
        );
      })()}
    </Layout>
  );
};

export default StudentDashboard;
