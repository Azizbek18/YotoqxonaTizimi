import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(path.join(process.cwd(), 'app/dekan/xonalar/page.tsx'), 'utf8')

describe('room occupant loading', () => {
  it('waits for the primary dorm before loading and filtering occupants', () => {
    expect(source).toContain('const [dormsLoaded, setDormsLoaded] = useState(false)')
    expect(source).toMatch(/\.finally\(\(\) => setDormsLoaded\(true\)\)/)
    expect(source).toMatch(/if \(!dormsLoaded\) return\s+fetchRoomsData\(\)/)
    expect(source).toContain('}, [activeDormId, primaryDormId, dormsLoaded])')
  })
})
