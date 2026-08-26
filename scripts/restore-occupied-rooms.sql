-- One-off DATA RESTORE (not a schema migration — do not add to
-- supabase/migrations/). Run once in Supabase Studio SQL Editor.
--
-- floor_room_layout currently has only room "1" — every other room that
-- real students already live in (23 occupied beds across 18 rooms) fell
-- out of the layout table during testing and is now an "orphan": it still
-- shows in the dekan's room map (via the occupants-only fallback), but
-- can't be frozen, and its floor number is only a legacy guess rather
-- than the real admin-declared one.
--
-- This restores all 19 rooms (the existing "1" plus the 18 occupied ones)
-- with a consistent floor/side/position, computed the same way the app's
-- own room generator does: rooms sorted ascending per floor, first half
-- on the left, the rest on the right. Floor numbers here match exactly
-- what the app is already showing for these rooms (same legacy-guess
-- formula, lib/floor.ts's extractFloor: floor((room-1)/30)+1) — this
-- does not change which floor any room appears under, only makes it a
-- real layout entry instead of an inferred one.
--
-- Safe to re-run: ON CONFLICT (room_number) just refreshes floor/side/
-- position/size, never touches frozen state or creates duplicates.
INSERT INTO floor_room_layout (floor_number, room_number, side, position, size) VALUES
  (1, '1',  'left',  0, 'medium'),
  (1, '3',  'left',  1, 'medium'),
  (1, '6',  'left',  2, 'medium'),
  (1, '7',  'left',  3, 'medium'),
  (1, '11', 'right', 0, 'medium'),
  (1, '15', 'right', 1, 'medium'),
  (1, '25', 'right', 2, 'medium'),
  (2, '31', 'left',  0, 'medium'),
  (2, '41', 'left',  1, 'medium'),
  (2, '51', 'right', 0, 'medium'),
  (3, '64', 'left',  0, 'medium'),
  (3, '66', 'left',  1, 'medium'),
  (3, '69', 'left',  2, 'medium'),
  (3, '71', 'right', 0, 'medium'),
  (3, '87', 'right', 1, 'medium'),
  (4, '98', 'left',  0, 'medium'),
  (5, '121', 'left',  0, 'medium'),
  (5, '147', 'left',  1, 'medium'),
  (5, '150', 'right', 0, 'medium')
ON CONFLICT (room_number) DO UPDATE SET
  floor_number = EXCLUDED.floor_number,
  side = EXCLUDED.side,
  position = EXCLUDED.position,
  size = EXCLUDED.size;

-- Keep users.assigned_floor (used for announcement/duty-schedule
-- targeting) in sync with the floor each room now officially sits on —
-- mirrors what repository.ts's syncAssignedFloors does after a normal
-- floor save, just run by hand here since this restore bypasses that path.
UPDATE users SET assigned_floor = 1 WHERE role = 'talaba' AND room_number IN ('1','3','6','7','11','15','25');
UPDATE users SET assigned_floor = 2 WHERE role = 'talaba' AND room_number IN ('31','41','51');
UPDATE users SET assigned_floor = 3 WHERE role = 'talaba' AND room_number IN ('64','66','69','71','87');
UPDATE users SET assigned_floor = 4 WHERE role = 'talaba' AND room_number IN ('98');
UPDATE users SET assigned_floor = 5 WHERE role = 'talaba' AND room_number IN ('121','147','150');
