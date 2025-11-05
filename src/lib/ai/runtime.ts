// src/lib/ai/runtime.ts
import { loadAiConfig } from './config';
import { PlanningModel, SpriteModel } from './models';

export type AiRuntimeState = {
  aiEnabled: boolean;
  serverHasKey: boolean;
  planningModel: PlanningModel | null;
  spriteModel: SpriteModel | null;
};

async function checkServerHealth(): Promise<{ have_key: boolean }> {
  try {
    const response = await fetch('https://ionutbogdan.ro/api/health/gemini_post.php');
    if (!response.ok) return { have_key: false };
    return await response.json();
  } catch (error) {
    console.warn('AI server health check failed:', error);
    return { have_key: false };
  }
}

export async function getAiRuntime(): Promise<AiRuntimeState> {
  const config = loadAiConfig();
  const health = await checkServerHealth();
  const serverHasKey = health?.have_key ?? false;

  const aiEnabled = !!(serverHasKey && config.planning && config.sprites);

  return {
    aiEnabled,
    serverHasKey,
    planningModel: config.planning,
    spriteModel: config.sprites,
  };
}

export function isAiEnabled(runtimeState: AiRuntimeState): boolean {
  return runtimeState.aiEnabled;
}
