import { requireApiBaseUrl } from '../lib/api/baseUrl';
import { supportsTtsStream } from '../services/aiFeatures';

export type TtsSynthesizeOptions = {
  voiceId?: string;
  speakingRate?: number;
  pitch?: number;
  language?: string;
  signal?: AbortSignal;
};

export type TtsSayRequest = {
  text: string;
  voice_id?: string;
  speaking_rate?: number;
  pitch?: number;
  language?: string;
};

export type TtsSayResponse = {
  ok?: boolean;
  content_type?: string | null;
  audio_b64?: string | null;
  error?: string | null;
  message?: string | null;
  note?: string | null;
  code?: string | null;
  error_code?: string | null;
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
const STREAM_ENDPOINT = '/v1/ai/tts/say/stream';

async function requestJsonEndpoint(
  baseUrl: string,
  payload: TtsSayRequest,
  signal?: AbortSignal,
): Promise<Blob> {
  const url = `${baseUrl}${JSON_ENDPOINT}`;
  const body: TtsSayRequest = { text: payload.text };
  if (payload.voice_id) {
    body.voice_id = payload.voice_id;
  }
  if (typeof payload.speaking_rate === 'number') {
    body.speaking_rate = payload.speaking_rate;
  }
  if (typeof payload.pitch === 'number') {
    body.pitch = payload.pitch;
  }
  if (payload.language) {
    body.language = payload.language;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      mode: 'cors',
      credentials: 'omit',
      signal,
    });
  } catch (error) {
    throw new JsonEndpointNetworkError(error);
  }

  const contentType = response.headers.get('content-type') || '';
  if (response.ok && contentType.startsWith('audio/')) {
    return response.blob();
  }

  let json: TtsSayResponse | null = null;
  if (contentType.includes('application/json')) {
    json = await response.json().catch(() => null);
  }

  if (response.status === 501 || response.status === 503) {
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

type StreamPayload = {
  text: string;
  voice?: string;
  speaking_rate?: number;
  pitch?: number;
  language?: string;
  audio_mime_type: string;
};

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

  const baseUrl = requireApiBaseUrl();
  const payload: TtsSayRequest = {
    text: normalized,
    voice_id: opts.voiceId?.trim() || undefined,
    speaking_rate: typeof opts.speakingRate === 'number' ? opts.speakingRate : undefined,
    pitch: typeof opts.pitch === 'number' ? opts.pitch : undefined,
    language: opts.language?.trim() || undefined,
  };

  try {
    return await requestJsonEndpoint(baseUrl, payload, opts.signal);
  } catch (error) {
    if (error instanceof JsonEndpointUnavailableError) {
      if (!supportsTtsStream()) {
        const message =
          (error.body?.message && String(error.body.message)) ||
          (error.body?.error && String(error.body.error)) ||
          'Text-to-speech is temporarily unavailable. Please try again later.';
        throw new Error(message);
      }

      try {
        return await requestStreamEndpoint(baseUrl, {
          text: normalized,
          voice: payload.voice_id,
          speaking_rate: payload.speaking_rate,
          pitch: payload.pitch,
          language: payload.language,
          audio_mime_type: 'audio/mpeg',
        }, opts.signal);
      } catch (streamError) {
        const friendly = new Error('Unable to synthesize speech right now. Please try again later.');
        (friendly as any).cause = streamError;
        throw friendly;
      }
    }

    if (error instanceof JsonEndpointNetworkError) {
      if (!supportsTtsStream()) {
        throw new Error('Unable to reach the text-to-speech service. Please check your connection and try again.');
      }
      try {
        return await requestStreamEndpoint(baseUrl, {
          text: normalized,
          voice: payload.voice_id,
          speaking_rate: payload.speaking_rate,
          pitch: payload.pitch,
          language: payload.language,
          audio_mime_type: 'audio/mpeg',
        }, opts.signal);
      } catch (streamError) {
        const friendly = new Error('Unable to synthesize speech right now. Please try again later.');
        (friendly as any).cause = streamError;
        throw friendly;
      }
    }

    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}
