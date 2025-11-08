export function installTtsShim() {
  if (typeof window !== 'undefined') {
    const noop = async () => ({ ok: false, mode: 'none' as const })
    ;(window as any).__tts ??= { speakProblem: noop, speakHint: noop, speakPraise: noop }
    ;(window as any).speakProblem ??= (window as any).__tts.speakProblem
    ;(window as any).speakHint ??= (window as any).__tts.speakHint
    ;(window as any).speakPraise ??= (window as any).__tts.speakPraise
  }
}
