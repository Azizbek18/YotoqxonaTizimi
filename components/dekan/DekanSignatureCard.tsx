'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PenLine, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import SignaturePad from '@/components/applications/SignaturePad'
import { dekanUI } from '@/lib/dekan-ui'

// The dekan draws their electronic signature once. It is auto-stamped onto
// every generated Ariza + Tilxat, alongside the applicant's own signature —
// no per-approval drawing. Without it, documents queue up undelivered.
export default function DekanSignatureCard({ isLight, delay = 0.09 }: { isLight: boolean; delay?: number }) {
  const ui = dekanUI(isLight)
  const [saved, setSaved] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dekan/signature')
      const data = await res.json()
      if (res.ok) setSaved(data.signatureImage ?? null)
    } catch {
      /* the card just shows the "draw it" state */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const res = await fetch('/api/dekan/signature', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureImage: draft }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Imzoni saqlab bo'lmadi")
      setSaved(draft)
      setDraft(null)
      setEditing(false)
      toast.success('Imzo saqlandi — hujjatlarga avtomatik qo‘yiladi')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Xatolik')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-2xl border overflow-hidden ${ui.card}`}
    >
      <div className={`flex items-center gap-3 border-b p-4 sm:px-6 ${ui.border}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
          <PenLine size={18} strokeWidth={2.2} />
        </div>
        <h2 className={`text-sm font-bold ${ui.strong}`}>Elektron imzo</h2>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <p className={`text-xs leading-relaxed ${ui.muted}`}>
          Ariza va Tilxat hujjatlariga qo‘yiladigan imzoingiz. Bir marta chizasiz —
          talaba arizani tasdiqlab, xona biriktirilgach, hujjat ikkala imzo bilan
          avtomatik yaratilib talabaga yuboriladi.
        </p>

        {loading ? (
          <div className={`h-24 animate-pulse rounded-xl ${ui.inset}`} />
        ) : saved && !editing ? (
          <div className="space-y-3">
            <div className={`rounded-xl border p-3 ${ui.inset}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={saved} alt="Dekan imzosi" className="mx-auto h-20 object-contain" />
            </div>
            <p className={`text-[11px] ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>✓ Imzo saqlangan</p>
            <button
              type="button"
              onClick={() => { setEditing(true); setDraft(null) }}
              className={`rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wider ${ui.btnGhost}`}
            >
              Qayta chizish
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {!saved && (
              <div className={`flex items-start gap-3 rounded-xl border p-3 ${isLight ? 'border-amber-200 bg-amber-50' : 'border-amber-500/25 bg-amber-500/10'}`}>
                <ShieldAlert size={16} className={`mt-0.5 shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                <p className={`text-xs font-medium ${isLight ? 'text-amber-800' : 'text-amber-200'}`}>
                  Imzo saqlanmagan — xona biriktirilgan arizalarning Ariza va Tilxat hujjatlari
                  siz imzo qo‘ymaguningizcha talabaga yuborilmaydi.
                </p>
              </div>
            )}
            <SignaturePad isLight={isLight} height={180} onChange={setDraft} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!draft || saving}
                className={`rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed ${ui.accentSolid}`}
              >
                {saving ? 'Saqlanmoqda...' : 'Imzoni saqlash'}
              </button>
              {saved && (
                <button
                  type="button"
                  onClick={() => { setEditing(false); setDraft(null) }}
                  className={`rounded-lg border px-4 py-2.5 text-xs font-bold uppercase tracking-wider ${ui.btnGhost}`}
                >
                  Bekor qilish
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  )
}
