import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { Bill, Share } from './api'
import { billsQuery, recordPayment } from './queries'

const unpaid: Share = { id: 's1', memberId: 'm1', amountCents: 500, paidAt: null }
const paid: Share = { ...unpaid, paidAt: '2026-11-01T10:00:00.000Z' }
const rent = (share: Share): Bill => ({
  id: 'b1',
  homeId: 'h1',
  title: 'Rent',
  totalCents: 500,
  shares: [share],
})

describe('recordPayment', () => {
  it('shows the share as paid', async () => {
    const client = new QueryClient()
    const key = billsQuery('h1').queryKey
    client.setQueryData(key, [rent(unpaid)])

    await recordPayment(client, 'h1', 'b1', paid)

    expect(client.getQueryData(key)).toEqual([rent(paid)])
  })

  it('keeps the payment when an older bills request finishes afterwards', async () => {
    const client = new QueryClient()
    const key = billsQuery('h1').queryKey
    client.setQueryData(key, [rent(unpaid)])
    let finishOlderRequest: (bills: Bill[]) => void = () => {}
    // A refetch that started before the payment and still holds the old, unpaid data.
    const olderRequest = client
      .fetchQuery({
        queryKey: key,
        queryFn: () =>
          new Promise<Bill[]>((resolve) => {
            finishOlderRequest = resolve
          }),
      })
      .catch(() => undefined)

    await recordPayment(client, 'h1', 'b1', paid)
    finishOlderRequest([rent(unpaid)])
    await olderRequest

    expect(client.getQueryData(key)).toEqual([rent(paid)])
  })
})
