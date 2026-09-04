'use client'

import { usePathname } from 'next/navigation'

export interface StaffPanel {
  /** Route prefix of the panel currently rendering the shared component —
   *  use it for in-panel `Link` hrefs so a page re-exported under
   *  `/tarbiyachi/*` links within its own panel, not back to `/dekan/*`. */
  base: '/dekan' | '/tarbiyachi'
  /** True when the shared dekan component is being viewed inside the
   *  tarbiyachi panel. */
  isTarbiyachi: boolean
  /** Hide every data-mutating affordance: room map, 3D builder, student
   *  records, dashboard, reports, settings are all view-only for a
   *  tarbiyachi. */
  readOnly: boolean
  /** A tarbiyachi may still decide (approve / reject) a pending student
   *  application — both panels can. */
  canModerateArizalar: boolean
  /** Deleting an application is dekan/admin only. */
  canDeleteArizalar: boolean
  /** Editing / deleting an announcement authored by someone else is
   *  dekan/admin only; a tarbiyachi manages only their own. */
  canManageAnyAnnouncement: boolean
}

/**
 * Which staff panel a shared dekan/admin page component is rendering in,
 * and what the viewer is allowed to change there. Derived from the URL so
 * it works inside the one-line re-export pages under `/tarbiyachi/*`
 * without any provider. A no-op (`/dekan`, everything allowed) whenever the
 * path is not the tarbiyachi panel, so the dekan panel is untouched.
 */
export function useStaffPanel(): StaffPanel {
  const pathname = usePathname()
  const isTarbiyachi = pathname.startsWith('/tarbiyachi')
  return {
    base: isTarbiyachi ? '/tarbiyachi' : '/dekan',
    isTarbiyachi,
    readOnly: isTarbiyachi,
    canModerateArizalar: true,
    canDeleteArizalar: !isTarbiyachi,
    canManageAnyAnnouncement: !isTarbiyachi,
  }
}
