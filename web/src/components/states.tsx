import { type ReactNode, useEffect, useState } from 'react'

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

// True once `ms` have passed. Used to tell people a slow server is still being waited on.
function useTakingLong(ms: number) {
  const [takingLong, setTakingLong] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setTakingLong(true), ms)
    return () => clearTimeout(timer)
  }, [ms])
  return takingLong
}

// Placeholder blocks shaped like the content that is on its way.
export function LoadingState({ label, rows = 3 }: { label: string; rows?: number }) {
  const takingLong = useTakingLong(4000)
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
        <div key={index} className="skeleton" aria-hidden="true" />
      ))}
      {takingLong && <p className="loading__slow">The server is slow to answer. Still trying.</p>}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      <p className="empty__body">{children}</p>
    </div>
  )
}

export function ErrorState({
  title,
  error,
  onRetry,
}: {
  title: string
  error: unknown
  onRetry?: () => void
}) {
  return (
    <div className="problem" role="alert">
      <p className="problem__title">{title}</p>
      <p className="problem__body">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="button button--quiet" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
