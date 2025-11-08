import {
  postInterestsPacks,
  getSpriteJobStatus,
  postProcessJob,
  isAiProxyConfigured,
} from './aiEndpoints';
import mathGalaxyClient, { MathGalaxyApiError } from './mathGalaxyClient';
import { deriveMotifsFromInterests } from '../lib/aiPersonalization';

const OFFLINE_MESSAGE = 'API offline sau URL greșit. Deschide AI Settings pentru a verifica Cloud API Base URL.';

const readBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      if (value === 1) return true;
      if (value === 0) return false;
    }
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['true', '1', 'yes', 'y', 'ok', 'success', 'verified'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'fail', 'failed', 'error'].includes(normalized)) return false;
  }
  return null;
};

const readBooleanFrom = (source, keys) => {
  if (!source || typeof source !== 'object') return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const candidate = readBoolean(source[key]);
      if (candidate !== null) {
        return candidate;
      }
    }
  }
  return null;
};

const readStringFrom = (source, keys) => {
  if (!source || typeof source !== 'object') return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
    }
  }
  return null;
};

export async function saveGeminiKey(key, model) {
  const trimmed = key?.trim?.();
  if (!trimmed) {
    throw new Error('API key is required.');
  }

  if (!isAiProxyConfigured()) {
    throw new MathGalaxyApiError(OFFLINE_MESSAGE);
  }

  const normalizedModel = typeof model === 'string' ? model.trim() : '';
  const payload = {
    key: trimmed,
    apiKey: trimmed,
    api_key: trimmed,
  };
  if (normalizedModel) {
    payload.model = normalizedModel;
    payload.planner = normalizedModel;
  }

  try {
    const response = await mathGalaxyClient.saveAiKey(payload);
    const data = response && typeof response === 'object' ? response : {};
    const verified =
      readBooleanFrom(data, ['verified', 'isVerified', 'is_verified']) ??
      readBooleanFrom(data, ['have_key', 'haveKey', 'server_has_key', 'serverHasKey', 'key_present', 'keyPresent']) ??
      readBooleanFrom(data, ['ok', 'success', 'status']);

    const note =
      readStringFrom(data, ['note', 'warning', 'warn', 'warningMessage', 'warning_message']) ?? null;
    const successMessage =
      readStringFrom(data, ['message', 'statusText', 'status_text']) ||
      (verified ? 'API key saved securely.' : null);
    const errorMessage =
      readStringFrom(data, ['error', 'reason', 'detail', 'details']) ?? (verified ? null : successMessage);

    const normalizedResult = {
      ...data,
      verified: Boolean(verified),
      serverHasKey:
        readBooleanFrom(data, ['server_has_key', 'serverHasKey', 'have_key', 'haveKey']) ?? Boolean(verified),
      note: note ?? null,
      message: successMessage ?? null,
    };

    if (normalizedResult.verified) {
      if (normalizedResult.error && typeof normalizedResult.error === 'string') {
        normalizedResult.error = null;
      }
      if (!Object.prototype.hasOwnProperty.call(normalizedResult, 'note')) {
        normalizedResult.note = note ?? null;
      }
      return normalizedResult;
    }

    const failureMessage = errorMessage || 'Gemini key verification failed.';
    const failurePayload = {
      ...normalizedResult,
      verified: false,
      error: failureMessage,
    };
    throw new MathGalaxyApiError(failureMessage, { data: failurePayload });
  } catch (error) {
    if (error instanceof MathGalaxyApiError) {
      throw error;
    }
    throw new MathGalaxyApiError(error instanceof Error ? error.message : OFFLINE_MESSAGE, { cause: error });
  }
}

