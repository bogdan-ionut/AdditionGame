// src/lib/ai/config.ts
import { AiModelConfig } from './models';

const LS_PLANNING_MODEL = 'alpha.ai.model.planning';
const LS_SPRITE_MODEL = 'alpha.ai.model.sprites';

// --- Migration from legacy keys ---
const LS_LEGACY_AI_CONFIG = 'ai.config.v1';

function migrateLegacyConfig() {
  // Transfer main AI config
  const legacyConfigRaw = localStorage.getItem(LS_LEGACY_AI_CONFIG);
  if (legacyConfigRaw) {
    try {
      const parsed = JSON.parse(legacyConfigRaw);
      if (parsed.planningModel) {
        localStorage.setItem(LS_PLANNING_MODEL, parsed.planningModel);
      }
      if (parsed.spriteModel) {
        localStorage.setItem(LS_SPRITE_MODEL, parsed.spriteModel);
      }
    } catch (e) {
      console.warn('Could not parse legacy AI config for migration', e);
    }
    localStorage.removeItem(LS_LEGACY_AI_CONFIG);
  }

  // Clear other legacy keys
}
// --- End Migration ---

export function loadAiConfig(): AiModelConfig {
  if (typeof window === 'undefined') {
    return { planning: null, sprites: null };
  }

  // Always run migration check on load
  migrateLegacyConfig();

  return {
    planning: localStorage.getItem(LS_PLANNING_MODEL) as AiModelConfig['planning'] || null,
    sprites: localStorage.getItem(LS_SPRITE_MODEL) as AiModelConfig['sprites'] || null,
  };
}

export function saveAiConfig(cfg: AiModelConfig) {
  if (typeof window !== 'undefined') {
    if (cfg.planning) {
      localStorage.setItem(LS_PLANNING_MODEL, cfg.planning);
    } else {
      localStorage.removeItem(LS_PLANNING_MODEL);
    }
    if (cfg.sprites) {
      localStorage.setItem(LS_SPRITE_MODEL, cfg.sprites);
    } else {
      localStorage.removeItem(LS_SPRITE_MODEL);
    }
  }
  return cfg;
}
