import { z } from 'zod'

// Every answer from the API is checked against these schemas before the page uses it.
// If the API ever sends something unexpected, the page shows an error instead of crashing.

const memberSchema = z.object({ id: z.string(), homeId: z.string(), name: z.string() })
const homeSchema = z.object({ id: z.string(), name: z.string() })
const homeWithMembersSchema = homeSchema.extend({ members: z.array(memberSchema) })
const shareSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  amountCents: z.int(),
  paidAt: z.string().nullable(),
})
const billSchema = z.object({
  id: z.string(),
  homeId: z.string(),
  title: z.string(),
  totalCents: z.int(),
  shares: z.array(shareSchema),
})
const balanceSchema = z.object({
  memberId: z.string(),
  name: z.string(),
  outstandingCents: z.int(),
})
const errorSchema = z.object({ error: z.string() })

export type Member = z.infer<typeof memberSchema>
export type Home = z.infer<typeof homeSchema>
export type HomeWithMembers = z.infer<typeof homeWithMembersSchema>
export type Share = z.infer<typeof shareSchema>
export type Bill = z.infer<typeof billSchema>
export type Balance = z.infer<typeof balanceSchema>

// status is the HTTP status, or 0 when no answer arrived (offline, or the server was too slow).
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// A request that has not finished after this long is given up, so the page never waits forever.
const TIMEOUT_MS = 10_000

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
}

async function request<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}) {
  let response: Response
  let text: string
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    text = await response.text()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('The server took too long to answer. Try again.', 0)
    }
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0)
  }

  const body = parseJson(text)

  if (!response.ok) {
    const apiError = errorSchema.safeParse(body)
    // A 4xx message from the API explains what to fix, so show it. A 5xx message would only
    // say something like "Internal server error", so show a plainer sentence instead.
    const message =
      response.status < 500 && apiError.success
        ? apiError.data.error
        : 'Something went wrong on the server. Try again in a moment.'
    throw new ApiError(message, response.status)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError('The server sent an answer the page could not read.', response.status)
  }
  return parsed.data
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const path = (...parts: string[]) => `/api/${parts.map(encodeURIComponent).join('/')}`

export function createHome(name: string) {
  return request(path('homes'), homeSchema, { method: 'POST', body: { name } })
}

export function getHome(homeId: string) {
  return request(path('homes', homeId), homeWithMembersSchema)
}

export function addMember(homeId: string, name: string) {
  return request(path('homes', homeId, 'members'), memberSchema, {
    method: 'POST',
    body: { name },
  })
}

export async function listBills(homeId: string) {
  const { bills } = await request(
    path('homes', homeId, 'bills'),
    z.object({ bills: z.array(billSchema) }),
  )
  return bills
}

export function createBill(homeId: string, input: { title: string; totalCents: number }) {
  return request(path('homes', homeId, 'bills'), billSchema, { method: 'POST', body: input })
}

export async function getBalances(homeId: string) {
  const { balances } = await request(
    path('homes', homeId, 'balances'),
    z.object({ balances: z.array(balanceSchema) }),
  )
  return balances
}

export function payShare(billId: string, shareId: string, idempotencyKey: string) {
  return request(path('bills', billId, 'shares', shareId, 'pay'), shareSchema, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}
