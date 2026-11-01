import { Hono } from 'hono'
import { addMember, createHome, findHome, listMembers } from '../data/homes'
import type { AppEnv } from '../types'
import { homeInput, jsonBody, memberInput } from '../validation'

export const homes = new Hono<AppEnv>()

const HOME_NOT_FOUND = 'Home not found'

homes.post('/', jsonBody(homeInput), async (c) => {
  const { name } = c.req.valid('json')
  const home = await createHome(c.env.DB, name)
  return c.json(home, 201)
})

homes.get('/:homeId', async (c) => {
  const homeId = c.req.param('homeId')
  const home = await findHome(c.env.DB, homeId)
  if (!home) return c.json({ error: HOME_NOT_FOUND }, 404)
  const members = await listMembers(c.env.DB, homeId)
  return c.json({ ...home, members })
})

homes.post('/:homeId/members', jsonBody(memberInput), async (c) => {
  const { name } = c.req.valid('json')
  const member = await addMember(c.env.DB, c.req.param('homeId'), name)
  if (!member) return c.json({ error: HOME_NOT_FOUND }, 404)
  return c.json(member, 201)
})
