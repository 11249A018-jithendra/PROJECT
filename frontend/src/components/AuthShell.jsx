import { useState } from 'react';
import { Building2, Pause, Play, ShieldCheck, Sparkles } from 'lucide-react';
import CampusLandscape from './CampusLandscape';
import '../styles/campus-login.css';

const AuthShell = ({ title, subtitle, children, eyebrow = 'WELCOME TO HOSTELMS' }) => {
  const [paused, setPaused] = useState(false);
  return (
    <div className="vs-auth campus-auth" data-motion={paused ? 'paused' : 'playing'}>
      <CampusLandscape />
      <header className="vs-auth-header campus-auth-header">
        <a href="/" className="vs-auth-brand campus-auth-brand"><span className="campus-brand-mark"><Building2 aria-hidden="true" /></span><span>Hostel<span className="campus-brand-ms">MS</span><small>A LITTLE MORE AT HOME</small></span></a>
        <button type="button" className="campus-motion-toggle" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? 'Play campus animation' : 'Pause campus animation'}>{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}<span>{paused ? 'Play scene' : 'Pause scene'}</span></button>
      </header>
      <main className="campus-auth-main">
        <section className="vs-auth-art campus-auth-story" aria-label="Welcome to your campus">
          <div className="campus-story-copy">
            <p className="campus-story-eyebrow"><span aria-hidden="true" /><span>YOUR NEXT CHAPTER STARTS HERE</span></p>
            <h2>More than a stay.<br />A place to <em>belong.</em></h2>
            <p className="campus-story-description">The people. The late-night conversations.<br />The place you call home between dreams.</p>
            <div className="campus-story-signoff"><span className="campus-signoff-line" /><span>Hostel life, beautifully connected.</span></div>
          </div>
          <div className="campus-scene-label"><span className="campus-scene-label-icon"><Sparkles size={16} aria-hidden="true" /></span><span>GOOD DAYS START HERE<small>A little community. A world of possibilities.</small></span></div>
        </section>
        <section className="vs-auth-form campus-auth-card" aria-labelledby="campus-signin-title">
          <div className="campus-card-heading"><span className="campus-card-mark"><Building2 size={21} aria-hidden="true" /></span><span>{eyebrow}</span></div>
          <h1 id="campus-signin-title">{title}</h1>
          {subtitle && <p className="campus-card-subtitle">{subtitle}</p>}
          {children}
          <div className="campus-card-security"><ShieldCheck size={14} aria-hidden="true" /><span>Your space. Securely yours.</span></div>
        </section>
      </main>
      <footer className="campus-auth-footer"><span>© {new Date().getFullYear()} HostelMS. Made for campus life.</span><span>Designed by Jithendra<span className="campus-footer-flower" aria-hidden="true">✳</span></span></footer>
    </div>
  );
};

export default AuthShell;
