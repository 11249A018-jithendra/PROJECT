import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Siren, Phone, Car, Shield, UserCog, Ambulance, Stethoscope, Contact } from 'lucide-react';

const ICONS = { Warden: UserCog, Security: Shield, Driver: Car, Ambulance, Medical: Stethoscope, Other: Contact };

// Student dashboard: one-tap call buttons + SOS that alerts warden, security and admin.
const EmergencyHelpCard = ({ refreshKey = 0 }) => {
  const [contacts, setContacts] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  useEffect(() => {
    api.get('/emergency/contacts').then((r) => setContacts(r.data)).catch(() => {});
  }, [refreshKey]);

  const sendSos = async () => {
    setSending(true);
    try {
      const res = await api.post('/emergency/sos', { message });
      setResult({ ok: true, text: res.data.message });
      setConfirming(false);
      setMessage('');
    } catch (e) {
      setResult({ ok: e.response?.status === 429, text: e.response?.data?.message || 'Could not send SOS. Please call a number below.' });
      setConfirming(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Siren size={18} className="text-red-600" /> Emergency Help</h3>
        {!confirming && (
          <button onClick={() => { setConfirming(true); setResult(null); }} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-md shadow-red-200 transition">
            <Siren size={16} /> SOS
          </button>
        )}
      </div>

      {confirming && (
        <div className="p-5 bg-red-50 border-b border-red-100 space-y-3">
          <p className="text-sm text-red-800 font-medium">Send an SOS? Your warden, hostel security and the admin will be alerted immediately with your name and room.</p>
          <input
            value={message}
            maxLength={300}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's happening? (optional, e.g. 'feeling very sick')"
            aria-label="SOS message"
            className="w-full border border-red-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <div className="flex gap-3">
            <button onClick={() => setConfirming(false)} disabled={sending} className="flex-1 border border-slate-200 bg-white text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
            <button onClick={sendSos} disabled={sending} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition">{sending ? 'Sending...' : 'Send SOS now'}</button>
          </div>
        </div>
      )}

      {result && (
        <div className={`px-5 py-3 text-sm border-b ${result.ok ? 'bg-green-50 text-green-800 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{result.text}</div>
      )}

      {contacts.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No emergency numbers yet — ask your warden to add them.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 p-5">
          {contacts.map((c) => {
            const Icon = ICONS[c.category] || Contact;
            return (
              <a key={c._id} href={`tel:${c.phone.replace(/\s/g, '')}`} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-red-200 hover:bg-red-50/40 transition">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0"><Icon size={18} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 truncate">{c.category}{c.notes ? ` · ${c.notes}` : ''}</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 rounded-lg px-2 py-1 flex-shrink-0"><Phone size={12} /> Call</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmergencyHelpCard;
