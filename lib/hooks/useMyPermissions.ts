'use client'

import { useEffect, useState } from 'react'
import { can, type PermissionKey, type PermissionMap } from '@/features/permissions/types'

type State = {
  /** null while loading — callers should not hide anything yet. */
  permissions: PermissionMap | null
  allows: (key: PermissionKey) => boolean
}

/**
 * The signed-in staff member's own revoked permissions, for hiding menu
 * entries the dekan closed.
 *
 * `allows` answers true while the request is still in flight and if it fails:
 * a slow or broken permissions call must never blank out a working panel —
 * the server is the real gate, this only tidies the UI.
 */
export function useMyPermissions(): State {
  const [permissions, setPermissions] = useState<PermissionMap | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/staff/my-permissions', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.permissions === 'object') {
          setPermissions(data.permissions as PermissionMap)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return {
    permissions,
    allows: (key) => (permissions === null ? true : can(permissions, key)),
  }
}
