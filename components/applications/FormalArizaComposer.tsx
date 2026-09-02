'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, ArrowRight, PenLine, CheckCircle2, Download, Copy, Loader2 } from 'lucide-react'
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
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : '' ; return () => { document.body.style.overflow = '' } }, [open])

  useEffect(() => {
    if (!open) return
    setStep('form'); setSignature(null); setAttested(false); setReceipt(null); setBusy(false)
    fetchArizaContext().then((c) => {
      setCtx(c)
      setFullName((v) => v || c.fullName)
      setTtjNumber((v) => v || c.ttjNumber)
      setRoom((v) => v || c.room)
    }).catch(() => {})
  }, [open])

  const compose = useMemo(() => ({
    kind, recipient, fullName, facultyLabel: ctx?.facultyLabel ?? '',
    course: ctx?.course ?? '', ttjNumber, room, incidentText,
    dekanName: ctx?.dekanName ?? null,
  }), [kind, recipient, fullName, ctx, ttjNumber, room, incidentText])

  const formValid = title.trim().length >= 3 && fullName.trim().length >= 3 && incidentText.trim().length >= 10

  const submit = useCallback(async () => {
    if (!signature || !attested) return
    setBusy(true)
    try {
      const res = await submitFormalAriza({
        kind, recipient, title: title.trim(), fullName: fullName.trim(),
        ttjNumber: ttjNumber.trim(), room: room.trim(), incidentText: incidentText.trim(),
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
  }, [signature, attested, kind, recipient, title, fullName, ttjNumber, room, incidentText, onSubmitted])

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
  const field = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-blue-500 ${isLight ? 'bg-white border-slate-300' : 'bg-white/5 border-white/15 text-white'}`
  const label = `mb-1 block text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-stretch justify-center sm:items-center sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`relative z-10 flex w-full max-w-2xl flex-col sm:max-h-[92vh] sm:rounded-3xl overflow-hidden border ${isLight ? 'border-slate-200' : 'border-white/10'} ${surface}`}
          >
            <div className={`flex items-center justify-between border-b p-4 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              <div>
                <h2 className="text-base font-black tracking-tight">
                  {step === 'done' ? 'Ariza yuborildi' : 'Yangi ariza'}
                </h2>
                <p className={`text-xs ${muted}`}>
                  {step === 'form' && '1/3 · Ma‘lumotlar'}
                  {step === 'preview' && '2/3 · Ko‘rib chiqish'}
                  {step === 'sign' && '3/3 · Imzo'}
                  {step === 'done' && 'Elektron imzolandi'}
                </p>
              </div>
              <button onClick={onClose} disabled={busy} className={`rounded-lg p-1.5 disabled:opacity-40 ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/5 text-slate-400'}`}>
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
              {step === 'form' && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={label}>Ariza turi</label>
                      <CustomSelect
                        value={kind}
                        onChange={(v) => setKind(v as ArizaKind)}
                        options={[
                          { value: 'tushuntirish', label: 'Tushuntirish xati' },
                          { value: 'ariza', label: 'Ariza' },
                        ]}
                        className={field}
                      />
                    </div>
                    <div>
                      <label className={label}>Kimning nomiga</label>
                      <CustomSelect
                        value={recipient}
                        onChange={(v) => setRecipient(v as ArizaRecipient)}
                        options={RECIPIENT_OPTIONS}
                        className={field}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={label}>Mavzu</label>
                    <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: Kechikib qaytish" maxLength={200} />
                  </div>
                  <div>
                    <label className={label}>F.I.Sh (to‘liq)</label>
                    <input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={160} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={label}>Yotoqxona raqami</label>
                      <input className={field} value={ttjNumber} onChange={(e) => setTtjNumber(e.target.value)} placeholder="12" maxLength={20} />
                    </div>
                    <div>
                      <label className={label}>Xona</label>
                      <input className={field} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="305" maxLength={20} />
                    </div>
                  </div>
                  <div>
                    <label className={label}>{kind === 'tushuntirish' ? 'Nima bo‘ldi? (voqea tafsiloti)' : 'Iltimosingiz / holat tafsiloti'}</label>
                    <textarea
                      className={`${field} min-h-[110px] resize-y`}
                      value={incidentText}
                      onChange={(e) => setIncidentText(e.target.value)}
                      placeholder={kind === 'tushuntirish'
                        ? 'Masalan: Bugun do‘stlarim bilan tug‘ilgan kunni nishonlab, yotoqxonaga belgilangan vaqtdan kech qaytdim.'
                        : 'Masalan: Sog‘lig‘im tufayli birinchi qavatdagi xonaga o‘tkazishingizni so‘rayman.'}
                    />
                    <p className={`mt-1 text-[11px] ${muted}`}>Uzr so‘rash, va‘da va &laquo;jazoga roziman&raquo; qismini tizim o‘zi qo‘shadi — faqat nima bo‘lganini yozing.</p>
                  </div>
                </div>
              )}

              {step === 'preview' && (
                <div className="space-y-3">
                  <p className={`text-xs ${muted}`}>Quyidagi hujjat yuboriladi. Xato bo‘lsa &laquo;Tahrirlash&raquo;ni bosing.</p>
                  <div className={`rounded-2xl p-2 ${isLight ? 'bg-slate-100' : 'bg-black/30'}`}>
                    <StudentArizaDocument data={compose} />
                  </div>
                </div>
              )}

              {step === 'sign' && (
                <div className="space-y-4">
                  <p className={`text-sm ${muted}`}>Quyidagi maydonga <b>o‘z imzoingizni</b> chizing.</p>
                  <SignaturePad isLight={isLight} onChange={setSignature} />
                  <label className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
                    <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                    <span className={`text-xs leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      Men, <b>{fullName}</b>, ushbu arizani o‘zim yozdim va mazmuni to‘g‘riligini tasdiqlayman.
                      Imzo vaqti, qurilmam va IP manzilim qayd etilishiga roziman.
                    </span>
                  </label>
                </div>
              )}

              {step === 'done' && receipt && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                    <CheckCircle2 size={30} />
                  </div>
                  <div>
                    <p className="text-lg font-black">Imzolandi va dekanatga yuborildi</p>
                    <p className={`text-xs ${muted}`}>Nusxa emailingizga{' '}va Telegramingizga (ulangan bo‘lsa) yuborildi</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>Tekshiruv kodi</p>
                    <p className="mt-1 font-mono text-2xl font-black tracking-widest">{receipt.verifyCode}</p>
                    <button
                      onClick={async () => { try { await navigator.clipboard.writeText(receipt.verifyCode); toast.success('Nusxalandi') } catch { /* */ } }}
                      className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}
                    >
                      <Copy size={12} /> Nusxalash
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* footer */}
            <div className={`flex gap-3 border-t p-4 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              {step === 'form' && (
                <button
                  onClick={() => setStep('preview')} disabled={!formValid}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-40"
                >
                  Ko‘rib chiqish <ArrowRight size={14} />
                </button>
              )}
              {step === 'preview' && (
                <>
                  <button onClick={() => setStep('form')} className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wider ${isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-slate-300'}`}>
                    <ArrowLeft size={14} /> Tahrirlash
                  </button>
                  <button onClick={() => setStep('sign')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white">
                    Imzoga o‘tish <ArrowRight size={14} />
                  </button>
                </>
              )}
              {step === 'sign' && (
                <>
                  <button onClick={() => setStep('preview')} disabled={busy} className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wider disabled:opacity-40 ${isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-slate-300'}`}>
                    <ArrowLeft size={14} />
                  </button>
                  <button
                    onClick={submit} disabled={!signature || !attested || busy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
                    {busy ? 'Yuborilmoqda…' : 'Imzolash va yuborish'}
                  </button>
                </>
              )}
              {step === 'done' && (
                <>
                  <button onClick={downloadPdf} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wider ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}>
                    <Download size={14} /> PDF yuklab olish
                  </button>
                  <button onClick={onClose} className="flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white">
                    Yopish
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
