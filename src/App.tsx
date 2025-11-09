import { useCallback, useEffect, useMemo, useState } from 'react'
import { status, type StatusResponse } from './api'
import { Card } from './components/Card'
import { LearningPlan } from './components/LearningPlan'

export default function App() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await status()
      setData(response)
      setLastUpdated(new Date())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  const statusCaption = useMemo(() => {
    if (lastUpdated) {
      return `Last updated ${lastUpdated.toLocaleTimeString()}`
    }

    if (loading) {
      return 'Loading status…'
    }

    if (error) {
      return 'Unable to load status yet'
    }

    return 'Status not loaded yet'
  }, [error, lastUpdated, loading])

  const keyBadge = useMemo(() => {
    if (!data) {
      return <span className="text-base text-slate-400">—</span>
    }

    const isServerKey = data.key_on_server
    const badgeClasses = isServerKey
      ? 'bg-emerald-100 text-emerald-700 ring-emerald-200/70'
      : 'bg-amber-100 text-amber-700 ring-amber-200/70'

    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${badgeClasses}`}
      >
        <span className={`h-2 w-2 rounded-full ${isServerKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {isServerKey ? 'Stored on server' : 'Client key required'}
      </span>
    )
  }, [data])

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <main className="flex flex-1 justify-center px-4 py-16">
        <div className="w-full max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2">
            <Card
              title="Runtime & Models"
              description="Live telemetry from the runtime status endpoint. Refresh any time to verify connectivity and model availability."
              className="h-full"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500 dark:text-slate-400">{statusCaption}</p>
                <button
                  type="button"
                  onClick={() => void fetchStatus()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-700 dark:text-slate-50 dark:focus:ring-offset-slate-900"
                >
                  {loading && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" aria-hidden="true" />
                  )}
                  {loading ? 'Refreshing…' : 'Refresh status'}
                </button>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
                  {error}
                </div>
              )}

              {loading && !data ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-3">
                      <div className="h-3 w-20 animate-pulse rounded bg-slate-200/70" />
                      <div className="h-6 w-32 animate-pulse rounded bg-slate-300/70" />
                    </div>
                  ))}
                </div>
              ) : (
                <dl className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Service</dt>
                    <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">{data?.service ?? '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Key on server</dt>
                    <dd>{keyBadge}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Planning model</dt>
                    <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {data?.planning_model ?? '—'}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Sprite model</dt>
                    <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {data?.sprite_model ?? '—'}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">TTS model</dt>
                    <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">{data?.tts_model ?? '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Client keys accepted</dt>
                    <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {data?.accepts_client_key != null ? (data.accepts_client_key ? 'Yes' : 'No') : '—'}
                    </dd>
                  </div>
                </dl>
              )}
            </Card>

            <LearningPlan />
          </div>
        </div>
      </main>
    </div>
  )
}
