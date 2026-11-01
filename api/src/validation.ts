import { validator } from 'hono/validator'
import { z } from 'zod'

const name = z
  .string({ error: 'name must be a string' })
  .trim()
  .min(1, { error: 'name must not be empty' })
  .max(100, { error: 'name must be at most 100 characters' })

export const homeInput = z.object({ name })
export const memberInput = z.object({ name })

export const billInput = z.object({
  title: z
    .string({ error: 'title must be a string' })
    .trim()
    .min(1, { error: 'title must not be empty' })
    .max(200, { error: 'title must be at most 200 characters' }),
  // z.int() only accepts whole numbers that a JavaScript number can hold exactly.
  // A string such as "1000" is rejected on purpose: amounts must be real numbers of cents.
  totalCents: z
    .int({ error: 'totalCents must be a whole number of cents' })
    .positive({ error: 'totalCents must be greater than zero' }),
})

// Reads the JSON body and checks it against a schema.
// A body that fails the schema is answered with 422 and the first problem found.
// A body that is not valid JSON never gets here: Hono answers it with a 400.
export function jsonBody<Schema extends z.ZodType>(schema: Schema) {
  return validator('json', (value, c) => {
    const result = schema.safeParse(value)
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Invalid request body'
      return c.json({ error: message }, 422)
    }
    return result.data
  })
}
