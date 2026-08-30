'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Coins, Loader2, Pencil, RefreshCw, Wallet, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchFacultyFees, updateFacultyFee } from '@/features/app-settings/client/api'
import type { FacultyFee } from '@/features/app-settings/types'
import { dekanUI, statusChip } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'

const sum = (value: number) => `${value.toLocaleString('uz-UZ')} so'm`

export default function FacultyFeesPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [fees, setFees] = useState<FacultyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ monthlyFee: 0, yearlyContractFee: 0 })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setFees(await fetchFacultyFees())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const configuredCount = fees.filter((f) => f.configured).length
  const months = draft.monthlyFee > 0 ? draft.yearlyContractFee / draft.monthlyFee : 0
  const monthsClean = Number.isInteger(months) && months > 0

  const distinctPairs = useMemo(
    () => new Set(fees.map((f) => `${f.monthlyFee}/${f.yearlyContractFee}`)).size,
    [fees],
  )

  const startEdit = (fee: FacultyFee) => {
    setEditing(fee.faculty)
    setDraft({ monthlyFee: fee.monthlyFee, yearlyContractFee: fee.yearlyContractFee })
  }

  const save = async (faculty: string) => {
    if (draft.monthlyFee < 1 || draft.yearlyContractFee < 1) {
      toast.error("Summalar noldan katta bo'lishi kerak")
      return
    }
    if (!monthsClean) {
      toast.error("Yillik summa oylik to'lovning butun karralisi bo'lishi kerak")
      return
    }
    setSaving(true)
    try {
      const updated = await updateFacultyFee({ faculty, ...draft })
      setFees((prev) => prev.map((f) => (f.faculty === faculty ? { ...f, ...updated } : f)))
      setEditing(null)
      toast.success('Saqlandi')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saqlab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className={`relative overflow-hidden rounded-3xl border p-5 sm:p-7 ${ui.cardElevated}`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] ${ui.accentSoft}`}>
              <Wallet size={13} /> Superadmin · Moliya
            </div>
            <h1 className={`text-2xl font-black tracking-tight sm:text-3xl ${ui.strong}`}>Fakultet to‘lovlari</h1>
            <p className={`mt-2 text-sm leading-6 ${ui.body}`}>
              Har fakultetning oylik yotoqxona to‘lovi va yillik shartnoma summasi. Yillik summa
              oylik to‘lovning butun karralisi bo‘lishi shart.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={`inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold ${ui.btnGhost}`}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Yangilash
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Sozlangan fakultet" value={`${configuredCount}/${fees.length || 13}`} tone={configuredCount === (fees.length || 13) ? 'success' : 'warning'} isLight={isLight} icon={Check} />
          <MiniStat label="Turlicha tarif" value={String(distinctPairs || '—')} tone="info" isLight={isLight} icon={Coins} />
          <MiniStat
            label="Standart tarifda"
            value={String(fees.length - configuredCount)}
            tone={fees.length - configuredCount > 0 ? 'warning' : 'neutral'}
            isLight={isLight}
            icon={Wallet}
          />
        </div>
      </section>

      <section className={`overflow-hidden rounded-3xl border ${ui.card}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className={`border-b text-left text-[10px] font-extrabold uppercase tracking-wider ${ui.border} ${ui.muted}`}>
                <th className="px-4 py-3">Fakultet</th>
                <th className="px-4 py-3">Oylik to‘lov</th>
                <th className="px-4 py-3">Yillik shartnoma</th>
                <th className="px-4 py-3">Oylar</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${ui.divide}`}>
              {loading && fees.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-4"><div className={`h-6 animate-pulse rounded ${ui.inset}`} /></td></tr>
                ))
              ) : (
                fees.map((fee) => {
                  const isEditing = editing === fee.faculty
                  const state = statusChip(fee.configured ? 'success' : 'warning', isLight)
                  const rowMonths = fee.monthlyFee > 0 ? fee.yearlyContractFee / fee.monthlyFee : 0
                  return (
                    <tr key={fee.faculty} className={isEditing ? (isLight ? 'bg-indigo-50/40' : 'bg-indigo-500/5') : undefined}>
                      <td className="px-4 py-3">
                        <p className={`font-bold ${ui.strong}`}>{fee.facultyLabel}</p>
                        <p className={`text-[10px] uppercase tracking-wider ${ui.faint}`}>{fee.faculty}</p>
                      </td>

                      {isEditing ? (
                        <>
                          <td className="px-4 py-3">
                            <input
                              type="number" min={1} step={1000}
                              value={draft.monthlyFee || ''}
                              onChange={(e) => setDraft((d) => ({ ...d, monthlyFee: Number(e.target.value) }))}
                              className={`w-32 rounded-lg border px-2.5 py-1.5 text-sm outline-none ${ui.input} ${ui.ring}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number" min={1} step={1000}
                              value={draft.yearlyContractFee || ''}
                              onChange={(e) => setDraft((d) => ({ ...d, yearlyContractFee: Number(e.target.value) }))}
                              className={`w-36 rounded-lg border px-2.5 py-1.5 text-sm outline-none ${ui.input} ${ui.ring}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold ${monthsClean ? ui.strong : (isLight ? 'text-rose-600' : 'text-rose-400')}`}>
                              {monthsClean ? `${months} oy` : 'karrali emas'}
                            </span>
                          </td>
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button" disabled={saving} onClick={() => save(fee.faculty)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${ui.accentSolid}`}
                              >
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Saqlash
                              </button>
                              <button
                                type="button" onClick={() => setEditing(null)}
                                className={`rounded-lg p-1.5 ${ui.btnGhost}`}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={`px-4 py-3 font-semibold ${ui.strong}`}>{sum(fee.monthlyFee)}</td>
                          <td className={`px-4 py-3 font-semibold ${ui.strong}`}>{sum(fee.yearlyContractFee)}</td>
                          <td className={`px-4 py-3 ${ui.muted}`}>{Number.isInteger(rowMonths) ? `${rowMonths} oy` : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${state.chip}`}>
                              {fee.configured ? 'Sozlangan' : 'Standart'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button" onClick={() => startEdit(fee)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${ui.btnGhost}`}
                            >
                              <Pencil size={12} /> Tahrirlash
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function MiniStat({
  label, value, tone, isLight, icon: Icon,
}: {
  label: string
  value: string
  tone: Parameters<typeof statusChip>[0]
  isLight: boolean
  icon: typeof Wallet
}) {
  const ui = dekanUI(isLight)
  const state = statusChip(tone, isLight)
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${ui.inset}`}>
      <div>
        <p className={`text-[10px] font-extrabold uppercase tracking-[0.14em] ${ui.muted}`}>{label}</p>
        <p className={`mt-1 text-2xl font-black ${ui.strong}`}>{value}</p>
      </div>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${state.chip}`}>
        <Icon size={18} />
      </span>
    </div>
  )
}
