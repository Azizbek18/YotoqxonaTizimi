'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ArrowLeft,
  ArrowRight,
  PenLine,
  CheckCircle2,
  Download,
  Copy,
  Loader2,
  FileText,
  ShieldCheck,
  Home,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
  RECIPIENT_OPTIONS,
  type ArizaKind,
  type ArizaRecipient,
} from '@/lib/student-ariza-template'
import StudentArizaDocument from '@/components/documents/StudentArizaDocument'
import SignaturePad from '@/components/applications/SignaturePad'
import { generateStudentArizaPdf } from '@/lib/student-ariza-pdf'
import {
  fetchArizaContext,
  submitFormalAriza,
  type ArizaContext,
  type ArizaReceipt,
} from '@/features/applications/client/api'
import CustomSelect from '@/components/ui/CustomSelect'

type Step = 'form' | 'preview' | 'sign' | 'done'

const STEPS = [
  { id: 'form', num: 1, label: "Ma'lumotlar" },
  { id: 'preview', num: 2, label: "Ko'rib chiqish" },
  { id: 'sign', num: 3, label: "Elektron imzo" },
] as const

export default function FormalArizaComposer({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
}) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [ctx, setCtx] = useState<ArizaContext | null>(null)

  const [kind, setKind] = useState<ArizaKind>('tushuntirish')
  const [recipient, setRecipient] = useState<ArizaRecipient>('prorektor')
  const [title, setTitle] = useState('')
  const [fullName, setFullName] = useState('')
  const [ttjNumber, setTtjNumber] = useState('')
  const [room, setRoom] = useState('')
  const [incidentText, setIncidentText] = useState('')

  const [signature, setSignature] = useState<string | null>(null)
  const [attested, setAttested] = useState(false)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<ArizaReceipt | null>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setStep('form')
    setSignature(null)
    setAttested(false)
    setReceipt(null)
    setBusy(false)
    fetchArizaContext()
      .then((c) => {
        setCtx(c)
        setFullName((v) => v || c.fullName)
        setTtjNumber((v) => v || c.ttjNumber)
        setRoom((v) => v || c.room)
      })
      .catch(() => {})
  }, [open])

  const compose = useMemo(
    () => ({
      kind,
      recipient,
      fullName,
      facultyLabel: ctx?.facultyLabel ?? '',
      course: ctx?.course ?? '',
      ttjNumber,
      room,
      incidentText,
      dekanName: ctx?.dekanName ?? null,
    }),
    [kind, recipient, fullName, ctx, ttjNumber, room, incidentText],
  )

  const formValid =
    title.trim().length >= 3 &&
    fullName.trim().length >= 3 &&
    incidentText.trim().length >= 10

  const submit = useCallback(async () => {
    if (!signature || !attested) return
    setBusy(true)
    try {
      const res = await submitFormalAriza({
        kind,
        recipient,
        title: title.trim(),
        fullName: fullName.trim(),
        incidentText: incidentText.trim(),
        signature: { attested: true, image: signature },
      })
      setReceipt(res.receipt)
      setStep('done')
      onSubmitted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yuborilmadi')
    } finally {
      setBusy(false)
    }
  }, [signature, attested, kind, recipient, title, fullName, incidentText, onSubmitted])

  const downloadPdf = () => {
    generateStudentArizaPdf({
      ...compose,
      signatureImage: signature,
      signedAt: receipt?.signedAt ?? new Date().toISOString(),
      verifyCode: receipt?.verifyCode ?? null,
    }).catch(() => toast.error('PDF yaratib bo‘lmadi'))
  }

  if (!mounted) return null

  const surface = isLight ? 'bg-white text-slate-900' : 'bg-[#0b1120] text-white'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'
  const field = `w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all ${
    isLight
      ? 'bg-slate-50/70 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900'
      : 'bg-slate-950/80 border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 text-white [color-scheme:dark]'
  }`
  const label = `mb-1.5 block text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-stretch justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={busy ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className={`relative z-10 flex w-full max-w-2xl flex-col sm:max-h-[92vh] sm:rounded-3xl overflow-hidden border shadow-2xl ${
              isLight ? 'border-slate-200' : 'border-white/10'
            } ${surface}`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 sm:p-5 border-b ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-xs ${
                    isLight ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white' : 'bg-blue-600 text-white'
                  }`}
                >
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className={`text-sm sm:text-base font-extrabold truncate leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {step === 'done' ? 'Ariza yuborildi' : kind === 'tushuntirish' ? 'Tushuntirish xati' : 'Rasmiy ariza'}
                  </h2>
                  <p className={`text-[11px] truncate mt-0.5 ${muted}`}>
                    {step === 'form' && "1/3 · Ma'lumotlarni to'ldirish"}
                    {step === 'preview' && "2/3 · Hujjatni tekshirish"}
                    {step === 'sign' && "3/3 · Shaxsiy imzo qo'yish"}
                    {step === 'done' && 'Elektron tasdiqlandi'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                data-student-button="plain"
                className="no-shelf flex size-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-40"
                aria-label="Yopish"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            {step !== 'done' && (
              <div
                className={`px-4 sm:px-6 py-2.5 border-b ${
                  isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-slate-950/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  {STEPS.map((s) => {
                    const active = s.id === step
                    const completed =
                      (step === 'preview' && s.num === 1) || (step === 'sign' && s.num <= 2)
                    return (
                      <div key={s.id} className="flex-1 flex flex-col gap-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            completed
                              ? 'bg-emerald-500'
                              : active
                              ? 'bg-blue-600'
                              : isLight
                              ? 'bg-slate-200'
                              : 'bg-white/10'
                          }`}
                        />
                        <span
                          className={`text-[10px] font-bold truncate ${
                            active
                              ? isLight
                                ? 'text-blue-700'
                                : 'text-blue-400'
                              : completed
                              ? isLight
                                ? 'text-emerald-700'
                                : 'text-emerald-400'
                              : isLight
                              ? 'text-slate-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {s.num}. {s.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
              {step === 'form' && (
                <div className="space-y-4">
                  {/* Selects: Ariza turi & Kimning nomiga */}
                  <div className="grid gap-3 min-[420px]:grid-cols-2">
                    <div>
                      <label className={label}>Ariza turi</label>
                      <CustomSelect
                        value={kind}
                        onChange={(v) => setKind(v as ArizaKind)}
                        options={[
                          { value: 'tushuntirish', label: 'Tushuntirish xati' },
                          { value: 'ariza', label: 'Ariza' },
                        ]}
                        className={`${field} no-shelf`}
                        plain
                      />
                    </div>
                    <div>
                      <label className={label}>Kimning nomiga</label>
                      <CustomSelect
                        value={recipient}
                        onChange={(v) => setRecipient(v as ArizaRecipient)}
                        options={RECIPIENT_OPTIONS}
                        className={`${field} no-shelf`}
                        plain
                      />
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className={label}>Mavzu</label>
                    <input
                      className={field}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Masalan: Kechikib qaytish"
                      maxLength={200}
                    />
                  </div>

                  {/* Student Full Name */}
                  <div>
                    <label className={label}>F.I.Sh (to‘liq)</label>
                    <input
                      className={field}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      maxLength={160}
                    />
                  </div>

                  {/* Room metadata card */}
                  <div
                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${
                      isLight
                        ? 'border-slate-200/90 bg-slate-50/70 text-slate-800'
                        : 'border-white/10 bg-white/[0.03] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
                          isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        <Home size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
                          Yashash joyi
                        </p>
                        <p className="text-xs sm:text-sm font-bold truncate leading-snug">
                          {ttjNumber ? `${ttjNumber}-TTJ` : 'TTJ'} • {room ? `${room}-xona` : 'Xona aniqlanmagan'}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 dark:text-emerald-300 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                      <ShieldCheck size={11} /> Tizimdan olindi
                    </span>
                  </div>

                  {/* Details textarea */}
                  <div>
                    <label className={label}>
                      {kind === 'tushuntirish' ? 'Nima bo‘ldi? (voqea tafsiloti)' : 'Iltimosingiz / holat tafsiloti'}
                    </label>
                    <textarea
                      rows={3}
                      className={`${field} resize-none`}
                      value={incidentText}
                      onChange={(e) => setIncidentText(e.target.value)}
                      placeholder={
                        kind === 'tushuntirish'
                          ? 'Masalan: Bugun do‘stlarim bilan tug‘ilgan kunni nishonlab, yotoqxonaga belgilangan vaqtdan kech qaytdim.'
                          : 'Masalan: Sog‘lig‘im tufayli birinchi qavatdagi xonaga o‘tkazishingizni so‘rayman.'
                      }
                    />
                    <div className="mt-2 flex items-start gap-2 rounded-xl border border-blue-200/70 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/30 p-2.5">
                      <Sparkles size={14} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                        Uzr so‘rash, va‘da va rasmiy murojaat matnini tizim davlat andozasi asosida avtomatik shakllantiradi.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {step === 'preview' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-blue-200/80 bg-blue-50/70 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/30">
                    <Sparkles size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    <p className="text-xs text-blue-900 dark:text-blue-200">
                      Quyidagi rasmiy hujjat tuzildi. Tekshirib, xato bo‘lmasa «Imzoga o‘tish»ni bosing.
                    </p>
                  </div>
                  <div className={`overflow-x-auto rounded-2xl p-2 sm:p-4 ${isLight ? 'bg-slate-100' : 'bg-black/30'}`}>
                    <StudentArizaDocument data={compose} />
                  </div>
                </div>
              )}

              {step === 'sign' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold">Elektron imzo chizing</h3>
                    <p className={`mt-0.5 text-xs ${muted}`}>
                      Quyidagi maydonga barmog‘ingiz yoki sichqoncha yordamida imzoingizni qo‘ying.
                    </p>
                  </div>
                  <SignaturePad isLight={isLight} onChange={setSignature} />
                  <label
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-colors ${
                      isLight
                        ? 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={attested}
                      onChange={(e) => setAttested(e.target.checked)}
                      className="mt-0.5 size-4 accent-blue-600 rounded"
                    />
                    <span className={`text-xs leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      Men, <b>{fullName}</b>, ushbu murojaatni shaxsan yozganimni va undagi ma‘lumotlar to‘g‘riligini tasdiqlayman.
                    </span>
                  </label>
                </div>
              )}

              {step === 'done' && receipt && (
                <div className="flex min-h-full flex-col items-center justify-center space-y-4 py-6 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 shadow-xs">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <p className="text-lg font-black">Imzolandi va dekanatga yuborildi</p>
                    <p className={`mt-1 text-xs ${muted}`}>
                      Hujjat qabul qilindi. Nusxasi shaxsiy kabinetingizda saqlanadi.
                    </p>
                  </div>
                  <div
                    className={`w-full max-w-sm rounded-2xl border p-4 outline-none ${
                      isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>Tekshiruv kodi</p>
                    <p className="mt-1 font-mono text-2xl font-black tracking-widest text-blue-600 dark:text-blue-400">
                      {receipt.verifyCode}
                    </p>
                    <button
                      type="button"
                      data-student-button="plain"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(receipt.verifyCode)
                          toast.success('Nusxalandi')
                        } catch {
                          /* */
                        }
                      }}
                      className={`no-shelf mt-2 inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                        isLight
                          ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Copy size={13} /> Nusxalash
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className={`flex items-center gap-2.5 p-4 border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
              {step === 'form' && (
                <button
                  type="button"
                  onClick={() => setStep('preview')}
                  disabled={!formValid}
                  data-student-button="plain"
                  className="no-shelf flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 px-4 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Ko‘rib chiqish</span>
                  <ArrowRight size={14} />
                </button>
              )}
              {step === 'preview' && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    data-student-button="plain"
                    className={`no-shelf flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-4 text-xs font-bold transition-colors ${
                      isLight
                        ? 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                    }`}
                  >
                    <ArrowLeft size={14} />
                    <span>Tahrirlash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('sign')}
                    data-student-button="plain"
                    className="no-shelf flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 px-4 text-xs font-bold text-white shadow-xs transition-colors"
                  >
                    <span>Imzoga o‘tish</span>
                    <ArrowRight size={14} />
                  </button>
                </>
              )}
              {step === 'sign' && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('preview')}
                    disabled={busy}
                    data-student-button="plain"
                    className={`no-shelf flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-4 text-xs font-bold transition-colors disabled:opacity-40 ${
                      isLight
                        ? 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                    }`}
                  >
                    <ArrowLeft size={14} />
                    <span>Orqaga</span>
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!signature || !attested || busy}
                    data-student-button="plain"
                    className="no-shelf flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 px-4 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
                    <span>{busy ? 'Yuborilmoqda…' : 'Imzolash va yuborish'}</span>
                  </button>
                </>
              )}
              {step === 'done' && (
                <>
                  <button
                    type="button"
                    onClick={downloadPdf}
                    data-student-button="plain"
                    className={`no-shelf flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-bold transition-colors ${
                      isLight
                        ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        : 'border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <Download size={14} />
                    <span>PDF yuklab olish</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    data-student-button="plain"
                    className="no-shelf flex flex-1 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 px-4 text-xs font-bold text-white shadow-xs transition-colors"
                  >
                    <span>Yopish</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
