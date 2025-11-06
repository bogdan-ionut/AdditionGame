import { getGeminiHealthUrl, getLegacyGeminiHealthUrl } from '../../services/aiEndpoints';

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

type HealthResult = {
  ok: boolean;
  payload: Record<string, unknown> | null;
  error: string | null;
};

const fetchHealthPayload = async (url: string): Promise<HealthResult> => {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      return {
        ok: false,
        payload: null,
        error: `Health check failed (HTTP ${response.status})`,
      };
    }
    const json = await response.json().catch(() => null);
    return { ok: true, payload: (json as Record<string, unknown>) ?? null, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reach AI status endpoint';
    return { ok: false, payload: null, error: message };
  }
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

  let serverHasKey = false;
  let lastError: string | null = null;

  const healthUrls = [getGeminiHealthUrl(), getLegacyGeminiHealthUrl()];
  for (const url of healthUrls) {
    if (!url) continue;
    const result = await fetchHealthPayload(url);
    if (!result.ok) {
      lastError = lastError || result.error;
      continue;
    }

    const payload = result.payload || {};
    serverHasKey = Boolean(payload.have_key ?? payload.haveKey ?? payload.server_has_key);
    const reportedError = (payload.error || payload.message || payload.reason) as string | undefined;
    if (reportedError && reportedError.trim()) {
      lastError = reportedError.trim();
    } else if (!serverHasKey) {
      lastError = lastError || 'Gemini API key missing on server.';
    }

    if (serverHasKey || lastError) {
      break;
    }
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
    lastError,
  };
}
