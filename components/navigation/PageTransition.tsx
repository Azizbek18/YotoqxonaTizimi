'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const container = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced || !container.current?.animate) return
    const animation = container.current.animate(
      [{ opacity: 0.92 }, { opacity: 1 }],
      { duration: 140, easing: 'ease-out' },
    )
    return () => animation.cancel()
  }, [pathname, reduced])

  // Never key the route subtree or wait for an exit animation: that remounts
  // pages/loading boundaries and postpones display on slower WebViews.
  return <div ref={container} data-page-transition>{children}</div>
}
