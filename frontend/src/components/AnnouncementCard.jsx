import { API_ROOT_URL } from '../api/axios';
import { Building2, Globe, Clock, Trash2 } from 'lucide-react';
import { formatDateTime } from '../utils/format';

// One announcement, shown the same way to admins, wardens and students.
// The poster keeps its own shape: at most 192 px tall and never wider than
// the card, never stretched or cropped. Click it to open the full image.
const AnnouncementCard = ({ ann, onDelete }) => (
  <div className={`flex justify-between items-start gap-4 ${ann.is_expired ? 'opacity-60' : ''}`}>
    <div className="min-w-0 flex-1">
      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 flex-wrap">
        {ann.priority && ann.priority !== 'Normal' && (
          <span className={`text-xs px-2 py-0.5 rounded text-white font-medium ${ann.priority === 'Urgent' ? 'bg-red-600' : 'bg-amber-700'}`}>{ann.priority}</span>
        )}
        <span className="break-words">{ann.title}</span>
        {ann.is_expired && <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-medium">Expired</span>}
      </h3>
      <p className="text-slate-600 mt-2 text-sm whitespace-pre-wrap break-words leading-relaxed">{ann.message}</p>
      {ann.photo && (
        <a href={`${API_ROOT_URL}/${ann.photo}`} target="_blank" rel="noreferrer" className="inline-block mt-3 max-w-full" title="Open full poster">
          <img
            src={`${API_ROOT_URL}/${ann.photo}`}
            alt={`Poster: ${ann.title}`}
            loading="lazy"
            className="block max-h-48 max-w-full w-auto h-auto rounded-xl border border-slate-200 object-contain bg-slate-50"
          />
        </a>
      )}
      <p className="text-xs text-slate-500 mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-1">
          {ann.hostel_name ? <Building2 size={12} /> : <Globe size={12} />}
          {ann.hostel_name || 'All students'}
        </span>
        <span>Posted {formatDateTime(ann.created_at)}{ann.author_name ? ` by ${ann.author_name}` : ''}</span>
        {ann.expires_at && (
          <span className="flex items-center gap-1">
            <Clock size={12} />{ann.is_expired ? 'Expired' : 'Expires'} {formatDateTime(ann.expires_at)}
          </span>
        )}
      </p>
    </div>
    {onDelete && (
      <button type="button" onClick={() => onDelete(ann)} className="text-slate-500 hover:text-red-500 flex-shrink-0 transition p-1 rounded-lg" aria-label={`Delete announcement ${ann.title}`}>
        <Trash2 size={18} />
      </button>
    )}
  </div>
);

export default AnnouncementCard;
