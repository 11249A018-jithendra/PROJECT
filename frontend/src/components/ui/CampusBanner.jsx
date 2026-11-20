import campusArtwork from '../../assets/campus-vector.svg';

const CampusBanner = ({ title, subtitle, eyebrow = 'HOSTELMS · YOUR CAMPUS WORKSPACE', action, children }) => (
  <section className="vs-hero">
    <div className="vs-hero-copy">
      <p className="vs-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {subtitle && <p className="vs-hero-subtitle">{subtitle}</p>}
      {children}
    </div>
    <img src={campusArtwork} className="vs-campus-art" alt="" aria-hidden="true" />
    {action && <div className="vs-hero-action">{action}</div>}
  </section>
);

export default CampusBanner;
