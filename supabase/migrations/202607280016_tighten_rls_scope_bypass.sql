-- 202607210003 granted broad, unscoped RLS access to active staff on
-- `users` and `arizalar` as a defense-in-depth layer. In practice this
-- became the opposite: every real read/write in this app goes through
-- server Route Handlers (service-role client, which bypasses RLS and does
-- its own faculty/floor/gender scoping — see server/auth/tarbiyachi.ts,
-- features/permits/server/service.ts, features/room-assignment). No
-- frontend code anywhere queries `users` or `arizalar` directly with the
-- browser's anon-key + session client (verified: no `.tsx`/client `.ts`
-- file calls supabase.from('users'|'arizalar')). That means these RLS
-- grants are pure bypass surface: a signed-in tarbiyachi or zamdekan can
-- open the browser console and query the Supabase REST API directly with
-- their own session to read every student's passport/JShSHIR/phone/family
-- details building-wide (not just their own floor/faculty), or have a
-- zamdekan write arbitrary columns on any of their faculty's students
-- (not just what the room-assignment endpoint allows), with none of the
-- server-side scoping ever running.
--
-- Drop the staff-facing grants entirely; the correctly-scoped API routes
-- remain the only path. Students' own-row access (auth.uid() = id /
-- student_id, added in 202607210000 and never removed here) is untouched —
-- it's correctly scoped already and not what's exploitable.
DROP POLICY IF EXISTS "Active staff can view students" ON public.users;
DROP POLICY IF EXISTS "Zamdekan can update faculty students" ON public.users;

DROP POLICY IF EXISTS "Users can view relevant applications" ON public.arizalar;
CREATE POLICY "Users can view relevant applications"
ON public.arizalar FOR SELECT TO authenticated
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Users can update relevant applications" ON public.arizalar;
CREATE POLICY "Users can update relevant applications"
ON public.arizalar FOR UPDATE TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);
