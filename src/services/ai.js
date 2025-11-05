// src/services/ai.js
import { getAiRuntime } from '../lib/ai/runtime';
import { TARGET_SUCCESS_BAND } from '../lib/aiPersonalization';

const getApiBase = () => {
  let base = import.meta.env?.VITE_AI_PROXY_URL;
  if (typeof window !== 'undefined' && window.localStorage) {
    const override = window.localStorage.getItem('VITE_AI_PROXY_URL');
    if (override) base = override;
  }
  if (!base) return '/api';
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

export async function saveApiKey(apiKey) {
  const base = getApiBase();
  const response = await fetch(`${base}/gemini/svsm/entry/key/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }
  const result = await response.json().catch(() => ({ ok: true }));
  if (result?.ok === false) {
    throw new Error(result?.error || 'API key storage failed');
  }
  return { success: true, message: 'API key stored securely on server.' };
}

export async function requestPlan({ personalization }) {
  const runtime = await getAiRuntime();
  if (!runtime.aiEnabled || !runtime.planningModel) {
    throw new Error('AI features are not configured.');
  }

  const weakFamilies = Object.entries(personalization.mastery || {})
    .map(([key, node]) => ({
      key,
      sum: Number(key.replace('sum=', '')),
      predicted: node?.alpha ? node.alpha / (node.alpha + node.beta) : TARGET_SUCCESS_BAND.midpoint,
    }))
    .sort((a, b) => a.predicted - b.predicted)
    .slice(0, 3)
    .map((entry) => `sum=${entry.sum}`);

  const payload = {
    model: runtime.planningModel,
    plan_for: personalization.learnerProfile.learnerId,
    target_success: personalization.targetSuccess ?? TARGET_SUCCESS_BAND.midpoint,
    weak_families: weakFamilies,
    interest_themes: personalization.learnerProfile.interestThemes || [],
    need_items: 10,
    learner_name: personalization.learnerProfile.name || 'Learner',
  };

  const base = getApiBase();
  const response = await fetch(`${base}/gemini/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  let json = null;
  try {
    json = await response.json();
  } catch (error) {
    json = null;
  }

  if (response.status === 429) {
    const headerRetry = Number(response.headers.get('Retry-After') ?? '0');
    const bodyRetry = Number(json?.retry_in_seconds ?? 0);
    const retryInSeconds = Math.max(headerRetry || 0, bodyRetry || 0) || 45;
    return { ok: false, rateLimited: true, retryInSeconds, plan: json?.plan, meta: json?._meta };
  }

  if (!response.ok) {
    const error = new Error(`Planner responded with ${response.status}`);
    error.details = json;
    throw error;
  }

  return { ok: true, plan: json?.plan, meta: json?._meta };
}
