const LIMITS_STORAGE_KEY = 'addition-game.audio.cache.limits.v1';
export const CACHE_LIMITS_STORAGE_KEY = LIMITS_STORAGE_KEY;
export const CACHE_LIMITS_EVENT = 'addition-game.audio.cache.limits.updated';

export type AudioCacheLimits = {
  maxEntries: number;
  maxBytes: number;
  ttlMs: number;
};

const DEFAULT_LIMITS: AudioCacheLimits = {
  maxEntries: 200,
  maxBytes: 25 * 1024 * 1024,
  ttlMs: 30 * 24 * 60 * 60 * 1000,
};

let limitsSnapshot: AudioCacheLimits = readLimitsFromStorage();

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readLimitsFromStorage(): AudioCacheLimits {
  if (!isBrowser()) {
    return { ...DEFAULT_LIMITS };
  }
  try {
    const raw = window.localStorage.getItem(LIMITS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_LIMITS };
    }
    const parsed = JSON.parse(raw);
    const maxEntries = Number.isFinite(parsed?.maxEntries) ? Math.max(1, Math.floor(parsed.maxEntries)) : DEFAULT_LIMITS.maxEntries;
    const maxBytes = Number.isFinite(parsed?.maxBytes)
      ? Math.max(1024 * 1024, Math.floor(parsed.maxBytes))
      : DEFAULT_LIMITS.maxBytes;
    const ttlMs = Number.isFinite(parsed?.ttlMs) ? Math.max(60 * 60 * 1000, Math.floor(parsed.ttlMs)) : DEFAULT_LIMITS.ttlMs;
    return { maxEntries, maxBytes, ttlMs };
  } catch (error) {
    console.warn('[audio-cache] Unable to read cache limits', error);
    return { ...DEFAULT_LIMITS };
  }
}

function persistLimits(next: AudioCacheLimits): void {
  limitsSnapshot = { ...next };
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(
      LIMITS_STORAGE_KEY,
      JSON.stringify({
        maxEntries: limitsSnapshot.maxEntries,
        maxBytes: limitsSnapshot.maxBytes,
        ttlMs: limitsSnapshot.ttlMs,
      }),
    );
    window.dispatchEvent(new CustomEvent<AudioCacheLimits>(CACHE_LIMITS_EVENT, { detail: limitsSnapshot }));
  } catch (error) {
    console.warn('[audio-cache] Unable to persist cache limits', error);
  }
}

export function getAudioCacheLimits(): AudioCacheLimits {
  return { ...limitsSnapshot };
}

export function setAudioCacheLimits(update: Partial<AudioCacheLimits>): AudioCacheLimits {
  const current = getAudioCacheLimits();
  const maxEntries = Number.isFinite(update.maxEntries) ? Math.max(1, Math.floor(update.maxEntries!)) : current.maxEntries;
  const maxBytes = Number.isFinite(update.maxBytes)
    ? Math.max(1024 * 1024, Math.floor(update.maxBytes!))
    : current.maxBytes;
  const ttlMs = Number.isFinite(update.ttlMs) ? Math.max(60 * 60 * 1000, Math.floor(update.ttlMs!)) : current.ttlMs;
  const next: AudioCacheLimits = {
    maxEntries,
    maxBytes,
    ttlMs,
  };
  persistLimits(next);
  return next;
}

export function resetAudioCacheLimits(): AudioCacheLimits {
  persistLimits({ ...DEFAULT_LIMITS });
  return getAudioCacheLimits();
}

// Initialize snapshot in browser environments
if (isBrowser()) {
  limitsSnapshot = readLimitsFromStorage();
}
