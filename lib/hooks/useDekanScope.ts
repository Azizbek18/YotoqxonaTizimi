'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GLOBAL_SCOPE, readSuperadminScope } from '@/lib/superadmin-scope'

export interface DekanScope {
  /** The signed-in staff member's own bound `staff.faculty`. */
  faculty: string | null
  /** The faculty currently being acted on: the picked scope for a
   *  superadmin working inside one faculty, otherwise `faculty`. Use this
   *  for anything shown to the user ("X fakulteti bo'yicha…"). */
  effectiveFaculty: string | null
  fullName: string | null
  /** 'dekan' | 'admin' — an admin rides this panel and gets the extra
   *  superadmin (dorm management) surface. */
  role: string | null
  /**
   * For an `admin` (superadmin): the acting scope from the sa_scope cookie —
   * `*` (global / cross-faculty) or a faculty code. Always `*` for a plain
   * dekan (their own faculty is `faculty`).
   */
  scope: string
  resolved: boolean
}

/**
 * Resolves the signed-in dekan's own `staff.faculty`/`full_name` once per
 * mount. Callers that need to poll faculty-scoped data (e.g. permit_requests)
 * should depend on `resolved`/`faculty` from this hook instead of re-running
 * their own auth.getUser()+staff lookup on every poll tick.
 */
export function useDekanScope(): DekanScope {
  const [faculty, setFaculty] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [scope, setScope] = useState<string>(GLOBAL_SCOPE)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    setScope(readSuperadminScope())
  }, [])

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: staffRow } = await supabase
          .from('staff')
          .select('full_name, faculty, role')
          .eq('id', user.id)
          .maybeSingle()

        if (!cancelled) {
          setFaculty(staffRow?.faculty ?? null)
          setFullName(staffRow?.full_name ?? null)
          setRole(staffRow?.role ?? null)
        }
      } catch (err) {
        console.error('Error resolving dekan scope:', err)
      } finally {
        if (!cancelled) setResolved(true)
      }
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [])

  const effectiveFaculty = role === 'admin' && scope && scope !== GLOBAL_SCOPE ? scope : faculty

  return { faculty, effectiveFaculty, fullName, role, scope, resolved }
}
