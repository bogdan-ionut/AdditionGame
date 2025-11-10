import { synthesize } from '../api/tts';
import { getLocalSfxCatalog, getLocalSfxClip } from '../lib/audio/localSfx';
import { hasGeminiApiKey } from '../lib/gemini/apiKey';

const DEFAULT_TTS_MODEL = {
  id: 'gemini-2.5-flash-preview-tts',
  label: 'Gemini Flash TTS',
};

const GEMINI_VOICES = [
  {
    id: 'Kore',
    label: 'Kore · Română prietenoasă',
    language: 'ro-RO',
    gender: 'neutral',
    tags: ['gemini', 'default'],
  },
  {
    id: 'Juniper',
    label: 'Juniper · English upbeat',
    language: 'en-US',
    gender: 'neutral',
    tags: ['gemini'],
  },
  {
    id: 'Poppy',
    label: 'Poppy · Español cálido',
    language: 'es-ES',
    gender: 'neutral',
    tags: ['gemini'],
  },
];

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const selectVoicesForLanguage = (lang) => {
  if (!lang) return GEMINI_VOICES;
  const normalized = lang.trim().toLowerCase();
  const matches = GEMINI_VOICES.filter((voice) => voice.language.toLowerCase().startsWith(normalized));
  return matches.length ? matches : GEMINI_VOICES;
};

const resolveLocalSfx = ({ pack, category, mode } = {}) => {
  const key = (() => {
    if (mode === 'low-stim') return 'low-stim';
    if (pack && pack !== 'auto') return pack;
    return 'default';
  })();
  if (category) {
    return getLocalSfxClip(category, key);
  }
  return getLocalSfxCatalog(key);
};

export async function fetchTtsModels() {
  return [DEFAULT_TTS_MODEL];
}

export async function fetchTtsVoices({ lang } = {}) {
  return selectVoicesForLanguage(lang);
}

export async function fetchAudioSfx({ pack, name, category, mode } = {}) {
  const local = resolveLocalSfx({ pack, category, mode });
  if (!local) {
    return null;
  }
  if (name && typeof name === 'string' && local && typeof local === 'object' && local.clips) {
    const clip = ensureArray(local.clips).find((item) => item.id === name);
    return clip || null;
  }
  return local;
}

export async function synthesizeSpeech(payload = {}) {
  if (!hasGeminiApiKey()) {
    throw new Error('Configurează cheia Gemini în AI Settings pentru a genera voce.');
  }
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!text) {
    throw new Error('Introduceți text pentru sintetizare.');
  }

  const blob = await synthesize(text, {
    voiceId: payload.voiceId || payload.voice || undefined,
    speakingRate:
      typeof payload.speakingRate === 'number'
        ? payload.speakingRate
        : typeof payload.speaking_rate === 'number'
          ? payload.speaking_rate
          : undefined,
    pitch: typeof payload.pitch === 'number' ? payload.pitch : undefined,
    language:
      payload.languageCode ||
      payload.language_code ||
      payload.language ||
      payload.lang ||
      undefined,
    model: payload.model || payload.ttsModel || undefined,
    preferredMime: payload.mime || payload.preferredMime || undefined,
  });
  const buffer = await blob.arrayBuffer();
  return { buffer, mimeType: blob.type || 'audio/mpeg' };
}
