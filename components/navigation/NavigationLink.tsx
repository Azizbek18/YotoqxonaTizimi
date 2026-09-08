'use client'

import Link, { useLinkStatus } from 'next/link'
import type { ComponentProps } from 'react'

function PendingFeedback() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span role="status" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-current/10" data-navigation-pending>
      <span className="sr-only">Sahifa yuklanmoqda</span>
      <span aria-hidden="true" className="absolute bottom-0 left-1/4 h-0.5 w-1/2 rounded-full bg-current" />
    </span>
  )
}

// Next's pending state follows the real transition, including cancellation
// and rapid repeated taps. Keep automatic loading-boundary prefetching.
export default function NavigationLink({ children, className = '', ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={`relative ${className}`}>
      {children}
      <PendingFeedback />
    </Link>
  )
}
