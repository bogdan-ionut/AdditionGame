import { GoogleGenAI, Modality } from '@google/genai';
import { getCachedAudioClip, storeAudioClip } from '../lib/audio/cache';
import type { AudioCacheDescriptor } from '../lib/audio/cache';
import { getGeminiApiKey, hasGeminiApiKey } from '../lib/gemini/apiKey';

export type SupportedTtsMime = 'audio/mpeg' | 'audio/wav';
export type SupportedSampleRate = 16000 | 22050 | 24000 | 44100;

export type TtsSynthesizeOptions = {
  voiceId?: string;
  speakingRate?: number;
  pitch?: number;
  language?: string;
  model?: string | null;
  preferredMime?: SupportedTtsMime | null;
  sampleRateHz?: SupportedSampleRate | null;
  signal?: AbortSignal;
  kind?: string | null;
};

export const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const DEFAULT_MIME = 'audio/mpeg';
const RATE_LIMIT_STORAGE_KEY = 'addition-game.tts.daily.v1';
const RATE_LIMIT_COOLDOWN_STORAGE_KEY = 'addition-game.tts.cooldown.v1';
const MAX_REQUESTS_PER_MINUTE = 10;
const MAX_REQUESTS_PER_DAY = 100;
const MIN_RATE_LIMIT_COOLDOWN_MS = 60_000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000;

type DailyCounterState = { dateKey: string; count: number };

const pacificDateFormatter = typeof Intl !== 'undefined'
  ? new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  : null;

const getPacificDateKey = (now: Date = new Date()): string => {
  if (!pacificDateFormatter) {
    return now.toISOString().slice(0, 10);
  }
  return pacificDateFormatter.format(now);
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.floor(ms))));

let dailyCounter: DailyCounterState = { dateKey: getPacificDateKey(), count: 0 };

const clampNumber = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) {
    return min;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

let rateLimitCooldownUntil = 0;

const readDailyCounter = (): DailyCounterState => {
  if (typeof window === 'undefined') {
    return { ...dailyCounter };
  }
  try {
    const raw = window.localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) {
      return { ...dailyCounter };
    }
    const parsed = JSON.parse(raw);
    const dateKey = typeof parsed?.dateKey === 'string' ? parsed.dateKey : getPacificDateKey();
    const count = Number(parsed?.count) || 0;
    return { dateKey, count };
  } catch (error) {
    console.warn('[Gemini TTS] Unable to read daily rate limit state', error);
    return { ...dailyCounter };
  }
};

const writeDailyCounter = (state: DailyCounterState): void => {
  dailyCounter = { ...state };
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[Gemini TTS] Unable to persist daily rate limit state', error);
  }
};

const ensureDailyAllowance = (): void => {
  const todayKey = getPacificDateKey();
  const current = readDailyCounter();
  const normalized = current.dateKey === todayKey ? current : { dateKey: todayKey, count: 0 };
  if (normalized.count >= MAX_REQUESTS_PER_DAY) {
    throw new Error('tts_ratelimited');
  }
  normalized.count += 1;
  writeDailyCounter(normalized);
};

const readRateLimitCooldownUntil = (): number => {
  if (typeof window === 'undefined') {
    return rateLimitCooldownUntil;
  }
  try {
    const raw = window.localStorage.getItem(RATE_LIMIT_COOLDOWN_STORAGE_KEY);
    if (!raw) {
      return rateLimitCooldownUntil;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      rateLimitCooldownUntil = parsed;
    }
  } catch (error) {
    console.warn('[Gemini TTS] Unable to read rate limit cooldown state', error);
  }
  return rateLimitCooldownUntil;
};

