import { loadAiConfig } from '../ai/runtime';

export const LS_AUDIO_SETTINGS = 'audio.settings.v1';
export const AUDIO_SETTINGS_EVENT = 'audio-settings:update';

export type AudioSettings = {
  narrationEnabled: boolean;
  narrationAutoplay: boolean;
  narrationVolume: number;
  narrationVoiceId: string | null;
  narrationVoiceLabel: string | null;
  narrationLanguage: string | null;
  narrationModel: string | null;
  speakingRate: number;
  pitch: number;
  repeatNumbers: boolean;
  feedbackVoiceEnabled: boolean;
  sfxEnabled: boolean;
  sfxPackId: string | null;
  sfxLowStimMode: boolean;
  sfxVolume: number;
  updatedAt: string;
};

const createDefaultAudioSettings = (): AudioSettings => {
  const aiConfig = loadAiConfig();
  return {
    narrationEnabled: true,
    narrationAutoplay: true,
    narrationVolume: 0.9,
    narrationVoiceId: null,
    narrationVoiceLabel: null,
    narrationLanguage: 'ro-RO',
    narrationModel: aiConfig.audioModel || null,
    speakingRate: 1.0,
    pitch: 0,
    repeatNumbers: true,
    feedbackVoiceEnabled: true,
    sfxEnabled: true,
    sfxPackId: null,
    sfxLowStimMode: false,
    sfxVolume: 0.6,
    updatedAt: new Date().toISOString(),
  };
};

export function loadAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') {
    return createDefaultAudioSettings();
  }

  try {
    const raw = window.localStorage.getItem(LS_AUDIO_SETTINGS);
    if (!raw) {
      return createDefaultAudioSettings();
    }

    const parsed = JSON.parse(raw) ?? {};
    const base = createDefaultAudioSettings();

    const merged: AudioSettings = {
      ...base,
      narrationEnabled: parsed?.narrationEnabled !== false,
      narrationAutoplay: parsed?.narrationAutoplay !== false,
      narrationVolume: Number.isFinite(parsed?.narrationVolume) ? Number(parsed.narrationVolume) : base.narrationVolume,
      narrationVoiceId: typeof parsed?.narrationVoiceId === 'string' ? parsed.narrationVoiceId : null,
      narrationVoiceLabel: typeof parsed?.narrationVoiceLabel === 'string' ? parsed.narrationVoiceLabel : null,
      narrationLanguage: typeof parsed?.narrationLanguage === 'string' ? parsed.narrationLanguage : base.narrationLanguage,
      narrationModel: typeof parsed?.narrationModel === 'string' ? parsed.narrationModel : base.narrationModel,
      speakingRate: Number.isFinite(parsed?.speakingRate) ? Number(parsed.speakingRate) : base.speakingRate,
      pitch: Number.isFinite(parsed?.pitch) ? Number(parsed.pitch) : base.pitch,
      repeatNumbers: parsed?.repeatNumbers !== false,
      feedbackVoiceEnabled: parsed?.feedbackVoiceEnabled !== false,
      sfxEnabled: parsed?.sfxEnabled !== false,
      sfxPackId: typeof parsed?.sfxPackId === 'string' ? parsed.sfxPackId : null,
      sfxLowStimMode: parsed?.sfxLowStimMode === true,
      sfxVolume: Number.isFinite(parsed?.sfxVolume) ? Number(parsed.sfxVolume) : base.sfxVolume,
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : base.updatedAt,
    };

    return merged;
  } catch (error) {
    console.warn('[audio] Unable to load audio settings from localStorage', error);
    return createDefaultAudioSettings();
  }
}

export function saveAudioSettings(next: Partial<AudioSettings>): AudioSettings {
  const current = loadAudioSettings();
  const merged: AudioSettings = {
    ...current,
    ...next,
    narrationEnabled: next.narrationEnabled ?? current.narrationEnabled,
    narrationAutoplay: next.narrationAutoplay ?? current.narrationAutoplay,
    narrationVolume:
      next.narrationVolume != null && Number.isFinite(next.narrationVolume)
        ? Math.min(1, Math.max(0, Number(next.narrationVolume)))
        : current.narrationVolume,
    narrationVoiceId: next.narrationVoiceId ?? current.narrationVoiceId,
    narrationVoiceLabel: next.narrationVoiceLabel ?? current.narrationVoiceLabel,
    narrationLanguage: next.narrationLanguage ?? current.narrationLanguage,
    narrationModel: next.narrationModel ?? current.narrationModel,
    speakingRate:
      next.speakingRate != null && Number.isFinite(next.speakingRate)
        ? Math.min(2, Math.max(0.5, Number(next.speakingRate)))
        : current.speakingRate,
    pitch:
      next.pitch != null && Number.isFinite(next.pitch)
        ? Math.min(12, Math.max(-12, Number(next.pitch)))
        : current.pitch,
    repeatNumbers: next.repeatNumbers ?? current.repeatNumbers,
    feedbackVoiceEnabled: next.feedbackVoiceEnabled ?? current.feedbackVoiceEnabled,
    sfxEnabled: next.sfxEnabled ?? current.sfxEnabled,
    sfxPackId: next.sfxPackId ?? current.sfxPackId,
    sfxLowStimMode: next.sfxLowStimMode ?? current.sfxLowStimMode,
    sfxVolume:
      next.sfxVolume != null && Number.isFinite(next.sfxVolume)
        ? Math.min(1, Math.max(0, Number(next.sfxVolume)))
        : current.sfxVolume,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LS_AUDIO_SETTINGS, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent<AudioSettings>(AUDIO_SETTINGS_EVENT, { detail: merged }));
    } catch (error) {
      console.warn('[audio] Unable to persist audio settings', error);
    }
  }

  return merged;
}

export function resetAudioSettings(): AudioSettings {
  const defaults = createDefaultAudioSettings();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LS_AUDIO_SETTINGS, JSON.stringify(defaults));
      window.dispatchEvent(new CustomEvent<AudioSettings>(AUDIO_SETTINGS_EVENT, { detail: defaults }));
    } catch (error) {
      console.warn('[audio] Unable to reset audio settings', error);
    }
  }
  return defaults;
}
