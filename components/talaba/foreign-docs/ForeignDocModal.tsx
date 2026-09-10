'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Plane, Home, Upload, FileText, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import CustomSelect from '@/components/ui/CustomSelect'
import { saveForeignDoc, deleteForeignDoc } from '@/features/foreign-docs/client/api'
import {
  DOC_STATUS_LABELS,
  REGISTRATION_BASIS_LABELS,
  REGISTRATION_BASES,
  type DocType,
  type DocStatus,
  type ForeignDoc,
  type RegistrationBasis,
} from '@/features/foreign-docs/types'

type Props = {
  open: boolean
  isLight: boolean
  docType: DocType
  existing: ForeignDoc | null
  onClose: () => void
  onSaved: () => void
}

const STATUS_OPTIONS: DocStatus[] = ['active', 'renewing', 'cancelled']

export default function ForeignDocModal({ open, isLight, docType, existing, onClose, onSaved }: Props) {
  const isVisa = docType === 'visa'
  const [number, setNumber] = useState('')
  const [issuedOn, setIssuedOn] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [status, setStatus] = useState<DocStatus>('active')
  const [basis, setBasis] = useState<RegistrationBasis | ''>('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setNumber(existing?.number ?? '')
    setIssuedOn(existing?.issuedOn ?? '')
    setExpiresOn(existing?.expiresOn ?? '')
    setStatus(existing?.status ?? 'active')
    setBasis(existing?.registrationBasis ?? '')
    setAddress(existing?.address ?? '')
    setNote(existing?.note ?? '')
    setFile(null)
  }, [open, existing])

  const title = useMemo(() => {
    const kind = isVisa ? 'viza' : 'propiska'
    return existing ? `${isVisa ? 'Viza' : 'Propiska'}ni yangilash` : `Yangi ${kind}`
  }, [existing, isVisa])

  if (!open || typeof document === 'undefined') return null

  const ttjSelected = basis === 'ttj'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!expiresOn) {
      toast.error('Amal qilish muddatini kiriting')
      return
    }
    if (!isVisa && !basis) {
      toast.error("Ro'yxatga qo'yish turini tanlang")
      return
    }
    if (issuedOn && issuedOn > expiresOn) {
      toast.error("Berilgan sana amal qilish muddatidan keyin bo'lolmaydi")
      return
    }
    setBusy(true)
    try {
      await saveForeignDoc(
        {
          id: existing?.id,
          docType,
          number: number.trim() || null,
          issuedOn: issuedOn || null,
          expiresOn,
          status,
          registrationBasis: isVisa ? null : (basis || null),
          address: isVisa ? null : (address.trim() || null),
          note: note.trim() || null,
        },
        file,
      )
      toast.success('Saqlandi')
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saqlab bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!existing) return
    setBusy(true)
    try {
      await deleteForeignDoc(existing.id)
      toast.success("O'chirildi")
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "O'chirib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  const labelCls = `block text-[10px] font-black uppercase tracking-wider mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`
  const fieldCls = `w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all ${
    isLight
      ? 'bg-slate-50 border-slate-300 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
      : 'bg-slate-950 border-white/10 focus:ring-cyan-500/20 focus:border-cyan-400 text-white [color-scheme:dark]'
  }`

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-[24px] border shadow-2xl p-4 sm:p-6 ${
          isLight ? 'bg-white/95 border-slate-200 text-slate-900' : 'bg-slate-950/90 border-white/10 text-white'
        }`}
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-300'}`}>
              {isVisa ? <Plane size={20} /> : <Home size={20} />}
            </div>
            <h3 className="text-lg font-black tracking-tight">{title}</h3>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400'}`}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Viza raqami</label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Masalan: E1234567"
              maxLength={60}
              className={fieldCls}
            />
          </div>

          {!isVisa && (
            <div>
              <label className={labelCls}>Ro&apos;yxatga qo&apos;yish turi</label>
              <CustomSelect
                value={basis}
                onChange={(v) => setBasis(v as RegistrationBasis)}
                placeholder="Tanlang..."
                options={REGISTRATION_BASES.map((b) => ({ value: b, label: REGISTRATION_BASIS_LABELS[b] }))}
                className={fieldCls}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Berilgan sana</label>
              <input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Amal qilish muddati</label>
              <input type="date" required value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Holati</label>
            <CustomSelect
              value={status}
              onChange={(v) => setStatus(v as DocStatus)}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: DOC_STATUS_LABELS[s] }))}
              className={fieldCls}
            />
          </div>

          {!isVisa && (
            <div>
              <label className={labelCls}>Manzil</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={ttjSelected ? 'Yotoqxona nomi avtomatik qo‘yiladi' : 'To‘liq yashash manzili'}
                maxLength={300}
                className={`${fieldCls} resize-none`}
              />
              {ttjSelected && (
                <p className={`mt-1 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Yotoqxonada yashovchilar uchun ro&apos;yxatga qo&apos;yishni yotoqxona ma&apos;muriyati e-mehmon orqali rasmiylashtiradi.
                </p>
              )}
            </div>
          )}

          <div>
            <label className={labelCls}>{isVisa ? 'Viza fayli' : 'Hujjat fayli'} (ixtiyoriy)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                isLight ? 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100' : 'border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {file ? <FileText size={16} /> : <Upload size={16} />}
              <span className="truncate">{file ? file.name : existing?.hasFile ? 'Fayl biriktirilgan — almashtirish' : 'Fayl tanlang (JPG / PNG / PDF)'}</span>
            </button>
          </div>

          <div>
            <label className={labelCls}>Izoh (ixtiyoriy)</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={`${fieldCls} resize-none`} />
          </div>

          <div className="flex gap-3 pt-1">
            {existing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 ${
                  isLight ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                }`}
                data-student-button="plain"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`}
              data-student-button="plain"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all bg-gradient-to-r from-cyan-500 to-blue-600 text-white disabled:opacity-50"
            >
              {busy ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body,
  )
}