const writeRateLimitCooldownUntil = (until: number): void => {
  rateLimitCooldownUntil = until;
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (until > 0) {
      window.localStorage.setItem(RATE_LIMIT_COOLDOWN_STORAGE_KEY, String(until));
    } else {
      window.localStorage.removeItem(RATE_LIMIT_COOLDOWN_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('[Gemini TTS] Unable to persist rate limit cooldown state', error);
  }
};

const getRateLimitCooldownUntil = (): number => {
  const stored = readRateLimitCooldownUntil();
  if (stored > 0 && stored <= Date.now()) {
    writeRateLimitCooldownUntil(0);
    return 0;
  }
  return stored;
};

const getRateLimitCooldownRemainingMs = (): number => {
  const until = getRateLimitCooldownUntil();
  if (until <= 0) {
    return 0;
  }
  return Math.max(0, until - Date.now());
};

const beginRateLimitCooldown = (durationMs?: number | null): void => {
  const numericDuration = Number(durationMs);
  let effectiveDuration = Number.isFinite(numericDuration) ? (numericDuration as number) : 0;
  if (effectiveDuration <= 0) {
    effectiveDuration = MIN_RATE_LIMIT_COOLDOWN_MS;
  }
  effectiveDuration = clampNumber(effectiveDuration, MIN_RATE_LIMIT_COOLDOWN_MS, MAX_RATE_LIMIT_COOLDOWN_MS);
  const now = Date.now();
  const currentUntil = getRateLimitCooldownUntil();
  const proposedUntil = now + effectiveDuration;
  if (proposedUntil <= currentUntil) {
    return;
  }
  writeRateLimitCooldownUntil(proposedUntil);
};

type TokenBucket = { tokens: number; lastRefill: number };

const bucket: TokenBucket = {
  tokens: MAX_REQUESTS_PER_MINUTE,
  lastRefill: Date.now(),
};

const refillTokens = (now: number): void => {
  if (bucket.tokens >= MAX_REQUESTS_PER_MINUTE) {
    bucket.lastRefill = now;
    return;
  }
  const elapsed = Math.max(0, now - bucket.lastRefill);
  if (elapsed <= 0) {
    return;
  }
  const tokensToAdd = (elapsed / 60000) * MAX_REQUESTS_PER_MINUTE;
  bucket.tokens = Math.min(MAX_REQUESTS_PER_MINUTE, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
};

const takeToken = (): void => {
  const now = Date.now();
  refillTokens(now);
  if (bucket.tokens < 1) {
    throw new Error('tts_ratelimited');
  }
  bucket.tokens -= 1;
};

const enforceRateLimits = (): void => {
  if (getRateLimitCooldownRemainingMs() > 0) {
    throw new Error('tts_ratelimited');
  }
  takeToken();
  try {
    ensureDailyAllowance();
  } catch (error) {
    bucket.tokens = Math.min(MAX_REQUESTS_PER_MINUTE, bucket.tokens + 1);
    throw error;
  }
};

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | null = null;

const decodeBase64 = (value: string): Uint8Array => {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const globalBuffer = (globalThis as any).Buffer as { from(data: string, encoding: string): any } | undefined;
  if (globalBuffer) {
    const buffer = globalBuffer.from(value, 'base64');
    if (buffer instanceof Uint8Array) {
      return buffer;
    }
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  throw new Error('Base64 decoding is not supported in this environment.');
};

const getClient = (): GoogleGenAI => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('tts_unavailable');
  }
  if (cachedClient && cachedKey === apiKey) {
    return cachedClient;
  }
  cachedKey = apiKey;
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
};

type AudioMimeInfo = {
  type: string;
  params: Record<string, string>;
};

const parseAudioMime = (mimeType: string | null | undefined): AudioMimeInfo | null => {
  if (!mimeType) return null;
  const segments = mimeType
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  const [type, ...paramSegments] = segments;
  const params: Record<string, string> = {};
  for (const segment of paramSegments) {
    const eqIndex = segment.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = segment.slice(0, eqIndex).trim().toLowerCase();
    const value = segment.slice(eqIndex + 1).trim();
    if (key) {
      params[key] = value;
    }
  }

  return { type: type.toLowerCase(), params };
};

const resolveMime = (
  inlineData: { mimeType?: string | null } | null | undefined,
  fallback: string,
): { mimeType: string; info: AudioMimeInfo | null } => {
  const candidate = inlineData?.mimeType?.trim();
  const resolved = candidate && candidate.length > 0 ? candidate : fallback.trim() || DEFAULT_MIME;
  return { mimeType: resolved, info: parseAudioMime(resolved) };
};

const wrapPcmAsWav = (
  pcmBytes: Uint8Array,
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
): Uint8Array => {
  const bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcmBytes.byteLength);
  const view = new DataView(buffer);

  let offset = 0;
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset, value.charCodeAt(i));
      offset += 1;
    }
  };
  const writeUint32 = (value: number) => {
    view.setUint32(offset, value, true);
    offset += 4;
  };
  const writeUint16 = (value: number) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };

  writeString('RIFF');
  writeUint32(36 + pcmBytes.byteLength);
  writeString('WAVE');
  writeString('fmt ');
  writeUint32(16);
  writeUint16(1);
  writeUint16(channels);
  writeUint32(sampleRate);
  writeUint32(byteRate);
  writeUint16(blockAlign);
  writeUint16(bitsPerSample);
  writeString('data');
  writeUint32(pcmBytes.byteLength);

  new Uint8Array(buffer).set(pcmBytes, 44);

  return new Uint8Array(buffer);
};

