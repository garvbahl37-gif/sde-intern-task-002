# SDE Intern Assignment: Shared Bill Splitter

Welcome. In this assignment you build a small bill splitter for a shared home. It has two parts:

1. **Homes and members:** create a home and add members to it.
2. **Bill splitting:** split a bill between the members. Each member pays their own share.

The assignment is small on purpose. We want correct, safe, and clear code. We do not want many features.

## What we look at

- **Your code passes the tests.** The tests decide, not opinion. You get the visible tests. We also run extra tests that you do not see.
- **Your code is safe when things go wrong.** Wrong input, repeated requests, and two requests at the same time must not break your data.
- **Your code is typed.** Use TypeScript. Do not use `any`.
- **You understand your code.** You record a short video and explain it.

Take your time. A careful, correct solution is better than a fast one. We expect 2 to 3 days of real work.

## Stack (required)

- **API:** Hono on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite). The binding is `DB` in `api/wrangler.jsonc`.
- **Web:** React, Vite, TanStack Router
- **Language:** TypeScript on both sides
- **Tests:** Vitest, running inside the Workers runtime
- **Quality:** Biome. `pnpm check` and `pnpm typecheck` must pass.

You choose the rest (styling, form library, validation library). Pick tools you can explain.

## The task

The assignment has two parts. Do Part 1 first. Part 2 builds on it.

**Database.** Write the schema as SQL migration files in `api/migrations/`. For example `0001_init.sql`. The tests apply every file in this folder. Your schema must have **at least 3 named constraints** that protect the data. For example a foreign key, a `CHECK`, or a `UNIQUE` key. Be ready to explain what each constraint stops.

**Errors.** Every error response is JSON: `{ "error": "message" }`.

## Part 1: Homes and members

Create a home and add members to it. The order in which members are added matters in Part 2.

#### `POST /api/homes`

- Request: `{ "name": string }`
- Success: `201` `{ id, name }`

#### `POST /api/homes/:homeId/members`

- Request: `{ "name": string }`
- Success: `201` `{ id, homeId, name }`
- Errors: `404` home not found

Visible tests: `api/test/homes.test.ts`.

## Part 2: Bill splitting

Add a bill to a home, split it between the members, and let each member pay their share.

All amounts are whole **cents** (integers). `100` cents is 1 dollar. Never use decimals for money.

#### `POST /api/homes/:homeId/bills`

- Request: `{ "title": string, "totalCents": number }`
- Success: `201` `{ id, homeId, title, totalCents, shares: [{ id, memberId, amountCents, paidAt: null }] }`
- Errors: `404` home not found. `422` total is not a positive whole number, or the home has no members.

#### `POST /api/bills/:billId/shares/:shareId/pay`

- Request: header `Idempotency-Key`
- Success: `200` `{ id, memberId, amountCents, paidAt }`
- Errors: `400` key missing. `404` bill or share not found. `409` share already paid with a different key.

#### `GET /api/homes/:homeId/balances`

- Success: `200` `{ balances: [{ memberId, name, outstandingCents }] }`
- Errors: `404` home not found

**Rules**

- **Split.** A bill is split between all members of the home. The shares always add up to `totalCents`. If the amount does not divide evenly, the extra cents go to the members one by one, in the order the members were added to the home. Example: 1000 cents between 3 members gives `334`, `333`, `333`.
- **Pay.** Paying marks one share as paid and sets `paidAt`. If the same `Idempotency-Key` is sent again for the same share, answer `200` with the same result. Do not pay twice. If two requests pay the same share at the same time, only one may succeed.
- **Balances.** `outstandingCents` is the sum of the member's unpaid shares, across all bills of the home. List the members in the order they were added.

Visible tests: `api/test/bills.test.ts` and `api/test/payments.test.ts`.

#### Web page

Build one page that:

- shows the bills of a home and the shares of each bill,
- lets a member pay a share,
- shows clear **loading**, **empty**, and **error** states,
- keeps the share unpaid and shows an error if the payment fails.

The page must not crash when the API answers with an error or is slow.

## Cases you must handle

You must handle these cases and talk about them in your video:

1. A home with no members.
2. An amount that is zero, negative, or not a whole number.
3. An amount that does not divide evenly.
4. The same payment request sent twice.
5. Two members paying the same share at the same time.
6. A bill or share that does not exist.
7. The API answers with a 500 error or is slow. The web page must not crash.

## Run it

This is a pnpm workspace. Install once at the root.

```bash
pnpm install
pnpm dev          # api on :8787 and web on :5173
```

Open http://localhost:5173. The starter page shows a title. `/api/health` returns `{ "status": "ok" }`.

```bash
pnpm test         # run the visible tests in api/test
pnpm check        # Biome: format and lint. Must pass.
pnpm check:fix    # fix what Biome can fix
pnpm typecheck    # tsc on both packages. Must pass.
pnpm build        # production build of the web app
```

`pnpm dev` applies your migrations to a local database before it starts the API.

If pnpm says some build scripts were ignored, run `pnpm approve-builds` and allow `esbuild` and `workerd`.

When you change `api/wrangler.jsonc`, refresh the `Env` types:

```bash
pnpm --filter bill-splitter-api cf-typegen
```

## Rules for the tests

