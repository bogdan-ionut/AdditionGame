export type SynthTone = {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  attack?: number;
  release?: number;
  detune?: number;
};

type SequenceOptions = {
  baseGain?: number;
};

let sharedContext: AudioContext | null = null;

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const resolveAudioConstructor = (): typeof AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  return typeof Ctor === 'function' ? (Ctor as typeof AudioContext) : null;
};

const obtainContext = async (): Promise<AudioContext | null> => {
  const AudioCtor = resolveAudioConstructor();
  if (!AudioCtor) return null;
  if (!sharedContext || sharedContext.state === 'closed') {
    try {
      sharedContext = new AudioCtor();
    } catch (error) {
      sharedContext = null;
      return null;
    }
  }
  if (!sharedContext) return null;
  if (sharedContext.state === 'suspended') {
    try {
      await sharedContext.resume();
    } catch (error) {
      // ignore resume issues, browser may require gesture
    }
  }
  return sharedContext;
};

const playSequence = async (steps: SynthTone[], options: SequenceOptions = {}): Promise<boolean> => {
  if (!Array.isArray(steps) || steps.length === 0) return false;
  const context = await obtainContext();
  if (!context) return false;
  const baseGain = clamp(options.baseGain ?? 0.5, 0, 1);
  const startTime = context.currentTime;
  let cursor = startTime;
  let finalTime = startTime;

  for (const step of steps) {
    if (!step || !Number.isFinite(step.frequency) || !Number.isFinite(step.duration)) {
      cursor += step?.delay ?? 0;
      continue;
    }
    const duration = Math.max(0, step.duration);
    if (duration === 0) {
      cursor += step.delay ?? 0;
      continue;
    }
    const delay = clamp(step.delay ?? 0, 0, 10);
    const attack = clamp(step.attack ?? 0.02, 0.001, duration);
    const release = clamp(step.release ?? 0.12, 0.005, duration);
    const start = cursor + delay;
    const end = start + duration;

    const oscillator = context.createOscillator();
    oscillator.type = step.type ?? 'sine';
    oscillator.frequency.setValueAtTime(step.frequency, start);
    if (Number.isFinite(step.detune ?? NaN)) {
      oscillator.detune.setValueAtTime(step.detune ?? 0, start);
    }

    const gainNode = context.createGain();
    const targetGain = clamp((step.gain ?? 1) * baseGain, 0, 1);
    const releaseStart = Math.max(start + attack, end - release);

    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(targetGain, start + attack);
    gainNode.gain.setValueAtTime(targetGain, releaseStart);
    gainNode.gain.linearRampToValueAtTime(0.0001, end);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(start);
    oscillator.stop(end + 0.05);

    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };

    cursor = end;
    finalTime = Math.max(finalTime, end);
  }

  const totalDuration = Math.max(0, finalTime - startTime + 0.15);
  await new Promise<void>((resolve) => {
    const timeout = Math.max(0, totalDuration * 1000);
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      window.setTimeout(resolve, timeout);
    } else {
      setTimeout(resolve, timeout);
    }
  });
  return true;
};

export const playSuccess = async (): Promise<boolean> => {
  return playSequence(
    [
      { frequency: 523.25, duration: 0.22, type: 'triangle', gain: 0.85 },
      { frequency: 659.25, duration: 0.18, type: 'triangle', gain: 0.8, delay: 0.04 },
      { frequency: 783.99, duration: 0.24, type: 'sine', gain: 0.75, delay: 0.06 },
    ],
    { baseGain: 0.55 },
  );
};

export const playEncouragement = async (): Promise<boolean> => {
  return playSequence(
    [
      { frequency: 392.0, duration: 0.25, type: 'sine', gain: 0.7 },
      { frequency: 349.23, duration: 0.22, type: 'sine', gain: 0.65, delay: 0.02 },
      { frequency: 440.0, duration: 0.32, type: 'triangle', gain: 0.7, delay: 0.08 },
    ],
    { baseGain: 0.5 },
  );
};

export const playLowStim = async (): Promise<boolean> => {
  return playSequence(
    [
      { frequency: 329.63, duration: 0.48, type: 'sine', gain: 0.5, attack: 0.05, release: 0.24 },
      { frequency: 261.63, duration: 0.6, type: 'sine', gain: 0.45, delay: 0.18, attack: 0.06, release: 0.28 },
    ],
    { baseGain: 0.35 },
  );
};
