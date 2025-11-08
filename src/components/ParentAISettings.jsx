import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Lock, ShieldCheck, CheckCircle2, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { loadAiConfig, saveAiConfig, getAiRuntime } from '../lib/ai/runtime';
import { saveGeminiKey, testGeminiKey } from '../services/aiPlanner';
import { isAiProxyConfigured } from '../services/aiEndpoints';
import { MathGalaxyApiError } from '../services/mathGalaxyClient';
import { loadAudioSettings, saveAudioSettings } from '../lib/audio/preferences';
import { fetchAudioSfx, fetchTtsModels, fetchTtsVoices, synthesizeSpeech } from '../services/audioCatalog';
import { createObjectUrlFromBase64, extractAudioFromResponse } from '../lib/audio/utils';

const PLANNING_MODEL_OPTIONS = ['gemini-2.5-pro', 'gemini-2.5-flash'];
const SPRITE_MODEL_OPTIONS = ['gemini-2.5-flash-image'];
const AUDIO_MODEL_OPTIONS = ['gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-preview-tts'];
const LANGUAGE_LABELS = {
  ro: 'Română',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiană',
  pt: 'Português',
};
const SFX_CATEGORY_SYNONYMS = {
  success: ['success', 'celebration', 'correct', 'victory'],
  error: ['error', 'incorrect', 'retry', 'try-again'],
  progress: ['progress', 'streak', 'level-up', 'checkpoint'],
};

const API_OFFLINE_MESSAGE = 'API offline sau URL greșit. Verifică VITE_MATH_API_URL.';

const initialRuntime = {
  aiEnabled: false,
  serverHasKey: false,
  planningModel: null,
  spriteModel: null,
  audioModel: null,
  aiAllowed: true,
  lastError: null,
  defaultTtsModel: null,
  allowedTtsModels: [],
  runtimeLabel: null,
  note: null,
};

const StatusChip = ({ active }) => (
  <span
    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
      active ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
    }`}
  >
    <span
      className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-400'}`}
      aria-hidden="true"
    />
    {active ? 'AI Enabled' : 'AI Disabled'}
  </span>
);

const canonicalizeLanguageCode = (code) => {
  if (!code || typeof code !== 'string') return null;
  const trimmed = code.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/_/g, '-');
  const parts = normalized.split('-');
  const primary = parts[0]?.toLowerCase?.() || '';
  if (!primary) return null;
  const region = parts[1] ? parts[1].toUpperCase() : null;
  if (region) {
    return `${primary}-${region}`;
  }
  if (primary === 'ro') return 'ro-RO';
  if (primary === 'en') return 'en-US';
  if (primary.length === 2) {
    return `${primary}-${primary.toUpperCase()}`;
  }
  return normalized;
};

const describeLanguageOption = (code) => {
  if (!code || typeof code !== 'string') return '';
  const parts = code.split('-');
  const base = parts[0]?.toLowerCase?.() || '';
  const label = LANGUAGE_LABELS[base];
  if (label) {
    return `${label} (${code})`;
  }
  return code;
};