- The visible tests are in `api/test`. They start with a failing result. Your job is to make them pass.
- Do **not** change the visible tests or `api/test/helpers.ts`. We compare them with the original.
- We run extra tests after you submit. They test the cases in "Cases you must handle" more closely.

## AI policy

You can use AI tools. Tell us which ones and where in your answers on the form.
You must understand every line you submit. We check this with your video and in a live call. "The AI wrote it" is not an answer.

## How to submit

1. Click **Use this template**, then **Create a new repository**. Make the repository **public**.
2. Build your solution in your new repository. Small, clear commits are welcome.
3. Update this README with a short section called **Decisions**. Write 3 decisions you made and why.
4. Record a video of **3 minutes or less** (Loom or unlisted YouTube). Show the architecture, the data flow, and one trade-off you made. Make sure anyone with the link can view it.
5. Paste the repository link and the video link in the application form.

We will run `pnpm install && pnpm check && pnpm typecheck && pnpm test` on your repository.

---

## Decisions

**1. Paying a share is one conditional write, not "read, then write".**
The pay endpoint runs `UPDATE shares SET paid_at = ?, idempotency_key = ? WHERE id = ? AND bill_id = ? AND paid_at IS NULL RETURNING …`.
SQLite applies a statement as one atomic step, so when two requests race, exactly one of them changes the row.
The other changes nothing, reads the row back, and answers `200` with the stored result if its key matches, or `409` if it does not.
Reading first ("is it unpaid?") and writing second would let both requests see "unpaid" and both succeed.
Trade-off: the key is stored on the share row instead of in a separate idempotency table. It is simple and needs no cleanup, but a key only means something for one share. Sending the same key for a different share pays that share.

**2. The join order of members is an explicit `position` column.**
The extra cents of a split go to members in the order they joined, so that order must be exact.
Timestamps can tie, and SQLite's hidden `rowid` is not something to depend on.
`position` is assigned inside a single `INSERT … SELECT … FROM homes WHERE id = ?`. That one statement also checks the home exists (0 rows inserted means `404`), and two members added at the same moment cannot get the same number. `UNIQUE (home_id, position)` backs this up in the schema.

**3. The page reuses the same `Idempotency-Key` when you retry a payment.**
Each share row makes a key on the first click and keeps it until the payment succeeds.
If a request times out after the server already paid, a retry with a _new_ key would get `409`, and the page would show an error for a payment that worked. With the same key, the retry gets `200` and the original result.
A `4xx` answer is final, so the next click after it starts a new key.

## Notes for reviewers

**Named constraints** (`api/migrations/0001_init.sql`, each one proved in `api/test/schema.test.ts`):

| Constraint                                                                | What it stops                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `members_home_fk`, `bills_home_fk`, `shares_bill_fk`, `shares_member_fk`  | rows that point at a home, bill or member that does not exist                  |
| `members_position_unique`                                                 | two members in the same place of a home's join order                           |
| `shares_one_per_member`                                                   | one member getting two shares of the same bill                                 |
| `bills_total_positive_integer`                                            | a total of zero, below zero, or with fractional cents                          |
| `shares_amount_non_negative_integer`                                      | a negative or fractional share (0 is allowed: 2 cents for 3 people is 1, 1, 0) |
| `shares_paid_has_key`                                                     | a share marked paid without the key that paid it, or the other way round       |
| `homes_name_not_blank`, `members_name_not_blank`, `bills_title_not_blank` | empty or whitespace-only names and titles                                      |

**The cases from the brief:**

1. **Home with no members:** `POST …/bills` answers `422`, and nothing is saved. The page disables the bill form and says to add people first.
2. **Zero, negative or fractional amount:** Zod (`z.int().positive()`) answers `422`. Strings, `null`, booleans and numbers above `Number.MAX_SAFE_INTEGER` are rejected too. The schema `CHECK` is a second guard.
3. **Uneven split:** `splitCents` in `api/src/split.ts` gives everyone the floor, then hands out the remaining cents one each in join order. A test checks every total from 1 to 200 across 1 to 9 people.
4. **Same request twice:** the second answer is `200` with the same `paidAt`, and the share is paid once. This holds when the two arrive at the same time as well.
5. **Two people paying one share at once:** exactly one gets `200`, the others get `409`, and the page then shows "Someone else paid this share first."
   The guarantee comes from the single conditional `UPDATE`, not from timing. `api/test/pay-race.test.ts` slows every query down so the requests really do interleave. A read-then-write version fails that test, while the plain parallel tests in `payments.edge.test.ts` would not catch it.
6. **Bill or share that does not exist:** `404`. A real share asked for through the wrong bill is also `404` and stays unpaid.
7. **API errors or slowness:** each request times out after 10 s. Every response is checked with Zod, and errors render as a message with "Try again". A failed payment leaves the share unpaid with the reason under it. After 4 s the loading state says the server is slow.

**Other choices:**
- Every error is JSON, including unknown routes (`404`), malformed JSON (`400`), bodies over 16 KB (`413`) and unexpected failures (`500`, with details only in the log).
- Input is validated before the database is touched. So an invalid body sent to a home that does not exist answers `422`, not `404`.
- Web stack additions: TanStack Query (loading, error, and retry state), Zod, plain CSS, and self-hosted fonts. There is no form library; the three small forms use React state.

**Extra commands:**

```bash
pnpm --filter bill-splitter-web test   # unit tests for the web client and money parsing
```
