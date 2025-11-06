import { getGeminiKeyUrl, getGeminiHealthUrl, getPlanningUrl, getSpriteBatchUrl } from './aiEndpoints';

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
    body: JSON.stringify({ key: trimmed }),
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Unable to save Gemini key');
  }

  return response.json();
}

export async function testGeminiKey() {
  const response = await fetch(getGeminiHealthUrl(), {
    method: 'GET',
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Gemini health check failed');
  }

  return response.json();
}

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
  if (data?.plan?.items) return data.plan;
  return data;
}

export async function requestInterestMotifs(interests, model) {
  const body = { interests };
  if (model) {
    body.model = model;
  }

  const response = await fetch(getSpriteBatchUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Gemini sprite batch request failed');
  }

  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.motifs)) return data.motifs;
  return [];
}

export async function getServerKeyStatus() {
  try {
    const health = await testGeminiKey();
    return Boolean(health?.have_key);
  } catch (error) {
    console.warn('Unable to read Gemini key status', error);
    return false;
  }
}
