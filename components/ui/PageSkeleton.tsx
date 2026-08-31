import { Skel, SkelStatGrid, SkelList } from '@/components/ui/skeletons'

/**
 * The in-page fallback a talaba screen shows while its own data loads
 * (route-transition waits use the branded Loader via `loading.tsx`).
 * Pure skeleton — a hero strip, a stat row and a content list drawing
 * themselves in.
 */
export default function PageSkeleton() {
  return (
    <div className="space-y-6 pb-12">
      {/* Hero / page header */}
      <div className="rounded-3xl border border-slate-200/70 bg-white/55 p-6 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2.5">
            <Skel className="h-6 w-48" />
            <Skel className="h-3 w-64 max-w-full" />
          </div>
          <Skel className="h-11 w-32 rounded-xl" />
        </div>
      </div>

      <SkelStatGrid count={3} />
      <SkelList count={4} />
    </div>
  )
}
