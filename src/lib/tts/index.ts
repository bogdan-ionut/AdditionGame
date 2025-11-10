import { synthesize } from "../../api/tts";

export type SpeakMode = "server" | "webspeech" | "none";

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
const MIN_RATE = 0.1;
const MAX_RATE = 4;
const MIN_PITCH = 0;
const MAX_PITCH = 2;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toFinite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
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
}: SpeakOptions): Promise<SpeakResult> {
  const content = text?.trim();
  if (!content) {
    return { ok: false, mode: "none" };
  }

  const fallbackPayload: WebSpeechPayload = {
    text: content,
    lang,
    voiceName,
    rate: toFinite(rate, 1),
    pitch: toFinite(pitch, 1),
    volume: clamp(toFinite(volume, 1), 0, 1),
  };

  try {
    stopActiveServerPlayback();
    const blob = await synthesize(content, {
      voiceId: voiceName || undefined,
      speakingRate: toFinite(rate, 1),
      pitch: toFinite(pitch, 1),
      language: lang,
      model,
      kind,
    });
    const buffer = await blob.arrayBuffer();
    if (buffer.byteLength > 0) {
      const contentType = blob.type || "audio/mpeg";
      const playbackRate = clamp(toFinite(rate, 1), MIN_RATE, MAX_RATE);
      const played = await playAudioBuffer(buffer, contentType, clamp(volume, 0, 1), playbackRate);
      if (played) {
        return { ok: true, mode: "server" };
      }
    }
    if (allowBrowserFallback) {
      return fallbackToWebSpeech(fallbackPayload);
    }
    return { ok: false, mode: "none" };
  } catch (error: any) {
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

export async function speakProblem(
  card: { a: number; b: number },
  meta: { story?: string | null } = {},
): Promise<SpeakResult> {
  const story = meta.story?.trim();
  const prompt = story
    ? `Cât face ${card.a} plus ${card.b}? Gândește-te la povestea noastră: ${story}`
    : `Cât face ${card.a} plus ${card.b}?`;
  return speak({ text: prompt });
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

