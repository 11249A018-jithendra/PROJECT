import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Phone, Mail, Siren, ShieldCheck, LifeBuoy } from 'lucide-react';
import api from '../../api/axios';
import { EmptyState, SkeletonCards } from '../../components/ui/Feedback';

const Help = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await api.get('/students/contacts');
        setContacts(res.data || []);
      } catch (err) {
        console.error('Failed to load contacts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, []);

  const getRoleConfig = (role) => {
    switch (role) {
      case 'warden':
        return {
          label: 'Hostel Warden',
          icon: ShieldCheck,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
          border: 'border-indigo-100',
        };
      case 'security':
        return {
          label: 'Security Desk',
          icon: Siren,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-100',
        };
      default:
        return {
          label: role,
          icon: LifeBuoy,
          color: 'text-slate-600',
          bg: 'bg-slate-50',
          border: 'border-slate-100',
        };
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Help & Emergency Contacts</h1>
        <p className="text-slate-500 mt-1">Official contact channels for hostel administration and security</p>
      </div>

      {loading ? (
        <SkeletonCards cards={2} />
      ) : contacts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <EmptyState icon={Phone} title="No contacts published yet" message="Please check back later or visit the hostel office." />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((contact, idx) => {
            const config = getRoleConfig(contact.role);
            const Icon = config.icon;
            return (
              <div key={idx} className={`bg-white rounded-2xl shadow-sm border ${config.border} p-6`}>
                <div className={`w-11 h-11 ${config.bg} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon size={22} className={config.color} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{config.label}</p>
                <p className="font-bold text-slate-800 mb-3">{contact.name}</p>
                {contact.phone ? (
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="flex items-center gap-2 min-h-6 text-sm text-slate-600 hover:text-indigo-600 transition mb-1.5">
                    <Phone size={14} /> {contact.phone}
                  </a>
                ) : (
                  <p className="text-sm text-slate-500 mb-1.5 italic">Phone not listed</p>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 min-h-6 text-sm text-slate-600 hover:text-indigo-600 transition">
                    <Mail size={14} /> {contact.email}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
        In a life-threatening emergency, contact local emergency services (112 in India) first, then notify the warden or security desk.
      </div>
    </Layout>
  );
};

export default Help;
