const OVERRIDE_KEYS = ['ai.baseUrl', 'mg:apiBaseUrl'];

function readLocalStorage(keys: string[]): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  for (const key of keys) {
    try {
      const value = window.localStorage.getItem(key);
      if (value && value.trim()) {
        return value.trim();
      }
    } catch {
      // ignore storage errors
    }
  }
  return null;
}

function normalize(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string | null {
  const override = normalize(readLocalStorage(OVERRIDE_KEYS));
  if (override) {
    return override;
  }

  const envUrl = normalize((import.meta as any)?.env?.VITE_MATH_API_URL as string | undefined);
  if (envUrl) {
    return envUrl;
  }

  return null;
}

export function setApiBaseUrl(value: string | null) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const normalized = normalize(value);
  for (const key of OVERRIDE_KEYS) {
    try {
      if (normalized) {
        window.localStorage.setItem(key, normalized);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore storage persistence errors
    }
  }
}
