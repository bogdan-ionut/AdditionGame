import { useCallback, useMemo, useState } from 'react'
import { plan, type GradeLevel, type PlanBody, type PlanResponse } from '../api'
import { Card } from './Card'

const gradeOptions: readonly GradeLevel[] = [
  'preschool',
  'grade1',
  'grade2',
  'grade3',
  'grade4',
  'grade5',
  'grade6',
]

function gradeLabel(grade: GradeLevel): string {
  if (grade === 'preschool') {
    return 'Preschool'
  }

  const suffix = grade.replace('grade', '')
  return `Grade ${suffix}`
}

interface FormState {
  userId: string
  grade: '' | GradeLevel
  interests: string
  mastery: string
  target: string
  text: string
}

function parseObjectJson(value: string, label: string): Record<string, unknown> | undefined {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return undefined
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object.`)
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    const message = error instanceof Error ? error.message : `Invalid ${label.toLowerCase()} JSON.`
    throw new Error(message)
  }
}

function formatPlan(planData: Record<string, unknown>): string {
  return JSON.stringify(planData, null, 2)
}

export function LearningPlan() {
  const [form, setForm] = useState<FormState>({
    userId: '',
    grade: '',
    interests: '',
    mastery: '',
    target: '',
    text: '',
  })
  const [result, setResult] = useState<PlanResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setForm((previous) => {
      if (name === 'grade') {
        return {
          ...previous,
          grade: (value as GradeLevel | '') ?? '',
        }
      }

      const key = name as Exclude<keyof FormState, 'grade'>
      return {
        ...previous,
        [key]: value,
      }
    })
  }, [])

  const planJson = useMemo(() => {
    if (result && result.ok) {
      return formatPlan(result.plan)
    }
    return null
  }, [result])

  const handleCopy = useCallback(async () => {
    if (!planJson || planJson.trim().length === 0) {
      setCopyMessage('Nothing to copy yet.')
      return
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setCopyMessage('Clipboard access is not available in this environment.')
      return
    }

    try {
      await navigator.clipboard.writeText(planJson)
      setCopyMessage('Plan JSON copied to clipboard!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy to clipboard.'
      setCopyMessage(message)
    }

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setCopyMessage(null)
      }, 2000)
    }
  }, [planJson])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setError(null)
      setResult(null)
      setCopyMessage(null)

      const payload: PlanBody = {}
      const trimmedUserId = form.userId.trim()
      if (trimmedUserId.length > 0) {
        payload.userId = trimmedUserId
      }

      const freeformText = form.text.trim()
      if (freeformText.length > 0) {
        payload.text = freeformText
      } else {
        const trimmedGrade = form.grade
        if (trimmedGrade) {
          payload.grade = trimmedGrade
        }

        const interestItems = form.interests
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
        if (interestItems.length > 0) {
          payload.interests = interestItems
        }

        try {
          const masteryObject = parseObjectJson(form.mastery, 'Mastery')
          if (masteryObject) {
            payload.mastery = masteryObject
          }

          const targetObject = parseObjectJson(form.target, 'Target')
          if (targetObject) {
            payload.target = targetObject
          }
        } catch (jsonError) {
          const message = jsonError instanceof Error ? jsonError.message : 'Invalid JSON provided.'
          setError(message)
          return
        }
      }

      if (!payload.text && !payload.grade && !payload.interests && !payload.mastery && !payload.target) {
        setError('Provide a freeform prompt or structured data to request a plan.')
        return
      }

      setLoading(true)

      try {
        const response = await plan(payload)
        setResult(response)
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Failed to generate plan.'
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [form]
  )

  return (
    <Card
      title="Learning Plan"
      description="Create or refine a student learning plan using structured inputs or a freeform brief."
      className="h-full"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="plan-userId" className="text-sm font-medium text-slate-600 dark:text-slate-300">
              User ID
            </label>
            <input
              id="plan-userId"
              name="userId"
              value={form.userId}
              onChange={handleInputChange}
              type="text"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="plan-grade" className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Grade
            </label>
            <select
              id="plan-grade"
              name="grade"
              value={form.grade}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Select grade</option>
              {gradeOptions.map((option) => (
                <option key={option} value={option}>
                  {gradeLabel(option)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="plan-interests" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Interests
          </label>
          <input
            id="plan-interests"
            name="interests"
            value={form.interests}
            onChange={handleInputChange}
            placeholder="science, art, puzzles"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
            type="text"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">Comma-separated values</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="plan-mastery" className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Mastery JSON
            </label>
            <textarea
              id="plan-mastery"
              name="mastery"
              value={form.mastery}
              onChange={handleInputChange}
              rows={4}
              placeholder='{ "math": "intermediate" }'
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="plan-target" className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Target JSON
            </label>
            <textarea
              id="plan-target"
              name="target"
              value={form.target}
              onChange={handleInputChange}
              rows={4}
              placeholder='{ "math": "advanced" }'
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="plan-text" className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Freeform prompt
          </label>
          <textarea
            id="plan-text"
            name="text"
            value={form.text}
            onChange={handleInputChange}
            rows={4}
            placeholder="Design a reading-focused plan for a curious grade 3 student."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            If provided, structured fields (except user ID) will be ignored.
          </p>
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
            {loading ? 'Requesting plan…' : 'Generate plan'}
          </button>
          {planJson && (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Copy JSON
            </button>
          )}
          {copyMessage && <span className="text-sm font-medium text-slate-500 dark:text-slate-300">{copyMessage}</span>}
        </div>

        {result && !result.ok && result.fallback_local && (
          <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            {result.message ?? 'Remote planner unavailable. Displaying local fallback.'}
          </div>
        )}

        {planJson && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Plan preview</h3>
            <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
              <code>{planJson}</code>
            </pre>
          </div>
        )}
      </form>
    </Card>
  )
}
