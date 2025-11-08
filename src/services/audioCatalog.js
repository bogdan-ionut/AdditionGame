import mathGalaxyClient, { MathGalaxyApiError } from './mathGalaxyClient';
import { isAiProxyConfigured } from './aiEndpoints';

const OFFLINE_MESSAGE = 'API offline sau URL greșit. Verifică VITE_MATH_API_URL.';

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
    return await mathGalaxyClient.aiTtsModels();
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function fetchTtsVoices({ mode } = {}) {
  if (!isAiProxyConfigured()) {
    throw new MathGalaxyApiError(OFFLINE_MESSAGE);
  }
  try {
    return await mathGalaxyClient.aiTtsVoices({ mode });
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function fetchAudioSfx({ mode } = {}) {
  if (!isAiProxyConfigured()) {
    throw new MathGalaxyApiError(OFFLINE_MESSAGE);
  }
  try {
    return await mathGalaxyClient.aiAudioSfx({ mode });
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function synthesizeSpeech(payload = {}) {
  if (!isAiProxyConfigured()) {
    throw new MathGalaxyApiError(OFFLINE_MESSAGE);
  }
  try {
    return await mathGalaxyClient.aiTtsSynthesize(payload);
  } catch (error) {
    throw normalizeError(error);
  }
}
