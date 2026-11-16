import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

// In-app confirmation box instead of the browser's window.confirm().
//   if (!(await confirmAction({ title: 'Delete room?', message: '…', confirmLabel: 'Delete', danger: true }))) return;
// <ConfirmHost /> is mounted once per portal (portals/PortalShell.jsx).

let show = null;

export const confirmAction = ({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) =>
  new Promise((resolve) => {
    // Fallback if the host isn't mounted (should not happen).
    if (!show) return resolve(window.confirm(message || title));
    show({ title, message, confirmLabel, cancelLabel, danger, resolve });
  });

export const ConfirmHost = () => {
  const [dialog, setDialog] = useState(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    show = setDialog;
    return () => { show = null; };
  }, []);

  const close = (answer) => {
    dialog?.resolve(answer);
    setDialog(null);
  };

  useEffect(() => {
    if (!dialog) return undefined;
    confirmRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  if (!dialog) return null;
  const Icon = dialog.danger ? AlertTriangle : HelpCircle;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${dialog.danger ? 'bg-red-50' : 'bg-indigo-50'}`}>
            <Icon size={20} className={dialog.danger ? 'text-red-600' : 'text-indigo-600'} />
          </div>
          <div className="min-w-0">
            <h3 id="confirm-title" className="font-bold text-slate-800">{dialog.title}</h3>
            {dialog.message && <p id="confirm-message" className="text-sm text-slate-500 mt-1">{dialog.message}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition"
          >
            {dialog.cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => close(true)}
            className={`px-4 py-2.5 rounded-xl text-white text-sm font-medium transition ${dialog.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
