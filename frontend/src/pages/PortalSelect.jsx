import { ShieldCheck, UserCog, GraduationCap, ScanLine, Building2 } from 'lucide-react';
import CampusBanner from '../components/ui/CampusBanner';
const ROLES = [
  { to: '/staff/login?as=admin', title: 'Admin', description: 'Manage residents, rooms, staff and the whole campus.', icon: ShieldCheck, tone: 'lilac' },
  { to: '/staff/login?as=warden', title: 'Warden', description: 'Look after your students, attendance and outpass requests.', icon: UserCog, tone: 'mint' },
  { to: '/student/login', title: 'Student', description: 'Your room, outpasses, announcements and everyday hostel life.', icon: GraduationCap, tone: 'sky' },
  { to: '/gate/login', title: 'Security', description: 'Verify outpasses and keep campus entry and exit connected.', icon: ScanLine, tone: 'amber' },
];
const PortalSelect = () => (
  <div className="vs-auth">
    <header className="vs-auth-header"><a href="/" className="vs-auth-brand"><Building2 aria-hidden="true" />HostelMS</a><span className="text-sm text-slate-500">Campus life, connected</span></header>
    <main className="vs-portal-main">
      <CampusBanner title="A vibrant campus. A clearer day." subtitle="One connected place for hostel life. Choose your portal to get started." eyebrow="WELCOME TO YOUR CAMPUS COMMUNITY" />
      <div className="vs-portal-grid">{ROLES.map(({ to, title, description, icon: Icon, tone }) => <section key={title} className={`vs-portal-card vs-stat-${tone}`}><Icon aria-hidden="true" /><h2>{title}</h2><p>{description}</p><a href={to}>Enter {title.toLowerCase()} portal</a></section>)}</div>
    </main>
    <footer className="vs-auth-footer">Hostel Management System · Designed by Jithendra</footer>
  </div>
);
export default PortalSelect;
