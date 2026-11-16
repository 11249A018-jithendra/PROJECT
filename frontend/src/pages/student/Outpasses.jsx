import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';
import { saveQr, loadQr, pruneQrs } from '../../utils/offlineQr';
import Modal from '../../components/Modal';
import { FileText, Calendar, MapPin, Plus, QrCode, AlertTriangle, Copy, Check } from 'lucide-react';
import { istTimestamp, formatDateTime as fmt } from '../../utils/format';
import { EmptyState, SkeletonCards } from '../../components/ui/Feedback';
import { toast } from '../../components/ui/Toast';

const TABS = ['Pending', 'Approved', 'Checked Out', 'Returned', 'Rejected'];

const copyText = (text, onDone) =>
  navigator.clipboard
    .writeText(text)
    .then(() => { toast.success('Token copied.'); onDone?.(); })
    .catch(() => toast.error('Could not copy. Select the token and copy it by hand.'));

const isOverdue = (o) => o.status === 'Checked Out' && new Date(o.return_datetime).getTime() < Date.now();

const emptyForm = { reason: '', destination: '', leave_datetime: '', return_datetime: '', parent_consent: false, pass_type: 'Outing' };

const Outpasses = () => {
  const [outpasses, setOutpasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Pending');
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [qrOutpass, setQrOutpass] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  // gate_code cache: { [outpass._id]: string }
  const [gateCodes, setGateCodes] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const fetchOutpasses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/outpasses/my');
      setOutpasses(res.data);
      pruneQrs(res.data);
      // Pre-fetch gate codes for all approved/checked-out outpasses
      const active = (res.data || []).filter((o) => ['Approved', 'Checked Out'].includes(o.status));
      const codes = {};
      await Promise.all(
        active.map(async (o) => {
          try {
            // Try cached QR first (offline-safe)
            const cached = loadQr(o._id);
            if (cached?.gate_code) { codes[o._id] = cached.gate_code; return; }
            const qrRes = await api.get(`/outpasses/${o._id}/qr`);
            if (qrRes.data?.gate_code) {
              codes[o._id] = qrRes.data.gate_code;
              saveQr(o._id, qrRes.data);
            }
          } catch (_) { /* ignore offline errors */ }
        })
      );
      setGateCodes(codes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOutpasses(); }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.parent_consent) {
      setError('Parent consent is required to apply for an outpass.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/outpasses', form);
      setShowApply(false);
      setForm(emptyForm);
      setTab('Pending');
      fetchOutpasses();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit outpass request.');
    } finally {
      setSubmitting(false);
    }
  };

  const openQr = async (outpass) => {
    setQrOutpass(outpass);
    setQrError('');
    setQrLoading(true);
    try {
      const res = await api.get(`/outpasses/${outpass._id}/qr`);
      setQrOutpass({ ...outpass, qr: res.data });
      saveQr(outpass._id, res.data);
      // Also update the inline gate code cache
      if (res.data?.gate_code) {
        setGateCodes((prev) => ({ ...prev, [outpass._id]: res.data.gate_code }));
      }
    } catch (err) {
      // No connection at the gate: fall back to the copy saved on this phone.
      const saved = !err.response && loadQr(outpass._id);
      if (saved) setQrOutpass({ ...outpass, qr: saved, offline: true });
      else setQrError(err.response?.data?.message || 'Could not load QR code. Open it once while online to save it for offline use.');
    } finally {
      setQrLoading(false);
    }
  };

  const copyToken = (id, code) =>
    copyText(code, () => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });

  const filtered = outpasses.filter((o) => o.status === tab);
  const counts = TABS.reduce((acc, t) => ({ ...acc, [t]: outpasses.filter((o) => o.status === t).length }), {});

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Outpass Requests</h1>
          <p className="text-slate-500 mt-1">Apply for an outpass and track its status</p>
        </div>
        <button
          onClick={() => setShowApply(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-5 rounded-xl transition shadow-md shadow-indigo-200"
        >
          <Plus size={16} /> Apply New Outpass
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
            }`}
          >
            {t} {counts[t] > 0 && <span className="ml-1 opacity-75">({counts[t]})</span>}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <SkeletonCards cards={3} />
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <EmptyState
              icon={FileText}
              title={`No ${tab.toLowerCase()} outpasses`}
              message={tab === 'Pending' ? 'Requests you submit wait here until your warden reviews them.' : undefined}
              actionLabel={tab === 'Pending' ? 'Apply for an outpass' : undefined}
              onAction={() => setShowApply(true)}
            />
          </div>
        ) : (
          filtered.map((o) => (
            <div key={o._id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 mb-2">{o.reason}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5"><MapPin size={13} /> {o.destination}{o.pass_type === 'Home' ? ' · Home visit' : ''}</span>
                    <span className="flex items-center gap-1.5"><Calendar size={13} /> Exit: {fmt(o.leave_datetime)}</span>
                    <span className="flex items-center gap-1.5"><Calendar size={13} /> Return by: {fmt(o.return_datetime)}</span>
                    {o.issued_at && <span className="flex items-center gap-1.5 text-indigo-600">Issued: {istTimestamp(o.issued_at)}</span>}
                  </div>

                  {/* Inline manual token for Approved / Checked Out outpasses */}
                  {['Approved', 'Checked Out'].includes(o.status) && gateCodes[o._id] && (
                    <div className="mt-3 bg-slate-100/80 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Manual Token</p>
                        <p className="text-lg font-mono font-bold text-slate-800 tracking-[0.2em] select-all">{gateCodes[o._id]}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Give this to security if the QR won't scan</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToken(o._id, gateCodes[o._id])}
                        className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-600 font-medium rounded-lg border border-slate-200 shadow-sm transition"
                      >
                        {copiedId === o._id ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                        {copiedId === o._id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}

                  {o.status === 'Rejected' && o.rejection_reason && (
                    <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                      <span className="font-semibold">Reason: </span>{o.rejection_reason}
                    </p>
                  )}
                  {o.status === 'Checked Out' && (
                    <div className="mt-3 text-sm text-orange-700 bg-orange-50 border border-orange-100 rounded-xl p-3">
                      Currently Outside — left at {fmt(o.actual_exit_time)}
                    </div>
                  )}
                  {isOverdue(o) && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> Your outpass is overdue. Please contact the warden.
                    </p>
                  )}
                  {o.status === 'Returned' && (
                    <div className="mt-3 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3">
                      Returned at {fmt(o.actual_return_time)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <StatusBadge status={isOverdue(o) ? 'Overdue' : o.status} />
                  {['Approved', 'Checked Out'].includes(o.status) && (
                    <button
                      onClick={() => openQr(o)}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-500 border border-indigo-200 hover:border-indigo-400 rounded-lg px-2.5 py-1.5 transition"
                    >
                      <QrCode size={14} /> View QR
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Apply modal */}
      {showApply && (
        <Modal title="Apply for Outpass" onClose={() => setShowApply(false)}>
            {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 mb-4 text-sm">{error}</div>}
            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label htmlFor="outpass-reason" className="block text-sm font-medium text-slate-600 mb-1.5">Purpose / Reason</label>
                <textarea
                  id="outpass-reason"
                  required
                  rows={2}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div>
                <label htmlFor="outpass-type" className="block text-sm font-medium text-slate-600 mb-1.5">Outpass type</label>
                <select
                  id="outpass-type"
                  value={form.pass_type}
                  onChange={(e) => setForm({ ...form, pass_type: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Outing">Outing (local, same day)</option>
                  <option value="Home">Home visit</option>
                </select>
              </div>
              <div>
                <label htmlFor="outpass-destination" className="block text-sm font-medium text-slate-600 mb-1.5">Destination</label>
                <input
                  id="outpass-destination"
                  required
                  type="text"
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="outpass-leave" className="block text-sm font-medium text-slate-600 mb-1.5">Exit date & time</label>
                  <input
                    id="outpass-leave"
                    required
                    type="datetime-local"
                    value={form.leave_datetime}
                    onChange={(e) => setForm({ ...form, leave_datetime: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="outpass-return" className="block text-sm font-medium text-slate-600 mb-1.5">Expected return</label>
                  <input
                    id="outpass-return"
                    required
                    type="datetime-local"
                    value={form.return_datetime}
                    onChange={(e) => setForm({ ...form, return_datetime: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.parent_consent}
                  onChange={(e) => setForm({ ...form, parent_consent: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                I confirm my parent/guardian has consented to this outpass
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
        </Modal>
      )}

      {/* QR modal */}
      {qrOutpass && (
        <Modal title="Outpass QR Code" onClose={() => setQrOutpass(null)} size="max-w-sm" className="text-center">
            {qrLoading ? (
              <div className="py-6 flex flex-col items-center gap-4" role="status" aria-label="Loading QR code">
                <div className="w-[200px] h-[200px] rounded-xl bg-slate-100 animate-pulse" />
                <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
              </div>
            ) : qrError ? (
              <div role="alert" className="py-6 text-red-600 text-sm">{qrError}</div>
            ) : qrOutpass.qr ? (
              <>
                {qrOutpass.offline && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                    Offline — showing the copy saved on this phone ({fmt(qrOutpass.qr.saved_at)}).
                  </p>
                )}
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    qrOutpass.status === 'Checked Out'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-green-100 text-green-800 border border-green-200'
                  }`}>
                    {qrOutpass.status === 'Checked Out' ? '● Return Pass (Ready to Scan Inside)' : '● Exit Pass'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Valid for Return</span>
                </div>
                <div className="flex justify-center bg-slate-50 rounded-xl p-5 mb-4 border border-slate-100">
                  <QRCodeSVG value={qrOutpass.qr.qr_token} size={200} role="img" aria-label="Outpass QR code — show this to security at the gate" />
                </div>
                {/* The 8-character token security can type if the QR won't scan
                    (older saved copies only have the long QR token). */}
                <div className="mb-4 bg-slate-100/80 rounded-xl p-2.5 flex items-center justify-between text-left border border-slate-200">
                  <div className="overflow-hidden mr-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Outpass token</p>
                    {qrOutpass.qr.gate_code ? (
                      <p className="text-xl font-mono font-bold text-slate-800 tracking-[0.2em] select-all">{qrOutpass.qr.gate_code}</p>
                    ) : (
                      <p className="text-xs font-mono font-medium text-slate-800 truncate select-all">{qrOutpass.qr.qr_token}</p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-0.5">If the QR won't scan, read this to security.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(qrOutpass.qr.gate_code || qrOutpass.qr.qr_token)}
                    className="shrink-0 text-xs px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-600 font-medium rounded-lg border border-slate-200 shadow-xs transition"
                  >
                    Copy
                  </button>
                </div>
                <div className="text-left text-sm text-slate-600 space-y-1">
                  <p><span className="font-medium text-slate-800">{qrOutpass.qr.student_name}</span> · {qrOutpass.qr.student_roll_no}</p>
                  <p>Room {qrOutpass.qr.room_no}</p>
                  <p>Destination: {qrOutpass.qr.destination}</p>
                  <p>Return by: {fmt(qrOutpass.qr.return_datetime)}</p>
                </div>
                <p className="text-xs text-indigo-600 font-medium mt-4 bg-indigo-50 py-2 px-3 rounded-lg border border-indigo-100">
                  {qrOutpass.status === 'Checked Out'
                    ? 'Show this same QR to security when returning to campus!'
                    : 'Show this QR to security when leaving and returning.'}
                </p>
              </>
            ) : null}
        </Modal>
      )}
    </Layout>
  );
};

export default Outpasses;
