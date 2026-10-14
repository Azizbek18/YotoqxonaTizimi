'use client'

import type { ReactNode } from 'react'

/** Title + one-line description + optional trailing action — the header
 *  every tab panel in both dashboards opens with. */
export default function SectionHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5 min-[360px]:gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-base font-black tracking-tight text-white sm:text-lg">{title}</h3>
        {description && <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-400">{description}</p>}
      </div>
      {action && <div className="min-w-0 shrink-0">{action}</div>}
    </div>
  )
}
