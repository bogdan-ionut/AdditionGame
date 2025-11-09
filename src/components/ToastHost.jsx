import { useEffect, useState } from 'react';
import { TOAST_DISMISS_EVENT, TOAST_EVENT } from '../lib/ui/toast';

const LEVEL_STYLES = {
  info: 'border-sky-200 bg-white text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
};

const LEVEL_ICON = {
  info: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <circle cx="12" cy="16" r=".5" fill="currentColor" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 8v4" />
      <circle cx="12" cy="16" r=".5" fill="currentColor" />
      <path d="M19 5l-14 14" />
    </svg>
  ),
};

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined') return () => {};

    const timers = new Map();

    const handleShow = (event) => {
      const detail = event?.detail;
      if (!detail || !detail.message) {
        return;
      }
      const toast = {
        id: detail.id,
        message: detail.message,
        level: detail.level || 'info',
        durationMs: detail.durationMs ?? 4000,
      };
      setToasts((current) => [...current.filter((item) => item.id !== toast.id), toast]);
      if (toast.durationMs > 0) {
        const timeout = window.setTimeout(() => {
          setToasts((current) => current.filter((item) => item.id !== toast.id));
          timers.delete(toast.id);
        }, toast.durationMs);
        timers.set(toast.id, timeout);
      }
    };

    const handleDismiss = (event) => {
      const id = event?.detail?.id;
      if (!id) return;
      const timeout = timers.get(id);
      if (timeout) {
        window.clearTimeout(timeout);
        timers.delete(id);
      }
      setToasts((current) => current.filter((item) => item.id !== id));
    };

    window.addEventListener(TOAST_EVENT, handleShow);
    window.addEventListener(TOAST_DISMISS_EVENT, handleDismiss);

    return () => {
      timers.forEach((timeout) => window.clearTimeout(timeout));
      window.removeEventListener(TOAST_EVENT, handleShow);
      window.removeEventListener(TOAST_DISMISS_EVENT, handleDismiss);
    };
  }, []);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[2000] flex flex-col items-center gap-3 px-4 sm:top-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg transition ${
            LEVEL_STYLES[toast.level] || LEVEL_STYLES.info
          }`}
        >
          <span className="mt-0.5 text-lg leading-none text-inherit">
            {LEVEL_ICON[toast.level] || LEVEL_ICON.info}
          </span>
          <div className="flex-1 text-sm font-medium text-inherit">{toast.message}</div>
        </div>
      ))}
    </div>
  );
}
