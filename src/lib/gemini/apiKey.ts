const STORAGE_KEY = 'mg.gemini.apiKey';

let cachedKey: string | null | undefined = undefined;

const normalize = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const readFromStorage = (): string | null => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return normalize(stored);
  } catch (error) {
    console.warn('[Gemini] Unable to read API key from localStorage.', error);
    return null;
  }
};

const writeToStorage = (value: string | null) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn('[Gemini] Unable to persist API key to localStorage.', error);
    throw error;
  }
};

export function getGeminiApiKey(): string | null {
  const envKey = normalize((import.meta as any)?.env?.VITE_GEMINI_API_KEY ?? null);
  if (envKey) {
    cachedKey = envKey;
    return envKey;
  }
  if (cachedKey !== undefined) {
    return cachedKey;
  }
  cachedKey = readFromStorage();
  return cachedKey;
}

export function setGeminiApiKey(key: string | null): void {
  const normalized = normalize(key);
  writeToStorage(normalized);
  cachedKey = normalized;
}

export function clearGeminiApiKey(): void {
  writeToStorage(null);
  cachedKey = null;
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getGeminiApiKey());
}
