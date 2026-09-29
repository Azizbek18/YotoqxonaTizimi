'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  FileSignature,
  Loader2,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { apiRequest } from '@/lib/api-client'
import SignaturePad from '@/components/applications/SignaturePad'
import { Skel } from '@/components/dekan/Skeletons'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI, statusChip } from '@/lib/dekan-ui'
import { directionLabel } from '@/lib/directions'
import { genderAccent } from '@/lib/gender'
import { EXPLANATION_RED_THRESHOLD } from '@/features/applications/domain/explanation'
import {
  RECIPIENT_OPTIONS,
  composeArizaFullText,
  type ArizaRecipient,
} from '@/lib/student-ariza-template'

type DormStudent = {
  id: string
  full_name: string
  room_number: string | null
  faculty: string | null
  direction: string | null
  course: number | null
  gender: string | null
}

type Context = {
  student: {
    id: string
    fullName: string
    faculty: string
    facultyLabel: string
    direction: string | null
    course: number | null
    room: string | null
  }
  ttjNumber: string
  dekanName: string | null
  explanationCount: number
  red: boolean
  recent: { id: string; title: string | null; date: string | null }[]
}

type Result = {
  receipt: { verifyCode: string }
  explanationCount: number
  red: boolean
  telegram: { student: boolean; staff: 'sent' | 'not_set' | 'failed'; dekansNotified: number }
}

const MIN_REASON = 10
const LIST_LIMIT = 40

function initials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0] ?? '').slice(0, 2).join('').toUpperCase()
}

