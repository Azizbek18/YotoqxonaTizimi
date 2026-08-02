-- Ilova endi dekan tomonidan ishlatiladi: "zamdekan" roli butun kod bazasida
-- "dekan" ga o'zgartirildi (yo'llar, env kalitlari, UI matnlari, guard'lar).
-- Bazadagi rol qiymati ham shu bilan birga ko'chirilishi shart — aks holda
-- server guard'lari 'dekan' rolini qidiradi, staff jadvalida esa 'zamdekan'
-- turadi va dekan tizimga umuman kira olmaydi.
--
-- Eski migratsiya fayllari ataylab o'zgartirilmadi: ular allaqachon
-- qo'llanilgan tarixiy yozuv (qarang 202607280013_repair_edited_migrations)
-- va ularni tahrirlash live baza bilan noaniqlikka olib keladi. Shu sababli
-- rol qiymatini ko'chirish va unga tayanadigan obyektlarni qayta yaratish
-- shu yangi migratsiyada bajariladi.
--
-- Migratsiya idempotent: ikkinchi marta ishlatilsa hech narsani buzmaydi.

-- 1. CHECK constraint avval bo'shatiladi, aks holda UPDATE o'tmaydi.
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;

UPDATE public.staff SET role = 'dekan' WHERE role = 'zamdekan';

ALTER TABLE public.staff
  ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'tarbiyachi', 'dekan'));

-- 2. permit_requests: yagona tirik policy 'zamdekan' literalini ishlatardi.
-- 202607210003 dagi ta'rif aynan takrorlanadi, faqat rol nomi almashtiriladi:
-- admin/tarbiyachi to'liq kirish, dekan esa faqat o'z fakulteti qatorlari.
DROP POLICY IF EXISTS "Active staff manage permit requests" ON public.permit_requests;
CREATE POLICY "Active staff manage permit requests"
ON public.permit_requests FOR ALL TO authenticated
USING (
  public.is_active_staff_role(ARRAY['admin','tarbiyachi'])
  OR EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.id = auth.uid() AND staff.status = 'active' AND staff.role = 'dekan'
      AND lower(staff.faculty) = lower(permit_requests.faculty)
  )
)
WITH CHECK (
  public.is_active_staff_role(ARRAY['admin','tarbiyachi'])
  OR EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.id = auth.uid() AND staff.status = 'active' AND staff.role = 'dekan'
      AND lower(staff.faculty) = lower(permit_requests.faculty)
  )
);

-- 3. arizalar moderatsiya trigger funksiyasi ham rol ro'yxatida 'zamdekan' ni
-- ishlatardi. 202607210003 dagi tanadan farqi faqat shu rol nomida.
CREATE OR REPLACE FUNCTION public.protect_application_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.student_id
     AND NOT public.is_active_staff_role(ARRAY['admin','tarbiyachi','dekan']) THEN
    IF NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.level IS DISTINCT FROM OLD.level
       OR NEW.admin_response IS DISTINCT FROM OLD.admin_response
       OR NEW.response_date IS DISTINCT FROM OLD.response_date
       OR (NEW.status IS DISTINCT FROM OLD.status
           AND NOT (OLD.status = 'draft' AND NEW.status IN ('pending','submitted'))) THEN
      RAISE EXCEPTION 'Moderation fields cannot be changed by a student';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Talaba ro'yxatdan o'tishini to'sadigan trigger xabarida "dekan
-- (zamdekan)" deb yozilgan edi — endi shunchaki "dekan". Mantiq o'zgarmaydi.
CREATE OR REPLACE FUNCTION public.check_student_permit_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'talaba' THEN
    IF NOT EXISTS (
      SELECT 1 FROM permit_requests
      WHERE passport_series = NEW.passport_series
        AND jshshir = NEW.jshshir
        AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Ushbu talabaning yotoqxona yo''llanmasi dekan tomonidan tasdiqlanmagan. Ro''yxatdan o''tish taqiqlanadi!';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 202607280020/22 bilan bir xil qoida: bu funksiyalarni faqat ilovaning
-- o'zi (service_role) va trigger mexanizmi chaqiradi.
REVOKE EXECUTE ON FUNCTION public.protect_application_moderation_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_student_permit_approved() FROM PUBLIC, anon, authenticated;
