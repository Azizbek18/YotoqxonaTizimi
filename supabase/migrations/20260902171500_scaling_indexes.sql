-- ==========================================================
-- SCALING: indekslar (10 000+ talaba yuki uchun)
-- ==========================================================
-- Faqat indeks qo'shadi — sxema/xulq o'zgarmaydi, hammasi IF NOT EXISTS.
-- (Kelib chiqishi: perf/scaling-phase-1 branch'idagi 202608310000, hozirgi
--  main sxemasiga moslab qayta yozildi.)
--
-- Muammo: `users` da deyarli har qator role='talaba' — `users_role_idx`
-- amalda tanlovsiz. Quyidagilar har talaba dashboard/profil ochilishida
-- ketadi va 10k qatorda sequential scan bo'ladi:
--   * xonadoshlar     -> users WHERE role='talaba' AND status='active' AND room_number = $1
--   * fakultet ro'yxat -> users WHERE role='talaba' AND faculty ILIKE $1
--   * oylik statistika -> users/arizalar WHERE created_at >= $1
--   * "kutilayotgan to'lov" soni -> tolovlar WHERE status='waiting' (admin layout 15s poll)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- --- users ---
CREATE INDEX IF NOT EXISTS users_active_students_idx
  ON public.users (status) WHERE role = 'talaba';

CREATE INDEX IF NOT EXISTS users_room_number_idx
  ON public.users (room_number) WHERE room_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_faculty_trgm_idx
  ON public.users USING gin (faculty gin_trgm_ops);

CREATE INDEX IF NOT EXISTS users_created_at_idx
  ON public.users (created_at);

-- --- arizalar (chat xabarlari ko'p bo'lishi mumkin — ularni chiqaramiz) ---
CREATE INDEX IF NOT EXISTS arizalar_created_at_not_chat_idx
  ON public.arizalar (created_at) WHERE type <> 'chat';

-- --- tolovlar ---
CREATE INDEX IF NOT EXISTS tolovlar_status_waiting_idx
  ON public.tolovlar (status) WHERE status = 'waiting';
