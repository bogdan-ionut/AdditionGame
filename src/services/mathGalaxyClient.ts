import { MathGalaxyAPI } from './math-galaxy-api';

const rawBaseUrl = (import.meta?.env?.VITE_MATH_API_URL ?? '').trim();

const mathGalaxyApi = rawBaseUrl
  ? new MathGalaxyAPI({
      baseUrl: rawBaseUrl,
      defaultGame: 'addition-within-10',
    })
  : null;

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
