import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api, { API_ROOT_URL } from '../../api/axios';
import { Save } from 'lucide-react';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    room_no: user?.room_no || '',
    parent_contact: user?.parent_contact || '',
    course_year: user?.course_year || '',
    home_address: user?.home_address || '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      if (photoFile) data.append('profile_photo', photoFile);
      const res = await api.put('/students/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateUser(res.data);
      setPhotoFile(null);
      setPhotoPreview(null);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { name: 'name', label: 'Full Name', type: 'text' },
    { name: 'phone', label: 'Phone Number', type: 'tel' },
    { name: 'room_no', label: 'Room Number', type: 'text' },
    { name: 'parent_contact', label: 'Parent Contact', type: 'tel' },
    { name: 'course_year', label: 'Course / Year', type: 'text' },
  ];

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-slate-500 mt-1">Manage your personal information</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Avatar Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center text-center">
          <div className="relative mb-4">
            {photoPreview || user?.profile_photo ? (
              <img
                src={photoPreview || `${API_ROOT_URL}/${user?.profile_photo}`}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100"
              />
            ) : (
              <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center text-3xl font-bold text-indigo-600">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <h3 className="font-bold text-slate-800">{user?.name}</h3>
          <p className="text-slate-500 text-sm">{user?.email}</p>
          <span className="mt-2 px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-xs font-medium capitalize">
            {user?.role}
          </span>
          <div className="mt-4 text-left w-full space-y-2">
            <InfoRow label="Roll No." value={user?.roll_no} />
            <InfoRow label="Room" value={user?.room_no} />
            <InfoRow label="Course" value={user?.course_year} />
          </div>
          <label
            htmlFor="photo-upload"
            className="mt-5 w-full cursor-pointer text-center text-sm text-indigo-600 hover:text-indigo-500 border border-indigo-200 hover:border-indigo-400 rounded-xl py-2 transition"
          >
            Change Photo
          </label>
          <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-semibold text-slate-800 mb-5">Edit Information</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">{success}</div>
            )}
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm">{error}</div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              {fields.map(({ name, label, type }) => (
                <div key={name}>
                  <label htmlFor={`profile-${name}`} className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
                  <input
                    id={`profile-${name}`}
                    type={type}
                    value={form[name]}
                    onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label htmlFor="profile-home_address" className="block text-sm font-medium text-slate-600 mb-1.5">Home Address</label>
                <textarea
                  id="profile-home_address"
                  rows={2}
                  maxLength={300}
                  value={form.home_address}
                  onChange={(e) => setForm({ ...form, home_address: e.target.value })}
                  placeholder="House no., street, city, state, PIN"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                />
              </div>
              {/* Read-only fields */}
              <div>
                <label htmlFor="profile-email" className="block text-sm font-medium text-slate-600 mb-1.5">Email (read-only)</label>
                <input
                  id="profile-email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 text-slate-500"
                />
              </div>
              <div>
                <label htmlFor="profile-roll_no" className="block text-sm font-medium text-slate-600 mb-1.5">Roll No. (read-only)</label>
                <input
                  id="profile-roll_no"
                  type="text"
                  value={user?.roll_no || ''}
                  disabled
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 text-slate-500"
                />
              </div>
            </div>

            <button
              id="profile-save"
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 px-6 rounded-xl transition shadow-md shadow-indigo-200"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="text-slate-700 font-medium">{value || 'N/A'}</span>
  </div>
);

export default Profile;
