import {
  getGeminiKeyUrl,
  getGeminiHealthUrl,
  getLegacyGeminiHealthUrl,
  getPlanningUrl,
  getInterestPacksUrl,
} from './aiEndpoints';

const handleErrorResponse = async (response, fallbackMessage) => {
  let detail = '';
  try {
    const data = await response.json();
    if (data?.error) {
      detail = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    }
  } catch (error) {
    // ignore json parse errors
  }
  const message = detail ? `${fallbackMessage}: ${detail}` : `${fallbackMessage} (HTTP ${response.status})`;
  throw new Error(message);
};

export async function saveGeminiKey(key) {
  const trimmed = key?.trim?.();
  if (!trimmed) {
    throw new Error('API key is required.');
  }

  const response = await fetch(getGeminiKeyUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: trimmed }),
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Unable to save Gemini key');
  }

  return response.json();
}

async function fetchHealth(url) {
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    await handleErrorResponse(response, 'Gemini health check failed');
  }
  return response.json();
}

export async function testGeminiKey() {
  try {
    return await fetchHealth(getGeminiHealthUrl());
  } catch (primaryError) {
    try {
      return await fetchHealth(getLegacyGeminiHealthUrl());
    } catch (legacyError) {
      throw primaryError instanceof Error ? primaryError : legacyError;
    }
  }
}

const stripCodeFence = (text = '') => {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return text.trim();
};

const tryParseJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};

const extractTextFragments = (payload) => {
  const fragments = [];

  if (!payload) return fragments;

  const visit = (value) => {
    if (!value) return;
    if (typeof value === 'string') {
      if (value.trim()) fragments.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      if (typeof value.text === 'string') {
        if (value.text.trim()) fragments.push(value.text);
      }
      if (value.parts) visit(value.parts);
      if (value.content) visit(value.content);
      if (value.contents) visit(value.contents);
      if (value.output) visit(value.output);
      if (value.candidates) visit(value.candidates);
      if (value.messages) visit(value.messages);
      if (value.values) visit(value.values);
    }
  };

  visit(payload);
  return fragments;
};

const normalizePlan = (data, model) => {
  if (!data) return null;

  const usedModel = data?._meta?.used_model || model || null;

  const coercePlan = (planCandidate) => {
    if (!planCandidate) return null;
    if (Array.isArray(planCandidate.items)) {
      return {
        ...planCandidate,
        planId: planCandidate.planId || planCandidate.plan_id || planCandidate.id || null,
        source: planCandidate.source || usedModel || planCandidate.model || null,
      };
    }
    return null;
  };

  const directPlan = coercePlan(data.plan || data);
  if (directPlan) return directPlan;

  const fragments = extractTextFragments(data);
  for (const fragment of fragments) {
    const parsed = tryParseJson(stripCodeFence(fragment));
    const normalized = coercePlan(parsed?.plan || parsed);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

export async function requestGeminiPlan(payload, model) {
  const body = { ...(payload || {}) };
  if (model) {
    body.model = model;
  }

  const response = await fetch(getPlanningUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Gemini planner request failed');
  }

  const data = await response.json();
  const normalized = normalizePlan(data, body.model);
  if (normalized) return normalized;
  return data;
}

export async function requestInterestMotifs(interests, model) {
  const body = { interests };
  if (model) {
    body.model = model;
  }

  const response = await fetch(getInterestPacksUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Gemini sprite batch request failed');
  }

  const data = await response.json();
  if (Array.isArray(data)) return data.map((entry) => String(entry));
  if (Array.isArray(data?.motifs)) return data.motifs.map((entry) => String(entry));
  if (Array.isArray(data?.packs)) {
    return data.packs
      .map((pack) => (typeof pack === 'string' ? pack : pack?.key || pack?.label))
      .filter(Boolean)
      .map((entry) => String(entry));
  }
  if (Array.isArray(data?.items)) {
    return data.items
      .map((item) => item?.motif || item?.label || item?.object || item?.interest)
      .filter(Boolean)
      .map((entry) => String(entry));
  }
  return [];
}

export async function getServerKeyStatus() {
  try {
    const health = await testGeminiKey();
    return Boolean(health?.have_key ?? health?.haveKey ?? health?.server_has_key);
  } catch (error) {
    console.warn('Unable to read Gemini key status', error);
    return false;
  }
}
