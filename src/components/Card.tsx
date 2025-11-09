import type { PropsWithChildren, ReactNode } from 'react'

interface CardProps {
  title?: ReactNode
  description?: ReactNode
  className?: string
}

const baseClasses =
  'w-full rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-lg backdrop-blur-md transition-shadow hover:shadow-xl dark:border-slate-700/60 dark:bg-slate-900/80'

export function Card({ title, description, className, children }: PropsWithChildren<CardProps>) {
  return (
    <section className={[baseClasses, className].filter(Boolean).join(' ')}>
      {(title || description) && (
        <header className="mb-6 space-y-2">
          {title && <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>}
          {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </header>
      )}
      <div className="space-y-4 text-slate-900 dark:text-slate-100">{children}</div>
    </section>
  )
}
