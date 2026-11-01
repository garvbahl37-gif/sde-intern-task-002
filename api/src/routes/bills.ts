import { Hono } from 'hono'
import { payShare } from '../data/bills'
import type { AppEnv } from '../types'

export const bills = new Hono<AppEnv>()

const MAX_KEY_LENGTH = 200

bills.post('/:billId/shares/:shareId/pay', async (c) => {
  // The client makes up one key per payment attempt and sends the same key again on a retry.
  // That is how the server can tell "the same request, sent twice" from "a second payment".
  const key = c.req.header('Idempotency-Key')
  if (key === undefined || key.trim() === '') {
    return c.json({ error: 'The Idempotency-Key header is required' }, 400)
  }
  if (key.length > MAX_KEY_LENGTH) {
    return c.json(
      { error: `The Idempotency-Key header must be at most ${MAX_KEY_LENGTH} characters` },
      400,
    )
  }

  const result = await payShare(
    c.env.DB,
    c.req.param('billId'),
    c.req.param('shareId'),
    key,
    new Date().toISOString(),
  )

  switch (result.kind) {
    case 'paid':
      return c.json(result.share, 200)
    case 'bill_not_found':
      return c.json({ error: 'Bill not found' }, 404)
    case 'share_not_found':
      return c.json({ error: 'Share not found on this bill' }, 404)
    case 'conflict':
      return c.json({ error: 'This share was already paid by a different request' }, 409)
  }
})
