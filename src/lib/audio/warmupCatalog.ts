import { FEEDBACK_MESSAGES, buildCountingPrompt, getAdditionPrompts } from './phrases';

export type WarmupPromptKind =
  | 'praise'
  | 'encouragement'
  | 'mini-lesson'
  | 'problem'
  | 'counting'
  | 'learner-name';

export type WarmupCategoryId =
  | 'learner-name'
  | 'praise'
  | 'encouragement'
  | 'mini-lesson'
  | 'addition-0-3'
  | 'addition-0-5'
  | 'addition-0-8'
  | 'addition-0-9'
  | 'counting';

export type WarmupPromptLanguage = 'ro';

export type WarmupPrompt = {
  id: string;
  text: string;
  language: WarmupPromptLanguage | null;
  kind: WarmupPromptKind;
  source: 'default' | 'custom';
};

export type WarmupLibrary = Record<WarmupCategoryId, WarmupPrompt[]>;

export type WarmupCategoryDefinition = {
  id: WarmupCategoryId;
  label: string;
  description: string;
  kind: WarmupPromptKind;
  additionMax?: number | null;
};

export type WarmupPromptSelection = Partial<Record<WarmupCategoryId, string[]>>;

export const LANGUAGE_TAGS: Array<{ value: WarmupPromptLanguage; label: string }> = [
  { value: 'ro', label: 'Română (ro)' },
];

export const LEARNER_NAME_CATEGORY_ID: WarmupCategoryId = 'learner-name';

export const WARMUP_CATEGORIES: WarmupCategoryDefinition[] = [
  {
    id: LEARNER_NAME_CATEGORY_ID,
    label: 'Nume utilizator',
    description: 'Pregătește pronunțiile pentru numele copilului, porecle sau alte formule de adresare.',
    kind: 'learner-name',
  },
  {
    id: 'praise',
    label: 'Mesaje de felicitare',
    description: 'Pregătește în avans replicile pozitive folosite după răspunsuri corecte.',
    kind: 'praise',
  },
  {
    id: 'encouragement',
    label: 'Mesaje de încurajare',
    description: 'Generează clipuri pentru situațiile în care copilul are nevoie de motivație suplimentară.',
    kind: 'encouragement',
  },
  {
    id: 'mini-lesson',
    label: 'Mini-lecții și explicații',
    description: 'Precomputează explicațiile audio folosite în lecții și hint-uri.',
    kind: 'mini-lesson',
  },
  {
    id: 'addition-0-3',
    label: 'Probleme de adunare 0–3',
    description: 'Întrebări simple pentru începutul parcursului de adunare.',
    kind: 'problem',
    additionMax: 3,
  },
  {
    id: 'addition-0-5',
    label: 'Probleme de adunare 0–5',
    description: 'Extinde antrenamentul cu numere până la 5.',
    kind: 'problem',
    additionMax: 5,
  },
  {
    id: 'addition-0-8',
    label: 'Probleme de adunare 0–8',
    description: 'Setul intermediar pentru exersarea adunărilor mai dificile.',
    kind: 'problem',
    additionMax: 8,
  },
  {
    id: 'addition-0-9',
    label: 'Probleme de adunare 0–9',
    description: 'Catalog complet pentru combinațiile clasice de până la 9.',
    kind: 'problem',
    additionMax: 9,
  },
  {
    id: 'counting',
    label: 'Exerciții de numărare',
    description: 'Pregătește prompt-urile pentru numărat înainte/înapoi folosite în joc.',
    kind: 'counting',
  },
];

const STORAGE_KEY = 'ai.warmup.prompts.v1';
const STORAGE_VERSION = 1;
const COUNTING_LIMIT = 9;

type StoredPrompt = {
  id: string;
  text: string;
  language: string | null;
  kind?: WarmupPromptKind;
  source?: 'default' | 'custom';
};

type StoredLibrary = Partial<Record<WarmupCategoryId, StoredPrompt[]>>;

type PersistedPayload = {
  version: number;
  library: StoredLibrary;
};

