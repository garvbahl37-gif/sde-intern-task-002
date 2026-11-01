-- Shared bill splitter schema.
-- Every constraint has a name so an error message says exactly which rule was broken.
-- Timestamps are ISO-8601 UTC strings written by the API.

CREATE TABLE homes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  -- Stops an empty or whitespace-only home name.
  CONSTRAINT homes_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  -- 1, 2, 3, ... in the order members joined the home. Drives how extra cents are handed out.
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  -- Stops a member that belongs to a home that does not exist.
  CONSTRAINT members_home_fk FOREIGN KEY (home_id) REFERENCES homes (id),
  -- Stops two members from sharing a place in the join order of one home.
  CONSTRAINT members_position_unique UNIQUE (home_id, position),
  -- Stops an empty or whitespace-only member name.
  CONSTRAINT members_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  -- Stops a bill that belongs to a home that does not exist.
  CONSTRAINT bills_home_fk FOREIGN KEY (home_id) REFERENCES homes (id),
  -- Stops a total of zero, a negative total, or a fractional number of cents.
  CONSTRAINT bills_total_positive_integer CHECK (typeof(total_cents) = 'integer' AND total_cents > 0),
  -- Stops an empty or whitespace-only bill title.
  CONSTRAINT bills_title_not_blank CHECK (length(trim(title)) > 0)
);

CREATE INDEX bills_home_created_idx ON bills (home_id, created_at);

CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  -- NULL while unpaid. Set exactly once, together with the key of the request that paid it.
  paid_at TEXT,
  idempotency_key TEXT,
  -- Stops a share that points at a bill that does not exist.
  CONSTRAINT shares_bill_fk FOREIGN KEY (bill_id) REFERENCES bills (id),
  -- Stops a share that points at a member that does not exist.
  CONSTRAINT shares_member_fk FOREIGN KEY (member_id) REFERENCES members (id),
  -- Stops one member from getting two shares of the same bill.
  CONSTRAINT shares_one_per_member UNIQUE (bill_id, member_id),
  -- Stops a negative or fractional share. Zero is allowed: 2 cents split three ways is 1, 1, 0.
  CONSTRAINT shares_amount_non_negative_integer CHECK (
    typeof(amount_cents) = 'integer' AND amount_cents >= 0
  ),
  -- Stops a share that is marked paid without the key that paid it, or the other way round.
  CONSTRAINT shares_paid_has_key CHECK ((paid_at IS NULL) = (idempotency_key IS NULL))
);

CREATE INDEX shares_member_paid_idx ON shares (member_id, paid_at);
