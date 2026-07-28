-- /api/zamdekan/staff's GET returned every admin and tarbiyachi
-- building-wide (email, phone, floor/gender) to any active zamdekan,
-- regardless of who created them or what faculty the zamdekan belongs to.
-- Track who created each staff row so a zamdekan can be scoped to just
-- the tarbiyachi accounts they themselves created, instead of seeing
-- every admin's and every other zamdekan's tarbiyachi roster.
ALTER TABLE staff ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES staff(id) ON DELETE SET NULL;
