'use client'

import { useThemeStore } from '@/lib/stores/theme-store'

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

// [x, y, animation-delay] — windows light up from the ground floor up.
const WINDOWS: Array<[number, number, number]> = [
  [24, 78, 0], [60, 78, 0.12],
  [24, 61, 0.3], [60, 61, 0.42],
  [24, 44, 0.6], [60, 44, 0.72],
]

/** The animated dormitory mark — drop it anywhere a spinner would go. */
export function Loader({ size = 120, className }: { size?: number; className?: string }) {
  const isLight = useThemeStore((state) => state.theme === 'light')
  return (
    <div
      className={cx('brand-loader', className)}
      style={{ ['--loader-size' as string]: `${size}px` }}
      role="status"
      aria-label="Yuklanmoqda"
    >
      <span className="brand-loader__halo" aria-hidden />
      <span className="brand-loader__aura" aria-hidden />
      <span className="brand-loader__spark" aria-hidden />
      <div className="brand-loader__float">
        <svg viewBox="0 0 100 114" width="62%" className={isLight ? 'text-slate-700' : 'text-slate-100'}>
          <path
            d="M7 47 L50 10 L93 47"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <rect
            className="brand-loader__outline"
            x="15"
            y="47"
            width="70"
            height="58"
            rx="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            d="M41 105 V84 a9 9 0 0 1 18 0 V105"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {WINDOWS.map(([x, y, delay], i) => (
            <rect
              key={i}
              className="brand-loader__win"
              x={x}
              y={y}
              width="16"
              height="12"
              rx="2.5"
              fill="url(#brandLoaderWindow)"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
          <defs>
            <linearGradient id="brandLoaderWindow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#818cf8" />
              <stop offset="1" stopColor="#c084fc" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
}

/** Centered full-area loader with a caption — for route `loading.tsx`,
 *  Suspense fallbacks and auth gates. */
export function LoaderScreen({
  label = 'Yuklanmoqda…',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div className={cx('flex min-h-[70vh] w-full flex-col items-center justify-center gap-6', className)}>
      <Loader size={132} />
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </div>
  )
}
