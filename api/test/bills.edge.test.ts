import { describe, expect, it } from 'vitest'
import { type Bill, call, createBill, createHome } from './helpers'

type ErrorBody = { error: string }

function listBills(homeId: string) {
  return call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
}

describe('create a bill: amounts', () => {
  it('gives zero to the last members when there are fewer cents than members', async () => {
    const { homeId } = await createHome(['Asha', 'Ben', 'Chitra'])

    const bill = await createBill(homeId, 2)

    expect(bill.status).toBe(201)
    expect(bill.body.shares.map((share) => share.amountCents)).toEqual([1, 1, 0])
  })

  it('accepts the largest whole number that JSON numbers carry exactly', async () => {
    const { homeId } = await createHome(['Asha', 'Ben'])

    const bill = await createBill(homeId, Number.MAX_SAFE_INTEGER)

    expect(bill.status).toBe(201)
    expect(bill.body.totalCents).toBe(Number.MAX_SAFE_INTEGER)
  })

  it.each([1e20, true, [1000], { value: 1000 }])(
    'rejects the amount %j with a JSON error',
    async (totalCents) => {
      const { homeId } = await createHome(['Asha'])

      const bill = await call<ErrorBody>('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'Rent', totalCents },
      })

      expect(bill.status).toBe(422)
      expect(bill.body.error).toEqual(expect.any(String))
    },
  )

  it('rejects a body with no amount', async () => {
    const { homeId } = await createHome(['Asha'])

    const bill = await call('POST', `/api/homes/${homeId}/bills`, { body: { title: 'Rent' } })

    expect(bill.status).toBe(422)
  })

  it('rejects a blank title', async () => {
    const { homeId } = await createHome(['Asha'])

    const bill = await call('POST', `/api/homes/${homeId}/bills`, {
      body: { title: '  ', totalCents: 100 },
    })

    expect(bill.status).toBe(422)
  })

  it('does not save anything when the home has no members', async () => {
    const { homeId } = await createHome([])

    const bill = await createBill(homeId, 1000)
    const bills = await listBills(homeId)

    expect(bill.body).toEqual({ error: expect.any(String) })
    expect(bills.body.bills).toEqual([])
  })
})

describe('list bills', () => {
  it('returns the newest bill first, each with its shares in member order', async () => {
    const { homeId, members } = await createHome(['Asha', 'Ben', 'Chitra'])
    const older = await createBill(homeId, 1000)
    const newer = await createBill(homeId, 2)

    const bills = await listBills(homeId)

    expect(bills.status).toBe(200)
    expect(bills.body.bills).toEqual([newer.body, older.body])
    expect(bills.body.bills[0]?.shares.map((share) => share.memberId)).toEqual(
      members.map((member) => member.id),
    )
  })

  it('returns an empty list for a home with no bills', async () => {
    const { homeId } = await createHome(['Asha'])

    const bills = await listBills(homeId)

    expect(bills.status).toBe(200)
    expect(bills.body).toEqual({ bills: [] })
  })

  it('returns 404 when the home does not exist', async () => {
    const bills = await call<ErrorBody>('GET', '/api/homes/does-not-exist/bills')

    expect(bills.status).toBe(404)
    expect(bills.body).toEqual({ error: expect.any(String) })
  })
})
