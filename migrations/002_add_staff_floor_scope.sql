ALTER TABLE staff
ADD COLUMN IF NOT EXISTS assigned_floor integer,
ADD COLUMN IF NOT EXISTS assigned_gender text;
