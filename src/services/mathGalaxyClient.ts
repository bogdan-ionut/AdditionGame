import { MathGalaxyAPI } from './math-galaxy-api';

const mathGalaxyApi = new MathGalaxyAPI({
  baseUrl: import.meta?.env?.VITE_MATH_API_URL,
  defaultGame: 'addition-within-10',
});

export const isMathGalaxyConfigured = Boolean(mathGalaxyApi.baseUrl);

export type FlushQueueResult = {
  sent: number;
  remaining?: number;
};

export function flushMathGalaxyQueue(): Promise<FlushQueueResult> {
  if (!isMathGalaxyConfigured) {
    return Promise.resolve({ sent: 0, remaining: 0 });
  }
  return mathGalaxyApi.flushQueue();
}

export default mathGalaxyApi;
