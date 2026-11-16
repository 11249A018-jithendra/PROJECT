import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

// Small notices in the corner instead of browser alert() pop-ups.
//   import { toast } from '../components/ui/Toast';
//   toast.success('Token copied');   toast.error('Could not delete.');
// <Toaster /> is mounted once per portal (portals/PortalShell.jsx).

let listeners = [];
let nextId = 1;

const push = (type, message, ms = 4000) => {
  const item = { id: nextId++, type, message: String(message || '') };
  listeners.forEach((l) => l({ add: item, ms }));
  return item.id;
};

export const toast = {
  success: (message, ms) => push('success', message, ms),
  error: (message, ms) => push('error', message, ms ?? 6000),
  info: (message, ms) => push('info', message, ms),
};

const STYLES = {
  success: { icon: CheckCircle2, cls: 'border-green-200', iconCls: 'text-green-600' },
  error: { icon: XCircle, cls: 'border-red-200', iconCls: 'text-red-600' },
  info: { icon: Info, cls: 'border-indigo-200', iconCls: 'text-indigo-600' },
};

export const Toaster = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const listener = ({ add, ms }) => {
      setItems((prev) => [...prev.slice(-3), add]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== add.id)), ms);
    };
    listeners.push(listener);
    return () => { listeners = listeners.filter((l) => l !== listener); };
  }, []);

  return (
    <div className="fixed top-4 sm:top-20 right-4 left-4 sm:left-auto z-[70] flex flex-col items-end gap-2 pointer-events-none" aria-live="polite">
      {items.map(({ id, type, message }) => {
        const { icon: Icon, cls, iconCls } = STYLES[type];
        return (
          <div
            key={id}
            role={type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto w-full sm:w-96 bg-white border ${cls} rounded-xl shadow-lg px-4 py-3 flex items-start gap-3`}
          >
            <Icon size={18} className={`${iconCls} flex-shrink-0 mt-0.5`} />
            <p className="text-sm text-slate-700 flex-1">{message}</p>
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((i) => i.id !== id))}
              className="text-slate-500 hover:text-slate-600 transition flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
