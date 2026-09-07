import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300010_dorm6_blocked_building_schema.sql', import.meta.url),
  'utf8',
)

// Comment-free, with every whitespace run (indentation, column-alignment,
// newlines between clauses) flattened to a single space — for the structural
// assertions below, which shouldn't care how the DDL is wrapped.
const ddl = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ')

describe('dorm 6 blocked-building schema foundation (202609300010)', () => {
  it('adds dorms.layout_kind defaulting to simple so existing buildings are unchanged', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS layout_kind text NOT NULL DEFAULT 'simple'/)
    expect(sql).toMatch(/CHECK \(layout_kind IN \('simple', 'blocked'\)\)/)
  })

  it('adds dorms.block_count defaulting to 1 and requires >= 2 only for blocked', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS block_count smallint NOT NULL DEFAULT 1/)
    expect(sql).toMatch(/layout_kind = 'simple'\s+AND block_count = 1/)
    expect(sql).toMatch(/layout_kind = 'blocked' AND block_count >= 2/)
  })

  it('adds a nullable block column to layout, users and permit_requests', () => {
    for (const table of ['floor_room_layout', 'users', 'permit_requests']) {
      expect(ddl).toMatch(new RegExp(`ALTER TABLE public\\.${table} ADD COLUMN IF NOT EXISTS block text;`))
    }
    // the three ALTERs never make it NOT NULL — simple dorms keep block = NULL forever
    expect(ddl).not.toMatch(/ADD COLUMN IF NOT EXISTS block text NOT NULL/)
  })

  it('constrains block to a single uppercase letter everywhere it appears', () => {
    const checks = ddl.match(/block IS NULL OR block ~ '\^\[A-Z\]\$'/g) ?? []
    expect(checks.length).toBe(3) // layout, users, permit_requests
    expect(ddl).toMatch(/block text NOT NULL CHECK \(block ~ '\^\[A-Z\]\$'\)/) // dorm_section
  })

  it('splits the room-number uniqueness into two partial indexes', () => {
    expect(ddl).toMatch(/DROP CONSTRAINT IF EXISTS floor_room_layout_dorm_room_number_key/)
    expect(ddl).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS floor_room_layout_simple_room_key ON public\.floor_room_layout \(dorm_id, room_number\) WHERE block IS NULL/,
    )
    expect(ddl).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS floor_room_layout_blocked_room_key ON public\.floor_room_layout \(dorm_id, block, floor_number, room_number\) WHERE block IS NOT NULL/,
    )
  })

  it('keeps the new search indexes partial so simple dorms pay nothing', () => {
    for (const idx of ['floor_room_layout_block_idx', 'users_block_idx', 'permit_requests_block_idx']) {
      const stmt = ddl.slice(ddl.indexOf(`CREATE INDEX IF NOT EXISTS ${idx}`))
      expect(stmt.slice(0, 240)).toMatch(/WHERE block IS NOT NULL/)
    }
  })

  it('creates dorm_section keyed on (dorm_id, block, floor_number) with no handshake columns', () => {
    const tbl = ddl.slice(
      ddl.indexOf('CREATE TABLE IF NOT EXISTS public.dorm_section'),
      ddl.indexOf('dorm_section_dorm_faculty_idx'),
    )
    expect(tbl).toMatch(/PRIMARY KEY \(dorm_id, block, floor_number\)/)
    expect(tbl).toMatch(/faculty text NOT NULL/)
    expect(tbl).toMatch(/gender text CHECK \(gender IS NULL OR gender IN \('male', 'female'\)\)/)
    expect(tbl).toMatch(/dorm_id uuid NOT NULL REFERENCES public\.dorms\(id\) ON DELETE CASCADE/)
    // centrally managed — no proposal/handshake plumbing (unlike dorm_floor)
    expect(tbl).not.toMatch(/pending_faculty|pending_by|pending_at|confirmed_by/)
  })

  it('turns RLS on for dorm_section with no client-facing policy', () => {
    expect(ddl).toMatch(/ALTER TABLE public\.dorm_section ENABLE ROW LEVEL SECURITY/)
    expect(ddl).not.toMatch(/CREATE POLICY[\s\S]*dorm_section/)
  })

  it('is schema-only — defines no room-assignment or layout function', () => {
    expect(ddl).not.toMatch(
      /FUNCTION public\.(assign_student_room_atomic|assign_permit_room_atomic|approve_permit_room_atomic|replace_floor_room_layout|apply_building_layout)/,
    )
    expect(ddl).not.toMatch(/CREATE (OR REPLACE )?FUNCTION/)
  })
})
