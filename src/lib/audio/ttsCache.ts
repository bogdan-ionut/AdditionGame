import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { CACHE_LIMITS_EVENT, getAudioCacheLimits } from './cachePolicy';

export type TtsDescriptor = {
  text: string;
  lang: string;
  voice: string;
  model: string;
  flavor: string;
  rate: number;
  pitch: number;
  format: string;
  sampleRate?: number;
};

export type TtsClipRecord = {
  key: string;
  bytes: number;
  blob: Blob;
  createdAt: number;
  lastAccess: number;
  meta: {
    text: string;
    lang: string;
    voice: string;
    model: string;
    flavor: string;
    rate: number;
    pitch: number;
    format: string;
    sampleRate?: number;
  };
};

type CacheSummary = {
  entryCount: number;
  totalBytes: number;
  updatedAt: number;
};

interface TtsCacheSchema extends DBSchema {
  clips: {
    key: string;
    value: TtsClipRecord;
    indexes: {
      'by-lastAccess': number;
      'by-createdAt': number;
    };
  };
}

const DB_NAME = 'addition-game-audio-cache';
const DB_VERSION = 2;
const STORE_NAME = 'clips';
const LAST_ACCESS_INDEX = 'by-lastAccess';
const CREATED_AT_INDEX = 'by-createdAt';
const DEFAULT_FORMAT = 'audio/mpeg';

export const CACHE_EVENT_NAME = 'addition-game.audio.cache.updated';
export const CACHE_SUMMARY_STORAGE_KEY = 'addition-game.audio.cache.summary.v1';

const DEFAULT_SUMMARY: CacheSummary = { entryCount: 0, totalBytes: 0, updatedAt: 0 };

let dbPromise: Promise<IDBPDatabase<TtsCacheSchema> | null> | null = null;
let pruneScheduled = false;
let summaryInitialized = false;
let summaryInitPromise: Promise<void> | null = null;
let summarySnapshot: CacheSummary = readSummaryFromStorage();

type CacheLimits = {
  maxEntries: number;
  maxBytes: number;
  ttlMs: number;
};

function getCacheLimits(): CacheLimits {
  const limits = getAudioCacheLimits();
  return {
    maxEntries: Math.max(1, Number(limits.maxEntries) || 1),
    maxBytes: Math.max(0, Number(limits.maxBytes) || 0),
    ttlMs: Math.max(0, Number(limits.ttlMs) || 0),
  };
}

function updateSummaryAfterPut(
  existing: TtsClipRecord | undefined,
  record: TtsClipRecord,
  updatedAt: number,
): void {
  const current = getSummarySnapshot();
  const previousBytes = getRecordBytes(existing);
  const recordBytes = getRecordBytes(record);
  persistSummary({
    entryCount: existing ? current.entryCount : current.entryCount + 1,
    totalBytes: Math.max(0, current.totalBytes - previousBytes + recordBytes),
    updatedAt,
  });
}

function updateSummaryAfterDelete(record: TtsClipRecord, updatedAt: number): void {
  const current = getSummarySnapshot();
  const recordBytes = getRecordBytes(record);
  persistSummary({
    entryCount: Math.max(0, current.entryCount - 1),
    totalBytes: Math.max(0, current.totalBytes - recordBytes),
    updatedAt,
  });
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function getRecordBytes(record: TtsClipRecord | undefined): number {
  if (!record) {
    return 0;
  }
  if (Number.isFinite(record.bytes) && record.bytes > 0) {
    return Number(record.bytes);
  }
  return record.blob?.size || 0;
}

function isIndexedDbSupported(): boolean {
  if (!isBrowser()) return false;
  try {
    return typeof window.indexedDB !== 'undefined';
  } catch (error) {
    console.warn('[tts-cache] IndexedDB check failed', error);
    return false;
  }
}

function readSummaryFromStorage(): CacheSummary {
  if (!isBrowser()) {
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
    const updatedAt = Number(parsed?.updatedAt) || Date.now();
    return { entryCount, totalBytes, updatedAt };
  } catch (error) {
    console.warn('[tts-cache] Failed to read cache summary', error);
    return { ...DEFAULT_SUMMARY };
  }
}

function dispatchCacheUpdate(): void {
  if (!isBrowser()) return;
  try {
    window.dispatchEvent(new CustomEvent(CACHE_EVENT_NAME));
  } catch (error) {
    console.warn('[tts-cache] Unable to dispatch cache update event', error);
  }
}

function persistSummary(summary: CacheSummary, { dispatch = true }: { dispatch?: boolean } = {}): void {
  summarySnapshot = {
    entryCount: Math.max(0, summary.entryCount),
    totalBytes: Math.max(0, summary.totalBytes),
    updatedAt: summary.updatedAt,
  };
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      CACHE_SUMMARY_STORAGE_KEY,
      JSON.stringify({
        entryCount: summarySnapshot.entryCount,
        totalBytes: summarySnapshot.totalBytes,
        updatedAt: summarySnapshot.updatedAt,
      }),
    );
  } catch (error) {
    console.warn('[tts-cache] Unable to persist cache summary', error);
  }
  if (dispatch) {
    dispatchCacheUpdate();
  }
}

