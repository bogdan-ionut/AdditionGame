import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listVoices, ttsSay, type TtsSayBody, type Voice } from '../api'
import { b64ToBlob } from '../lib/base64'
import { Card } from './Card'

interface AudioState {
  url: string | null
  blob: Blob | null
  contentType: string | null
}

const storageKey = 'tts.playground.selectedVoiceId'

const defaultText = 'Bună! Sunt gata să te ajut la matematică.'

function getStoredVoiceId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(storageKey)
  } catch (error) {
    console.warn('Unable to access localStorage for voice preference.', error)
    return null
  }
}

function persistVoiceId(voiceId: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (voiceId) {
      window.localStorage.setItem(storageKey, voiceId)
    } else {
      window.localStorage.removeItem(storageKey)
    }
  } catch (error) {
    console.warn('Unable to persist voice preference.', error)
  }
}

function formatVoiceLabel(voice: Voice): string {
  const metadata: string[] = []

  if (voice.lang) {
    metadata.push(voice.lang)
  }

  if (voice.gender) {
    metadata.push(voice.gender)
  }

  if (metadata.length > 0) {
    return `${voice.name} · ${metadata.join(' · ')}`
  }

  return voice.name
}

function getDownloadName(contentType: string | null): string {
  const baseName = 'tts-audio'

  if (!contentType) {
    return `${baseName}.bin`
  }

  if (contentType.includes('mpeg')) {
    return `${baseName}.mp3`
  }

  if (contentType.includes('wav') || contentType.includes('wave')) {
    return `${baseName}.wav`
  }

  if (contentType.includes('ogg')) {
    return `${baseName}.ogg`
  }

  const [, subtype] = contentType.split('/')
  return subtype ? `${baseName}.${subtype}` : `${baseName}.audio`
}

