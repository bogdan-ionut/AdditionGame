import type { TtsDescriptor } from './ttsCache';
import {
  CACHE_EVENT_NAME,
  CACHE_SUMMARY_STORAGE_KEY,
  clearAudioCache as clearTtsCache,
  deleteAudioClip as deleteTtsClip,
  getCachedAudioClip as getTtsCachedClip,
  makeCacheKey as makeTtsCacheKey,
  storeAudioClip as storeTtsClip,
} from './ttsCache';

export { CACHE_EVENT_NAME, CACHE_SUMMARY_STORAGE_KEY };

const DEFAULT_FORMAT = 'audio/mpeg';

const DEFAULT_SUMMARY: AudioCacheSummary = { totalBytes: 0, entryCount: 0, updatedAt: 0 };

export type AudioCacheDescriptor = {
  text: string;
  language?: string | null;
  voiceId?: string | null;
  speakingRate?: number | null;
  pitch?: number | null;
  model?: string | null;
  type?: string | null;
  preferredMime?: string | null;
  sampleRateHz?: number | null;
};

export type AudioCacheSummary = {
  totalBytes: number;
  entryCount: number;
  updatedAt: number;
};

const isBrowser = typeof window !== 'undefined';

const normalizeString = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.trim();
};

const normalizeNumber = (value: number | null | undefined, fallback: number): number => {
  return Number.isFinite(value) ? (value as number) : fallback;
};

const buildFormat = (descriptor: AudioCacheDescriptor): string => {
  const segments: string[] = [];
  const base = descriptor.preferredMime?.trim() || DEFAULT_FORMAT;
  if (descriptor.type?.trim()) {
    segments.push(`kind=${descriptor.type.trim()}`);
  }
  if (Number.isFinite(descriptor.sampleRateHz)) {
    segments.push(`rate=${Number(descriptor.sampleRateHz)}`);
  }
  if (segments.length === 0) {
    return base;
  }
  return `${base};${segments.join(';')}`;
};

const toTtsDescriptor = (descriptor: AudioCacheDescriptor): TtsDescriptor => ({
  text: descriptor.text ?? '',
  lang: normalizeString(descriptor.language),
  voice: normalizeString(descriptor.voiceId),
  model: normalizeString(descriptor.model),
  rate: normalizeNumber(descriptor.speakingRate, 1),
  pitch: normalizeNumber(descriptor.pitch, 1),
  format: buildFormat(descriptor),
  sampleRate: Number.isFinite(descriptor.sampleRateHz) ? Number(descriptor.sampleRateHz) : undefined,
});

const readSummary = (): AudioCacheSummary => {
  if (!isBrowser) {
    return { ...DEFAULT_SUMMARY };
  }
  try {
    const raw = window.localStorage.getItem(CACHE_SUMMARY_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SUMMARY };
    }
    const parsed = JSON.parse(raw);
    const entryCount = Number(parsed?.entryCount) || 0;
    const totalBytes = Number(parsed?.totalBytes) || 0;
    const updatedAt = Number(parsed?.updatedAt) || 0;
    return { entryCount, totalBytes, updatedAt };
  } catch (error) {
    console.warn('[audio-cache] Unable to read cache summary', error);
    return { ...DEFAULT_SUMMARY };
  }
};

export const isAudioCacheAvailable = (): boolean => {
  if (!isBrowser) return false;
  try {
    return typeof window.indexedDB !== 'undefined';
  } catch (error) {
    console.warn('[audio-cache] IndexedDB availability check failed', error);
    return false;
  }
};

export const getAudioCacheSummary = (): AudioCacheSummary => readSummary();

export const getCachedAudioClip = async (descriptor: AudioCacheDescriptor): Promise<Blob | null> => {
  if (!descriptor?.text?.trim()) {
    return null;
  }
  try {
    return await getTtsCachedClip(toTtsDescriptor(descriptor));
  } catch (error) {
    console.warn('[audio-cache] Unable to read cached clip', error);
    return null;
  }
};

export const storeAudioClip = async (
  descriptor: AudioCacheDescriptor,
  blob: Blob,
): Promise<void> => {
  if (!descriptor?.text?.trim()) {
    return;
  }
  if (!blob) {
    return;
  }
  try {
    await storeTtsClip(toTtsDescriptor(descriptor), blob);
  } catch (error) {
    console.warn('[audio-cache] Unable to store clip', error);
  }
};

export const deleteAudioClip = async (descriptor: AudioCacheDescriptor): Promise<void> => {
  if (!descriptor?.text?.trim()) {
    return;
  }
  try {
    const key = makeTtsCacheKey(toTtsDescriptor(descriptor));
    await deleteTtsClip(key);
  } catch (error) {
    console.warn('[audio-cache] Unable to delete cached clip', error);
  }
};

export const clearAudioCache = async (): Promise<void> => {
  try {
    await clearTtsCache();
  } catch (error) {
    console.warn('[audio-cache] Unable to clear cache', error);
  }
};

export const formatCacheSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export const buildCacheDescriptor = (descriptor: AudioCacheDescriptor): TtsDescriptor =>
  toTtsDescriptor(descriptor);

export const getCacheKey = async (descriptor: AudioCacheDescriptor): Promise<string> => {
  return makeTtsCacheKey(toTtsDescriptor(descriptor));
};