const toLanguageKey = (
  value: string | null | undefined,
): WarmupPromptLanguage | null =>
  value && value.toLowerCase().startsWith('ro') ? 'ro' : null;

const createHashId = (categoryId: string, language: string | null, text: string): string => {
  const normalized = `${categoryId}::${language || 'any'}::${text}`.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return `d-${hash.toString(36)}`;
};

const createDefaultPrompt = (
  categoryId: WarmupCategoryId,
  kind: WarmupPromptKind,
  text: string,
  language: WarmupPromptLanguage,
): WarmupPrompt => ({
  id: createHashId(categoryId, language, text),
  text,
  language,
  kind,
  source: 'default',
});

const createCountingDefaults = (
  categoryId: WarmupCategoryId,
  kind: WarmupPromptKind,
): WarmupPrompt[] => {
  const prompts: WarmupPrompt[] = [];
  for (let start = 0; start <= COUNTING_LIMIT; start += 1) {
    for (let steps = 1; steps <= COUNTING_LIMIT; steps += 1) {
      const ro = buildCountingPrompt(start, steps, 'ro-RO');
      prompts.push(createDefaultPrompt(categoryId, kind, ro, 'ro'));
    }
  }
  return prompts;
};

const createAdditionDefaults = (
  categoryId: WarmupCategoryId,
  kind: WarmupPromptKind,
  max: number,
): WarmupPrompt[] => {
  const prompts: WarmupPrompt[] = [];
  getAdditionPrompts('ro-RO', max).forEach((text) => {
    prompts.push(createDefaultPrompt(categoryId, kind, text, 'ro'));
  });
  return prompts;
};

const buildDefaultLibrary = (): WarmupLibrary => {
  const library: Partial<WarmupLibrary> = {};
  WARMUP_CATEGORIES.forEach((category) => {
    if (category.kind === 'problem' && category.additionMax != null) {
      library[category.id] = createAdditionDefaults(category.id, category.kind, category.additionMax);
    } else if (category.id === 'counting') {
      library[category.id] = createCountingDefaults(category.id, category.kind);
    } else {
      library[category.id] = [];
    }
  });

  const feedback = FEEDBACK_MESSAGES;
  feedback.praise.ro.forEach((text) => {
    library.praise?.push(createDefaultPrompt('praise', 'praise', text, 'ro'));
  });

  feedback.encouragement.ro.forEach((text) => {
    library.encouragement?.push(createDefaultPrompt('encouragement', 'encouragement', text, 'ro'));
  });

  Object.values(feedback.miniLessons.ro).forEach((text) => {
    library['mini-lesson']?.push(createDefaultPrompt('mini-lesson', 'mini-lesson', text, 'ro'));
  });

  return library as WarmupLibrary;
};

const DEFAULT_LIBRARY = buildDefaultLibrary();

const clonePrompt = (prompt: WarmupPrompt): WarmupPrompt => ({ ...prompt });

const cloneLibrary = (library: WarmupLibrary): WarmupLibrary => {
  const result: Partial<WarmupLibrary> = {};
  (Object.keys(library) as WarmupCategoryId[]).forEach((categoryId) => {
    result[categoryId] = library[categoryId].map(clonePrompt);
  });
  return result as WarmupLibrary;
};

const sanitizePrompt = (
  category: WarmupCategoryDefinition,
  prompt: StoredPrompt,
): WarmupPrompt | null => {
  if (!prompt || typeof prompt.text !== 'string') {
    return null;
  }
  const text = prompt.text.trim();
  if (!text) {
    return null;
  }
  const language = prompt.language ? toLanguageKey(prompt.language) : null;
  if (prompt.language && language !== 'ro') {
    return null;
  }
  const kind = prompt.kind || category.kind;
  return {
    id: prompt.id || createHashId(category.id, language, text),
    text,
    language,
    kind,
    source: prompt.source === 'custom' ? 'custom' : 'default',
  };
};