function getSummarySnapshot(): CacheSummary {
  return summarySnapshot;
}

async function ensureSummaryInitialized(): Promise<void> {
  if (summaryInitialized) {
    return;
  }
  if (!summaryInitPromise) {
    summaryInitPromise = (async () => {
      await mirrorSummaryFromDb();
      summaryInitialized = true;
    })().catch((error) => {
      console.warn('[tts-cache] Failed to initialize summary', error);
    });
  }
  await summaryInitPromise;
}

async function getDb(): Promise<IDBPDatabase<TtsCacheSchema> | null> {
  if (!isIndexedDbSupported()) {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<TtsCacheSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex(LAST_ACCESS_INDEX, 'lastAccess');
          store.createIndex(CREATED_AT_INDEX, 'createdAt');
        }
      },
    })
      .then((database) => database)
      .catch((error) => {
        console.warn('[tts-cache] Unable to open database', error);
        return null;
      });
  }
  return dbPromise;
}

function stableSerialize(descriptor: TtsDescriptor): string {
  const normalized = {
    text: descriptor.text ?? '',
    lang: descriptor.lang ?? '',
    voice: descriptor.voice ?? '',
    model: descriptor.model ?? '',
    rate: Number.isFinite(descriptor.rate) ? Number(descriptor.rate) : 1,
    pitch: Number.isFinite(descriptor.pitch) ? Number(descriptor.pitch) : 1,
    format: descriptor.format ?? DEFAULT_FORMAT,
    sampleRate: descriptor.sampleRate ?? null,
  };
  return JSON.stringify(normalized);
}

export function makeCacheKey(descriptor: TtsDescriptor): string {
  const payload = stableSerialize(descriptor);
  let hash = 0x811c9dc5n;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= BigInt(payload.charCodeAt(index));
    hash = (hash * 0x1000193n) & 0xffffffffffffffffn;
  }
  const hex = hash.toString(16).padStart(16, '0');
  return `v2-${hex.slice(0, 16)}`;
}

async function mirrorSummaryFromDb(): Promise<void> {
  const db = await getDb();
  if (!db) {
    const fallback = { ...DEFAULT_SUMMARY, updatedAt: Date.now() };
    persistSummary(fallback, { dispatch: false });
    return;
  }
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.store;
  let cursor = await store.openCursor();
  let entryCount = 0;
  let totalBytes = 0;
  while (cursor) {
    const value = cursor.value;
    entryCount += 1;
    const size = Number.isFinite(value?.bytes) ? value.bytes : value?.blob?.size || 0;
    totalBytes += size;
    cursor = await cursor.continue();
  }
  await tx.done;
  persistSummary({ entryCount, totalBytes, updatedAt: Date.now() });
}

function schedulePrune(): void {
  if (pruneScheduled) {
    return;
  }
  pruneScheduled = true;
  const schedule = (callback: () => void) => {
    if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
      (window as any).requestIdleCallback(callback, { timeout: 2000 });
    } else {
      setTimeout(callback, 0);
    }
  };
  schedule(() => {
    pruneScheduled = false;
    void pruneCache();
  });
}

async function pruneCache(): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }
  await ensureSummaryInitialized();
  let summary = getSummarySnapshot();
  const now = Date.now();
  let changed = false;
  const limits = getCacheLimits();

  const tx = db.transaction(STORE_NAME, 'readwrite');
  const index = tx.store.index(LAST_ACCESS_INDEX);
  let cursor = await index.openCursor();

  while (cursor) {
    const record = cursor.value as TtsClipRecord;
    const age = now - Math.max(record.lastAccess, record.createdAt);
    const expired = limits.ttlMs > 0 && age > limits.ttlMs;
    const overEntries = summary.entryCount > limits.maxEntries;
    const overBytes = limits.maxBytes > 0 && summary.totalBytes > limits.maxBytes;
    if (!(expired || overEntries || overBytes)) {
      break;
    }
    await cursor.delete();
    summary = {
      entryCount: Math.max(0, summary.entryCount - 1),
      totalBytes: Math.max(0, summary.totalBytes - (record.bytes || record.blob.size || 0)),
      updatedAt: summary.updatedAt,
    };
    changed = true;
    cursor = await cursor.continue();
  }

  await tx.done;

  if (changed) {
    summary.updatedAt = now;
    persistSummary(summary);
  } else {
    persistSummary({ ...summary, updatedAt: now }, { dispatch: false });
  }
}

