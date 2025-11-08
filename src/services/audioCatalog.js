import { MathGalaxyApiError, request } from './mathGalaxyClient';
import { isAiProxyConfigured } from './aiEndpoints';

const OFFLINE_MESSAGE = 'API offline sau URL greșit. Deschide AI Settings pentru a verifica Cloud API Base URL.';

const normalizeError = (error) => {
  if (error instanceof MathGalaxyApiError) {
    return error;
  }
  return new MathGalaxyApiError(error instanceof Error ? error.message : OFFLINE_MESSAGE, { cause: error });
};

export async function fetchTtsModels() {
  if (!isAiProxyConfigured()) {
    throw new MathGalaxyApiError(OFFLINE_MESSAGE);
  }
  try {
    const response = await request('/v1/ai/tts/models');
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const data = contentType.includes('application/json') ? await response.json() : null;
      throw new MathGalaxyApiError(
        (data && data.error) || 'Failed to load TTS models.',
        { data, status: response.status },
      );
    }
    if (!contentType.includes('application/json')) {
      return [];
    }
    return await response.json();
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function fetchTtsVoices({ lang, model } = {}) {
  if (!isAiProxyConfigured()) {
    throw new MathGalaxyApiError(OFFLINE_MESSAGE);
  }
  try {
    const search = new URLSearchParams();
    if (lang) {
      search.set('lang', lang);
    }
    if (model) {
      search.set('model', model);
    }
    const path = search.size ? `/v1/ai/tts/voices?${search.toString()}` : '/v1/ai/tts/voices';
    const response = await request(path);
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const data = contentType.includes('application/json') ? await response.json() : null;
      if (response.status === 404) {
        return [];
      }
      throw new MathGalaxyApiError(
        (data && data.error) || 'Failed to load TTS voices.',
        { data, status: response.status },
      );
    }
    if (!contentType.includes('application/json')) {
      return [];
    }
    return await response.json();
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function fetchAudioSfx({ pack, name } = {}) {
  if (!isAiProxyConfigured()) {
    throw new MathGalaxyApiError(OFFLINE_MESSAGE);
  }
  try {
    const search = new URLSearchParams();
    if (pack) {
      search.set('pack', pack);
    }
    if (name) {
      search.set('name', name);
    }
    const path = search.size ? `/v1/ai/audio/sfx?${search.toString()}` : '/v1/ai/audio/sfx';
    const response = await request(path, {
      headers: { Accept: 'audio/mpeg,application/json' },
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const data = contentType.includes('application/json') ? await response.json() : null;
      throw new MathGalaxyApiError(
        (data && data.error) || 'Failed to load SFX clips.',
        { data, status: response.status },
      );
    }
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    if (contentType.startsWith('audio/')) {
      const buffer = await response.arrayBuffer();
      return { buffer, mimeType: contentType.split(';')[0] || contentType };
    }
    return null;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function synthesizeSpeech(payload = {}) {
  if (!isAiProxyConfigured()) {
    throw new MathGalaxyApiError(OFFLINE_MESSAGE);
  }
  try {
    const response = await request('/v1/ai/tts/say', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { Accept: 'audio/mpeg,application/json' },
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const data = contentType.includes('application/json') ? await response.json() : null;
      throw new MathGalaxyApiError(
        (data && data.error) || 'TTS synthesis failed.',
        { data, status: response.status },
      );
    }
    if (contentType.startsWith('audio/')) {
      const buffer = await response.arrayBuffer();
      return { buffer, mimeType: contentType.split(';')[0] || contentType };
    }
    if (contentType.includes('application/json')) {
      const data = await response.json();
      throw new MathGalaxyApiError(data?.error || 'TTS synthesis failed.', { data });
    }
    throw new MathGalaxyApiError('TTS synthesis returned an unexpected response.');
  } catch (error) {
    throw normalizeError(error);
  }
}
