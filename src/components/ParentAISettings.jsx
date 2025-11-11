import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, CheckCircle2, Volume2, KeyRound, Circle, Plus } from 'lucide-react';
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
  hasCachedAudioClip,
} from '../lib/audio/cache';
import { exportAudioCacheZip, importAudioCacheZip } from '../lib/audio/cacheIO';
import { synthesizeSpeech, fetchTtsVoices, fetchTtsModels } from '../services/audioCatalog';
import { collectWarmupTasks, precomputeNarrationClips } from '../lib/audio/warmup';
import { DEFAULT_TTS_MODEL } from '../api/tts';
import {
  WARMUP_CATEGORIES,
  loadWarmupLibrary,
  saveWarmupLibrary,
  createCustomPrompt,
  pruneSelection as pruneWarmupSelection,
  isCategoryModified,
  resetCategoryToDefaults,
  LEARNER_NAME_CATEGORY_ID,
} from '../lib/audio/warmupCatalog';
import WarmupPromptModal from './WarmupPromptModal';
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

const CHIRP_MANIFEST_FILE_NAME = 'chirp-pack-request.json';
const CHIRP_SCRIPT_COMMAND =
  'npm run chirp-pack -- --manifest ./chirp-pack-request.json --out-dir public/audio/ro-RO/chirp3-hd-a';
