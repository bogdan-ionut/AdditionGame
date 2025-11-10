import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, CheckCircle2, Volume2, KeyRound } from 'lucide-react';
import { loadAudioSettings, saveAudioSettings } from '../lib/audio/preferences';
import {
  CACHE_EVENT_NAME,
  CACHE_LIMITS_EVENT,
  CACHE_LIMITS_STORAGE_KEY,
  CACHE_SUMMARY_STORAGE_KEY,
  clearAudioCache,
  deleteAudioCacheEntryByKey,
  formatCacheSize,
  getAudioCacheEntryBlob,
  getAudioCacheLimits,
  getAudioCacheSummary,
  isAudioCacheAvailable,
  listAudioCacheEntries,
  pruneAudioCache,
  setAudioCacheLimits,
} from '../lib/audio/cache';
import { exportAudioCacheZip, importAudioCacheZip } from '../lib/audio/cacheIO';
import { synthesizeSpeech, fetchTtsVoices, fetchTtsModels } from '../services/audioCatalog';
import { getGeminiApiKey, setGeminiApiKey, clearGeminiApiKey, hasGeminiApiKey } from '../lib/gemini/apiKey';
import { showToast } from '../lib/ui/toast';

const LANGUAGE_OPTIONS = [
  { value: 'ro-RO', label: 'Română (ro-RO)' },
  { value: 'en-US', label: 'English (en-US)' },
  { value: 'es-ES', label: 'Español (es-ES)' },
];

const FORMAT_OPTIONS = [
  { value: 'audio/mpeg', label: 'MP3 (audio/mpeg)' },
  { value: 'audio/wav', label: 'WAV (audio/wav)' },
];

const SAMPLE_RATE_OPTIONS = [
  { value: 16000, label: '16 kHz' },
  { value: 24000, label: '24 kHz' },
  { value: 44100, label: '44.1 kHz' },
];

