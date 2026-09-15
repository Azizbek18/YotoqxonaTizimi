-- check_student_permit_approved() (20260830173311_foreign_student_registration)
-- is a defense-in-depth guard: it blocks ANY INSERT into `users` with
-- role='talaba' unless a matching approved permit_requests row exists —
-- even if application code has a bug that tries to skip the check. A
-- KV-talaba (off-campus student, migration 20260914041940) never has a
-- permit_requests row by design — app/api/kv-talaba/register relies on
-- dekan approval instead, not a permit match — so the trigger needs an
-- explicit exception for is_off_campus rows, not a bypass of the guard
-- itself (which stays in force for every ordinary dorm-track insert).
CREATE OR REPLACE FUNCTION public.check_student_permit_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'talaba' AND NEW.is_off_campus IS NOT TRUE THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.permit_requests
      WHERE passport_series = NEW.passport_series
        AND (
          (NEW.jshshir IS NOT NULL AND jshshir = NEW.jshshir AND application_type = 'yollanma')
          OR
          (NEW.jshshir IS NULL AND jshshir IS NULL AND application_type = 'imtiyozli')
        )
        AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Ushbu talabaning yotoqxona arizasi dekan tomonidan tasdiqlanmagan. Ro''yxatdan o''tish taqiqlanadi!';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
