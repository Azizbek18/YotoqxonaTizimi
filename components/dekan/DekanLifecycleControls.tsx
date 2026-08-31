'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftRight, Loader2, Power, PowerOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { PERMIT_FACULTIES } from '@/lib/faculties'
import { dekanUI } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'
import CustomSelect from '@/components/ui/CustomSelect'
import { updateDekanAccount } from '@/features/superadmin-dekans/client/api'
import type { SuperadminDekan } from '@/features/superadmin-dekans/types'

/**
 * Superadmin dean lifecycle — deactivate / reactivate a dean account, or
 * move it to another faculty. Reassign and reactivate both refuse a faculty
 * that already has an active dean (the server checks too).
 */
export default function DekanLifecycleControls({
  dekan,
  currentFaculty,
  coveredFaculties,
  onChanged,
}: {
  dekan: SuperadminDekan
  currentFaculty: string
  coveredFaculties: Set<string>
  onChanged: () => void
}) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)
  const active = dekan.status === 'active'

  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'none' | 'confirm-off' | 'reassign'>('none')
  const [target, setTarget] = useState('')

  const reassignOptions = useMemo(
    () =>
      PERMIT_FACULTIES.filter(
        (f) => f.value !== currentFaculty && !coveredFaculties.has(f.value),
      ),
    [currentFaculty, coveredFaculties],
  )

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      setMode('none')
      setTarget('')
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Amalni bajarib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`mt-3 border-t pt-3 ${ui.border}`}>
      {mode === 'confirm-off' ? (
        <div className="space-y-2">
          <p className={`text-[11px] ${ui.body}`}>
            <span className="font-bold">{dekan.fullName}</span> hisobi faolsizlantiriladi —
            u panelга kira olmaydi. Davom etamizmi?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => updateDekanAccount({ id: dekan.id, action: 'deactivate' }), 'Faolsizlantirildi')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <PowerOff size={12} />} Ha, faolsizlantir
            </button>
            <button type="button" onClick={() => setMode('none')} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${ui.btnGhost}`}>
              Bekor
            </button>
          </div>
        </div>
      ) : mode === 'reassign' ? (
        <div className="space-y-2">
          <label className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
            Qaysi fakultetга ko‘chirilsin?
          </label>
          <CustomSelect
            value={target}
            onChange={setTarget}
            placeholder="— tanlang —"
            className={`w-full rounded-lg border px-2.5 py-2 text-xs ${ui.input} ${ui.ring}`}
            options={reassignOptions.map((f) => ({ value: f.value, label: f.label }))}
            emptyText="Ko‘chirish uchun fakultet yo‘q"
          />
          {reassignOptions.length === 0 && (
            <p className={`text-[11px] ${ui.muted}`}>Barcha boshqa fakultetда faol dekan bor.</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !target}
              onClick={() => run(() => updateDekanAccount({ id: dekan.id, action: 'reassign', faculty: target }), 'Fakultet o‘zgartirildi')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold disabled:opacity-50 ${ui.accentSolid}`}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeftRight size={12} />} Ko‘chirish
            </button>
            <button type="button" onClick={() => setMode('none')} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${ui.btnGhost}`}>
              Bekor
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {active ? (
            <button
              type="button"
              onClick={() => setMode('confirm-off')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold ${ui.btnGhost}`}
            >
              <PowerOff size={12} /> Faolsizlantirish
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => updateDekanAccount({ id: dekan.id, action: 'activate' }), 'Faollashtirildi')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />} Faollashtirish
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('reassign')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold ${ui.btnGhost}`}
          >
            <ArrowLeftRight size={12} /> Fakultetni o‘zgartirish
          </button>
        </div>
      )}
    </div>
  )
}
