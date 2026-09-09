import { describe, expect, it } from 'vitest'
import { decideRoomScope } from './repository'

const floors = (owner: string, ...ns: number[]) => ns.map((n) => ({ floor_number: n, faculty: owner }))

describe('decideRoomScope', () => {
  it('sole faculty of an unpartitioned building sees every floor', () => {
    const s = decideRoomScope('amit', floors('amit', 1, 2, 3), [])
    expect(s).toMatchObject({ shared: false, floors: null, grantedToMe: [], grantedAway: [] })
  })

  it('a partitioned building scopes an owner to its own floors', () => {
    const owners = [...floors('amit', 1, 2), ...floors('sport', 3, 4)]
    expect(decideRoomScope('amit', owners, []).floors).toEqual([1, 2])
    expect(decideRoomScope('sport', owners, []).floors).toEqual([3, 4])
  })

  it('a secondary faculty that claimed one floor of a big shared dorm sees only that floor', () => {
    // dorm 7: AMIT is faculty_dorm.is_primary = false and has claimed floor 10
    // of a 12-floor building — it must NOT see the other 11 floors.
    const s = decideRoomScope('amit', floors('amit', 10), [], /* isPrimaryHere */ false)
    expect(s).toMatchObject({ shared: true, floors: [10] })
  })

  it('a GUEST (linked, owns nothing) with no grants sees NOTHING — not the whole dorm', () => {
    // the AMIT ↔ dorm-3 bug: linked via faculty_dorm, ozbek-fil owns all floors, 0 grants
    const s = decideRoomScope('amit', floors('ozbek-filologiyasi', 1, 2, 3, 4, 5), [], false)
    expect(s).toMatchObject({ shared: true, floors: [] })
  })

  it('a guest sees exactly the rooms granted to it', () => {
    const s = decideRoomScope('amit', floors('ozbek-filologiyasi', 1, 2), [
      { room_number: '10', faculty: 'amit' },
      { room_number: '11', faculty: 'amit' },
      { room_number: '12', faculty: 'sport' },
    ], false)
    expect(s.floors).toEqual([])
    expect(s.grantedToMe).toEqual(['10', '11'])
    expect(s.grantedAway).toEqual(['12'])
  })

  it('the building owner keeps every floor but loses the rooms granted away', () => {
    const s = decideRoomScope('ozbek-filologiyasi', floors('ozbek-filologiyasi', 1, 2), [
      { room_number: '10', faculty: 'amit' },
    ])
    expect(s).toMatchObject({ shared: true, floors: null, grantedAway: ['10'], grantedToMe: [] })
  })

  it('an unclaimed building (no dorm_floor rows) is not shared', () => {
    expect(decideRoomScope('amit', [], [])).toMatchObject({ shared: false, floors: null })
  })
})
