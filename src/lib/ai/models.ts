// src/ai/models.ts
export type PlanningModel = 'gemini-2.5-pro' | 'gemini-2.5-flash';
export type SpriteModel = 'gemini-2.5-flash-image'; // may allow others later

export type AiModelConfig = {
  planning?: PlanningModel | null;
  sprites?: SpriteModel | null;
};
