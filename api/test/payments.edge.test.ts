import { describe, expect, it } from 'vitest'
import { type Balance, call, createBill, createHome, type Share } from './helpers'

type ErrorBody = { error: string }

function pay(billId: string, shareId: string, headers: Record<string, string>) {
  return call<Share & ErrorBody>('POST', `/api/bills/${billId}/shares/${shareId}/pay`, { headers })
}

function balances(homeId: string) {
  return call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
}

async function setup() {
  const { homeId, members } = await createHome(['Asha', 'Ben'])
  const bill = await createBill(homeId, 1000)
  const share = bill.body.shares[0]
  if (!share) throw new Error('bill has no shares')
  return { homeId, members, billId: bill.body.id, share }
}

describe('two people paying the same share at the same time', () => {
  it('lets exactly one payment succeed and rejects the others with 409', async () => {
    const { homeId, billId, share } = await setup()

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        pay(billId, share.id, { 'Idempotency-Key': crypto.randomUUID() }),
      ),
    )
    const outstanding = await balances(homeId)

    expect(results.map((result) => result.status).sort()).toEqual([200, 409, 409, 409, 409])
    expect(outstanding.body.balances.map((balance) => balance.outstandingCents)).toEqual([0, 500])
  })

  it('answers every copy of the same request with the same successful result', async () => {
    const { billId, share } = await setup()
    const key = crypto.randomUUID()

    const results = await Promise.all(
      Array.from({ length: 5 }, () => pay(billId, share.id, { 'Idempotency-Key': key })),
    )

    expect(results.map((result) => result.status)).toEqual([200, 200, 200, 200, 200])
    for (const result of results) expect(result.body).toEqual(results[0]?.body)
  })
})

describe('pay a share: requests that must not pay anything', () => {
  it('returns 404 for a share paid through another bill, and leaves it unpaid', async () => {
    const { homeId, billId, share } = await setup()
    const otherBill = await createBill(homeId, 300)

    const wrongBill = await pay(otherBill.body.id, share.id, { 'Idempotency-Key': 'k1' })
    const rightBill = await pay(billId, share.id, { 'Idempotency-Key': 'k2' })

    expect(wrongBill.status).toBe(404)
    expect(wrongBill.body.error).toEqual(expect.any(String))
    expect(rightBill.status).toBe(200)
  })

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['too long', 'k'.repeat(201)],
  ])('rejects an Idempotency-Key that is %s with a 400 JSON error', async (_label, key) => {
    const { billId, share } = await setup()

    const paid = await pay(billId, share.id, { 'Idempotency-Key': key })

    expect(paid.status).toBe(400)
    expect(paid.body).toEqual({ error: expect.any(String) })
  })

  it('answers 404 with a JSON error when the bill does not exist', async () => {
    const paid = await pay('no-such-bill', 'no-such-share', { 'Idempotency-Key': 'k' })

    expect(paid.status).toBe(404)
    expect(paid.body).toEqual({ error: expect.any(String) })
  })

  it('answers 409 with a JSON error', async () => {
    const { billId, share } = await setup()
    await pay(billId, share.id, { 'Idempotency-Key': 'first' })

    const again = await pay(billId, share.id, { 'Idempotency-Key': 'second' })

    expect(again.status).toBe(409)
    expect(again.body).toEqual({ error: expect.any(String) })
  })
})

describe('pay a share: retries', () => {
  it('returns the original result for a retry that comes much later', async () => {
    const { homeId, billId, share } = await setup()
    const first = await pay(billId, share.id, { 'Idempotency-Key': 'retry-key' })
    await createBill(homeId, 700)

    const retry = await pay(billId, share.id, { 'Idempotency-Key': 'retry-key' })

    expect(retry.status).toBe(200)
    expect(retry.body).toEqual(first.body)
    expect(retry.body).toEqual({
      id: share.id,
      memberId: share.memberId,
      amountCents: 500,
      paidAt: expect.any(String),
    })
  })

  it('scopes a key to one share, so the same key can pay a different share', async () => {
    const { homeId } = await createHome(['Asha', 'Ben'])
    const bill = await createBill(homeId, 1000)
    const [first, second] = bill.body.shares
    if (!first || !second) throw new Error('bill should have two shares')

    const paidFirst = await pay(bill.body.id, first.id, { 'Idempotency-Key': 'same-key' })
    const paidSecond = await pay(bill.body.id, second.id, { 'Idempotency-Key': 'same-key' })

    expect(paidFirst.status).toBe(200)
    expect(paidSecond.status).toBe(200)
    expect(paidSecond.body.id).toBe(second.id)
  })
})

describe('balances', () => {
  it('is an empty list for a home with no members', async () => {
    const { homeId } = await createHome([])

    const outstanding = await balances(homeId)

    expect(outstanding.status).toBe(200)
    expect(outstanding.body).toEqual({ balances: [] })
  })

  it('drops to zero once every share is paid', async () => {
    const { homeId, members } = await createHome(['Asha', 'Ben', 'Chitra'])
    const bill = await createBill(homeId, 1000)
    for (const share of bill.body.shares) {
      await pay(bill.body.id, share.id, { 'Idempotency-Key': crypto.randomUUID() })
    }

    const outstanding = await balances(homeId)

    expect(outstanding.body.balances).toEqual(
      members.map((member) => ({ memberId: member.id, name: member.name, outstandingCents: 0 })),
    )
  })

  it('answers 404 with a JSON error when the home does not exist', async () => {
    const outstanding = await call<ErrorBody>('GET', '/api/homes/does-not-exist/balances')

    expect(outstanding.body).toEqual({ error: expect.any(String) })
  })
})
