import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MathGalaxyApiError, isMathGalaxyConfigured } from '../../services/mathGalaxyClient';
import { fetchAudioSfx, fetchTtsModels, fetchTtsVoices, synthesizeSpeech } from '../../services/audioCatalog';
import { AUDIO_SETTINGS_EVENT, LS_AUDIO_SETTINGS, loadAudioSettings, saveAudioSettings, type AudioSettings } from './preferences';
import { createObjectUrlFromBase64, createObjectUrlFromBuffer } from './utils';
import type { AiRuntimeState } from '../ai/runtime';

export type VoicePreset = {
  id: string;
  label: string;
  description?: string | null;
  language?: string | null;
  gender?: string | null;
  tags?: string[];
  default?: boolean;
  previewText?: string | null;
  sampleUrl?: string | null;
};

export type SfxClip = {
  id: string;
  label?: string | null;
  url?: string | null;
  base64?: string | null;
  mimeType?: string | null;
  gain?: number | null;
  tags?: string[];
};

export type SfxPack = {
  id: string;
  label?: string | null;
  description?: string | null;
  tags?: string[];
  categories: Record<string, SfxClip[]>;
  default?: boolean;
};

type CatalogState = {
  models: string[];
  voices: VoicePreset[];
  sfxPacks: SfxPack[];
  defaultSfxPackId: string | null;
};

type NarrationEngineOptions = {
  runtime: AiRuntimeState;
};

type PlayTextOptions = {
  text: string;
  type?:
    | 'problem'
    | 'hint'
    | 'mini-lesson'
    | 'feedback'
    | 'encouragement'
    | 'praise'
    | 'counting'
    | 'custom';
  speakingRate?: number;
  pitch?: number;
  language?: string | null;
  voiceId?: string | null;
  model?: string | null;
  volume?: number;
};

const OFFLINE_MESSAGE = 'API offline sau URL greșit. Deschide AI Settings pentru a verifica Cloud API Base URL.';

const DEFAULT_SFX_CATEGORY_MAPPING: Record<string, string[]> = {
  success: ['success', 'celebration', 'correct', 'victory'],
  error: ['error', 'incorrect', 'retry', 'try-again'],
  progress: ['progress', 'streak', 'level-up', 'checkpoint'],
};

const PRAISE_LINES_RO = [
  'Bravo, ai reușit! Ești o stea strălucitoare!',
  'Excelent! Îmi place cât de atent ai fost.',
  'Felicitări! Continuă tot așa!',
];

const PRAISE_LINES_EN = [
  'Great job, you did it!',
  'Excellent work! I love how focused you were.',
  'Fantastic! Keep shining!',
];

const ENCOURAGE_LINES_RO = [
  'Nu-i nimic, mai încearcă! Știu că poți!',
  'Respirăm adânc și încercăm din nou. Eu cred în tine!',
  'Aproape! Împreună găsim răspunsul corect.',
];

const ENCOURAGE_LINES_EN = [
  "That's okay, try again! I know you can do it!",
  'Take a breath and give it another go. I believe in you!',
  'So close! Together we will get it right.',
];

const MINI_LESSONS_RO: Record<string, string> = {
  'count-on': 'Hai să numărăm împreună. Începem de la primul număr și mai adăugăm pașii pe rând.',
  'make-10': 'Gândește-te la numărul 10 ca la un prieten. Poți împărți al doilea număr ca să ajungi la 10 și apoi adaugi restul.',
  commutativity: 'Ordinea termenilor nu schimbă suma. Poți schimba numerele între ele pentru a calcula mai ușor.',
};

const MINI_LESSONS_EN: Record<string, string> = {
  'count-on': 'Let’s count on together. Start at the first number and add the steps one by one.',
  'make-10': 'Think of 10 as a friendly helper. Break the second number to make 10, then add the rest.',
  commutativity: 'Switching the order does not change the sum. Swap the numbers to make it easier.',
};

const randomFrom = (list: string[]): string | null => {
  if (!Array.isArray(list) || !list.length) return null;
  const index = Math.floor(Math.random() * list.length);
  return list[index];
};

const normalizeVolume = (value: number | null | undefined, fallback: number) => {
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, Number(value)));
};

