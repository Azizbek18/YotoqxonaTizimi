-- Yo'qlama (attendance / roll-call), 1 & 2-bosqich.
--
-- 1-bosqich: qavat sardori / tarbiyachi ilovada belgilaydi.
-- 2-bosqich: talaba joylashuvi orqali o'zini tasdiqlaydi (haversine, radius).
--
-- Barcha kirish server API route'lari (service-role) orqali — mijozga ochiq
-- RLS policy yo'q, xuddi permit_requests / push_subscriptions kabi.

-- ---- dorms: bino geolokatsiyasi + yo'qlama oynasi ----
ALTER TABLE public.dorms
  ADD COLUMN IF NOT EXISTS latitude  double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS checkin_radius_m int NOT NULL DEFAULT 1000
    CONSTRAINT dorms_checkin_radius_check CHECK (checkin_radius_m BETWEEN 50 AND 20000),
  ADD COLUMN IF NOT EXISTS attendance_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attendance_open_time  time NOT NULL DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS attendance_close_time time NOT NULL DEFAULT '23:00';

COMMENT ON COLUMN public.dorms.latitude IS
  'Bino markazi. NULL bo''lsa talaba joylashuv bilan o''zini tasdiqlay olmaydi (2-bosqich).';
COMMENT ON COLUMN public.dorms.checkin_radius_m IS
  'Talaba shu radiusda (m) bo''lsa "hozir". Default 1 km — bino ichida GPS noaniqligini yutish uchun.';

-- ---- sessiyalar ----
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dorm_id       uuid NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  scheduled_for date NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('nightly', 'adhoc')),
  -- NULL = butun bino; aks holda bitta jins yoki bitta qavat uchun.
  gender        text CHECK (gender IN ('male', 'female')),
  floor_number  int CHECK (floor_number > 0),
  opened_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at     timestamptz NOT NULL DEFAULT now(),
  closes_at     timestamptz NOT NULL,
  closed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at     timestamptz,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'auto_closed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Bir kechada bino x jins x qavat bo'yicha bitta nightly sessiya (cron idempotent).
CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_nightly_key
  ON public.attendance_sessions (dorm_id, scheduled_for, kind, coalesce(gender, ''), coalesce(floor_number, -1));

CREATE INDEX IF NOT EXISTS attendance_sessions_dorm_open_idx
  ON public.attendance_sessions (dorm_id, status)
  WHERE status = 'open';

-- ---- yozuvlar ----
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Sessiya onidagi holat (denormal) — talaba keyin ko'chsa ham tarix buzilmasin.
  room_number  text NOT NULL DEFAULT '',
  floor_number int,
  gender       text,
  state        text NOT NULL DEFAULT 'unmarked'
    CHECK (state IN ('present', 'absent', 'excused', 'unmarked')),
  source       text CHECK (source IN ('self_location', 'captain', 'tarbiyachi', 'auto', 'leave')),
  self_lat        double precision,
  self_lng        double precision,
  self_accuracy_m int,
  self_distance_m int,
  -- Uzrsiz yo'q — tarbiyachi ko'rib, kerak bo'lsa ogohlantirishga aylantiradi.
  soft_flag    boolean NOT NULL DEFAULT false,
  note         text,
  marked_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  marked_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_records_session_student_key UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS attendance_records_student_idx
  ON public.attendance_records (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS attendance_records_flags_idx
  ON public.attendance_records (session_id)
  WHERE soft_flag = true;

-- ---- RLS: faqat service-role ----
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.attendance_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.attendance_records  FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendance_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendance_records  TO service_role;

COMMENT ON TABLE public.attendance_sessions IS
  'Bitta yo''qlama sessiyasi — cron (nightly) yoki sardor/tarbiyachi (adhoc) ochadi.';
COMMENT ON TABLE public.attendance_records IS
  'Sessiyadagi har talabaning holati. UNIQUE(session_id, student_id).';
