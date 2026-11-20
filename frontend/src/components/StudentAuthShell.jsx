import { useState } from 'react';
import { Building2, Pause, Play, ShieldCheck, KeyRound, Sparkles, BookOpen } from 'lucide-react';
import StudentRoomScene from './StudentRoomScene';
import '../styles/student-login.css';

const StudentAuthShell = ({ title, subtitle, children }) => {
  const [paused, setPaused] = useState(false);
  return (
    <div className="student-auth" data-motion={paused ? 'paused' : 'playing'} data-auth-theme="after-class">
      <header className="student-auth-header">
        <a href="/" className="student-auth-brand"><span><Building2 size={23} aria-hidden="true" /></span><div>HostelMS<small>YOUR STUDENT SPACE</small></div></a>
        <button type="button" className="student-scene-toggle" aria-label={paused ? 'Play student scene' : 'Pause student scene'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}<span>{paused ? 'Play the moment' : 'Pause the moment'}</span></button>
      </header>
      <main className="student-auth-main">
        <section className="student-auth-story" aria-label="Your life beyond the classroom">
          <p className="student-story-eyebrow"><Sparkles size={14} aria-hidden="true" />THE BEST YEARS HAVE A HOME.</p>
          <h2><span className="student-desktop-line">New faces.</span><span className="student-desktop-line">Late nights.</span><em>Good stories.</em></h2>
          <p className="student-story-description">A room to make your own.<br />A community to make it unforgettable.</p>
          <div className="student-room-frame"><StudentRoomScene /><span className="student-scene-caption">AFTER CLASS. BEFORE EVERYTHING.</span></div>
        </section>
        <section className="student-form-stage">
          <div className="student-card-tab"><KeyRound size={15} aria-hidden="true" /><span>YOUR KEY TO CAMPUS LIFE</span></div>
          <section className="vs-auth-form student-auth-card" aria-labelledby="student-signin-title">
            <div className="student-card-symbol"><BookOpen size={25} aria-hidden="true" /><Sparkles size={14} aria-hidden="true" /></div>
            <p className="student-card-eyebrow">RIGHT WHERE YOU BELONG</p>
            <h1 id="student-signin-title">{title}</h1>
            {subtitle && <p className="student-card-subtitle">{subtitle}</p>}
            {children}
            <div className="student-card-security"><ShieldCheck size={14} aria-hidden="true" />A private space for your campus life.</div>
          </section>
          <p className="student-below-card">Unpack your bags. We’ll handle the little things.</p>
        </section>
      </main>
      <footer className="student-auth-footer"><span>© {new Date().getFullYear()} HostelMS</span><span>A little room. A whole new world.</span><span>Designed by Jithendra</span></footer>
    </div>
  );
};

export default StudentAuthShell;
