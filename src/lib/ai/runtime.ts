import { hasGeminiApiKey } from '../gemini/apiKey';

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
  defaultTtsModel?: string | null;
  allowedTtsModels?: string[];
  runtimeLabel?: string | null;
  note?: string | null;
  acceptsClientKey?: boolean | null;
};

export async function getAiRuntime(): Promise<AiRuntimeState> {
  const cfg = loadAiConfig();
  const hasKey = hasGeminiApiKey();
  const aiAllowed = cfg.aiAllowed !== false;
  const aiEnabled = aiAllowed && hasKey;
  return {
    aiEnabled,
    serverHasKey: hasKey,
    planningModel: cfg.planningModel,
    spriteModel: cfg.spriteModel,
    audioModel: cfg.audioModel ?? 'gemini-2.5-flash-preview-tts',
    aiAllowed,
    lastError: hasKey
      ? null
      : 'Adaugă cheia Google Gemini în AI Settings pentru a activa vocea și planificarea personalizată.',
    defaultTtsModel: 'gemini-2.5-flash-preview-tts',
    allowedTtsModels: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'],
    runtimeLabel: hasKey ? 'Gemini (direct)' : 'Offline',
    note: hasKey
      ? 'TTS rulează direct în browser folosind cheia ta Gemini.'
      : 'Funcțiile AI sunt limitate până configurezi cheia Gemini.',
    acceptsClientKey: true,
  };
}
