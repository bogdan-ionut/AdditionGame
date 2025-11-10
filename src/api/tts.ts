import { GoogleGenAI, Modality } from '@google/genai';
import { getCachedAudioClip, storeAudioClip } from '../lib/audio/cache';
import type { AudioCacheDescriptor } from '../lib/audio/cache';
import { getGeminiApiKey, hasGeminiApiKey } from '../lib/gemini/apiKey';

export type TtsSynthesizeOptions = {
  voiceId?: string;
  speakingRate?: number;
  pitch?: number;
  language?: string;
  model?: string | null;
  preferredMime?: string | null;
  mime?: string | null;
  signal?: AbortSignal;
  kind?: string | null;
};

const DEFAULT_MODEL = 'gemini-2.5-flash-preview-tts';
const DEFAULT_MIME = 'audio/mpeg';

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

  return Object.keys(speechConfig).length > 0 ? speechConfig : undefined;
};

export async function synthesize(text: string, opts: TtsSynthesizeOptions = {}): Promise<Blob> {
  const normalized = text?.trim();
  if (!normalized) {
    throw new Error('Cannot synthesize empty text.');
  }

  const targetModel = opts.model?.trim() || DEFAULT_MODEL;
  const cacheDescriptor: AudioCacheDescriptor = {
    text: normalized,
    voiceId: typeof opts.voiceId === 'string' ? opts.voiceId.trim() : null,
    speakingRate: typeof opts.speakingRate === 'number' ? opts.speakingRate : null,
    pitch: typeof opts.pitch === 'number' ? opts.pitch : null,
    language: typeof opts.language === 'string' ? opts.language.trim() : null,
    model: targetModel,
    type: typeof opts.kind === 'string' ? opts.kind.trim() : null,
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
    const client = getClient();
    const model = targetModel;
    const speechConfig = buildSpeechConfig(opts);
    const responseMimeType = opts.mime?.trim() || opts.preferredMime?.trim() || DEFAULT_MIME;

    const response = await client.models.generateContent({
      model,
      contents: [{ parts: [{ text: normalized }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        ...(speechConfig ? { speechConfig } : {}),
      },
      safetySettings: [],
      generationConfig: {
        responseMimeType,
      },
      signal: opts.signal,
    });

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
    console.error('[Gemini TTS] Failed to generate speech.', error);
    throw new Error('tts_unavailable');
  }
}
