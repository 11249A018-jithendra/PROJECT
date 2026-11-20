import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import DashboardHeader from '../../components/ui/DashboardHeader';
import StatCard from '../../components/ui/StatCard';
import useDashboardData from '../../hooks/useDashboardData';
import { DoorOpen, LogOut, CheckCircle2, AlertTriangle, QrCode, ArrowRight, History, Keyboard } from 'lucide-react';

const SecurityDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  // Live gate numbers: loaded on open, by the Refresh button, and every 20 s while the tab is open.
  const refresh = useDashboardData(async () => {
    const [today, overdue] = await Promise.all([
      api.get('/security/today'),
      api.get('/outpasses/overdue'),
    ]);
    setStats({
      currentlyOutside: today.data.currentlyOutside,
      todaysExits: today.data.todaysExits,
      todaysReturns: today.data.todaysReturns,
      overdue: overdue.data.length,
    });
  }, { intervalMs: 20000 });
  const { loading } = refresh;

  const cards = [
    { label: 'Currently Outside', value: stats?.currentlyOutside, icon: DoorOpen, tone: 'amber' },
    { label: "Today's Exits", value: stats?.todaysExits, icon: LogOut, tone: 'lilac' },
    { label: "Today's Returns", value: stats?.todaysReturns, icon: CheckCircle2, tone: 'mint' },
    { label: 'Overdue', value: stats?.overdue, icon: AlertTriangle, tone: 'coral' },
  ];

  return (
    <Layout>
      <DashboardHeader title={`Welcome, ${user?.name?.split(' ')[0]}`} subtitle="Gate scanning and student movement overview" refresh={refresh} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon, tone }) => (
          <StatCard key={label} label={label} value={value} icon={icon} loading={loading} tone={tone} />
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/security/scan"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-5 rounded-xl transition shadow-md shadow-indigo-200"
        >
          <QrCode size={16} /> Scan QR Code <ArrowRight size={16} />
        </Link>
        <Link
          to="/security/scan?mode=token"
          className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-5 rounded-xl transition"
        >
          <Keyboard size={16} /> Manual / Type Token
        </Link>
        <Link
          to="/security/currently-outside"
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-orange-300 text-slate-700 font-medium py-2.5 px-5 rounded-xl transition"
        >
          <DoorOpen size={16} /> Currently Outside
        </Link>
        <Link
          to="/security/scan-history"
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 font-medium py-2.5 px-5 rounded-xl transition"
        >
          <History size={16} /> Scan History
        </Link>
      </div>
    </Layout>
  );
};

export default SecurityDashboard;
