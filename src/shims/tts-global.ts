import { speakHint, speakPraise, speakProblem } from '../lib/tts'

export function installTtsShim() {
  if (typeof window !== 'undefined') {
    ;(window as any).__tts ??= { speakProblem, speakHint, speakPraise }
    ;(window as any).__tts.speakProblem = speakProblem
    ;(window as any).__tts.speakHint = speakHint
    ;(window as any).__tts.speakPraise = speakPraise
    ;(window as any).speakProblem ??= (window as any).__tts.speakProblem
    ;(window as any).speakHint ??= (window as any).__tts.speakHint
    ;(window as any).speakPraise ??= (window as any).__tts.speakPraise
  }
}
