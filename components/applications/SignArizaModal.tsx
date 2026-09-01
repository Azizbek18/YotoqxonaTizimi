'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldCheck, PenLine, CheckCircle2, Copy, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import type { ArizaReceipt } from '@/features/applications/client/api'

// Advisory only — the server (which also transliterates Cyrillic) is the
// real gate. Here we just nudge: strip case/spacing/punctuation and compare.
function nameKey(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-ZА-ЯЁ]/gi, '')
}

type ReviewApp = { title: string; type: 'ariza' | 'tushuntirish'; reason?: string; content: string }

export default function SignArizaModal({
  open,
  onClose,
  app,
  expectedName,
  busy,
  receipt,
  onSign,
  onDownloadReceipt,
}: {
  open: boolean
  onClose: () => void
  app: ReviewApp | null
  expectedName: string
  busy: boolean
  receipt: ArizaReceipt | null
  onSign: (typedName: string) => void
  onDownloadReceipt?: () => void
}) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const [mounted, setMounted] = useState(false)
  const [typed, setTyped] = useState('')
  const [attested, setAttested] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (open) { setTyped(''); setAttested(false) }
  }, [open, app])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const nameMatches = useMemo(
    () => nameKey(typed).length > 0 && nameKey(typed) === nameKey(expectedName),
    [typed, expectedName],
  )
  const canSign = attested && typed.trim().length >= 3 && !busy

  if (!mounted) return null

  const surface = isLight ? 'bg-white border-slate-200' : 'bg-[#0b1120] border-white/10'
  const strong = isLight ? 'text-slate-900' : 'text-white'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'
  const well = isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.03] border-white/10'
  const inputCls = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition ${
    isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-white/5 border-white/15 text-white'
  } ${typed && !nameMatches ? 'border-amber-400 focus:border-amber-400' : 'focus:border-emerald-500'}`

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={busy ? undefined : onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className={`relative z-10 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden rounded-3xl border shadow-2xl ${surface}`}
          >
            {receipt ? (
              <ReceiptView
                receipt={receipt} isLight={isLight} strong={strong} muted={muted} well={well}
                onClose={onClose} onDownload={onDownloadReceipt}
              />
            ) : (
              <>
                <div className={`flex items-start justify-between gap-3 border-b p-5 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h2 className={`text-base font-black tracking-tight ${strong}`}>Arizani imzolash</h2>
                      <p className={`text-xs ${muted}`}>Yuborilgach o‘zgartirib yoki o‘chirib bo‘lmaydi</p>
                    </div>
                  </div>
                  <button onClick={onClose} disabled={busy} className={`rounded-lg p-1.5 disabled:opacity-40 ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/5 text-slate-400'}`}>
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
                  {app && (
                    <div className={`rounded-2xl border p-3.5 ${well}`}>
                      <p className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>
                        {app.type === 'ariza' ? 'Ariza' : 'Tushuntirish'}
                      </p>
                      <p className={`mt-1 text-sm font-bold ${strong}`}>{app.title}</p>
                      <p className={`mt-2 whitespace-pre-wrap text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {app.content}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className={`mb-1 block text-xs font-bold ${strong}`}>F.I.Sh (to‘liq, profilingizdagidek)</label>
                    <input
                      className={inputCls}
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder={expectedName || 'Familiya Ism Sharif'}
                      autoComplete="off"
                      disabled={busy}
                    />
                    {typed && !nameMatches && (
                      <p className="mt-1 text-[11px] text-amber-500">Profilingizdagi F.I.Sh bilan bir xil emasga o‘xshaydi — tekshiring.</p>
                    )}
                  </div>

                  <label className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer ${well}`}>
                    <input
                      type="checkbox" checked={attested} disabled={busy}
                      onChange={(e) => setAttested(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-emerald-600"
                    />
                    <span className={`text-xs leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      Men, <b>{expectedName || 'yuqoridagi shaxs'}</b>, ushbu arizani o‘zim to‘ldirdim va
                      mazmuni to‘g‘riligini tasdiqlayman. Imzo vaqti, qurilmam va IP manzilim qayd etilishiga roziman.
                    </span>
                  </label>
                </div>

                <div className={`flex gap-3 border-t p-5 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                  <button
                    onClick={onClose} disabled={busy}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider disabled:opacity-50 ${
                      isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Bekor
                  </button>
                  <button
                    onClick={() => onSign(typed.trim())}
                    disabled={!canSign}
                    className="flex flex-[1.6] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:brightness-110 disabled:opacity-40"
                  >
                    <PenLine size={14} />
                    {busy ? 'Imzolanmoqda…' : 'Imzolash va yuborish'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function ReceiptView({
  receipt, isLight, strong, muted, well, onClose, onDownload,
}: {
  receipt: ArizaReceipt
  isLight: boolean
  strong: string
  muted: string
  well: string
  onClose: () => void
  onDownload?: () => void
}) {
  const when = new Date(receipt.signedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
  const copy = async () => {
    try { await navigator.clipboard.writeText(receipt.verifyCode); toast.success('Kod nusxalandi') }
    catch { toast.error('Nusxalab bo‘lmadi') }
  }
  return (
    <>
      <div className="flex flex-col items-center gap-2 px-6 pt-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 size={30} />
        </div>
        <h2 className={`text-lg font-black ${strong}`}>Ariza imzolandi va yuborildi</h2>
        <p className={`text-xs ${muted}`}>{when} (Toshkent) · nusxa emailingizga yuborildi</p>
      </div>

      <div className="p-6 space-y-3">
        <div className={`rounded-2xl border p-4 text-center ${well}`}>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>Tekshiruv kodi</p>
          <p className={`mt-1 font-mono text-2xl font-black tracking-widest ${strong}`}>{receipt.verifyCode}</p>
          <button onClick={copy} className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
            <Copy size={12} /> Nusxalash
          </button>
        </div>
        <p className={`text-[11px] leading-relaxed ${muted}`}>
          Hujjat hash: <span className="font-mono">{receipt.hashShort}…</span><br />
          Bu kod bilan istalgan vaqtda <b>meningyotoqxonam.uz/ariza-tekshirish</b> orqali imzoni tekshirish mumkin.
        </p>

        <div className="flex gap-3 pt-1">
          {onDownload && (
            <button
              onClick={onDownload}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider ${
                isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <Download size={14} /> Tilxat (PDF)
            </button>
          )}
          <button
            onClick={onClose}
            className="flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700"
          >
            Yopish
          </button>
        </div>
      </div>
    </>
  )
}
