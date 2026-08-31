// Shared loading skeletons for every panel (talaba / tarbiyachi / sardor /
// dekan / superadmin). Colour + sheen live in globals.css (`.skeleton`);
// these presets just arrange blocks to echo the real content that will
// replace them, so the wait feels like the page drawing itself in rather
// than a spinner stalling.

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

const surface =
  'rounded-2xl border border-slate-200/70 bg-white/55 dark:border-slate-800 dark:bg-slate-900/40'

/** One shimmering block — size it with height/width utilities. */
export function Skel({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />
}

/** A short stack of text lines, last one narrower. */
export function SkelText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skel key={i} className={cx('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

/** Row of KPI tiles — dashboards and summary bars. */
export function SkelStatGrid({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={cx('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cx(surface, 'p-4')}>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skel className="h-2.5 w-20" />
              <Skel className="h-7 w-16" />
            </div>
            <Skel className="h-11 w-11 rounded-xl" />
          </div>
          <Skel className="mt-3 h-2.5 w-28" />
        </div>
      ))}
    </div>
  )
}

/** Stacked list rows — permit queue, announcements, appeals. */
export function SkelList({
  count = 5,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={cx('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cx(surface, 'flex items-center gap-3 p-4')}>
          <Skel className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skel className="h-3.5 w-1/2" />
            <Skel className="h-2.5 w-3/4" />
          </div>
          <Skel className="hidden h-3 w-16 shrink-0 sm:block" />
        </div>
      ))}
    </div>
  )
}

/** Large content cards — faculty cards on Bosh nazorat. */
export function SkelCards({
  count = 6,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={cx('grid gap-4 lg:grid-cols-2 2xl:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cx('rounded-3xl border border-slate-200/70 bg-white/55 p-5 dark:border-slate-800 dark:bg-slate-900/40', 'space-y-4')}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skel className="h-2.5 w-14" />
              <Skel className="h-4 w-40" />
            </div>
            <Skel className="h-5 w-16 rounded-full" />
          </div>
          <Skel className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skel key={j} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** `<tr>` rows for a table with a fixed column count. */
export function SkelTableRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3.5">
              <Skel className={cx('h-3.5', c === 0 ? 'w-36' : c === cols - 1 ? 'w-14' : 'w-20')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/** A right-hand detail / form panel — stacked label + value rows. */
export function SkelPanel({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx(surface, 'space-y-5 p-5', className)}>
      <div className="flex items-center gap-3">
        <Skel className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skel className="h-3.5 w-2/5" />
          <Skel className="h-2.5 w-3/5" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Skel className="h-3 w-24" />
            <Skel className="h-3 w-32" />
          </div>
        ))}
      </div>
      <Skel className="h-11 w-full rounded-xl" />
    </div>
  )
}

/** Form field stack — label chip + input, repeated. */
export function SkelForm({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <div className={cx('space-y-4', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skel className="h-2.5 w-24" />
          <Skel className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <Skel className="h-11 w-full rounded-xl" />
    </div>
  )
}

/**
 * A whole-page skeleton — page title, a stat row and a content list.
 * The generic in-page fallback while a panel's own data loads.
 */
export function SkelPage({
  stats = 4,
  rows = 5,
  className,
}: {
  stats?: number
  rows?: number
  className?: string
}) {
  return (
    <div className={cx('space-y-6 pb-10', className)}>
      <div className="space-y-2.5">
        <Skel className="h-6 w-52" />
        <Skel className="h-3 w-72 max-w-full" />
      </div>
      <SkelStatGrid count={stats} />
      <SkelList count={rows} />
    </div>
  )
}

/**
 * App-shell skeleton — sidebar rail + top bar + content, for the auth-gate
 * moment before a panel layout has mounted. Deliberately theme-neutral.
 */
export function SkelShell() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex h-14 items-center justify-between border-b border-slate-200/70 px-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Skel className="h-8 w-8 rounded-xl" />
          <Skel className="h-3.5 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skel className="h-8 w-8 rounded-lg" />
          <Skel className="h-8 w-20 rounded-lg" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-6xl gap-6 p-4 md:p-6">
        <div className="hidden w-56 shrink-0 space-y-2 md:block">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skel key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <SkelPage />
        </div>
      </div>
    </div>
  )
}
