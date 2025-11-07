const DEFAULT_API_BASE = null;

const normalizeBase = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

let cachedApiBase;
let hasCachedBase = false;

export function getApiBase() {
  if (!hasCachedBase) {
    const envBase =
      normalizeBase(import.meta?.env?.VITE_MATH_AI_API_URL) ||
      normalizeBase(import.meta?.env?.VITE_AI_PROXY_URL);
    cachedApiBase = envBase || DEFAULT_API_BASE;
    hasCachedBase = true;
  }
  return cachedApiBase;
}

export function isAiProxyConfigured() {
  const base = getApiBase();
  return Boolean(base && typeof base === 'string');
}

export function getGeminiKeyUrl() {
  const base = getApiBase();
  return base ? `${base}/v1/ai/key` : null;
}

export function getGeminiHealthUrl() {
  const base = getApiBase();
  return base ? `${base}/v1/ai/status` : null;
}

export function getAiRuntimeUrl() {
  const base = getApiBase();
  return base ? `${base}/v1/ai/runtime` : null;
}

export function getPlanningUrl() {
  const base = getApiBase();
  return base ? `${base}/v1/ai/plan` : null;
}

export function getInterestPacksUrl() {
  const base = getApiBase();
  return base ? `${base}/v1/sprites/interests` : null;
}

export function getSpriteJobStatusUrl(jobId) {
  const base = getApiBase();
  if (!base) return null;
  const root = `${base}/v1/sprites/jobs`;
  if (!jobId) return root;
  const encoded = encodeURIComponent(jobId);
  return `${root}/${encoded}`;
}

export function getSpriteProcessJobUrl(jobId) {
  const base = getApiBase();
  if (!base || !jobId) return null;
  const encoded = encodeURIComponent(jobId);
  return `${base}/v1/sprites/jobs/${encoded}/process`;
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
  if (data && typeof data === 'object') {
    const retrySeconds =
      data.retry_after_ms != null
        ? Number.parseFloat(data.retry_after_ms) / 1000
        : data.retry_after != null
          ? Number.parseFloat(data.retry_after)
          : null;
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

const buildNotConfiguredResult = () => ({
  ok: false,
  status: 503,
  data: null,
  error: new Error('AI proxy endpoint is not configured.'),
  retryAfter: null,
});

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
  const url = getInterestPacksUrl();
  if (!url) {
    return buildNotConfiguredResult();
  }
  return requestJson(url, {
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
  const url = getSpriteJobStatusUrl(jobId);
  if (!url) {
    return buildNotConfiguredResult();
  }
  return requestJson(url, {
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
  const payload = { limit };
  if (model) {
    payload.model = model;
  }
  const processUrl = getSpriteProcessJobUrl(jobId);
  if (!processUrl) {
    return buildNotConfiguredResult();
  }
  const result = await requestJson(processUrl, {
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
