import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import AnnouncementCard from '../../components/AnnouncementCard';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { Megaphone } from 'lucide-react';

// Same card layout and poster size as the admin/warden "Previous Announcements" list.
const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/announcements')
      .then((res) => setAnnouncements(res.data))
      .catch(() => setError('Could not load announcements. Check your connection and try again.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Hostel Announcements</h1>
        <p className="text-slate-500 mt-1">Notices and updates from the hostel administration</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={3} />
        ) : error ? (
          <p role="alert" className="p-10 text-center text-red-500 text-sm">{error}</p>
        ) : announcements.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements right now" message="New notices from the hostel office will appear here and under the bell icon." />
        ) : (
          <div className="divide-y divide-slate-100">
            {announcements.map((ann) => (
              <div key={ann._id} className="p-5">
                <AnnouncementCard ann={ann} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Announcements;
