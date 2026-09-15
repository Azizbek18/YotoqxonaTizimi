'use client'

import type { LucideIcon } from 'lucide-react'

/** One glass stat pill in the header's stat strip — icon, number, label. */
export default function StatChip({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon
  value: string | number
  label: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 backdrop-blur-xl">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/70">
        <Icon size={15} />
      </div>
      <div className="min-w-0 leading-none">
        <p className="text-base font-black tracking-tight text-white">{value}</p>
        <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      </div>
    </div>
  )
}
