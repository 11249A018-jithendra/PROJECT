import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Same look as the app's existing pop-ups, and usable from the keyboard and
// with a screen reader: announced as a dialog with its title, focus moves to
// the first field when it opens, Tab stays inside, Escape closes it, and focus
// returns to the button that opened it.
const Modal = ({ title, onClose, children, size = 'max-w-md', className = '' }) => {
  const boxRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement;
    const box = boxRef.current;
    const items = () => [...box.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    // First field, else the first control after the close button, else the close button.
    const firstField = box.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
    (firstField || items().find((el) => !el.dataset.modalClose) || items()[0] || box).focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => onCloseRef.current()}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white rounded-2xl shadow-2xl w-full ${size} p-6 max-h-[90vh] overflow-y-auto focus:outline-none ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id={titleId} className="text-lg font-bold text-slate-800">{title}</h2>
          <button
            type="button"
            data-modal-close="true"
            onClick={() => onCloseRef.current()}
            className="-mr-2 p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default Modal;
