import { synthesize } from '../../api/tts';
import { hasGeminiApiKey } from '../gemini/apiKey';
import { FEEDBACK_MESSAGES, STATIC_UI_PHRASES, buildCountingPrompt, getAdditionPrompts } from './phrases';

export type WarmupCategory = 'praise' | 'encouragement' | 'mini-lesson' | 'problem' | 'counting';

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
  type: WarmupCategory | null;
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
  categories: WarmupCategory[];
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

const addTask = (tasks: WarmupTask[], seen: Set<string>, text: string, type: WarmupCategory | null) => {
  const normalized = text?.trim();
  if (!normalized) return;
  if (STATIC_UI_PHRASES_LOOKUP.has(normalized.toLowerCase())) {
    return;
  }
  const key = `${type || 'default'}::${normalized.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  tasks.push({ text: normalized, type });
};

const addFeedbackTasks = (
  tasks: WarmupTask[],
  seen: Set<string>,
  language: 'ro' | 'en',
  categories: Set<WarmupCategory>,
) => {
  const feedback = FEEDBACK_MESSAGES;
  if (categories.has('praise')) {
    feedback.praise[language]?.forEach((text) => {
      addTask(tasks, seen, text, 'praise');
    });
  }
  if (categories.has('encouragement')) {
    feedback.encouragement[language]?.forEach((text) => {
      addTask(tasks, seen, text, 'encouragement');
    });
  }
  if (categories.has('mini-lesson')) {
    Object.values(feedback.miniLessons[language] || {}).forEach((text) => {
      addTask(tasks, seen, text, 'mini-lesson');
    });
  }
};

const waitForIdle = async () =>
  await new Promise<void>((resolve) => {
    runWhenIdle(resolve);
  });

export const collectWarmupTasks = ({
  categories,
  language,
  additionMax,
  includeFallbackLanguage = true,
}: Pick<WarmupPlan, 'categories' | 'language' | 'additionMax' | 'includeFallbackLanguage'>): WarmupTask[] => {
  const uniqueCategories = new Set(categories?.filter(Boolean) as WarmupCategory[]);
  if (!uniqueCategories.size) return [];

  const additionLimit = Number.isFinite(additionMax) ? Number(additionMax) : 9;
  const languageKey = normalizeLanguageKey(language);
  const fallbackLang: 'ro' | 'en' = languageKey === 'ro' ? 'en' : 'ro';

  const tasks: WarmupTask[] = [];
  const seen = new Set<string>();

  addFeedbackTasks(tasks, seen, languageKey, uniqueCategories);
  if (includeFallbackLanguage && fallbackLang !== languageKey) {
    addFeedbackTasks(tasks, seen, fallbackLang, uniqueCategories);
  }

  if (uniqueCategories.has('problem')) {
    getAdditionPrompts(language, additionLimit).forEach((prompt) => {
      addTask(tasks, seen, prompt, 'problem');
    });
  }

  if (uniqueCategories.has('counting')) {
    for (let a = 0; a <= additionLimit; a += 1) {
      for (let b = 1; b <= additionLimit; b += 1) {
        addTask(tasks, seen, buildCountingPrompt(a, b, language), 'counting');
      }
    }
  }

  return tasks;
};

export const precomputeNarrationClips = async ({
  categories,
  language,
  voiceId,
  speakingRate,
  pitch,
  model,
  preferredMime,
  sampleRateHz,
  additionMax,
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
    categories,
    language,
    additionMax,
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
        kind: task.type,
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
