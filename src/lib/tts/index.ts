import {
  DEFAULT_TTS_MODEL,
  synthesize,
  type SupportedSampleRate,
  type SupportedTtsMime,
} from "../../api/tts";
import {
  getCachedAudioClip as getCachedTtsClip,
  storeAudioClip as storeTtsClip,
  type TtsDescriptor,
} from "../audio/ttsCache";

export type SpeakMode = "live" | "cache" | "webspeech" | "none";

export type SpeakOptions = {
  text: string;
  lang?: string;
  voiceName?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  model?: string | null;
  kind?: string | null;
  allowBrowserFallback?: boolean;
  preferredMime?: SupportedTtsMime | null;
  sampleRateHz?: SupportedSampleRate | null;
};

export type SpeakResult = { ok: boolean; mode: SpeakMode };

type WebSpeechPayload = {
  text: string;
  lang: string;
  voiceName?: string;
  rate: number;
  pitch: number;
  volume: number;
};

const DEFAULT_LANG = "ro-RO";
const DEFAULT_PROMPT_FLAVOR = "generic.v1";
const PROMPT_FLAVOR_BY_KIND: Record<string, string> = {
  problem: "problem.v2",
  "learner-name": "learner-name.v1",
  counting: "counting.v1",
  "mini-lesson": "mini-lesson.v1",
  praise: "praise.v1",
  encouragement: "encouragement.v1",
  hint: "hint.v1",
};
const MIN_RATE = 0.1;
const MAX_RATE = 4;
const MIN_PITCH = 0;
const MAX_PITCH = 2;
const DEFAULT_CACHE_FORMAT: SupportedTtsMime = "audio/mpeg";

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toFinite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function resolvePromptFlavor(kind: string | null | undefined): string {
  if (!kind) {
    return DEFAULT_PROMPT_FLAVOR;
  }
  const normalized = kind.trim().toLowerCase();
  return PROMPT_FLAVOR_BY_KIND[normalized] ?? `${normalized}.v1`;
}

type ServerPlayback = {
  audio: HTMLAudioElement;
  finalize: (success: boolean) => void;
};

let activeServerPlayback: ServerPlayback | null = null;

function stopActiveServerPlayback() {
  if (!activeServerPlayback) {
    return;
  }
  const playback = activeServerPlayback;
  activeServerPlayback = null;
  try {
    playback.finalize(false);
  } catch (error) {
    console.warn("[tts] Failed to stop active server playback", error);
  }
}

async function playAudioBuffer(
  buffer: ArrayBuffer,
  mimeType: string,
  volume = 1,
  playbackRate = 1,
): Promise<boolean> {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return false;
  }

  stopActiveServerPlayback();

  const blob = new Blob([buffer], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.src = objectUrl;
  audio.volume = clamp(volume, 0, 1);
  audio.playbackRate = clamp(playbackRate, MIN_RATE, MAX_RATE);

  const globalAudio = audio as any;
  if (typeof globalAudio.preservesPitch === "boolean") {
    globalAudio.preservesPitch = true;
  }
  if (typeof globalAudio.mozPreservesPitch === "boolean") {
    globalAudio.mozPreservesPitch = true;
  }
  if (typeof globalAudio.webkitPreservesPitch === "boolean") {
    globalAudio.webkitPreservesPitch = true;
  }

  try {
    await audio.play();
  } catch (error) {
    console.warn("[tts] Unable to play server audio", error);
    URL.revokeObjectURL(objectUrl);
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    let settled = false;

    const finalize = (success: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      try {
        audio.pause();
        audio.src = "";
      } catch {
        // ignore cleanup errors
      }
      URL.revokeObjectURL(objectUrl);
      resolve(success);
    };

    const handleEnded = () => {
      if (activeServerPlayback?.audio === audio) {
        activeServerPlayback = null;
      }
      finalize(true);
    };

    const handleError = () => {
      if (activeServerPlayback?.audio === audio) {
        activeServerPlayback = null;
      }
      finalize(false);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    activeServerPlayback = {
      audio,
      finalize: (success: boolean) => {
        if (activeServerPlayback?.audio === audio) {
          activeServerPlayback = null;
        }
        finalize(success);
      },
    };
  });
}

