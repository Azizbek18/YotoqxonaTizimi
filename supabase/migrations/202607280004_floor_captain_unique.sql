-- app/api/admin/users/route.ts promotes a new floor captain (sardor) in two
-- separate UPDATE statements: demote whoever currently holds
-- (assigned_floor, gender), then promote the target student. Two concurrent
-- admin requests promoting different students to the same floor+gender
-- could each pass the "demote" step before either "promote" lands, leaving
-- two active captains for the same floor/gender. A partial unique index
-- makes the database the atomic source of truth regardless of request
-- ordering: the losing request's promote UPDATE fails with 23505 instead
-- of silently succeeding.
CREATE UNIQUE INDEX IF NOT EXISTS users_floor_captain_unique_idx
  ON users (assigned_floor, gender) WHERE is_floor_captain = true;
