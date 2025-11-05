// src/lib/ai/runtime.ts
import { loadAiConfig } from './config';

export type AiRuntimeState = {
  aiEnabled: boolean;
  serverHasKey: boolean;
  planningModel: string | null;
  spriteModel: string | null;
};

export async function getAiRuntime(): Promise<AiRuntimeState> {
  const cfg = loadAiConfig();
  const health = await fetch('https://ionutbogdan.ro/api/health/gemini_post.php').then(r => r.json());
  const serverHasKey = !!health?.have_key;
  const aiEnabled = !!(serverHasKey && cfg.planningModel && cfg.spriteModel);
  return {
    aiEnabled,
    serverHasKey,
    planningModel: cfg.planningModel,
    spriteModel: cfg.spriteModel,
  };
}
