import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAudioSfx, fetchTtsModels, fetchTtsVoices } from '../../services/audioCatalog';
import { AUDIO_SETTINGS_EVENT, LS_AUDIO_SETTINGS, loadAudioSettings, saveAudioSettings, type AudioSettings } from './preferences';
import { createObjectUrlFromBase64 } from './utils';
import { speak, stopSpeaking } from '../tts';
import { showToast } from '../ui/toast';
import type { AiRuntimeState } from '../ai/runtime';
import { playEncouragement, playLowStim, playSuccess } from '../sfx/synth';
import {
  ENCOURAGE_LINES_EN,
  ENCOURAGE_LINES_RO,
  MINI_LESSONS_EN,
  MINI_LESSONS_RO,
  OFFLINE_MESSAGE,
  PRAISE_LINES_EN,
  PRAISE_LINES_RO,
  UI_TEXT,
  buildCountingPrompt,
  buildProblemPrompt,
} from './phrases';
import { warmupNarrationCache } from './warmup';

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

const DEFAULT_SFX_CATEGORY_MAPPING: Record<string, string[]> = {
  success: ['success', 'celebration', 'correct', 'victory'],
  error: ['error', 'incorrect', 'retry', 'try-again'],
  progress: ['progress', 'streak', 'level-up', 'checkpoint'],
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
  const sfxPlayersRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [narrationNotice, setNarrationNotice] = useState<string | null>(null);

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

  useEffect(() => {
    if (!settings.narrationEnabled) return undefined;
    const controller = new AbortController();
    warmupNarrationCache({
      language: settings.narrationLanguage || null,
      voiceId: settings.narrationVoiceId || null,
      speakingRate: settings.speakingRate ?? null,
      pitch: settings.pitch ?? null,
      model: effectiveModel,
      additionMax: 9,
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [
    effectiveModel,
    settings.narrationEnabled,
    settings.narrationLanguage,
    settings.narrationVoiceId,
    settings.pitch,
    settings.speakingRate,
  ]);

  const updateSettings = useCallback(
    (next: Partial<AudioSettings>) => {
      setSettings(saveAudioSettings(next));
    },
    [],
  );

  const stopNarration = useCallback(() => {
    stopSpeaking();
  }, []);

  useEffect(() => () => stopNarration(), [stopNarration]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!narrationNotice) return undefined;
    const timeout = window.setTimeout(() => setNarrationNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [narrationNotice]);

  const getVoicePreset = useCallback(
    (voiceId: string | null | undefined): VoicePreset | null => {
      if (!voiceId) return null;
      return catalog.voices.find((voice) => voice.id === voiceId) || null;
    },
    [catalog.voices],
  );

  const fetchCatalog = useCallback(
    async (force = false) => {
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

  const speakText = useCallback(
    async (options: PlayTextOptions) => {
      if (!settings.narrationEnabled) return;
      const content = options.text?.trim();
      if (!content) return;

      stopNarration();

      const voiceId = options.voiceId || settings.narrationVoiceId || null;
      const voicePreset = getVoicePreset(voiceId);
      const language = options.language || settings.narrationLanguage || undefined;
      const speakingRate = options.speakingRate ?? settings.speakingRate ?? 1;
      const pitch = options.pitch ?? settings.pitch ?? 1;
      const volume = normalizeVolume(options.volume ?? settings.narrationVolume, settings.narrationVolume);
      const model = options.model || effectiveModel || null;

      try {
        const result = await speak({
          text: content,
          lang: language || undefined,
          voiceName: voicePreset?.id || voiceId || undefined,
          rate: speakingRate,
          pitch,
          volume,
          model,
          kind: options.type || null,
          allowBrowserFallback: settings.browserVoiceFallback === true,
        });

        if (result.mode === 'server') {
          setNarrationNotice(null);
        } else if (result.mode === 'webspeech') {
          setNarrationNotice(UI_TEXT.webSpeechFallback);
        } else {
          setNarrationNotice(UI_TEXT.deviceVoiceUnavailable);
        }
      } catch (error) {
        console.warn('[audio] Unable to speak text', error);
        if (error instanceof Error && error.message === 'tts_unavailable') {
          const message = UI_TEXT.ttsUnavailable;
          setNarrationNotice(message);
          showToast({ level: 'error', message });
        } else {
          const message = UI_TEXT.genericPlaybackError;
          setNarrationNotice(message);
          showToast({ level: 'error', message: 'Unable to play narration audio. Check your connection.' });
        }
      }
    },
    [
      effectiveModel,
      getVoicePreset,
      settings.narrationEnabled,
      settings.narrationLanguage,
      settings.narrationVoiceId,
      settings.narrationVolume,
      settings.pitch,
      settings.speakingRate,
      settings.browserVoiceFallback,
      stopNarration,
    ],
  );

  const speakProblem = useCallback(
    async (card: { a: number; b: number }, meta: { theme?: string | null; story?: string | null } = {}) => {
      if (!settings.narrationEnabled) return;
      const languageKey = toLanguageKey(settings.narrationLanguage);
      const question = buildProblemPrompt(card.a, card.b, settings.narrationLanguage);
      const storyLine = meta.story
        ? languageKey === 'ro'
          ? ` Povestea spune: ${meta.story}`
          : ` Think about our story: ${meta.story}`
        : '';
      const intro = `${question}${storyLine}`;
      await speakText({ text: intro, type: 'problem' });
      if (settings.repeatNumbers) {
        const followup = buildCountingPrompt(card.a, card.b, settings.narrationLanguage);
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

  const playSynthFallback = useCallback(
    (category: 'success' | 'error' | 'progress') => {
      if (settings.sfxLowStimMode) {
        return playLowStim();
      }
      if (category === 'error') {
        return playEncouragement();
      }
      return playSuccess();
    },
    [settings.sfxLowStimMode],
  );

  const playSfx = useCallback(
    async (category: 'success' | 'error' | 'progress') => {
      if (!settings.sfxEnabled) return;
      const clip = resolveSfxClip(category);
      if (!clip) {
        await playSynthFallback(category);
        return;
      }
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
        if (!audio) {
          await playSynthFallback(category);
          return;
        }
        const gain = clip.gain != null && Number.isFinite(clip.gain) ? Number(clip.gain) : 1;
        const baseVolume = settings.sfxLowStimMode
          ? Math.min(settings.sfxVolume, 0.2)
          : settings.sfxVolume;
        audio.volume = normalizeVolume(baseVolume * gain, baseVolume);
        await audio.play();
        sfxPlayersRef.current.set(category, audio);
      } catch (error) {
        console.warn('[audio] Unable to play SFX clip', error);
        await playSynthFallback(category);
      }
    },
    [playSynthFallback, resolveSfxClip, settings.sfxEnabled, settings.sfxVolume],
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
    narrationNotice,
  };
}