const toLanguageKey = (language: string | null | undefined) => {
  if (!language || typeof language !== 'string') return 'en';
  return language.split('-')[0]?.toLowerCase?.() || language.toLowerCase();
};

export function useNarrationEngine({ runtime }: NarrationEngineOptions) {
  const [settings, setSettings] = useState<AudioSettings>(() => loadAudioSettings());
  const [catalog, setCatalog] = useState<CatalogState>({ models: [], voices: [], sfxPacks: [], defaultSfxPackId: null });
  const [catalogStatus, setCatalogStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const clipCache = useRef<Map<string, { url: string; revoke: () => void }>>(new Map());
  const sfxPlayersRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const effectiveModel = useMemo(() => {
    const cfgModel = settings.narrationModel || null;
    if (cfgModel) return cfgModel;
    if (runtime?.audioModel) return runtime.audioModel;
    if (runtime?.defaultTtsModel) return runtime.defaultTtsModel;
    if (Array.isArray(runtime?.allowedTtsModels) && runtime.allowedTtsModels.length) {
      return runtime.allowedTtsModels[0];
    }
    if (catalog.models.length) return catalog.models[0];
    return null;
  }, [catalog.models, runtime?.allowedTtsModels, runtime?.audioModel, runtime?.defaultTtsModel, settings.narrationModel]);

  useEffect(() => {
    setSettings((prev) => {
      if (prev.narrationModel || !runtime?.audioModel) return prev;
      return saveAudioSettings({ narrationModel: runtime.audioModel });
    });
  }, [runtime?.audioModel]);

  const updateSettings = useCallback(
    (next: Partial<AudioSettings>) => {
      setSettings(saveAudioSettings(next));
    },
    [],
  );

  const stopNarration = useCallback(() => {
    const audio = narrationRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    narrationRef.current = null;
  }, []);

  useEffect(() => () => stopNarration(), [stopNarration]);

  const clearNarrationClip = useCallback((key: string) => {
    const cache = clipCache.current;
    if (!cache.has(key)) return;
    const entry = cache.get(key);
    if (entry) entry.revoke();
    cache.delete(key);
  }, []);

  const getVoicePreset = useCallback(
    (voiceId: string | null | undefined): VoicePreset | null => {
      if (!voiceId) return null;
      return catalog.voices.find((voice) => voice.id === voiceId) || null;
    },
    [catalog.voices],
  );

  const fetchCatalog = useCallback(
    async (force = false) => {
      if (!isMathGalaxyConfigured) {
        setCatalogStatus('error');
        setCatalogError(OFFLINE_MESSAGE);
        return;
      }
      if (catalogStatus === 'loading' && !force) return;
      setCatalogStatus('loading');
      setCatalogError(null);
      try {
        const [modelsResult, voicesResult, sfxResult] = await Promise.all([
          fetchTtsModels().catch((error) => {
            console.warn('[audio] Unable to fetch TTS models', error);
            return null;
          }),
          fetchTtsVoices({ mode: settings.sfxLowStimMode ? 'low-stim' : undefined }).catch((error) => {
            console.warn('[audio] Unable to fetch TTS voices', error);
            return null;
          }),
          fetchAudioSfx({ mode: settings.sfxLowStimMode ? 'low-stim' : undefined }).catch((error) => {
            console.warn('[audio] Unable to fetch audio SFX', error);
            return null;
          }),
        ]);

        const modelIds = Array.isArray(modelsResult?.models)
          ? modelsResult.models.filter((value) => typeof value === 'string')
          : Array.isArray(modelsResult)
            ? modelsResult.filter((value) => typeof value === 'string')
            : [];

        const voiceList: VoicePreset[] = Array.isArray(voicesResult?.voices)
          ? voicesResult.voices
              .filter((voice: any) => voice && typeof voice === 'object' && typeof voice.id === 'string')
              .map((voice: any) => ({
                id: voice.id,
                label: voice.label || voice.name || voice.id,
                description: voice.description || voice.detail || null,
                language: voice.language || voice.locale || null,
                gender: voice.gender || null,
                tags: Array.isArray(voice.tags) ? voice.tags : [],
                default: voice.default === true,
                previewText: voice.previewText || voice.preview_text || null,
                sampleUrl: voice.sampleUrl || voice.sample_url || null,
              }))
          : [];

        const packsRaw = Array.isArray(sfxResult?.packs) ? sfxResult.packs : Array.isArray(sfxResult) ? sfxResult : [];
        const sfxPacks: SfxPack[] = packsRaw
          .filter((pack: any) => pack && typeof pack === 'object' && typeof pack.id === 'string')
          .map((pack: any) => {
            const categories: Record<string, SfxClip[]> = {};
            const rawCategories = pack.categories || pack.clips || pack.sfx || {};
            if (rawCategories && typeof rawCategories === 'object') {
              Object.entries(rawCategories).forEach(([key, value]) => {
                if (!Array.isArray(value)) return;
                categories[key] = value
                  .map((clip: any) => ({
                    id: typeof clip.id === 'string' ? clip.id : `${pack.id}-${key}-${Math.random().toString(36).slice(2)}`,
                    label: clip.label || clip.name || null,
                    url: typeof clip.url === 'string' ? clip.url : null,
                    base64: typeof clip.base64 === 'string' ? clip.base64 : typeof clip.data === 'string' ? clip.data : null,
                    mimeType:
                      typeof clip.mimeType === 'string'
                        ? clip.mimeType
                        : typeof clip.mime_type === 'string'
                          ? clip.mime_type
                          : null,
                    gain: Number.isFinite(clip.gain) ? Number(clip.gain) : null,
                    tags: Array.isArray(clip.tags) ? clip.tags : [],
                  }))
                  .filter((clip: SfxClip) => clip.url || clip.base64);
              });
            }
            return {
              id: pack.id,
              label: pack.label || pack.name || pack.id,
              description: pack.description || pack.detail || null,
              tags: Array.isArray(pack.tags) ? pack.tags : [],
              categories,
              default: pack.default === true,
            };
          });

        const defaultPackId =
          typeof sfxResult?.defaultPackId === 'string'
            ? sfxResult.defaultPackId
            : typeof sfxResult?.default_pack_id === 'string'
              ? sfxResult.default_pack_id
              : sfxPacks.find((pack) => pack.default)?.id || null;

        setCatalog({
          models: modelIds,
          voices: voiceList,
          sfxPacks,
          defaultSfxPackId: defaultPackId,
        });
        setCatalogStatus('idle');
        setCatalogError(null);
      } catch (error: any) {
        console.warn('[audio] Unable to load audio catalog', error);
        setCatalogStatus('error');
        setCatalogError(error instanceof Error ? error.message : OFFLINE_MESSAGE);
      }
    },
    [catalogStatus, settings.sfxLowStimMode],
  );

  useEffect(() => {
    fetchCatalog(false);
  }, [fetchCatalog]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleUpdate = (event: Event) => {
      const custom = event as CustomEvent<AudioSettings | undefined>;
      if (custom.detail) {
        setSettings(custom.detail);
      } else {
        setSettings(loadAudioSettings());
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LS_AUDIO_SETTINGS) {
        setSettings(loadAudioSettings());
      }
    };
    window.addEventListener(AUDIO_SETTINGS_EVENT, handleUpdate as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(AUDIO_SETTINGS_EVENT, handleUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const ensureModel = useCallback(() => effectiveModel, [effectiveModel]);

  const makeCacheKey = useCallback(
    (text: string, overrides: Partial<PlayTextOptions>) => {
      const model = overrides.model || effectiveModel || '';
      const voice = overrides.voiceId || settings.narrationVoiceId || '';
      const language = overrides.language || settings.narrationLanguage || '';
      const rate = overrides.speakingRate || settings.speakingRate || 1;
      const pitch = overrides.pitch || settings.pitch || 0;
      return JSON.stringify({ text, model, voice, language, rate, pitch });
    },
    [effectiveModel, settings.narrationLanguage, settings.narrationVoiceId, settings.pitch, settings.speakingRate],
  );

  const fetchClip = useCallback(
    async (text: string, overrides: Partial<PlayTextOptions>): Promise<{ url: string; revoke: () => void } | null> => {
      if (!text || !text.trim()) return null;
      const model = overrides.model || ensureModel();
      if (!model) return null;
      if (!isMathGalaxyConfigured || (!runtime?.serverHasKey && !runtime?.aiEnabled)) {
        throw new MathGalaxyApiError(OFFLINE_MESSAGE);
      }
      const key = makeCacheKey(text, overrides);
      const existing = clipCache.current.get(key);
      if (existing) return existing;

      const voiceId = overrides.voiceId || settings.narrationVoiceId || null;
      const speakingRate = overrides.speakingRate || settings.speakingRate;
      const pitch = overrides.pitch ?? settings.pitch;
      const language = overrides.language || settings.narrationLanguage;

      const payload: Record<string, unknown> = {
        text,
        model,
        speakingRate,
        speaking_rate: speakingRate,
        pitch,
        language,
      };
      if (voiceId) {
        payload.voice = voiceId;
        payload.voiceId = voiceId;
      }

      const response = await synthesizeSpeech(payload);
      if (!response || !response.buffer) {
        throw new Error('TTS response missing audio payload.');
      }

      const playable = response.base64
        ? createObjectUrlFromBase64(response.base64, response.mimeType)
        : createObjectUrlFromBuffer(response.buffer, response.mimeType);
      clipCache.current.set(key, playable);
      return playable;
    },
    [ensureModel, makeCacheKey, runtime?.aiEnabled, runtime?.serverHasKey, settings.narrationLanguage, settings.narrationVoiceId, settings.pitch, settings.speakingRate],
  );

  const playClip = useCallback(
    async (clip: { url: string; revoke: () => void }, volume?: number) => {
      stopNarration();
      const audio = new Audio(clip.url);
      audio.volume = normalizeVolume(volume ?? settings.narrationVolume, settings.narrationVolume);
      narrationRef.current = audio;
      try {
        await audio.play();
        await new Promise<void>((resolve, reject) => {
          const handleEnd = () => {
            audio.removeEventListener('ended', handleEnd);
            audio.removeEventListener('error', handleError);
            resolve();
          };
          const handleError = (event: Event) => {
            audio.removeEventListener('ended', handleEnd);
            audio.removeEventListener('error', handleError);
            reject(event);
          };
          audio.addEventListener('ended', handleEnd);
          audio.addEventListener('error', handleError);
        });
      } finally {
        audio.pause();
        audio.src = '';
        narrationRef.current = null;
      }
    },
    [settings.narrationVolume, stopNarration],
  );

  const speakText = useCallback(
    async (options: PlayTextOptions) => {
      if (!settings.narrationEnabled) return;
      const clip = await fetchClip(options.text, options);
      if (!clip) return;
      try {
        await playClip(clip, options.volume);
      } catch (error) {
        console.warn('[audio] Unable to play narration clip', error);
        clearNarrationClip(makeCacheKey(options.text, options));
      }
    },
    [clearNarrationClip, fetchClip, makeCacheKey, playClip, settings.narrationEnabled],
  );

  const speakProblem = useCallback(
    async (card: { a: number; b: number }, meta: { theme?: string | null; story?: string | null } = {}) => {
      if (!settings.narrationEnabled) return;
      const languageKey = toLanguageKey(settings.narrationLanguage);
      const intro =
        languageKey === 'ro'
          ? `Cât face ${card.a} plus ${card.b}? Gândește-te la povestea noastră${meta.story ? ': ' : '.'}${meta.story || ''}`
          : `What is ${card.a} plus ${card.b}? Think about our story${meta.story ? ': ' : '.'}${meta.story || ''}`;
      await speakText({ text: intro, type: 'problem' });
      if (settings.repeatNumbers) {
        const sequence = Array.from({ length: card.b }, (_, index) => card.a + index + 1);
        const sequenceText = sequence.join(', ');
        const followup =
          languageKey === 'ro'
            ? `Hai să numărăm împreună: ${card.a}, ${sequenceText}.`:
              `Let’s count together: ${card.a}, ${sequenceText}.`;
        await speakText({ text: followup, type: 'counting', speakingRate: settings.speakingRate * 0.95 });
      }
    },
    [settings.narrationEnabled, settings.narrationLanguage, settings.repeatNumbers, settings.speakingRate, speakText],
  );

  const speakHint = useCallback(
    async (hintText: string) => {
      if (!settings.narrationEnabled) return;
      if (!hintText) return;
      await speakText({ text: hintText, type: 'hint', speakingRate: settings.speakingRate * 0.95 });
    },
    [settings.narrationEnabled, settings.speakingRate, speakText],
  );

  const speakMiniLesson = useCallback(
    async (lessonKey: string) => {
      if (!settings.narrationEnabled) return;
      const languageKey = toLanguageKey(settings.narrationLanguage);
      const bank = languageKey === 'ro' ? MINI_LESSONS_RO : MINI_LESSONS_EN;
      const text = bank[lessonKey] || bank['count-on'];
      await speakText({ text, type: 'mini-lesson' });
    },
    [settings.narrationEnabled, settings.narrationLanguage, speakText],
  );

  const speakFeedback = useCallback(
    async (correct: boolean) => {
      if (!settings.narrationEnabled || !settings.feedbackVoiceEnabled) return;
      const languageKey = toLanguageKey(settings.narrationLanguage);
      const lines = correct
        ? languageKey === 'ro'
          ? PRAISE_LINES_RO
          : PRAISE_LINES_EN
        : languageKey === 'ro'
          ? ENCOURAGE_LINES_RO
          : ENCOURAGE_LINES_EN;
      const text = randomFrom(lines);
      if (!text) return;
      await speakText({ text, type: correct ? 'praise' : 'encouragement' });
    },
    [settings.feedbackVoiceEnabled, settings.narrationEnabled, settings.narrationLanguage, speakText],
  );

  const resolveSfxClip = useCallback(
    (category: string): SfxClip | null => {
      if (!settings.sfxEnabled) return null;
      const packs = catalog.sfxPacks || [];
      const selectedPackId = settings.sfxPackId || catalog.defaultSfxPackId || (packs[0]?.id ?? null);
      const pack = packs.find((item) => item.id === selectedPackId) || packs[0];
      if (!pack) return null;
      const directClips = pack.categories?.[category] || [];
      if (directClips.length) {
        return directClips[Math.floor(Math.random() * directClips.length)] || null;
      }
      const synonyms = DEFAULT_SFX_CATEGORY_MAPPING[category] || [];
      for (const synonym of synonyms) {
        const clips = pack.categories?.[synonym];
        if (clips?.length) {
          return clips[Math.floor(Math.random() * clips.length)] || null;
        }
      }
      return null;
    },
    [catalog.defaultSfxPackId, catalog.sfxPacks, settings.sfxEnabled, settings.sfxPackId],
  );

  const playSfx = useCallback(
    async (category: 'success' | 'error' | 'progress') => {
      if (!settings.sfxEnabled) return;
      const clip = resolveSfxClip(category);
      if (!clip) return;
      try {
        let audio: HTMLAudioElement | null = null;
        if (clip.url) {
          audio = new Audio(clip.url);
        } else if (clip.base64) {
          const playable = createObjectUrlFromBase64(clip.base64, clip.mimeType || undefined);
          audio = new Audio(playable.objectUrl);
          audio.addEventListener('ended', () => playable.revoke(), { once: true });
          audio.addEventListener('error', () => playable.revoke(), { once: true });
        }
        if (!audio) return;
        const gain = clip.gain != null && Number.isFinite(clip.gain) ? Number(clip.gain) : 1;
        audio.volume = normalizeVolume(settings.sfxVolume * gain, settings.sfxVolume);
        await audio.play();
        sfxPlayersRef.current.set(category, audio);
      } catch (error) {
        console.warn('[audio] Unable to play SFX clip', error);
      }
    },
    [resolveSfxClip, settings.sfxEnabled, settings.sfxVolume],
  );

  return {
    settings,
    updateSettings,
    speakText,
    speakProblem,
    speakHint,
    speakMiniLesson,
    speakFeedback,
    playSfx,
    stopNarration,
    fetchCatalog,
    catalog,
    catalogStatus,
    catalogError,
    getVoicePreset,
    effectiveModel,
  };
}
