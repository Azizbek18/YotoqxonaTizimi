-- ==========================================================
-- Bosqich 1a — floor_room_layout fakultet bo'yicha (sxema)
-- ==========================================================
-- Har fakultet o'z yotoqxona binosiga ega bo'ladi. Xona raqami endi FAQAT
-- bir fakultet binosi ichida yagona bo'ladi — global emas.
--
-- Bu migratsiya faqat sxemani tayyorlaydi. `faculty` ustuni DEFAULT 'amit'
-- bilan qo'shiladi, shu sabab hozirgi RPC'lar (replace_floor_room_layout,
-- assign_student_room_atomic va h.k. — ular hali `room_number`ni yalang'och
-- ishlatadi) o'zgarishsiz ishlashda davom etadi. Fakultetni RPC'lar orqali
-- o'tkazish keyingi qadamlarda (1c/1d). Hozircha bitta AMIT binosi bor,
-- shuning uchun xatti-harakat aynan o'zgarmaydi.

ALTER TABLE floor_room_layout ADD COLUMN IF NOT EXISTS faculty text NOT NULL DEFAULT 'amit';

-- Xona raqamining yagonaligini fakultet ichiga ko'chiramiz. Ilgari
-- `UNIQUE (room_number)` inline berilgan edi -> avtomatik nom
-- `floor_room_layout_room_number_key`.
ALTER TABLE floor_room_layout DROP CONSTRAINT IF EXISTS floor_room_layout_room_number_key;
ALTER TABLE floor_room_layout
  ADD CONSTRAINT floor_room_layout_faculty_room_number_key UNIQUE (faculty, room_number);

-- Qavat/tomon/pozitsiya bo'yicha ko'rish indeksi endi fakultet bilan
-- boshlanadi (har bino o'z tarxini alohida so'raydi).
DROP INDEX IF EXISTS floor_room_layout_floor_idx;
CREATE INDEX IF NOT EXISTS floor_room_layout_floor_idx
  ON floor_room_layout (faculty, floor_number, side, position);
