import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import DashboardHeader from '../../components/ui/DashboardHeader';
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
    { label: 'Currently Outside', value: stats?.currentlyOutside, icon: DoorOpen, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: "Today's Exits", value: stats?.todaysExits, icon: LogOut, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { label: "Today's Returns", value: stats?.todaysReturns, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Overdue', value: stats?.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
  ];

  return (
    <Layout>
      <DashboardHeader title={`Welcome, ${user?.name?.split(' ')[0]}`} subtitle="Gate scanning and student movement overview" refresh={refresh} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`bg-white rounded-2xl p-5 shadow-sm border ${border}`}>
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4`}>
              <Icon size={22} className={color} />
            </div>
            <p className="text-3xl font-bold text-slate-800">
              {loading ? <span className="animate-pulse text-slate-300">—</span> : (value ?? 0)}
            </p>
            <p className="text-slate-500 text-sm mt-1">{label}</p>
          </div>
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
