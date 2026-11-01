import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { bills } from './routes/bills'
import { homes } from './routes/homes'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

// Every request body here is a few short fields. Refuse anything large before reading it.
app.use('/api/*', bodyLimit({ maxSize: 16 * 1024 }))

app.get('/api/health', (c) => c.json({ status: 'ok' }))
app.route('/api/homes', homes)
app.route('/api/bills', bills)

// Every error is JSON: { "error": "message" }.
app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  // Errors Hono raises on purpose, such as malformed JSON (400) or a body that is too large (413).
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  // Anything else is a bug or an outage. Log the details, but do not send them to the client.
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
