import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Megaphone, ImagePlus, X } from 'lucide-react';
import AnnouncementCard from '../../components/AnnouncementCard';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { confirmAction } from '../../components/ui/ConfirmDialog';

const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition';
const emptyForm = { title: '', message: '', priority: 'Normal', hostel_id: '', expires_at: '' };

// Shared by admins (any audience) and wardens (their own hostel only).
const AdminAnnouncements = () => {
  const { user } = useAuth();
  const isWarden = user?.role === 'warden';
  const [announcements, setAnnouncements] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const pickPhoto = (file) => {
    setError(null);
    if (!file) { setPhoto(null); setPhotoPreview(null); return; }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { setError('Photo must be a JPG, PNG, WebP or GIF image.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be 5 MB or smaller.'); return; }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching announcements');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    if (!isWarden) api.get('/admin/hostels').then((r) => setHostels(r.data)).catch(() => {});
  }, [fetchAnnouncements, isWarden]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // multipart so an optional photo can travel with the text
      const data = new FormData();
      data.append('title', form.title);
      data.append('message', form.message);
      data.append('priority', form.priority);
      if (form.hostel_id) data.append('hostel_id', form.hostel_id);
      if (form.expires_at) data.append('expires_at', new Date(form.expires_at).toISOString());
      if (photo) data.append('photo', photo);
      const res = await api.post('/announcements', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(emptyForm);
      pickPhoto(null);
      setNotice(`Posted and sent to ${res.data.notified} student(s).`);
      setTimeout(() => setNotice(''), 4000);
      fetchAnnouncements();
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating announcement');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmAction({ title: 'Delete this announcement?', message: 'Students will no longer see it. This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.delete(`/announcements/${id}`);
      fetchAnnouncements();
    } catch (err) {
      setError(err.response?.data?.message || 'Error deleting announcement');
    }
  };

  const canDelete = (a) => !isWarden || a.created_by === user?._id;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{isWarden ? 'Hostel Announcements' : 'Manage Announcements'}</h1>
        <p className="text-slate-500 mt-1">
          {isWarden ? 'Post notices to the students of your hostel' : 'Post notices to everyone or to one hostel'} — students are notified instantly
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 mb-4 text-sm">{error}</div>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 mb-4 text-sm">{notice}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
        <h3 className="font-semibold text-slate-800 mb-4">Create New Announcement</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="announcement-title" className="block text-sm font-medium text-slate-600 mb-1.5">Title</label>
            <input id="announcement-title" type="text" maxLength={120} className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="announcement-message" className="block text-sm font-medium text-slate-600 mb-1.5">Message</label>
            <textarea id="announcement-message" className={`${inputCls} resize-none`} rows="4" maxLength={3000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="announcement-priority" className="block text-sm font-medium text-slate-600 mb-1.5">Priority</label>
              <select id="announcement-priority" className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="Normal">Normal</option>
                <option value="Important">Important</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label htmlFor="announcement-audience" className="block text-sm font-medium text-slate-600 mb-1.5">Audience</label>
              {isWarden ? (
                <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">Your hostel's students</p>
              ) : (
                <select id="announcement-audience" className={inputCls} value={form.hostel_id} onChange={(e) => setForm({ ...form, hostel_id: e.target.value })}>
                  <option value="">All students</option>
                  {hostels.map((h) => <option key={h._id} value={h._id}>{h.name} only</option>)}
                </select>
              )}
            </div>
            <div>
              <label htmlFor="announcement-expiry" className="block text-sm font-medium text-slate-600 mb-1.5">Expires (optional)</label>
              <input id="announcement-expiry" type="datetime-local" className={inputCls} value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-600 mb-1.5">Photo (optional)</span>
            {photoPreview ? (
              <div className="relative inline-block">
                <img src={photoPreview} alt="Selected" className="h-32 rounded-xl border border-slate-200 object-cover" />
                <button type="button" onClick={() => pickPhoto(null)} className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-1 text-slate-500 hover:text-red-600 shadow" aria-label="Remove photo"><X size={14} /></button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-indigo-600 border border-dashed border-indigo-300 hover:bg-indigo-50 rounded-xl px-4 py-2.5">
                <ImagePlus size={16} /> Add a photo (JPG/PNG, max 5 MB)
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
              </label>
            )}
          </div>
          <button
            id="announcement-submit"
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 px-6 rounded-xl transition shadow-md shadow-indigo-200"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Megaphone size={16} />}
            {loading ? 'Posting...' : 'Post Announcement'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <h3 className="font-semibold text-slate-800 p-5 border-b border-slate-100">Previous Announcements</h3>
        {listLoading ? (
          <SkeletonRows rows={4} />
        ) : announcements.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements yet" message="Use the form above to post the first notice." />
        ) : (
          <div className="divide-y divide-slate-100">
            {announcements.map((ann) => (
              <div key={ann._id} className="p-5">
                <AnnouncementCard ann={ann} onDelete={canDelete(ann) ? () => handleDelete(ann._id) : undefined} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminAnnouncements;
