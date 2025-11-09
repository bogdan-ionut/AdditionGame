export type TtsAudioClip = {
  base64: string;
  mimeType: string;
};

export const DEFAULT_AUDIO_MIME = 'audio/mpeg';

const BASE64_PATTERN = /[^A-Z0-9+/=]/i;

export function extractAudioFromResponse(payload: any): TtsAudioClip | null {
  if (!payload) return null;

  const resolveCandidate = (candidate: any): TtsAudioClip | null => {
    if (!candidate) return null;
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (!trimmed || BASE64_PATTERN.test(trimmed)) {
        return null;
      }
      return { base64: trimmed, mimeType: DEFAULT_AUDIO_MIME };
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const clip = resolveCandidate(item);
        if (clip) return clip;
      }
      return null;
    }
    if (typeof candidate === 'object') {
      const base64 =
        typeof candidate.base64 === 'string'
          ? candidate.base64
          : typeof candidate.data === 'string'
            ? candidate.data
            : typeof candidate.base64_data === 'string'
              ? candidate.base64_data
              : typeof candidate.audioContent === 'string'
                ? candidate.audioContent
                : typeof candidate.audio_content === 'string'
                  ? candidate.audio_content
                  : typeof candidate.content === 'string'
                    ? candidate.content
                    : null;
      if (base64) {
        const mimeType =
          typeof candidate.mimeType === 'string'
            ? candidate.mimeType
            : typeof candidate.mime_type === 'string'
              ? candidate.mime_type
              : typeof candidate.contentType === 'string'
                ? candidate.contentType
                : typeof candidate.content_type === 'string'
                  ? candidate.content_type
                  : DEFAULT_AUDIO_MIME;
        return { base64: base64.trim(), mimeType };
      }
      if (candidate.payload) return resolveCandidate(candidate.payload);
      if (candidate.audio) return resolveCandidate(candidate.audio);
      if (candidate.clip) return resolveCandidate(candidate.clip);
    }
    return null;
  };

  const direct = resolveCandidate(payload);
  if (direct) return direct;

  if (typeof payload.audio === 'string' || Array.isArray(payload.audio) || typeof payload.audio === 'object') {
    const clip = resolveCandidate(payload.audio);
    if (clip) return clip;
  }

  if (typeof payload.output === 'object') {
    const clip = resolveCandidate(payload.output);
    if (clip) return clip;
  }

  if (typeof payload.result === 'object') {
    const clip = resolveCandidate(payload.result);
    if (clip) return clip;
  }

  if (typeof payload.data === 'object') {
    const clip = resolveCandidate(payload.data);
    if (clip) return clip;
  }

  if (typeof payload.response === 'object') {
    const clip = resolveCandidate(payload.response);
    if (clip) return clip;
  }

  if (typeof payload.audioBase64 === 'string') {
    return { base64: payload.audioBase64.trim(), mimeType: DEFAULT_AUDIO_MIME };
  }

  return null;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binary = window.atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  const globalScope = typeof globalThis !== 'undefined' ? (globalThis as unknown as Record<string, any>) : {};

  if (globalScope.Buffer?.from) {
    const buffer = globalScope.Buffer.from(base64, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  if (typeof globalScope.atob === 'function') {
    const binary = globalScope.atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  throw new Error('Base64 decoding not supported in this environment.');
}

export function createObjectUrlFromBase64(base64: string, mimeType = DEFAULT_AUDIO_MIME): {
  objectUrl: string;
  revoke(): void;
} {
  const bytes = base64ToUint8Array(base64);
  const blob = new Blob([bytes], { type: mimeType || DEFAULT_AUDIO_MIME });
  const objectUrl = URL.createObjectURL(blob);
  return {
    objectUrl,
    revoke() {
      URL.revokeObjectURL(objectUrl);
    },
  };
}

export function createObjectUrlFromBuffer(buffer: ArrayBuffer, mimeType = DEFAULT_AUDIO_MIME): {
  objectUrl: string;
  revoke(): void;
} {
  const blob = new Blob([buffer], { type: mimeType || DEFAULT_AUDIO_MIME });
  const objectUrl = URL.createObjectURL(blob);
  return {
    objectUrl,
    revoke() {
      URL.revokeObjectURL(objectUrl);
    },
  };
}

export async function playClipFromBase64(
  base64: string,
  options: { mimeType?: string; volume?: number } = {},
): Promise<HTMLAudioElement> {
  const { objectUrl, revoke } = createObjectUrlFromBase64(base64, options.mimeType);
  const audio = new Audio(objectUrl);
  audio.volume = options.volume != null ? Math.min(1, Math.max(0, options.volume)) : 1;
  try {
    await audio.play();
  } catch (error) {
    revoke();
    throw error;
  }
  const cleanup = () => {
    audio.pause();
    audio.src = '';
    revoke();
  };
  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('error', cleanup, { once: true });
  return audio;
}
