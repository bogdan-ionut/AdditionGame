import {
  MathGalaxyAPI,
  MathGalaxyApiError,
  type MathGalaxyJsonResult,
  BASE_URL,
  type MathGalaxyHealth,
  type SpritePrompt,
} from './math-galaxy-api';

const OFFLINE_MESSAGE = 'API offline sau URL greșit. Deschide AI Settings pentru a verifica Cloud API Base URL.';

const STORAGE_KEY = 'math.apiBase';
const LEGACY_KEYS = ['mg.baseUrl', 'math.api.baseUrl'];

const envValue = typeof BASE_URL === 'string' ? BASE_URL.trim() : '';
const nodeEnv = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
const isDev = Boolean(import.meta?.env?.DEV ?? (nodeEnv && nodeEnv !== 'production'));

let loggedBaseMessage: string | null = null;
let lastKnownHealth: MathGalaxyHealth = {
  ok: false,
  has_key: false,
  cors_ok: false,
  tts_ok: false,
  sprites_ok: false,
  lastCheckedAt: null,
};

const normalizeBase = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
};

const readStoredBase = (): string | null => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const direct = normalizeBase(window.localStorage.getItem(STORAGE_KEY));
    if (direct) {
      return direct;
    }
    for (const key of LEGACY_KEYS) {
      const legacy = normalizeBase(window.localStorage.getItem(key));
      if (legacy) {
        return legacy;
      }
    }
  } catch (error) {
    console.warn('[MathGalaxyAPI] Failed to read API base override from localStorage.', error);
  }
  return null;
};

const readEnvBase = (): string | null => {
  const envBase = normalizeBase((import.meta as any)?.env?.VITE_MATH_API_URL ?? envValue);
  return envBase ?? null;
};

const persistBase = (value: string | null) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    for (const key of LEGACY_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn('[MathGalaxyAPI] Failed to persist API base override.', error);
  }
};

const logResolvedBase = (base: string | null) => {
  const message = base ?? '(none)';
  if (loggedBaseMessage === message) {
    return;
  }
  loggedBaseMessage = message;
  console.info(`[MathGalaxyAPI] Using base: ${message}`);
};

const dispatchHealthUpdate = (health: MathGalaxyHealth) => {
  lastKnownHealth = health;
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  window.dispatchEvent(new CustomEvent('mg:health:updated', { detail: health }));
};

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('mg:health:updated', (event) => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (detail) {
      lastKnownHealth = detail as MathGalaxyHealth;
    }
  });
}

const parseBooleanish = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return null;
};

const detectGithubPagesHost = (): boolean => {
  if (typeof window === 'undefined' || typeof window.location?.hostname !== 'string') {
    return false;
  }
  const host = window.location.hostname.toLowerCase();
  return host.endsWith('.github.io');
};

type MathGalaxyStub = {
  baseUrl: null;
  health: MathGalaxyHealth;
  flushQueue: () => Promise<FlushQueueResult>;
  aiRuntime: (payload?: Record<string, unknown>) => Promise<never>;
  aiStatus: () => Promise<Record<string, any>>;
  aiPlan: (payload: Record<string, unknown>) => Promise<never>;
  aiTtsModels: () => Promise<never>;
  aiTtsVoices: (payload?: Record<string, unknown>) => Promise<never>;
  aiAudioSfx: (payload?: Record<string, unknown>) => Promise<never>;
  aiTtsSynthesize: (payload: Record<string, unknown>) => Promise<never>;
  generateSprites: (items: SpritePrompt[]) => Promise<never>;
  saveAiKey: (payload: Record<string, unknown>) => Promise<never>;
  postSpriteInterests: (
    payload: Record<string, unknown>,
    init?: RequestInit,
  ) => Promise<MathGalaxyJsonResult<null>>;
  getSpriteJob: (jobId: string) => Promise<MathGalaxyJsonResult<null>>;
  postSpriteProcessJob: (
    jobId: string,
    payload?: Record<string, unknown>,
  ) => Promise<MathGalaxyJsonResult<null>>;
  setBaseUrl: (url: string) => Promise<MathGalaxyHealth>;
  refreshHealth: () => Promise<MathGalaxyHealth>;
};

