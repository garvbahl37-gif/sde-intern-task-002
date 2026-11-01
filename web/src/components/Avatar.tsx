// A circle with someone's initials. The colour comes from their id, so each person keeps the same
// colour everywhere on the page.
const TONES = 6

export function Avatar({ id, name }: { id: string; name: string }) {
  return (
    <span className="avatar" data-tone={toneFor(id)} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

function toneFor(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % TONES
}

function initials(name: string) {
  const words = name.trim().split(/\s+/)
  const first = words[0]?.[0] ?? '?'
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
