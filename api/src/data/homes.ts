import type { Home, Member } from '../types'

type MemberRow = { id: string; home_id: string; name: string }

function toMember(row: MemberRow): Member {
  return { id: row.id, homeId: row.home_id, name: row.name }
}

export async function createHome(db: D1Database, name: string): Promise<Home> {
  const id = crypto.randomUUID()
  await db
    .prepare('INSERT INTO homes (id, name, created_at) VALUES (?1, ?2, ?3)')
    .bind(id, name, new Date().toISOString())
    .run()
  return { id, name }
}

export async function findHome(db: D1Database, homeId: string): Promise<Home | null> {
  return db.prepare('SELECT id, name FROM homes WHERE id = ?1').bind(homeId).first<Home>()
}

export async function listMembers(db: D1Database, homeId: string): Promise<Member[]> {
  const { results } = await db
    .prepare('SELECT id, home_id, name FROM members WHERE home_id = ?1 ORDER BY position')
    .bind(homeId)
    .all<MemberRow>()
  return results.map(toMember)
}

// Adds a member at the end of the home's join order. Returns null when the home does not exist.
//
// This is one statement on purpose. SQLite runs a statement as a single atomic step, so two
// members added at the same moment can never read the same MAX(position). Selecting from
// `homes` also means a missing home inserts nothing, so there is no gap between "check the home
// exists" and "insert the member".
export async function addMember(
  db: D1Database,
  homeId: string,
  name: string,
): Promise<Member | null> {
  const row = await db
    .prepare(
      `INSERT INTO members (id, home_id, name, position, created_at)
       SELECT ?1, h.id, ?2, COALESCE((SELECT MAX(position) FROM members WHERE home_id = h.id), 0) + 1, ?3
       FROM homes h
       WHERE h.id = ?4
       RETURNING id, home_id, name`,
    )
    .bind(crypto.randomUUID(), name, new Date().toISOString(), homeId)
    .first<MemberRow>()
  return row ? toMember(row) : null
}