const CHIRP_DEFAULT_LANGUAGE = 'ro-RO';
const CHIRP_DEFAULT_AUDIO_ENCODING = 'MP3';
const CHIRP_DEFAULT_SAMPLE_RATE = 24000;
const CHIRP_DEFAULT_VOICE_NAME = 'ro-RO-Chirp3-HD-A';

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
  const [warmupLibrary, setWarmupLibrary] = useState(() => loadWarmupLibrary());
  const [warmupSelection, setWarmupSelection] = useState({});
  const [warmupStatus, setWarmupStatus] = useState({ state: 'idle', message: null, progress: null });
  const [isWarmupRunning, setIsWarmupRunning] = useState(false);
  const [activeWarmupCategory, setActiveWarmupCategory] = useState(null);
  const [warmupPromptStatuses, setWarmupPromptStatuses] = useState({});
  const [warmupStatusLoadingMap, setWarmupStatusLoadingMap] = useState({});
  const [chirpExportStatus, setChirpExportStatus] = useState({
    state: 'idle',
    message: null,
    promptCount: 0,
    fileName: null,
    timestamp: null,
  });
  const previewRef = useRef({ audio: null, revoke: null });
  const entryPreviewRef = useRef({ audio: null, revoke: null, key: null });
  const warmupControllerRef = useRef(null);
  const warmupStatusRequestsRef = useRef({});
  const warmupActiveCategoriesRef = useRef(new Set());
  const importInputRef = useRef(null);

  const refreshCacheEntries = useCallback(async () => {
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
  }, [cacheSupported]);

  const refreshCacheSummary = useCallback(() => {
    setCacheSummary(getAudioCacheSummary());
  }, []);

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
  }, [refreshCacheEntries, refreshCacheSummary]);

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
  }, [refreshCacheEntries, refreshCacheSummary]);

  useEffect(() => {
    saveAudioSettings(audioSettings);
  }, [audioSettings]);

  const warmupSelectionSummary = useMemo(() => {
    const categories = [];
    let totalPrompts = 0;
    Object.entries(warmupSelection).forEach(([categoryId, ids]) => {
      if (Array.isArray(ids) && ids.length > 0) {
        categories.push(categoryId);
        totalPrompts += ids.length;
      }
    });
    return { categories, totalPrompts };
  }, [warmupSelection]);

  const warmupSelectionCount = warmupSelectionSummary.categories.length;
  const warmupSelectedPrompts = warmupSelectionSummary.totalPrompts;

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
      if (warmupControllerRef.current) {
        warmupControllerRef.current.abort();
      }
    };
  }, []);

  const hasKey = hasGeminiApiKey();

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

  const applyWarmupLibraryUpdate = useCallback(
    (updater) => {
      setWarmupLibrary((currentLibrary) => {
        const nextLibrary = updater(currentLibrary);
        if (!nextLibrary || nextLibrary === currentLibrary) {
          return currentLibrary;
        }
        saveWarmupLibrary(nextLibrary);
        setWarmupSelection((prevSelection) => pruneWarmupSelection(prevSelection, nextLibrary));
        setWarmupPromptStatuses((prevStatuses) => {
          const sanitized = {};
          Object.entries(prevStatuses || {}).forEach(([categoryId, statusMap]) => {
            const prompts = nextLibrary[categoryId] || [];
            if (!prompts.length) {
              return;
            }
            const allowedIds = new Set(prompts.map((prompt) => prompt.id));
            const filtered = {};
            Object.entries(statusMap || {}).forEach(([promptId, state]) => {
              if (allowedIds.has(promptId)) {
                filtered[promptId] = state;
              }
            });
            if (Object.keys(filtered).length > 0) {
              sanitized[categoryId] = filtered;
            }
          });
          return sanitized;
        });
        return nextLibrary;
      });
    },
    [],
  );

  const updateWarmupSelection = useCallback((updater) => {
    setWarmupSelection((prevSelection) => {
      const draft = updater(prevSelection);
      const sanitized = {};
      Object.entries(draft || {}).forEach(([categoryId, ids]) => {
        if (!Array.isArray(ids)) return;
        const unique = Array.from(new Set(ids.filter(Boolean)));
        if (unique.length > 0) {
          sanitized[categoryId] = unique;
        }
      });
      return sanitized;
    });
    setWarmupStatus({ state: 'idle', message: null, progress: null });
  }, [setWarmupStatus]);

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

  const handleToggleWarmupOption = (categoryId) => {
    if (isWarmupRunning) return;
    const prompts = warmupLibrary[categoryId] || [];
    updateWarmupSelection((prev) => {
      const next = { ...prev };
      const current = new Set(prev?.[categoryId] || []);
      if (current.size > 0 && current.size === prompts.length) {
        delete next[categoryId];
      } else if (prompts.length > 0) {
        next[categoryId] = prompts.map((prompt) => prompt.id);
      } else {
        delete next[categoryId];
      }
      return next;
    });
  };

  const handleSelectAllWarmup = () => {
    if (isWarmupRunning) return;
    updateWarmupSelection(() => {
      const next = {};
      WARMUP_CATEGORIES.forEach((category) => {
        const prompts = warmupLibrary[category.id] || [];
        if (prompts.length > 0) {
          next[category.id] = prompts.map((prompt) => prompt.id);
        }
      });
      return next;
    });
  };

  const handleClearWarmupSelection = () => {
    if (isWarmupRunning) return;
    updateWarmupSelection(() => ({}));
  };

  const handleOpenWarmupCategory = (categoryId) => {
    setActiveWarmupCategory(categoryId);
    void refreshWarmupCategoryStatus(categoryId);
  };

  const handleCloseWarmupCategory = () => {
    setActiveWarmupCategory(null);
  };

  const handleTogglePromptSelection = (categoryId, promptId) => {
    if (isWarmupRunning) return;
    updateWarmupSelection((prev) => {
      const next = { ...prev };
      const current = new Set(prev?.[categoryId] || []);
      if (current.has(promptId)) {
        current.delete(promptId);
      } else {
        current.add(promptId);
      }
      if (current.size > 0) {
        next[categoryId] = Array.from(current);
      } else {
        delete next[categoryId];
      }
      return next;
    });
  };

  const handleSelectAllPrompts = (categoryId) => {
    if (isWarmupRunning) return;
    const prompts = warmupLibrary[categoryId] || [];
    updateWarmupSelection((prev) => {
      const next = { ...prev };
      if (prompts.length > 0) {
        next[categoryId] = prompts.map((prompt) => prompt.id);
      } else {
        delete next[categoryId];
      }
      return next;
    });
  };

  const handleClearPromptSelection = (categoryId) => {
    if (isWarmupRunning) return;
    updateWarmupSelection((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  };

  const handleAddPromptToCategory = (categoryId, { text, language }) => {
    const definition = WARMUP_CATEGORIES.find((category) => category.id === categoryId);
    if (!definition) return;
    applyWarmupLibraryUpdate((library) => {
      const prompts = library[categoryId] || [];
      const nextPrompts = [...prompts, createCustomPrompt(categoryId, definition.kind, text, language || null)];
      return { ...library, [categoryId]: nextPrompts };
    });
  };

  const handleUpdatePromptInCategory = (categoryId, promptId, { text, language }) => {
    applyWarmupLibraryUpdate((library) => {
      const prompts = library[categoryId] || [];
      const index = prompts.findIndex((prompt) => prompt.id === promptId);
      if (index === -1) {
        return library;
      }
      const nextPrompts = [...prompts];
      nextPrompts[index] = {
        ...nextPrompts[index],
        text: text.trim(),
        language: language || null,
        source: 'custom',
      };
      return { ...library, [categoryId]: nextPrompts };
    });
  };

  const handleDeletePromptFromCategory = (categoryId, promptId) => {
    applyWarmupLibraryUpdate((library) => {
      const prompts = library[categoryId] || [];
      const nextPrompts = prompts.filter((prompt) => prompt.id !== promptId);
      if (nextPrompts.length === prompts.length) {
        return library;
      }
      return { ...library, [categoryId]: nextPrompts };
    });
  };

  const handleResetPromptCategory = (categoryId) => {
    applyWarmupLibraryUpdate((library) => resetCategoryToDefaults(library, categoryId));
  };

  const learnerNamePrompts = useMemo(
    () => warmupLibrary[LEARNER_NAME_CATEGORY_ID] || [],
    [warmupLibrary],
  );
  const learnerNameSelection = warmupSelection[LEARNER_NAME_CATEGORY_ID] || [];
  const [learnerNameDraft, setLearnerNameDraft] = useState('');
  const [learnerNameSuggestions, setLearnerNameSuggestions] = useState([]);

  const learnerNamePromptSet = useMemo(() => {
    const entries = new Set();
    learnerNamePrompts.forEach((prompt) => {
      if (prompt?.text) {
        entries.add(prompt.text.trim().toLowerCase());
      }
    });
    return entries;
  }, [learnerNamePrompts]);

  const availableLearnerNameSuggestions = useMemo(() => {
    if (!Array.isArray(learnerNameSuggestions)) {
      return [];
    }
    return learnerNameSuggestions.filter((name) => {
      if (typeof name !== 'string') return false;
      const normalized = name.trim().toLowerCase();
      if (!normalized) return false;
      return !learnerNamePromptSet.has(normalized);
    });
  }, [learnerNamePromptSet, learnerNameSuggestions]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const suggestions = new Set();
      const { localStorage } = window;
      const lastUser = localStorage.getItem('additionFlashcardsLastUser');
      if (typeof lastUser === 'string' && lastUser.trim()) {
        suggestions.add(lastUser.trim());
      }
      const prefix = 'additionFlashcardsGameState_';
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;
        if (key.startsWith(prefix)) {
          const nameFromKey = key.slice(prefix.length).trim();
          if (nameFromKey) {
            suggestions.add(nameFromKey);
          }
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              const storedName = parsed?.studentInfo?.name;
              if (typeof storedName === 'string' && storedName.trim()) {
                suggestions.add(storedName.trim());
              }
            } catch (error) {
              console.warn('Unable to parse saved profile for learner names', error);
            }
          }
        }
      }
      setLearnerNameSuggestions(
        Array.from(suggestions)
          .filter((value) => typeof value === 'string' && value.trim())
          .map((value) => value.trim())
          .sort((a, b) => a.localeCompare(b, 'ro')),
      );
    } catch (error) {
      console.warn('Unable to load learner name suggestions', error);
      setLearnerNameSuggestions([]);
    }
  }, []);

  const addLearnerNamePrompt = useCallback(
    (rawName) => {
      const trimmed = typeof rawName === 'string' ? rawName.trim() : '';
      if (!trimmed) {
        return { added: false, reason: 'empty' };
      }
      let createdPrompt = null;
      let duplicate = false;
      applyWarmupLibraryUpdate((library) => {
        const prompts = library[LEARNER_NAME_CATEGORY_ID] || [];
        const normalized = trimmed.toLowerCase();
        if (
          prompts.some((prompt) => typeof prompt.text === 'string' && prompt.text.trim().toLowerCase() === normalized)
        ) {
          duplicate = true;
          return library;
        }
        const preferredLanguage =
          typeof audioSettings.narrationLanguage === 'string' &&
          audioSettings.narrationLanguage.toLowerCase().startsWith('ro')
            ? 'ro'
            : null;
        const prompt = createCustomPrompt(
          LEARNER_NAME_CATEGORY_ID,
          'learner-name',
          trimmed,
          preferredLanguage,
        );
        createdPrompt = prompt;
        return {
          ...library,
          [LEARNER_NAME_CATEGORY_ID]: [...prompts, prompt],
        };
      });
      if (createdPrompt) {
        updateWarmupSelection((prev) => {
          const next = { ...prev };
          const current = new Set(next[LEARNER_NAME_CATEGORY_ID] || []);
          current.add(createdPrompt.id);
          next[LEARNER_NAME_CATEGORY_ID] = Array.from(current);
          return next;
        });
        return { added: true, prompt: createdPrompt };
      }
      if (duplicate) {
        return { added: false, reason: 'duplicate' };
      }
      return { added: false, reason: 'unknown' };
    },
    [applyWarmupLibraryUpdate, audioSettings.narrationLanguage, updateWarmupSelection],
  );

  const handleSubmitLearnerName = useCallback(() => {
    const result = addLearnerNamePrompt(learnerNameDraft);
    if (result.added && result.prompt) {
      setLearnerNameDraft('');
      showToast({ level: 'success', message: `Am adăugat pronunția pentru „${result.prompt.text}”.` });
      return;
    }
    if (result.reason === 'empty') {
      showToast({ level: 'info', message: 'Scrie un nume înainte de a-l adăuga.' });
      return;
    }
    if (result.reason === 'duplicate') {
      showToast({ level: 'info', message: 'Acest nume este deja în listă.' });
    }
  }, [addLearnerNamePrompt, learnerNameDraft]);

  const handleAddLearnerNameSuggestion = useCallback(
    (name) => {
      const result = addLearnerNamePrompt(name);
      if (result.added && result.prompt) {
        showToast({ level: 'success', message: `Am adăugat pronunția pentru „${result.prompt.text}”.` });
        return;
      }
      if (result.reason === 'duplicate') {
        showToast({ level: 'info', message: 'Sugestia este deja în listă.' });
      }
    },
    [addLearnerNamePrompt],
  );

  const handleDeleteLearnerNamePrompt = (promptId) => {
    const prompt = learnerNamePrompts.find((item) => item.id === promptId);
    handleDeletePromptFromCategory(LEARNER_NAME_CATEGORY_ID, promptId);
    if (prompt?.text) {
      showToast({ level: 'info', message: `Am eliminat pronunția pentru „${prompt.text}”.` });
    }
  };

  const activeCategoryDefinition = useMemo(
    () => WARMUP_CATEGORIES.find((category) => category.id === activeWarmupCategory) || null,
    [activeWarmupCategory],
  );

  const activeCategoryPrompts = activeWarmupCategory ? warmupLibrary[activeWarmupCategory] || [] : [];
  const activeCategorySelection = activeWarmupCategory ? warmupSelection[activeWarmupCategory] || [] : [];
  const activeCategoryModified = activeWarmupCategory
    ? isCategoryModified(warmupLibrary, activeWarmupCategory)
    : false;

  const warmupClipConfig = useMemo(
    () => ({
      language: audioSettings.narrationLanguage || null,
      voiceId: audioSettings.narrationVoiceId || null,
      speakingRate: Number.isFinite(audioSettings.speakingRate)
        ? Number(audioSettings.speakingRate)
        : null,
      pitch: Number.isFinite(audioSettings.pitch) ? Number(audioSettings.pitch) : null,
      model: audioSettings.narrationModel?.trim() || DEFAULT_TTS_MODEL,
      preferredMime: audioSettings.narrationMimeType || null,
      sampleRateHz: Number.isFinite(audioSettings.narrationSampleRate)
        ? Number(audioSettings.narrationSampleRate)
        : null,
    }),
    [
      audioSettings.narrationLanguage,
      audioSettings.narrationVoiceId,
      audioSettings.speakingRate,
      audioSettings.pitch,
      audioSettings.narrationModel,
      audioSettings.narrationMimeType,
      audioSettings.narrationSampleRate,
    ],
  );

  const warmupClipConfigKey = useMemo(
    () =>
      [
        warmupClipConfig.language || '',
        warmupClipConfig.voiceId || '',
        warmupClipConfig.speakingRate ?? '',
        warmupClipConfig.pitch ?? '',
        warmupClipConfig.model || '',
        warmupClipConfig.preferredMime || '',
        warmupClipConfig.sampleRateHz ?? '',
      ].join('|'),
    [
      warmupClipConfig.language,
      warmupClipConfig.voiceId,
      warmupClipConfig.speakingRate,
      warmupClipConfig.pitch,
      warmupClipConfig.model,
      warmupClipConfig.preferredMime,
      warmupClipConfig.sampleRateHz,
    ],
  );

  const buildWarmupDescriptor = useCallback(
    (prompt) => ({
      text: prompt.text,
      language: warmupClipConfig.language,
      voiceId: warmupClipConfig.voiceId,
      speakingRate: warmupClipConfig.speakingRate,
      pitch: warmupClipConfig.pitch,
      model: warmupClipConfig.model,
      preferredMime: warmupClipConfig.preferredMime,
      sampleRateHz: warmupClipConfig.sampleRateHz,
      type: prompt.kind || null,
    }),
    [warmupClipConfig],
  );

  const refreshWarmupCategoryStatus = useCallback(
    async (categoryId) => {
      const prompts = warmupLibrary[categoryId] || [];
      const requestToken = Symbol('warmup-status');
      const signature = warmupClipConfigKey;
      warmupStatusRequestsRef.current[categoryId] = { token: requestToken, signature };
      setWarmupStatusLoadingMap((prev) => ({ ...prev, [categoryId]: true }));
      if (prompts.length === 0) {
        setWarmupPromptStatuses((prev) => ({ ...prev, [categoryId]: {} }));
        setWarmupStatusLoadingMap((prev) => ({ ...prev, [categoryId]: false }));
        delete warmupStatusRequestsRef.current[categoryId];
        return;
      }

      try {
        const results = await Promise.all(
          prompts.map(async (prompt) => {
            const descriptor = buildWarmupDescriptor(prompt);
            const exists = await hasCachedAudioClip(descriptor);
            return { promptId: prompt.id, exists };
          }),
        );

        const currentRequest = warmupStatusRequestsRef.current[categoryId];
        if (
          !currentRequest ||
          currentRequest.token !== requestToken ||
          currentRequest.signature !== signature ||
          warmupClipConfigKey !== signature
        ) {
          return;
        }

        setWarmupPromptStatuses((prev) => {
          const previous = prev?.[categoryId] || {};
          const nextCategory = {};
          results.forEach(({ promptId, exists }) => {
            if (exists) {
              nextCategory[promptId] = 'cached';
            } else if (previous[promptId] === 'error' || previous[promptId] === 'skipped') {
              nextCategory[promptId] = previous[promptId];
            } else {
              nextCategory[promptId] = 'missing';
            }
          });
          return { ...prev, [categoryId]: nextCategory };
        });
      } catch (error) {
        console.warn('Unable to refresh warmup status', error);
      } finally {
        const currentRequest = warmupStatusRequestsRef.current[categoryId];
        if (currentRequest && currentRequest.token === requestToken) {
          setWarmupStatusLoadingMap((prev) => ({ ...prev, [categoryId]: false }));
          delete warmupStatusRequestsRef.current[categoryId];
        }
      }
    },
    [buildWarmupDescriptor, warmupClipConfigKey, warmupLibrary],
  );

  useEffect(() => {
    setWarmupPromptStatuses({});
    setWarmupStatusLoadingMap({});
  }, [warmupClipConfigKey]);

  useEffect(() => {
    if (!activeWarmupCategory) {
      return;
    }
    void refreshWarmupCategoryStatus(activeWarmupCategory);
  }, [activeWarmupCategory, refreshWarmupCategoryStatus]);

  const describeWarmupProgress = (progress) => {
    if (!progress) return 'Generăm clipuri audio…';
    const { completed, total, status } = progress;
    const base = `${completed}/${total} clipuri procesate`;
    if (status === 'skipped') {
      return `${base}. Am omis un clip indisponibil.`;
    }
    if (status === 'error') {
      return `${base}. A apărut o eroare; continuăm cu restul.`;
    }
    return `Generăm clipuri audio… ${base}.`;
  };

  const handleExportChirpManifest = useCallback(() => {
    const tasks = collectWarmupTasks({
      selection: warmupSelection,
      library: warmupLibrary,
      language: CHIRP_DEFAULT_LANGUAGE,
      includeFallbackLanguage: false,
    });

    if (!tasks.length) {
      const message = 'Selectează cel puțin un prompt pentru manifestul Chirp 3.';
      setChirpExportStatus({ state: 'idle', message, promptCount: 0, fileName: null, timestamp: null });
      showToast({ level: 'info', message });
      return;
    }

    const timestamp = new Date();
    const payload = {
      version: 1,
      generatedAt: timestamp.toISOString(),
      voice: {
        name: CHIRP_DEFAULT_VOICE_NAME,
        languageCode: CHIRP_DEFAULT_LANGUAGE,
        audioEncoding: CHIRP_DEFAULT_AUDIO_ENCODING,
        sampleRateHertz: CHIRP_DEFAULT_SAMPLE_RATE,
      },
      prompts: tasks.map((task) => ({
        text: task.text,
        kind: task.kind || 'default',
        categories: Array.from(new Set((task.prompts || []).map((item) => item.categoryId))),
        languageCode: CHIRP_DEFAULT_LANGUAGE,
      })),
    };

    try {
      const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
        type: 'application/json',
      });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = CHIRP_MANIFEST_FILE_NAME;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(href);
      const message =
        tasks.length === 1
          ? 'Manifestul Chirp 3 conține 1 prompt.'
          : `Manifestul Chirp 3 conține ${tasks.length} prompturi.`;
      setChirpExportStatus({
        state: 'success',
        message,
        promptCount: tasks.length,
        fileName: CHIRP_MANIFEST_FILE_NAME,
        timestamp: timestamp.toISOString(),
      });
      showToast({ level: 'success', message: 'Am descărcat manifestul Chirp 3 (JSON).' });
    } catch (error) {
      console.error('Unable to export Chirp manifest', error);
      setChirpExportStatus({
        state: 'error',
        message: 'Nu am putut salva manifestul Chirp 3. Încearcă din nou.',
        promptCount: tasks.length,
        fileName: null,
        timestamp: null,
      });
      showToast({ level: 'error', message: 'Nu am putut genera manifestul Chirp 3.' });
    }
  }, [warmupLibrary, warmupSelection]);

  const handleCopyChirpCommand = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('clipboard_unavailable');
      }
      await navigator.clipboard.writeText(CHIRP_SCRIPT_COMMAND);
      showToast({ level: 'success', message: 'Comanda a fost copiată în clipboard.' });
    } catch (error) {
      console.warn('Unable to copy Chirp command', error);
      showToast({ level: 'error', message: 'Nu am putut copia comanda. Copiaz-o manual.' });
    }
  }, []);

  const handleStartWarmup = async () => {
    if (isWarmupRunning) return;
    if (!hasGeminiApiKey()) {
      const message = 'Adaugă cheia Gemini înainte de a genera clipuri.';
      setWarmupStatus({ state: 'error', message, progress: null });
      showToast({ level: 'warning', message });
      return;
    }

    if (!warmupSelectionCount || warmupSelectedPrompts === 0) {
      const message = 'Selectează cel puțin un prompt pentru generare.';
      setWarmupStatus({ state: 'error', message, progress: null });
      showToast({ level: 'info', message });
      return;
    }

    const selectionSnapshot = Object.fromEntries(
      Object.entries(warmupSelection).map(([categoryId, ids]) => [categoryId, [...ids]]),
    );

    const pendingTasks = collectWarmupTasks({
      selection: selectionSnapshot,
      library: warmupLibrary,
      language: audioSettings.narrationLanguage || null,
      includeFallbackLanguage: true,
    });

    if (!pendingTasks.length) {
      const message = 'Nu există nimic de generat pentru selecția curentă.';
      setWarmupStatus({ state: 'idle', message, progress: null });
      showToast({ level: 'info', message });
      warmupActiveCategoriesRef.current = new Set();
      return;
    }

    const affectedCategories = new Map();
    pendingTasks.forEach((task) => {
      (task.prompts || []).forEach(({ categoryId, promptId }) => {
        if (!affectedCategories.has(categoryId)) {
          affectedCategories.set(categoryId, new Set());
        }
        affectedCategories.get(categoryId).add(promptId);
      });
    });

    warmupActiveCategoriesRef.current = new Set(affectedCategories.keys());

    if (affectedCategories.size > 0) {
      setWarmupPromptStatuses((prev) => {
        const next = { ...prev };
        affectedCategories.forEach((promptIds, categoryId) => {
          const categoryStatuses = { ...(next[categoryId] || {}) };
          promptIds.forEach((promptId) => {
            categoryStatuses[promptId] = 'pending';
          });
          next[categoryId] = categoryStatuses;
        });
        return next;
      });
    }

    const controller = new AbortController();
    warmupControllerRef.current = controller;
    setIsWarmupRunning(true);
    setWarmupStatus({
      state: 'loading',
      message: `Generăm ${pendingTasks.length} clipuri…`,
      progress: { completed: 0, total: pendingTasks.length, task: null, status: 'success' },
    });

    try {
      const result = await precomputeNarrationClips({
        selection: selectionSnapshot,
        library: warmupLibrary,
        language: audioSettings.narrationLanguage || null,
        voiceId: audioSettings.narrationVoiceId || null,
        speakingRate: audioSettings.speakingRate ?? null,
        pitch: audioSettings.pitch ?? null,
        model: audioSettings.narrationModel || null,
        preferredMime: audioSettings.narrationMimeType || null,
        sampleRateHz: audioSettings.narrationSampleRate ?? null,
        includeFallbackLanguage: true,
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress?.task?.prompts?.length) {
            setWarmupPromptStatuses((prev) => {
              const next = { ...prev };
              progress.task.prompts.forEach(({ categoryId, promptId }) => {
                const categoryStatuses = { ...(next[categoryId] || {}) };
                if (progress.status === 'success') {
                  categoryStatuses[promptId] = 'cached';
                } else if (progress.status === 'skipped') {
                  categoryStatuses[promptId] = 'skipped';
                } else if (progress.status === 'error') {
                  categoryStatuses[promptId] = 'error';
                } else {
                  categoryStatuses[promptId] = 'pending';
                }
                next[categoryId] = categoryStatuses;
              });
              return next;
            });
          }
          setWarmupStatus({ state: 'loading', message: describeWarmupProgress(progress), progress });
        },
      });

      if (controller.signal.aborted || result.aborted) {
        const message = 'Generarea manuală a fost oprită.';
        setWarmupStatus({ state: 'idle', message, progress: null });
        showToast({ level: 'info', message });
      } else if (result.rateLimited) {
        const message = 'Gemini a limitat generarea. Unele clipuri nu au fost create.';
        setWarmupStatus({ state: 'error', message, progress: null });
        showToast({ level: 'warning', message });
      } else if (result.errors > 0) {
        const message = `Am terminat cu ${result.errors} erori și ${result.skipped} clipuri omise (${result.processed}/${result.total} reușite).`;
        setWarmupStatus({ state: 'error', message, progress: null });
        showToast({ level: 'warning', message });
      } else {
        const message = result.skipped
          ? `Am generat ${result.processed}/${result.total} clipuri (am omis ${result.skipped}).`
          : `Am generat toate cele ${result.processed} clipuri selectate.`;
        setWarmupStatus({ state: 'success', message, progress: null });
        showToast({ level: 'success', message });
      }
    } catch (error) {
      console.error('Manual warmup failed', error);
      const message = 'Generarea manuală a eșuat. Încearcă din nou.';
      setWarmupStatus({ state: 'error', message, progress: null });
      showToast({ level: 'error', message });
    } finally {
      if (warmupControllerRef.current === controller) {
        warmupControllerRef.current = null;
      }
      const categoriesToRefresh = Array.from(warmupActiveCategoriesRef.current);
      warmupActiveCategoriesRef.current = new Set();
      setIsWarmupRunning(false);
      refreshCacheSummary();
      await refreshCacheEntries();
      if (categoriesToRefresh.length > 0) {
        await Promise.all(categoriesToRefresh.map((categoryId) => refreshWarmupCategoryStatus(categoryId)));
      }
    }
  };

  const handleCancelWarmup = () => {
    if (!warmupControllerRef.current) return;
    warmupControllerRef.current.abort();
    warmupControllerRef.current = null;
    setWarmupStatus((prev) => ({
      state: 'loading',
      message: 'Oprim generarea clipurilor…',
      progress: prev.progress,
    }));
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

            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">Pronunții pentru numele utilizatorului</h3>
                  <p className="text-sm text-slate-500">
                    Adaugă numele copilului, poreclele sau alte moduri în care vrei să-l abordezi. Le poți include la
                    generarea manuală selectând categoria „Nume utilizator”.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenWarmupCategory(LEARNER_NAME_CATEGORY_ID)}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
                >
                  Gestionează toate
                </button>
              </div>

              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  htmlFor="learner-name-draft"
                >
                  Adaugă nume sau formulă de adresare
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="learner-name-draft"
                    type="text"
                    value={learnerNameDraft}
                    onChange={(event) => setLearnerNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleSubmitLearnerName();
                      }
                    }}
                    placeholder="ex. Andrei, Andru, campionul nostru"
                    className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <button
                    type="button"
                    onClick={handleSubmitLearnerName}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4" /> Adaugă la listă
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Numele adăugate aici sunt păstrate local și pot fi generate împreună cu celelalte clipuri TTS.
                </p>
              </div>

              {availableLearnerNameSuggestions.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sugestii din profil</span>
                  <div className="flex flex-wrap gap-2">
                    {availableLearnerNameSuggestions.map((name) => (
                      <button
                        type="button"
                        key={name}
                        onClick={() => handleAddLearnerNameSuggestion(name)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                      >
                        <Plus className="h-3 w-3" /> {name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pronunții salvate</span>
                {learnerNamePrompts.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {learnerNamePrompts.map((prompt) => {
                      const isSelected = learnerNameSelection.includes(prompt.id);
                      return (
                        <div
                          key={prompt.id}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            isSelected
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleTogglePromptSelection(LEARNER_NAME_CATEGORY_ID, prompt.id)}
                            className="flex items-center gap-1 focus:outline-none"
                            aria-pressed={isSelected}
                            title={
                              isSelected
                                ? 'Elimină din generarea curentă'
                                : 'Include în generarea curentă'
                            }
                          >
                            {isSelected ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <Circle className="h-3 w-3 text-slate-400" />
                            )}
                            <span>{prompt.text}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLearnerNamePrompt(prompt.id)}
                            className="rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            title="Șterge"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Nu ai adăugat încă pronunții personalizate. Completează numele mai sus pentru a începe.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Generare manuală clipuri TTS</h3>
                  <p className="text-sm text-slate-500">
                    Selectează ce tipuri de clipuri vrei să pregătim în avans. Generarea pornește doar când apeși butonul de mai jos.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllWarmup}
                    disabled={isWarmupRunning}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      isWarmupRunning ? 'cursor-not-allowed border-slate-200 text-slate-400' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Selectează tot
                  </button>
                  <button
                    type="button"
                    onClick={handleClearWarmupSelection}
                    disabled={isWarmupRunning || warmupSelectedPrompts === 0}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      isWarmupRunning || warmupSelectedPrompts === 0
                        ? 'cursor-not-allowed border-slate-200 text-slate-400'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Resetează selecția
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {WARMUP_CATEGORIES.map((category) => {
                  const prompts = warmupLibrary[category.id] || [];
                  const selectedIds = warmupSelection[category.id] || [];
                  const totalPrompts = prompts.length;
                  const selectedCount = selectedIds.length;
                  const isFullySelected = totalPrompts > 0 && selectedCount === totalPrompts;
                  const isIndeterminate = selectedCount > 0 && selectedCount < totalPrompts;
                  const isActive = selectedCount > 0;
                  const categoryStatusMap = warmupPromptStatuses[category.id] || {};
                  const hasStatusData = Object.keys(categoryStatusMap).length > 0;
                  const categoryStatusLoading = Boolean(warmupStatusLoadingMap[category.id]);
                  const statusCounts = prompts.reduce(
                    (acc, prompt) => {
                      const status = categoryStatusMap[prompt.id];
                      if (status === 'cached') {
                        acc.cached += 1;
                      } else if (status === 'pending') {
                        acc.pending += 1;
                      } else if (status === 'error') {
                        acc.error += 1;
                      } else if (status === 'skipped') {
                        acc.skipped += 1;
                      } else {
                        acc.missing += 1;
                      }
                      return acc;
                    },
                    { cached: 0, pending: 0, error: 0, skipped: 0, missing: 0 },
                  );
                  let statusLabel = '';
                  if (categoryStatusLoading) {
                    statusLabel = 'Verificăm statusul clipurilor…';
                  } else if (hasStatusData && totalPrompts > 0) {
                    const generatedText = `Clipuri generate: ${statusCounts.cached}/${totalPrompts}`;
                    const extras = [];
                    if (statusCounts.pending > 0) {
                      extras.push(`${statusCounts.pending} în curs`);
                    }
                    if (statusCounts.error > 0) {
                      extras.push(`${statusCounts.error} cu erori`);
                    }
                    if (statusCounts.skipped > 0) {
                      extras.push(`${statusCounts.skipped} omise`);
                    }
                    if (statusCounts.cached === 0 && extras.length === 0) {
                      statusLabel = 'Nu există clipuri generate încă.';
                    } else if (extras.length > 0) {
                      statusLabel = `${generatedText} (${extras.join(', ')}).`;
                    } else {
                      statusLabel = `${generatedText}.`;
                    }
                  }
                  return (
                    <div
                      key={category.id}
                      className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 transition ${
                        isActive
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-900'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenWarmupCategory(category.id)}
                        className="flex w-full flex-col items-start gap-2 text-left"
                      >
                          <div className="flex w-full items-start justify-between gap-2">
                            <div>
                              <span className="text-sm font-semibold">{category.label}</span>
                              <p className="mt-1 text-xs text-slate-500">{category.description}</p>
                              {statusLabel ? (
                                <p className="mt-1 text-[11px] text-slate-500">{statusLabel}</p>
                              ) : null}
                            </div>
                          <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase text-indigo-600 shadow-sm">
                            Detalii
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {selectedCount > 0
                            ? `${selectedCount}/${totalPrompts} prompturi selectate`
                            : `${totalPrompts} prompturi disponibile`}
                        </p>
                      </button>
                      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            ref={(element) => {
                              if (element) {
                                element.indeterminate = isIndeterminate;
                              }
                            }}
                            checked={isFullySelected}
                            onChange={() => handleToggleWarmupOption(category.id)}
                            disabled={isWarmupRunning || totalPrompts === 0}
                            className="h-4 w-4 accent-indigo-600"
                          />
                          Generează toate
                        </label>
                        {selectedCount > 0 && selectedCount < totalPrompts ? (
                          <span className="text-[11px] font-semibold text-indigo-600">Selecție parțială</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-xs text-slate-500">
                  <p>
                    {warmupSelectionCount === 0
                      ? 'Niciun prompt selectat momentan.'
                      : `${warmupSelectedPrompts} prompturi din ${warmupSelectionCount} categorii selectate.`}
                  </p>
                  {isWarmupRunning && warmupStatus.progress && (
                    <p>{warmupStatus.message}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportChirpManifest}
                    disabled={warmupSelectedPrompts === 0}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow transition ${
                      warmupSelectedPrompts === 0
                        ? 'cursor-not-allowed bg-emerald-200 text-emerald-800'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    Descarcă manifest Chirp 3 (JSON)
                  </button>
                  <button
                    type="button"
                    onClick={handleStartWarmup}
                    disabled={isWarmupRunning || warmupSelectedPrompts === 0}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow transition ${
                      isWarmupRunning || warmupSelectedPrompts === 0
                        ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isWarmupRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Generăm clipuri…
                      </>
                    ) : (
                      'Generează clipurile selectate'
                    )}
                  </button>
                  {isWarmupRunning && (
                    <button
                      type="button"
                      onClick={handleCancelWarmup}
                      className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      Oprește generarea
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-emerald-900">Script Node pentru pachetul Chirp 3: HD</h4>
                    <p>
                      După ce descarci manifestul <span className="font-semibold">{CHIRP_MANIFEST_FILE_NAME}</span>, mută-l în
                      directorul proiectului și rulează comanda de mai jos. Scriptul va genera fișierele MP3 în{' '}
                      <code className="mx-1 rounded bg-emerald-900/10 px-1 py-[1px] text-[11px]">public/audio/ro-RO/chirp3-hd-a</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyChirpCommand}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-400 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    Copiază comanda
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-xl bg-emerald-900/90 p-3 font-mono text-[11px] leading-relaxed text-emerald-50">{CHIRP_SCRIPT_COMMAND}</pre>
                {chirpExportStatus.message ? (
                  <p
                    className={`${
                      chirpExportStatus.state === 'success'
                        ? 'text-emerald-700'
                        : chirpExportStatus.state === 'error'
                          ? 'text-rose-600'
                          : 'text-emerald-800'
                    }`}
                  >
                    {chirpExportStatus.message}
                    {chirpExportStatus.fileName ? ` (${chirpExportStatus.fileName})` : ''}
                  </p>
                ) : null}
                <p className="text-[11px] text-emerald-700">
                  Manifestul este compatibil cu scriptul{' '}
                  <code className="mx-1 rounded bg-emerald-900/10 px-1 py-[1px]">npm run chirp-pack</code> și poate fi
                  rerulat oricând pentru a reface clipurile. Pentru regenerare forțată, adaugă opțiunea{' '}
                  <code className="mx-1 rounded bg-emerald-900/10 px-1 py-[1px]">--force</code>.
                </p>
              </div>

              {warmupStatus.message && !isWarmupRunning && (
                <p
                  className={`text-xs ${
                    warmupStatus.state === 'error'
                      ? 'text-rose-600'
                      : warmupStatus.state === 'success'
                        ? 'text-emerald-600'
                        : 'text-slate-500'
                  }`}
                >
                  {warmupStatus.message}
                </p>
              )}
            </section>

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
      {activeCategoryDefinition && (
        <WarmupPromptModal
          category={activeCategoryDefinition.id}
          definition={activeCategoryDefinition}
          prompts={activeCategoryPrompts}
          selectedPromptIds={activeCategorySelection}
          onClose={handleCloseWarmupCategory}
          onTogglePrompt={(promptId) =>
            handleTogglePromptSelection(activeCategoryDefinition.id, promptId)
          }
          onSelectAll={() => handleSelectAllPrompts(activeCategoryDefinition.id)}
          onClearSelection={() => handleClearPromptSelection(activeCategoryDefinition.id)}
          onAddPrompt={({ text, language }) =>
            handleAddPromptToCategory(activeCategoryDefinition.id, { text, language })
          }
          onUpdatePrompt={(promptId, updates) =>
            handleUpdatePromptInCategory(activeCategoryDefinition.id, promptId, updates)
          }
          onDeletePrompt={(promptId) =>
            handleDeletePromptFromCategory(activeCategoryDefinition.id, promptId)
          }
          onResetCategory={() => handleResetPromptCategory(activeCategoryDefinition.id)}
          isModified={activeCategoryModified}
          disabled={isWarmupRunning}
          promptStatuses={warmupPromptStatuses[activeCategoryDefinition.id] || {}}
          onRefreshStatus={() => refreshWarmupCategoryStatus(activeCategoryDefinition.id)}
          isStatusLoading={Boolean(warmupStatusLoadingMap[activeCategoryDefinition.id])}
        />
      )}
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
