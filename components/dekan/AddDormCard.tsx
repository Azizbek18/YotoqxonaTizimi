'use client'

import { useMemo, useState } from 'react'
import { Building2, Check, ChevronDown, Loader2, Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'
import { permitFacultyLabel } from '@/lib/faculties'
import { previewDorm, setUpDorm } from '@/features/dorms/client/api'
import type { DekanDorm, DormPreview } from '@/features/dorms/types'

/**
 * Collapsed-by-default "claim another building" card — the ADDITIONAL
 * counterpart to DormOnboarding's first-run flow, for a faculty that
 * already has at least one building and wants a second (many-to-many,
 * 202609300000). Same search → preview → pick-floors shape, just inline
 * and always `additional: true` so it never touches the faculty's other
 * buildings.
 */
export default function AddDormCard({ onAdded }: { onAdded: (dorm: DekanDorm) => void }) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [open, setOpen] = useState(false)
  const [numberInput, setNumberInput] = useState('')
  const [preview, setPreview] = useState<DormPreview | null>(null)
  const [floorCount, setFloorCount] = useState(5)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const floors = useMemo(() => {
    if (!preview) return []
    if (preview.exists) return preview.floors
    return Array.from({ length: floorCount }, (_, i) => ({
      floor: i + 1, ownerFaculty: null, pendingFaculty: null, taken: false,
    }))
  }, [preview, floorCount])

  const coFaculty = preview?.floors.find((f) => f.taken)?.ownerFaculty ?? preview?.floors.find((f) => f.taken)?.pendingFaculty ?? null

  const reset = () => {
    setNumberInput(''); setPreview(null); setSelected(new Set()); setOpen(false)
  }

  const check = async () => {
    const n = numberInput.trim()
    if (!n) return
    setChecking(true)
    try {
      const { preview: p } = await previewDorm(n)
      setPreview(p)
      setFloorCount(p.floorCount)
      setSelected(new Set(p.floors.filter((f) => !f.taken).map((f) => f.floor)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tekshirib bo'lmadi")
    } finally {
      setChecking(false)
    }
  }

  const toggle = (floor: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(floor)) next.delete(floor)
      else next.add(floor)
      return next
    })
  }

  const submit = async () => {
    if (selected.size === 0) { toast.error('Kamida bitta qavat tanlang'); return }
    setSubmitting(true)
    try {
      const res = await setUpDorm({
        number: numberInput.trim(),
        floorCount: preview?.exists ? undefined : floorCount,
        floors: [...selected].sort((a, b) => a - b),
        additional: true,
      })
      if (!res.dorm) throw new Error("Yotoqxona ma'lumoti qaytmadi")
      toast.success(
        res.proposed.length > 0
          ? `${res.proposed.length} ta qavat taklif qilindi — ${permitFacultyLabel(coFaculty ?? '')} dekani tasdig'ini kuting`
          : `${res.dorm.number}-yotoqxona qo'shildi`,
      )
      onAdded(res.dorm)
      reset()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saqlab bo'lmadi")
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-xs font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
      >
        <Plus size={14} /> Yana bino qo&apos;shish
      </button>
    )
  }

  return (
    <div className={`rounded-2xl border p-5 ${ui.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ui.accentTile}`}>
            <Building2 size={18} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h3 className={`text-sm font-bold tracking-tight ${ui.strong}`}>Yana bino qo&apos;shish</h3>
            <p className={`mt-0.5 text-[11px] ${ui.muted}`}>
              Boshqa bino raqamini kiriting — mavjud yotoqxonangiz o&apos;zgarmaydi.
            </p>
          </div>
        </div>
        <button onClick={reset} className={`shrink-0 rounded-lg p-1.5 ${ui.muted}`} aria-label="Yopish">
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.faint}`} />
          <input
            value={numberInput}
            onChange={(e) => { setNumberInput(e.target.value); setPreview(null) }}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            placeholder="Masalan: 9"
            className={`w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm ${ui.input} ${ui.ring}`}
          />
        </div>
        <button
          onClick={check}
          disabled={checking || !numberInput.trim()}
          className={`shrink-0 rounded-xl px-4 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${ui.btnGhost}`}
        >
          {checking ? <Loader2 size={14} className="animate-spin" /> : 'Tekshirish'}
        </button>
      </div>

      {preview && (
        <div className="mt-4 space-y-4">
          {!preview.exists && (
            <div className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${ui.inset}`}>
              <div>
                <p className={`text-[11px] font-semibold ${ui.strong}`}>Yangi yotoqxona</p>
                <p className={`text-[10px] ${ui.muted}`}>Binodagi qavatlar sonini kiriting</p>
              </div>
              <input
                type="number" min={1} max={50} value={floorCount}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(50, Number(e.target.value) || 1))
                  setFloorCount(v)
                  setSelected((prev) => new Set([...prev].filter((f) => f <= v)))
                }}
                className={`w-16 rounded-lg border py-1.5 text-center text-sm ${ui.input}`}
              />
            </div>
          )}

          {preview.exists && coFaculty && (
            <p className={`rounded-xl border px-3.5 py-2.5 text-[11px] leading-relaxed ${ui.inset} ${ui.body}`}>
              Bu yotoqxonada <span className={`font-semibold ${ui.accentText}`}>{permitFacultyLabel(coFaculty)}</span> fakulteti
              ham joylashgan. Kulrang qavatlar band — o&apos;zingizga tegishlilarini belgilang.
            </p>
          )}

          <div>
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Qavatlaringiz</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {floors.map((f) => {
                const active = selected.has(f.floor)
                const label = f.taken ? permitFacultyLabel(f.ownerFaculty ?? f.pendingFaculty ?? '') : `${f.floor}-qavat`
                return (
                  <button
                    key={f.floor}
                    disabled={f.taken}
                    onClick={() => toggle(f.floor)}
                    title={label}
                    className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center text-[10px] font-bold transition-colors ${
                      f.taken
                        ? `${isLight ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-800/60 text-slate-500 border-slate-700'} cursor-not-allowed`
                        : active
                          ? 'border-transparent bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
                          : `${ui.card} ${ui.body}`
                    }`}
                  >
                    <span className="text-sm">{f.floor}</span>
                    <span className="truncate px-0.5 leading-tight opacity-80">{f.taken ? 'band' : active ? 'meniki' : ''}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={submit}
            disabled={submitting || selected.size === 0}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${ui.accentSolid}`}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <>Qo&apos;shish <Check size={14} /></>}
          </button>
        </div>
      )}
    </div>
  )
}
