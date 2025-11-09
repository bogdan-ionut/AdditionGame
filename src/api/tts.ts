import { requireApiBaseUrl } from '../lib/api/baseUrl';
import { showToast } from '../lib/ui/toast';

export type TtsSynthesizeOptions = {
  voiceId?: string;
  speakingRate?: number;
  pitch?: number;
  language?: string;
  model?: string | null;
  preferredMime?: string | null;
  mime?: string | null;
  signal?: AbortSignal;
};

export type TtsSayRequest = {
  text: string;
  voice?: string;
  model?: string;
  mime: string;
};

export type TtsSayResponse = {
  ok?: boolean;
  mimeType?: string | null;
  mime_type?: string | null;
  content_type?: string | null;
  audioB64?: string | null;
  audio_b64?: string | null;
  error?: string | null;
  message?: string | null;
  note?: string | null;
  code?: string | null;
  detail?: string | null;
  hint?: string | null;
  [key: string]: unknown;
};

class JsonEndpointUnavailableError extends Error {
  status: number;
  body: TtsSayResponse | null;

  constructor(status: number, body: TtsSayResponse | null) {
    super('tts_json_endpoint_unavailable');
    this.name = 'JsonEndpointUnavailableError';
    this.status = status;
    this.body = body;
  }
}

class JsonEndpointNetworkError extends Error {
  cause: unknown;

  constructor(cause: unknown) {
    super('tts_json_endpoint_network_error');
    this.name = 'JsonEndpointNetworkError';
    this.cause = cause;
  }
}

function decodeBase64(value: string): Uint8Array {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(value);
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
}

const JSON_ENDPOINT = '/v1/ai/tts/say';
const DEFAULT_MIME = 'audio/ogg;codecs=opus';
const CONFIG_TOAST_MESSAGE =
  'TTS temporarily unavailable (server config). Refresh later or change voice.';

let lastConfigToastAt = 0;
let lastTts503LogAt = 0;

const CONFIG_HINT_KEYS = ['message', 'error', 'note', 'detail', 'hint', 'code'];

function collectCandidateStrings(candidate: unknown): string[] {
  if (!candidate || typeof candidate !== 'object') {
    return [];
  }
  const bag: string[] = [];
  for (const key of CONFIG_HINT_KEYS) {
    const value = (candidate as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) {
      bag.push(value.trim());
    }
  }
  return bag;
}

function hasMimeMismatchHint(candidate: unknown): boolean {
  const strings = collectCandidateStrings(candidate);
  if (!strings.length) {
    return false;
  }
  return strings.some((entry) => {
    const lower = entry.toLowerCase();
    return lower.includes('mime') || lower.includes('tool');
  });
}

function maybeNotifyConfigIssue(candidate: unknown): boolean {
  if (!hasMimeMismatchHint(candidate)) {
    return false;
  }
  const now = Date.now();
  if (now - lastConfigToastAt > 3000) {
    showToast({ level: 'warning', message: CONFIG_TOAST_MESSAGE });
    lastConfigToastAt = now;
  }
  return true;
}

function logTtsFailure(status: number, message: string) {
  if (status === 503) {
    const now = Date.now();
    if (now - lastTts503LogAt > 3000) {
      console.warn(`[MathGalaxyAPI] TTS request failed (${status}): ${message}`);
      lastTts503LogAt = now;
    }
    return;
  }
  console.error(`[MathGalaxyAPI] TTS request failed (${status}): ${message}`);
}

function resolveMimeType(payload: TtsSayResponse | null, fallback: string): string {
  const candidate =
    (payload?.mimeType && payload.mimeType.trim()) ||
    (payload?.mime_type && payload.mime_type.trim()) ||
    (payload?.content_type && payload.content_type.trim()) ||
    '';
  return candidate || fallback;
}

function extractAudioBase64(payload: TtsSayResponse | null): string | null {
  if (!payload) return null;
  const candidates = [payload.audioB64, payload.audio_b64] as (string | null | undefined)[];
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) {
      return item.trim();
    }
  }
  return null;
}

function extractErrorMessage(payload: TtsSayResponse | null, fallback: string): string {
  if (!payload) {
    return fallback;
  }
  const strings = collectCandidateStrings(payload);
  if (strings.length) {
    return strings[0];
  }
  return fallback;
}

async function requestJsonEndpoint(
  baseUrl: string,
  payload: TtsSayRequest,
  signal?: AbortSignal,
): Promise<Blob> {
  const url = `${baseUrl}${JSON_ENDPOINT}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      mode: 'cors',
      credentials: 'omit',
      signal,
    });
  } catch (error) {
    throw new JsonEndpointNetworkError(error);
  }

  const contentType = response.headers.get('content-type') || '';
  let json: TtsSayResponse | null = null;
  const isJson = contentType.includes('application/json');
  if (isJson) {
    json = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const detail = extractErrorMessage(json, `HTTP ${response.status}`);
    if (response.status === 503 || response.status === 501) {
      maybeNotifyConfigIssue(json);
      logTtsFailure(response.status, detail);
      throw new JsonEndpointUnavailableError(response.status, json);
    }
    logTtsFailure(response.status, detail);
    const error = new Error(`TTS request failed with status ${response.status}`);
    (error as any).cause = json ?? undefined;
    throw error;
  }

  if (!isJson) {
    if (contentType.startsWith('audio/')) {
      return response.blob();
    }
    const fallbackMime = payload.mime || DEFAULT_MIME;
    const buffer = await response.arrayBuffer();
    return new Blob([buffer], { type: fallbackMime });
  }

  if (!json) {
    throw new Error('TTS response did not include JSON data.');
  }

  const audioBase64 = extractAudioBase64(json);
  if (!audioBase64) {
    throw new Error('TTS response did not include audio data.');
  }

  const bytes = decodeBase64(audioBase64);
  const mimeType = resolveMimeType(json, payload.mime || DEFAULT_MIME);
  return new Blob([bytes], { type: mimeType });
}

export async function synthesize(text: string, opts: TtsSynthesizeOptions = {}): Promise<Blob> {
  const normalized = text?.trim();
  if (!normalized) {
    throw new Error('Cannot synthesize empty text.');
  }

  const baseUrl = requireApiBaseUrl();
  const preferredMime =
    opts.preferredMime?.trim() || opts.mime?.trim() || DEFAULT_MIME;
  const model = typeof opts.model === 'string' ? opts.model.trim() : undefined;
  const payload: TtsSayRequest = {
    text: normalized,
    voice: opts.voiceId?.trim() || undefined,
    model: model || undefined,
    mime: preferredMime || DEFAULT_MIME,
  };

  try {
    return await requestJsonEndpoint(baseUrl, payload, opts.signal);
  } catch (error) {
    if (error instanceof JsonEndpointUnavailableError) {
      const friendly = new Error('tts_unavailable');
      (friendly as any).cause = error.body ?? undefined;
      throw friendly;
    }

    if (error instanceof JsonEndpointNetworkError) {
      const friendly = new Error('tts_unavailable');
      (friendly as any).cause = error.cause ?? undefined;
      throw friendly;
    }

    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}
