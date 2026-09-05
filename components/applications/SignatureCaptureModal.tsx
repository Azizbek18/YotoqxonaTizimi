'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, PenLine, Loader2 } from 'lucide-react'
import SignaturePad from './SignaturePad'

/**
 * A fixed, non-scrolling modal for drawing + confirming a signature — used
 * by the dekan's own e-signature setup and both student permit wizards
 * (yo'llanma/imtiyozli). Drawing a signature INLINE in a long scrollable
 * page/wizard step let the surrounding content shift the canvas out from
 * under the finger mid-stroke ("surilib ketish"); a fixed modal isolates it
 * from that entirely. Confirming closes the modal (the caller decides what
 * "continue" means — save immediately, or just record the signature and
 * let the caller's own submit button do the rest); a visible "Tahrirlash"
 * button at the call site re-opens the SAME modal to redraw.
 */
export default function SignatureCaptureModal({
  open,
  onClose,
  onConfirm,
  isLight,
  title = "Imzo qo'ying",
  description,
  attestLabel,
  confirmLabel = 'Tasdiqlash',
  busy = false,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (signature: string) => void | Promise<void>
  isLight: boolean
  title?: string
  description?: string
  /** Attestation checkbox text — omitted skips the checkbox entirely (the
   *  dekan's own signature has nothing to attest to, unlike an applicant's). */
  attestLabel?: React.ReactNode
  confirmLabel?: string
  busy?: boolean
  /** Extra content rendered above the signature pad (e.g. a document preview). */
  children?: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [attested, setAttested] = useState(false)

  useEffect(() => setMounted(true), [])

  // Fresh canvas + unchecked attestation every time the modal opens — a
  // stale signature from a previous open must never be silently confirmable.
  useEffect(() => {
    if (open) { setSignature(null); setAttested(false) }
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!mounted) return null

  const needsAttest = Boolean(attestLabel)
  const canConfirm = Boolean(signature) && (!needsAttest || attested) && !busy

  const surface = isLight ? 'bg-white text-slate-900' : 'bg-[#0b1120] text-white'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-stretch justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={busy ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`relative z-10 flex w-full max-w-lg flex-col sm:max-h-[92vh] sm:rounded-3xl overflow-hidden border ${isLight ? 'border-slate-200' : 'border-white/10'} ${surface}`}
          >
            <div className={`flex items-center justify-between border-b p-4 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              <h2 className="text-sm font-black tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                disabled={busy}
                className={`rounded-lg p-1.5 disabled:opacity-40 ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/5 text-slate-400'}`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar">
              {description && <p className={`text-xs leading-relaxed ${muted}`}>{description}</p>}
              {children}
              <SignaturePad isLight={isLight} height={180} onChange={setSignature} />
              {attestLabel && (
                <label className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer ${
                  attested
                    ? (isLight ? 'border-emerald-300 bg-emerald-50' : 'border-emerald-500/30 bg-emerald-500/10')
                    : (isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]')
                }`}>
                  <input
                    type="checkbox"
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                  />
                  <span className={`text-xs leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{attestLabel}</span>
                </label>
              )}
            </div>

            <div className={`flex gap-3 border-t p-4 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wider disabled:opacity-40 ${
                  isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-slate-300'
                }`}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => signature && onConfirm(signature)}
                disabled={!canConfirm}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-40"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