const buildSpeechConfig = (opts: TtsSynthesizeOptions) => {
  const languageCode = opts.language?.trim();
  const voiceName = opts.voiceId?.trim();

  const speechConfig: Record<string, unknown> = {};

  if (languageCode) {
    speechConfig.languageCode = languageCode;
  }

  if (voiceName) {
    speechConfig.voiceConfig = {
      prebuiltVoiceConfig: { voiceName },
    };
  }

  if (typeof opts.speakingRate === 'number' && Number.isFinite(opts.speakingRate)) {
    speechConfig.speakingRate = opts.speakingRate;
  }

  if (typeof opts.pitch === 'number' && Number.isFinite(opts.pitch)) {
    speechConfig.pitch = opts.pitch;
  }

  if (typeof opts.sampleRateHz === 'number' && Number.isFinite(opts.sampleRateHz)) {
    speechConfig.sampleRateHertz = opts.sampleRateHz;
  }

  return Object.keys(speechConfig).length > 0 ? speechConfig : undefined;
};

const extractRetryInfoDelay = (payload: any): number | null => {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.retryDelayMs && Number.isFinite(payload.retryDelayMs)) {
    return Math.max(0, Number(payload.retryDelayMs));
  }
  if (payload.retryDelay && Number.isFinite(payload.retryDelay)) {
    return Math.max(0, Number(payload.retryDelay));
  }
  const retryInfo =
    payload.retryInfo ||
    payload.retryinfo ||
    payload.retry_info ||
    payload.RetryInfo ||
    payload.retry ||
    null;
  if (retryInfo && typeof retryInfo === 'object') {
    const seconds = Number(retryInfo.seconds ?? retryInfo.second ?? 0);
    const nanos = Number(retryInfo.nanos ?? retryInfo.nano ?? 0);
    if (Number.isFinite(seconds) || Number.isFinite(nanos)) {
      return Math.max(0, seconds * 1000 + nanos / 1_000_000);
    }
    if (typeof retryInfo.retryDelay === 'string') {
      const parsed = Number.parseFloat(retryInfo.retryDelay);
      if (Number.isFinite(parsed)) {
        return Math.max(0, parsed * 1000);
      }
    }
  }
  if (Array.isArray(payload.details)) {
    for (const detail of payload.details) {
      const delay = extractRetryInfoDelay(detail);
      if (delay != null) {
        return delay;
      }
    }
  }
  return null;
};

const resolveRetryDelayMs = (error: any, attempt: number): number => {
  const delayMs =
    extractRetryInfoDelay(error) ??
    extractRetryInfoDelay(error?.errorInfo) ??
    extractRetryInfoDelay(error?.extensions) ??
    extractRetryInfoDelay(error?.cause);
  if (delayMs != null) {
    return delayMs;
  }
  const headerDelay = (() => {
    try {
      const headers = error?.response?.headers;
      if (!headers) return null;
      const retryAfter = typeof headers.get === 'function' ? headers.get('retry-after') : headers['retry-after'];
      if (!retryAfter) return null;
      const numeric = Number(retryAfter);
      if (Number.isFinite(numeric)) {
        return Math.max(0, numeric * 1000);
      }
      const parsedDate = Date.parse(retryAfter);
      if (!Number.isNaN(parsedDate)) {
        return Math.max(0, parsedDate - Date.now());
      }
      return null;
    } catch {
      return null;
    }
  })();
  if (headerDelay != null) {
    return headerDelay;
  }
  return 1000 * 2 ** attempt;
};

