import { strToU8, unzip, zip } from 'fflate';
import type { TtsClipRecord } from './ttsCache';
import { getAllClipRecords, importClipRecord, runCachePrune } from './ttsCache';

const CLIPS_DIRECTORY = 'clips/';
const MANIFEST_FILE = 'manifest.json';
const ZIP_MIME = 'application/zip';

export type CacheManifest = {
  version: 1;
  createdAt: number;
  entries: Array<{
    key: string;
    bytes: number;
    meta: TtsClipRecord['meta'];
    file: string;
  }>;
};

export type CacheImportProgress = {
  total: number;
  processed: number;
  added: number;
  skipped: number;
  bytes: number;
  currentKey?: string;
};

export type CacheImportOptions = {
  onProgress?: (progress: CacheImportProgress) => void;
};

const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.mpeg': 'audio/mpeg',
  '.wav': 'audio/wav',
};

const DEFAULT_AUDIO_MIME = 'audio/mpeg';

function normalizeMime(input: string | undefined | null): string {
  if (!input) return DEFAULT_AUDIO_MIME;
  return input.split(';')[0]?.trim().toLowerCase() || DEFAULT_AUDIO_MIME;
}

function guessExtension(mime: string | undefined): string {
  const normalized = normalizeMime(mime);
  const entry = Object.entries(SUPPORTED_EXTENSIONS).find(([, value]) => value === normalized);
  return entry ? entry[0] : '.bin';
}

function extensionFromPath(path: string): string {
  const index = path.lastIndexOf('.');
  if (index === -1) return '';
  return path.slice(index).toLowerCase();
}

function ensureSafePath(path: string): void {
  if (!path.startsWith(CLIPS_DIRECTORY)) {
    throw new Error('Fișierul din arhivă este plasat într-un director nepermis.');
  }
  if (path.includes('..')) {
    throw new Error('Arhiva conține un fișier cu cale relativă nesigură.');
  }
}

function createBlob(data: Uint8Array, mimeType: string): Blob {
  if (typeof Blob === 'undefined') {
    throw new Error('Importul cache-ului audio necesită suport pentru Blob în browser.');
  }
  return new Blob([data], { type: mimeType || DEFAULT_AUDIO_MIME });
}

function buildManifestEntry(record: TtsClipRecord, file: string, bytes: number) {
  return {
    key: record.key,
    bytes,
    meta: { ...record.meta, text: record.meta?.text ?? '' },
    file,
  } satisfies CacheManifest['entries'][number];
}

function emitProgress(options: CacheImportOptions | undefined, progress: CacheImportProgress): void {
  options?.onProgress?.({ ...progress });
}

function expectManifest(data: unknown): CacheManifest {
  if (!data || typeof data !== 'object') {
    throw new Error('Manifestul cache-ului audio nu a putut fi citit.');
  }
  const manifest = data as Partial<CacheManifest>;
  if (manifest.version !== 1) {
    throw new Error('Versiunea manifestului audio cache nu este suportată.');
  }
  if (!Array.isArray(manifest.entries)) {
    throw new Error('Manifestul audio cache este invalid.');
  }
  if (!Number.isFinite(manifest.createdAt)) {
    throw new Error('Manifestul audio cache nu include data creării.');
  }
  return manifest as CacheManifest;
}

function parseJson(buffer: Uint8Array): unknown {
  try {
    const decoder = new TextDecoder('utf-8');
    return JSON.parse(decoder.decode(buffer));
  } catch (error) {
    console.error('[audio-cache] Unable to parse manifest JSON', error);
    throw new Error('Manifestul audio cache este corupt sau invalid.');
  }
}

function validateEntry(entry: CacheManifest['entries'][number], files: Record<string, Uint8Array>): void {
  if (!entry?.key || typeof entry.key !== 'string') {
    throw new Error('Manifestul audio cache conține o intrare fără cheie.');
  }
  if (entry.key.includes('/') || entry.key.includes('\\')) {
    throw new Error(`Cheia clipului ${entry.key} conține caractere invalide.`);
  }
  if (!entry.file || typeof entry.file !== 'string') {
    throw new Error(`Intrarea ${entry.key} nu are fișier asociat.`);
  }
  ensureSafePath(entry.file);
  const ext = extensionFromPath(entry.file);
  const expectedMime = SUPPORTED_EXTENSIONS[ext];
  if (!expectedMime) {
    throw new Error(`Intrarea ${entry.key} folosește o extensie audio nesuportată (${ext || 'fără extensie'}).`);
  }
  const expectedFile = `${CLIPS_DIRECTORY}${entry.key}${ext}`;
  if (entry.file !== expectedFile) {
    throw new Error(`Intrarea ${entry.key} are o cale de fișier care nu corespunde cheii.`);
  }
  const metaFormat = normalizeMime(entry.meta?.format);
  if (metaFormat !== expectedMime) {
    throw new Error(`Intrarea ${entry.key} are un format audio diferit față de extensia fișierului.`);
  }
  const fileData = files[entry.file];
  if (!fileData) {
    throw new Error(`Fișierul audio pentru ${entry.key} lipsește din arhivă.`);
  }
  if (!Number.isFinite(entry.bytes) || entry.bytes <= 0) {
    throw new Error(`Intrarea ${entry.key} are o dimensiune invalidă în manifest.`);
  }
  if (fileData.byteLength !== entry.bytes) {
    throw new Error(`Dimensiunea clipului ${entry.key} nu corespunde cu manifestul.`);
  }
  if (!entry.meta || typeof entry.meta !== 'object') {
    throw new Error(`Intrarea ${entry.key} are metadate lipsă.`);
  }
  if (typeof entry.meta.text !== 'string') {
    throw new Error(`Intrarea ${entry.key} are textul lipsă.`);
  }
}

