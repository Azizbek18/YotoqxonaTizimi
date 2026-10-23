'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Plane, Home, FileSignature, Upload, FileText, Trash2, Loader2, Sparkles, Check, Compass, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import CustomSelect from '@/components/ui/CustomSelect'
import { prepareAiAnalysisFile, prepareUploadFile } from '@/lib/prepare-upload'
import { saveForeignDoc, deleteForeignDoc, scanForeignDoc } from '@/features/foreign-docs/client/api'
import { VISA_TERM_TOO_LONG_MESSAGE, visaTermTooLong } from '@/features/foreign-docs/domain/expiry'
import { fetchStudentProfile } from '@/features/profile/client/api'
import AddressMapPicker from './AddressMapPicker'
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
  const isLease = docType === 'lease'
  const [landlordName, setLandlordName] = useState('')
  const [landlordPhone, setLandlordPhone] = useState('')
  const [number, setNumber] = useState('')
  const [issuedOn, setIssuedOn] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [status, setStatus] = useState<DocStatus>('active')
  const [basis, setBasis] = useState<RegistrationBasis | ''>('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preparingFile, setPreparingFile] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showMap, setShowMap] = useState(false)
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
    setLandlordName(existing?.landlordName ?? '')
    setLandlordPhone(existing?.landlordPhone ?? '')
    setShowMap(Boolean(existing?.address))
    setFile(null)
    setPreparingFile(false)
  }, [open, existing])

  // Same client-side pre-flight every other upload in the app runs (avatar,
  // passport photo, yo'llanma doc) — HEIC→JPEG plus a downscale/re-encode
  // when the file would otherwise trip the server's 4 MB cap or magic-byte
  // check.
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!picked) return
    setPreparingFile(true)
    try {
      const prepared = await prepareUploadFile(picked, { allowPdf: true, maxDimension: 2200 })
      if (!prepared.ok) {
        toast.error(prepared.message)
        return
      }
      setFile(prepared.file)
      // AI muddat/raqamni o'qib BO'SH maydonlarni to'ldiradi. PDF'ning faqat
      // birinchi sahifasi rasmga aylantirilib o'qiladi; saqlanadigan fayl esa
      // asl PDF'ligicha qoladi.
      let scanFile: File | null = prepared.file.type.startsWith('image/') ? prepared.file : null
      if (!scanFile && prepared.file.type === 'application/pdf') {
        try {
          scanFile = await prepareAiAnalysisFile(prepared.file)
        } catch {
          // PDF rasmga aylanmadi — forma qo'lda to'ldiriladi.
        }
      }
      if (scanFile) {
        setScanning(true)
        try {
          const scan = await scanForeignDoc(docType, scanFile)
          if (scan?.notVisa) {
            toast.error("Bu rasm vizaga o'xshamaydi (muddati 1 yildan uzoq) — pasport emas, viza stikerini yuklang", { duration: 6000 })
          } else if (scan) {
            if (scan.number) setNumber((cur) => cur || scan.number!)
            if (scan.issuedOn) setIssuedOn((cur) => cur || scan.issuedOn!)
            if (scan.expiresOn) setExpiresOn((cur) => cur || scan.expiresOn!)
            if (scan.address && !isVisa) setAddress((cur) => cur || scan.address!)
            toast.success("Rasmdan o'qildi — kiritilgan ma'lumotni tekshirib oling", { icon: '✨' })
          } else {
            toast("Rasmdan o'qib bo'lmadi — qo'lda kiriting", { icon: 'ℹ️' })
          }
        } catch {
          // Skaner yordamchi: xato bo'lsa forma qo'lda to'ldiriladi.
        } finally {
          setScanning(false)
        }
      }
    } catch {
      toast.error("Faylni tayyorlab bo'lmadi. Boshqa fayl tanlang.")
    } finally {
      setPreparingFile(false)
    }
  }

  // Yangi propiska/ijara: manzil KV-talabaning "Turgan manzil"idan oldindan
  // to'ldiriladi (qayta yozish shart emas, o'zgartirsa bo'ladi).
  useEffect(() => {
    if (!open || existing || isVisa) return
    let cancelled = false
    fetchStudentProfile()
      .then(({ profile }) => {
        if (!cancelled && profile?.residence_address) setAddress((cur) => cur || profile.residence_address!)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, existing, isVisa])

  const title = useMemo(() => {
    if (isLease) return existing ? 'Ijara shartnomasini yangilash' : 'Ijara shartnomasi ma\'lumotlari'
    const kind = isVisa ? 'Viza' : 'Propiska (ro‘yxatga olish)'
    return existing ? `${kind}ni yangilash` : `${kind} ma'lumotlari`
  }, [existing, isVisa, isLease])

  if (!open || typeof document === 'undefined') return null

  const ttjSelected = basis === 'ttj'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!expiresOn) {
      toast.error('Amal qilish muddatini kiriting')
      return
    }
    if (!isVisa && !isLease && !basis) {
      toast.error("Ro'yxatga qo'yish turini tanlang")
      return
    }
    if (issuedOn && issuedOn > expiresOn) {
      toast.error("Berilgan sana amal qilish muddatidan keyin bo'lolmaydi")
      return
    }
    if (isVisa && visaTermTooLong(issuedOn || null, expiresOn)) {
      toast.error(VISA_TERM_TOO_LONG_MESSAGE, { duration: 6000 })
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
          registrationBasis: isVisa || isLease ? null : (basis || null),
          address: isVisa ? null : (address.trim() || null),
          landlordName: isLease ? (landlordName.trim() || null) : null,
          landlordPhone: isLease ? (landlordPhone.trim() || null) : null,
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

  const labelCls = `block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5`
  const fieldCls = `w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-hidden focus:ring-2 transition-all ${
    isLight
      ? 'bg-slate-50/70 border-slate-200 focus:bg-white focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
      : 'bg-slate-950/80 border-slate-800 focus:ring-cyan-500/20 focus:border-cyan-400 text-white [color-scheme:dark]'
  }`

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.95, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className={`relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border shadow-2xl p-4 sm:p-6 transition-all ${
          isLight ? 'bg-white border-slate-200/90 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-xs ${
                isLight ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white' : 'bg-blue-600 text-white'
              }`}
            >
              {isVisa ? <Plane size={18} /> : isLease ? <FileSignature size={18} /> : <Home size={18} />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold truncate leading-tight">{title}</h3>
              <p className={`text-[11px] truncate mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Yashash joyi hisobi va muddat nazorati
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-student-button="plain"
            className="no-shelf flex size-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label="Yopish"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Smart AI OCR Banner */}
          <div
            className={`rounded-2xl border p-3.5 transition-all ${
              isLight
                ? 'border-blue-200/90 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-white shadow-2xs'
                : 'border-blue-500/25 bg-gradient-to-r from-blue-950/35 via-indigo-950/20 to-slate-900/60 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-xs">
                <Sparkles size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Aqlli tezkor to‘ldirish (AI Skaner)
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    Tavsiya
                  </span>
                </div>
                <p className={`mt-0.5 text-[11px] leading-tight ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {isVisa || isLease
                    ? 'Hujjat rasmini yuklang — raqam va muddat avtomatik aniqlanadi.'
                    : 'Hujjat rasmini yuklang — sana va manzil avtomatik aniqlanadi.'}
                </p>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              disabled={preparingFile || scanning}
              onClick={() => fileRef.current?.click()}
              data-student-button="plain"
              className={`no-shelf mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2 px-3 text-xs font-bold transition-all shadow-2xs ${
                isLight
                  ? 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50/80 hover:border-blue-300'
                  : 'border-white/10 bg-slate-900 text-blue-300 hover:bg-slate-800'
              } disabled:opacity-60`}
            >
              {preparingFile || scanning ? (
                <>
                  <Loader2 size={14} className="animate-spin text-blue-600" />
                  <span>{scanning ? "AI rasmdan ma'lumotlarni o‘qimoqda..." : "Fayl tayyorlanmoqda..."}</span>
                </>
              ) : file ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <span className="ml-auto text-[10px] font-normal text-slate-400">O‘zgartirish</span>
                </>
              ) : existing?.hasFile ? (
                <>
                  <FileText size={14} className="text-blue-500" />
                  <span>Fayl biriktirilgan — yangisini tanlash</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>Hujjat rasmi yoki PDF yuklash</span>
                </>
              )}
            </button>
          </div>

          {/* Form fields */}
          {/* Propiska qayd varag'ida alohida raqam yo'q — maydon faqat viza va ijara uchun. */}
          {(isVisa || isLease) && (
            <div>
              <label className={labelCls}>{isVisa ? 'Viza raqami' : 'Shartnoma raqami'}</label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder={isVisa ? 'Masalan: E1234567' : 'Masalan: 12/2026'}
                maxLength={60}
                className={fieldCls}
              />
            </div>
          )}

          {!isVisa && !isLease && (
            <div>
              <label className={labelCls}>Ro‘yxatga qo‘yish turi</label>
              <CustomSelect
                value={basis}
                onChange={(v) => setBasis(v as RegistrationBasis)}
                placeholder="Tanlang..."
                options={REGISTRATION_BASES.map((b) => ({ value: b, label: REGISTRATION_BASIS_LABELS[b] }))}
                className={`${fieldCls} no-shelf`}
                plain
              />
            </div>
          )}

          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Berilgan sana</label>
              <input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>
                Amal qilish muddati <span className="text-rose-500">*</span>
              </label>
              <input type="date" required value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Holati</label>
            <CustomSelect
              value={status}
              onChange={(v) => setStatus(v as DocStatus)}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: DOC_STATUS_LABELS[s] }))}
              className={`${fieldCls} no-shelf`}
              plain
            />
          </div>

          {isLease && (
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Uy egasi (ixtiyoriy)</label>
                <input
                  type="text"
                  value={landlordName}
                  onChange={(e) => setLandlordName(e.target.value)}
                  maxLength={120}
                  placeholder="F.I.Sh"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>Uy egasi telefoni</label>
                <input
                  type="tel"
                  value={landlordPhone}
                  onChange={(e) => setLandlordPhone(e.target.value)}
                  maxLength={30}
                  placeholder="+998 90 123 45 67"
                  className={fieldCls}
                />
              </div>
            </div>
          )}

          {!isVisa && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls}>Yashash manzili</label>
                {!ttjSelected && !isLease && (
                  <button
                    type="button"
                    onClick={() => setShowMap((prev) => !prev)}
                    data-student-button="plain"
                    className="no-shelf inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Compass size={12} /> {showMap ? 'Xaritani berkitish' : 'Xaritadan tanlash'}
                  </button>
                )}
              </div>

              {!ttjSelected && !isLease && showMap && (
                <div className="mb-2.5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                  <AddressMapPicker isLight={isLight} onResolved={(name) => setAddress(name)} />
                </div>
              )}

              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={ttjSelected ? 'Yotoqxona nomi avtomatik qo‘yiladi' : isLease ? 'Ijaraga olingan uy manzili' : "Manzilni kiriting yoki xaritadan tanlang"}
                maxLength={300}
                className={`${fieldCls} resize-none`}
              />
              {ttjSelected && (
                <div className="mt-1.5 flex items-start gap-2 rounded-xl border border-blue-200/80 bg-blue-50/70 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/30">
                  <Home size={14} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                    Yotoqxonada yashovchilar uchun ro‘yxatga qo‘yishni TTJ ma‘muriyati rasmiylashtiradi.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelCls}>Izoh (ixtiyoriy)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Qo‘shimcha eslatma yoki izoh..."
              maxLength={1000}
              className={`${fieldCls} resize-none`}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            {existing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                data-student-button="plain"
                className="no-shelf flex size-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 transition-colors disabled:opacity-50"
                title="O‘chirish"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              data-student-button="plain"
              className={`no-shelf flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition-colors border ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={busy || preparingFile || scanning}
              data-student-button="plain"
              className="no-shelf flex-1 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              <span>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body,
  )
}
