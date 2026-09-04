import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300001_faculty_dorm_primary_scalar_fix.sql', import.meta.url),
  'utf8',
)

// 202609300000 lifted faculty_dorm's PK to (faculty, dorm_id) — a faculty can
// now have more than one row. Every RPC that resolves "the" dorm for a
// faculty via a bare scalar subquery (`SELECT dorm_id FROM faculty_dorm
// WHERE faculty = X`) would then raise "more than one row returned by a
// subquery" the instant a faculty gains a second dorm. This migration adds
// `AND is_primary` to every one of them — this test makes sure none are
// missed and none regress back to the bare form.
describe('faculty_dorm primary scalar fix (202609300001)', () => {
  const FUNCTIONS = [
    'assign_student_room_atomic',
    'assign_permit_room_atomic',
    'approve_permit_room_atomic',
    'replace_floor_room_layout',
    'apply_building_layout',
  ]

  it('redefines all five room RPCs that resolve a faculty→dorm scalar', () => {
    for (const fn of FUNCTIONS) {
      expect(sql).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`))
    }
  })

  it('every faculty_dorm scalar lookup is now filtered to is_primary', () => {
    // Any `FROM faculty_dorm WHERE faculty = ...` (optionally table-aliased,
    // optionally schema-qualified) must be immediately followed by an
    // is_primary filter before the next clause boundary (`)`, `;` or a new
    // SELECT/AND that isn't part of the same WHERE).
    const lookups = sql.match(/FROM (public\.)?faculty_dorm(?: \w+)? WHERE [\s\S]{0,80}?(?=\)|;)/g) ?? []
    expect(lookups.length).toBeGreaterThanOrEqual(FUNCTIONS.length)
    for (const lookup of lookups) {
      expect(lookup).toMatch(/is_primary/)
    }
  })

  it('keeps the room-numbers-unique-per-dorm scoping intact (dorm_id-keyed queries untouched)', () => {
    // Sanity: the advisory-lock key and occupancy predicates still hash on
    // dorm_id, not faculty — this migration must not touch that half.
    expect(sql).toMatch(/hashtext\(v_dorm_id::text \|\| ':' \|\| p_room_number\)/)
  })
})
