export type ToastLevel = 'info' | 'success' | 'error';

export type ToastPayload = {
  id?: string;
  message: string;
  level?: ToastLevel;
  durationMs?: number;
};

export const TOAST_EVENT = 'app:toast';
export const TOAST_DISMISS_EVENT = 'app:toast:dismiss';

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function showToast(payload: ToastPayload) {
  if (typeof window === 'undefined') return;
  const detail = {
    id: payload.id || createId(),
    message: payload.message,
    level: payload.level || 'info',
    durationMs: payload.durationMs ?? 4000,
  };
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
  return detail.id as string;
}

export function dismissToast(id: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOAST_DISMISS_EVENT, { detail: { id } }));
}
