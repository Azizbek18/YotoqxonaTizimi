'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchIntegrityReport } from '@/features/data-integrity/client/api'
import type { IntegrityCheck, IntegrityReport } from '@/features/data-integrity/types'
import { dekanUI, statusChip, type DekanStatusTone } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'

const SEVERITY_TONE: Record<IntegrityCheck['severity'], DekanStatusTone> = {
  danger: 'danger',
  warning: 'warning',
  info: 'info',
}

export default function DataIntegrityPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [report, setReport] = useState<IntegrityReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setReport(await fetchIntegrityReport())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const checks = report?.checks ?? []
  const openIssues = checks.filter((c) => c.count > 0)
  const totalIssues = openIssues.reduce((n, c) => n + c.count, 0)
  const allClear = report !== null && openIssues.length === 0

  return (
    <div className="space-y-6">
      <section className={`relative overflow-hidden rounded-3xl border p-5 sm:p-7 ${ui.cardElevated}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] ${ui.accentSoft}`}>
              <ShieldCheck size={13} /> Superadmin · Ma’lumot yaxlitligi
            </div>
            <h1 className={`text-2xl font-black tracking-tight sm:text-3xl ${ui.strong}`}>Tizim tekshiruvi</h1>
            <p className={`mt-2 text-sm leading-6 ${ui.body}`}>
              Ko‘rinmay qolgan yoki qarama-qarshi yozuvlar — dekansiz arizali fakultetlar, rezidentli
              muzlatilgan xonalar, qavatsiz talabalar. Har biri tuzatiladigan joyга havola qiladi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={`inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold ${ui.btnGhost}`}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Qayta tekshirish
          </button>
        </div>

        {report && (
          <div className={`mt-6 flex items-center gap-3 rounded-2xl border p-4 ${
            allClear
              ? isLight ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-500/25 bg-emerald-500/10'
              : ui.inset
          }`}>
            {allClear ? (
              <CheckCircle2 size={22} className={isLight ? 'text-emerald-600' : 'text-emerald-400'} />
            ) : (
              <ShieldAlert size={22} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
            )}
            <div>
              <p className={`text-sm font-bold ${ui.strong}`}>
                {allClear
                  ? 'Hammasi joyida — ochiq muammo yo‘q'
                  : `${openIssues.length} turdagi ${totalIssues} ta yozuv e’tibor talab qiladi`}
              </p>
              <p className={`text-[11px] ${ui.muted}`}>
                Tekshirilgan vaqt: {new Date(report.generatedAt).toLocaleString('uz-UZ')}
              </p>
            </div>
          </div>
        )}
      </section>

      {loading && !report ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`h-40 animate-pulse rounded-3xl border ${ui.inset}`} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...checks].sort((a, b) => (b.count > 0 ? 1 : 0) - (a.count > 0 ? 1 : 0)).map((check) => (
            <CheckCard key={check.key} check={check} isLight={isLight} />
          ))}
        </div>
      )}
    </div>
  )
}

function CheckCard({ check, isLight }: { check: IntegrityCheck; isLight: boolean }) {
  const ui = dekanUI(isLight)
  const clear = check.count === 0
  const chip = statusChip(clear ? 'success' : SEVERITY_TONE[check.severity], isLight)

  return (
    <article className={`flex flex-col rounded-3xl border p-5 ${ui.card} ${clear ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={`text-sm font-black ${ui.strong}`}>{check.title}</h2>
          <p className={`mt-1 text-[11px] leading-5 ${ui.muted}`}>{check.description}</p>
        </div>
        <span className={`shrink-0 rounded-xl px-2.5 py-1 text-lg font-black tabular-nums ${chip.chip}`}>
          {clear ? '✓' : check.count}
        </span>
      </div>

      {!clear && check.sample.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {check.sample.map((s) => (
            <li key={s.id} className={`rounded-lg border px-2 py-1 text-[10px] ${ui.inset} ${ui.body}`}>
              {s.label}{s.hint ? <span className={ui.faint}> · {s.hint}</span> : null}
            </li>
          ))}
          {check.count > check.sample.length && (
            <li className={`px-2 py-1 text-[10px] ${ui.faint}`}>+{check.count - check.sample.length} ta</li>
          )}
        </ul>
      )}

      {!clear && check.href && (
        <Link
          href={check.href}
          className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold ${ui.accentSoft}`}
        >
          Tuzatishga o‘tish <ArrowRight size={12} />
        </Link>
      )}
    </article>
  )
}