export function TTSPlayground() {
  const [voices, setVoices] = useState<Voice[]>([])
  const [voicesLoading, setVoicesLoading] = useState<boolean>(true)
  const [voicesError, setVoicesError] = useState<string | null>(null)

  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(() => getStoredVoiceId())
  const [text, setText] = useState<string>(defaultText)
  const [speakingRate, setSpeakingRate] = useState<number>(1)
  const [pitch, setPitch] = useState<number>(0)

  const [requestLoading, setRequestLoading] = useState<boolean>(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [{ url, blob, contentType }, setAudioState] = useState<AudioState>({
    url: null,
    blob: null,
    contentType: null,
  })

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const fetchVoices = useCallback(async () => {
    setVoicesLoading(true)
    setVoicesError(null)

    try {
      const response = await listVoices()
      const fetchedVoices = Array.isArray(response.voices) ? response.voices : []
      setVoices(fetchedVoices)

      const storedVoiceId = getStoredVoiceId()
      const nextVoiceId = storedVoiceId && fetchedVoices.some((voice) => voice.id === storedVoiceId)
        ? storedVoiceId
        : fetchedVoices.length > 0
          ? fetchedVoices[0].id
          : null

      setSelectedVoiceId(nextVoiceId)
      persistVoiceId(nextVoiceId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load voices.'
      setVoicesError(message)
      setVoices([])
      setSelectedVoiceId(null)
      persistVoiceId(null)
    } finally {
      setVoicesLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchVoices()
  }, [fetchVoices])

  useEffect(() => {
    persistVoiceId(selectedVoiceId)
  }, [selectedVoiceId])

  useEffect(() => {
    return () => {
      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  }, [url])

  const handleVoiceChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setSelectedVoiceId(value.length > 0 ? value : null)
  }, [])

  const handleSpeak = useCallback(async () => {
    if (text.trim().length === 0) {
      setRequestError('Please provide text to synthesize.')
      return
    }

    setRequestLoading(true)
    setRequestError(null)
    setLatencyMs(null)

    const payload: TtsSayBody = {
      text: text.trim(),
      speaking_rate: Number.isFinite(speakingRate) ? speakingRate : undefined,
      pitch: Number.isFinite(pitch) ? pitch : undefined,
    }

    if (selectedVoiceId) {
      payload.voice_id = selectedVoiceId
    }

    const startedAt = Date.now()

    try {
      const response = await ttsSay(payload)
      const elapsed = Date.now() - startedAt
      setLatencyMs(elapsed)

      const audioBlob = b64ToBlob(response.audio_b64, response.content_type)
      const objectUrl = URL.createObjectURL(audioBlob)

      setAudioState((previous) => {
        if (previous.url) {
          URL.revokeObjectURL(previous.url)
        }

        return {
          url: objectUrl,
          blob: audioBlob,
          contentType: response.content_type,
        }
      })

      const schedulePlayback = () => {
        if (audioRef.current) {
          audioRef.current.load()
          void audioRef.current.play().catch(() => {
            /* Ignore autoplay errors */
          })
        }
      }

      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(schedulePlayback)
      } else {
        schedulePlayback()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to synthesize speech.'
      setRequestError(message)
      setAudioState((previous) => {
        if (previous.url) {
          URL.revokeObjectURL(previous.url)
        }
        return { url: null, blob: null, contentType: null }
      })
    } finally {
      setRequestLoading(false)
    }
  }, [pitch, selectedVoiceId, speakingRate, text])

  const handleDownload = useCallback(() => {
    if (!blob) {
      return
    }

    const fileName = getDownloadName(contentType)
    const link = document.createElement('a')
    const downloadUrl = url ?? URL.createObjectURL(blob)

    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    if (!url) {
      URL.revokeObjectURL(downloadUrl)
    }
  }, [blob, contentType, url])

  const hasAudio = useMemo(() => Boolean(blob && url), [blob, url])

  const disabledSpeak = requestLoading || voicesLoading || text.trim().length === 0

  return (
    <Card
      title="TTS Playground"
      description="Experiment with text-to-speech voices, tune the delivery, and preview or download the generated audio."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="voice-select" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Voice
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              id="voice-select"
              name="voice"
              value={selectedVoiceId ?? ''}
              onChange={handleVoiceChange}
              disabled={voicesLoading || !!voicesError || voices.length === 0}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
            >
              {voicesLoading && <option>Loading voices…</option>}
              {!voicesLoading && voices.length === 0 && <option>No voices available</option>}
              {!voicesLoading &&
                voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {formatVoiceLabel(voice)}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!voicesLoading) {
                  void fetchVoices()
                }
              }}
              disabled={voicesLoading}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {voicesLoading ? 'Refreshing…' : 'Refresh voices'}
            </button>
          </div>
          {voicesError && (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{voicesError}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="tts-text" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Text
          </label>
          <textarea
            id="tts-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>Speaking rate</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{speakingRate.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={1.4}
              step={0.05}
              value={speakingRate}
              onChange={(event) => setSpeakingRate(Number.parseFloat(event.target.value))}
              className="w-full accent-slate-700"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>Pitch</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{pitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={-5}
              max={5}
              step={0.5}
              value={pitch}
              onChange={(event) => setPitch(Number.parseFloat(event.target.value))}
              className="w-full accent-slate-700"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSpeak()}
            disabled={disabledSpeak}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-700 dark:focus:ring-offset-slate-900"
          >
            {requestLoading && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" aria-hidden="true" />
            )}
            {requestLoading ? 'Synthesizing…' : 'Speak'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!hasAudio}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Download
          </button>
          {latencyMs != null && (
            <span className="text-sm font-medium text-slate-500 dark:text-slate-300">Latency: {latencyMs} ms</span>
          )}
        </div>

        {requestError && (
          <div className="rounded-lg border border-rose-200/60 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
            {requestError}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Preview</h3>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
            {hasAudio ? (
              <audio ref={audioRef} controls src={url ?? undefined} className="w-full" />
            ) : (
              <p>No audio generated yet. Enter text and click “Speak” to hear the result.</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
