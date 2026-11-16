const StatusBadge = ({ status }) => {
  const styles = {
    Pending: 'bg-amber-100 text-amber-700 border border-amber-200',
    'In Progress': 'bg-blue-100 text-blue-700 border border-blue-200',
    Resolved: 'bg-green-100 text-green-700 border border-green-200',
    Approved: 'bg-green-100 text-green-700 border border-green-200',
    Rejected: 'bg-red-100 text-red-700 border border-red-200',
    'Checked Out': 'bg-orange-100 text-orange-700 border border-orange-200',
    Returned: 'bg-slate-100 text-slate-600 border border-slate-200',
    Overdue: 'bg-red-100 text-red-700 border border-red-200 animate-pulse',
    Escalated: 'bg-red-600 text-white border border-red-600',
    Cancelled: 'bg-slate-100 text-slate-500 border border-slate-200 line-through',
    // Daily attendance
    Present: 'bg-green-100 text-green-700 border border-green-200',
    Absent: 'bg-red-100 text-red-700 border border-red-200',
    'Not Marked': 'bg-slate-100 text-slate-500 border border-slate-200',
    // Real-time hostel presence (from gate QR scans)
    'Inside Hostel': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'Outside Hostel': 'bg-amber-50 text-amber-700 border border-amber-200',
    'Gone Home': 'bg-violet-50 text-violet-700 border border-violet-200',
    // Account status
    Active: 'bg-green-100 text-green-700 border border-green-200',
    Inactive: 'bg-slate-200 text-slate-600 border border-slate-300',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
