import { formatCents } from '../money'

// Shows "$1,234.56" with the cents set smaller and raised, like a price tag.
// Screen readers get the plain amount.
export function Amount({ cents, className = '' }: { cents: number; className?: string }) {
  const text = formatCents(cents)
  const dot = text.lastIndexOf('.')
  return (
    <span className={`amount ${className}`}>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, dot)}
        <span className="amount__cents">{text.slice(dot)}</span>
      </span>
    </span>
  )
}
