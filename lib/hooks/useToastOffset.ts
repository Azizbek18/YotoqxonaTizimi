'use client'

import { useEffect } from 'react'

/**
 * Pages with a fixed/sticky top header set this so the global toast
 * container (see AppProviders) renders below the header instead of
 * overlapping it. Resets to the default offset on unmount.
 */
export function useToastOffset(offsetPx: number) {
  useEffect(() => {
    document.documentElement.style.setProperty('--toast-offset-top', `${offsetPx}px`)
    return () => {
      document.documentElement.style.removeProperty('--toast-offset-top')
    }
  }, [offsetPx])
}
