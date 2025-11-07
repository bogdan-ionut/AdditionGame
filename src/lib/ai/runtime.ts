import mathGalaxyClient, { MathGalaxyApiError, isMathGalaxyConfigured } from '../../services/mathGalaxyClient';

export const LS_AI_CONFIG = 'ai.config.v1';

export type AiConfigV1 = {
  planningModel: string | null;
  spriteModel: string | null;
  audioModel: string | null;
  aiAllowed: boolean;
  savedAt: string;
};

const createDefaultConfig = (): AiConfigV1 => ({
  planningModel: null,
  spriteModel: null,
  audioModel: null,
  aiAllowed: true,
  savedAt: new Date().toISOString(),
});

export function loadAiConfig(): AiConfigV1 {
  if (typeof window === 'undefined') {
    return createDefaultConfig();
  }

  try {
    const raw = window.localStorage.getItem(LS_AI_CONFIG);
    if (!raw) {
      return createDefaultConfig();
    }

    const parsed = JSON.parse(raw) ?? {};
    return {
      planningModel: parsed?.planningModel ?? null,
      spriteModel: parsed?.spriteModel ?? null,
      audioModel: parsed?.audioModel ?? null,
      aiAllowed: parsed?.aiAllowed !== false,
      savedAt: parsed?.savedAt ?? new Date().toISOString(),
    };
  } catch (error) {
    console.warn('Unable to load AI config from localStorage', error);
    return createDefaultConfig();
  }
}

export function saveAiConfig(cfg: Partial<AiConfigV1>): AiConfigV1 {
  const current = loadAiConfig();
  const merged: AiConfigV1 = {
    ...current,
    ...cfg,
    aiAllowed: cfg.aiAllowed ?? current.aiAllowed ?? true,
    savedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LS_AI_CONFIG, JSON.stringify(merged));
    } catch (error) {
      console.warn('Unable to persist AI config', error);
    }
  }

  return merged;
}

export type AiRuntimeState = {
  aiEnabled: boolean;
  serverHasKey: boolean;
  planningModel: string | null;
  spriteModel: string | null;
  audioModel: string | null;
  aiAllowed: boolean;
  lastError: string | null;
};

const readString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return null;
};

const readBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return null;
};

const readStringFrom = (
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null => {
  if (!source) return null;
  for (const key of keys) {
    const candidate = readString((source as Record<string, unknown>)[key]);
    if (candidate) return candidate;
  }
  return null;
};

const readBooleanFrom = (
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): boolean | null => {
  if (!source) return null;
  for (const key of keys) {
    const candidate = readBoolean((source as Record<string, unknown>)[key]);
    if (candidate !== null) return candidate;
  }
  return null;
};

export async function getAiRuntime(): Promise<AiRuntimeState> {
  const cfg = loadAiConfig();

  if (typeof window === 'undefined') {
    return {
      aiEnabled: false,
      serverHasKey: false,
      planningModel: cfg.planningModel,
      spriteModel: cfg.spriteModel,
      audioModel: cfg.audioModel,
      aiAllowed: cfg.aiAllowed,
      lastError: null,
    };
  }

  if (!isMathGalaxyConfigured) {
    return {
      aiEnabled: false,
      serverHasKey: false,
      planningModel: cfg.planningModel,
      spriteModel: cfg.spriteModel,
      audioModel: cfg.audioModel,
      aiAllowed: cfg.aiAllowed,
      lastError: 'API offline sau URL greșit. Verifică VITE_MATH_API_URL.',
    };
  }

  let serverHasKey = false;
  let lastError: string | null = null;
  const aggregatedPayload: Record<string, unknown> = {};

  const offlineMessage = 'API offline sau URL greșit. Verifică VITE_MATH_API_URL.';

  const fetchers = [
    async () => mathGalaxyClient.aiRuntime(),
    async () => mathGalaxyClient.aiStatus(),
  ];

  for (const fetcher of fetchers) {
    try {
      const payload = await fetcher();
      if (payload && typeof payload === 'object') {
        Object.assign(aggregatedPayload, payload as Record<string, unknown>);
      }
    } catch (error) {
      const message =
        error instanceof MathGalaxyApiError || error instanceof TypeError
          ? offlineMessage
          : error instanceof Error
            ? error.message
            : offlineMessage;
      lastError = lastError || message;
    }
  }

  const runtimePayload = Object.keys(aggregatedPayload).length ? aggregatedPayload : null;

  if (runtimePayload) {
    const payloadConfig = (runtimePayload.config ?? runtimePayload.settings) as
      | Record<string, unknown>
      | null
      | undefined;

    serverHasKey = Boolean(
      runtimePayload.have_key ??
        runtimePayload.haveKey ??
        runtimePayload.server_has_key ??
        runtimePayload.key_configured ??
        readBooleanFrom(payloadConfig, ['have_key', 'has_key', 'key_present']) ??
        serverHasKey,
    );

    const reportedError = (runtimePayload.error || runtimePayload.message || runtimePayload.reason) as
      | string
      | undefined;
    if (reportedError && reportedError.trim()) {
      lastError = reportedError.trim();
    } else if (!serverHasKey && !lastError) {
      lastError = 'Gemini API key missing on server.';
    }
  }

  const payloadConfig = (runtimePayload?.config ?? runtimePayload?.settings) as
    | Record<string, unknown>
    | null
    | undefined;
  const reportedPlanning =
    readStringFrom(runtimePayload, ['planning_model', 'planningModel']) ??
    readStringFrom(payloadConfig, ['planning_model', 'planningModel']) ??
    null;
  const reportedSprite =
    readStringFrom(runtimePayload, ['sprite_model', 'spriteModel']) ??
    readStringFrom(payloadConfig, ['sprite_model', 'spriteModel']) ??
    null;
  const reportedAudio =
    readStringFrom(runtimePayload, ['audio_model', 'audioModel']) ??
    readStringFrom(payloadConfig, ['audio_model', 'audioModel']) ??
    null;

  const resolvedPlanningModel = cfg.planningModel ?? reportedPlanning ?? null;
  const resolvedSpriteModel = cfg.spriteModel ?? reportedSprite ?? null;
  const resolvedAudioModel = cfg.audioModel ?? reportedAudio ?? null;

  const remoteAllowed =
    readBooleanFrom(runtimePayload, ['ai_allowed', 'aiAllowed']) ??
    readBooleanFrom(payloadConfig, ['ai_allowed', 'aiAllowed']);
  const aiAllowed = (remoteAllowed !== false) && cfg.aiAllowed !== false;
  const remoteAiEnabled =
    readBooleanFrom(runtimePayload, ['ai_enabled', 'aiEnabled']) ??
    readBooleanFrom(payloadConfig, ['ai_enabled', 'aiEnabled']);
  const aiEnabled = remoteAiEnabled != null
    ? Boolean(remoteAiEnabled && aiAllowed)
    : Boolean(serverHasKey && resolvedPlanningModel && resolvedSpriteModel && aiAllowed);

  return {
    aiEnabled,
    serverHasKey,
    planningModel: resolvedPlanningModel,
    spriteModel: resolvedSpriteModel,
    audioModel: resolvedAudioModel,
    aiAllowed,
    lastError,
  };
}
