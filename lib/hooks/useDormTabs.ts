'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchDekanDorm } from '@/features/dorms/client/api'
import type { DekanDorm } from '@/features/dorms/types'
import { useDekanScope } from '@/lib/hooks/useDekanScope'

/** Building selection is unresolved until the faculty's own links load. */
export function useDormTabs({ globalView = false }: { globalView?: boolean } = {}) {
  const { effectiveFaculty: faculty, role, scope, resolved } = useDekanScope()
  const global = globalView && resolved && role === 'admin' && (!scope || scope === '*')
  const enabled = resolved && !global
  const [state, setState] = useState<{
    faculty: string | null
    dorms: DekanDorm[]
    selected: string | null | undefined
    error: string | null
  }>({ faculty: null, dorms: [], selected: undefined, error: null })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setState({ faculty, dorms: [], selected: undefined, error: null })
    fetchDekanDorm().then(({ dorms }) => {
      if (cancelled) return
      const wanted = new URLSearchParams(window.location.search).get('dormId')
      const selected = wanted === 'unassigned' ? null
        : dorms.find((dorm) => dorm.dormId === wanted)?.dormId
          ?? dorms.find((dorm) => dorm.isPrimary)?.dormId
          ?? dorms[0]?.dormId ?? null
      setState({ faculty, dorms, selected, error: null })
    }).catch((error: unknown) => {
      if (!cancelled) setState({ faculty, dorms: [], selected: undefined,
        error: error instanceof Error ? error.message : 'Yotoqxonalarni yuklab bo‘lmadi' })
    })
    return () => { cancelled = true }
  }, [enabled, faculty, retry])

  const ready = enabled && state.faculty === faculty && state.selected !== undefined && !state.error
  const select = useCallback((selected: string | null) => {
    setState((prev) => selected === null || prev.dorms.some((dorm) => dorm.dormId === selected)
      ? { ...prev, selected } : prev)
  }, [])
  return {
    global,
    enabled,
    ready,
    dorms: state.faculty === faculty ? state.dorms : [],
    dormId: ready ? state.selected : undefined,
    activeDorm: ready ? state.dorms.find((dorm) => dorm.dormId === state.selected) : undefined,
    error: state.faculty === faculty ? state.error : null,
    select,
    reload: () => setRetry((value) => value + 1),
  }
}
