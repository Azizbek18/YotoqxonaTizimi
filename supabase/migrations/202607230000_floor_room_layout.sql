-- Admin-authored floor room layouts for the 3D xonalar builder.
-- Replaces the old blueprint-image-upload flow, which never actually
-- analyzed the uploaded image (fixed 6-room fake output per floor).

CREATE TABLE IF NOT EXISTS floor_room_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_number int NOT NULL,
  room_number text NOT NULL,
  side text NOT NULL CHECK (side IN ('left', 'right')),
  position int NOT NULL,
  size text NOT NULL DEFAULT 'medium' CHECK (size IN ('small', 'medium', 'large')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_number)
);

CREATE INDEX IF NOT EXISTS floor_room_layout_floor_idx ON floor_room_layout (floor_number, side, position);

ALTER TABLE floor_room_layout ENABLE ROW LEVEL SECURITY;

-- No client-facing policies: only the service-role key (admin API routes)
-- reads/writes this table, matching how staff/admin-only tables are handled
-- elsewhere in this schema.
