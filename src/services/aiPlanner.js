import { deriveMotifsFromInterests } from '../lib/aiPersonalization';
import { clearGeminiApiKey, getGeminiApiKey, hasGeminiApiKey, setGeminiApiKey } from '../lib/gemini/apiKey';

export async function saveGeminiKey(key, model) {
  const trimmed = typeof key === 'string' ? key.trim() : '';
  if (!trimmed) {
    clearGeminiApiKey();
    return { verified: false, serverHasKey: false, message: 'Cheia Gemini a fost ștearsă.' };
  }
  setGeminiApiKey(trimmed);
  return {
    verified: true,
    serverHasKey: true,
    message: 'Cheia Gemini a fost salvată local în browser.',
    model: typeof model === 'string' ? model.trim() || null : null,
  };
}

export async function testGeminiKey() {
  const hasKey = hasGeminiApiKey();
  return {
    ok: hasKey,
    serverHasKey: hasKey,
    message: hasKey
      ? 'Cheia Gemini este disponibilă local.'
      : 'Cheia Gemini lipsește. Adaug-o în setările AI.',
  };
}

export async function requestGeminiPlan() {
  return null;
}

export async function requestRuntimeContent() {
  return null;
}

export async function requestInterestMotifs(interests = []) {
  const normalized = Array.isArray(interests)
    ? interests
        .map((entry) => (typeof entry === 'string' ? entry.trim() : null))
        .filter((entry) => entry)
    : [];
  const motifs = deriveMotifsFromInterests(normalized);
  return {
    motifs,
    urls: [],
    pending: 0,
    done: motifs.length,
    cacheKey: null,
    nextRetryAt: null,
  };
}

export async function getServerKeyStatus() {
  return hasGeminiApiKey();
}

export function getStoredGeminiKey() {
  return getGeminiApiKey();
}
