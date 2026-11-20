import { Building2 } from 'lucide-react';
import campusArtwork from '../assets/campus-vector.svg';

const AuthShell = ({ title, subtitle, children, eyebrow = 'WELCOME TO HOSTELMS' }) => (
  <div className="vs-auth">
    <header className="vs-auth-header">
      <a href="/" className="vs-auth-brand"><Building2 aria-hidden="true" />HostelMS</a>
      <span className="text-sm text-slate-500">Campus life, connected</span>
    </header>
    <main className="vs-auth-main">
      <section className="vs-auth-art" aria-label="Welcome to your campus">
        <div><p className="vs-eyebrow">YOUR CAMPUS. YOUR COMMUNITY.</p><h2>A vibrant campus.<br />A clearer day.</h2><p>A little more connected. A lot more at home. Everything you need for hostel life, in one place.</p></div>
        <img src={campusArtwork} alt="" aria-hidden="true" />
      </section>
      <section className="vs-auth-form">
        <p className="text-xs font-semibold tracking-widest text-indigo-600 mb-2">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </section>
    </main>
    <footer className="vs-auth-footer">Hostel Management System · Designed by Jithendra</footer>
  </div>
);

export default AuthShell;
