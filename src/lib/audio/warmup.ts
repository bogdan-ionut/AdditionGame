import { synthesize } from '../../api/tts';
import { hasGeminiApiKey } from '../gemini/apiKey';
import {
  FEEDBACK_MESSAGES,
  STATIC_UI_PHRASES,
  buildCountingPrompt,
  getAdditionPrompts,
} from './phrases';

export type WarmupOptions = {
  language?: string | null;
  voiceId?: string | null;
  speakingRate?: number | null;
  pitch?: number | null;
  model?: string | null;
  preferredMime?: 'audio/mpeg' | 'audio/wav' | null;
  sampleRateHz?: 16000 | 22050 | 24000 | 44100 | null;
  additionMax?: number;
  signal?: AbortSignal;
};

type WarmupTask = {
  text: string;
  type: string | null;
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

const addTask = (tasks: WarmupTask[], seen: Set<string>, text: string, type: string | null) => {
  const normalized = text?.trim();
  if (!normalized) return;
  const key = `${type || 'default'}::${normalized.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  tasks.push({ text: normalized, type });
};

const addFeedbackTasks = (tasks: WarmupTask[], seen: Set<string>, language: 'ro' | 'en') => {
  const feedback = FEEDBACK_MESSAGES;
  feedback.praise[language]?.forEach((text) => {
    addTask(tasks, seen, text, 'praise');
  });
  feedback.encouragement[language]?.forEach((text) => {
    addTask(tasks, seen, text, 'encouragement');
  });
  Object.values(feedback.miniLessons[language] || {}).forEach((text) => {
    addTask(tasks, seen, text, 'mini-lesson');
  });
};

export const warmupNarrationCache = (options: WarmupOptions): void => {
  if (typeof window === 'undefined') return;
  if (!hasGeminiApiKey()) return;

  const additionMax = Number.isFinite(options.additionMax) ? Number(options.additionMax) : 9;
  const languageKey = normalizeLanguageKey(options.language);
  const fallbackLang: 'ro' | 'en' = languageKey === 'ro' ? 'en' : 'ro';

  const tasks: WarmupTask[] = [];
  const seen = new Set<string>();

  STATIC_UI_PHRASES.forEach((text) => addTask(tasks, seen, text, 'ui'));
  addFeedbackTasks(tasks, seen, languageKey);
  if (fallbackLang !== languageKey) {
    addFeedbackTasks(tasks, seen, fallbackLang);
  }

  getAdditionPrompts(options.language, additionMax).forEach((prompt) => {
    addTask(tasks, seen, prompt, 'problem');
  });

  for (let a = 0; a <= additionMax; a += 1) {
    for (let b = 1; b <= additionMax; b += 1) {
      addTask(tasks, seen, buildCountingPrompt(a, b, options.language), 'counting');
    }
  }

  if (!tasks.length) return;

  const queue = [...tasks];

  let abortedByRateLimit = false;

  const processNext = () => {
    if (!queue.length) return;
    if (options.signal?.aborted) return;
    if (abortedByRateLimit) return;
    const task = queue.shift();
    if (!task) return;

    synthesize(task.text, {
      voiceId: options.voiceId || undefined,
      speakingRate: options.speakingRate ?? undefined,
      pitch: options.pitch ?? undefined,
      language: options.language || undefined,
      model: options.model || undefined,
      preferredMime: options.preferredMime || undefined,
      sampleRateHz: options.sampleRateHz ?? undefined,
      kind: task.type,
      signal: options.signal,
    })
      .catch((error) => {
        if (error instanceof Error) {
          if (error.message === 'tts_unavailable') {
            return;
          }
          if (error.message === 'tts_ratelimited') {
            abortedByRateLimit = true;
            queue.length = 0;
            console.warn('[audio-warmup] Rate limit reached during warmup; stopping precompute queue.');
            return;
          }
        }
        console.warn('[audio-warmup] Unable to precompute clip', task, error);
      })
      .finally(() => {
        if (queue.length && !options.signal?.aborted && !abortedByRateLimit) {
          runWhenIdle(processNext);
        }
      });
  };

  runWhenIdle(processNext);
};
