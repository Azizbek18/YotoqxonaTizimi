import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./202609000000_remove_test_students.sql', import.meta.url), 'utf8')

describe('remove test students (202609000000)', () => {
  it('runs before the faculty rescoping so the room filter still matches', () => {
    // Filename must sort before 202609010000 (canonicalization) and
    // 202609030000 (room clearing).
    expect('202609000000' < '202609010000').toBe(true)
    expect('202609000000' < '202609030000').toBe(true)
  })

  it('deletes children before public.users before auth.users (FK has no cascade on prod)', () => {
    const order = ['public.arizalar', 'public.tolovlar', 'public.profiles', 'public.users', 'auth.users']
      .map((t) => sql.indexOf(`DELETE FROM ${t}`))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(order.every((i) => i > -1)).toBe(true)
  })

  it('targets only non-AMIT students who hold a room', () => {
    expect(sql).toMatch(/room_number IS NOT NULL/)
    expect(sql).toMatch(/lower\(trim\(coalesce\(faculty, 'amit'\)\)\) <> 'amit'/)
  })

  it('is a temp table dropped on commit (idempotent, no leftover)', () => {
    expect(sql).toContain('CREATE TEMP TABLE _del_test_students ON COMMIT DROP')
  })
})
