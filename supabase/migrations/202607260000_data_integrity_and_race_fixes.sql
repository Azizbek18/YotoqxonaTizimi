-- Closes several data-integrity gaps found in an audit:
--   1. Room assignment (both the direct zamdekan flow and permit approval)
--      read capacity/gender, then wrote separately — two concurrent
--      requests could both pass a stale check and overbook/mis-gender a
--      room. Fixed with SECURITY DEFINER functions that serialize on a
--      per-room advisory lock and do the check-and-write atomically.
--   2. `arizalar.status` had no CHECK constraint, unlike `tolovlar.status`.
--   3. `tolovlar` had no protection against a student submitting two
--      active (waiting/approved) payments for the same month/year.
--   4. `cleaning_schedule` had a blanket "any authenticated user" SELECT
--      policy alongside a room/staff-scoped ALL policy — the permissive OR
--      of RLS policies made the scoped one meaningless for reads.
--   5. `floor_room_layout.replaceFloor` did a delete then a separate
--      insert; a failed insert (e.g. duplicate room number) left the
--      floor's layout permanently deleted. Wrapped in one function so it
--      commits or rolls back together.
--   6. The `receipts` storage bucket was public, unlike `permits` — payment
--      receipts (financial documents) were reachable by anyone with the
--      URL, forever. Flipped private; access now goes through
--      /api/payments/receipt-url (signed URLs), mirroring permits.

-- ---------------------------------------------------------------------
-- 1a. Atomic room assignment for the zamdekan "assign student to room" flow.
-- Only callable via the service-role key (server-only route handlers do
-- the caller-authorization/faculty-scoping checks before invoking this).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_student_room_atomic(
  p_student_id uuid,
  p_room_number text,
  p_max_capacity int DEFAULT 4
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gender text;
  v_occupied int;
  v_conflicting int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_room_number));

  SELECT gender INTO v_gender FROM public.users WHERE id = p_student_id AND role = 'talaba';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users WHERE role = 'talaba' AND room_number = p_room_number AND id <> p_student_id
    UNION ALL
    SELECT id FROM public.permit_requests WHERE status = 'approved' AND room_number = p_room_number
  ) occupants;

  IF v_occupied >= p_max_capacity THEN
    RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001';
  END IF;

  IF v_gender IS NOT NULL THEN
    SELECT count(*) INTO v_conflicting FROM (
      SELECT gender FROM public.users WHERE role = 'talaba' AND room_number = p_room_number AND id <> p_student_id AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests WHERE status = 'approved' AND room_number = p_room_number AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;

    IF v_conflicting > 0 THEN
      RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.users
  SET room_number = p_room_number,
      assigned_floor = COALESCE(
        (SELECT floor_number FROM public.floor_room_layout WHERE room_number = p_room_number),
        CASE
          WHEN regexp_replace(p_room_number, '\D', '', 'g') <> ''
          THEN GREATEST(1, ((regexp_replace(p_room_number, '\D', '', 'g')::int - 1) / 30) + 1)
          ELSE NULL
        END
      )
  WHERE id = p_student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_student_room_atomic(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, int) TO service_role;

-- ---------------------------------------------------------------------
-- 1b. Atomic permit-room approval for the zamdekan "approve into room" flow.
-- Shares the same advisory lock key space as assign_student_room_atomic so
-- the two flows can't race each other for the same room either.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_permit_room_atomic(
  p_permit_id uuid,
  p_room_number text,
  p_max_capacity int DEFAULT 4
)
RETURNS SETOF public.permit_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gender text;
  v_occupied int;
  v_conflicting int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_room_number));

  SELECT gender INTO v_gender FROM public.permit_requests WHERE id = p_permit_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permit not pending' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users WHERE role = 'talaba' AND room_number = p_room_number
    UNION ALL
    SELECT id FROM public.permit_requests WHERE status = 'approved' AND room_number = p_room_number
  ) occupants;

  IF v_occupied >= p_max_capacity THEN
    RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001';
  END IF;

  IF v_gender IS NOT NULL THEN
    SELECT count(*) INTO v_conflicting FROM (
      SELECT gender FROM public.users WHERE role = 'talaba' AND room_number = p_room_number AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests WHERE status = 'approved' AND room_number = p_room_number AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;

    IF v_conflicting > 0 THEN
      RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN QUERY
  UPDATE public.permit_requests
  SET status = 'approved', room_number = p_room_number, reject_reason = NULL
  WHERE id = p_permit_id AND status = 'pending'
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) TO service_role;

-- ---------------------------------------------------------------------
-- 2. floor_room_layout: replace-a-floor as a single atomic function so a
-- failed insert (e.g. duplicate room number) can't leave the floor's
-- layout deleted with nothing re-inserted.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replace_floor_room_layout(p_floor_number int, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.floor_room_layout WHERE floor_number = p_floor_number;

  INSERT INTO public.floor_room_layout (floor_number, room_number, side, position, size)
  SELECT p_floor_number, r->>'roomNumber', r->>'side', (r->>'position')::int, r->>'size'
  FROM jsonb_array_elements(p_rows) AS r;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_floor_room_layout(int, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_floor_room_layout(int, jsonb) TO service_role;

-- ---------------------------------------------------------------------
-- 3. arizalar.status: allow-list, matching the set of values every route/
-- page in the app actually writes (draft, submitted, pending, approved,
-- rejected). Normalize any stray legacy value to 'pending' first so the
-- constraint can be added without failing on existing rows.
-- ---------------------------------------------------------------------
UPDATE public.arizalar
SET status = 'pending'
WHERE status IS NULL OR status NOT IN ('draft', 'submitted', 'pending', 'approved', 'rejected');

ALTER TABLE public.arizalar ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.arizalar ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.arizalar DROP CONSTRAINT IF EXISTS arizalar_status_check;
ALTER TABLE public.arizalar
  ADD CONSTRAINT arizalar_status_check CHECK (status IN ('draft', 'submitted', 'pending', 'approved', 'rejected'));

-- ---------------------------------------------------------------------
-- 4. tolovlar: prevent more than one active (waiting/approved) payment row
-- per student per month/year. Rejected rows don't count, so resubmission
-- after a rejection is still allowed.
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS public.tolovlar_student_month_year_active_uidx;
CREATE UNIQUE INDEX tolovlar_student_month_year_active_uidx
ON public.tolovlar (student_id, month, year)
WHERE status IN ('waiting', 'approved', 'paid');

-- ---------------------------------------------------------------------
-- 5. cleaning_schedule: drop the blanket "any authenticated user can read
-- any room's schedule" policy. The existing "Residents or staff manage
-- cleaning schedule" FOR ALL policy already scopes SELECT correctly (own
-- room, or active admin/tarbiyachi staff); with both policies present,
-- Postgres ORs them together per RLS semantics, so the blanket one made
-- the scoped one a no-op for reads.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users read cleaning schedules" ON public.cleaning_schedule;

-- ---------------------------------------------------------------------
-- 6. receipts bucket: private, matching the permits bucket. Reads now go
-- through /api/payments/receipt-url (service-role signed URLs); nothing
-- else needs a storage.objects policy since uploads/reads are already
-- server-only (see features/payments/server/repository.ts).
-- ---------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'receipts';