export async function testGeminiKey() {
  if (!isAiProxyConfigured()) {
    throw new MathGalaxyApiError(OFFLINE_MESSAGE);
  }

  try {
    const response = await mathGalaxyClient.aiStatus();
    const data = response && typeof response === 'object' ? response : {};
    const serverHasKey =
      readBooleanFrom(data, [
        'server_has_key',
        'serverHasKey',
        'have_key',
        'haveKey',
        'key_present',
        'keyPresent',
        'verified',
      ]) ?? false;
    const note =
      readStringFrom(data, ['note', 'warning', 'warn', 'warningMessage', 'warning_message']) ?? null;
    const model =
      readStringFrom(data, ['model', 'planning_model', 'planningModel']) ||
      readStringFrom(data?.models, ['planner', 'planning', 'primary', 'name']) ||
      null;
    const ok = readBooleanFrom(data, ['ok', 'success', 'status']) ?? serverHasKey;
    const message =
      readStringFrom(data, ['message', 'statusText', 'status_text']) ||
      (serverHasKey ? 'Gemini key detected on server.' : 'Gemini key missing on server.');

    return {
      ...data,
      ok,
      serverHasKey,
      note,
      model,
      message,
    };
  } catch (error) {
    if (error instanceof MathGalaxyApiError) {
      throw error;
    }
    throw new MathGalaxyApiError(error instanceof Error ? error.message : OFFLINE_MESSAGE, { cause: error });
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

const normalizePlan = (data, plannerModel) => {
  if (!data) return null;

  const plannerFromResponse =
    readStringFrom(data, ['model', 'planner', 'planning_model', 'planningModel']) ||
    readStringFrom(data?.models, ['planner', 'planning', 'primary', 'name']) ||
    readStringFrom((data?.plan || data)?.models, ['planner', 'planning', 'primary', 'name']);

  const usedModel =
    data?._meta?.used_model ||
    data?.used_model ||
    plannerFromResponse ||
    plannerModel ||
    null;

  const extractNarrativeText = (source) => {
    if (!source || typeof source !== 'object') return null;
    const direct =
      readStringFrom(source, ['microStory', 'micro_story', 'story', 'narrative', 'summary']) ||
      null;
    if (direct) return direct;
    if (Array.isArray(source.narratives)) {
      for (const entry of source.narratives) {
        if (!entry) continue;
        if (typeof entry === 'string' && entry.trim()) {
          return entry.trim();
        }
        if (typeof entry === 'object') {
          const candidate =
            readStringFrom(entry, ['text', 'story', 'summary', 'content']) ||
            extractTextFragments(entry)[0] ||
            null;
          if (candidate) return candidate;
        }
      }
    }
    return null;
  };

  const flattenLessonProblems = (lessons = []) => {
    if (!Array.isArray(lessons)) return [];
    const flattened = [];
    lessons.forEach((lesson, lessonIndex) => {
      if (!lesson || typeof lesson !== 'object') return;
      const problems = Array.isArray(lesson.problems) && lesson.problems.length
        ? lesson.problems
        : Array.isArray(lesson.items)
          ? lesson.items
          : [];
      problems.forEach((problem, problemIndex) => {
        if (!problem || typeof problem !== 'object') return;
        flattened.push({
          ...problem,
          lessonIndex,
          lessonId: lesson.id ?? lesson.slug ?? lesson.key ?? `lesson-${lessonIndex}`,
          lessonTitle: lesson.title ?? lesson.name ?? lesson.label ?? null,
          _lessonOrder: problemIndex,
        });
      });
    });
    return flattened;
  };

  const coercePlan = (planCandidate) => {
    if (!planCandidate) return null;
    const items = Array.isArray(planCandidate.items)
      ? planCandidate.items
      : Array.isArray(planCandidate.queue)
        ? planCandidate.queue
        : null;
    if (items && items.length) {
      const metadata =
        planCandidate.metadata ||
        planCandidate.meta ||
        planCandidate._meta ||
        data?._meta ||
        null;
      return {
        ...planCandidate,
        items,
        planId:
          planCandidate.planId ||
          planCandidate.plan_id ||
          planCandidate.id ||
          data?.plan_id ||
          data?.id ||
          null,
        source: planCandidate.source || usedModel || planCandidate.model || null,
        microStory:
          planCandidate.microStory ||
          planCandidate.story ||
          planCandidate.micro_story ||
          data?.micro_story ||
          data?.story ||
          extractNarrativeText(planCandidate) ||
          extractNarrativeText(data) ||
          '',
        metadata,
      };
    }
    return null;
  };

  const prepareCandidate = (source) => {
    if (!source || typeof source !== 'object') return null;
    const candidate = { ...source };
    if (!candidate.metadata && candidate.meta) {
      candidate.metadata = candidate.meta;
    }
    if (!candidate.metadata && Array.isArray(source.lessons)) {
      candidate.metadata = { lessons: source.lessons };
    }
    if (!candidate.items && Array.isArray(source.lessons)) {
      const flattened = flattenLessonProblems(source.lessons);
      if (flattened.length) {
        candidate.items = flattened;
      }
    }
    if (!candidate.source && candidate.models && typeof candidate.models === 'object') {
      const planner = readStringFrom(candidate.models, ['planner', 'planning', 'primary', 'model']);
      if (planner) {
        candidate.source = planner;
      }
    }
    const narrative = extractNarrativeText(candidate);
    if (narrative && !candidate.microStory) {
      candidate.microStory = narrative;
    }
    return candidate;
  };

  const directPlan = coercePlan(prepareCandidate(data.plan || data) || data.plan || data);
  if (directPlan) return directPlan;

  if (Array.isArray(data.queue) && data.queue.length) {
    const queuePlan = coercePlan(prepareCandidate({ ...data, items: data.queue }));
    if (queuePlan) return queuePlan;
  }

  const fragments = extractTextFragments(data);
  for (const fragment of fragments) {
    const parsed = tryParseJson(stripCodeFence(fragment));
    const normalized = coercePlan(prepareCandidate(parsed?.plan || parsed));
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

export async function requestGeminiPlan(payload, options = {}) {
  const body = { ...(payload || {}) };
  const normalizedOptions =
    typeof options === 'string' ? { plannerModel: options } : { ...(options || {}) };

  const { plannerModel, spriteModel, audioModel } = normalizedOptions;

  if (plannerModel && !body.model) {
    body.model = plannerModel;
  }
  if (plannerModel || spriteModel || audioModel) {
    const models = { ...(body.models || {}) };
    if (plannerModel) models.planner = plannerModel;
    if (spriteModel) models.sprite = spriteModel;
    if (audioModel) models.tts = audioModel;
    body.models = models;
  }

  if (!isAiProxyConfigured()) {
    throw new MathGalaxyApiError(OFFLINE_MESSAGE);
  }

  try {
    const data = await mathGalaxyClient.aiPlan(body);
    const normalized = normalizePlan(data, plannerModel || body.model);
    if (normalized) return normalized;
    return data;
  } catch (error) {
    if (error instanceof MathGalaxyApiError) {
      throw error;
    }
    throw new MathGalaxyApiError(error instanceof Error ? error.message : OFFLINE_MESSAGE, { cause: error });
  }
}

const extractFirstFragment = (payload) => {
  if (!payload) return null;
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }
  const fragments = extractTextFragments(payload);
  return fragments.length ? fragments[0] : null;
};

export async function requestRuntimeContent(payload = {}) {
  if (!isAiProxyConfigured()) {
    throw new MathGalaxyApiError(OFFLINE_MESSAGE);
  }

  try {
    const data = await mathGalaxyClient.aiRuntime(payload);
    const text =
      extractFirstFragment(data?.choices) ||
      extractFirstFragment(data?.choice) ||
      extractFirstFragment(data?.result) ||
      extractFirstFragment(data?.output) ||
      extractFirstFragment(data?.message) ||
      extractFirstFragment(data);
    return { text, raw: data };
  } catch (error) {
    if (error instanceof MathGalaxyApiError) {
      throw error;
    }
    throw new MathGalaxyApiError(error instanceof Error ? error.message : OFFLINE_MESSAGE, { cause: error });
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeInterests = (interests = []) => {
  if (!Array.isArray(interests)) return [];
  const seen = new Set();
  return interests
    .map((interest) => (typeof interest === 'string' ? interest.trim() : ''))
    .filter(Boolean)
    .filter((interest) => {
      const lower = interest.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
};

const resolveSpriteStatus = (item) => {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.status === 'string') return item.status;
  if (typeof item.state === 'string') return item.state;
  if (item.done === true) return 'done';
  if (item.pending === true) return 'pending';
  return null;
};

const resolveSpriteUrl = (item) => {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.url === 'string') return item.url;
  if (typeof item.sprite_url === 'string') return item.sprite_url;
  if (typeof item.href === 'string') return item.href;
  if (Array.isArray(item.urls) && item.urls.length) {
    const found = item.urls.find((value) => typeof value === 'string' && value.trim());
    if (found) return found;
  }
  if (item.asset && typeof item.asset === 'string') return item.asset;
  return null;
};

const sanitizeSpriteItems = (items = []) => {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      interest: typeof item.interest === 'string' ? item.interest : null,
      status: resolveSpriteStatus(item),
      url: resolveSpriteUrl(item),
    }));
};

const parseSpriteJobStatus = (payload = {}) => {
  const job = payload && typeof payload.job === 'object' ? payload.job : null;
  const rawItems = Array.isArray(payload.items) && payload.items.length
    ? payload.items
    : Array.isArray(job?.items)
      ? job.items
      : Array.isArray(payload.job_items)
        ? payload.job_items
        : [];
  const items = sanitizeSpriteItems(rawItems);
  const doneCandidate =
    payload.done ??
    payload.completed ??
    job?.done ??
    job?.completed ??
    job?.stats?.done ??
    job?.stats?.completed;
  const pendingCandidate =
    payload.pending ??
    job?.pending ??
    job?.stats?.pending ??
    job?.remaining;
  const done = Number.isFinite(doneCandidate)
    ? Number(doneCandidate)
    : items.filter((item) => item.status === 'done').length;
  const pending = Number.isFinite(pendingCandidate)
    ? Number(pendingCandidate)
    : Math.max(0, items.length - (Number.isFinite(done) ? done : 0));
  const jobId = typeof payload.job_id === 'string'
    ? payload.job_id
    : typeof payload.jobId === 'string'
      ? payload.jobId
      : typeof job?.id === 'string'
        ? job.id
        : null;
  const status = typeof job?.status === 'string' ? job.status : payload.status || null;
  return {
    jobId,
    done: Number.isFinite(done) ? done : 0,
    pending: Number.isFinite(pending) ? pending : 0,
    items,
    status,
  };
};

const collectSpriteUrls = (items = []) => {
  return sanitizeSpriteItems(items)
    .filter((item) => item.status === 'done' && item.url)
    .map((item) => item.url)
    .filter(Boolean);
};

const SPRITE_CACHE_VERSION = 'v1';
const SPRITE_CACHE_KEY = 'ai.sprite.cache';
const SPRITE_CACHE_LIMIT = 12;

const makeInterestCacheKey = (interests = [], model = '') => {
  const normalized = sanitizeInterests(interests).map((value) => value.toLowerCase());
  normalized.sort();
  const modelSuffix = model ? `|${model.toLowerCase()}` : '';
  return `${SPRITE_CACHE_VERSION}|${normalized.join('|')}${modelSuffix}`;
};

const readSpriteCache = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { version: SPRITE_CACHE_VERSION, entries: {} };
  }
  try {
    const raw = window.localStorage.getItem(SPRITE_CACHE_KEY);
    if (!raw) {
      return { version: SPRITE_CACHE_VERSION, entries: {} };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SPRITE_CACHE_VERSION || typeof parsed.entries !== 'object') {
      return { version: SPRITE_CACHE_VERSION, entries: {} };
    }
    return { version: SPRITE_CACHE_VERSION, entries: parsed.entries || {} };
  } catch (error) {
    return { version: SPRITE_CACHE_VERSION, entries: {} };
  }
};