async function waitForVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const existing = synth.getVoices();
  if (existing.length > 0) {
    return existing;
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      resolve(synth.getVoices());
    }, 1000);
    const handleVoicesChanged = () => {
      clearTimeout(timeout);
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", handleVoicesChanged);
  });
}

async function speakWithWebSpeech(payload: WebSpeechPayload): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  const synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance === "undefined") {
    return false;
  }
  if (!payload.text.trim()) {
    return false;
  }
  try {
    stopActiveServerPlayback();
    synth.cancel();
  } catch (error) {
    console.warn("[tts] Unable to cancel existing speech synthesis", error);
  }
  const utterance = new SpeechSynthesisUtterance(payload.text);
  utterance.lang = payload.lang;
  utterance.rate = clamp(payload.rate, MIN_RATE, MAX_RATE);
  utterance.pitch = clamp(payload.pitch, MIN_PITCH, MAX_PITCH);
  utterance.volume = clamp(payload.volume, 0, 1);

  try {
    const voices = await waitForVoices(synth);
    if (payload.voiceName && Array.isArray(voices)) {
      const voice = voices.find((item) => item.name === payload.voiceName);
      if (voice) {
        utterance.voice = voice;
      }
    }
  } catch (error) {
    console.warn("[tts] Unable to load Web Speech voices", error);
  }

  try {
    await new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(event);
      synth.speak(utterance);
    });
    return true;
  } catch (error) {
    console.warn("[tts] Web Speech playback failed", error);
    return false;
  }
}

async function fallbackToWebSpeech(payload: WebSpeechPayload): Promise<SpeakResult> {
  const ok = await speakWithWebSpeech(payload);
  return { ok, mode: ok ? "webspeech" : "none" };
}

