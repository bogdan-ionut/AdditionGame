const GEMINI_STATUS_KEY = 'additionFlashcardsGeminiKeyStatus';
const GEMINI_SHADOW_KEY = 'additionFlashcardsGeminiKeyShadow';

const GEMINI_STATUS_UPDATED_AT_KEY = 'additionFlashcardsGeminiKeySavedAt';

const getApiBase = () => {
  let base = import.meta.env?.VITE_AI_PROXY_URL;

  if (typeof window !== 'undefined' && window.localStorage) {
    const override = window.localStorage.getItem('VITE_AI_PROXY_URL');
    if (override) base = override;
  }

  if (!base) return '/api';
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

export function isGeminiConfigured() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(GEMINI_STATUS_KEY));
}

export async function saveGeminiKeyPlaceholder(geminiKey) {
  const base = getApiBase();
  try {
    const response = await fetch(`${base}/gemini/svsm/entry/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ apiKey: geminiKey }),
    });
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    const result = await response.json().catch(() => ({ ok: true }));
    if (result?.ok === false) {
      throw new Error(result?.error || 'Gemini key storage failed');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(GEMINI_STATUS_KEY, 'remote');
      localStorage.removeItem(GEMINI_SHADOW_KEY);
      localStorage.setItem(GEMINI_STATUS_UPDATED_AT_KEY, new Date().toISOString());
    }
    return { remote: true, message: 'Gemini key stored on your secure proxy.' };
  } catch (error) {
    console.warn('Falling back to local Gemini key storage. Configure a secure proxy for production.', error);
    if (typeof window !== 'undefined') {
      localStorage.setItem(GEMINI_STATUS_KEY, 'local');
      localStorage.setItem(GEMINI_SHADOW_KEY, btoa(geminiKey.slice(0, 8)));
      localStorage.setItem(GEMINI_STATUS_UPDATED_AT_KEY, new Date().toISOString());
    }
    return { remote: false, message: 'Saved locally for demo purposes. Configure the edge proxy to secure it server-side.' };
  }
}

export function getGeminiKeyStatus() {
  if (typeof window === 'undefined') {
    return { configured: false, location: null, preview: null, savedAt: null };
  }

  const location = localStorage.getItem(GEMINI_STATUS_KEY);
  if (!location) {
    return { configured: false, location: null, preview: null, savedAt: null };
  }

  let preview = null;
  if (location === 'local') {
    const encoded = localStorage.getItem(GEMINI_SHADOW_KEY);
    if (encoded && typeof atob === 'function') {
      try {
        preview = atob(encoded);
      } catch (error) {
        console.warn('Unable to decode Gemini key preview', error);
        preview = null;
      }
    }
  }

  const savedAt = localStorage.getItem(GEMINI_STATUS_UPDATED_AT_KEY);

  return {
    configured: true,
    location,
    preview,
    savedAt,
  };
}

export async function requestGeminiPlan(payload) {
  const base = getApiBase();
  try {
    const response = await fetch(`${base}/gemini/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    let json = null;
    try {
      json = await response.json();
    } catch (error) {
      json = null;
    }

    if (response.status === 429) {
      const headerRetry = Number(response.headers.get('Retry-After') ?? '0');
      const bodyRetry = Number(json?.retry_in_seconds ?? 0);
      const retryInSeconds = Math.max(headerRetry || 0, bodyRetry || 0) || 45;
      return { rateLimited: true, retryInSeconds, upstream: json };
    }

    if (!response.ok) {
      const error = new Error(`Gemini planner responded with ${response.status}`);
      error.details = json;
      throw error;
    }

    const meta = json?._meta;
    const plan = json?.plan?.items ? json.plan : json;
    return { plan, meta };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unable to request Gemini plan');
    if (!err.message) {
      err.message = 'Unable to request Gemini plan';
    }
    throw err;
  }
}

export async function requestInterestMotifs(interests) {
  const base = getApiBase();
  try {
    const response = await fetch(`${base}/interests/packs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ interests }),
    });
    if (!response.ok) {
      throw new Error(`Interest motif endpoint responded with ${response.status}`);
    }
    const data = await response.json();
    const motifs = Array.isArray(data?.motifs)
      ? data.motifs
      : Array.isArray(data)
        ? data
        : [];
    const themePacks = Array.isArray(data?.themePacks)
      ? data.themePacks
      : Array.isArray(data?.packs)
        ? data.packs
        : [];
    const model = data?.model || data?.source || null;
    return { motifs, themePacks, model };
  } catch (error) {
    console.warn('Interest motif request failed', error);
    return { motifs: [], themePacks: [], model: null };
  }
}
