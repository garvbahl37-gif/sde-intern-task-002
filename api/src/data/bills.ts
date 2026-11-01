import { splitCents } from '../split'
import type { Bill, Member, Share } from '../types'

type ShareRow = { id: string; member_id: string; amount_cents: number; paid_at: string | null }

function toShare(row: ShareRow): Share {
  return {
    id: row.id,
    memberId: row.member_id,
    amountCents: row.amount_cents,
    paidAt: row.paid_at,
  }
}

// Creates a bill and one share per member. `members` must be in join order: the first members
// receive the extra cents.
//
// The bill and its shares are written in one batch. D1 runs a batch as a single transaction,
// so either everything is saved or nothing is. A bill can never exist without its shares.
export async function createBill(
  db: D1Database,
  homeId: string,
  title: string,
  totalCents: number,
  members: Member[],
): Promise<Bill> {
  const billId = crypto.randomUUID()
  const amounts = splitCents(totalCents, members.length)
  const shares: Share[] = members.map((member, index) => {
    const amountCents = amounts[index]
    // splitCents returns exactly one amount per member, so this cannot happen. If it ever did,
    // failing is better than saving a share with a made-up amount.
    if (amountCents === undefined) throw new Error('split returned too few amounts')
    return { id: crypto.randomUUID(), memberId: member.id, amountCents, paidAt: null }
  })

  await db.batch([
    db
      .prepare(
        'INSERT INTO bills (id, home_id, title, total_cents, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
      )
      .bind(billId, homeId, title, totalCents, new Date().toISOString()),
    ...shares.map((share) =>
      db
        .prepare(
          'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?1, ?2, ?3, ?4)',
        )
        .bind(share.id, billId, share.memberId, share.amountCents),
    ),
  ])

  return { id: billId, homeId, title, totalCents, shares }
}

export type PayResult =
  | { kind: 'paid'; share: Share }
  | { kind: 'bill_not_found' }
  | { kind: 'share_not_found' }
  | { kind: 'conflict' }

// Marks a share as paid, at most once.
//
// The write comes first and is conditional: `WHERE paid_at IS NULL`. SQLite runs the UPDATE as
// one atomic step, so when two requests race, exactly one of them changes the row. The loser
// changes nothing and falls through to the checks below. Reading first ("is it unpaid?") and
// writing second would let both requests see "unpaid" and both succeed.
//
// The key of the winning request is stored on the share. A repeat of that request (same key)
// gets the stored result back. Any other key gets a conflict.
export async function payShare(
  db: D1Database,
  billId: string,
  shareId: string,
  idempotencyKey: string,
  paidAt: string,
): Promise<PayResult> {
  const updated = await db
    .prepare(
      `UPDATE shares SET paid_at = ?1, idempotency_key = ?2
       WHERE id = ?3 AND bill_id = ?4 AND paid_at IS NULL
       RETURNING id, member_id, amount_cents, paid_at`,
    )
    .bind(paidAt, idempotencyKey, shareId, billId)
    .first<ShareRow>()
  if (updated) return { kind: 'paid', share: toShare(updated) }

  // Nothing changed. Either the share does not exist on this bill, or it was already paid.
  const existing = await db
    .prepare(
      `SELECT id, member_id, amount_cents, paid_at, idempotency_key
       FROM shares WHERE id = ?1 AND bill_id = ?2`,
    )
    .bind(shareId, billId)
    .first<ShareRow & { idempotency_key: string | null }>()

  if (!existing) {
    const bill = await db.prepare('SELECT id FROM bills WHERE id = ?1').bind(billId).first()
    return bill ? { kind: 'share_not_found' } : { kind: 'bill_not_found' }
  }
  if (existing.idempotency_key === idempotencyKey) return { kind: 'paid', share: toShare(existing) }
  return { kind: 'conflict' }
}

type BillShareRow = ShareRow & {
  bill_id: string
  home_id: string
  title: string
  total_cents: number
}

// Lists a home's bills, newest first, each with its shares in member join order.
//
// One query reads bills and shares together, so the list is a consistent snapshot: a bill
// created halfway through cannot show up without its shares.
export async function listBills(db: D1Database, homeId: string): Promise<Bill[]> {
  const { results } = await db
    .prepare(
      `SELECT b.id AS bill_id, b.home_id, b.title, b.total_cents,
              s.id, s.member_id, s.amount_cents, s.paid_at
       FROM bills b
       JOIN shares s ON s.bill_id = b.id
       JOIN members m ON m.id = s.member_id
       WHERE b.home_id = ?1
       ORDER BY b.created_at DESC, b.rowid DESC, m.position ASC`,
    )
    .bind(homeId)
    .all<BillShareRow>()

  // Rows arrive already sorted. A Map keeps the bills in the order it first sees them.
  const bills = new Map<string, Bill>()
  for (const row of results) {
    let bill = bills.get(row.bill_id)
    if (!bill) {
      bill = {
        id: row.bill_id,
        homeId: row.home_id,
        title: row.title,
        totalCents: row.total_cents,
        shares: [],
      }
      bills.set(row.bill_id, bill)
    }
    bill.shares.push(toShare(row))
  }
  return [...bills.values()]
}
