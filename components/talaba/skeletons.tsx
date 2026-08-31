// Per-page loading skeletons for the talaba panel. Each one echoes the
// real layout of its screen so the wait reads as "this page drawing
// itself in", not one generic placeholder reused everywhere.
//
// Colour + sheen come from globals.css (`.skeleton`); `Skel` is a plain
// themed block.

import { Skel, SkelText } from '@/components/ui/skeletons'

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

const card = 'rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/40'
const cardLg = 'rounded-[28px] border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/40'

function PageTitle({ wide = 'w-56' }: { wide?: string }) {
  return (
    <div className="space-y-2.5">
      <Skel className="h-2.5 w-28" />
      <Skel className={cx('h-7', wide)} />
      <Skel className="h-3 w-72 max-w-full" />
    </div>
  )
}

function StatCard() {
  return (
    <div className={cx(card, 'space-y-3 p-4')}>
      <Skel className="h-2.5 w-16" />
      <Skel className="h-7 w-14" />
    </div>
  )
}

/* ── Dashboard: header + banner + 4/8 two-column grid ─────────────── */
export function TalabaDashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-2 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle wide="w-48" />
        <Skel className="h-11 w-full max-w-xs rounded-xl" />
      </div>

      <Skel className="h-20 w-full rounded-[28px]" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <Skel className="h-52 w-full rounded-[28px]" />
          <Skel className="h-40 w-full rounded-[28px]" />
          <Skel className="h-40 w-full rounded-[28px]" />
        </div>
        <div className="space-y-6 lg:col-span-8">
          <Skel className="h-24 w-full rounded-[32px]" />
          <div className={cx(cardLg, 'space-y-4 p-5')}>
            <Skel className="h-5 w-40" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skel className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skel className="h-3.5 w-1/2" />
                  <Skel className="h-2.5 w-3/4" />
                </div>
              </div>
            ))}
          </div>
          <Skel className="h-44 w-full rounded-[28px]" />
        </div>
      </div>
    </div>
  )
}

/* ── Profil: header row + passport hero + stat row + info panels ──── */
export function TalabaProfilSkeleton() {
  return (
    <div className="w-full space-y-6 py-4">
      <div className="flex items-center justify-between border-b border-slate-200/70 pb-5 dark:border-white/5">
        <div className="space-y-2">
          <Skel className="h-4 w-24 rounded-full" />
          <Skel className="h-8 w-52" />
        </div>
        <Skel className="h-9 w-24 rounded-xl" />
      </div>

      <div className={cx('rounded-[36px] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900/40 sm:p-8')}>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Skel className="h-24 w-24 shrink-0 rounded-[32px] sm:h-28 sm:w-28" />
          <div className="w-full flex-1 space-y-3 text-center sm:text-left">
            <Skel className="mx-auto h-6 w-48 sm:mx-0" />
            <Skel className="mx-auto h-3 w-40 sm:mx-0" />
            <Skel className="mx-auto h-3 w-32 sm:mx-0" />
            <Skel className="mx-auto h-8 w-28 rounded-full sm:mx-0" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cx(card, 'space-y-3 p-5')}>
            <Skel className="h-9 w-9 rounded-xl" />
            <Skel className="h-6 w-16" />
            <Skel className="h-2.5 w-20" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={cx(card, 'space-y-4 p-5')}>
            <Skel className="h-4 w-28" />
            <SkelText lines={4} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── To'lova: header + 4 summary cards + 2-col plates + history ───── */
export function TalabaTolovaSkeleton() {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <PageTitle wide="w-44" />
        <Skel className="h-11 w-40 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard />
        <StatCard />
        <StatCard />
        <div className={cx(card, 'flex items-center justify-center p-4')}>
          <Skel className="h-24 w-24 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={cx(cardLg, 'space-y-4 p-5')}>
          <Skel className="h-4 w-32" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skel key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
        <div className={cx(cardLg, 'space-y-4 p-5')}>
          <Skel className="h-4 w-40" />
          <Skel className="h-11 w-full rounded-xl" />
          <Skel className="h-40 w-full rounded-2xl" />
          <Skel className="h-11 w-full rounded-xl" />
        </div>
      </div>

      <div className={cx(cardLg, 'space-y-3 p-5')}>
        <Skel className="h-4 w-44" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skel className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skel className="h-3.5 w-1/3" />
              <Skel className="h-2.5 w-1/2" />
            </div>
            <Skel className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Navbat: header + captain/admins + weekly 7-cell grid ────────── */
export function TalabaNavbatSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pt-4">
      <div className="flex items-center gap-3.5 border-b border-slate-200/70 pb-3 dark:border-white/5">
        <Skel className="h-12 w-12 shrink-0 rounded-2xl" />
        <div className="space-y-2">
          <Skel className="h-4 w-40 rounded-full" />
          <Skel className="h-3 w-28" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={cx(card, 'flex items-center gap-3 p-4')}>
          <Skel className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skel className="h-3.5 w-2/3" />
            <Skel className="h-2.5 w-1/2" />
          </div>
        </div>
        <div className={cx(card, 'space-y-3 p-4')}>
          <Skel className="h-3 w-24" />
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <Skel key={i} className="h-10 flex-1 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      <div className={cx(cardLg, 'p-4')}>
        <Skel className="mb-4 h-4 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-slate-200/70 p-3 dark:border-white/5">
              <Skel className="h-2.5 w-10" />
              <Skel className="h-12 w-full rounded-xl" />
              <Skel className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Qoidalar: header + gauge/details 3-col + accordion list ─────── */
export function TalabaQoidalarSkeleton() {
  return (
    <div className="space-y-6 pb-12">
      <PageTitle wide="w-40" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={cx(cardLg, 'flex items-center justify-center p-6')}>
          <Skel className="h-40 w-40 rounded-full" />
        </div>
        <div className={cx(cardLg, 'space-y-4 p-6 lg:col-span-2')}>
          <Skel className="h-4 w-36" />
          <SkelText lines={3} />
          <div className="grid grid-cols-2 gap-3">
            <Skel className="h-16 rounded-xl" />
            <Skel className="h-16 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cx(card, 'flex items-center gap-3 p-4')}>
            <Skel className="h-10 w-10 shrink-0 rounded-xl" />
            <Skel className="h-3.5 w-1/3" />
            <Skel className="ml-auto h-4 w-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── E'lonlar: just the notices list (renders inside a column) ───── */
export function TalabaElonlarSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cx(cardLg, 'space-y-3 p-5')}>
          <div className="flex items-center gap-2">
            <Skel className="h-5 w-20 rounded-full" />
            <Skel className="h-2.5 w-24" />
          </div>
          <Skel className="h-4 w-3/4" />
          <SkelText lines={2} />
        </div>
      ))}
    </div>
  )
}

/* ── Arizalar: header + 4 stat cards + create panel + list ──────── */
export function TalabaArizalarSkeleton() {
  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <Skel className="h-8 w-64 max-w-full" />
        <Skel className="h-3 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cx(card, 'space-y-2 p-3 sm:p-4')}>
            <Skel className="h-2.5 w-14" />
            <Skel className="h-6 w-10" />
          </div>
        ))}
      </div>

      <div className={cx(card, 'space-y-3 p-4 sm:p-6')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skel className="h-4 w-40" />
          <Skel className="h-9 w-32 rounded-xl" />
        </div>
        <Skel className="h-11 w-full rounded-xl" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cx(card, 'flex items-center gap-3 p-4')}>
            <Skel className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skel className="h-3.5 w-1/2" />
              <Skel className="h-2.5 w-2/3" />
            </div>
            <Skel className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
