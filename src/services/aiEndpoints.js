const DEFAULT_API_BASE = 'https://ionutbogdan.ro/api';

export function getApiBase() {
  const base = import.meta?.env?.VITE_AI_PROXY_URL;
  if (!base) return DEFAULT_API_BASE;
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export function getGeminiKeyUrl() {
  return `${getApiBase()}/ai/key`;
}

export function getGeminiHealthUrl() {
  return `${getApiBase()}/ai/status`;
}

export function getLegacyGeminiHealthUrl() {
  return `${getApiBase()}/health/gemini_post.php`;
}

export function getPlanningUrl() {
  return `${getApiBase()}/gemini/plan`;
}

export function getInterestPacksUrl() {
  return `${getApiBase()}/interests/packs`;
}

export function getSpriteJobStatusUrl(jobId) {
  const base = `${getApiBase()}/sprites/job_status`;
  if (!jobId) return base;
  const encoded = encodeURIComponent(jobId);
  return `${base}?job_id=${encoded}`;
}

export function getSpriteProcessJobUrl() {
  return `${getApiBase()}/sprites/process_job`;
}

const RETRY_AFTER_DEFAULT_MS = 45000;

const parseRetryAfter = (response, data) => {
  if (!response) return null;
  const header = response.headers?.get?.('Retry-After');
  if (header) {
    const numeric = Number.parseInt(header, 10);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric * 1000;
    }
  }
  if (data && typeof data === 'object' && data.retry_after != null) {
    const retrySeconds = Number.parseFloat(data.retry_after);
    if (Number.isFinite(retrySeconds) && retrySeconds > 0) {
      return retrySeconds * 1000;
    }
  }
  return null;
};

const readJson = async (response) => {
  if (!response) return { data: null };
  const text = await response.text();
  if (!text) return { data: null };
  try {
    return { data: JSON.parse(text) };
  } catch (error) {
    return { data: null };
  }
};

const buildResult = ({ response, data, error }) => {
  if (!response) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error : error ? new Error(String(error)) : null,
      retryAfter: null,
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? null : new Error(`HTTP ${response.status}`),
    retryAfter: parseRetryAfter(response, data) ?? null,
  };
};

async function requestJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const { data } = await readJson(response);
    return buildResult({ response, data, error: null });
  } catch (error) {
    return buildResult({ response: null, data: null, error });
  }
}

const ensureInterestsPayload = ({ interests = [], mode = 'sync', sync_ms = 6000, tick_limit = 1, model }) => {
  const payload = {
    interests: Array.isArray(interests) ? interests : [],
    mode,
    sync_ms,
    tick_limit,
  };
  if (model) {
    payload.model = model;
  }
  return payload;
};

export async function postInterestsPacks({
  interests = [],
  mode = 'sync',
  sync_ms = 6000,
  tick_limit = 1,
  model,
} = {}) {
  const payload = ensureInterestsPayload({ interests, mode, sync_ms, tick_limit, model });
  return requestJson(getInterestPacksUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getSpriteJobStatus(jobId) {
  if (!jobId) {
    return {
      ok: false,
      status: 400,
      data: null,
      error: new Error('job_id is required'),
      retryAfter: null,
    };
  }
  return requestJson(getSpriteJobStatusUrl(jobId), {
    method: 'GET',
  });
}

export async function postProcessJob({ jobId, limit = 1, model } = {}) {
  if (!jobId) {
    return {
      ok: false,
      status: 400,
      data: null,
      error: new Error('job_id is required'),
      retryAfter: null,
    };
  }
  const payload = { job_id: jobId, limit };
  if (model) {
    payload.model = model;
  }
  const result = await requestJson(getSpriteProcessJobUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!result.retryAfter && !result.ok && result.status === 429) {
    result.retryAfter = RETRY_AFTER_DEFAULT_MS;
  }
  return result;
}

export { RETRY_AFTER_DEFAULT_MS };