// The tarbiyachi's side of a tushuntirish xati. Students dodge writing one
// ("telefonim o'chgan..."), so the tarbiyachi does it with them: pick the
// student (everything else fills itself in), type only the reason, hand over
// the phone for the student's own signature, confirm. The letter is then
// exactly a student-signed one; the third makes the student "qizil" and tells
// the dekan.
export default function TarbiyachiTushuntirishPage() {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const ui = dekanUI(isLight)

  const [students, setStudents] = useState<DormStudent[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listFailed, setListFailed] = useState(false)
  const [search, setSearch] = useState('')

  const [context, setContext] = useState<Context | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [recipient, setRecipient] = useState<ArizaRecipient>('dekan')
  const [signature, setSignature] = useState<string | null>(null)
  const [padKey, setPadKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const loadStudents = useCallback(async () => {
    setListLoading(true)
    setListFailed(false)
    try {
      const data = await apiRequest<{ ok: true; students: DormStudent[] }>('/api/staff/students')
      setStudents(data.students)
    } catch {
      setListFailed(true)
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => { void loadStudents() }, [loadStudents])

  const pick = async (student: DormStudent) => {
    setContextLoading(true)
    setResult(null)
    try {
      const data = await apiRequest<Context & { success: true }>(
        `/api/staff/explanations?studentId=${encodeURIComponent(student.id)}`,
      )
      setContext(data)
      setReason('')
      setSignature(null)
      setPadKey((k) => k + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Talaba ma'lumotini yuklab bo'lmadi")
    } finally {
      setContextLoading(false)
    }
  }

  const reset = () => {
    setContext(null)
    setResult(null)
    setReason('')
    setSignature(null)
    setPadKey((k) => k + 1)
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rows = query
      ? students.filter((s) => s.full_name.toLowerCase().includes(query) || (s.room_number ?? '').toLowerCase() === query)
      : students
    return [...rows].sort((a, b) => a.full_name.localeCompare(b.full_name, 'uz'))
  }, [students, search])

  const reasonOk = reason.trim().length >= MIN_REASON
  const canSubmit = Boolean(context) && reasonOk && Boolean(signature) && !submitting

  const preview = useMemo(() => {
    if (!context) return ''
    return composeArizaFullText({
      kind: 'tushuntirish',
      recipient,
      fullName: context.student.fullName,
      facultyLabel: context.student.facultyLabel,
      course: context.student.course ?? 1,
      ttjNumber: context.ttjNumber,
      room: context.student.room ?? '',
      incidentText: reason.trim() || '…',
      dekanName: context.dekanName,
    })
  }, [context, recipient, reason])

  const submit = async () => {
    if (!context || !signature) return
    setSubmitting(true)
    try {
      const data = await apiRequest<Result & { success: true }>('/api/staff/explanations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: context.student.id,
          incidentText: reason.trim(),
          recipient,
          signature: { typedName: context.student.fullName, attested: true, image: signature },
        }),
      })
      setResult(data)
      toast.success('Tushuntirish xati saqlandi')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tushuntirish xatini saqlab bo'lmadi")
    } finally {
      setSubmitting(false)
    }
  }

  const danger = statusChip('danger', isLight)
  const warn = statusChip('warning', isLight)
  const good = statusChip('success', isLight)
  const neutral = statusChip('neutral', isLight)
  const nextIsRed = Boolean(context) && !context!.red && context!.explanationCount + 1 >= EXPLANATION_RED_THRESHOLD

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(255,255,255,0.12),transparent_45%)]" />
        <div className="relative min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
            <FileSignature size={11} /> Talaba nomidan
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">Tushuntirish xati</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-indigo-100 sm:text-sm">
            Talabani tanlang, sababini yozing, telefonni talabaga bering — u imzo qo&apos;yadi. Xat talaba yozgandek rasmiylashadi va Telegram orqali sizga hamda talabaga yuboriladi.
          </p>
        </div>
      </div>

      {result && context ? (
        /* ── Success ─────────────────────────────────────────── */
        <div className={`mx-auto max-w-xl rounded-3xl border p-6 text-center sm:p-8 ${ui.cardElevated}`}>
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${good.chip}`}>
            <CheckCircle2 size={30} />
          </div>
          <h2 className={`mt-4 text-lg font-bold ${ui.strong}`}>Tushuntirish xati saqlandi</h2>
          <p className={`mt-1 text-xs ${ui.muted}`}>
            {context.student.fullName} · {result.explanationCount}-xat
          </p>

          <div className={`mt-5 inline-flex flex-col items-center rounded-2xl border px-6 py-3 ${ui.inset}`}>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${ui.faint}`}>Tekshiruv kodi</span>
            <span className={`mt-1 text-lg font-black tracking-widest tabular-nums ${ui.strong}`}>{result.receipt.verifyCode}</span>
          </div>

          <ul className="mt-6 space-y-2 text-left text-xs">
            {[
              {
                ok: result.telegram.student,
                label: 'Talabaga Telegram',
                ok_text: 'Yuborildi',
                bad_text: "Yuborilmadi — talaba Telegram'ni ulamagan bo'lishi mumkin",
              },
              {
                ok: result.telegram.staff === 'sent',
                label: 'Sizga Telegram',
                ok_text: 'Yuborildi',
                bad_text: result.telegram.staff === 'not_set'
                  ? "Yuborilmadi — Sozlamalarda Telegram chat ID'ni kiriting"
                  : 'Yuborilmadi',
              },
            ].map((row) => (
              <li key={row.label} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 ${ui.inset}`}>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${row.ok ? good.chip : warn.chip}`}>
                  {row.ok ? <Check size={12} /> : <AlertTriangle size={11} />}
                </span>
                <span className="min-w-0">
                  <span className={`block font-bold ${ui.strong}`}>{row.label}</span>
                  <span className={row.ok ? ui.muted : warn.text}>{row.ok ? row.ok_text : row.bad_text}</span>
                </span>
              </li>
            ))}
          </ul>

          {result.red && (
            <div className={`mt-5 flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-left text-xs leading-relaxed ${danger.chip}`}>
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                <b>Talaba qizil holatga tushdi</b> ({result.explanationCount} ta tushuntirish xati).{' '}
                {result.telegram.dekansNotified > 0
                  ? `Dekanga Telegram orqali xabar yuborildi.`
                  : "Dekan Telegram'ni ulamagan — dekan Talabalar bo'limidagi «Qizil» papkada ko'radi."}
              </span>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button type="button" onClick={reset} className={`rounded-xl px-5 py-2.5 text-xs font-bold ${ui.accentSolid}`}>
              Yana xat yozish
            </button>
            <Link href="/tarbiyachi/talabalar" className={`rounded-xl px-5 py-2.5 text-center text-xs font-bold ${ui.btnGhost}`}>
              Talabalarga o&apos;tish
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* ── 1. Student picker ─────────────────────────────── */}
          <section className={`${context ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col rounded-3xl border ${ui.card}`}>
            <div className="p-4 pb-3">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${ui.accentTile}`}>1</span>
                <h2 className={`text-sm font-bold ${ui.strong}`}>Talabani toping</h2>
              </div>
              <div className="relative mt-3">
                <Search size={15} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${ui.faint}`} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ism, familiya yoki xona raqami..."
                  className={`w-full rounded-xl border py-2.5 pl-9 pr-9 text-xs font-medium ${ui.input} ${ui.ring}`}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Qidiruvni tozalash"
                    className={`no-shelf absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 ${ui.faint} hover:text-slate-700 dark:hover:text-slate-200`}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className={`no-scrollbar max-h-[28rem] min-h-0 flex-1 overflow-y-auto border-t px-2 py-2 ${ui.border}`}>
              {listLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skel className="h-10 w-10 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skel className="h-3.5 w-2/3" />
                        <Skel className="h-2.5 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : listFailed ? (
                <div className="p-6 text-center">
                  <p className={`text-xs ${ui.muted}`}>Talabalar ro&apos;yxati yuklanmadi.</p>
                  <button type="button" onClick={() => void loadStudents()} className={`mt-3 rounded-xl px-4 py-2 text-xs font-bold ${ui.btnGhost}`}>
                    Qayta urinish
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <p className={`p-8 text-center text-xs ${ui.muted}`}>
                  {search ? 'Bunday talaba topilmadi' : "Yotoqxonada talaba yo'q"}
                </p>
              ) : (
                <>
                  {filtered.slice(0, LIST_LIMIT).map((student) => {
                    const accent = genderAccent(student.gender)
                    const active = context?.student.id === student.id
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => void pick(student)}
                        disabled={contextLoading}
                        className={`no-shelf group my-0.5 flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors disabled:opacity-60 ${ui.ring} ${
                          active
                            ? isLight ? 'border-indigo-300 bg-indigo-50' : 'border-indigo-500/40 bg-indigo-500/10'
                            : isLight ? 'border-transparent hover:bg-slate-50' : 'border-transparent hover:bg-slate-800/50'
                        }`}
                      >
                        <span className="relative shrink-0">
                          <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-[11px] font-black ${ui.accentTileSoft}`}>
                            {initials(student.full_name)}
                          </span>
                          <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ${isLight ? 'ring-white' : 'ring-slate-900'} ${accent.dot}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-xs font-bold ${ui.strong}`}>{student.full_name}</span>
                          <span className={`mt-0.5 block truncate text-[11px] ${ui.muted}`}>
                            {student.room_number ? `${student.room_number}-xona` : 'Xonasiz'}
                            {student.course ? ` · ${student.course}-kurs` : ''}
                          </span>
                        </span>
                        <ChevronRight size={15} className={`shrink-0 ${ui.faint} transition-transform group-hover:translate-x-0.5`} />
                      </button>
                    )
                  })}
                  {filtered.length > LIST_LIMIT && (
                    <p className={`px-3 py-3 text-center text-[11px] ${ui.faint}`}>
                      Yana {filtered.length - LIST_LIMIT} ta bor — qidiruvni aniqlashtiring
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          {/* ── 2. Letter ─────────────────────────────────────── */}
          <section className={`${context || contextLoading ? 'block' : 'hidden lg:block'} min-w-0`}>
            {contextLoading ? (
              <div className={`space-y-4 rounded-3xl border p-6 ${ui.card}`}>
                <Skel className="h-16 w-full rounded-2xl" />
                <Skel className="h-32 w-full rounded-2xl" />
                <Skel className="h-40 w-full rounded-2xl" />
              </div>
            ) : !context ? (
              <div className={`flex h-full min-h-[18rem] flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-12 text-center ${ui.border}`}>
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
                  <FileSignature size={24} />
                </div>
                <h3 className={`mt-4 text-sm font-bold ${ui.strong}`}>Talabani tanlang</h3>
                <p className={`mt-1 max-w-xs text-xs leading-relaxed ${ui.muted}`}>
                  Ismi bo&apos;yicha qidirib tanlaganingizda xona va boshqa ma&apos;lumotlari o&apos;zi to&apos;ldiriladi. Faqat sababni yozasiz.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={reset}
                  className={`no-shelf inline-flex items-center gap-1.5 text-xs font-bold lg:hidden ${ui.accentText}`}
                >
                  <ArrowLeft size={14} /> Boshqa talaba
                </button>

                {/* Student card */}
                <div className={`rounded-3xl border p-5 ${ui.cardElevated}`}>
                  <div className="flex items-start gap-3.5">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${ui.accentTile}`}>
                      {initials(context.student.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className={`text-base font-bold ${ui.strong}`}>{context.student.fullName}</h2>
                      <p className={`mt-0.5 text-xs ${ui.muted}`}>
                        {context.student.facultyLabel}
                        {context.student.direction ? ` · ${directionLabel(context.student.direction)}` : ''}
                        {context.student.course ? ` · ${context.student.course}-kurs` : ''}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${neutral.chip}`}>
                          {context.ttjNumber ? `${context.ttjNumber}-yotoqxona` : 'Yotoqxona'} · {context.student.room ? `${context.student.room}-xona` : 'xonasiz'}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          context.red ? danger.chip : context.explanationCount > 0 ? warn.chip : good.chip
                        }`}>
                          {context.explanationCount === 0
                            ? 'Birinchi xat'
                            : `Avval ${context.explanationCount} ta xat yozgan`}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={reset}
                      aria-label="Talabani almashtirish"
                      className={`no-shelf hidden shrink-0 rounded-lg p-1.5 lg:block ${ui.faint} hover:text-slate-700 dark:hover:text-slate-200`}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {(context.red || nextIsRed) && (
                    <div className={`mt-4 flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-xs leading-relaxed ${context.red ? danger.chip : warn.chip}`}>
                      <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                      <span>
                        {context.red
                          ? `Bu talaba allaqachon qizil holatda (${context.explanationCount} ta xat). Yana xat yozilsa, dekanga qayta xabar boradi.`
                          : `Bu ${context.explanationCount + 1}-xat bo'ladi: talaba qizil holatga tushadi va dekanga xabar boradi.`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Reason */}
                <div className={`rounded-3xl border p-5 ${ui.card}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${ui.accentTile}`}>2</span>
                    <h3 className={`text-sm font-bold ${ui.strong}`}>Sabab</h3>
                  </div>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={5}
                    maxLength={8000}
                    placeholder="Talaba nima sababdan tushuntirish yozmoqda? Masalan: yo'qlamada bo'lmagan, tungi vaqtda ruxsatsiz chiqqan, xonada tartibni buzgan..."
                    className={`mt-3 w-full resize-y rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${ui.input} ${ui.ring}`}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                    <span className={reasonOk || !reason ? ui.faint : warn.text}>
                      {reasonOk || !reason ? 'Talabaning o‘z gapi bilan, aniq va qisqa' : `Kamida ${MIN_REASON} ta belgi (${reason.trim().length}/${MIN_REASON})`}
                    </span>
                    <span className={ui.faint}>{reason.length}/8000</span>
                  </div>

                  <div className="mt-4">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${ui.faint}`}>Kimning nomiga</p>
                    <div className={`no-shelf mt-1.5 inline-flex flex-wrap gap-1 rounded-xl border p-1 ${ui.inset}`}>
                      {RECIPIENT_OPTIONS.map((option) => {
                        const selected = recipient === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setRecipient(option.value)}
                            className={`no-shelf rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${ui.ring} ${
                              selected
                                ? isLight ? 'bg-white text-indigo-700 shadow-sm' : 'bg-slate-700 text-white'
                                : `${ui.muted} hover:text-slate-900 dark:hover:text-white`
                            }`}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className={`rounded-3xl border p-5 ${ui.card}`}>
                  <h3 className={`text-sm font-bold ${ui.strong}`}>Xat ko&apos;rinishi</h3>
                  <p className={`mt-0.5 text-[11px] ${ui.faint}`}>Talaba aynan shuni imzolaydi</p>
                  <div className={`mt-3 max-h-80 overflow-y-auto rounded-2xl border px-5 py-4 text-[13px] leading-relaxed whitespace-pre-wrap ${
                    isLight ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-slate-700 bg-slate-950/40 text-slate-200'
                  }`}>
                    {preview}
                  </div>
                </div>

                {/* Signature + confirm */}
                <div className={`rounded-3xl border p-5 ${ui.card}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${ui.accentTile}`}>3</span>
                    <h3 className={`text-sm font-bold ${ui.strong}`}>Talaba imzosi</h3>
                  </div>
                  <p className={`mt-1.5 text-xs leading-relaxed ${ui.muted}`}>
                    Telefonni talabaga bering — u xatni o&apos;qib, quyiga o&apos;z imzosini qo&apos;yadi.
                  </p>
                  <div className="mt-3">
                    <SignaturePad key={padKey} isLight={isLight} onChange={setSignature} height={190} />
                  </div>

                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={!canSubmit}
                    className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold ${ui.accentSolid}`}
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {submitting ? 'Saqlanmoqda...' : 'Talaba imzoladi — Tasdiqlash'}
                  </button>
                  {!canSubmit && !submitting && (
                    <p className={`mt-2 text-center text-[11px] ${ui.faint}`}>
                      {!reasonOk ? 'Avval sababni yozing' : 'Talaba imzo qo‘yishi kerak'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
