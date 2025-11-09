import { requireApiBase } from '../services/api';

export type TtsSynthesizeOptions = {
  voiceId?: string;
  speakingRate?: number;
  pitch?: number;
  language?: string;
  languageCode?: string;
  signal?: AbortSignal;
};

type JsonTtsResponse = {
  ok?: boolean;
  content_type?: string | null;
  audio_b64?: string | null;
  error?: string | null;
  message?: string | null;
  code?: string | null;
  error_code?: string | null;
  fallback_webspeech?: boolean;
  [key: string]: unknown;
};

class JsonEndpointUnavailableError extends Error {
  status: number;
  body: JsonTtsResponse | null;

  constructor(status: number, body: JsonTtsResponse | null) {
    super('tts_json_endpoint_unavailable');
    this.name = 'JsonEndpointUnavailableError';
    this.status = status;
    this.body = body;
  }
}

class ExtraFieldsRejectedError extends Error {
  body: JsonTtsResponse | null;

  constructor(body: JsonTtsResponse | null) {
    super('tts_extra_fields_rejected');
    this.name = 'ExtraFieldsRejectedError';
    this.body = body;
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

function includesExtraForbidden(body: JsonTtsResponse | null): boolean {
  if (!body) return false;
  try {
    return JSON.stringify(body).includes('extra_forbidden');
  } catch {
    const values = [body.error, body.message, body.code, body.error_code];
    return values.some((value) => typeof value === 'string' && value.includes('extra_forbidden'));
  }
}

function sanitizeLanguageCode(language?: string | null): string | undefined {
  if (!language) return undefined;
  const trimmed = language.trim();
  return trimmed ? trimmed : undefined;
}

type JsonPayload = {
  text: string;
  voice_id?: string;
  speaking_rate?: number;
  pitch?: number;
  language_code?: string;
};

type StreamPayload = {
  text: string;
  voice?: string;
  speaking_rate?: number;
  pitch?: number;
  language_code?: string;
  audio_mime_type: string;
};

const JSON_ENDPOINT = '/v1/ai/tts/say';
const STREAM_ENDPOINT = '/v1/ai/tts/say/stream';

async function requestJsonEndpoint(
  baseUrl: string,
  payload: JsonPayload,
  signal?: AbortSignal,
  allowLanguageCode = true,
): Promise<Blob> {
  const bodyPayload: JsonPayload = { text: payload.text };
  if (payload.voice_id) bodyPayload.voice_id = payload.voice_id;
  if (typeof payload.speaking_rate === 'number') bodyPayload.speaking_rate = payload.speaking_rate;
  if (typeof payload.pitch === 'number') bodyPayload.pitch = payload.pitch;
  if (allowLanguageCode && payload.language_code) bodyPayload.language_code = payload.language_code;

  const response = await fetch(`${baseUrl}${JSON_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(bodyPayload),
    mode: 'cors',
    credentials: 'omit',
    signal,
  });

  const contentType = response.headers.get('content-type') || '';
  if (response.ok && contentType.startsWith('audio/')) {
    return response.blob();
  }

  let json: JsonTtsResponse | null = null;
  if (contentType.includes('application/json')) {
    json = await response.json().catch(() => null);
  }

  if (response.status === 422 && includesExtraForbidden(json)) {
    throw new ExtraFieldsRejectedError(json);
  }

  if (response.status === 501 && json?.fallback_webspeech) {
    throw new JsonEndpointUnavailableError(response.status, json);
  }

  if (response.status === 503) {
    throw new JsonEndpointUnavailableError(response.status, json);
  }

  if (!response.ok) {
    const message =
      (json?.error && String(json.error)) ||
      (json?.message && String(json.message)) ||
      `TTS request failed with status ${response.status}`;
    const error = new Error(message);
    (error as any).cause = json ?? undefined;
    throw error;
  }

  if (!json || typeof json.audio_b64 !== 'string' || !json.audio_b64) {
    throw new Error('TTS response did not include audio data.');
  }

  const bytes = decodeBase64(json.audio_b64);
  const mimeType = json.content_type && json.content_type.trim() ? json.content_type.trim() : 'audio/mpeg';
  return new Blob([bytes], { type: mimeType });
}

async function requestStreamEndpoint(
  baseUrl: string,
  payload: StreamPayload,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(`${baseUrl}${STREAM_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg,application/json',
    },
    body: JSON.stringify(payload),
    mode: 'cors',
    credentials: 'omit',
    signal,
  });

  if (!response.ok) {
    const message = `TTS stream request failed with status ${response.status}`;
    const error = new Error(message);
    try {
      const responseType = response.headers.get('content-type') || '';
      if (responseType.includes('application/json')) {
        const data = await response.json();
        (error as any).cause = data;
      }
    } catch {
      // ignore parsing failures
    }
    throw error;
  }

  return response.blob();
}

export async function synthesize(text: string, opts: TtsSynthesizeOptions = {}): Promise<Blob> {
  const normalized = text?.trim();
  if (!normalized) {
    throw new Error('Cannot synthesize empty text.');
  }

  const baseUrl = requireApiBase();
  const languageCode = sanitizeLanguageCode(opts.languageCode ?? opts.language ?? undefined);

  const jsonPayload: JsonPayload = {
    text: normalized,
    voice_id: opts.voiceId?.trim() || undefined,
    speaking_rate: typeof opts.speakingRate === 'number' ? opts.speakingRate : undefined,
    pitch: typeof opts.pitch === 'number' ? opts.pitch : undefined,
    language_code: languageCode,
  };

  let allowLanguageCode = Boolean(jsonPayload.language_code);
  let hasRetriedWithoutLanguage = false;

  try {
    while (true) {
      try {
        return await requestJsonEndpoint(baseUrl, jsonPayload, opts.signal, allowLanguageCode);
      } catch (error) {
        if (error instanceof ExtraFieldsRejectedError && allowLanguageCode && !hasRetriedWithoutLanguage) {
          allowLanguageCode = false;
          hasRetriedWithoutLanguage = true;
          continue;
        }
        if (error instanceof JsonEndpointUnavailableError) {
          const streamPayload: StreamPayload = {
            text: normalized,
            voice: jsonPayload.voice_id,
            speaking_rate: jsonPayload.speaking_rate,
            pitch: jsonPayload.pitch,
            language_code: allowLanguageCode ? jsonPayload.language_code : undefined,
            audio_mime_type: 'audio/mpeg',
          };

          try {
            return await requestStreamEndpoint(baseUrl, streamPayload, opts.signal);
          } catch (streamError) {
            const friendlyError = new Error('Unable to synthesize speech right now. Please try again later.');
            (friendlyError as any).cause = streamError;
            throw friendlyError;
          }
        }
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}
