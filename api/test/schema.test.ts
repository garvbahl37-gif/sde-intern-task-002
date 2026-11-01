import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

// These tests talk to the database directly. They prove that the schema itself
// refuses bad data, even if a bug in the API tried to write it.

const now = '2026-01-01T00:00:00.000Z'

async function seed() {
  const homeId = crypto.randomUUID()
  const memberId = crypto.randomUUID()
  const billId = crypto.randomUUID()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO homes (id, name, created_at) VALUES (?, ?, ?)').bind(
      homeId,
      'Home',
      now,
    ),
    env.DB.prepare(
      'INSERT INTO members (id, home_id, name, position, created_at) VALUES (?, ?, ?, 1, ?)',
    ).bind(memberId, homeId, 'Asha', now),
    env.DB.prepare(
      'INSERT INTO bills (id, home_id, title, total_cents, created_at) VALUES (?, ?, ?, 100, ?)',
    ).bind(billId, homeId, 'Rent', now),
    env.DB.prepare(
      'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, 100)',
    ).bind(crypto.randomUUID(), billId, memberId),
  ])
  return { homeId, memberId, billId }
}

function insertMember(homeId: string, name: string, position: number) {
  return env.DB.prepare(
    'INSERT INTO members (id, home_id, name, position, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), homeId, name, position, now)
    .run()
}

function insertBill(homeId: string, title: string, totalCents: number) {
  return env.DB.prepare(
    'INSERT INTO bills (id, home_id, title, total_cents, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), homeId, title, totalCents, now)
    .run()
}

describe('schema constraints', () => {
  it('rejects a blank home name (homes_name_not_blank)', async () => {
    const insert = env.DB.prepare('INSERT INTO homes (id, name, created_at) VALUES (?, ?, ?)')
      .bind(crypto.randomUUID(), '   ', now)
      .run()

    await expect(insert).rejects.toThrow(/homes_name_not_blank/)
  })

  it('rejects a blank member name (members_name_not_blank)', async () => {
    const { homeId } = await seed()

    await expect(insertMember(homeId, ' ', 2)).rejects.toThrow(/members_name_not_blank/)
  })

  it('rejects a member of a home that does not exist (members_home_fk)', async () => {
    await expect(insertMember('no-such-home', 'Asha', 1)).rejects.toThrow(/FOREIGN KEY/)
  })

  it('rejects two members in the same position of one home (members_position_unique)', async () => {
    const { homeId } = await seed()

    await expect(insertMember(homeId, 'Ben', 1)).rejects.toThrow(
      /UNIQUE constraint failed: members\.home_id, members\.position/,
    )
  })

  it('rejects a blank bill title (bills_title_not_blank)', async () => {
    const { homeId } = await seed()

    await expect(insertBill(homeId, '  ', 100)).rejects.toThrow(/bills_title_not_blank/)
  })

  it.each([0, -5, 10.5])(
    'rejects a bill total of %s (bills_total_positive_integer)',
    async (total) => {
      const { homeId } = await seed()

      await expect(insertBill(homeId, 'Rent', total)).rejects.toThrow(
        /bills_total_positive_integer/,
      )
    },
  )

  it('rejects a bill for a home that does not exist (bills_home_fk)', async () => {
    await expect(insertBill('no-such-home', 'Rent', 100)).rejects.toThrow(/FOREIGN KEY/)
  })

  it('rejects a share for a bill that does not exist (shares_bill_fk)', async () => {
    const { memberId } = await seed()
    const insert = env.DB.prepare(
      'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, 1)',
    )
      .bind(crypto.randomUUID(), 'no-such-bill', memberId)
      .run()

    await expect(insert).rejects.toThrow(/FOREIGN KEY/)
  })

  it('rejects a share for a member that does not exist (shares_member_fk)', async () => {
    const { billId } = await seed()
    const insert = env.DB.prepare(
      'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, 1)',
    )
      .bind(crypto.randomUUID(), billId, 'no-such-member')
      .run()

    await expect(insert).rejects.toThrow(/FOREIGN KEY/)
  })

  it('rejects a second share for the same member on one bill (shares_one_per_member)', async () => {
    const { billId, memberId } = await seed()
    const insert = env.DB.prepare(
      'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, 1)',
    )
      .bind(crypto.randomUUID(), billId, memberId)
      .run()

    await expect(insert).rejects.toThrow(
      /UNIQUE constraint failed: shares\.bill_id, shares\.member_id/,
    )
  })

  it('rejects a negative share amount (shares_amount_non_negative_integer)', async () => {
    const { homeId, billId } = await seed()
    const other = await env.DB.prepare(
      'INSERT INTO members (id, home_id, name, position, created_at) VALUES (?, ?, ?, 2, ?) RETURNING id',
    )
      .bind(crypto.randomUUID(), homeId, 'Ben', now)
      .first<{ id: string }>()
    const insert = env.DB.prepare(
      'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, -1)',
    )
      .bind(crypto.randomUUID(), billId, other?.id)
      .run()

    await expect(insert).rejects.toThrow(/shares_amount_non_negative_integer/)
  })

  it('rejects a paid share that has no idempotency key (shares_paid_has_key)', async () => {
    const { billId } = await seed()
    const update = env.DB.prepare('UPDATE shares SET paid_at = ? WHERE bill_id = ?')
      .bind(now, billId)
      .run()

    await expect(update).rejects.toThrow(/shares_paid_has_key/)
  })
})
