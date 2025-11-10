import { GoogleGenAI, Modality } from '@google/genai';
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

const resolveMime = (inlineData: { mimeType?: string | null } | null | undefined, fallback: string) => {
  const candidate = inlineData?.mimeType?.trim();
  if (candidate) {
    return candidate;
  }
  if (fallback && fallback.trim()) {
    return fallback.trim();
  }
  return DEFAULT_MIME;
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

  if (!hasGeminiApiKey()) {
    throw new Error('tts_unavailable');
  }

  try {
    const client = getClient();
    const model = opts.model?.trim() || DEFAULT_MODEL;
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
    const mimeType = resolveMime(inlineData, responseMimeType);
    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    console.error('[Gemini TTS] Failed to generate speech.', error);
    throw new Error('tts_unavailable');
  }
}
