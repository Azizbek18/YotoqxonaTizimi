-- app/api/admin/users/route.ts promotes a new floor captain (sardor) in two
-- separate UPDATE statements: demote whoever currently holds
-- (assigned_floor, gender), then promote the target student. Two concurrent
-- admin requests promoting different students to the same floor+gender
-- could each pass the "demote" step before either "promote" lands, leaving
-- two active captains for the same floor/gender. A partial unique index
-- makes the database the atomic source of truth regardless of request
-- ordering: the losing request's promote UPDATE fails with 23505 instead
-- of silently succeeding.
--
-- That exact race is what CREATE UNIQUE INDEX would otherwise be run
-- against: if it already happened to any (assigned_floor, gender) pair
-- before this migration, existing duplicate captains would make the index
-- creation fail outright. Dedup first — keep only the most recently
-- updated captain per (assigned_floor, gender), demote the rest — so the
-- index can be created regardless of past races.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY assigned_floor, gender
           ORDER BY updated_at DESC, id DESC
         ) AS rn
  FROM users
  WHERE is_floor_captain = true
)
UPDATE users
SET is_floor_captain = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS users_floor_captain_unique_idx
  ON users (assigned_floor, gender) WHERE is_floor_captain = true;
