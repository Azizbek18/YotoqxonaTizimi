-- ==========================================================
-- Bir martalik tuzatish: permitda xona bor, lekin akkauntda yo'q talabalar
-- ==========================================================
-- 202609230000 kelajakdagi holatlarni tuzatadi. Bu migratsiya esa
-- allaqachon buzilgan yozuvlarni to'g'rilaydi: dekan xonani permitga
-- biriktirgan, talaba keyin faollashgan, lekin xona users.room_number ga
-- ko'chmagan.
--
-- Xavfsizlik shartlari (biror shart bajarilmasa — o'sha talaba tashlab
-- ketiladi, dekan qo'lda qayta biriktiradi):
--   * users.room_number IS NULL
--   * mos permitning room_number bor, status IN ('approved','registered')
--   * o'sha xona hali fakultet/dorm tarxida mavjud
--   * xonada bo'sh joy bor (COALESCE(capacity, 4) bo'yicha)
-- Idempotent: faqat room_number IS NULL qatorlarni o'zgartiradi.

WITH resolved AS (
  SELECT
    u.id                                            AS user_id,
    u.id                                            AS exclude_user_id,
    pr.id                                           AS permit_id,
    pr.room_number                                  AS room_number,
    COALESCE(
      u.dorm_id,
      pr.dorm_id,
      (SELECT fd.dorm_id FROM public.faculty_dorm fd
        WHERE fd.faculty = COALESCE(NULLIF(u.faculty, ''), 'amit'))
    )                                               AS dorm_id
  FROM public.users u
  JOIN public.permit_requests pr
    ON pr.passport_series = u.passport_series
   AND lower(trim(pr.email)) = lower(trim(u.email))
   AND (
     (pr.jshshir IS NOT NULL AND u.jshshir = pr.jshshir)
     OR (pr.jshshir IS NULL AND u.jshshir IS NULL AND pr.application_type = 'imtiyozli')
   )
  WHERE u.role = 'talaba'
    AND u.room_number IS NULL
    AND pr.room_number IS NOT NULL
    AND pr.status IN ('approved', 'registered')
),
candidate AS (
  SELECT
    r.user_id,
    r.room_number,
    r.dorm_id,
    frl.floor_number,
    frl.capacity,
    (
      SELECT count(*) FROM (
        SELECT o.id FROM public.users o
        WHERE o.role = 'talaba'
          AND o.room_number = r.room_number
          AND (o.dorm_id = r.dorm_id OR o.dorm_id IS NULL)
          AND o.id <> r.exclude_user_id
        UNION ALL
        SELECT op.id FROM public.permit_requests op
        WHERE op.status = 'approved'
          AND op.room_number = r.room_number
          AND (op.dorm_id = r.dorm_id OR op.dorm_id IS NULL)
          AND op.id <> r.permit_id
      ) occ
    ) AS occupied
  FROM resolved r
  JOIN public.floor_room_layout frl
    ON frl.room_number = r.room_number
   AND (frl.dorm_id = r.dorm_id OR r.dorm_id IS NULL)
)
UPDATE public.users u
SET room_number = c.room_number,
    dorm_id = COALESCE(c.dorm_id, u.dorm_id),
    assigned_floor = COALESCE(
      c.floor_number,
      CASE
        WHEN regexp_replace(c.room_number, '\D', '', 'g') <> ''
        THEN GREATEST(1, ((regexp_replace(c.room_number, '\D', '', 'g')::int - 1) / 30) + 1)
        ELSE NULL
      END
    ),
    updated_at = now()
FROM candidate c
WHERE u.id = c.user_id
  AND u.room_number IS NULL
  AND c.occupied < COALESCE(c.capacity, 4);