const writeSpriteCache = (cache) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SPRITE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    // ignore quota issues
  }
};

const saveSpriteCacheEntry = (key, entry) => {
  if (!key) return;
  const cache = readSpriteCache();
  const entries = { ...(cache.entries || {}) };
  entries[key] = {
    ...(entry || {}),
    updatedAt: Date.now(),
  };
  const keys = Object.keys(entries);
  if (keys.length > SPRITE_CACHE_LIMIT) {
    keys
      .sort((a, b) => {
        const aTs = entries[a]?.updatedAt || 0;
        const bTs = entries[b]?.updatedAt || 0;
        return aTs - bTs;
      })
      .slice(0, keys.length - SPRITE_CACHE_LIMIT)
      .forEach((stale) => {
        delete entries[stale];
      });
  }
  writeSpriteCache({ version: SPRITE_CACHE_VERSION, entries });
};

const readSpriteCacheEntry = (key) => {
  if (!key) return null;
  const cache = readSpriteCache();
  return cache.entries?.[key] || null;
};

const mergeUrls = (set, urls = []) => {
  urls.forEach((url) => {
    if (typeof url === 'string' && url.trim()) {
      set.add(url.trim());
    }
  });
};

const clampPositive = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
  return Math.max(0, num);
};

const deriveSpriteFallback = (interests = []) => deriveMotifsFromInterests(interests);

