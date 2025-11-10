import { synthesize } from '../../api/tts';
import { hasGeminiApiKey } from '../gemini/apiKey';
import { STATIC_UI_PHRASES } from './phrases';
import type {
  WarmupLibrary,
  WarmupPromptSelection,
  WarmupPromptKind,
  WarmupCategoryId,
} from './warmupCatalog';

export type WarmupOptions = {
  language?: string | null;
  voiceId?: string | null;
  speakingRate?: number | null;
  pitch?: number | null;
  model?: string | null;
  preferredMime?: 'audio/mpeg' | 'audio/wav' | null;
  sampleRateHz?: 16000 | 22050 | 24000 | 44100 | null;
  additionMax?: number;
  includeFallbackLanguage?: boolean;
  signal?: AbortSignal;
};

export type WarmupTask = {
  text: string;
  kind: WarmupPromptKind | null;
};

export type WarmupProgress = {
  completed: number;
  total: number;
  task: WarmupTask | null;
  status: 'success' | 'skipped' | 'error';
  error?: Error | null;
};

export type WarmupResult = {
  total: number;
  processed: number;
  skipped: number;
  errors: number;
  aborted: boolean;
  rateLimited: boolean;
};

export type WarmupPlan = WarmupOptions & {
  selection: WarmupPromptSelection;
  library: WarmupLibrary;
  onProgress?: (progress: WarmupProgress) => void;
};

const runWhenIdle = (callback: () => void) => {
  if (typeof window === 'undefined') {
    callback();
    return;
  }
  const idle = (window as any).requestIdleCallback as
    | ((cb: IdleRequestCallback, opts?: IdleRequestOptions) => number)
    | undefined;
  if (typeof idle === 'function') {
    idle(() => callback());
    return;
  }
  window.setTimeout(callback, 250);
};

const normalizeLanguageKey = (language?: string | null): 'ro' | 'en' => {
  if (!language) return 'en';
  const key = language.split('-')[0]?.toLowerCase() ?? language.toLowerCase();
  return key === 'ro' ? 'ro' : 'en';
};

const STATIC_UI_PHRASES_LOOKUP = new Set(
  STATIC_UI_PHRASES.map((phrase) => phrase.trim().toLowerCase()).filter(Boolean),
);

const addTask = (tasks: WarmupTask[], seen: Set<string>, text: string, kind: WarmupPromptKind | null) => {
  const normalized = text?.trim();
  if (!normalized) return;
  if (STATIC_UI_PHRASES_LOOKUP.has(normalized.toLowerCase())) {
    return;
  }
  const key = `${kind || 'default'}::${normalized.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  tasks.push({ text: normalized, kind });
};

const waitForIdle = async () =>
  await new Promise<void>((resolve) => {
    runWhenIdle(resolve);
  });

export const collectWarmupTasks = ({
  selection,
  library,
  language,
  includeFallbackLanguage = true,
}: {
  selection: WarmupPromptSelection;
  library: WarmupLibrary;
  language?: string | null;
  includeFallbackLanguage?: boolean;
}): WarmupTask[] => {
  if (!selection) return [];

  const languageKey = normalizeLanguageKey(language);
  const fallbackLang: 'ro' | 'en' = languageKey === 'ro' ? 'en' : 'ro';

  const tasks: WarmupTask[] = [];
  const seen = new Set<string>();

  (Object.entries(selection) as Array<[WarmupCategoryId, string[]]>).forEach(([categoryId, promptIds]) => {
    if (!Array.isArray(promptIds) || promptIds.length === 0) {
      return;
    }
    const prompts = library?.[categoryId] || [];
    if (!prompts.length) {
      return;
    }
    const selected = new Set(promptIds);
    prompts.forEach((prompt) => {
      if (!selected.has(prompt.id)) {
        return;
      }
      const promptLanguage = prompt.language;
      if (promptLanguage && promptLanguage !== languageKey) {
        if (!includeFallbackLanguage || promptLanguage !== fallbackLang) {
          return;
        }
      }
      addTask(tasks, seen, prompt.text, prompt.kind);
    });
  });

  return tasks;
};

export const precomputeNarrationClips = async ({
  selection,
  library,
  language,
  voiceId,
  speakingRate,
  pitch,
  model,
  preferredMime,
  sampleRateHz,
  includeFallbackLanguage,
  signal,
  onProgress,
}: WarmupPlan): Promise<WarmupResult> => {
  if (typeof window === 'undefined') {
    return { total: 0, processed: 0, skipped: 0, errors: 0, aborted: false, rateLimited: false };
  }

  if (!hasGeminiApiKey()) {
    console.warn('[audio-warmup] Gemini API key is missing; skipping precompute.');
    return { total: 0, processed: 0, skipped: 0, errors: 0, aborted: false, rateLimited: false };
  }

  const tasks = collectWarmupTasks({
    selection,
    library,
    language,
    includeFallbackLanguage,
  });

  const total = tasks.length;
  if (!total) {
    return { total: 0, processed: 0, skipped: 0, errors: 0, aborted: false, rateLimited: false };
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let completed = 0;
  let aborted = false;
  let rateLimited = false;

  for (const task of tasks) {
    if (signal?.aborted) {
      aborted = true;
      break;
    }

    await waitForIdle();

    try {
      await synthesize(task.text, {
        voiceId: voiceId || undefined,
        speakingRate: speakingRate ?? undefined,
        pitch: pitch ?? undefined,
        language: language || undefined,
        model: model || undefined,
        preferredMime: preferredMime || undefined,
        sampleRateHz: sampleRateHz ?? undefined,
        kind: task.kind,
        signal,
      });
      processed += 1;
      completed += 1;
      onProgress?.({
        completed,
        total,
        task,
        status: 'success',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'tts_unavailable') {
          skipped += 1;
          completed += 1;
          onProgress?.({ completed, total, task, status: 'skipped' });
          continue;
        }
        if (error.message === 'tts_ratelimited') {
          rateLimited = true;
          aborted = true;
          onProgress?.({ completed, total, task, status: 'error', error });
          console.warn('[audio-warmup] Rate limit reached during manual precompute; aborting.');
          break;
        }
      }
      errors += 1;
      completed += 1;
      console.warn('[audio-warmup] Unable to precompute clip', task, error);
      onProgress?.({
        completed,
        total,
        task,
        status: 'error',
        error: error instanceof Error ? error : undefined,
      });
    }
  }

  if (signal?.aborted) {
    aborted = true;
  }

  return { total, processed, skipped, errors, aborted, rateLimited };
};
