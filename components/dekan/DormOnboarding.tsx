'use client'

import { useMemo, useState } from 'react'
import { Building2, Check, Loader2, ArrowRight, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'
import { permitFacultyLabel } from '@/lib/faculties'
import { previewDorm, setUpDorm } from '@/features/dorms/client/api'
import type { DekanDorm, DormPreview } from '@/features/dorms/types'

/**
 * Blocking first-run screen shown by the dekan layout when the faculty
 * has no dorm yet. The dekan types their building number; if another
 * faculty already lives there they pick their own floors and the co-dekan
 * confirms (P1 handshake).
 */
export default function DormOnboarding({
  facultyLabel,
  onDone,
}: {
  facultyLabel: string
  onDone: (dorm: DekanDorm) => void
}) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

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
      floor: i + 1,
      ownerFaculty: null,
      pendingFaculty: null,
      taken: false,
    }))
  }, [preview, floorCount])

  const coFaculty = preview?.floors.find((f) => f.taken)?.ownerFaculty ?? preview?.floors.find((f) => f.taken)?.pendingFaculty ?? null

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
    if (selected.size === 0) {
      toast.error('Kamida bitta qavat tanlang')
      return
    }
    setSubmitting(true)
    try {
      const res = await setUpDorm({
        number: numberInput.trim(),
        floorCount: preview?.exists ? undefined : floorCount,
        floors: [...selected].sort((a, b) => a - b),
      })
      if (!res.dorm) throw new Error("Yotoqxona ma'lumoti qaytmadi")
      if (res.proposed.length > 0) {
        toast.success(
          `${res.proposed.length} ta qavat taklif qilindi — ${permitFacultyLabel(coFaculty ?? '')} dekani tasdig'ini kuting`,
        )
      } else {
        toast.success('Yotoqxona sozlandi')
      }
      onDone(res.dorm)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saqlab bo'lmadi")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`flex min-h-screen items-center justify-center p-4 ${ui.shell}`}>
      <div className={`w-full max-w-lg rounded-3xl border p-6 sm:p-8 ${ui.cardElevated}`}>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${ui.accentTile}`}>
          <Building2 size={22} strokeWidth={2.2} />
        </div>
        <h1 className={`mt-4 text-lg font-bold tracking-tight ${ui.strong}`}>Yotoqxonangizni belgilang</h1>
        <p className={`mt-1.5 text-xs leading-relaxed ${ui.muted}`}>
          <span className="font-semibold">{facultyLabel}</span> talabalari qaysi yotoqxona binosida yashaydi?
          Bino raqamini kiriting. Agar binoda boshqa fakultet ham bo&apos;lsa, o&apos;z qavatlaringizni tanlaysiz.
        </p>

        {/* number */}
        <div className="mt-5 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.faint}`} />
            <input
              value={numberInput}
              onChange={(e) => {
                setNumberInput(e.target.value)
                setPreview(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && check()}
              placeholder="Masalan: 3"
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
          <div className="mt-5 space-y-4">
            {/* new dorm: floor count */}
            {!preview.exists && (
              <div className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${ui.inset}`}>
                <div>
                  <p className={`text-[11px] font-semibold ${ui.strong}`}>Yangi yotoqxona</p>
                  <p className={`text-[10px] ${ui.muted}`}>Binodagi qavatlar sonini kiriting</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={floorCount}
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

            {/* floor grid */}
            <div>
              <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Sizning qavatlaringiz</p>
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
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : preview.exists && coFaculty ? (
                <>Taklif yuborish <ArrowRight size={14} /></>
              ) : (
                <>Tasdiqlash <Check size={14} /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
