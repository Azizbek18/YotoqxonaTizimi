'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ZamdekanScope {
  faculty: string | null
  fullName: string | null
  resolved: boolean
}

/**
 * Resolves the signed-in zamdekan's own `staff.faculty`/`full_name` once per
 * mount. Callers that need to poll faculty-scoped data (e.g. permit_requests)
 * should depend on `resolved`/`faculty` from this hook instead of re-running
 * their own auth.getUser()+staff lookup on every poll tick.
 */
export function useZamdekanScope(): ZamdekanScope {
  const [faculty, setFaculty] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: staffRow } = await supabase
          .from('staff')
          .select('full_name, faculty')
          .eq('id', user.id)
          .maybeSingle()

        if (!cancelled) {
          setFaculty(staffRow?.faculty ?? null)
          setFullName(staffRow?.full_name ?? null)
        }
      } catch (err) {
        console.error('Error resolving zamdekan scope:', err)
      } finally {
        if (!cancelled) setResolved(true)
      }
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [])

  return { faculty, fullName, resolved }
}