function normalizeDescriptor(descriptor: TtsDescriptor): TtsDescriptor {
  return {
    text: descriptor.text ?? '',
    lang: descriptor.lang ?? '',
    voice: descriptor.voice ?? '',
    model: descriptor.model ?? '',
    flavor: descriptor.flavor?.trim() || 'generic.v1',
    rate: Number.isFinite(descriptor.rate) ? Number(descriptor.rate) : 1,
    pitch: Number.isFinite(descriptor.pitch) ? Number(descriptor.pitch) : 1,
    format: descriptor.format?.trim() || DEFAULT_FORMAT,
    sampleRate: descriptor.sampleRate,
  };
}

export async function getCachedAudioClip(descriptor: TtsDescriptor): Promise<Blob | null> {
  const normalized = normalizeDescriptor(descriptor);
  const key = makeCacheKey(normalized);
  const db = await getDb();
  if (!db) {
    return null;
  }
  await ensureSummaryInitialized();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.store;
  const record = (await store.get(key)) as TtsClipRecord | undefined;
  if (!record) {
    await tx.done;
    return null;
  }
  const limits = getCacheLimits();
  const now = Date.now();
  const age = now - Math.max(record.lastAccess, record.createdAt);
  if (limits.ttlMs > 0 && age > limits.ttlMs) {
    await store.delete(key);
    await tx.done;
    const current = getSummarySnapshot();
    const bytes = record.bytes || record.blob.size || 0;
    persistSummary({
      entryCount: Math.max(0, current.entryCount - 1),
      totalBytes: Math.max(0, current.totalBytes - bytes),
      updatedAt: now,
    });
    schedulePrune();
    return null;
  }
  record.lastAccess = now;
  await store.put(record);
  await tx.done;
  return record.blob;
}

export async function storeAudioClip(descriptor: TtsDescriptor, blob: Blob): Promise<void> {
  if (!blob) {
    return;
  }
  const normalized = normalizeDescriptor(descriptor);
  const key = makeCacheKey(normalized);
  const db = await getDb();
  if (!db) {
    return;
  }
  await ensureSummaryInitialized();
  const now = Date.now();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.store;
  const existing = (await store.get(key)) as TtsClipRecord | undefined;
  const duplicates: TtsClipRecord[] = [];
  const normalizedText = normalized.text.trim().toLowerCase();
  const normalizedLang = normalized.lang.trim().toLowerCase();
  const normalizedVoice = normalized.voice.trim().toLowerCase();
  const normalizedModel = normalized.model.trim().toLowerCase();
  const normalizedFlavor = normalized.flavor.trim().toLowerCase();
  const record: TtsClipRecord = {
    key,
    bytes: blob.size,
    blob,
    createdAt: existing?.createdAt ?? now,
    lastAccess: now,
    meta: {
      text: normalized.text,
      lang: normalized.lang,
      voice: normalized.voice,
      model: normalized.model,
      flavor: normalized.flavor,
      rate: normalized.rate,
      pitch: normalized.pitch,
      format: normalized.format,
      sampleRate: normalized.sampleRate,
    },
  };
  await store.put(record);

  let cursor = await store.openCursor();
  while (cursor) {
    const value = cursor.value as TtsClipRecord;
    if (value.key !== key) {
      const valueText = value.meta?.text?.trim().toLowerCase() || '';
      const valueLang = value.meta?.lang?.trim().toLowerCase() || '';
      const valueVoice = value.meta?.voice?.trim().toLowerCase() || '';
      const valueModel = value.meta?.model?.trim().toLowerCase() || '';
      const valueFlavor = value.meta?.flavor?.trim().toLowerCase() || '';
      if (
        valueText === normalizedText &&
        valueLang === normalizedLang &&
        valueVoice === normalizedVoice &&
        valueModel === normalizedModel &&
        valueFlavor === normalizedFlavor
      ) {
        duplicates.push(value);
        await cursor.delete();
      }
    }
    cursor = await cursor.continue();
  }

  await tx.done;

  updateSummaryAfterPut(existing, record, now);

  if (duplicates.length) {
    const updatedAt = Date.now();
    for (const duplicate of duplicates) {
      updateSummaryAfterDelete(duplicate, updatedAt);
    }
  }

  schedulePrune();
}

export async function deleteAudioClip(key: string): Promise<void> {
  if (!key) {
    return;
  }
  await deleteClipByKey(key);
}

export async function clearAudioCache(): Promise<void> {
  const db = await getDb();
  if (!db) {
    persistSummary({ ...DEFAULT_SUMMARY, updatedAt: Date.now() });
    return;
  }
  await ensureSummaryInitialized();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.clear();
  await tx.done;
  persistSummary({ ...DEFAULT_SUMMARY, updatedAt: Date.now() });
}