export async function exportAudioCacheZip(): Promise<Blob> {
  const records = await getAllClipRecords();
  const files: Record<string, Uint8Array> = {};
  const manifest: CacheManifest = {
    version: 1,
    createdAt: Date.now(),
    entries: [],
  };

  for (const record of records) {
    const mime = normalizeMime(record.meta?.format || record.blob.type);
    const extension = guessExtension(mime);
    const filePath = `${CLIPS_DIRECTORY}${record.key}${extension}`;
    const buffer = new Uint8Array(await record.blob.arrayBuffer());
    manifest.entries.push(buildManifestEntry(record, filePath, buffer.byteLength));
    files[filePath] = buffer;
  }

  files[MANIFEST_FILE] = strToU8(JSON.stringify(manifest, null, 2));

  return new Promise<Blob>((resolve, reject) => {
    zip(files, { level: 6 }, (error, zipped) => {
      Object.keys(files).forEach((key) => delete files[key]);
      if (error) {
        reject(new Error('Nu am putut genera arhiva cache-ului audio.'));
        return;
      }
      resolve(new Blob([zipped], { type: ZIP_MIME }));
    });
  });
}

export async function importAudioCacheZip(
  zipBlob: Blob,
  options?: CacheImportOptions,
): Promise<{ added: number; skipped: number; bytes: number }> {
  if (!(zipBlob instanceof Blob)) {
    throw new Error('Fișierul furnizat pentru import nu este valid.');
  }
  const arrayBuffer = await zipBlob.arrayBuffer();
  let files: Record<string, Uint8Array> = await new Promise((resolve, reject) => {
    unzip(new Uint8Array(arrayBuffer), (error, data) => {
      if (error) {
        reject(new Error('Arhiva audio cache este coruptă sau nu poate fi deschisă.'));
        return;
      }
      resolve(data);
    });
  });

  try {
    const manifestBuffer = files[MANIFEST_FILE];
    if (!manifestBuffer) {
      throw new Error('Arhiva audio cache nu conține manifest.json.');
    }
    const manifest = expectManifest(parseJson(manifestBuffer));
    emitProgress(options, { total: manifest.entries.length, processed: 0, added: 0, skipped: 0, bytes: 0 });

    let processed = 0;
    let added = 0;
    let skipped = 0;
    let totalBytes = 0;

    for (const entry of manifest.entries) {
      processed += 1;
      validateEntry(entry, files);
      const fileData = files[entry.file];
      const mimeType = normalizeMime(entry.meta?.format);
      const blob = createBlob(fileData, mimeType);
      const record: TtsClipRecord = {
        key: entry.key,
        bytes: entry.bytes,
        blob,
        createdAt: manifest.createdAt,
        lastAccess: manifest.createdAt,
        meta: {
          text: entry.meta.text ?? '',
          lang: entry.meta.lang ?? '',
          voice: entry.meta.voice ?? '',
          model: entry.meta.model ?? '',
          rate: entry.meta.rate ?? 1,
          pitch: entry.meta.pitch ?? 1,
          format: entry.meta.format ?? mimeType,
          sampleRate: entry.meta.sampleRate,
        },
      };
      const wasAdded = await importClipRecord(record);
      if (wasAdded) {
        added += 1;
        totalBytes += entry.bytes;
        await runCachePrune();
      } else {
        skipped += 1;
      }
      emitProgress(options, { total: manifest.entries.length, processed, added, skipped, bytes: totalBytes, currentKey: entry.key });
      delete files[entry.file];
    }

    emitProgress(options, {
      total: manifest.entries.length,
      processed,
      added,
      skipped,
      bytes: totalBytes,
    });

    return { added, skipped, bytes: totalBytes };
  } finally {
    Object.keys(files).forEach((key) => delete files[key]);
    files = {};
  }
}
