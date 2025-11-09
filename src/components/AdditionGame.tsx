import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

interface Problem {
  a: number
  b: number
}

interface GameStats {
  attempts: number
  correct: number
  streak: number
  longestStreak: number
  startedAt: number | null
  durations: number[]
}

const difficultyBands = [
  { id: 'within-5', label: 'Within 5', max: 5 },
  { id: 'within-10', label: 'Within 10', max: 10 },
  { id: 'within-20', label: 'Within 20', max: 20 },
]

function createDefaultStats(): GameStats {
  return {
    attempts: 0,
    correct: 0,
    streak: 0,
    longestStreak: 0,
    startedAt: null,
    durations: [],
  }
}

function createProblem(max: number): Problem {
  const a = Math.floor(Math.random() * (max + 1))
  const b = Math.floor(Math.random() * (max + 1 - a))
  return { a, b }
}

interface AdditionGameProps {
  onExit: () => void
}

export function AdditionGame({ onExit }: AdditionGameProps) {
  const [difficulty, setDifficulty] = useState(difficultyBands[1])
  const [problem, setProblem] = useState<Problem>(() => createProblem(difficultyBands[1].max))
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [stats, setStats] = useState<GameStats>(() => createDefaultStats())
  const [problemStartedAt, setProblemStartedAt] = useState<number | null>(null)

  const accuracy = useMemo(() => {
    if (stats.attempts === 0) return 0
    return Math.round((stats.correct / stats.attempts) * 100)
  }, [stats.attempts, stats.correct])

  const averageDuration = useMemo(() => {
    if (stats.durations.length === 0) return 0
    const total = stats.durations.reduce((sum, duration) => sum + duration, 0)
    return Math.round(total / stats.durations.length)
  }, [stats.durations])

  const startProblem = useCallback(
    (nextDifficulty = difficulty) => {
      setProblem(createProblem(nextDifficulty.max))
      setProblemStartedAt(Date.now())
      setAnswer('')
      setFeedback(null)
    },
    [difficulty],
  )

  useEffect(() => {
    if (problemStartedAt === null) {
      setProblemStartedAt(Date.now())
    }
  }, [problemStartedAt])

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const numericAnswer = Number.parseInt(answer, 10)
      if (Number.isNaN(numericAnswer)) {
        setFeedback('Please enter a number to submit your answer.')
        return
      }

      const expected = problem.a + problem.b
      const endTime = Date.now()
      const duration = problemStartedAt ? Math.max(0, Math.round((endTime - problemStartedAt) / 1000)) : 0

      setStats((current) => {
        const isCorrect = numericAnswer === expected
        const nextAttempts = current.attempts + 1
        const nextCorrect = isCorrect ? current.correct + 1 : current.correct
        const nextStreak = isCorrect ? current.streak + 1 : 0
        const nextLongest = Math.max(nextStreak, current.longestStreak)

        return {
          attempts: nextAttempts,
          correct: nextCorrect,
          streak: nextStreak,
          longestStreak: nextLongest,
          startedAt: current.startedAt ?? Date.now(),
          durations: duration > 0 ? [...current.durations, duration] : current.durations,
        }
      })

      if (numericAnswer === expected) {
        setFeedback('Nice work! 🎉')
      } else {
        setFeedback(`Almost! ${problem.a} + ${problem.b} = ${expected}. Try the next one.`)
      }

      startProblem()
    },
    [answer, problem.a, problem.b, problemStartedAt, startProblem],
  )

  const handleDifficultyChange = useCallback(
    (bandId: string) => {
      const nextDifficulty = difficultyBands.find((band) => band.id === bandId)
      if (!nextDifficulty) return
      setDifficulty(nextDifficulty)
      startProblem(nextDifficulty)
    },
    [startProblem],
  )

  const handleRestart = useCallback(() => {
    setStats(createDefaultStats())
    startProblem()
  }, [startProblem])

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Addition Adventure</h1>
          <p className="text-sm text-slate-400">Practice quick math facts with adaptive feedback.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRestart}
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Restart session
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-400"
          >
            Back to dashboard
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-6 py-10 lg:flex-row">
        <section className="flex-1 space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Solve the problem</h2>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-4 py-1 text-xs font-medium text-slate-300">
                {difficulty.label}
              </div>
            </div>

            <div className="flex flex-col items-center gap-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-950 px-10 py-8 text-center shadow-inner">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">What is</p>
                <p className="text-6xl font-semibold text-white">
                  {problem.a} + {problem.b}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <input
                  type="number"
                  inputMode="numeric"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  className="h-12 w-full max-w-[160px] rounded-full border border-slate-700 bg-slate-900 px-6 text-center text-lg font-semibold text-white shadow focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                  placeholder="Your answer"
                  aria-label="Your answer"
                />
                <button
                  type="submit"
                  className="inline-flex h-12 items-center rounded-full bg-emerald-500 px-8 text-base font-semibold text-emerald-950 shadow transition hover:bg-emerald-400"
                >
                  Check answer
                </button>
              </form>

              {feedback && (
                <p className="text-center text-sm font-medium text-slate-200">{feedback}</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Choose challenge</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {difficultyBands.map((band) => (
                <button
                  key={band.id}
                  type="button"
                  onClick={() => handleDifficultyChange(band.id)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    band.id === difficulty.id
                      ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {band.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="flex w-full flex-col gap-6 lg:w-80">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Session stats</h3>
            <dl className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-400">Problems solved</dt>
                <dd className="text-xl font-semibold text-white">{stats.attempts}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-400">Correct answers</dt>
                <dd className="text-xl font-semibold text-emerald-300">{stats.correct}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-400">Accuracy</dt>
                <dd className="text-xl font-semibold text-white">{accuracy}%</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-400">Current streak</dt>
                <dd className="text-xl font-semibold text-white">{stats.streak}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-400">Best streak</dt>
                <dd className="text-xl font-semibold text-white">{stats.longestStreak}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-400">Average time</dt>
                <dd className="text-xl font-semibold text-white">{averageDuration}s</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Quick tips</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>Try counting on from the larger number for faster answers.</li>
              <li>Use your fingers or nearby objects if you need a visual helper.</li>
              <li>Beat your best streak by answering in under {averageDuration || 5} seconds!</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  )
}
