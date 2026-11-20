import { Link } from 'react-router-dom';

const StatCard = ({ label, value, icon: Icon, tone = 'lilac', to, loading = false, hint }) => {
  const content = (
    <>
      <div className="vs-stat-heading">
        <span>{label}</span>
        {Icon && <Icon size={20} aria-hidden="true" />}
      </div>
      <p className="vs-stat-value">{loading ? <span className="animate-pulse" aria-label="Loading">—</span> : (value ?? 0)}</p>
      {hint && <p className="vs-stat-hint">{hint}</p>}
    </>
  );
  const className = `vs-stat vs-stat-${tone}`;
  return to ? <Link to={to} className={className}>{content}</Link> : <div className={className}>{content}</div>;
};

export default StatCard;