const DEFAULT_SAMPLE_TEXT =
  'Salut! Sunt Kore, ghidul tău de matematică. Hai să rezolvăm problemele împreună!';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function ParentAISettings({ onClose }) {
  const [audioSettings, setAudioSettings] = useState(() => loadAudioSettings());
  const [voiceOptions, setVoiceOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [voiceStatus, setVoiceStatus] = useState({ state: 'idle', message: null });
  const [previewStatus, setPreviewStatus] = useState({ state: 'idle', message: null });
  const [apiKeyInput, setApiKeyInput] = useState(() => getGeminiApiKey() || '');
  const [apiKeyStatus, setApiKeyStatus] = useState({ state: 'idle', message: null });
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
  const [cacheSupported, setCacheSupported] = useState(() => isAudioCacheAvailable());
  const [cacheSummary, setCacheSummary] = useState(() => getAudioCacheSummary());
  const [cacheStatus, setCacheStatus] = useState({ state: 'idle', message: null });
  const limitsSnapshot = useMemo(() => getAudioCacheLimits(), []);
  const [cacheLimits, setCacheLimitsState] = useState(limitsSnapshot);
  const [limitDraft, setLimitDraft] = useState(() => ({
    maxEntries: limitsSnapshot.maxEntries,
    maxBytes: Math.max(1, Math.round(limitsSnapshot.maxBytes / (1024 * 1024))),
  }));
  const [limitStatus, setLimitStatus] = useState({ state: 'idle', message: null });
  const [cacheEntries, setCacheEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState(null);
  const [exportStatus, setExportStatus] = useState({ state: 'idle', message: null });
  const [importStatus, setImportStatus] = useState({ state: 'idle', message: null, progress: null });
  const [playingKey, setPlayingKey] = useState(null);
  const previewRef = useRef({ audio: null, revoke: null });
  const entryPreviewRef = useRef({ audio: null, revoke: null, key: null });
  const importInputRef = useRef(null);

  useEffect(() => {
    setVoiceStatus({ state: 'loading', message: null });
    fetchTtsVoices({ lang: audioSettings.narrationLanguage })
      .then((voices) => {
        setVoiceOptions(Array.isArray(voices) ? voices : []);
        setVoiceStatus({ state: 'idle', message: null });
      })
      .catch((error) => {
        console.warn('Unable to load Gemini voices', error);
        setVoiceOptions([]);
        setVoiceStatus({ state: 'error', message: 'Nu am putut încărca vocile implicite.' });
      });
  }, [audioSettings.narrationLanguage]);

  useEffect(() => {
    fetchTtsModels()
      .then((models) => {
        if (!models) {
          setModelOptions([]);
          return;
        }
        if (Array.isArray(models)) {
          const normalized = models.map((model) =>
            typeof model === 'string' ? { id: model, label: model } : model,
          );
          setModelOptions(normalized);
          return;
        }
        if (Array.isArray(models.options)) {
          setModelOptions(models.options);
          return;
        }
        if (Array.isArray(models.models)) {
          setModelOptions(models.models.map((id) => ({ id, label: id })));
        }
      })
      .catch((error) => {
        console.warn('Unable to load Gemini TTS models', error);
        setModelOptions([]);
      });
  }, []);

  useEffect(() => {
    setCacheSupported(isAudioCacheAvailable());
    refreshCacheSummary();
    const limits = getAudioCacheLimits();
    setCacheLimitsState(limits);
    setLimitDraft({
      maxEntries: limits.maxEntries,
      maxBytes: Math.max(1, Math.round(limits.maxBytes / (1024 * 1024))),
    });
    setLimitStatus({ state: 'idle', message: null });
    void refreshCacheEntries();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const refresh = () => {
      refreshCacheSummary();
      void refreshCacheEntries();
    };
    const handleStorage = (event) => {
      if (event.key === CACHE_SUMMARY_STORAGE_KEY) {
        refresh();
      }
      if (event.key === CACHE_LIMITS_STORAGE_KEY) {
        const snapshot = getAudioCacheLimits();
        setCacheLimitsState(snapshot);
        setLimitDraft({
          maxEntries: snapshot.maxEntries,
          maxBytes: Math.max(1, Math.round(snapshot.maxBytes / (1024 * 1024))),
        });
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(CACHE_EVENT_NAME, refresh);
    const handleLimitsEvent = () => {
      const snapshot = getAudioCacheLimits();
      setCacheLimitsState(snapshot);
      setLimitDraft({
        maxEntries: snapshot.maxEntries,
        maxBytes: Math.max(1, Math.round(snapshot.maxBytes / (1024 * 1024))),
      });
      setLimitStatus({ state: 'idle', message: null });
      void refreshCacheEntries();
    };
    window.addEventListener(CACHE_LIMITS_EVENT, handleLimitsEvent);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CACHE_EVENT_NAME, refresh);
      window.removeEventListener(CACHE_LIMITS_EVENT, handleLimitsEvent);
    };
  }, []);

  useEffect(() => {
    saveAudioSettings(audioSettings);
  }, [audioSettings]);

  const cleanupPreview = () => {
    if (previewRef.current.revoke) {
      previewRef.current.revoke();
      previewRef.current.revoke = null;
    }
    if (previewRef.current.audio) {
      try {
        previewRef.current.audio.pause();
      } catch (error) {
        console.warn('Unable to pause preview audio', error);
      }
      previewRef.current.audio = null;
    }
  };

  const cleanupEntryPreview = () => {
    if (entryPreviewRef.current.revoke) {
      entryPreviewRef.current.revoke();
      entryPreviewRef.current.revoke = null;
    }
    if (entryPreviewRef.current.audio) {
      try {
        entryPreviewRef.current.audio.pause();
      } catch (error) {
        console.warn('Unable to pause cache clip preview', error);
      }
      entryPreviewRef.current.audio = null;
      entryPreviewRef.current.key = null;
    }
    setPlayingKey(null);
  };

  useEffect(() => {
    return () => {
      cleanupPreview();
      cleanupEntryPreview();
    };
  }, []);

  const hasKey = useMemo(() => hasGeminiApiKey(), [apiKeyStatus, apiKeyInput]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  const handleSaveKey = async () => {
    const trimmed = apiKeyInput.trim();
    try {
      if (!trimmed) {
        clearGeminiApiKey();
        setApiKeyStatus({ state: 'success', message: 'Cheia Gemini a fost ștearsă.' });
        showToast({ level: 'info', message: 'Cheia Gemini a fost eliminată.' });
        return;
      }
      setGeminiApiKey(trimmed);
      setApiKeyStatus({ state: 'success', message: 'Cheia Gemini a fost salvată local.' });
      showToast({ level: 'success', message: 'Cheia Gemini este gata de utilizare.' });
    } catch (error) {
      console.error('Unable to save Gemini key', error);
      setApiKeyStatus({ state: 'error', message: 'Nu am putut salva cheia. Verifică permisiunile browserului.' });
      showToast({ level: 'error', message: 'Nu am putut salva cheia Gemini.' });
    }
  };

  const handlePreviewVoice = async () => {
    if (!hasGeminiApiKey()) {
      showToast({ level: 'warning', message: 'Adaugă mai întâi cheia Gemini pentru a testa vocea.' });
      return;
    }
    cleanupPreview();
    setPreviewStatus({ state: 'loading', message: null });
    try {
      const response = await synthesizeSpeech({
        text: sampleText,
        voiceId: audioSettings.narrationVoiceId || undefined,
        speakingRate: audioSettings.speakingRate,
        pitch: audioSettings.pitch,
        language: audioSettings.narrationLanguage,
        model: audioSettings.narrationModel || undefined,
        preferredMime: audioSettings.narrationMimeType,
        sampleRateHz: audioSettings.narrationSampleRate || undefined,
      });
      const blob = new Blob([response.buffer], { type: response.mimeType || 'audio/mpeg' });
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      previewRef.current.audio = audio;
      previewRef.current.revoke = () => URL.revokeObjectURL(objectUrl);
      await audio.play();
      setPreviewStatus({ state: 'success', message: 'Previzualizare redată.' });
      audio.onended = cleanupPreview;
      audio.onerror = cleanupPreview;
    } catch (error) {
      console.error('Voice preview failed', error);
      setPreviewStatus({ state: 'error', message: 'Nu am putut genera vocea. Verifică cheia Gemini.' });
      showToast({ level: 'error', message: 'Previzualizarea vocii a eșuat.' });
      cleanupPreview();
    }
  };

  const refreshCacheEntries = async () => {
    if (!cacheSupported) {
      setCacheEntries([]);
      return;
    }
    setEntriesLoading(true);
    setEntriesError(null);
    try {
      const entries = await listAudioCacheEntries();
      setCacheEntries(entries);
    } catch (error) {
      console.error('Unable to load cache entries', error);
      setEntriesError('Nu am putut încărca lista clipurilor.');
      setCacheEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  };

  const refreshCacheSummary = () => {
    setCacheSummary(getAudioCacheSummary());
  };

  const handleRefreshCacheSummary = () => {
    refreshCacheSummary();
    setCacheStatus({ state: 'idle', message: null });
    void refreshCacheEntries();
  };

  const handleClearCache = async () => {
    if (!cacheSupported) {
      showToast({ level: 'warning', message: 'Cache-ul audio necesită suport IndexedDB în browser.' });
      return;
    }
    setCacheStatus({ state: 'loading', message: null });
    try {
      await clearAudioCache();
      const summary = getAudioCacheSummary();
      setCacheSummary(summary);
      const message = 'Cache-ul audio a fost golit.';
      setCacheStatus({ state: 'success', message });
      showToast({ level: 'success', message });
      await refreshCacheEntries();
    } catch (error) {
      console.error('Unable to clear audio cache', error);
      const message = 'Nu am putut șterge cache-ul audio.';
      setCacheStatus({ state: 'error', message });
      showToast({ level: 'error', message });
    }
  };

  const handleExportCache = async () => {
    if (!cacheSupported) {
      showToast({ level: 'warning', message: 'Cache-ul audio necesită suport IndexedDB în browser.' });
      return;
    }
    setExportStatus({ state: 'loading', message: 'Generăm arhiva cache-ului audio…' });
    try {
      const blob = await exportAudioCacheZip();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'addition-game-audio-cache.zip';
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      const message = 'Arhiva cache-ului audio a fost generată.';
      setExportStatus({ state: 'success', message });
      showToast({ level: 'success', message });
    } catch (error) {
      console.error('Unable to export audio cache', error);
      const message = 'Exportul cache-ului audio a eșuat.';
      setExportStatus({ state: 'error', message });
      showToast({ level: 'error', message });
    }
  };

  const handleImportInputClick = () => {
    importInputRef.current?.click();
  };

  const handleImportCache = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportStatus({
      state: 'loading',
      message: `Importăm ${file.name}…`,
      progress: { total: 0, processed: 0, added: 0, skipped: 0, bytes: 0 },
    });
    try {
      const result = await importAudioCacheZip(file, {
        onProgress: (progress) => {
          setImportStatus({
            state: 'loading',
            message: `Procesăm ${progress.processed}/${progress.total} clipuri…`,
            progress,
          });
        },
      });
      const message = `Am importat ${result.added} clipuri (${formatCacheSize(result.bytes)}) și am ignorat ${result.skipped}.`;
      setImportStatus({ state: 'success', message, progress: null });
      showToast({ level: 'success', message });
      refreshCacheSummary();
      await refreshCacheEntries();
    } catch (error) {
      console.error('Unable to import audio cache', error);
      const message =
        error instanceof Error ? error.message : 'Importul cache-ului audio a eșuat.';
      setImportStatus({ state: 'error', message, progress: null });
      showToast({ level: 'error', message });
    } finally {
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const limitsChanged =
    limitDraft.maxEntries !== cacheLimits.maxEntries ||
    limitDraft.maxBytes !== Math.max(1, Math.round(cacheLimits.maxBytes / (1024 * 1024)));

  const handleSaveLimits = async () => {
    const maxEntries = Math.max(1, Math.floor(limitDraft.maxEntries));
    const maxBytes = Math.max(1, Math.floor(limitDraft.maxBytes)) * 1024 * 1024;
    try {
      const updated = setAudioCacheLimits({ maxEntries, maxBytes });
      setCacheLimitsState(updated);
      setLimitDraft({
        maxEntries: updated.maxEntries,
        maxBytes: Math.max(1, Math.round(updated.maxBytes / (1024 * 1024))),
      });
      setLimitStatus({ state: 'success', message: 'Limitele cache-ului au fost actualizate.' });
      showToast({ level: 'success', message: 'Noile limite de cache au fost salvate.' });
      await pruneAudioCache();
      await refreshCacheEntries();
      refreshCacheSummary();
    } catch (error) {
      console.error('Unable to update cache limits', error);
      setLimitStatus({ state: 'error', message: 'Nu am putut salva limitele cache-ului audio.' });
      showToast({ level: 'error', message: 'Nu am putut salva limitele cache-ului.' });
    }
  };

  const handleLimitDraftChange = (field) => (event) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    setLimitDraft((prev) => ({ ...prev, [field]: Math.max(1, value) }));
    setLimitStatus({ state: 'idle', message: null });
  };

  const handlePlayCacheEntry = async (entry) => {
    if (playingKey === entry.key && entryPreviewRef.current.audio) {
      cleanupEntryPreview();
      return;
    }
    cleanupEntryPreview();
    setPlayingKey(entry.key);
    try {
      const blob = await getAudioCacheEntryBlob(entry.key);
      if (!blob) {
        const message = 'Clipul nu mai este disponibil în cache.';
        setCacheStatus({ state: 'error', message });
        showToast({ level: 'warning', message });
        await refreshCacheEntries();
        refreshCacheSummary();
        setPlayingKey(null);
        return;
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      entryPreviewRef.current.audio = audio;
      entryPreviewRef.current.revoke = () => URL.revokeObjectURL(url);
      entryPreviewRef.current.key = entry.key;
      audio.onended = cleanupEntryPreview;
      audio.onerror = cleanupEntryPreview;
      await audio.play();
      setCacheStatus({ state: 'success', message: `Redăm clipul pentru „${entry.text.slice(0, 30)}${entry.text.length > 30 ? '…' : ''}”.` });
    } catch (error) {
      console.error('Unable to play cached entry', error);
      const message = 'Nu am putut reda clipul selectat.';
      setCacheStatus({ state: 'error', message });
      showToast({ level: 'error', message });
      setPlayingKey(null);
    }
  };

  const handleDeleteCacheEntry = async (entry) => {
    cleanupEntryPreview();
    try {
      const removed = await deleteAudioCacheEntryByKey(entry.key);
      if (removed) {
        const message = 'Clipul a fost șters din cache.';
        setCacheStatus({ state: 'success', message });
        showToast({ level: 'info', message });
        await refreshCacheEntries();
        refreshCacheSummary();
      } else {
        const message = 'Clipul nu a putut fi găsit în cache.';
        setCacheStatus({ state: 'error', message });
        showToast({ level: 'warning', message });
      }
    } catch (error) {
      console.error('Unable to delete cached entry', error);
      const message = 'Nu am putut șterge clipul selectat.';
      setCacheStatus({ state: 'error', message });
      showToast({ level: 'error', message });
    }
  };

  const handleToggleNarration = () => {
    setAudioSettings((prev) => ({ ...prev, narrationEnabled: !prev.narrationEnabled }));
  };

  const handleToggleFeedback = () => {
    setAudioSettings((prev) => ({ ...prev, feedbackVoiceEnabled: !prev.feedbackVoiceEnabled }));
  };

  const handleRateChange = (event) => {
    const value = Number.parseFloat(event.target.value);
    if (!Number.isFinite(value)) return;
    setAudioSettings((prev) => ({ ...prev, speakingRate: clamp(value, 0.6, 1.6) }));
  };

  const handleLanguageChange = (event) => {
    setAudioSettings((prev) => ({ ...prev, narrationLanguage: event.target.value }));
  };

  const handleVoiceChange = (event) => {
    const value = event.target.value;
    setAudioSettings((prev) => ({ ...prev, narrationVoiceId: value || null }));
  };

  const handleModelChange = (event) => {
    const value = event.target.value;
    setAudioSettings((prev) => ({ ...prev, narrationModel: value || null }));
  };

  const handleFormatChange = (event) => {
    const value = event.target.value === 'audio/wav' ? 'audio/wav' : 'audio/mpeg';
    setAudioSettings((prev) => ({ ...prev, narrationMimeType: value }));
  };

  const handleSampleRateChange = (event) => {
    const numeric = Number(event.target.value);
    if (!Number.isFinite(numeric)) return;
    const allowed = [16000, 22050, 24000, 44100];
    setAudioSettings((prev) => ({
      ...prev,
      narrationSampleRate: allowed.includes(numeric) ? numeric : prev.narrationSampleRate,
    }));
  };

  const handlePitchChange = (event) => {
    const value = Number.parseFloat(event.target.value);
    if (!Number.isFinite(value)) return;
    setAudioSettings((prev) => ({ ...prev, pitch: clamp(value, -6, 6) }));
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
          aria-label="Închide AI Settings"
        >
          <X size={18} />
        </button>
        <div className="space-y-8 px-6 pb-8 pt-10 sm:px-10 overflow-y-auto">
          <header className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              <SparklesIcon /> AI Settings
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">Configurează vocea Gemini</h2>
            <p className="text-sm text-slate-600">
              Cheia Gemini este stocată local în browser. Nu este trimisă către niciun server.
              Folosim direct API-ul Google pentru a reda vocea în joc.
            </p>
          </header>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-1 text-indigo-500" size={20} />
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Google Gemini API key</h3>
                  {hasKey ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={14} /> Salvată
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-600">Cheie lipsă</span>
                  )}
                </div>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(event) => {
                    setApiKeyInput(event.target.value);
                    setApiKeyStatus({ state: 'idle', message: null });
                  }}
                  placeholder="AIza..."
                  className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  autoComplete="off"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-700"
                  >
                    Salvează cheia
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setApiKeyInput('');
                      clearGeminiApiKey();
                      setApiKeyStatus({ state: 'success', message: 'Cheia a fost ștearsă.' });
                      showToast({ level: 'info', message: 'Cheia Gemini a fost ștearsă.' });
                    }}
                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Șterge cheia
                  </button>
                </div>
                {apiKeyStatus.state === 'success' && apiKeyStatus.message && (
                  <p className="text-sm text-emerald-600">{apiKeyStatus.message}</p>
                )}
                {apiKeyStatus.state === 'error' && apiKeyStatus.message && (
                  <p className="text-sm text-rose-600">{apiKeyStatus.message}</p>
                )}
                <p className="text-xs text-slate-500">
                  Poți folosi aceeași cheie și pe GitHub Pages. Cheia este încorporată în buildul static, deci recomandăm să folosești un key restriction în Google Cloud.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Voce și pronunție</h3>
                <p className="text-sm text-slate-500">
                  Activează narațiunea prietenoasă și selectează vocea potrivită pentru copil.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Narațiune</label>
                <button
                  type="button"
                  onClick={handleToggleNarration}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
                    audioSettings.narrationEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span className="sr-only">Comută narațiunea</span>
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      audioSettings.narrationEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-600" htmlFor="voice-select">
                  Voce
                </label>
                <select
                  id="voice-select"
                  value={audioSettings.narrationVoiceId || ''}
                  onChange={handleVoiceChange}
                  disabled={!audioSettings.narrationEnabled}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Implicit (Kore)</option>
                  {voiceOptions.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label || `${voice.id} · ${voice.language}`}
                    </option>
                  ))}
                </select>
                {voiceStatus.state === 'error' && voiceStatus.message && (
                  <p className="text-xs text-rose-600">{voiceStatus.message}</p>
                )}
              </div>
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-600" htmlFor="language-select">
                  Limbă
                </label>
                <select
                  id="language-select"
                  value={audioSettings.narrationLanguage || 'ro-RO'}
                  onChange={handleLanguageChange}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-600" htmlFor="model-select">
                  Model Gemini TTS
                </label>
                <select
                  id="model-select"
                  value={audioSettings.narrationModel || ''}
                  onChange={handleModelChange}
                  disabled={!audioSettings.narrationEnabled}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Implicit (flash)</option>
                  {modelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label || model.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-600" htmlFor="format-select">
                  Format audio
                </label>
                <select
                  id="format-select"
                  value={audioSettings.narrationMimeType || 'audio/mpeg'}
                  onChange={handleFormatChange}
                  disabled={!audioSettings.narrationEnabled}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-600" htmlFor="sample-rate-select">
                  Rată eșantionare
                </label>
                <select
                  id="sample-rate-select"
                  value={audioSettings.narrationSampleRate || 24000}
                  onChange={handleSampleRateChange}
                  disabled={!audioSettings.narrationEnabled}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {SAMPLE_RATE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-600" htmlFor="pitch-control">
                  Ton: {audioSettings.pitch.toFixed(2)}
                </label>
                <input
                  id="pitch-control"
                  type="range"
                  min="-6"
                  max="6"
                  step="0.1"
                  value={audioSettings.pitch}
                  onChange={handlePitchChange}
                  disabled={!audioSettings.narrationEnabled}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">
                  Ajustează tonalitatea pentru a obține o voce mai gravă sau mai ascuțită.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-600" htmlFor="speaking-rate">
                Viteză vorbire: {audioSettings.speakingRate.toFixed(2)}×
              </label>
              <input
                id="speaking-rate"
                type="range"
                min="0.6"
                max="1.6"
                step="0.05"
                value={audioSettings.speakingRate}
                onChange={handleRateChange}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Ajustează ritmul pentru a se potrivi stilului copilului. Valorile peste 1.0 accelerează narațiunea.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-600" htmlFor="sample-text">
                Text de test pentru previzualizare
              </label>
              <textarea
                id="sample-text"
                value={sampleText}
                onChange={(event) => setSampleText(event.target.value)}
                rows={3}
                className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePreviewVoice}
                disabled={!audioSettings.narrationEnabled || previewStatus.state === 'loading'}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow ${
                  previewStatus.state === 'loading'
                    ? 'cursor-wait bg-slate-200 text-slate-500'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {previewStatus.state === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generăm voce…
                  </>
                ) : (
                  <>
                    <Volume2 size={18} /> Redă previzualizare
                  </>
                )}
              </button>
              {previewStatus.state === 'success' && (
                <span className="text-sm font-medium text-emerald-600">Previzualizare redată cu succes.</span>
              )}
              {previewStatus.state === 'error' && previewStatus.message && (
                <span className="text-sm font-medium text-rose-600">{previewStatus.message}</span>
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-900">Cache audio local</h4>
                  <p className="text-xs text-slate-500">
                    Clipurile Gemini TTS sunt salvate în browser pentru a fi redate instant la următoarea utilizare.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshCacheSummary}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Actualizează
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCache}
                    disabled={!cacheSupported || exportStatus.state === 'loading'}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold shadow transition ${
                      !cacheSupported || exportStatus.state === 'loading'
                        ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    Exportă cache-ul
                  </button>
                  <button
                    type="button"
                    onClick={handleImportInputClick}
                    disabled={!cacheSupported || importStatus.state === 'loading'}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold shadow transition ${
                      !cacheSupported || importStatus.state === 'loading'
                        ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    Importă cache-ul
                  </button>
                  <button
                    type="button"
                    onClick={handleClearCache}
                    disabled={!cacheSupported || cacheStatus.state === 'loading'}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold text-white shadow transition ${
                      !cacheSupported || cacheStatus.state === 'loading'
                        ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                        : 'bg-rose-500 hover:bg-rose-600'
                    }`}
                  >
                    Șterge cache-ul
                  </button>
                </div>
              </div>

              <input
                ref={importInputRef}
                type="file"
                accept=".zip"
                onChange={handleImportCache}
                className="hidden"
              />

              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dimensiune</dt>
                  <dd className="text-base font-semibold text-slate-900">{formatCacheSize(cacheSummary.totalBytes)}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clipuri</dt>
                  <dd className="text-base font-semibold text-slate-900">{cacheSummary.entryCount}</dd>
                </div>
              </dl>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="cache-limit-entries">
                    Limită clipuri
                  </label>
                  <input
                    id="cache-limit-entries"
                    type="number"
                    min={1}
                    value={limitDraft.maxEntries}
                    onChange={handleLimitDraftChange('maxEntries')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="cache-limit-mb">
                    Limită dimensiune (MB)
                  </label>
                  <input
                    id="cache-limit-mb"
                    type="number"
                    min={1}
                    value={limitDraft.maxBytes}
                    onChange={handleLimitDraftChange('maxBytes')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveLimits}
                  disabled={!limitsChanged}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold shadow transition ${
                    limitsChanged ? 'bg-slate-900 text-white hover:bg-slate-700' : 'cursor-not-allowed bg-slate-200 text-slate-500'
                  }`}
                >
                  Salvează limitele
                </button>
                <span className="text-xs text-slate-500">
                  Curent: {cacheLimits.maxEntries} clipuri · {formatCacheSize(cacheLimits.maxBytes)} maxim.
                </span>
              </div>

              {limitStatus.message && (
                <p
                  className={`text-xs ${
                    limitStatus.state === 'error' ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {limitStatus.message}
                </p>
              )}

              {(exportStatus.state !== 'idle' || importStatus.state !== 'idle') && (
                <div className="space-y-1 rounded-lg bg-white/70 p-3 text-xs text-slate-600">
                  {exportStatus.state !== 'idle' && exportStatus.message && (
                    <p className={exportStatus.state === 'error' ? 'text-rose-600' : 'text-slate-600'}>{exportStatus.message}</p>
                  )}
                  {importStatus.state !== 'idle' && (
                    <p className={importStatus.state === 'error' ? 'text-rose-600' : 'text-slate-600'}>
                      {importStatus.message}
                    </p>
                  )}
                  {importStatus.progress && (
                    <p className="text-[11px] text-slate-500">
                      Progres import: {importStatus.progress.processed}/{importStatus.progress.total} clipuri ·{' '}
                      {formatCacheSize(importStatus.progress.bytes)} adăugate
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clipuri salvate</h5>
                <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
                  {entriesLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> Se încarcă lista de clipuri…
                    </div>
                  ) : cacheEntries.length === 0 ? (
                    <p className="text-xs text-slate-500">Nu există clipuri salvate în cache în acest moment.</p>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {cacheEntries.map((entry) => (
                        <li
                          key={entry.key}
                          className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800">
                              {entry.text || 'Text indisponibil'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {entry.lang || '—'} · {entry.voice || 'voce implicită'} · {formatCacheSize(entry.bytes)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePlayCacheEntry(entry)}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                                playingKey === entry.key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              <Volume2 size={14} /> {playingKey === entry.key ? 'Oprește' : 'Redă'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCacheEntry(entry)}
                              className="inline-flex items-center gap-1 rounded-md bg-rose-500 px-2 py-1 text-[11px] font-semibold text-white shadow hover:bg-rose-600"
                            >
                              Șterge
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {entriesError && <p className="text-xs text-rose-600">{entriesError}</p>}
                </div>
              </div>

              {!cacheSupported && (
                <p className="text-xs text-amber-600">
                  Cache-ul audio este dezactivat deoarece browserul nu oferă IndexedDB.
                </p>
              )}
              {cacheStatus.message && (
                <p
                  className={`text-xs ${
                    cacheStatus.state === 'error' ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {cacheStatus.message}
                </p>
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Feedback vocal</h3>
                <p className="text-sm text-slate-500">Activează încurajările verbale după fiecare răspuns.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Feedback</label>
                <button
                  type="button"
                  onClick={handleToggleFeedback}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
                    audioSettings.feedbackVoiceEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span className="sr-only">Comută feedback-ul vocal</span>
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      audioSettings.feedbackVoiceEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Feedback-ul vocal folosește aceleași setări de voce și viteză ca narațiunea. Poți dezactiva această opțiune pentru un mediu mai liniștit.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364-1.414 1.414M7.05 16.95 5.636 18.364M18.364 18.364 16.95 16.95M5.636 5.636 7.05 7.05" />
      <path d="m12 8-2 4 2 4 2-4-2-4Z" />
    </svg>
  );
}
