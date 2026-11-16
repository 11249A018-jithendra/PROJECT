import { useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import BreakdownBar from '../../components/ui/BreakdownBar';
import DashboardHeader from '../../components/ui/DashboardHeader';
import useDashboardData from '../../hooks/useDashboardData';
import { Users, AlertCircle, FileText, UserCog, DoorOpen, Flame, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [today, setToday] = useState(null);

  // Loaded on open, by the Refresh button, and every 45 s while the tab is open.
  const refresh = useDashboardData(async () => {
    const [dash, wardens, summary] = await Promise.all([
      api.get('/admin/dashboard'),
      api.get('/admin/wardens'),
      // Today's roll call and live location across every hostel. Optional: if it
      // isn't available the rest of the dashboard still updates.
      api.get('/admin/hostel-summary').catch(() => null),
    ]);
    setStats({ ...dash.data, totalWardens: wardens.data.length });
    setToday(summary ? summary.data.totals : null);
  }, { intervalMs: 45000 });
  const { loading } = refresh;

  const statCards = [
    { label: 'Total Students', value: stats?.totalStudents, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', link: '/admin/students' },
    { label: 'Total Wardens', value: stats?.totalWardens, icon: UserCog, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', link: '/admin/wardens' },
    { label: 'Currently Outside', value: stats?.currentlyOutside, icon: DoorOpen, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', link: '/security/currently-outside' },
    { label: 'Pending Complaints', value: stats?.pendingComplaints, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', link: '/admin/complaints' },
    { label: 'Pending Outpasses', value: stats?.pendingOutpasses, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', link: '/admin/outpasses' },
  ];

  return (
    <Layout>
      <DashboardHeader title="Admin Dashboard" subtitle="Overview of all hostel activities" refresh={refresh} />

      {/* Escalated complaints alert (only when a warden missed the 24h window) */}
      {stats?.escalatedComplaints > 0 && (
        <Link
          to="/admin/complaints?view=escalated"
          className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-2xl p-5 mb-8 hover:shadow-md transition-shadow"
        >
          <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Flame size={22} className="text-red-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-red-700">
              {stats.escalatedComplaints} complaint{stats.escalatedComplaints === 1 ? '' : 's'} escalated to Admin
            </p>
            <p className="text-sm text-red-600/80">No warden response within 24 hours. Click to review and resolve.</p>
          </div>
          <ArrowRight size={18} className="text-red-500" />
        </Link>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg, border, link }) => {
          const card = (
            <div key={label} className={`bg-white rounded-2xl p-5 shadow-sm border ${border} ${link ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
              <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4`}>
                <Icon size={22} className={color} />
              </div>
              <p className="text-3xl font-bold text-slate-800">
                {loading ? <span className="animate-pulse text-slate-300">—</span> : (value ?? 0)}
              </p>
              <p className="text-slate-500 text-sm mt-1">{label}</p>
            </div>
          );
          return link ? <Link key={label} to={link}>{card}</Link> : card;
        })}
      </div>

      {/* Today at a glance */}
      {(loading || today) && (
        <div className="grid lg:grid-cols-2 gap-4 mb-8">
          <BreakdownBar
            title="Today's attendance"
            subtitle="Roll call marked by wardens"
            loading={loading}
            items={[
              { label: 'Present', value: today?.present, color: 'bg-green-500' },
              { label: 'Absent', value: today?.absent, color: 'bg-red-400' },
              { label: 'Not marked', value: today?.notMarked, color: 'bg-slate-300' },
            ]}
            footer={<Link to="/admin/attendance" className="text-indigo-600 hover:text-indigo-500 font-medium inline-flex items-center gap-1">Open attendance <ArrowRight size={12} /></Link>}
          />
          <BreakdownBar
            title="Where students are now"
            subtitle="From gate scans"
            loading={loading}
            items={[
              { label: 'Inside', value: today?.inside, color: 'bg-indigo-500' },
              { label: 'Outside', value: today?.outside, color: 'bg-amber-400' },
              { label: 'Gone home', value: today?.goneHome, color: 'bg-violet-400' },
            ]}
            footer={<Link to="/admin/tracking" className="text-indigo-600 hover:text-indigo-500 font-medium inline-flex items-center gap-1">Open student tracking <ArrowRight size={12} /></Link>}
          />
        </div>
      )}

      {/* Quick overview */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
        <h3 className="font-bold text-lg mb-1">Quick Summary</h3>
        <p className="text-indigo-200 text-sm mb-4">Current hostel management status</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryItem label="Total Wardens" value={stats?.totalWardens} loading={loading} />
          <SummaryItem label="Currently Outside" value={stats?.currentlyOutside} loading={loading} />
          <SummaryItem label="Pending Outpasses" value={stats?.pendingOutpasses} loading={loading} />
          <SummaryItem label="Total Outpasses" value={stats?.totalOutpasses} loading={loading} />
        </div>
      </div>
    </Layout>
  );
};

const SummaryItem = ({ label, value, loading }) => (
  <div className="bg-white/10 rounded-xl p-4">
    <p className="text-2xl font-bold">{loading ? '—' : (value ?? 0)}</p>
    <p className="text-indigo-200 text-xs mt-1">{label}</p>
  </div>
);

export default AdminDashboard;
