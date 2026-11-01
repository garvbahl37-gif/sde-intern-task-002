import { describe, expect, it } from 'vitest'
import { formatCents, parseDollarsToCents } from './money'

describe('parseDollarsToCents', () => {
  it.each([
    ['12.34', 1234],
    ['0.1', 10],
    ['0.07', 7],
    ['5', 500],
    ['5.', null],
    ['  42.50 ', 4250],
    ['1,234.56', 123456],
    ['0.29', 29],
    ['1.005', null],
  ])('reads %j as %j cents', (input, cents) => {
    expect(parseDollarsToCents(input)).toBe(cents)
  })

  it.each(['', '0', '0.00', '-1', '1.234', 'abc', '1e3', '.5', '12.3.4', '1234567890'])(
    'refuses %j',
    (input) => {
      expect(parseDollarsToCents(input)).toBeNull()
    },
  )
})

describe('formatCents', () => {
  it('shows cents as dollars with a currency sign and separators', () => {
    expect(formatCents(123456)).toBe('$1,234.56')
    expect(formatCents(5)).toBe('$0.05')
    expect(formatCents(0)).toBe('$0.00')
  })
})
