// src/lib/ai/config.ts

export type AiConfigV1 = {
  planningModel: string | null;
  spriteModel: string | null;
  savedAt: string;
};

const LS_AI_CONFIG = "ai.config.v1";

export function loadAiConfig(): AiConfigV1 {
  if (typeof window === 'undefined') {
    return { planningModel: null, spriteModel: 'gemini-1.5-flash-image', savedAt: new Date().toISOString() };
  }
  const raw = localStorage.getItem(LS_AI_CONFIG);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        spriteModel: parsed.spriteModel ?? 'gemini-1.5-flash-image',
      };
    } catch (e) {
      console.warn('Invalid AI config in localStorage', e);
    }
  }
  return { planningModel: null, spriteModel: 'gemini-1.5-flash-image', savedAt: new Date().toISOString() };
}

export function saveAiConfig(cfg: Partial<AiConfigV1>) {
  const cur = loadAiConfig();
  const merged = { ...cur, ...cfg, savedAt: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    localStorage.setItem(LS_AI_CONFIG, JSON.stringify(merged));
  }
  return merged;
}