const normalizeLibrary = (stored: StoredLibrary | undefined): WarmupLibrary => {
  const base = cloneLibrary(DEFAULT_LIBRARY);
  if (!stored) {
    return base;
  }
  (Object.entries(stored) as Array<[WarmupCategoryId, StoredPrompt[]]>).forEach(([categoryId, prompts]) => {
    const definition = WARMUP_CATEGORIES.find((category) => category.id === categoryId);
    if (!definition) {
      return;
    }
    const sanitized = (Array.isArray(prompts) ? prompts : [])
      .map((prompt) => sanitizePrompt(definition, prompt))
      .filter((prompt): prompt is WarmupPrompt => Boolean(prompt));
    if (sanitized.length) {
      const seen = new Set<string>();
      base[categoryId] = sanitized.filter((prompt) => {
        if (seen.has(prompt.id)) {
          return false;
        }
        seen.add(prompt.id);
        return true;
      });
    }
  });
  return base;
};

export const getDefaultWarmupLibrary = (): WarmupLibrary => cloneLibrary(DEFAULT_LIBRARY);

export const getDefaultPromptsForCategory = (categoryId: WarmupCategoryId): WarmupPrompt[] =>
  cloneLibrary(DEFAULT_LIBRARY)[categoryId];

export const loadWarmupLibrary = (): WarmupLibrary => {
  if (typeof window === 'undefined') {
    return cloneLibrary(DEFAULT_LIBRARY);
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneLibrary(DEFAULT_LIBRARY);
    }
    const payload = JSON.parse(raw) as PersistedPayload | undefined;
    if (!payload || payload.version !== STORAGE_VERSION) {
      return cloneLibrary(DEFAULT_LIBRARY);
    }
    return normalizeLibrary(payload.library);
  } catch (error) {
    console.warn('[warmupCatalog] Unable to load stored prompts', error);
    return cloneLibrary(DEFAULT_LIBRARY);
  }
};

export const saveWarmupLibrary = (library: WarmupLibrary): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const serializable: StoredLibrary = {};
    (Object.entries(library) as Array<[WarmupCategoryId, WarmupPrompt[]]>).forEach(([categoryId, prompts]) => {
      serializable[categoryId] = prompts.map((prompt) => ({
        id: prompt.id,
        text: prompt.text,
        language: prompt.language,
        kind: prompt.kind,
        source: prompt.source,
      }));
    });
    const payload: PersistedPayload = { version: STORAGE_VERSION, library: serializable };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[warmupCatalog] Unable to persist prompts', error);
  }
};

const randomId = (categoryId: WarmupCategoryId) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${categoryId}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

export const createCustomPrompt = (
  categoryId: WarmupCategoryId,
  kind: WarmupPromptKind,
  text: string,
  language: WarmupPromptLanguage | null,
): WarmupPrompt => ({
  id: randomId(categoryId),
  text: text.trim(),
  language,
  kind,
  source: 'custom',
});

export const pruneSelection = (
  selection: WarmupPromptSelection,
  library: WarmupLibrary,
): WarmupPromptSelection => {
  const next: WarmupPromptSelection = {};
  (Object.entries(selection) as Array<[WarmupCategoryId, string[]]>).forEach(([categoryId, promptIds]) => {
    const prompts = new Set((library[categoryId] || []).map((prompt) => prompt.id));
    const filtered = (promptIds || []).filter((id) => prompts.has(id));
    if (filtered.length) {
      next[categoryId] = filtered;
    }
  });
  return next;
};

export const isCategoryModified = (
  library: WarmupLibrary,
  categoryId: WarmupCategoryId,
): boolean => {
  const current = library[categoryId] || [];
  const defaults = DEFAULT_LIBRARY[categoryId] || [];
  if (current.length !== defaults.length) {
    return true;
  }
  const byId = new Map(current.map((prompt) => [prompt.id, prompt]));
  return defaults.some((prompt) => {
    const candidate = byId.get(prompt.id);
    if (!candidate) {
      return true;
    }
    return candidate.text !== prompt.text || candidate.language !== prompt.language;
  });
};

export const resetCategoryToDefaults = (
  library: WarmupLibrary,
  categoryId: WarmupCategoryId,
): WarmupLibrary => {
  const next = cloneLibrary(library);
  next[categoryId] = cloneLibrary(DEFAULT_LIBRARY)[categoryId];
  return next;
};
