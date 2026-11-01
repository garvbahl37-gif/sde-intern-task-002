import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getBalances, listBills, payShare } from './api'

function answerWith(response: Response | Error) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    if (response instanceof Error) throw response
    return response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('expected the request to fail')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('returns the parsed body of a successful answer', async () => {
    answerWith(Response.json({ balances: [{ memberId: 'm1', name: 'Asha', outstandingCents: 5 }] }))

    await expect(getBalances('h1')).resolves.toEqual([
      { memberId: 'm1', name: 'Asha', outstandingCents: 5 },
    ])
  })

  it('uses the error message the API sends for a 4xx answer', async () => {
    answerWith(Response.json({ error: 'Home not found' }, { status: 404 }))

    const error = await failure(listBills('missing'))

    expect(error.status).toBe(404)
    expect(error.message).toBe('Home not found')
  })

  it('turns a 500 with a plain-text body into a readable error', async () => {
    answerWith(new Response('<html>Bad gateway</html>', { status: 500 }))

    const error = await failure(listBills('h1'))

    expect(error.status).toBe(500)
    expect(error.message).toMatch(/server/i)
  })

  it('turns a network failure into an error with status 0', async () => {
    answerWith(new TypeError('Failed to fetch'))

    const error = await failure(listBills('h1'))

    expect(error.status).toBe(0)
    expect(error.message).toMatch(/reach the server/i)
  })

  it('turns a timeout into an error that says the server was slow', async () => {
    answerWith(new DOMException('The operation timed out.', 'TimeoutError'))

    const error = await failure(listBills('h1'))

    expect(error.status).toBe(0)
    expect(error.message).toMatch(/too long/i)
  })

  it('refuses a successful answer that does not have the expected shape', async () => {
    answerWith(Response.json({ bills: 'not a list' }))

    const error = await failure(listBills('h1'))

    expect(error.message).toMatch(/could not read/i)
  })

  it('sends the Idempotency-Key header when paying a share', async () => {
    const fetchMock = answerWith(
      Response.json({ id: 's1', memberId: 'm1', amountCents: 500, paidAt: '2026-01-01T00:00:00Z' }),
    )

    await payShare('b1', 's1', 'key-123')

    const init = fetchMock.mock.calls[0]?.[1]
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/bills/b1/shares/s1/pay')
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('key-123')
    expect(init?.method).toBe('POST')
  })
})
