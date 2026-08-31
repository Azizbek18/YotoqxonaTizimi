'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchAuditLog } from '@/features/audit-log/client/api'
import type { AuditLogEntry, AuditLogPage } from '@/features/audit-log/types'
import CustomSelect from '@/components/ui/CustomSelect'
import { Skel } from '@/components/dekan/Skeletons'
import { dekanUI, statusChip, type DekanStatusTone } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'

const PAGE_SIZE = 40

const SINCE_OPTIONS: Array<{ label: string; hours: number | null }> = [
  { label: 'Barcha vaqt', hours: null },
  { label: 'Oxirgi 24 soat', hours: 24 },
  { label: 'Oxirgi 7 kun', hours: 24 * 7 },
  { label: 'Oxirgi 30 kun', hours: 24 * 30 },
]

const STATUS_TONE: Record<string, DekanStatusTone> = {
  success: 'success',
  denied: 'warning',
  error: 'danger',
}

const STATUS_LABEL: Record<string, string> = {
  success: 'Muvaffaqiyat',
  denied: 'Rad etildi',
  error: 'Xatolik',
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AuditLogPageView() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [page, setPage] = useState<AuditLogPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [eventType, setEventType] = useState('')
  const [status, setStatus] = useState('')
  const [sinceHours, setSinceHours] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const since = sinceHours ? new Date(Date.now() - sinceHours * 3600_000).toISOString() : undefined
      setPage(await fetchAuditLog({ limit: PAGE_SIZE, offset, eventType, status, since }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [offset, eventType, status, sinceHours])
  useEffect(() => { void load() }, [load])

  // Any filter change resets to the first page.
  useEffect(() => { setOffset(0) }, [eventType, status, sinceHours])

  const total = page?.total ?? 0
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, total)

  return (
    <div className="space-y-6">
      <section className={`relative overflow-hidden rounded-3xl border p-5 sm:p-7 ${ui.cardElevated}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] ${ui.accentSoft}`}>
              <ShieldCheck size={13} /> Superadmin · Xavfsizlik
            </div>
            <h1 className={`text-2xl font-black tracking-tight sm:text-3xl ${ui.strong}`}>Audit jurnali</h1>
            <p className={`mt-2 text-sm leading-6 ${ui.body}`}>
              Tizimda bajarilgan xavfsizlikка oid amallar — yo‘llanma tasdiqlash, chetlashtirish,
              ro‘yxatdan o‘tish. Faqat o‘qish uchun.
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

        <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
          <CustomSelect
            value={eventType}
            onChange={setEventType}
            className={`rounded-xl border px-3 py-2.5 text-sm ${ui.input}`}
            options={[
              { value: '', label: 'Barcha amallar' },
              ...(page?.eventTypes ?? []).map((t) => ({ value: t, label: t })),
            ]}
          />
          <CustomSelect
            value={status}
            onChange={setStatus}
            className={`rounded-xl border px-3 py-2.5 text-sm ${ui.input}`}
            options={[
              { value: '', label: 'Har qanday holat' },
              ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
          <CustomSelect
            value={String(sinceHours ?? '')}
            onChange={(v) => setSinceHours(v ? Number(v) : null)}
            className={`rounded-xl border px-3 py-2.5 text-sm ${ui.input}`}
            options={SINCE_OPTIONS.map((o) => ({ value: String(o.hours ?? ''), label: o.label }))}
          />
        </div>
      </section>

      <section className={`overflow-hidden rounded-3xl border ${ui.card}`}>
        <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${ui.border}`}>
          <p className={`text-xs font-bold ${ui.muted}`}>
            {total > 0 ? `${from}–${to} / ${total}` : loading ? 'Yuklanmoqda…' : 'Yozuv yo‘q'}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={offset === 0 || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className={`rounded-lg p-1.5 disabled:opacity-40 ${ui.btnGhost}`}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              disabled={to >= total || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className={`rounded-lg p-1.5 disabled:opacity-40 ${ui.btnGhost}`}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {loading && !page ? (
          <div className={`divide-y ${ui.divide}`}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skel className="h-8 w-8 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skel className="h-3.5 w-48" />
                  <Skel className="h-2.5 w-32" />
                </div>
                <Skel className="hidden h-3 w-20 shrink-0 sm:block" />
              </div>
            ))}
          </div>
        ) : (page?.entries.length ?? 0) === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className={`mx-auto ${ui.faint}`} size={30} />
            <p className={`mt-3 text-sm font-bold ${ui.strong}`}>Bu filtrlar bo‘yicha yozuv topilmadi</p>
          </div>
        ) : (
          <ul className={`divide-y ${ui.divide}`}>
            {page!.entries.map((entry) => (
              <AuditRow
                key={entry.id}
                entry={entry}
                isLight={isLight}
                open={expanded === entry.id}
                onToggle={() => setExpanded((cur) => (cur === entry.id ? null : entry.id))}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function AuditRow({
  entry, isLight, open, onToggle,
}: {
  entry: AuditLogEntry
  isLight: boolean
  open: boolean
  onToggle: () => void
}) {
  const ui = dekanUI(isLight)
  const chip = statusChip(STATUS_TONE[entry.status] ?? 'neutral', isLight)
  const detailKeys = Object.keys(entry.details)

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'}`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${chip.dot}`} />
        <span className={`font-mono text-xs font-bold ${ui.strong}`}>{entry.eventType}</span>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${chip.chip}`}>
          {STATUS_LABEL[entry.status] ?? entry.status}
        </span>
        <span className={`min-w-0 flex-1 truncate text-[11px] ${ui.muted}`}>
          {entry.actorName
            ? `${entry.actorName}${entry.actorRole ? ` · ${entry.actorRole}` : ''}`
            : entry.actorId
              ? entry.actorId.slice(0, 8)
              : 'tizim'}
          {entry.targetRole ? ` → ${entry.targetRole}` : ''}
        </span>
        <span className={`shrink-0 text-[11px] tabular-nums ${ui.faint}`}>{formatWhen(entry.createdAt)}</span>
      </button>

      {open && (
        <div className={`px-4 pb-4 ${ui.body}`}>
          <div className={`rounded-xl border p-3 text-[11px] ${ui.inset}`}>
            {detailKeys.length === 0 ? (
              <p className={ui.faint}>Qo‘shimcha ma’lumot yo‘q</p>
            ) : (
              <dl className="grid gap-1.5 sm:grid-cols-2">
                {detailKeys.map((key) => (
                  <div key={key} className="flex gap-2">
                    <dt className={`font-bold ${ui.muted}`}>{key}:</dt>
                    <dd className={`min-w-0 break-all ${ui.strong}`}>
                      {typeof entry.details[key] === 'object'
                        ? JSON.stringify(entry.details[key])
                        : String(entry.details[key])}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {entry.ipAddress && (
              <p className={`mt-2 border-t pt-2 ${ui.border} ${ui.faint}`}>IP: {entry.ipAddress}</p>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
