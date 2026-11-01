import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { call, createHome, type Member } from './helpers'

type ErrorBody = { error: string }
type HomeWithMembers = { id: string; name: string; members: Member[] }

describe('homes: bad input', () => {
  it.each([
    {},
    { name: '' },
    { name: '   ' },
    { name: 42 },
    { name: null },
    { name: 'x'.repeat(101) },
  ])('rejects the home body %j with 422', async (body) => {
    const created = await call<ErrorBody>('POST', '/api/homes', { body })

    expect(created.status).toBe(422)
    expect(created.body.error).toEqual(expect.any(String))
  })

  it('rejects malformed JSON with a 400 JSON error', async () => {
    const response = await exports.default.fetch(
      new Request('http://localhost/api/homes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"name":',
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.any(String) })
  })

  it('stores the home name without surrounding spaces', async () => {
    const created = await call<{ name: string }>('POST', '/api/homes', {
      body: { name: '  Flat 4B ' },
    })

    expect(created.body.name).toBe('Flat 4B')
  })

  it('rejects a blank member name with 422', async () => {
    const { homeId } = await createHome([])

    const member = await call<ErrorBody>('POST', `/api/homes/${homeId}/members`, {
      body: { name: ' ' },
    })

    expect(member.status).toBe(422)
    expect(member.body.error).toEqual(expect.any(String))
  })

  it('answers 404 with a JSON error when the home does not exist', async () => {
    const member = await call<ErrorBody>('POST', '/api/homes/does-not-exist/members', {
      body: { name: 'Asha' },
    })

    expect(member.body).toEqual({ error: expect.any(String) })
  })
})

describe('get a home', () => {
  it('returns the home with its members in the order they were added', async () => {
    const { homeId, members } = await createHome(['Asha', 'Ben', 'Chitra'])

    const home = await call<HomeWithMembers>('GET', `/api/homes/${homeId}`)

    expect(home.status).toBe(200)
    expect(home.body).toEqual({ id: homeId, name: 'Test home', members })
  })

  it('returns 404 when the home does not exist', async () => {
    const home = await call<ErrorBody>('GET', '/api/homes/does-not-exist')

    expect(home.status).toBe(404)
    expect(home.body).toEqual({ error: expect.any(String) })
  })
})

describe('members added at the same time', () => {
  it('keeps every member and gives each one its own place in the order', async () => {
    const { homeId } = await createHome([])
    const names = ['Asha', 'Ben', 'Chitra', 'Dev', 'Esha']

    const added = await Promise.all(
      names.map((name) => call<Member>('POST', `/api/homes/${homeId}/members`, { body: { name } })),
    )
    const home = await call<HomeWithMembers>('GET', `/api/homes/${homeId}`)

    expect(added.map((member) => member.status)).toEqual([201, 201, 201, 201, 201])
    expect(home.body.members.map((member) => member.name).sort()).toEqual(names)
  })
})

describe('unknown routes', () => {
  it('answer 404 with a JSON error', async () => {
    const response = await call<ErrorBody>('GET', '/api/nothing-here')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: expect.any(String) })
  })
})
