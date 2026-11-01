// Money is always a whole number of cents. These helpers are the only place the app turns cents
// into text or text into cents.

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatCents(cents: number): string {
  // Dividing here is only for display. No amount is ever stored or added up as dollars.
  return dollars.format(cents / 100)
}

// Whole dollars, written plainly ("1234") or with comma groups ("1,234"), then up to 2 decimals.
const AMOUNT = /^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/
const MAX_DOLLAR_DIGITS = 9

// Turns what a person typed ("12.5") into cents (1250) without floating-point math:
// the dollars and cents parts are read as separate whole numbers.
// Returns null for anything that is not a positive amount with at most 2 decimals.
export function parseDollarsToCents(input: string): number | null {
  const match = AMOUNT.exec(input.trim())
  if (!match?.[1]) return null

  const wholeDollars = match[1].replaceAll(',', '')
  if (wholeDollars.length > MAX_DOLLAR_DIGITS) return null

  const fraction = (match[2] ?? '').padEnd(2, '0')
  const cents = Number(wholeDollars) * 100 + Number(fraction)
  return cents > 0 ? cents : null
}
