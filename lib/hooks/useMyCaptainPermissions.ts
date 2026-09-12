'use client'

import { useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/auth-session'
import { can, type PermissionKey, type PermissionMap } from '@/features/permissions/types'

type State = {
  /** null while loading — callers should not hide anything yet. */
  permissions: PermissionMap | null
  allows: (key: PermissionKey) => boolean
}

/**
 * The signed-in floor captain's own revoked permissions — the sardor-panel
 * counterpart of `useMyPermissions` (which only covers `staff` rows and
 * therefore can't see a captain, who is a `talaba`).
 *
 * `allows` answers true while the request is in flight and if it fails: the
 * server is the real gate, this only tidies the UI so a slow connection
 * never blanks out a working panel.
 */
export function useMyCaptainPermissions(): State {
  const [permissions, setPermissions] = useState<PermissionMap | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch('/api/sardor/my-permissions', { headers, cache: 'no-store' })
        const data = res.ok ? await res.json() : null
        if (!cancelled && data && typeof data.permissions === 'object') {
          setPermissions(data.permissions as PermissionMap)
        }
      } catch {
        // background load — stay quiet on a transient failure
      }
    })()
    return () => { cancelled = true }
  }, [])

  return {
    permissions,
    allows: (key) => (permissions === null ? true : can(permissions, key)),
  }
}
