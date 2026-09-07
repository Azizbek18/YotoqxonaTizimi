-- ==========================================================
-- 6-yotoqxona (bo'lingan bino) — 0-bosqich: SXEMA POYDEVORI
-- ==========================================================
-- Yangi 12-qavatli bino eshikdan kirilganda ikki qanotga bo'linadi —
-- A blok / B blok (B = A ning ko'zgu aksi). Har blok/har qavat ("seksiya")
-- bitta fakultetniki bo'ladi va bir qavatda ikkita seksiya bo'lgani uchun
-- bir qavatda ikki fakultet yashashi mumkin. Xona raqami HAR QAVATDA
-- qaytadan 1 dan boshlanadi — ya'ni `room_number` endi bino ichida
-- yagona EMAS.
--
-- Bu migratsiya FAQAT sxemani qo'yadi. Hech qanday RPC yoki ilova kodi
-- hali `block` ustunini, `dorm_section` ni yoki `layout_kind` ni O'QIMAYDI
-- — barcha default'lar mavjud 1–5 yotoqxonani (`layout_kind='simple'`,
-- `block IS NULL`) bir xil qoldiradi. Simlanishi keyingi bosqichlarda
-- (P1 RPC → P2 backend → P3+ UI).
-- Reja: https://claude.ai/code/artifact/17d5c605-3402-413c-bd33-a40fa21d1f5b
--
-- Idempotent: IF NOT EXISTS / DROP ... IF EXISTS bilan qayta ishga
-- tushirilsa 0 o'zgarish.

-- ----------------------------------------------------------
-- 1. dorms — bino turi va blok soni
-- ----------------------------------------------------------
ALTER TABLE public.dorms
  ADD COLUMN IF NOT EXISTS layout_kind text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS block_count smallint NOT NULL DEFAULT 1;

ALTER TABLE public.dorms DROP CONSTRAINT IF EXISTS dorms_layout_kind_chk;
ALTER TABLE public.dorms ADD CONSTRAINT dorms_layout_kind_chk
  CHECK (layout_kind IN ('simple', 'blocked'));

ALTER TABLE public.dorms DROP CONSTRAINT IF EXISTS dorms_block_count_chk;
ALTER TABLE public.dorms ADD CONSTRAINT dorms_block_count_chk
  CHECK (block_count BETWEEN 1 AND 8);

-- 'simple' binoda blok bo'linishi yo'q (block_count = 1); 'blocked' binoda
-- kamida 2 ta blok bo'lishi shart.
ALTER TABLE public.dorms DROP CONSTRAINT IF EXISTS dorms_blocked_needs_blocks;
ALTER TABLE public.dorms ADD CONSTRAINT dorms_blocked_needs_blocks
  CHECK (
    (layout_kind = 'simple'  AND block_count = 1) OR
    (layout_kind = 'blocked' AND block_count >= 2)
  );

-- ----------------------------------------------------------
-- 2. block ustunlari (nullable — 'simple' binoda har doim NULL)
-- ----------------------------------------------------------
ALTER TABLE public.floor_room_layout ADD COLUMN IF NOT EXISTS block text;
ALTER TABLE public.users             ADD COLUMN IF NOT EXISTS block text;
ALTER TABLE public.permit_requests   ADD COLUMN IF NOT EXISTS block text;

-- Bitta bosh lotin harfi: 'A', 'B', ...
ALTER TABLE public.floor_room_layout DROP CONSTRAINT IF EXISTS floor_room_layout_block_chk;
ALTER TABLE public.floor_room_layout ADD CONSTRAINT floor_room_layout_block_chk
  CHECK (block IS NULL OR block ~ '^[A-Z]$');

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_block_chk;
ALTER TABLE public.users ADD CONSTRAINT users_block_chk
  CHECK (block IS NULL OR block ~ '^[A-Z]$');

ALTER TABLE public.permit_requests DROP CONSTRAINT IF EXISTS permit_requests_block_chk;
ALTER TABLE public.permit_requests ADD CONSTRAINT permit_requests_block_chk
  CHECK (block IS NULL OR block ~ '^[A-Z]$');

-- ----------------------------------------------------------
-- 3. Xona kalitining yangi shakli
-- ----------------------------------------------------------
-- Eski: UNIQUE (dorm_id, room_number) — xona raqami bino ichida yagona.
-- Bloklarga bo'lingan binoda bu buziladi ("5" xona 2 blok × 12 qavat =
-- 24 marta). Cheklovni ikkita QISMAN unikal indeksга bo'lamiz:
--   • 'simple' bino (block IS NULL) — avvalgi kafolat AYNAN o'sha:
--     (dorm_id, room_number). Mavjud har bir qator block IS NULL, demak
--     xatti-harakat 100% bir xil.
--   • 'blocked' bino (block IS NOT NULL) — to'liq kalit:
--     (dorm_id, block, floor_number, room_number).
-- replace_floor_room_layout / apply_building_layout upsert emas,
-- DELETE + INSERT ishlatadi — ON CONFLICT (dorm_id, room_number) ga
-- bog'liq emas, shuning uchun cheklovni almashtirish ularni buzmaydi.
ALTER TABLE public.floor_room_layout
  DROP CONSTRAINT IF EXISTS floor_room_layout_dorm_room_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS floor_room_layout_simple_room_key
  ON public.floor_room_layout (dorm_id, room_number)
  WHERE block IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS floor_room_layout_blocked_room_key
  ON public.floor_room_layout (dorm_id, block, floor_number, room_number)
  WHERE block IS NOT NULL;

-- Qidiruv indekslari — faqat 'blocked' qatorlar uchun (kichik, arzon).
CREATE INDEX IF NOT EXISTS floor_room_layout_block_idx
  ON public.floor_room_layout (dorm_id, block, floor_number)
  WHERE block IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_block_idx
  ON public.users (dorm_id, block, assigned_floor, room_number)
  WHERE block IS NOT NULL;

CREATE INDEX IF NOT EXISTS permit_requests_block_idx
  ON public.permit_requests (dorm_id, block, room_number)
  WHERE block IS NOT NULL;

-- ----------------------------------------------------------
-- 4. dorm_section — seksiya egaligi (blok + qavat = 1 fakultet)
-- ----------------------------------------------------------
-- dorm_floor'ga o'xshaydi (P1a, 202609140000), lekin bloklarga bo'lingan
-- bino uchun: kalitda `block` bor. Kelishuv/handshake ustunlari (pending_*)
-- YO'Q — 6-yotoqxona markazlashgan boshqariladi, seksiyalarni superadmin
-- taqsimlaydi (P1: dorm_assign_section RPC). Kerak bo'lsa handshake keyin
-- qo'shiladi.
CREATE TABLE IF NOT EXISTS public.dorm_section (
  dorm_id       uuid NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  block         text NOT NULL CHECK (block ~ '^[A-Z]$'),
  floor_number  int  NOT NULL CHECK (floor_number >= 1),
  faculty       text NOT NULL,
  gender        text CHECK (gender IS NULL OR gender IN ('male', 'female')),
  assigned_by   uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dorm_id, block, floor_number)
);

CREATE INDEX IF NOT EXISTS dorm_section_dorm_faculty_idx
  ON public.dorm_section (dorm_id, faculty);

ALTER TABLE public.dorm_section ENABLE ROW LEVEL SECURITY;
-- Mijozga ochiq policy yo'q — faqat service-role (dekan/superadmin API'lari),
-- dorm_floor bilan bir xil.
