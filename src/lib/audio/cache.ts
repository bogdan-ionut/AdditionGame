const CACHE_DB_NAME = 'addition-game-audio-cache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = 'clips';
const CACHE_SUMMARY_KEY = 'addition-game.audio.cache.summary.v1';
export const CACHE_SUMMARY_STORAGE_KEY = CACHE_SUMMARY_KEY;
export const CACHE_EVENT_NAME = 'addition-game.audio.cache.updated';
const MAX_CACHE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_CACHE_ENTRIES = 200;

export type AudioCacheDescriptor = {
  text: string;
  language?: string | null;
  voiceId?: string | null;
  speakingRate?: number | null;
  pitch?: number | null;
  model?: string | null;
  type?: string | null;
};

export type AudioCacheSummary = {
  totalBytes: number;
  entryCount: number;
  updatedAt: number;
};

type StoredCacheDescriptor = {
  normalizedText: string;
  language: string | null;
  voiceId: string | null;
  speakingRate: number | null;
  pitch: number | null;
  model: string | null;
  type: string | null;
};

type StoredCacheEntry = {
  id: string;
  descriptor: StoredCacheDescriptor;
  blob: Blob;
  createdAt: number;
  lastAccessed: number;
  size: number;
};

type IDBMode = 'readonly' | 'readwrite';

type CachedDb = IDBDatabase | null;

let cachedDbPromise: Promise<CachedDb> | null = null;

const defaultSummary: AudioCacheSummary = { totalBytes: 0, entryCount: 0, updatedAt: 0 };

const isBrowser = typeof window !== 'undefined';

const isIndexedDbAvailable = () => {
  if (!isBrowser) return false;
  try {
    return typeof window.indexedDB !== 'undefined';
  } catch (error) {
    console.warn('[audio-cache] indexedDB check failed', error);
    return false;
  }
};

const normalizeLanguage = (value: string | null | undefined) => {
  if (!value) return null;
  return value.trim().toLowerCase();
};

const clampNumber = (value: number | null | undefined, decimals = 2) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const normalizeText = (text: string) => {
  return text
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const buildStoredDescriptor = (descriptor: AudioCacheDescriptor): StoredCacheDescriptor => ({
  normalizedText: normalizeText(descriptor.text),
  language: normalizeLanguage(descriptor.language) || null,
  voiceId: descriptor.voiceId?.trim?.() || null,
  speakingRate: clampNumber(descriptor.speakingRate),
  pitch: clampNumber(descriptor.pitch),
  model: descriptor.model?.trim?.() || null,
  type: descriptor.type?.trim?.() || null,
});

const fallbackHash = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    const chr = value.charCodeAt(index);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return `fh-${Math.abs(hash).toString(16)}`;
};

const encodeDescriptorId = async (descriptor: StoredCacheDescriptor): Promise<string> => {
  const payload = JSON.stringify(descriptor);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const buffer = new TextEncoder().encode(payload);
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const bytes = new Uint8Array(digest);
      const hashString = Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      return `v1-${hashString}`;
    } catch (error) {
      console.warn('[audio-cache] Unable to hash descriptor via subtle crypto', error);
    }
  }
  if (typeof btoa === 'function') {
    try {
      return `v1-${btoa(payload).replace(/[^A-Za-z0-9_-]/g, '')}`;
    } catch (error) {
      console.warn('[audio-cache] Unable to base64 encode descriptor', error);
    }
  }
  return `v1-${fallbackHash(payload)}`;
};

const openDatabase = async (): Promise<CachedDb> => {
  if (!isIndexedDbAvailable()) return null;
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = new Promise<CachedDb>((resolve, reject) => {
    try {
      const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
          const store = db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'id' });
          store.createIndex('lastAccessed', 'lastAccessed');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open audio cache database.'));
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  }).catch((error) => {
    console.warn('[audio-cache] Unable to open database', error);
    return null;
  });

  return cachedDbPromise;
};

const promisifyRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });

const waitForTransaction = (transaction: IDBTransaction): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction error.'));
  });

const withStore = async <T>(mode: IDBMode, handler: (store: IDBObjectStore) => Promise<T> | T): Promise<T | null> => {
  const db = await openDatabase();
  if (!db) return null;
  const transaction = db.transaction(CACHE_STORE_NAME, mode);
  const store = transaction.objectStore(CACHE_STORE_NAME);
  try {
    const result = await handler(store);
    await waitForTransaction(transaction);
    return result;
  } catch (error) {
    try {
      transaction.abort();
    } catch (abortError) {
      console.warn('[audio-cache] Unable to abort transaction', abortError);
    }
    console.warn('[audio-cache] Store operation failed', error);
    return null;
  }
};

const readSummary = (): AudioCacheSummary => {
  if (!isBrowser) return { ...defaultSummary };
  try {
    const raw = window.localStorage.getItem(CACHE_SUMMARY_KEY);
    if (!raw) return { ...defaultSummary };
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed == null) return { ...defaultSummary };
    const totalBytes = Number(parsed.totalBytes) || 0;
    const entryCount = Number(parsed.entryCount) || 0;
    const updatedAt = Number(parsed.updatedAt) || 0;
    return { totalBytes, entryCount, updatedAt };
  } catch (error) {
    console.warn('[audio-cache] Unable to read summary metadata', error);
    return { ...defaultSummary };
  }
};

