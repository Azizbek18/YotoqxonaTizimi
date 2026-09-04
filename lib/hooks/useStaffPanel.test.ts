import { describe, expect, it, vi } from 'vitest'

let pathname = '/dekan/xonalar'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

import { useStaffPanel } from './useStaffPanel'

// useStaffPanel is a pure derivation of usePathname() (no React state), so it
// can be exercised directly.
describe('useStaffPanel', () => {
  it('is a no-op inside the dekan panel — everything allowed', () => {
    pathname = '/dekan/xonalar'
    expect(useStaffPanel()).toMatchObject({
      base: '/dekan',
      isTarbiyachi: false,
      readOnly: false,
      canDeleteArizalar: true,
      canManageAnyAnnouncement: true,
    })
  })

  it('locks down mutations inside the tarbiyachi panel, keeps ariza moderation', () => {
    pathname = '/tarbiyachi/xonalar'
    expect(useStaffPanel()).toMatchObject({
      base: '/tarbiyachi',
      isTarbiyachi: true,
      readOnly: true,
      canModerateArizalar: true,
      canDeleteArizalar: false,
      canManageAnyAnnouncement: false,
    })
  })

  it('treats a re-exported admin page under /tarbiyachi as the tarbiyachi panel', () => {
    pathname = '/tarbiyachi/arizalar'
    const panel = useStaffPanel()
    expect(panel.isTarbiyachi).toBe(true)
    expect(panel.base).toBe('/tarbiyachi')
  })
})
