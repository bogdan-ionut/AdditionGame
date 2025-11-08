import mathGalaxyClient, {
  MathGalaxyApiError,
  isMathGalaxyConfigured,
  requireApiUrl,
} from './mathGalaxyClient';
import { joinApi, resolveApiBaseUrl, stripTrailingSlash } from '../lib/env';

const rawApiBase = (() => {
  const runtimeBase = resolveApiBaseUrl();
  if (runtimeBase) {
    return stripTrailingSlash(runtimeBase);
  }
  try {
    const base = requireApiUrl();
    return base ? stripTrailingSlash(base) : '';
  } catch (error) {
    return '';
  }
})();

export const AiEndpoints = {
  status: rawApiBase ? joinApi(rawApiBase, '/v1/ai/status') : '',
  saveKey: rawApiBase ? joinApi(rawApiBase, '/v1/ai/key') : '',
  plan: rawApiBase ? joinApi(rawApiBase, '/v1/ai/plan') : '',
  runtime: rawApiBase ? joinApi(rawApiBase, '/v1/ai/runtime') : '',
};

const RETRY_AFTER_DEFAULT_MS = 45000;
const OFFLINE_MESSAGE = 'API offline sau URL greșit. Deschide AI Settings pentru a verifica Cloud API Base URL.';

const toHeadersLookup = (headers) => ({
  get(name) {
    if (!headers) return null;
    const value = headers[name.toLowerCase()];
    return typeof value === 'string' ? value : null;
  },
});

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

const buildResult = ({ response, data, error }) => {
  if (!response) {
    const normalizedError =
      error instanceof Error ? error : error ? new Error(String(error)) : new Error(OFFLINE_MESSAGE);
    return {
      ok: false,
      status: 0,
      data: null,
      error: normalizedError,
      retryAfter: null,
    };
  }

  const normalizedError = response.ok
    ? null
    : error instanceof Error
      ? error
      : new Error(`HTTP ${response.status}`);

  return {
    ok: response.ok,
    status: response.status,
    data,
    error: normalizedError,
    retryAfter: parseRetryAfter(response, data) ?? null,
  };
};

const buildErrorResponse = (error) => ({
  ok: false,
  status: error?.status ?? 0,
  headers: toHeadersLookup(error?.headers ?? null),
});

const normalizeErrorData = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value;
};

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

const buildNotConfiguredResult = () => ({
  ok: false,
  status: 503,
  data: null,
  error: new Error(OFFLINE_MESSAGE),
  retryAfter: null,
});

export function getApiBase() {
  const override = resolveApiBaseUrl();
  if (override) {
    return stripTrailingSlash(override);
  }
  if (mathGalaxyClient?.baseUrl) {
    return stripTrailingSlash(mathGalaxyClient.baseUrl);
  }
  return rawApiBase || null;
}

const buildUrl = (path) => {
  const base = getApiBase();
  return base ? joinApi(base, path) : null;
};

export function isAiProxyConfigured() {
  return isMathGalaxyConfigured;
}

export function getGeminiKeyUrl() {
  return AiEndpoints.saveKey || buildUrl('/v1/ai/key');
}

export function getGeminiHealthUrl() {
  return AiEndpoints.status || buildUrl('/v1/ai/status');
}

export function getAiRuntimeUrl() {
  return AiEndpoints.runtime || buildUrl('/v1/ai/runtime');
}

export function getPlanningUrl() {
  return AiEndpoints.plan || buildUrl('/v1/ai/plan');
}

export function getInterestPacksUrl() {
  return buildUrl('/v1/interests/packs');
}

export function getSpriteJobStatusUrl(jobId) {
  const base = buildUrl('/v1/sprites/job_status');
  if (!base) return null;
  if (!jobId) return base;
  const encoded = encodeURIComponent(jobId);
  return `${base}?job_id=${encoded}`;
}

export function getSpriteProcessJobUrl() {
  const base = buildUrl('/v1/sprites/process_job');
  if (!base) return null;
  return base;
}

export async function postInterestsPacks({ interests = [], mode = 'sync', sync_ms = 6000, tick_limit = 1, model } = {}) {
  if (!isAiProxyConfigured()) {
    return buildNotConfiguredResult();
  }

  const payload = ensureInterestsPayload({ interests, mode, sync_ms, tick_limit, model });
  try {
    const { data, response } = await mathGalaxyClient.postSpriteInterests(payload);
    return buildResult({ response, data, error: null });
  } catch (error) {
    if (error instanceof MathGalaxyApiError) {
      const response = buildErrorResponse(error);
      const data = normalizeErrorData(error.data);
      return buildResult({ response, data, error });
    }
    return buildResult({ response: null, data: null, error });
  }
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

  if (!isAiProxyConfigured()) {
    return buildNotConfiguredResult();
  }

  try {
    const { data, response } = await mathGalaxyClient.getSpriteJob(jobId);
    return buildResult({ response, data, error: null });
  } catch (error) {
    if (error instanceof MathGalaxyApiError) {
      const response = buildErrorResponse(error);
      const data = normalizeErrorData(error.data);
      return buildResult({ response, data, error });
    }
    return buildResult({ response: null, data: null, error });
  }
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

  if (!isAiProxyConfigured()) {
    return buildNotConfiguredResult();
  }

  const payload = { limit };
  if (model) {
    payload.model = model;
  }

  try {
    const { data, response } = await mathGalaxyClient.postSpriteProcessJob(jobId, payload);
    const result = buildResult({ response, data, error: null });
    if (!result.retryAfter && !result.ok && result.status === 429) {
      result.retryAfter = RETRY_AFTER_DEFAULT_MS;
    }
    return result;
  } catch (error) {
    if (error instanceof MathGalaxyApiError) {
      const response = buildErrorResponse(error);
      const data = normalizeErrorData(error.data);
      const result = buildResult({ response, data, error });
      if (!result.retryAfter && result.status === 429) {
        result.retryAfter = RETRY_AFTER_DEFAULT_MS;
      }
      return result;
    }
    return buildResult({ response: null, data: null, error });
  }
}

export { RETRY_AFTER_DEFAULT_MS };
