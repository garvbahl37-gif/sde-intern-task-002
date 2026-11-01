// Splits a whole number of cents between `count` people.
//
// Everyone gets the same base amount. The cents left over (always fewer than `count`) go out
// one each, starting with the first person. So the result always adds up to the total, and no
// two shares differ by more than 1 cent.
//
//   splitCents(1000, 3) -> [334, 333, 333]
//   splitCents(2, 3)    -> [1, 1, 0]
export function splitCents(totalCents: number, count: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new RangeError('totalCents must be a non-negative whole number')
  }
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError('count must be a whole number of at least 1')
  }

  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count
  return Array.from({ length: count }, (_, index) => (index < remainder ? base + 1 : base))
}
