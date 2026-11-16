import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import BreakdownBar from '../../components/ui/BreakdownBar';
import DashboardHeader from '../../components/ui/DashboardHeader';
import useDashboardData from '../../hooks/useDashboardData';
import { ClipboardList, DoorOpen, AlertTriangle, ArrowRight, Users } from 'lucide-react';

const WardenDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [attendance, setAttendance] = useState(null);

  // Loaded on open, by the Refresh button, and every 45 s while the tab is open.
  const refresh = useDashboardData(async () => {
    const [pending, today, overdue, dash, roll] = await Promise.all([
      api.get('/outpasses/pending'),
      api.get('/security/today'),
      api.get('/outpasses/overdue'),
      api.get('/warden/dashboard'),
      // Today's roll call for the warden's own students (optional).
      api.get('/warden/attendance').catch(() => null),
    ]);
    setStats({
      totalStudents: dash.data.totalStudents,
      pending: pending.data.length,
      currentlyOutside: today.data.currentlyOutside,
      todaysExits: today.data.todaysExits,
      todaysReturns: today.data.todaysReturns,
      overdue: overdue.data.length,
    });
    setAttendance(roll ? roll.data.stats : null);
  }, { intervalMs: 45000 });
  const { loading } = refresh;

  const cards = [
    { label: 'Assigned Students', value: stats?.totalStudents, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', link: '/warden/students' },
    { label: 'Pending Requests', value: stats?.pending, icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', link: '/warden/outpasses' },
    { label: 'Currently Outside', value: stats?.currentlyOutside, icon: DoorOpen, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', link: '/security/currently-outside' },
    { label: 'Overdue', value: stats?.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', link: '/security/currently-outside' },
  ];

  return (
    <Layout>
      <DashboardHeader title={`Welcome, ${user?.name?.split(' ')[0]}`} subtitle="Outpass requests and student movement overview" refresh={refresh} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color, bg, border, link }) => (
          <Link key={label} to={link} className={`bg-white rounded-2xl p-5 shadow-sm border ${border} hover:shadow-md transition-shadow`}>
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4`}>
              <Icon size={22} className={color} />
            </div>
            <p className="text-3xl font-bold text-slate-800">
              {loading ? <span className="animate-pulse text-slate-300">—</span> : (value ?? 0)}
            </p>
            <p className="text-slate-500 text-sm mt-1">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <BreakdownBar
          title="Today's attendance"
          subtitle="Your students"
          loading={!attendance && loading}
          items={[
            { label: 'Present', value: attendance?.present, color: 'bg-green-500' },
            { label: 'Absent', value: attendance?.absent, color: 'bg-red-400' },
            { label: 'Not marked', value: attendance?.pending, color: 'bg-slate-300' },
          ]}
          footer={<Link to="/warden/attendance" className="text-indigo-600 hover:text-indigo-500 font-medium inline-flex items-center gap-1">Mark attendance <ArrowRight size={12} /></Link>}
        />
        <BreakdownBar
          title="Gate activity today"
          subtitle="Your students' exits and returns"
          loading={loading}
          items={[
            { label: 'Left today', value: stats?.todaysExits, color: 'bg-amber-400' },
            { label: 'Returned today', value: stats?.todaysReturns, color: 'bg-indigo-500' },
            { label: 'Still outside', value: stats?.currentlyOutside, color: 'bg-orange-500' },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/warden/outpasses"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-5 rounded-xl transition shadow-md shadow-indigo-200"
        >
          Review Outpass Requests <ArrowRight size={16} />
        </Link>
        <Link
          to="/warden/students"
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 px-5 rounded-xl transition shadow-sm"
        >
          View My Students <Users size={16} />
        </Link>
      </div>
    </Layout>
  );
};

export default WardenDashboard;
