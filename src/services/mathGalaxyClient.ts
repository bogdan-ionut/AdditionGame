import { MathGalaxyAPI } from './math-galaxy-api';

const envValue = (import.meta?.env?.VITE_MATH_API_URL ?? '').trim();
const nodeEnv = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
const isDev = Boolean(import.meta?.env?.DEV ?? (nodeEnv && nodeEnv !== 'production'));

let resolvedBaseUrl = envValue;

if (!resolvedBaseUrl && isDev) {
  resolvedBaseUrl = 'http://localhost:8000';
}

if (!resolvedBaseUrl) {
  throw new Error(
    '[MathGalaxyAPI] Missing VITE_MATH_API_URL. Set this environment variable to the Math Galaxy API base URL.',
  );
}

const normalizedBaseUrl = resolvedBaseUrl.replace(/\/+$/, '');

const mathGalaxyApi = new MathGalaxyAPI({
  baseUrl: normalizedBaseUrl,
  defaultGame: 'addition-within-10',
});

export const isMathGalaxyConfigured = Boolean(mathGalaxyApi?.baseUrl);

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

export default mathGalaxyApi;
export { MathGalaxyApiError } from './math-galaxy-api';