const createOfflineError = () => new MathGalaxyApiError(OFFLINE_MESSAGE, { status: 503 });

const createStubResponse = (status: number) =>
  new Response(JSON.stringify({ ok: false, error: OFFLINE_MESSAGE }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const OFFLINE_HEALTH: MathGalaxyHealth = {
  ok: false,
  has_key: false,
  cors_ok: false,
  tts_ok: false,
  sprites_ok: false,
  lastCheckedAt: null,
};

const createStubClient = (): MathGalaxyStub => ({
  baseUrl: null,
  health: OFFLINE_HEALTH,
  flushQueue: async () => ({ sent: 0, remaining: 0 }),
  aiRuntime: async () => {
    throw createOfflineError();
  },
  aiStatus: async () => {
    dispatchHealthUpdate(OFFLINE_HEALTH);
    return { ok: false, key_on_server: false };
  },
  aiPlan: async () => {
    throw createOfflineError();
  },
  aiTtsModels: async () => {
    throw createOfflineError();
  },
  aiTtsVoices: async () => {
    throw createOfflineError();
  },
  aiAudioSfx: async () => {
    throw createOfflineError();
  },
  aiTtsSynthesize: async () => {
    throw createOfflineError();
  },
  generateSprites: async () => {
    throw createOfflineError();
  },
  saveAiKey: async () => {
    throw createOfflineError();
  },
  postSpriteInterests: async () => ({ data: null, response: createStubResponse(503) }),
  getSpriteJob: async () => ({ data: null, response: createStubResponse(503) }),
  postSpriteProcessJob: async () => ({ data: null, response: createStubResponse(503) }),
  setBaseUrl: async () => {
    dispatchHealthUpdate(OFFLINE_HEALTH);
    return OFFLINE_HEALTH;
  },
  refreshHealth: async () => {
    dispatchHealthUpdate(OFFLINE_HEALTH);
    return OFFLINE_HEALTH;
  },
});

const runtimeBase = readStoredBase();
const envBase = readEnvBase();
let resolvedBaseUrl = runtimeBase || envBase || '';

logResolvedBase(resolvedBaseUrl || null);

const forcedLocal = parseBooleanish(import.meta?.env?.VITE_MATH_API_FORCE_LOCAL ?? null);
const hostPrefersStub = detectGithubPagesHost();
const shouldForceLocalStub = forcedLocal ?? (hostPrefersStub && !resolvedBaseUrl);

const useStubClient = shouldForceLocalStub || !resolvedBaseUrl;

let mathGalaxyApi: MathGalaxyAPI | MathGalaxyStub;
let mathGalaxyConfigured = false;

const isRealClient = (client: MathGalaxyAPI | MathGalaxyStub): client is MathGalaxyAPI =>
  client instanceof MathGalaxyAPI;

if (useStubClient) {
  if (!resolvedBaseUrl) {
    console.warn(
      '[MathGalaxyAPI] Cloud AI base URL not configured. Using local stub until settings are updated.',
    );
  } else if (shouldForceLocalStub) {
    console.info(
      '[MathGalaxyAPI] Using local stub client (remote AI disabled for this host).',
    );
  }
  mathGalaxyApi = createStubClient();
  mathGalaxyConfigured = false;
  dispatchHealthUpdate(OFFLINE_HEALTH);
} else {
  const normalizedBaseUrl = resolvedBaseUrl.replace(/\/+$/, '');
  try {
    const client = new MathGalaxyAPI({
      baseUrl: normalizedBaseUrl,
      defaultGame: 'addition-within-10',
    });
    mathGalaxyApi = client;
    mathGalaxyConfigured = Boolean(client.baseUrl);
  } catch (error) {
    console.error('[MathGalaxyAPI] Failed to initialize remote client. Falling back to stub.', error);
    mathGalaxyApi = createStubClient();
    mathGalaxyConfigured = false;
  }
}

export type FlushQueueResult = {
  sent: number;
  remaining?: number;
};

export function flushMathGalaxyQueue(): Promise<FlushQueueResult> {
  if (!mathGalaxyApi) {
    return Promise.resolve({ sent: 0, remaining: 0 });
  }
  return mathGalaxyApi.flushQueue();
}

export function getMathGalaxyHealth(): MathGalaxyHealth {
  if (isRealClient(mathGalaxyApi)) {
    lastKnownHealth = mathGalaxyApi.health;
    return mathGalaxyApi.health;
  }
  return lastKnownHealth;
}

export async function setMathGalaxyBaseUrl(url: string): Promise<MathGalaxyHealth> {
  const normalized = typeof url === 'string' ? url.trim().replace(/\/+$/, '') : '';
  const previousBase = resolvedBaseUrl;
  resolvedBaseUrl = normalized;

  persistBase(normalized || null);

  if (previousBase !== resolvedBaseUrl) {
    logResolvedBase(normalized || null);
  }

  if (!normalized) {
    mathGalaxyApi = createStubClient();
    mathGalaxyConfigured = false;
    dispatchHealthUpdate(OFFLINE_HEALTH);
    return OFFLINE_HEALTH;
  }

  if (isRealClient(mathGalaxyApi)) {
    mathGalaxyConfigured = true;
    const health = await mathGalaxyApi.setBaseUrl(normalized);
    return health;
  }

  try {
    const client = new MathGalaxyAPI({ baseUrl: normalized, defaultGame: 'addition-within-10' });
    mathGalaxyApi = client;
    mathGalaxyConfigured = Boolean(client.baseUrl);
    const health = await client.refreshHealth();
    return health;
  } catch (error) {
    console.error('[MathGalaxyAPI] Unable to configure base URL. Falling back to stub.', error);
    mathGalaxyApi = createStubClient();
    mathGalaxyConfigured = false;
    dispatchHealthUpdate(OFFLINE_HEALTH);
    throw error;
  }
}

export async function refreshMathGalaxyHealth(): Promise<MathGalaxyHealth> {
  if (!mathGalaxyApi) {
    dispatchHealthUpdate(OFFLINE_HEALTH);
    return OFFLINE_HEALTH;
  }
  const health = await mathGalaxyApi.refreshHealth();
  if (!isRealClient(mathGalaxyApi)) {
    return health;
  }
  return health;
}

export function isMathGalaxyConfigured(): boolean {
  if (!mathGalaxyConfigured) {
    return false;
  }
  const health = getMathGalaxyHealth();
  return Boolean(health.ok && health.has_key && health.cors_ok);
}

export function getConfiguredBaseUrl(): string | null {
  if (!resolvedBaseUrl) {
    return null;
  }
  return resolvedBaseUrl;
}

type AiStatusResult = Record<string, any> & { ok: boolean };

const normalizeStatus = (payload: unknown): AiStatusResult => {
  if (!payload || typeof payload !== 'object') {
    return { ok: false };
  }
  const data = { ...(payload as Record<string, any>) };
  if (typeof data.ok !== 'boolean') {
    data.ok = Boolean(data.ok);
  }
  if (data.key_on_server === undefined) {
    const keyValue =
      data.key_on_server ??
      data.keyOnServer ??
      data.has_key ??
      data.hasKey ??
      data.key_configured ??
      data.keyConfigured;
    if (keyValue !== undefined) {
      data.key_on_server = Boolean(keyValue);
    }
  }
  return data as AiStatusResult;
};

export async function aiStatus(): Promise<AiStatusResult> {
  if (!mathGalaxyApi) {
    dispatchHealthUpdate(OFFLINE_HEALTH);
    return { ok: false };
  }

  if (!isRealClient(mathGalaxyApi)) {
    const status = await mathGalaxyApi.aiStatus();
    return normalizeStatus(status);
  }

  try {
    const status = await mathGalaxyApi.aiStatus<Record<string, any>>();
    return normalizeStatus(status);
  } catch (error) {
    console.warn('[MathGalaxyAPI] Failed to fetch AI status.', error);
    return { ok: false };
  }
}

export default mathGalaxyApi;
export { MathGalaxyApiError, BASE_URL, requireApiUrl, request, type SpritePrompt } from './math-galaxy-api';
