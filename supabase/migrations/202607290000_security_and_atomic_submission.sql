-- Close the remaining browser-to-PostgREST bypasses and make payment
-- transaction-id reservation part of the payment submission transaction.
--
-- The application uses validated Next.js Route Handlers with a service-role
-- DAL for every mutation and every staff-wide read. Keeping parallel RLS
-- grants for those same operations lets a signed-in browser bypass role
-- status, faculty/floor scope, field validation and audit rules.

-- ---------------------------------------------------------------------
-- 1. Remove direct mutation/staff-wide policies. Keep only narrowly scoped
-- own-row reads that are genuinely used by browser clients.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Active admins can manage students" ON public.users;
DROP POLICY IF EXISTS "Active staff can view students" ON public.users;
DROP POLICY IF EXISTS "Zamdekan can update students" ON public.users;
DROP POLICY IF EXISTS "Zamdekan can update faculty students" ON public.users;

DROP POLICY IF EXISTS "Students can insert their own applications" ON public.arizalar;
DROP POLICY IF EXISTS "Students can update their own applications" ON public.arizalar;
DROP POLICY IF EXISTS "Students can delete their own applications" ON public.arizalar;
DROP POLICY IF EXISTS "Users can update relevant applications" ON public.arizalar;
DROP POLICY IF EXISTS "Users can delete relevant applications" ON public.arizalar;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.arizalar;
DROP POLICY IF EXISTS "Admins can update all applications" ON public.arizalar;
DROP POLICY IF EXISTS "Admins can delete all applications" ON public.arizalar;
DROP POLICY IF EXISTS "Staff can view all applications" ON public.arizalar;

DROP POLICY IF EXISTS "Admins can manage all payments" ON public.tolovlar;
DROP POLICY IF EXISTS "Staff can view all payments" ON public.tolovlar;
DROP POLICY IF EXISTS "Active admins manage payments" ON public.tolovlar;
DROP POLICY IF EXISTS "Active staff view payments" ON public.tolovlar;

DROP POLICY IF EXISTS "Anyone can insert permit requests" ON public.permit_requests;
DROP POLICY IF EXISTS "Anyone can select permit requests" ON public.permit_requests;
DROP POLICY IF EXISTS "Staff can manage permit requests" ON public.permit_requests;
DROP POLICY IF EXISTS "Active staff manage permit requests" ON public.permit_requests;

DROP POLICY IF EXISTS "Admins can view all elonlar" ON public.elonlar;
DROP POLICY IF EXISTS "Admins can insert elonlar" ON public.elonlar;
DROP POLICY IF EXISTS "Admins can update elonlar" ON public.elonlar;
DROP POLICY IF EXISTS "Admins can delete elonlar" ON public.elonlar;
DROP POLICY IF EXISTS "Floor captains can manage duty schedule" ON public.elonlar;

DROP POLICY IF EXISTS "Residents or staff manage cleaning schedule" ON public.cleaning_schedule;
DROP POLICY IF EXISTS "Authenticated users read cleaning schedules" ON public.cleaning_schedule;

DROP POLICY IF EXISTS "Adminlar barcha xodimlarni ko'ra oladi" ON public.staff;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- This legacy helper used to answer "is arbitrary uid an admin?" for anon and
-- ignored staff.status. Restrict it to the caller's own active identity. It is
-- retained (rather than dropped) for compatibility with any live-database
-- policy drift that may still reference it.
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT uid = auth.uid() AND EXISTS (
    SELECT 1
    FROM public.staff
    WHERE staff.id = uid
      AND staff.role = 'admin'
      AND staff.status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. One duty-schedule row per floor/gender, with an atomic server-only
-- upsert. Keep the newest legacy row if earlier races already made duplicates.
-- ---------------------------------------------------------------------
DELETE FROM public.elonlar
WHERE title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
  AND (
    target_floor IS NULL
    OR target_gender IS NULL
    OR target_gender NOT IN ('male', 'female')
  );

UPDATE public.elonlar
SET audience = 'internal'
WHERE title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
  AND audience IS DISTINCT FROM 'internal';

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY target_floor, target_gender
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_number
  FROM public.elonlar
  WHERE title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
)
DELETE FROM public.elonlar AS announcement
USING ranked
WHERE announcement.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS elonlar_duty_schedule_scope_uidx
  ON public.elonlar (target_floor, target_gender)
  WHERE title = 'HAFTALIK_NAVBATCHILIK_JADVALI';

ALTER TABLE public.elonlar
  DROP CONSTRAINT IF EXISTS elonlar_duty_schedule_scope_check;
ALTER TABLE public.elonlar
  ADD CONSTRAINT elonlar_duty_schedule_scope_check
  CHECK (
    title <> 'HAFTALIK_NAVBATCHILIK_JADVALI'
    OR (
      audience = 'internal'
      AND target_floor IS NOT NULL
      AND target_floor >= 1
      AND target_gender IN ('male', 'female')
    )
  );

