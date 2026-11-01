import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { payShare } from '../src/data/bills'
import { createBill, createHome } from './helpers'

// In the test runtime, two requests sent with Promise.all rarely interleave between two queries.
// To prove payShare is safe when they DO interleave, every query here waits a few milliseconds
// first. That gives the other request a chance to run its query in between, which is exactly
// what happens under real load. A "read, then write" version of payShare fails these tests.

const pause = () => new Promise((resolve) => setTimeout(resolve, 5))

function slowStatement(statement: D1PreparedStatement): D1PreparedStatement {
  return new Proxy(statement, {
    get(target, property) {
      if (property === 'bind') {
        return (...values: unknown[]) => slowStatement(target.bind(...values))
      }
      if (property === 'first') {
        return async () => {
          await pause()
          return target.first()
        }
      }
      if (property === 'run') {
        return async () => {
          await pause()
          return target.run()
        }
      }
      return Reflect.get(target, property, target)
    },
  })
}

function slowDatabase(db: D1Database): D1Database {
  return new Proxy(db, {
    get(target, property) {
      if (property === 'prepare') return (sql: string) => slowStatement(target.prepare(sql))
      return Reflect.get(target, property, target)
    },
  })
}

async function unpaidShare() {
  const { homeId } = await createHome(['Asha', 'Ben'])
  const bill = await createBill(homeId, 1000)
  const share = bill.body.shares[0]
  if (!share) throw new Error('bill has no shares')
  return { billId: bill.body.id, shareId: share.id }
}

describe('payShare when requests interleave', () => {
  it('lets exactly one of several different payments through', async () => {
    const { billId, shareId } = await unpaidShare()
    const db = slowDatabase(env.DB)
    const paidAt = new Date().toISOString()

    const results = await Promise.all(
      ['k1', 'k2', 'k3', 'k4'].map((key) => payShare(db, billId, shareId, key, paidAt)),
    )

    expect(results.map((result) => result.kind).sort()).toEqual([
      'conflict',
      'conflict',
      'conflict',
      'paid',
    ])
  })

  it('gives every copy of the same payment the one stored result', async () => {
    const { billId, shareId } = await unpaidShare()
    const db = slowDatabase(env.DB)

    const results = await Promise.all(
      [1, 2, 3, 4].map((n) =>
        payShare(db, billId, shareId, 'same-key', `2026-01-0${n}T00:00:00.000Z`),
      ),
    )
    const paidAts = results.map((result) => (result.kind === 'paid' ? result.share.paidAt : null))

    expect(results.every((result) => result.kind === 'paid')).toBe(true)
    expect(new Set(paidAts).size).toBe(1)
  })
})