export async function speak({
  text,
  lang = DEFAULT_LANG,
  voiceName,
  rate = 1,
  pitch = 1,
  volume = 1,
  model = null,
  kind = null,
  allowBrowserFallback = false,
  preferredMime = null,
  sampleRateHz = null,
}: SpeakOptions): Promise<SpeakResult> {
  const content = text?.trim();
  if (!content) {
    return { ok: false, mode: "none" };
  }

  const normalizedLang = lang?.trim() || DEFAULT_LANG;
  const trimmedVoice = voiceName?.trim() || "";
  const normalizedRate = toFinite(rate, 1);
  const normalizedPitch = toFinite(pitch, 1);
  const normalizedVolume = clamp(toFinite(volume, 1), 0, 1);
  const playbackRate = clamp(normalizedRate, MIN_RATE, MAX_RATE);
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  const resolvedModel = typeof model === "string" ? model.trim() : null;
  const resolvedModelName = resolvedModel || DEFAULT_TTS_MODEL;
  const resolvedKind = typeof kind === "string" ? kind.trim() : null;
  const promptFlavor = resolvePromptFlavor(resolvedKind);

  const descriptor: TtsDescriptor = {
    text: content,
    lang: normalizedLang,
    voice: trimmedVoice,
    model: resolvedModelName,
    flavor: promptFlavor,
    rate: Number.isFinite(normalizedRate) ? normalizedRate : 1,
    pitch: Number.isFinite(normalizedPitch) ? normalizedPitch : 1,
    format: (preferredMime || DEFAULT_CACHE_FORMAT) as string,
    sampleRate: typeof sampleRateHz === "number" ? sampleRateHz : undefined,
  };

  const fallbackPayload: WebSpeechPayload = {
    text: content,
    lang: normalizedLang,
    voiceName: trimmedVoice || undefined,
    rate: normalizedRate,
    pitch: normalizedPitch,
    volume: normalizedVolume,
  };

  try {
    const cachedClip = await getCachedTtsClip(descriptor);
    if (cachedClip) {
      const buffer = await cachedClip.arrayBuffer();
      if (buffer.byteLength > 0) {
        const mimeType = cachedClip.type || descriptor.format || DEFAULT_CACHE_FORMAT;
        const played = await playAudioBuffer(buffer, mimeType, normalizedVolume, playbackRate);
        if (played) {
          return { ok: true, mode: "cache" };
        }
      }
    }
  } catch (error) {
    console.warn("[tts] Unable to read cached audio clip", error);
  }

  if (isOffline) {
    if (allowBrowserFallback) {
      return fallbackToWebSpeech(fallbackPayload);
    }
    return { ok: false, mode: "none" };
  }

  try {
    stopActiveServerPlayback();
    const blob = await synthesize(content, {
      voiceId: trimmedVoice || undefined,
      speakingRate: normalizedRate,
      pitch: normalizedPitch,
      language: normalizedLang,
      model: resolvedModelName,
      kind: resolvedKind,
      promptFlavor,
      preferredMime: preferredMime || DEFAULT_CACHE_FORMAT,
      sampleRateHz: typeof sampleRateHz === "number" ? sampleRateHz : undefined,
    });
    const buffer = await blob.arrayBuffer();
    const contentType = blob.type || DEFAULT_CACHE_FORMAT;
    try {
      const descriptorForStorage: TtsDescriptor = {
        ...descriptor,
        format: contentType || descriptor.format || DEFAULT_CACHE_FORMAT,
        sampleRate: descriptor.sampleRate,
      };
      await storeTtsClip(descriptorForStorage, blob);
    } catch (error) {
      console.warn("[tts] Unable to cache synthesized audio", error);
    }
    if (buffer.byteLength > 0) {
      const played = await playAudioBuffer(buffer, contentType, normalizedVolume, playbackRate);
      if (played) {
        return { ok: true, mode: "live" };
      }
    }
    if (allowBrowserFallback) {
      return fallbackToWebSpeech(fallbackPayload);
    }
    return { ok: false, mode: "none" };
  } catch (error: any) {
    if (
      error instanceof Error &&
      (error.message === "tts_ratelimited" || (error as any)?.status === 429 || (error as any)?.code === 429)
    ) {
      if (allowBrowserFallback) {
        return fallbackToWebSpeech(fallbackPayload);
      }
      return { ok: false, mode: "none" };
    }
    if (error instanceof Error && error.message === "tts_unavailable") {
      if (allowBrowserFallback) {
        return fallbackToWebSpeech(fallbackPayload);
      }
      throw error;
    }
    if (allowBrowserFallback) {
      return fallbackToWebSpeech(fallbackPayload);
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

const toLanguageKey = (value: string | null | undefined): string => {
  if (!value) return "en";
  return value.split("-")[0]?.toLowerCase() || value.toLowerCase();
};

const buildStoryReminder = (story: string, language: string | null | undefined): string => {
  const languageKey = toLanguageKey(language);
  if (languageKey === "ro") {
    return ` Gândește-te la povestea noastră: ${story}`;
  }
  return ` Think about our story: ${story}`;
};

export async function speakProblem(
  card: { a: number; b: number },
  meta: { story?: string | null; studentName?: string | null; language?: string | null } = {},
): Promise<SpeakResult> {
  const language = meta.language ?? DEFAULT_LANG;
  const story = meta.story?.trim();
  const name = meta.studentName?.trim();
  const baseQuestion = `What is ${card.a} + ${card.b}?`;
  let prompt = baseQuestion;
  if (toLanguageKey(language) === "ro") {
    prompt = `Cât face ${card.a} + ${card.b}?`;
  }
  if (story) {
    prompt = `${prompt}${buildStoryReminder(story, language)}`;
  }

  if (name) {
    await speak({ text: name, lang: language, kind: "learner-name" });
  }

  return speak({ text: prompt, lang: language, kind: "problem" });
}

export async function speakHint(text: string): Promise<SpeakResult> {
  if (!text?.trim()) {
    return { ok: false, mode: "none" };
  }
  return speak({ text });
}

const PRAISE_DEFAULT = "Bravo!";

export async function speakPraise(text: string = PRAISE_DEFAULT): Promise<SpeakResult> {
  return speak({ text });
}

export function stopSpeaking(): void {
  stopActiveServerPlayback();
  if (typeof window === "undefined") {
    return;
  }
  const synth = window.speechSynthesis;
  if (!synth) {
    return;
  }
  try {
    synth.cancel();
  } catch (error) {
    console.warn("[tts] Unable to cancel speech synthesis", error);
  }
}

if (typeof window !== "undefined") {
  (window as any).__tts = { speakProblem, speakHint, speakPraise };
  (window as any).speakProblem = (window as any).speakProblem || (window as any).__tts.speakProblem;
  (window as any).speakHint = (window as any).speakHint || (window as any).__tts.speakHint;
  (window as any).speakPraise = (window as any).speakPraise || (window as any).__tts.speakPraise;
}