CREATE OR REPLACE FUNCTION public.upsert_floor_duty_schedule(
  p_creator_id uuid,
  p_floor integer,
  p_gender text,
  p_faculty text,
  p_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_floor IS NULL OR p_floor < 1
     OR p_gender IS NULL OR p_gender NOT IN ('male', 'female')
     OR p_text IS NULL OR length(p_text) > 100000 THEN
    RAISE EXCEPTION 'Invalid duty schedule input' USING ERRCODE = '22023';
  END IF;

  -- Reject malformed JSON in the database as well as in the Route Handler.
  PERFORM p_text::jsonb;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_creator_id
      AND role = 'talaba'
      AND status = 'active'
      AND is_floor_captain = true
      AND assigned_floor = p_floor
      AND gender = p_gender
  ) THEN
    RAISE EXCEPTION 'Active floor captain required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('duty-schedule:' || p_floor::text || ':' || p_gender, 0)
  );

  SELECT id
  INTO v_id
  FROM public.elonlar
  WHERE title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
    AND target_floor = p_floor
    AND target_gender = p_gender
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.elonlar
    SET text = p_text,
        faculty = coalesce(nullif(trim(p_faculty), ''), 'Barchasi'),
        audience = 'internal',
        type = 'Yangilik',
        is_published = true,
        created_by = p_creator_id,
        updated_at = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.elonlar (
      title,
      text,
      type,
      audience,
      faculty,
      is_published,
      created_by,
      target_floor,
      target_gender
    )
    VALUES (
      'HAFTALIK_NAVBATCHILIK_JADVALI',
      p_text,
      'Yangilik',
      'internal',
      coalesce(nullif(trim(p_faculty), ''), 'Barchasi'),
      true,
      p_creator_id,
      p_floor,
      p_gender
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_floor_duty_schedule(uuid, integer, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_floor_duty_schedule(uuid, integer, text, text, text)
  TO service_role;

-- ---------------------------------------------------------------------
-- 3. Atomically reserve the AI-verified transaction id and create every
-- monthly payment row. A unique violation rolls the entire operation back,
-- so a failed payment never leaves a transaction id permanently reserved.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_payment_batch_atomic(
  p_student_id uuid,
  p_student_name text,
  p_months text[],
  p_amounts integer[],
  p_year integer,
  p_receipt_url text,
  p_receipt_hash text,
  p_batch_id uuid,
  p_transaction_id text,
  p_transaction_id_normalized text
)
RETURNS TABLE(id uuid, month text, year integer, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_month_count integer;
BEGIN
  v_month_count := coalesce(array_length(p_months, 1), 0);
  v_normalized := regexp_replace(upper(coalesce(p_transaction_id, '')), '[^A-Z0-9]', '', 'g');

  IF v_month_count = 0
     OR v_month_count <> coalesce(array_length(p_amounts, 1), 0)
     OR v_month_count <> (
       SELECT count(DISTINCT month_value.month)
       FROM unnest(p_months) AS month_value(month)
     )
     OR EXISTS (
       SELECT 1 FROM unnest(p_months) AS month_value(month)
       WHERE month_value.month IS NULL
          OR month_value.month NOT IN ('Sentabr', 'Oktabr', 'Noyabr', 'Dekabr', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun')
     )
     OR EXISTS (
       SELECT 1 FROM unnest(p_amounts) AS amount_value(amount)
       WHERE amount_value.amount IS NULL OR amount_value.amount < 1
     )
     OR p_year < 2020 OR p_year > 2100
     OR p_receipt_hash IS NULL OR p_receipt_hash !~ '^[0-9a-f]{64}$'
     OR p_transaction_id_normalized IS NULL
     OR p_transaction_id_normalized <> v_normalized
     OR length(v_normalized) < 6 OR length(v_normalized) > 128
     OR p_receipt_url IS NULL OR p_receipt_url NOT LIKE p_student_id::text || '/%'
  THEN
    RAISE EXCEPTION 'Invalid payment batch input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_student_id
      AND role = 'talaba'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active student required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.payment_receipt_uploads
    WHERE receipt_hash = p_receipt_hash
      AND batch_id = p_batch_id
      AND student_id = p_student_id
      AND object_path = p_receipt_url
  ) THEN
    RAISE EXCEPTION 'Receipt upload claim not found' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.payment_receipt_transactions (
    receipt_hash,
    transaction_id,
    transaction_id_normalized,
    updated_at
  )
  VALUES (
    p_receipt_hash,
    p_transaction_id,
    p_transaction_id_normalized,
    now()
  );

  RETURN QUERY
  INSERT INTO public.tolovlar (
    student_id,
    student_name,
    month,
    year,
    amount,
    status,
    receipt_url,
    receipt_hash,
    transaction_id,
    admin_message
  )
  SELECT
    p_student_id,
    coalesce(nullif(trim(p_student_name), ''), 'Talaba'),
    batch.month,
    p_year,
    batch.amount,
    'waiting',
    p_receipt_url,
    p_receipt_hash,
    p_transaction_id,
    'Tekshirilmoqda...'
  FROM unnest(p_months, p_amounts) AS batch(month, amount)
  RETURNING tolovlar.id, tolovlar.month, tolovlar.year, tolovlar.status;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_payment_batch_atomic(
  uuid, text, text[], integer[], integer, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_batch_atomic(
  uuid, text, text[], integer[], integer, text, text, uuid, text, text
) TO service_role;
