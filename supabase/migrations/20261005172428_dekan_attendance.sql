-- Dekan yo'qlamasi: dekan o'zi vaqt belgilab ochadigan, har bir yotoqxona va
-- fakultet uchun ALOHIDA sessiya.
--
-- Mavjud nightly/adhoc (tarbiyachi + sardor) oqimiga tegmaydi: yangi
-- kind='dekan' qatorlari faculty ustuni bilan ajratiladi va eski so'rovlar
-- ularni ko'rmaydi (repository darajasida filtrlanadi).

ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS faculty text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_interval_min int NOT NULL DEFAULT 10
    CONSTRAINT attendance_sessions_reminder_interval_check CHECK (reminder_interval_min BETWEEN 5 AND 60),
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count int NOT NULL DEFAULT 0;

-- kind: + 'dekan'; status: + 'scheduled' (hali boshlanmagan, talabaga ko'rinmaydi).
ALTER TABLE public.attendance_sessions DROP CONSTRAINT IF EXISTS attendance_sessions_kind_check;
ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_kind_check CHECK (kind IN ('nightly', 'adhoc', 'dekan'));

ALTER TABLE public.attendance_sessions DROP CONSTRAINT IF EXISTS attendance_sessions_status_check;
ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_status_check
  CHECK (status IN ('scheduled', 'open', 'closed', 'auto_closed'));

-- Aralashuvdan himoya: dekan sessiyasi doim fakultetga bog'langan, boshqalari
-- esa hech qachon (shunda eski oqim tasodifan fakultet sessiyasini olmaydi).
ALTER TABLE public.attendance_sessions DROP CONSTRAINT IF EXISTS attendance_sessions_dekan_scope_check;
ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_dekan_scope_check CHECK (
    (kind = 'dekan' AND faculty IS NOT NULL AND starts_at IS NOT NULL AND gender IS NULL AND floor_number IS NULL)
    OR (kind <> 'dekan' AND faculty IS NULL)
  );

-- Eski kechki-sessiya unikal indeksi dekan sessiyalarini qamramasin
-- (bir kunda bir necha dekan yo'qlamasi bo'lishi mumkin).
DROP INDEX IF EXISTS public.attendance_sessions_nightly_key;
CREATE UNIQUE INDEX attendance_sessions_nightly_key
  ON public.attendance_sessions (dorm_id, scheduled_for, kind, coalesce(gender, ''), coalesce(floor_number, -1))
  WHERE kind <> 'dekan';

-- Bir yotoqxona + fakultet uchun bir vaqtda faqat bitta faol (rejalangan yoki
-- ochiq) dekan yo'qlamasi — qo'sh bosish yoki ikkita parallel sessiya bo'lmaydi.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_dekan_active_key
  ON public.attendance_sessions (dorm_id, faculty)
  WHERE kind = 'dekan' AND status IN ('scheduled', 'open');

-- Cron: boshlanishi kelgan rejalangan va eslatma navbati kelgan ochiq sessiyalar.
CREATE INDEX IF NOT EXISTS attendance_sessions_dekan_cron_idx
  ON public.attendance_sessions (status, starts_at)
  WHERE kind = 'dekan' AND status IN ('scheduled', 'open');

CREATE INDEX IF NOT EXISTS attendance_sessions_dekan_history_idx
  ON public.attendance_sessions (faculty, dorm_id, opened_at DESC)
  WHERE kind = 'dekan';

COMMENT ON COLUMN public.attendance_sessions.faculty IS
  'Faqat kind=dekan uchun: sessiya shu fakultetning shu yotoqxonadagi talabalariga tegishli.';
COMMENT ON COLUMN public.attendance_sessions.starts_at IS
  'Faqat kind=dekan uchun: yo''qlama boshlanadigan vaqt (status=scheduled bo''lsa cron shu paytda ochadi).';