export type TtsClipMetadata = {
  key: string;
  bytes: number;
  createdAt: number;
  lastAccess: number;
  meta: TtsClipRecord['meta'];
  mimeType: string;
};

export async function deleteClipByKey(key: string): Promise<boolean> {
  if (!key) {
    return false;
  }
  const db = await getDb();
  if (!db) {
    return false;
  }
  await ensureSummaryInitialized();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.store;
  const existing = (await store.get(key)) as TtsClipRecord | undefined;
  if (!existing) {
    await tx.done;
    return false;
  }
  await store.delete(key);
  await tx.done;
  updateSummaryAfterDelete(existing, Date.now());
  return true;
}

export async function hasClip(key: string): Promise<boolean> {
  if (!key) {
    return false;
  }
  const db = await getDb();
  if (!db) {
    return false;
  }
  const tx = db.transaction(STORE_NAME, 'readonly');
  const result = await tx.store.getKey(key);
  await tx.done;
  return typeof result !== 'undefined' && result !== null;
}

export async function listClipMetadata(): Promise<TtsClipMetadata[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.store;
  const items: TtsClipMetadata[] = [];
  let cursor = await store.openCursor();
  while (cursor) {
    const value = cursor.value as TtsClipRecord;
    const mimeType = (value?.blob?.type || value?.meta?.format || DEFAULT_FORMAT).split(';')[0];
    items.push({
      key: value.key,
      bytes: getRecordBytes(value),
      createdAt: value.createdAt,
      lastAccess: value.lastAccess,
      meta: { ...value.meta },
      mimeType,
    });
    cursor = await cursor.continue();
  }
  await tx.done;
  return items;
}

export async function getClipBlobByKey(key: string): Promise<Blob | null> {
  if (!key) {
    return null;
  }
  const db = await getDb();
  if (!db) {
    return null;
  }
  await ensureSummaryInitialized();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.store;
  const record = (await store.get(key)) as TtsClipRecord | undefined;
  if (!record) {
    await tx.done;
    return null;
  }
  const limits = getCacheLimits();
  const now = Date.now();
  const age = now - Math.max(record.lastAccess, record.createdAt);
  if (limits.ttlMs > 0 && age > limits.ttlMs) {
    await store.delete(key);
    await tx.done;
    updateSummaryAfterDelete(record, now);
    schedulePrune();
    return null;
  }
  record.lastAccess = now;
  await store.put(record);
  await tx.done;
  return record.blob;
}

export async function importClipRecord(record: TtsClipRecord): Promise<boolean> {
  if (!record?.key || !record?.blob) {
    return false;
  }
  const db = await getDb();
  if (!db) {
    return false;
  }
  await ensureSummaryInitialized();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.store;
  const existing = (await store.get(record.key)) as TtsClipRecord | undefined;
  if (existing) {
    await tx.done;
    return false;
  }
  const now = Date.now();
  const createdAt = Number.isFinite(record.createdAt) ? Number(record.createdAt) : now;
  const lastAccess = Number.isFinite(record.lastAccess) ? Number(record.lastAccess) : now;
  const nextRecord: TtsClipRecord = {
    key: record.key,
    bytes: getRecordBytes(record) || record.blob.size,
    blob: record.blob,
    createdAt,
    lastAccess,
    meta: { ...record.meta, text: record.meta?.text ?? '' },
  };
  await store.put(nextRecord);
  await tx.done;
  updateSummaryAfterPut(existing, nextRecord, now);
  schedulePrune();
  return true;
}

export async function getAllClipRecords(): Promise<TtsClipRecord[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.store;
  const records: TtsClipRecord[] = [];
  let cursor = await store.openCursor();
  while (cursor) {
    const value = cursor.value as TtsClipRecord;
    records.push({
      key: value.key,
      bytes: getRecordBytes(value),
      blob: value.blob,
      createdAt: value.createdAt,
      lastAccess: value.lastAccess,
      meta: { ...value.meta },
    });
    cursor = await cursor.continue();
  }
  await tx.done;
  return records;
}

export async function runCachePrune(): Promise<void> {
  await pruneCache();
}

export async function getAudioCacheSummary(): Promise<{ entryCount: number; totalBytes: number }> {
  await ensureSummaryInitialized();
  const snapshot = getSummarySnapshot();
  return { entryCount: snapshot.entryCount, totalBytes: snapshot.totalBytes };
}

// Bootstrap mirror for debug consumers
if (isBrowser()) {
  void ensureSummaryInitialized();
  try {
    window.addEventListener(CACHE_LIMITS_EVENT, () => {
      schedulePrune();
    });
  } catch (error) {
    console.warn('[tts-cache] Unable to subscribe to cache limit updates', error);
  }
}
