const STORAGE_KEY = 'mathgalaxy.apiBase';

const DEFAULT_HEADERS: HeadersInit = {
  Accept: 'application/json',
};

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const readStoredApiBase = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) {
      return stripTrailingSlash(stored.trim());
    }
  } catch (error) {
    console.warn('[api] Unable to read mathgalaxy.apiBase from localStorage', error);
  }
  return null;
};

export const API_BASE = readStoredApiBase() || '';

export const requireApiBase = (): string => {
  const base = readStoredApiBase() || API_BASE;
  if (!base) {
    throw new Error('Math Galaxy API base URL is not configured. Open AI Settings.');
  }
  return base;
};

export class ApiError extends Error {
  status?: number;
  data?: unknown;

  constructor(message: string, options: { status?: number; data?: unknown } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.data = options.data;
  }
}

const buildUrl = (path: string) => {
  if (!path.startsWith('/')) {
    throw new Error(`API path must start with "/": ${path}`);
  }
  const base = requireApiBase();
  return `${base}${path}`;
};

async function parseJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  if (response.status === 204) {
    return null;
  }
  return null;
}

async function handleJsonResponse(response: Response) {
  const payload = await parseJsonResponse(response).catch((error) => {
    console.warn('[api] Failed to parse JSON response', error);
    return null;
  });

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, {
      status: response.status,
      data: payload ?? undefined,
    });
  }

  return payload;
}

async function execute(path: string, init: RequestInit = {}) {
  const url = buildUrl(path);
  const headers = new Headers(init.headers ?? {});
  for (const [key, value] of Object.entries(DEFAULT_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      mode: 'cors',
      credentials: 'omit',
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ApiError(message);
  }
}

export async function getJson(path: string, init: RequestInit = {}) {
  const response = await execute(path, { ...init, method: init.method ?? 'GET' });
  return handleJsonResponse(response);
}

export async function postJson(path: string, body: unknown, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await execute(path, {
    ...init,
    method: 'POST',
    headers,
    body: body == null ? null : JSON.stringify(body),
  });
  return handleJsonResponse(response);
}

export async function fetchRuntime() {
  try {
    return await getJson('/v1/ai/runtime');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return getJson('/v1/ai/status');
    }
    throw error;
  }
}

export const fetchVoices = async () => {
  try {
    return await getJson('/v1/ai/tts/voices');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 500)) {
      return [
        {
          id: 'local-default',
          label: 'Local Narrator',
          language: 'en-US',
        },
      ];
    }
    throw error;
  }
};

export const fetchSfx = () => getJson('/v1/ai/audio/sfx');

