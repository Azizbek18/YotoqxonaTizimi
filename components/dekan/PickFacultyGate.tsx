'use client'

import { Layers3 } from 'lucide-react'
import { PERMIT_FACULTIES } from '@/lib/faculties'
import { setSuperadminScope } from '@/lib/superadmin-scope'
import { dekanUI } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'

/**
 * Shown on single-faculty pages (room map, 3D builder, per-faculty settings)
 * when a superadmin is in global scope — those pages need exactly one
 * faculty to act on. Picking one sets the sa_scope cookie and reloads the
 * page already scoped.
 */
export default function PickFacultyGate({ title }: { title: string }) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  return (
    <div className={`mx-auto max-w-lg rounded-3xl border p-6 sm:p-8 text-center ${ui.card}`}>
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${ui.accentTile}`}>
        <Layers3 size={22} />
      </div>
      <h2 className={`mt-4 text-lg font-black ${ui.strong}`}>{title}</h2>
      <p className={`mt-1.5 text-xs leading-relaxed ${ui.muted}`}>
        Bu bo&apos;lim bitta fakultet bilan ishlaydi. Qaysi fakultet nomidan davom
        etasiz? Keyin sidebar&apos;dan istalgan vaqt almashtirasiz.
      </p>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PERMIT_FACULTIES.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setSuperadminScope(f.value)
              window.location.reload()
            }}
            className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${ui.btnGhost}`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}
