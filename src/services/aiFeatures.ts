export type AiFeatureFlags = {
  ttsStream: boolean;
};

const defaultFlags: AiFeatureFlags = { ttsStream: false };

let cachedFlags: AiFeatureFlags = { ...defaultFlags };

const readBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (['1', 'true', 'yes', 'ok', 'enabled', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
};

const extractFeatures = (payload: unknown): Partial<AiFeatureFlags> => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const source = payload as Record<string, unknown>;
  const featuresCandidate = source.features && typeof source.features === 'object'
    ? (source.features as Record<string, unknown>)
    : source;

  const ttsStream =
    readBoolean(featuresCandidate.tts_stream) ??
    readBoolean(featuresCandidate.ttsStream) ??
    readBoolean((featuresCandidate.tts as Record<string, unknown> | undefined)?.stream);

  return {
    ttsStream: ttsStream ?? cachedFlags.ttsStream,
  };
};

export function updateAiFeaturesFromStatus(status: unknown): void {
  const next = { ...cachedFlags, ...extractFeatures(status) };
  if (next.ttsStream !== cachedFlags.ttsStream) {
    cachedFlags = next;
  }
}

export function getAiFeatureFlags(): AiFeatureFlags {
  return { ...cachedFlags };
}

export function supportsTtsStream(): boolean {
  return cachedFlags.ttsStream;
}

export function resetAiFeatureFlags(): void {
  cachedFlags = { ...defaultFlags };
}