export async function synthesize(text: string, opts: TtsSynthesizeOptions = {}): Promise<Blob> {
  const normalized = text?.trim();
  if (!normalized) {
    throw new Error('Cannot synthesize empty text.');
  }

  const targetModel = opts.model?.trim() || DEFAULT_TTS_MODEL;
  const cacheDescriptor: AudioCacheDescriptor = {
    text: normalized,
    voiceId: typeof opts.voiceId === 'string' ? opts.voiceId.trim() : null,
    speakingRate: typeof opts.speakingRate === 'number' ? opts.speakingRate : null,
    pitch: typeof opts.pitch === 'number' ? opts.pitch : null,
    language: typeof opts.language === 'string' ? opts.language.trim() : null,
    model: targetModel,
    type: typeof opts.kind === 'string' ? opts.kind.trim() : null,
    preferredMime: opts.preferredMime ?? null,
    sampleRateHz: typeof opts.sampleRateHz === 'number' ? opts.sampleRateHz : null,
  };

  try {
    const cached = await getCachedAudioClip(cacheDescriptor);
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.warn('[Gemini TTS] Unable to read cached audio', error);
  }

  if (!hasGeminiApiKey()) {
    throw new Error('tts_unavailable');
  }

  try {
    enforceRateLimits();
    const client = getClient();
    const model = targetModel;
    const speechConfig = buildSpeechConfig(opts);
    const responseMimeType = opts.preferredMime?.trim() || DEFAULT_MIME;

    let response;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        response = await client.models.generateContent({
          model,
          contents: [{ parts: [{ text: normalized }] }],
          config: {
            responseModalities: [Modality.AUDIO],
          },
          safetySettings: [],
          generationConfig: {
            responseMimeType,
            ...(speechConfig ? { speechConfig } : {}),
          },
          signal: opts.signal,
        });
        break;
      } catch (error: any) {
        if (error instanceof Error && error.message === 'tts_ratelimited') {
          throw error;
        }
        const status = error?.status ?? error?.code ?? error?.response?.status;
        const is429 = status === 429;
        if (is429 && attempt < maxAttempts) {
          const retryDelay = resolveRetryDelayMs(error, attempt);
          await delay(retryDelay);
          continue;
        }
        if (is429) {
          const retryDelay = resolveRetryDelayMs(error, attempt);
          beginRateLimitCooldown(retryDelay);
          throw new Error('tts_ratelimited');
        }
        throw error;
      }
    }

    if (!response) {
      throw new Error('tts_unavailable');
    }

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.find((item) => Boolean(item.inlineData));
    const inlineData = part?.inlineData;
    const base64Audio = inlineData?.data;
    if (!base64Audio) {
      throw new Error('tts_unavailable');
    }

    const bytes = decodeBase64(base64Audio);
    const { mimeType, info } = resolveMime(inlineData, responseMimeType);

    const normalizedType = info?.type ?? mimeType;
    const encoding = info?.params.encoding || info?.params.codecs || '';
    const encodingLower = encoding.toLowerCase();
    const bitsParam = info?.params.bits || info?.params.bitdepth || info?.params['bits-per-sample'];
    const channelsParam = info?.params.channels || info?.params.channel;
    const rateParam = info?.params.rate || info?.params.samplerate || info?.params['sample-rate'];

    const bitsPerSample = Number(bitsParam) || (encodingLower.includes('16') ? 16 : 16);
    const sampleRate = Number(rateParam) || 24000;
    const channels = Number(channelsParam) || 1;

    const looksLikePcm =
      normalizedType === 'audio/raw' ||
      normalizedType === 'audio/x-raw' ||
      normalizedType === 'audio/l16' ||
      normalizedType === 'audio/pcm' ||
      encodingLower.includes('pcm');

    const blob = (() => {
      if (looksLikePcm && bitsPerSample === 16) {
        const wavBytes = wrapPcmAsWav(bytes, sampleRate, channels, bitsPerSample);
        return new Blob([wavBytes], { type: 'audio/wav' });
      }
      return new Blob([bytes], { type: mimeType });
    })();

    void storeAudioClip(cacheDescriptor, blob);
    return blob;
  } catch (error) {
    if (error instanceof Error && error.message === 'tts_ratelimited') {
      console.warn('[Gemini TTS] Rate limit reached.', error);
      throw error;
    }
    if (error instanceof Error && error.message === 'tts_unavailable') {
      console.error('[Gemini TTS] Failed to generate speech.', error);
      throw error;
    }
    console.error('[Gemini TTS] Failed to generate speech.', error);
    throw new Error('tts_unavailable');
  }
}
