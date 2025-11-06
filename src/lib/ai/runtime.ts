import { getGeminiHealthUrl } from '../../services/aiEndpoints';

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
    };
  }

  let serverHasKey = false;
  try {
    const response = await fetch(getGeminiHealthUrl(), {
      method: 'GET',
    });
    if (response.ok) {
      const health = await response.json();
      serverHasKey = Boolean(health?.have_key);
    } else {
      console.warn('Gemini health endpoint returned non-OK status', response.status);
    }
  } catch (error) {
    console.warn('Unable to reach Gemini health endpoint', error);
  }

  const aiAllowed = cfg.aiAllowed !== false;
  const aiEnabled = Boolean(serverHasKey && cfg.planningModel && cfg.spriteModel && aiAllowed);

  return {
    aiEnabled,
    serverHasKey,
    planningModel: cfg.planningModel,
    spriteModel: cfg.spriteModel,
    audioModel: cfg.audioModel,
    aiAllowed,
  };
}
