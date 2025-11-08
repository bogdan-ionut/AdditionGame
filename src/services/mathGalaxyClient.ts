import {
  MathGalaxyAPI,
  MathGalaxyApiError,
  type MathGalaxyJsonResult,
  BASE_URL,
  type MathGalaxyHealth,
  type SpritePrompt,
} from './math-galaxy-api';
import { resolveApiBaseUrl } from '../lib/api/baseUrl';

const OFFLINE_MESSAGE = 'API offline sau URL greșit. Deschide AI Settings pentru a verifica Cloud API Base URL.';

const envValue = typeof BASE_URL === 'string' ? BASE_URL.trim() : '';
const nodeEnv = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
const isDev = Boolean(import.meta?.env?.DEV ?? (nodeEnv && nodeEnv !== 'production'));

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
  aiStatus: () => Promise<never>;
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
    throw createOfflineError();
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
  setBaseUrl: async () => OFFLINE_HEALTH,
  refreshHealth: async () => OFFLINE_HEALTH,
});

const runtimeBase = resolveApiBaseUrl();
let resolvedBaseUrl = runtimeBase ? runtimeBase.trim() : envValue;

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
    return mathGalaxyApi.health;
  }
  return OFFLINE_HEALTH;
}

export async function setMathGalaxyBaseUrl(url: string): Promise<MathGalaxyHealth> {
  const normalized = typeof url === 'string' ? url.trim().replace(/\/+$/, '') : '';
  resolvedBaseUrl = normalized;

  if (!normalized) {
    mathGalaxyApi = createStubClient();
    mathGalaxyConfigured = false;
    return OFFLINE_HEALTH;
  }

  if (isRealClient(mathGalaxyApi)) {
    mathGalaxyConfigured = true;
    return mathGalaxyApi.setBaseUrl(normalized);
  }

  try {
    const client = new MathGalaxyAPI({ baseUrl: normalized, defaultGame: 'addition-within-10' });
    mathGalaxyApi = client;
    mathGalaxyConfigured = Boolean(client.baseUrl);
    return client.refreshHealth();
  } catch (error) {
    console.error('[MathGalaxyAPI] Unable to configure base URL. Falling back to stub.', error);
    mathGalaxyApi = createStubClient();
    mathGalaxyConfigured = false;
    throw error;
  }
}

export async function refreshMathGalaxyHealth(): Promise<MathGalaxyHealth> {
  if (isRealClient(mathGalaxyApi)) {
    return mathGalaxyApi.refreshHealth();
  }
  return OFFLINE_HEALTH;
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

export default mathGalaxyApi;
export { MathGalaxyApiError, BASE_URL, requireApiUrl, request, type SpritePrompt } from './math-galaxy-api';
