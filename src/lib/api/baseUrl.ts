const STORAGE_KEY = 'math.api.baseUrl';

const HTTPS_PATTERN = /^https:\/\//i;
const LOCALHOST_PATTERN = /^http:\/\/localhost(?::\d+)?(\/|$)/i;

let loggedBaseUrl: string | null = null;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalize(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return stripTrailingSlash(trimmed);
}

function readLocalStorage(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return normalize(value);
  } catch (error) {
    console.warn('[MathGalaxyAPI] Failed to read API base override from localStorage.', error);
    return null;
  }
}

function readEnv(): string | null {
  const env = (import.meta as any)?.env?.VITE_MATH_API_URL as string | undefined;
  return normalize(env);
}

function rememberLoggedBase(url: string) {
  if (loggedBaseUrl === url) {
    return;
  }
  loggedBaseUrl = url;
  console.info(`[MathGalaxyAPI] Using base: ${url}`);
}

export function resolveApiBaseUrl(): string | null {
  const override = readLocalStorage();
  if (override) {
    rememberLoggedBase(override);
    return override;
  }

  const env = readEnv();
  if (env) {
    rememberLoggedBase(env);
    return env;
  }

  return null;
}

export function clearApiBaseUrl() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[MathGalaxyAPI] Failed to clear API base override from localStorage.', error);
    throw error;
  }
}

export function setApiBaseUrl(url: string) {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Cannot configure API base URL outside the browser environment.');
  }

  const normalized = normalize(url);
  if (!normalized) {
    clearApiBaseUrl();
    window.location.reload();
    return;
  }

  if (!HTTPS_PATTERN.test(normalized) && !LOCALHOST_PATTERN.test(normalized)) {
    throw new Error('Cloud API base must start with https:// or http://localhost:.');
  }

  try {
    // Validate URL structure
    new URL(normalized);
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message
        ? error.message
        : 'Cloud API Base URL is invalid.',
    );
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  } catch (error) {
    console.warn('[MathGalaxyAPI] Failed to persist API base override to localStorage.', error);
    throw error;
  }

  window.location.reload();
}

export function getStoredApiBaseUrl(): string | null {
  return readLocalStorage();
}