const dispatchCacheUpdate = (summary: AudioCacheSummary) => {
  if (!isBrowser) return;
  try {
    window.dispatchEvent(new CustomEvent(CACHE_EVENT_NAME, { detail: summary }));
  } catch (error) {
    console.warn('[audio-cache] Unable to dispatch cache update event', error);
  }
};

const writeSummary = (summary: AudioCacheSummary) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(CACHE_SUMMARY_KEY, JSON.stringify(summary));
    dispatchCacheUpdate(summary);
  } catch (error) {
    console.warn('[audio-cache] Unable to persist summary metadata', error);
  }
};

const pruneCache = async (summary: AudioCacheSummary): Promise<AudioCacheSummary> => {
  if (summary.entryCount <= MAX_CACHE_ENTRIES && summary.totalBytes <= MAX_CACHE_BYTES) {
    return summary;
  }

  let nextSummary = { ...summary };

  await withStore('readwrite', async (store) => {
    const index = store.index('lastAccessed');
    const request = index.openCursor();
    await new Promise<void>((resolve, reject) => {
      request.onerror = () => reject(request.error || new Error('IndexedDB cursor failed.'));
      request.onsuccess = () => {
        const cursor = request.result as IDBCursorWithValue | null;
        if (!cursor) {
          resolve();
          return;
        }
        if (
          nextSummary.entryCount <= MAX_CACHE_ENTRIES &&
          nextSummary.totalBytes <= MAX_CACHE_BYTES
        ) {
          resolve();
          return;
        }
        const value = cursor.value as StoredCacheEntry;
        nextSummary.entryCount = Math.max(0, nextSummary.entryCount - 1);
        nextSummary.totalBytes = Math.max(0, nextSummary.totalBytes - (value?.size || 0));
        cursor.delete();
        cursor.continue();
      };
    });
  });

  nextSummary.updatedAt = Date.now();
  writeSummary(nextSummary);
  return nextSummary;
};

export const isAudioCacheAvailable = (): boolean => isIndexedDbAvailable();

export const getAudioCacheSummary = (): AudioCacheSummary => readSummary();

export const getCachedAudioClip = async (descriptor: AudioCacheDescriptor): Promise<Blob | null> => {
  if (!descriptor?.text?.trim()) return null;
  if (!isIndexedDbAvailable()) return null;
  const storedDescriptor = buildStoredDescriptor(descriptor);
  const id = await encodeDescriptorId(storedDescriptor);
  const entry = await withStore('readonly', async (store) => {
    const result = await promisifyRequest<StoredCacheEntry | undefined>(store.get(id));
    return result || null;
  });
  if (!entry) return null;
  void withStore('readwrite', async (store) => {
    const existing = await promisifyRequest<StoredCacheEntry | undefined>(store.get(id));
    if (!existing) return;
    existing.lastAccessed = Date.now();
    store.put(existing);
  });
  return entry.blob;
};

export const storeAudioClip = async (
  descriptor: AudioCacheDescriptor,
  blob: Blob,
): Promise<void> => {
  if (!descriptor?.text?.trim()) return;
  if (!blob) return;
  if (!isIndexedDbAvailable()) return;

  const storedDescriptor = buildStoredDescriptor(descriptor);
  const id = await encodeDescriptorId(storedDescriptor);
  const now = Date.now();

  let summary = readSummary();

  await withStore('readwrite', async (store) => {
    const existing = await promisifyRequest<StoredCacheEntry | undefined>(store.get(id));
    const entry: StoredCacheEntry = {
      id,
      descriptor: storedDescriptor,
      blob,
      createdAt: existing?.createdAt || now,
      lastAccessed: now,
      size: blob.size,
    };
    store.put(entry);
    summary.totalBytes = Math.max(0, summary.totalBytes - (existing?.size || 0) + blob.size);
    summary.entryCount = existing ? summary.entryCount : summary.entryCount + 1;
  });

  summary.updatedAt = now;
  writeSummary(summary);
  await pruneCache(summary);
};

export const clearAudioCache = async (): Promise<void> => {
  if (!isIndexedDbAvailable()) return;
  await withStore('readwrite', async (store) => {
    store.clear();
  });
  writeSummary({ ...defaultSummary, updatedAt: Date.now() });
};

export const deleteAudioClip = async (descriptor: AudioCacheDescriptor): Promise<void> => {
  if (!descriptor?.text?.trim()) return;
  if (!isIndexedDbAvailable()) return;
  const storedDescriptor = buildStoredDescriptor(descriptor);
  const id = await encodeDescriptorId(storedDescriptor);
  let summary = readSummary();
  await withStore('readwrite', async (store) => {
    const existing = await promisifyRequest<StoredCacheEntry | undefined>(store.get(id));
    if (!existing) return;
    store.delete(id);
    summary.totalBytes = Math.max(0, summary.totalBytes - existing.size);
    summary.entryCount = Math.max(0, summary.entryCount - 1);
  });
  summary.updatedAt = Date.now();
  writeSummary(summary);
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

export const buildCacheDescriptor = (
  descriptor: AudioCacheDescriptor,
): StoredCacheDescriptor => buildStoredDescriptor(descriptor);

export const getCacheKey = async (descriptor: AudioCacheDescriptor): Promise<string> => {
  const stored = buildStoredDescriptor(descriptor);
  return encodeDescriptorId(stored);
};
