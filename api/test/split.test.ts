import { describe, expect, it } from 'vitest'
import { splitCents } from '../src/split'

describe('splitCents', () => {
  it('splits an even amount equally', () => {
    expect(splitCents(3000, 3)).toEqual([1000, 1000, 1000])
  })

  it('gives the extra cents to the first people, one each', () => {
    expect(splitCents(1000, 3)).toEqual([334, 333, 333])
    expect(splitCents(1001, 3)).toEqual([334, 334, 333])
  })

  it('gives zero to the last people when there are fewer cents than people', () => {
    expect(splitCents(2, 3)).toEqual([1, 1, 0])
  })

  it('gives everything to a single person', () => {
    expect(splitCents(4999, 1)).toEqual([4999])
  })

  it('handles the largest safe whole number exactly', () => {
    const shares = splitCents(Number.MAX_SAFE_INTEGER, 7)

    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('always adds up to the total, with shares at most 1 cent apart, largest first', () => {
    for (let total = 1; total <= 200; total++) {
      for (let count = 1; count <= 9; count++) {
        const shares = splitCents(total, count)
        const largest = Math.max(...shares)
        const smallest = Math.min(...shares)

        expect(shares).toHaveLength(count)
        expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total)
        expect(largest - smallest).toBeLessThanOrEqual(1)
        expect([...shares].sort((a, b) => b - a)).toEqual(shares)
      }
    }
  })

  it.each([
    [100, 0],
    [100, 1.5],
    [-1, 2],
    [10.5, 2],
  ])('refuses to split %s cents between %s people', (total, count) => {
    expect(() => splitCents(total, count)).toThrow(RangeError)
  })
})