export default function ParentAISettings({ onClose, onSaved }) {
  const [keyInput, setKeyInput] = useState('');
  const [planningModel, setPlanningModel] = useState('');
  const [spriteModel, setSpriteModel] = useState('gemini-2.5-flash-image');
  const [audioModel, setAudioModel] = useState('');
  const [aiAllowed, setAiAllowed] = useState(true);
  const [runtime, setRuntime] = useState(initialRuntime);
  const [keyStatus, setKeyStatus] = useState({ state: 'idle', message: null });
  const [keyWarning, setKeyWarning] = useState(null);
  const [testStatus, setTestStatus] = useState({ state: 'idle', message: null, ok: null });
  const [modelStatus, setModelStatus] = useState({ state: 'idle', message: null });
  const [fieldErrors, setFieldErrors] = useState({ planningModel: null, spriteModel: null });
  const [audioSettings, setAudioSettings] = useState(() => loadAudioSettings());
  const [audioStatus, setAudioStatus] = useState({ state: 'idle', message: null });
  const [catalogStatus, setCatalogStatus] = useState({ state: 'idle', message: null });
  const [audioCatalog, setAudioCatalog] = useState({ models: [], voices: [], sfxPacks: [], defaultSfxPackId: null });
  const [previewStatus, setPreviewStatus] = useState({ state: 'idle', message: null });
  const [sfxPreviewStatus, setSfxPreviewStatus] = useState({ state: 'idle', message: null });
  const previewVoiceRef = useRef({ audio: null, revoke: null });
  const previewSfxRef = useRef({ audio: null, revoke: null });
  const aiProxyConfigured = useMemo(() => isAiProxyConfigured(), []);

  const describeVoice = useCallback((voice) => {
    if (!voice) return '';
    const bits = [];
    if (voice.language) bits.push(voice.language);
    if (voice.gender) bits.push(voice.gender);
    if (Array.isArray(voice.tags) && voice.tags.length) {
      const highlights = voice.tags
        .filter((tag) => ['child', 'childlike', 'friendly', 'low-stim', 'soothing', 'energetic'].includes(tag))
        .map((tag) => tag.replace(/-/g, ' '));
      if (highlights.length) bits.push(highlights.join(', '));
    }
    return bits.length ? `${voice.label} (${bits.join(' · ')})` : voice.label;
  }, []);

  const cleanupPreviewVoice = useCallback(() => {
    const current = previewVoiceRef.current;
    if (current.audio) {
      try {
        current.audio.pause();
        current.audio.src = '';
      } catch (error) {
        // ignore cleanup issues
      }
    }
    if (typeof current.revoke === 'function') {
      current.revoke();
    }
    previewVoiceRef.current = { audio: null, revoke: null };
  }, []);

  const cleanupPreviewSfx = useCallback(() => {
    const current = previewSfxRef.current;
    if (current.audio) {
      try {
        current.audio.pause();
        current.audio.src = '';
      } catch (error) {
        // ignore cleanup issues
      }
    }
    if (typeof current.revoke === 'function') {
      current.revoke();
    }
    previewSfxRef.current = { audio: null, revoke: null };
  }, []);

  useEffect(() => () => {
    cleanupPreviewVoice();
    cleanupPreviewSfx();
  }, [cleanupPreviewSfx, cleanupPreviewVoice]);

  const loadAudioCatalog = useCallback(async () => {
    if (!aiProxyConfigured) {
      setAudioCatalog({ models: [], voices: [], sfxPacks: [], defaultSfxPackId: null });
      setCatalogStatus({ state: 'error', message: API_OFFLINE_MESSAGE });
      return;
    }

    if (runtime.lastError) {
      setAudioCatalog({ models: [], voices: [], sfxPacks: [], defaultSfxPackId: null });
      setCatalogStatus({ state: 'error', message: runtime.lastError || API_OFFLINE_MESSAGE });
      return;
    }

    if (!runtime.serverHasKey) {
      setAudioCatalog({ models: [], voices: [], sfxPacks: [], defaultSfxPackId: null });
      setCatalogStatus({
        state: 'idle',
        message: 'Adaugă cheia Gemini pentru a încărca modelele audio.',
      });
      return;
    }

    setCatalogStatus({ state: 'loading', message: 'Se încarcă vocile și sunetele…' });
    try {
      const [modelsResult, voicesResult, sfxResult] = await Promise.all([
        fetchTtsModels().catch(() => null),
        fetchTtsVoices({ mode: audioSettings.sfxLowStimMode ? 'low-stim' : undefined }).catch(() => null),
        fetchAudioSfx({ mode: audioSettings.sfxLowStimMode ? 'low-stim' : undefined }).catch(() => null),
      ]);

      const modelIds = Array.isArray(modelsResult?.models)
        ? modelsResult.models.filter((value) => typeof value === 'string')
        : Array.isArray(modelsResult)
          ? modelsResult.filter((value) => typeof value === 'string')
          : [];

      const voices = Array.isArray(voicesResult?.voices)
        ? voicesResult.voices
            .filter((voice) => voice && typeof voice === 'object' && typeof voice.id === 'string')
            .map((voice) => ({
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

      const packsRaw = Array.isArray(sfxResult?.packs)
        ? sfxResult.packs
        : Array.isArray(sfxResult)
          ? sfxResult
          : [];

      const sfxPacks = packsRaw
        .filter((pack) => pack && typeof pack === 'object' && typeof pack.id === 'string')
        .map((pack) => {
          const categories = {};
          const rawCategories = pack.categories || pack.clips || pack.sfx || {};
          if (rawCategories && typeof rawCategories === 'object') {
            Object.entries(rawCategories).forEach(([key, value]) => {
              if (!Array.isArray(value)) return;
              categories[key] = value
                .map((clip) => ({
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
                .filter((clip) => clip.url || clip.base64);
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

      setAudioCatalog({ models: modelIds, voices, sfxPacks, defaultSfxPackId: defaultPackId });
      setCatalogStatus({ state: 'success', message: null });
    } catch (error) {
      const message =
        error instanceof MathGalaxyApiError || error instanceof TypeError
          ? API_OFFLINE_MESSAGE
          : error?.message || 'Nu am putut încărca catalogul audio.';
      setCatalogStatus({ state: 'error', message });
    }
  }, [aiProxyConfigured, audioSettings.sfxLowStimMode, runtime.lastError, runtime.serverHasKey]);

  useEffect(() => {
    loadAudioCatalog();
  }, [loadAudioCatalog]);

  const audioModelOptionsList = useMemo(() => {
    const models = new Set();
    AUDIO_MODEL_OPTIONS.forEach((model) => models.add(model));
    if (runtime.audioModel) models.add(runtime.audioModel);
    if (runtime.defaultTtsModel) models.add(runtime.defaultTtsModel);
    if (Array.isArray(runtime.allowedTtsModels)) {
      runtime.allowedTtsModels.forEach((model) => models.add(model));
    }
    audioCatalog.models.forEach((model) => {
      if (typeof model === 'string') models.add(model);
    });
    if (audioModel) {
      models.add(audioModel);
    }
    return Array.from(models).filter(Boolean);
  }, [audioCatalog.models, audioModel, runtime.allowedTtsModels, runtime.audioModel, runtime.defaultTtsModel]);

  const voiceLanguageOptions = useMemo(() => {
    const languages = new Set();
    const addLanguage = (value) => {
      const canonical = canonicalizeLanguageCode(value);
      if (canonical) {
        languages.add(canonical);
      }
    };
    audioCatalog.voices.forEach((voice) => {
      if (voice.language) addLanguage(voice.language);
    });
    addLanguage(audioSettings.narrationLanguage);
    addLanguage('ro-RO');
    addLanguage('en-US');
    return Array.from(languages).sort((a, b) => describeLanguageOption(a).localeCompare(describeLanguageOption(b), 'ro'));
  }, [audioCatalog.voices, audioSettings.narrationLanguage]);

  const handleVoiceChange = useCallback((event) => {
    const value = event.target.value;
    setAudioSettings((prev) => ({ ...prev, narrationVoiceId: value || null }));
  }, []);

  const handleLanguageChange = useCallback((event) => {
    const value = canonicalizeLanguageCode(event.target.value) || 'ro-RO';
    setAudioSettings((prev) => ({ ...prev, narrationLanguage: value }));
  }, []);

  const handleSfxPackChange = useCallback((event) => {
    const value = event.target.value;
    setAudioSettings((prev) => ({ ...prev, sfxPackId: value || null }));
  }, []);

  const handleNarrationVolumeChange = useCallback((event) => {
    setAudioSettings((prev) => ({ ...prev, narrationVolume: Number(event.target.value) }));
  }, []);

  const handleSfxVolumeChange = useCallback((event) => {
    setAudioSettings((prev) => ({ ...prev, sfxVolume: Number(event.target.value) }));
  }, []);

  const handleSpeakingRateChange = useCallback((event) => {
    setAudioSettings((prev) => ({ ...prev, speakingRate: Number(event.target.value) }));
  }, []);

  const handlePitchChange = useCallback((event) => {
    setAudioSettings((prev) => ({ ...prev, pitch: Number(event.target.value) }));
  }, []);

  const handlePreviewVoice = useCallback(async () => {
    cleanupPreviewVoice();
    setPreviewStatus({ state: 'loading', message: 'Generăm un exemplu vocal…' });
    try {
      const selectedVoiceId = audioSettings.narrationVoiceId || audioCatalog.voices.find((voice) => voice.default)?.id || (audioCatalog.voices[0]?.id ?? '');
      if (!selectedVoiceId) {
        setPreviewStatus({ state: 'error', message: 'Selectează o voce pentru previzualizare.' });
        return;
      }
      const voice = audioCatalog.voices.find((item) => item.id === selectedVoiceId);
      if (voice?.sampleUrl) {
        const audio = new Audio(voice.sampleUrl);
        audio.volume = Math.min(1, Math.max(0, audioSettings.narrationVolume));
        const cleanup = () => {
          if (previewVoiceRef.current.audio === audio) {
            previewVoiceRef.current = { audio: null, revoke: null };
          }
        };
        audio.addEventListener('ended', cleanup, { once: true });
        audio.addEventListener('error', cleanup, { once: true });
        previewVoiceRef.current = { audio, revoke: null };
        await audio.play();
        setPreviewStatus({ state: 'success', message: 'Redăm eșantionul vocal furnizat.' });
        return;
      }
      const modelCandidate =
        (audioModel && audioModel.trim()) ||
        audioSettings.narrationModel ||
        runtime.audioModel ||
        runtime.defaultTtsModel ||
        audioCatalog.models[0] ||
        AUDIO_MODEL_OPTIONS[0];
      if (!modelCandidate) {
        setPreviewStatus({ state: 'error', message: 'Nu există un model TTS disponibil pentru previzualizare.' });
        return;
      }
      const sampleText =
        voice?.previewText ||
        (audioSettings.narrationLanguage?.toLowerCase?.().startsWith('ro')
          ? 'Salut! Eu sunt vocea care va citi exercițiile tale de matematică.'
          : 'Hello! I am the voice that will read your math practice aloud.');
      const response = await synthesizeSpeech({
        text: sampleText,
        model: modelCandidate,
        voice: selectedVoiceId,
        voiceId: selectedVoiceId,
        speakingRate: audioSettings.speakingRate,
        pitch: audioSettings.pitch,
        language: audioSettings.narrationLanguage,
      });
      const clip = extractAudioFromResponse(response);
      if (!clip) {
        throw new Error('Răspunsul TTS nu conține audio.');
      }
      const playable = createObjectUrlFromBase64(clip.base64, clip.mimeType);
      const audio = new Audio(playable.objectUrl);
      audio.volume = Math.min(1, Math.max(0, audioSettings.narrationVolume));
      const cleanup = () => {
        playable.revoke();
        if (previewVoiceRef.current.audio === audio) {
          previewVoiceRef.current = { audio: null, revoke: null };
        }
      };
      audio.addEventListener('ended', cleanup, { once: true });
      audio.addEventListener('error', cleanup, { once: true });
      previewVoiceRef.current = { audio, revoke: playable.revoke };
      await audio.play();
      setPreviewStatus({ state: 'success', message: 'Redăm vocea selectată…' });
    } catch (error) {
      cleanupPreviewVoice();
      const message =
        error instanceof MathGalaxyApiError || error instanceof TypeError
          ? API_OFFLINE_MESSAGE
          : error?.message || 'Nu am putut reda vocea.';
      setPreviewStatus({ state: 'error', message });
    }
  }, [audioCatalog.models, audioCatalog.voices, audioModel, audioSettings.narrationLanguage, audioSettings.narrationModel, audioSettings.narrationVoiceId, audioSettings.narrationVolume, audioSettings.pitch, audioSettings.speakingRate, cleanupPreviewVoice, runtime.audioModel, runtime.defaultTtsModel]);

  const resolveSfxClip = useCallback(
    (category) => {
      const packs = audioCatalog.sfxPacks || [];
      const selectedPackId = audioSettings.sfxPackId || audioCatalog.defaultSfxPackId || (packs[0]?.id ?? null);
      const pack = packs.find((item) => item.id === selectedPackId) || packs[0];
      if (!pack) return null;
      const direct = Array.isArray(pack.categories?.[category]) ? pack.categories[category] : [];
      if (direct.length) {
        return direct[Math.floor(Math.random() * direct.length)] || null;
      }
      const synonyms = SFX_CATEGORY_SYNONYMS[category] || [];
      for (const synonym of synonyms) {
        const clips = Array.isArray(pack.categories?.[synonym]) ? pack.categories[synonym] : [];
        if (clips.length) {
          return clips[Math.floor(Math.random() * clips.length)] || null;
        }
      }
      return null;
    },
    [audioCatalog.defaultSfxPackId, audioCatalog.sfxPacks, audioSettings.sfxPackId],
  );

  const handlePreviewSfx = useCallback(
    async (category) => {
      cleanupPreviewSfx();
      setSfxPreviewStatus({ state: 'loading', message: 'Redăm sunetul selectat…' });
      try {
        const clip = resolveSfxClip(category);
        if (!clip) {
          setSfxPreviewStatus({ state: 'error', message: 'Nu există sunete pentru această categorie.' });
          return;
        }
        let audio = null;
        let revoke = null;
        if (clip.url) {
          audio = new Audio(clip.url);
        } else if (clip.base64) {
          const playable = createObjectUrlFromBase64(clip.base64, clip.mimeType || undefined);
          audio = new Audio(playable.objectUrl);
          revoke = playable.revoke;
        }
        if (!audio) {
          throw new Error('Clipul SFX nu are date valide.');
        }
        audio.volume = Math.min(1, Math.max(0, audioSettings.sfxVolume));
        const cleanup = () => {
          if (revoke) revoke();
          if (previewSfxRef.current.audio === audio) {
            previewSfxRef.current = { audio: null, revoke: null };
          }
        };
        audio.addEventListener('ended', cleanup, { once: true });
        audio.addEventListener('error', cleanup, { once: true });
        previewSfxRef.current = { audio, revoke };
        await audio.play();
        setSfxPreviewStatus({ state: 'success', message: 'Sunetul este redat…' });
      } catch (error) {
        cleanupPreviewSfx();
        const message =
          error instanceof MathGalaxyApiError || error instanceof TypeError
            ? API_OFFLINE_MESSAGE
            : error?.message || 'Nu am putut reda sunetul.';
        setSfxPreviewStatus({ state: 'error', message });
      }
    },
    [audioSettings.sfxVolume, cleanupPreviewSfx, resolveSfxClip],
  );

  const handleSaveAudio = useCallback(() => {
    setAudioStatus({ state: 'loading', message: null });
    try {
      const voice = audioCatalog.voices.find((item) => item.id === audioSettings.narrationVoiceId);
      const saved = saveAudioSettings({
        ...audioSettings,
        narrationVoiceId: audioSettings.narrationVoiceId || null,
        narrationVoiceLabel: voice ? voice.label : null,
        sfxPackId: audioSettings.sfxPackId || null,
      });
      setAudioSettings(saved);
      setAudioStatus({ state: 'success', message: 'Setările audio au fost salvate.' });
    } catch (error) {
      const message = error?.message || 'Nu am putut salva setările audio.';
      setAudioStatus({ state: 'error', message });
    }
  }, [audioCatalog.voices, audioSettings]);

  const applyConfig = useCallback(() => {
    const cfg = loadAiConfig();
    setPlanningModel(cfg.planningModel || '');
    setSpriteModel(cfg.spriteModel || 'gemini-2.5-flash-image');
    setAudioModel(cfg.audioModel || '');
    setAiAllowed(cfg.aiAllowed !== false);
  }, []);

  const syncRuntime = useCallback(
    async (notify = false) => {
      const next = await getAiRuntime();
      setRuntime(next);
      setKeyWarning(next.note || null);
      setPlanningModel((prev) => {
        const trimmed = typeof prev === 'string' ? prev.trim() : '';
        return trimmed ? prev : next.planningModel || '';
      });
      setSpriteModel((prev) => {
        const trimmed = typeof prev === 'string' ? prev.trim() : '';
        return trimmed ? prev : next.spriteModel || 'gemini-2.5-flash-image';
      });
      setAudioModel((prev) => {
        const trimmed = typeof prev === 'string' ? prev.trim() : '';
        return trimmed ? prev : next.audioModel || '';
      });
      setAiAllowed(next.aiAllowed !== false);
      setAudioSettings((prev) => {
        const target = next.audioModel || next.defaultTtsModel || prev.narrationModel || null;
        if (!target || prev.narrationModel === target) {
          return prev;
        }
        return saveAudioSettings({ narrationModel: target });
      });
      if (notify) {
        onSaved?.(next);
      }
      return next;
    },
    [onSaved],
  );

  useEffect(() => {
    applyConfig();
    syncRuntime(false);
  }, [applyConfig, syncRuntime]);

  const runHealthCheck = useCallback(
    async (notify = false) => {
      setTestStatus({ state: 'loading', ok: null, message: null });
      try {
        const response = await testGeminiKey();
        const ok = Boolean(response?.have_key ?? response?.haveKey ?? response?.server_has_key);
        const message = ok
          ? 'Gemini key detected on server.'
          : response?.error || response?.message || 'Gemini key missing on server.';
        setTestStatus({ state: 'success', ok, message });
        await syncRuntime(notify);
      } catch (error) {
        const message =
          error instanceof MathGalaxyApiError || error instanceof TypeError
            ? API_OFFLINE_MESSAGE
            : error?.message || API_OFFLINE_MESSAGE;
        setTestStatus({ state: 'error', ok: false, message });
        await syncRuntime(notify);
      }
    },
    [syncRuntime],
  );

  const handleSaveKey = useCallback(async () => {
    if (!keyInput.trim()) {
      setKeyStatus({ state: 'error', message: 'Please paste a valid Google Gemini API key.' });
      return;
    }
    setKeyStatus({ state: 'loading', message: null });
    try {
      const response = await saveGeminiKey(keyInput.trim());
      const message = response?.message
        || (response?.ok ? 'API key saved securely.' : null)
        || 'API key saved securely.';
      setKeyStatus({ state: 'success', message });
      setKeyWarning(response?.note || null);
      setKeyInput('');
      await runHealthCheck(true);
    } catch (error) {
      const message =
        error instanceof MathGalaxyApiError || error instanceof TypeError
          ? API_OFFLINE_MESSAGE
          : error?.message || 'We could not save the API key. Please try again.';
      setKeyStatus({ state: 'error', message });
      setKeyWarning(null);
    }
  }, [keyInput, runHealthCheck]);

  const handleSaveModels = useCallback(async () => {
    const nextErrors = {
      planningModel: planningModel.trim() ? null : 'Planning model is required.',
      spriteModel: spriteModel.trim() ? null : 'Sprite model is required.',
    };
    setFieldErrors(nextErrors);
    if (nextErrors.planningModel || nextErrors.spriteModel) {
      setModelStatus({ state: 'error', message: 'Please provide required models before saving.' });
      return;
    }

    setModelStatus({ state: 'loading', message: null });
    try {
      saveAiConfig({
        planningModel: planningModel.trim(),
        spriteModel: spriteModel.trim(),
        audioModel: audioModel.trim() ? audioModel.trim() : null,
        aiAllowed,
      });
      setModelStatus({ state: 'success', message: 'Model preferences saved.' });
      await syncRuntime(true);
    } catch (error) {
      setModelStatus({ state: 'error', message: error.message || 'Unable to save model preferences.' });
    }
  }, [aiAllowed, audioModel, planningModel, spriteModel, syncRuntime]);

  const toggleAiAllowed = useCallback(() => {
    setAiAllowed((prev) => !prev);
    setModelStatus({ state: 'idle', message: null });
  }, []);

  const aiToggleLabel = useMemo(() => (aiAllowed ? 'AI features will run when enabled.' : 'AI features are paused until you re-enable them.'), [aiAllowed]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-800">AI Settings</h2>
              <StatusChip active={runtime.aiEnabled} />
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Key configured on server: <span className="font-semibold">{runtime.serverHasKey ? 'Yes' : 'No'}</span></p>
              <p>AI enabled: <span className="font-semibold">{runtime.aiEnabled ? 'Yes' : 'No'}</span> (needs key + planning model + sprite model + toggle on)</p>
              {runtime.lastError && (
                <p className="text-red-600 font-medium flex items-center gap-2">
                  <AlertCircle size={14} /> {runtime.lastError}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
            aria-label="Close AI settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex gap-3">
          <Lock className="text-indigo-500" size={24} />
          <div className="text-sm text-indigo-800 space-y-1">
            <p className="font-semibold">Why we need this</p>
            <p>
              We use your key only on the server (the browser never sees it). Planning runs on text models, while sprite batches use Gemini image models. Pick any Gemini model name or select one from the list.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700" htmlFor="gemini-key">
            Google Gemini API key
          </label>
          <input
            id="gemini-key"
            type="password"
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSaveKey}
              disabled={keyStatus.state === 'loading'}
              className={`px-5 py-3 rounded-xl font-semibold text-white shadow ${
                keyStatus.state === 'loading' ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {keyStatus.state === 'loading' ? (
                <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Saving…</span>
              ) : (
                'Save API key'
              )}
            </button>
            <button
              onClick={() => runHealthCheck(true)}
              disabled={testStatus.state === 'loading'}
              className={`px-5 py-3 rounded-xl font-semibold border-2 shadow-sm ${
                testStatus.state === 'loading'
                  ? 'border-gray-300 text-gray-500 cursor-wait'
                  : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              {testStatus.state === 'loading' ? (
                <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Testing…</span>
              ) : (
                'Test key'
              )}
            </button>
          </div>
          {keyStatus.state === 'success' && keyStatus.message && (
            <div className="flex items-start gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-2xl p-4">
              <ShieldCheck className="text-green-500" size={18} />
              <span>{keyStatus.message}</span>
            </div>
          )}
          {keyWarning && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <AlertTriangle className="text-amber-500" size={18} />
              <span>{keyWarning}</span>
            </div>
          )}
          {keyStatus.state === 'error' && keyStatus.message && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3">
              {keyStatus.message}
            </div>
          )}
          {testStatus.state !== 'idle' && testStatus.message && (
            <div
              className={`flex items-center gap-2 text-sm rounded-2xl border px-3 py-2 ${
                testStatus.ok
                  ? 'text-green-600 bg-green-50 border-green-200'
                  : 'text-red-600 bg-red-50 border-red-200'
              }`}
            >
              {testStatus.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testStatus.message}</span>
            </div>
          )}
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700" htmlFor="planning-model">
              Planning / thinking model
            </label>
            <input
              id="planning-model"
              type="text"
              list="planning-model-options"
              value={planningModel}
              onChange={(event) => setPlanningModel(event.target.value)}
              placeholder="gemini-2.5-pro"
              className={`w-full px-4 py-3 border-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                fieldErrors.planningModel ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {fieldErrors.planningModel && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.planningModel}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700" htmlFor="sprite-model">
              Sprite generation model
            </label>
            <input
              id="sprite-model"
              type="text"
              list="sprite-model-options"
              value={spriteModel}
              onChange={(event) => setSpriteModel(event.target.value)}
              placeholder="gemini-2.5-flash-image"
              className={`w-full px-4 py-3 border-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                fieldErrors.spriteModel ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {fieldErrors.spriteModel && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.spriteModel}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700" htmlFor="audio-model">
              Audio / TTS model
            </label>
            <input
              id="audio-model"
              type="text"
              list="audio-model-options"
              value={audioModel}
              onChange={(event) => setAudioModel(event.target.value)}
              placeholder="gemini-2.5-pro-preview-tts"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="mt-1 text-xs text-gray-500">
              Lăsă câmpul gol pentru a folosi modelul implicit expus de server. Poți forța un model TTS valid din listă atunci când dorești un alt timbru.
            </p>
          </div>

          {catalogStatus.state === 'loading' && (
            <div className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-2xl px-3 py-2">
              {catalogStatus.message || 'Se încarcă catalogul audio din Math Galaxy API…'}
            </div>
          )}
          {catalogStatus.state === 'error' && catalogStatus.message && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-2xl px-3 py-2">
              {catalogStatus.message}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Narațiune (TTS)</p>
                  <p className="text-xs text-gray-500">Citește problemele, indiciile și feedback-ul pentru copii.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAudioSettings((prev) => ({ ...prev, narrationEnabled: !prev.narrationEnabled }))}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                    audioSettings.narrationEnabled ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                  aria-pressed={audioSettings.narrationEnabled}
                >
                  <span className="sr-only">Comută narațiunea</span>
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      audioSettings.narrationEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-600" htmlFor="voice-select">
                  Voce Gemini
                </label>
                <select
                  id="voice-select"
                  value={audioSettings.narrationVoiceId || ''}
                  onChange={handleVoiceChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                  disabled={!audioSettings.narrationEnabled}
                >
                  <option value="">Auto (runtime)</option>
                  {audioCatalog.voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {describeVoice(voice)}
                    </option>
                  ))}
                </select>
                <label className="block text-xs font-semibold text-gray-600" htmlFor="narration-language">
                  Limba narațiunii
                </label>
                <select
                  id="narration-language"
                  value={audioSettings.narrationLanguage || 'ro-RO'}
                  onChange={handleLanguageChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                  disabled={!audioSettings.narrationEnabled}
                >
                  {voiceLanguageOptions.map((option) => (
                    <option key={option} value={option}>
                      {describeLanguageOption(option)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500">
                  Alege limba potrivită pentru copil. Catalogul Gemini include voci prietenoase în mai multe limbi și tonalități.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewVoice}
                    disabled={!audioSettings.narrationEnabled || previewStatus.state === 'loading'}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                      previewStatus.state === 'loading'
                        ? 'border-gray-300 text-gray-500 cursor-wait'
                        : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                    }`}
                  >
                    {previewStatus.state === 'loading' ? (
                      <>
                        <Loader2 className="animate-spin" size={14} /> Generăm voce…
                      </>
                    ) : (
                      'Previzualizare voce'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioSettings((prev) => ({ ...prev, narrationAutoplay: !prev.narrationAutoplay }))}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                      audioSettings.narrationAutoplay
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    {audioSettings.narrationAutoplay ? 'Autoredare activă' : 'Autoredare oprită'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioSettings((prev) => ({ ...prev, repeatNumbers: !prev.repeatNumbers }))}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                      audioSettings.repeatNumbers
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    {audioSettings.repeatNumbers ? 'Repetă numerele' : 'Fără repetare numere'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioSettings((prev) => ({ ...prev, feedbackVoiceEnabled: !prev.feedbackVoiceEnabled }))}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                      audioSettings.feedbackVoiceEnabled
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    {audioSettings.feedbackVoiceEnabled ? 'Feedback vocal activ' : 'Feedback vocal oprit'}
                  </button>
                </div>
                {previewStatus.state !== 'idle' && previewStatus.message && (
                  <div
                    className={`text-xs rounded-xl px-3 py-2 border ${
                      previewStatus.state === 'error'
                        ? 'border-red-200 bg-red-50 text-red-600'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {previewStatus.message}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">
                    Volum narațiune: {Math.round(audioSettings.narrationVolume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={audioSettings.narrationVolume}
                    onChange={handleNarrationVolumeChange}
                    disabled={!audioSettings.narrationEnabled}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">
                    Viteză vorbire: {audioSettings.speakingRate.toFixed(2)}×
                  </label>
                  <input
                    type="range"
                    min="0.6"
                    max="1.4"
                    step="0.05"
                    value={audioSettings.speakingRate}
                    onChange={handleSpeakingRateChange}
                    disabled={!audioSettings.narrationEnabled}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600">
                    Pitch: {audioSettings.pitch >= 0 ? `+${audioSettings.pitch}` : audioSettings.pitch}
                  </label>
                  <input
                    type="range"
                    min="-6"
                    max="6"
                    step="1"
                    value={audioSettings.pitch}
                    onChange={handlePitchChange}
                    disabled={!audioSettings.narrationEnabled}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Sunete de feedback</p>
                  <p className="text-xs text-gray-500">Aplauze, felicitări și mod low-stim pentru momente de concentrare.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAudioSettings((prev) => ({ ...prev, sfxEnabled: !prev.sfxEnabled }))}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                    audioSettings.sfxEnabled ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                  aria-pressed={audioSettings.sfxEnabled}
                >
                  <span className="sr-only">Comută sunetele</span>
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      audioSettings.sfxEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-600" htmlFor="sfx-pack-select">
                  Pachet sunete
                </label>
                <select
                  id="sfx-pack-select"
                  value={audioSettings.sfxPackId || ''}
                  onChange={handleSfxPackChange}
                  disabled={!audioSettings.sfxEnabled || audioCatalog.sfxPacks.length === 0}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                >
                  <option value="">Auto ({audioCatalog.defaultSfxPackId || 'runtime'})</option>
                  {audioCatalog.sfxPacks.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.label || pack.id}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAudioSettings((prev) => ({ ...prev, sfxLowStimMode: !prev.sfxLowStimMode }))}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                      audioSettings.sfxLowStimMode
                        ? 'border-amber-200 bg-amber-50 text-amber-600'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    {audioSettings.sfxLowStimMode ? 'Low-stim activ' : 'Low-stim dezactivat'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreviewSfx('success')}
                    disabled={!audioSettings.sfxEnabled || sfxPreviewStatus.state === 'loading'}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                      sfxPreviewStatus.state === 'loading'
                        ? 'border-gray-300 text-gray-500 cursor-wait'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    Play succes
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreviewSfx('error')}
                    disabled={!audioSettings.sfxEnabled || sfxPreviewStatus.state === 'loading'}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                      sfxPreviewStatus.state === 'loading'
                        ? 'border-gray-300 text-gray-500 cursor-wait'
                        : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                    }`}
                  >
                    Play încurajare
                  </button>
                </div>
                {sfxPreviewStatus.state !== 'idle' && sfxPreviewStatus.message && (
                  <div
                    className={`text-xs rounded-xl px-3 py-2 border ${
                      sfxPreviewStatus.state === 'error'
                        ? 'border-red-200 bg-red-50 text-red-600'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {sfxPreviewStatus.message}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-600">
                  Volum SFX: {Math.round(audioSettings.sfxVolume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audioSettings.sfxVolume}
                  onChange={handleSfxVolumeChange}
                  disabled={!audioSettings.sfxEnabled}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveAudio}
            disabled={audioStatus.state === 'loading'}
            className={`w-full px-5 py-3 rounded-xl font-semibold text-white shadow ${
              audioStatus.state === 'loading' ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {audioStatus.state === 'loading' ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> Salvăm…</span>
            ) : (
              'Salvează preferințele audio'
            )}
          </button>

          {audioStatus.state !== 'idle' && audioStatus.message && (
            <div
              className={`text-sm rounded-2xl px-4 py-3 border ${
                audioStatus.state === 'error'
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-600'
              }`}
            >
              {audioStatus.message}
            </div>
          )}

          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">AI features toggle</p>
              <p className="text-xs text-gray-500">{aiToggleLabel}</p>
            </div>
            <button
              type="button"
              onClick={toggleAiAllowed}
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                aiAllowed ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
              aria-pressed={aiAllowed}
            >
              <span className="sr-only">Toggle AI features</span>
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  aiAllowed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {aiAllowed === false && (
            <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-2xl px-3 py-2">
              AI calls are paused. We&apos;ll use the local planner and sprites until you re-enable the toggle and save.
            </div>
          )}

          <button
            onClick={handleSaveModels}
            disabled={modelStatus.state === 'loading'}
            className={`w-full px-5 py-3 rounded-xl font-semibold text-white shadow ${
              modelStatus.state === 'loading' ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {modelStatus.state === 'loading' ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> Saving…</span>
            ) : (
              'Save model choices'
            )}
          </button>

          {modelStatus.state === 'success' && modelStatus.message && (
            <div className="flex items-start gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-2xl p-4">
              <ShieldCheck className="text-green-500" size={18} />
              <span>{modelStatus.message}</span>
            </div>
          )}
          {modelStatus.state === 'error' && modelStatus.message && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3">
              {modelStatus.message}
            </div>
          )}
        </div>
      </div>

      <datalist id="planning-model-options">
        {PLANNING_MODEL_OPTIONS.map((option) => (
          <option value={option} key={option} />
        ))}
      </datalist>
      <datalist id="sprite-model-options">
        {SPRITE_MODEL_OPTIONS.map((option) => (
          <option value={option} key={option} />
        ))}
      </datalist>
      <datalist id="audio-model-options">
        {audioModelOptionsList.map((option) => (
          <option value={option} key={option} />
        ))}
      </datalist>
    </div>
  );
}
