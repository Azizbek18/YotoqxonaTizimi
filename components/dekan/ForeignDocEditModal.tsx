'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ShieldCheck, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import CustomSelect from '@/components/ui/CustomSelect'
import { dekanUI } from '@/lib/dekan-ui'
import { patchForeignDoc, dekanForeignDocFileUrl } from '@/features/foreign-docs/client/api'
import {
  DOC_STATUS_LABELS,
  DOC_TYPE_LABELS,
  REGISTRATION_BASES,
  REGISTRATION_BASIS_LABELS,
  type DocStatus,
  type ForeignDocDashboardRow,
  type RegistrationBasis,
} from '@/features/foreign-docs/types'

type Props = {
  isLight: boolean
  doc: ForeignDocDashboardRow
  onClose: () => void
  onSaved: () => void
}

const STATUSES: DocStatus[] = ['active', 'renewing', 'cancelled']

export default function ForeignDocEditModal({ isLight, doc, onClose, onSaved }: Props) {
  const ui = dekanUI(isLight)
  const [number, setNumber] = useState(doc.number ?? '')
  const [issuedOn, setIssuedOn] = useState(doc.issuedOn ?? '')
  const [expiresOn, setExpiresOn] = useState(doc.expiresOn)
  const [status, setStatus] = useState<DocStatus>(doc.status)
  const [basis, setBasis] = useState<RegistrationBasis | ''>(doc.registrationBasis ?? '')
  const [address, setAddress] = useState(doc.address ?? '')
  const [note, setNote] = useState(doc.note ?? '')
  const [verified, setVerified] = useState(Boolean(doc.verifiedAt))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  const isVisa = doc.docType === 'visa'

  const save = async () => {
    if (!expiresOn) {
      toast.error('Amal qilish muddatini kiriting')
      return
    }
    setBusy(true)
    try {
      await patchForeignDoc(doc.id, {
        number: number.trim() || null,
        issuedOn: issuedOn || null,
        expiresOn,
        status,
        registrationBasis: isVisa ? null : (basis || null),
        address: isVisa ? null : address.trim() || null,
        note: note.trim() || null,
        verified,
      })
      toast.success('Saqlandi')
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saqlab bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  const openFile = async () => {
    try {
      window.open(await dekanForeignDocFileUrl(doc.id), '_blank', 'noopener')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Faylni ochib bo'lmadi")
    }
  }

  const label = `mb-1.5 block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`
  const field = `w-full rounded-lg border px-3 py-2.5 text-sm ${ui.input} ${ui.ring}`

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-5 sm:p-6 ${ui.card}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className={`text-base font-bold ${ui.strong}`}>{DOC_TYPE_LABELS[doc.docType]} — tahrirlash</h3>
            <p className={`mt-0.5 text-xs ${ui.muted}`}>{doc.studentName}</p>
          </div>
          <button onClick={onClose} className={`rounded-lg border p-1.5 ${ui.btnGhost}`}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={label}>{isVisa ? 'Viza raqami' : "Ro'yxatga qo'yish (propiska) raqami"}</label>
            <input value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} className={field} />
          </div>

          {!isVisa && (
            <div>
              <label className={label}>Ro&apos;yxatga qo&apos;yish turi</label>
              <CustomSelect
                value={basis}
                onChange={(v) => setBasis(v as RegistrationBasis)}
                placeholder="Tanlang..."
                options={REGISTRATION_BASES.map((b) => ({ value: b, label: REGISTRATION_BASIS_LABELS[b] }))}
                className={field}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Berilgan sana</label>
              <input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Amal qilish muddati</label>
              <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={field} />
            </div>
          </div>

          <div>
            <label className={label}>Holati</label>
            <CustomSelect
              value={status}
              onChange={(v) => setStatus(v as DocStatus)}
              options={STATUSES.map((s) => ({ value: s, label: DOC_STATUS_LABELS[s] }))}
              className={field}
            />
          </div>

          {!isVisa && (
            <div>
              <label className={label}>Manzil</label>
              <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} className={`${field} resize-none`} />
            </div>
          )}

          <div>
            <label className={label}>Izoh</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={`${field} resize-none`} />
          </div>

          <button
            type="button"
            onClick={() => setVerified((v) => !v)}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
              verified
                ? isLight ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : ui.btnGhost
            }`}
          >
            <ShieldCheck size={14} />
            {verified ? 'Tekshirilgan deb belgilangan' : 'Tekshirilgan deb belgilash'}
          </button>

          {doc.hasFile && (
            <button type="button" onClick={openFile} className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${ui.btnGhost}`}>
              <FileText size={14} /> Biriktirilgan faylni ochish
            </button>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className={`flex-1 rounded-lg border px-4 py-2.5 text-xs font-bold uppercase tracking-wider ${ui.btnGhost}`}>
              Bekor qilish
            </button>
            <button onClick={save} disabled={busy} className={`flex-1 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider ${ui.accentSolid}`}>
              {busy ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
