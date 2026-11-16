import { Clock, Flame } from 'lucide-react';
import StatusBadge from '../StatusBadge';
import { timeUntil } from '../../utils/format';

export const Avatar = ({ name, size = 'w-9 h-9' }) => (
  <div className={`${size} rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0`}>
    {name?.[0]?.toUpperCase() || '?'}
  </div>
);

// Escalated tag, or a countdown to auto-escalation for unanswered complaints.
export const EscalationTag = ({ complaint }) => {
  if (complaint.escalated && complaint.status !== 'Resolved') return <StatusBadge status="Escalated" />;
  const left = timeUntil(complaint.escalation_due_at);
  if (!left) return null;
  const urgent = new Date(complaint.escalation_due_at) - Date.now() < 6 * 3600 * 1000;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${urgent ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
      {urgent ? <Flame size={11} /> : <Clock size={11} />} Escalates in {left}
    </span>
  );
};
