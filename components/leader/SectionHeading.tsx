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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-lg font-black tracking-tight text-white">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  )
}