const ensureTimeBudget = (value, defaultValue) => {
  if (!Number.isFinite(value) || value <= 0) return defaultValue;
  return value;
};

export async function requestInterestMotifs(
  interests,
  model,
  {
    aiEnabled = true,
    timeoutMs = 15000,
    pollIntervalMs = 2000,
    batchLimit = 1,
    syncMs = 6000,
    syncTickLimit = 1,
  } = {},
) {
  const sanitizedInterests = sanitizeInterests(interests);
  if (!sanitizedInterests.length) {
    return { source: 'fallback', motifs: [], jobId: null, pending: 0, done: 0 };
  }

  const fallbackMotifs = deriveSpriteFallback(sanitizedInterests);

  if (!aiEnabled || !model) {
    return { source: 'fallback', motifs: fallbackMotifs, jobId: null, pending: 0, done: 0 };
  }

  if (!isAiProxyConfigured()) {
    return { source: 'fallback', motifs: fallbackMotifs, jobId: null, pending: 0, done: 0 };
  }

  const timeoutBudget = ensureTimeBudget(timeoutMs, 15000);
  const pollDelay = ensureTimeBudget(pollIntervalMs, 2000);
  const kickLimit = Math.max(1, Number.isFinite(batchLimit) ? Math.floor(batchLimit) : 1);

  const cacheKey = makeInterestCacheKey(sanitizedInterests, model);
  const cachedEntry = readSpriteCacheEntry(cacheKey);
  if (cachedEntry?.urls && Array.isArray(cachedEntry.urls) && cachedEntry.urls.length) {
    return {
      source: 'ai',
      urls: [...new Set(cachedEntry.urls.filter((url) => typeof url === 'string' && url.trim()))],
      jobId: cachedEntry.jobId || null,
      pending: clampPositive(cachedEntry.pending, 0),
      done: clampPositive(cachedEntry.done, cachedEntry.urls.length),
      cacheKey,
      motifs: fallbackMotifs,
    };
  }

  const tryGenerateSpritesQuickly = async () => {
    if (typeof mathGalaxyClient.generateSprites !== 'function') {
      return null;
    }
    try {
      const batch = sanitizedInterests.slice(0, 6).map((interest, index) => ({
        id: `${cacheKey || interest}-${index}`,
        prompt: interest,
        tags: ['interest'],
        metadata: { interest },
      }));
      if (!batch.length) {
        return null;
      }
      const response = await mathGalaxyClient.generateSprites(batch);
      const urls = new Set();
      const collect = (value) => {
        if (!value) return;
        if (typeof value === 'string') {
          if (value.trim().startsWith('http')) {
            urls.add(value.trim());
          }
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(collect);
          return;
        }
        if (typeof value === 'object') {
          collect(value.url);
          collect(value.secure_url);
          collect(value.image);
          collect(value.images);
          collect(value.sprites);
          collect(value.sprite);
          if (Array.isArray(value.urls)) {
            value.urls.forEach(collect);
          }
        }
      };
      collect(response);
      if (!urls.size) {
        return null;
      }
      return Array.from(urls);
    } catch (error) {
      console.warn('Quick sprite generation failed', error);
      return null;
    }
  };

  const startedAt = Date.now();
  const attemptSync = async () => {
    const response = await postInterestsPacks({
      interests: sanitizedInterests,
      mode: 'sync',
      sync_ms: syncMs,
      tick_limit: syncTickLimit,
      model,
    });
    return response;
  };

  let syncResponse = await attemptSync();
  if (!syncResponse.ok && syncResponse.status === 429 && syncResponse.retryAfter) {
    await sleep(syncResponse.retryAfter);
    syncResponse = await attemptSync();
  }

  if (!syncResponse.ok || !syncResponse.data) {
    const quickSprites = await tryGenerateSpritesQuickly();
    if (quickSprites && quickSprites.length) {
      saveSpriteCacheEntry(cacheKey, { urls: quickSprites, jobId: null, pending: 0, done: quickSprites.length });
      return {
        source: 'ai',
        urls: quickSprites,
        jobId: null,
        pending: 0,
        done: quickSprites.length,
        cacheKey,
        motifs: fallbackMotifs,
      };
    }
    return { source: 'fallback', motifs: fallbackMotifs, jobId: null, pending: 0, done: 0 };
  }

  const syncData = syncResponse.data || {};
  const syncStatus = parseSpriteJobStatus(syncData);
  const readySet = new Set();
  mergeUrls(readySet, Array.isArray(syncData.urls) ? syncData.urls : []);
  mergeUrls(readySet, Array.isArray(syncData.sprites) ? syncData.sprites : []);
  mergeUrls(readySet, Array.isArray(syncData.sprite_urls) ? syncData.sprite_urls : []);
  if (Array.isArray(syncData.job?.sprites)) {
    mergeUrls(readySet, syncData.job.sprites);
  }
  mergeUrls(readySet, collectSpriteUrls(syncStatus.items));

  let jobId = syncStatus.jobId;
  if (!jobId && typeof syncData.jobId === 'string') jobId = syncData.jobId;
  if (!jobId && typeof syncData.job_id === 'string') jobId = syncData.job_id;
  if (!jobId && typeof syncData.job?.id === 'string') jobId = syncData.job.id;

  let pending = clampPositive(syncStatus.pending, Number.isFinite(syncData.pending) ? Number(syncData.pending) : 0);
  let done = clampPositive(syncStatus.done, Number.isFinite(syncData.done) ? Number(syncData.done) : readySet.size);
  let nextRetryAt = syncResponse.retryAfter ? Date.now() + syncResponse.retryAfter : null;

  if ((!jobId || pending <= 0) && readySet.size) {
    const urls = [...readySet];
    saveSpriteCacheEntry(cacheKey, { urls, jobId: jobId || null, pending: 0, done: urls.length });
    return { source: 'ai', urls, jobId: jobId || null, pending: 0, done: urls.length, cacheKey, motifs: fallbackMotifs };
  }

  if (!jobId) {
    if (readySet.size) {
      const urls = [...readySet];
      saveSpriteCacheEntry(cacheKey, { urls, jobId: null, pending: 0, done: urls.length });
      return { source: 'ai', urls, jobId: null, pending: 0, done: urls.length, cacheKey, motifs: fallbackMotifs };
    }
    return { source: 'fallback', motifs: fallbackMotifs, jobId: null, pending: 0, done: 0 };
  }

  let lastStatus = syncStatus;
  let rateLimitedUntil = nextRetryAt;

  while (Date.now() - startedAt < timeoutBudget && pending > 0) {
    const now = Date.now();
    if (rateLimitedUntil && rateLimitedUntil > now) {
      await sleep(Math.min(rateLimitedUntil - now, pollDelay));
      continue;
    }

    const processResult = await postProcessJob({ jobId, limit: kickLimit, model });
    if (!processResult.ok) {
      if (processResult.status === 429 && processResult.retryAfter) {
        rateLimitedUntil = Date.now() + processResult.retryAfter;
        continue;
      }
      if (processResult.status === 404) {
        break;
      }
    }
    if (processResult.retryAfter) {
      rateLimitedUntil = Date.now() + processResult.retryAfter;
    }
    mergeUrls(readySet, Array.isArray(processResult.data?.new_urls) ? processResult.data.new_urls : []);
    mergeUrls(readySet, Array.isArray(processResult.data?.urls) ? processResult.data.urls : []);
    mergeUrls(readySet, Array.isArray(processResult.data?.sprites) ? processResult.data.sprites : []);

    await sleep(pollDelay);
    const statusResult = await getSpriteJobStatus(jobId);
    if (!statusResult.ok) {
      if (statusResult.status === 429 && statusResult.retryAfter) {
        rateLimitedUntil = Date.now() + statusResult.retryAfter;
        continue;
      }
      break;
    }

    const parsed = parseSpriteJobStatus(statusResult.data || {});
    lastStatus = parsed;
    pending = clampPositive(parsed.pending, pending);
    done = clampPositive(parsed.done, done);
    mergeUrls(readySet, Array.isArray(statusResult.data?.sprites) ? statusResult.data.sprites : []);
    mergeUrls(readySet, collectSpriteUrls(parsed.items));

    if (statusResult.retryAfter) {
      rateLimitedUntil = Date.now() + statusResult.retryAfter;
    }

    if (pending <= 0) {
      break;
    }
  }

  const finalUrls = [...readySet];
  if (finalUrls.length) {
    saveSpriteCacheEntry(cacheKey, {
      urls: finalUrls,
      jobId,
      pending: Math.max(0, pending),
      done: done || finalUrls.length,
    });
    return {
      source: 'ai',
      urls: finalUrls,
      jobId,
      pending: Math.max(0, pending),
      done: done || finalUrls.length,
      cacheKey,
      motifs: fallbackMotifs,
      nextRetryAt: rateLimitedUntil || null,
      lastStatus,
    };
  }

  return { source: 'fallback', motifs: fallbackMotifs, jobId, pending: Math.max(0, pending), done };
}

export async function getServerKeyStatus() {
  try {
    const health = await testGeminiKey();
    const config = health?.config || health?.settings;
    return Boolean(
      health?.have_key ??
        health?.haveKey ??
        health?.server_has_key ??
        health?.key_configured ??
        config?.have_key ??
        config?.has_key ??
        config?.key_present,
    );
  } catch (error) {
    console.warn('Unable to read Gemini key status', error);
    return false;
  }
}
