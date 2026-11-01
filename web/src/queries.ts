import { type QueryClient, queryOptions } from '@tanstack/react-query'
import { type Bill, getBalances, getHome, listBills, type Share } from './api'

// All three keys start with ['home', homeId], so invalidating that prefix refreshes everything
// about one home at once.
export const homeKey = (homeId: string) => ['home', homeId] as const

export const homeQuery = (homeId: string) =>
  queryOptions({ queryKey: [...homeKey(homeId), 'details'], queryFn: () => getHome(homeId) })

export const billsQuery = (homeId: string) =>
  queryOptions({ queryKey: [...homeKey(homeId), 'bills'], queryFn: () => listBills(homeId) })

export const balancesQuery = (homeId: string) =>
  queryOptions({ queryKey: [...homeKey(homeId), 'balances'], queryFn: () => getBalances(homeId) })

// Shows a confirmed payment on the page and refreshes the balances.
export async function recordPayment(
  queryClient: QueryClient,
  homeId: string,
  billId: string,
  paid: Share,
) {
  const billsKey = billsQuery(homeId).queryKey
  // A bills request that started before this payment still carries the share as unpaid. If it
  // finished after this update it would undo it on screen, so cancel it first.
  await queryClient.cancelQueries({ queryKey: billsKey })
  queryClient.setQueryData(billsKey, (bills) => (bills ? replaceShare(bills, billId, paid) : bills))
  void queryClient.invalidateQueries({ queryKey: balancesQuery(homeId).queryKey })
}

// Puts a freshly paid share into the cached bill list, so the page updates without a refetch.
export function replaceShare(bills: Bill[], billId: string, paid: Share): Bill[] {
  return bills.map((bill) =>
    bill.id === billId
      ? { ...bill, shares: bill.shares.map((share) => (share.id === paid.id ? paid : share)) }
      : bill,
  )
}
