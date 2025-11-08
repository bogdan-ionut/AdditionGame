import { MathGalaxyAPI, MathGalaxyApiError, type MathGalaxyJsonResult } from './math-galaxy-api';

const OFFLINE_MESSAGE = 'API offline sau URL greșit. Verifică VITE_MATH_API_URL.';

const envValue = (import.meta?.env?.VITE_MATH_API_URL ?? '').trim();
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
  flushQueue: () => Promise<FlushQueueResult>;
  aiRuntime: () => Promise<never>;
  aiStatus: () => Promise<never>;
  aiPlan: (payload: Record<string, unknown>) => Promise<never>;
  aiTtsModels: () => Promise<never>;
  aiTtsVoices: (payload?: Record<string, unknown>) => Promise<never>;
  aiAudioSfx: (payload?: Record<string, unknown>) => Promise<never>;
  aiTtsSynthesize: (payload: Record<string, unknown>) => Promise<never>;
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
};

const createOfflineError = () => new MathGalaxyApiError(OFFLINE_MESSAGE, { status: 503 });

const createStubResponse = (status: number) =>
  new Response(JSON.stringify({ ok: false, error: OFFLINE_MESSAGE }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const createStubClient = (): MathGalaxyStub => ({
  baseUrl: null,
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
  saveAiKey: async () => {
    throw createOfflineError();
  },
  postSpriteInterests: async () => ({ data: null, response: createStubResponse(503) }),
  getSpriteJob: async () => ({ data: null, response: createStubResponse(503) }),
  postSpriteProcessJob: async () => ({ data: null, response: createStubResponse(503) }),
});

let resolvedBaseUrl = envValue;

if (!resolvedBaseUrl && isDev) {
  resolvedBaseUrl = 'http://localhost:8000';
}

const forcedLocal = parseBooleanish(import.meta?.env?.VITE_MATH_API_FORCE_LOCAL ?? null);
const shouldForceLocalStub = forcedLocal ?? detectGithubPagesHost();

const useStubClient = shouldForceLocalStub || !resolvedBaseUrl;

let mathGalaxyApi: MathGalaxyAPI | MathGalaxyStub;
let mathGalaxyConfigured = false;

if (useStubClient) {
  if (!resolvedBaseUrl) {
    console.warn(
      '[MathGalaxyAPI] Missing VITE_MATH_API_URL. Using local stub – AI features will stay offline until configured.',
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
    mathGalaxyApi = new MathGalaxyAPI({
      baseUrl: normalizedBaseUrl,
      defaultGame: 'addition-within-10',
    });
    mathGalaxyConfigured = Boolean((mathGalaxyApi as MathGalaxyAPI)?.baseUrl);
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

export const isMathGalaxyConfigured = mathGalaxyConfigured;

export default mathGalaxyApi;
export { MathGalaxyApiError } from './math-galaxy-api';
