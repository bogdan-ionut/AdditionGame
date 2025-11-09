import { useCallback, useEffect, useMemo, useState } from 'react'
import { sprites, status, type SpritesBody, type SpritesResponse } from '../api'
import { b64ToBlob } from '../lib/base64'
import { Card } from './Card'

interface SpriteResult {
  mime: string
  bytesBase64: string
}

function getDownloadExtension(mime: string): string {
  if (!mime.includes('/')) {
    return 'bin'
  }

  const [, subtype] = mime.split('/')
  if (!subtype) {
    return 'bin'
  }

  if (subtype.includes('png')) {
    return 'png'
  }
  if (subtype.includes('jpeg') || subtype.includes('jpg')) {
    return 'jpg'
  }
  if (subtype.includes('gif')) {
    return 'gif'
  }

  return subtype
}

export function SpriteGenerator() {
  const [prompt, setPrompt] = useState<string>('')
  const [model, setModel] = useState<string>('')
  const [prefillError, setPrefillError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SpriteResult | null>(null)

  useEffect(() => {
    let isMounted = true
    void (async () => {
      try {
        const response = await status()
        if (isMounted && response.sprite_model) {
          setModel((previous) => (previous.trim().length > 0 ? previous : response.sprite_model ?? previous))
        }
      } catch (statusError) {
        if (isMounted) {
          const message = statusError instanceof Error ? statusError.message : 'Unable to load sprite model.'
          setPrefillError(message)
        }
      }
    })()

    return () => {
      isMounted = false
    }
  }, [])

  const hasImage = useMemo(() => Boolean(result), [result])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setError(null)

      const trimmedPrompt = prompt.trim()
      if (trimmedPrompt.length === 0) {
        setError('Please provide a prompt to generate sprites.')
        return
      }

      const payload: SpritesBody = { prompt: trimmedPrompt }
      const trimmedModel = model.trim()
      if (trimmedModel.length > 0) {
        payload.model = trimmedModel
      }

      setLoading(true)

      try {
        const response: SpritesResponse = await sprites(payload)
        if (!response.ok) {
          throw new Error('Sprite generation failed.')
        }

        const [firstImage] = Array.isArray(response.images) ? response.images : []
        if (!firstImage) {
          throw new Error('The sprite service returned no images.')
        }

        setResult({ mime: firstImage.mime, bytesBase64: firstImage.bytes_base64 })
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Failed to generate sprites.'
        setError(message)
        setResult(null)
      } finally {
        setLoading(false)
      }
    },
    [model, prompt]
  )

  const handleDownload = useCallback(() => {
    if (!result) {
      return
    }

    try {
      const blob = b64ToBlob(result.bytesBase64, result.mime)
      const extension = getDownloadExtension(result.mime)
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.href = url
      link.download = `sprite.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : 'Unable to download image.'
      setError(message)
    }
  }, [result])

  return (
    <Card
      title="Sprite Generator"
      description="Turn text prompts into sprites. Prefill the model from runtime status or override manually."
      className="h-full"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="sprite-prompt" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Prompt
          </label>
          <input
            id="sprite-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            type="text"
            placeholder="A cheerful robot tutor with a chalkboard"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="sprite-model" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Model
          </label>
          <input
            id="sprite-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            type="text"
            placeholder="sprite-gen-v1"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
          />
          {prefillError && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{prefillError}</p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200/70 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-700 dark:focus:ring-offset-slate-900"
          >
            {loading && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" aria-hidden="true" />
            )}
            {loading ? 'Generating…' : 'Generate sprite'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!hasImage}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Download {result?.mime === 'image/png' ? 'PNG' : 'image'}
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Preview</h3>
          <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            {hasImage && result ? (
              <img
                src={`data:${result.mime};base64,${result.bytesBase64}`}
                alt="Generated sprite"
                className="max-h-64 w-auto max-w-full rounded-lg shadow"
              />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-300">No sprite generated yet.</p>
            )}
          </div>
        </div>
      </form>
    </Card>
  )
}
