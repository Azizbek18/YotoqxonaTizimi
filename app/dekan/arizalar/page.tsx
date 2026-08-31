'use client'

import React, { useCallback, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { downloadXlsx } from '@/lib/spreadsheet-export'
import {
  Search,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  X,
  ExternalLink,
  ChevronRight,
  Undo2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useDekanScope } from '@/lib/hooks/useDekanScope'
import { getAuthHeaders } from '@/lib/auth-session'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  approvePermitRequest,
  cancelPermitApproval,
  fetchDekanOverview,
  rejectPermitRequest,
} from '@/features/permits/client/admin-api'
import { permitFacultyLabel } from '@/lib/faculties'
import { directionLabel } from '@/lib/directions'
import { genderLabel } from '@/lib/gender'
import { dekanUI, statusChip, type DekanStatusTone } from '@/lib/dekan-ui'
import { SkelList } from '@/components/dekan/Skeletons'
import { Loader } from '@/components/ui/Loader'

interface PermitRequest {
  id: string
  passport_series: string
  jshshir: string | null
  full_name: string
  email: string
  phone: string
  gender: string
  faculty: string
  direction: string
  course: number
  permit_url: string
  status: 'pending' | 'approved' | 'rejected' | 'registered'
  room_number: string | null
  reject_reason: string | null
  created_at: string
  warning_count?: number
  blacklisted?: boolean
  /** 'yollanma' (government referral) | 'imtiyozli' (foreign/privileged —
   *  Ariza+Tilxat+passport photo instead). */
  application_type?: string
  relative_phone?: string | null
  origin_country?: string | null
  origin_region?: string | null
  study_type?: string | null
}

const STATUS_META: Record<PermitRequest['status'], { label: string; tone: DekanStatusTone }> = {
  pending: { label: 'Kutilmoqda', tone: 'warning' },
  approved: { label: 'Tasdiqlangan', tone: 'success' },
  rejected: { label: 'Rad etilgan', tone: 'danger' },
  registered: { label: 'Ro‘yxatdan o‘tgan', tone: 'info' },
}

function ArizalarContent() {
  const searchParams = useSearchParams()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const ui = dekanUI(isLight)

  // State
  const [requests, setRequests] = useState<PermitRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<PermitRequest['status']>('pending')
  const [facultyFilter, setFacultyFilter] = useState('')
  const [selectedReq, setSelectedReq] = useState<PermitRequest | null>(null)
  const { faculty: dekanFaculty, effectiveFaculty, role: dekanRole, scope: saScope, resolved: facultyResolved } = useDekanScope()
  // Superadmin acting cross-faculty — one queue over all 13 faculties, with
  // step-in approve/reject (server routes through updateGlobal()).
  const isGlobal = dekanRole === 'admin' && (!saScope || saScope === '*')

  // Confirmation modals
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  const handleViewDocument = async () => {
    if (!selectedReq) return
    const response = await fetch(`/api/staff/permit-document?id=${encodeURIComponent(selectedReq.id)}`, {
      headers: await getAuthHeaders(),
    })
    const result = await response.json()
    if (!response.ok || !result.url) {
      toast.error(result.error || 'Hujjatni ochib bo‘lmadi')
      return
    }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  // Faculty-scoped for a dekan; all 13 faculties for a global superadmin
  // (the server returns overviewGlobal() off staff.superadminGlobal).
  const fetchRequests = useCallback(async (faculty: string | null) => {
    setLoading(true)
    try {
      if (!faculty && !isGlobal) {
        setRequests([])
        setLoading(false)
        return
      }

      const overview = await fetchDekanOverview()
      setRequests(overview.requests as PermitRequest[])
    } catch (err) {
      console.error('Error fetching permits:', err)
      toast.error("Yo'llanmalarni yuklashda xatolik yuz berdi")
    } finally {
      setLoading(false)
    }
  }, [isGlobal])

  useEffect(() => {
    if (!facultyResolved) return
    fetchRequests(dekanFaculty)
  }, [facultyResolved, dekanFaculty, fetchRequests])

  // Auto-open request from URL query params
  useEffect(() => {
    const id = searchParams.get('id')
    if (id && requests.length > 0) {
      const found = requests.find((r) => r.id === id)
      if (found) {
        setSelectedReq(found)
      }
    }
  }, [searchParams, requests])

  // Faculties present in the current queue (global mode only) — for the
  // per-faculty dropdown filter.
  const facultiesInQueue = isGlobal
    ? Array.from(new Set(requests.map((r) => r.faculty)))
        .sort((a, b) => permitFacultyLabel(a).localeCompare(permitFacultyLabel(b)))
    : []

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    const matchesStatus = req.status === statusFilter
    const matchesFaculty = !facultyFilter || req.faculty === facultyFilter
    const matchesSearch =
      req.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.passport_series.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.jshshir?.includes(searchTerm) ?? false) ||
      req.faculty.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesStatus && matchesFaculty && matchesSearch
  })

  // Export to Excel helper — boshqa hisobot eksportlari bilan bir xil dizayn:
  // № ustuni, qalin Times New Roman sarlavha, har bir katakka ramka
  const exportToExcel = async (dataToExport: PermitRequest[]) => {
    const headers = [
      '№',
      'F.I.Sh.',
      'Turi',
      'Pasport Seriyasi',
      'JShSHIR',
      'Telefon',
      'Email',
      'Jinsi',
      'Fakultet',
      "Yo'nalish",
      'Kurs',
      'Xona raqami',
      'Status',
      'Yuborilgan sana',
    ]

    const rawRows = dataToExport.map((req, idx) => [
      String(idx + 1),
      req.full_name,
      req.application_type === 'imtiyozli' ? 'Ariza/Tilxat' : "Yo'llanma",
      req.passport_series,
      req.jshshir ?? '-',
      req.phone,
      req.email,
      genderLabel(req.gender),
      permitFacultyLabel(req.faculty),
      directionLabel(req.direction),
      `${req.course}-kurs`,
      req.room_number ? `№-${req.room_number}` : 'Biriktirilmagan',
      req.status,
      new Date(req.created_at).toLocaleDateString('uz-UZ'),
    ])

    downloadXlsx({
      filename: `yotoqxona_arizalar_${statusFilter}.xlsx`,
      sheetName: 'Arizalar',
      headers,
      rows: rawRows,
    })

    toast.success("Excel muvaffaqiyatli yuklab olindi!")
  }

  // Handle approval — room assignment happens later, in the roomless-students
  // queue on the Xonalar page, once the student has self-registered.
  const handleApprove = async () => {
    if (!selectedReq) return

    setProcessing(true)
    try {
      await approvePermitRequest(selectedReq.id)

      toast.success(`${selectedReq.full_name}ning arizasi tasdiqlandi. Xona ro'yxatdan o'tgach, Xonalar sahifasidagi navbatda biriktiriladi.`)
      setApproveModalOpen(false)

      await fetchRequests(dekanFaculty)
      setSelectedReq(null)
    } catch (err) {
      console.error(err)
      toast.error("Tasdiqlashda xatolik yuz berdi")
    } finally {
      setProcessing(false)
    }
  }

  // Undo an approval — sends it back to the pending queue and frees any
  // pre-reserved room. Blocked server-side once the applicant has an
  // account; the message from there is surfaced verbatim.
  const handleCancel = async () => {
    if (!selectedReq) return

    setProcessing(true)
    try {
      await cancelPermitApproval(selectedReq.id)

      toast.success(`${selectedReq.full_name}ning tasdig'i bekor qilindi — ariza "Kutilmoqda"ga qaytdi`)
      setCancelModalOpen(false)

      await fetchRequests(dekanFaculty)
      setSelectedReq(null)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Bekor qilishda xatolik yuz berdi")
    } finally {
      setProcessing(false)
    }
  }

  // Handle reject request
  const handleReject = async () => {
    if (!selectedReq) return
    if (!rejectReason.trim()) {
      toast.error("Rad etish sababini yozing!")
      return
    }

    setProcessing(true)
    try {
      await rejectPermitRequest(selectedReq.id, rejectReason)

      toast.success("Ariza rad etildi")
      setRejectModalOpen(false)
      setRejectReason('')

      await fetchRequests(dekanFaculty)
      setSelectedReq(null)
    } catch (err) {
      console.error(err)
      toast.error("Rad etishda xatolik yuz berdi")
    } finally {
      setProcessing(false)
    }
  }

  const fieldRow = (label: string, value: React.ReactNode) => (
    <div className={`flex justify-between gap-3 py-1.5 border-b ${ui.border}`}>
      <span className={ui.muted}>{label}</span>
      <span className={`font-semibold text-right ${ui.strong}`}>{value}</span>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* List panel */}
      <div className="lg:col-span-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${ui.strong}`}>Yo‘llanmalar ro‘yxati</h1>
            <p className={`text-xs mt-1 ${ui.muted}`}>
              {isGlobal
                ? 'Barcha fakultetlar bo‘yicha — dekani yo‘q fakultet arizalarini ham shu yerdan tasdiqlang'
                : effectiveFaculty
                  ? `${permitFacultyLabel(effectiveFaculty)} fakulteti bo'yicha kelib tushgan ruxsatnomalar`
                  : 'Kelib tushgan ruxsatnomalarni tekshirish va tasdiqlash'}
            </p>
          </div>

          <button
            onClick={() => exportToExcel(filteredRequests)}
            disabled={filteredRequests.length === 0}
            className={`shrink-0 inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 ${ui.btnGhost}`}
          >
            <Download size={14} /> Excel yuklab olish
          </button>
        </div>

        {facultyResolved && !effectiveFaculty && !isGlobal && (
          <div className={`flex items-start gap-2 rounded-xl border p-4 text-xs font-medium ${
            isLight ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-amber-500/25 bg-amber-500/10 text-amber-200'
          }`}>
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              Hisobingizga fakultet biriktirilmagan, shuning uchun hech qanday ariza ko&apos;rsatilmayapti. Administratorga murojaat qilib, profilingizga fakultet qo&apos;shishini so&apos;rang.
            </span>
          </div>
        )}

        {/* Filters */}
        <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${ui.card}`}>
          <div className="relative">
            <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${ui.faint}`} />
            <input
              type="text"
              placeholder="Qidirish (ism, pasport, JShSHIR, fakultet)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full text-sm py-3 pl-12 pr-11 rounded-xl border transition-colors ${ui.input} ${ui.ring}`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Qidiruvni tozalash"
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {isGlobal && facultiesInQueue.length > 0 && (
            <select
              value={facultyFilter}
              onChange={(e) => { setFacultyFilter(e.target.value); setSelectedReq(null) }}
              className={`w-full text-sm py-2.5 px-3 rounded-xl border transition-colors ${ui.input} ${ui.ring}`}
            >
              <option value="">Barcha fakultetlar ({requests.length})</option>
              {facultiesInQueue.map((f) => (
                <option key={f} value={f}>
                  {permitFacultyLabel(f)} ({requests.filter((r) => r.faculty === f).length})
                </option>
              ))}
            </select>
          )}

          <div className={`flex flex-wrap gap-1 rounded-xl p-1 ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`}>
            {(Object.keys(STATUS_META) as PermitRequest['status'][]).map((status) => {
              const count = requests.filter((r) => r.status === status && (!facultyFilter || r.faculty === facultyFilter)).length
              const meta = STATUS_META[status]
              const chip = statusChip(meta.tone, isLight)
              const isActive = statusFilter === status
              return (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status)
                    setSelectedReq(null)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : `${ui.muted} ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-200'}`
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white' : chip.dot}`} />
                  {meta.label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <SkelList count={6} />
        ) : filteredRequests.length === 0 ? (
          <div className={`rounded-2xl border p-10 text-center ${ui.card}`}>
            <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-slate-500'}`}>
              <FileText size={20} />
            </div>
            <p className={`text-xs font-medium ${ui.muted}`}>Ushbu holatda arizalar topilmadi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((req) => {
              const isSelected = selectedReq?.id === req.id
              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setSelectedReq(req)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    isSelected
                      ? isLight ? 'border-indigo-400 bg-indigo-500/[0.05]' : 'border-indigo-500/60 bg-indigo-500/10'
                      : `${ui.card} hover:border-indigo-400/50`
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-300'}`}>
                        {req.full_name.trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className={`text-xs font-semibold ${ui.strong}`}>{req.full_name}</h3>
                          {req.application_type === 'imtiyozli' && (
                            <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-300'}`}>
                              Ariza/Tilxat
                            </span>
                          )}
                          {req.blacklisted && (
                            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
                              Qora ro‘yxat
                            </span>
                          )}
                          {req.warning_count && req.warning_count > 0 ? (
                            <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${statusChip('warning', isLight).chip}`}>
                              <AlertTriangle size={8} /> {req.warning_count} ogohlantirish
                            </span>
                          ) : null}
                        </div>
                        <p className={`text-[10px] mt-1 ${ui.muted}`}>
                          {permitFacultyLabel(req.faculty)} • {directionLabel(req.direction)} • {req.course}-kurs
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-left sm:text-right">
                        {req.room_number ? (
                          <span className={`text-[10px] font-semibold ${statusChip('success', isLight).text}`}>
                            Xona № {req.room_number}
                          </span>
                        ) : (
                          <span className={`text-[10px] font-medium ${ui.faint}`}>Xona biriktirilmagan</span>
                        )}
                        <p className={`text-[9px] mt-0.5 ${ui.faint}`}>
                          {new Date(req.created_at).toLocaleDateString('uz-UZ')}
                        </p>
                      </div>
                      <ChevronRight size={16} className={ui.faint} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail panel — stays in view while the list scrolls */}
      <div className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
        <AnimatePresence mode="wait">
          {selectedReq ? (
            <motion.div
              key={selectedReq.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className={`rounded-2xl border p-5 space-y-5 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto ${ui.card}`}
            >
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${ui.body}`}>Ariza tafsilotlari</h3>
                <button
                  onClick={() => setSelectedReq(null)}
                  className={`rounded-lg p-1.5 transition-colors ${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Applicant header */}
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-300'}`}>
                  {selectedReq.full_name.trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-xs font-semibold leading-tight truncate ${ui.strong}`}>{selectedReq.full_name}</h4>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${statusChip(STATUS_META[selectedReq.status].tone, isLight).chip}`}>
                      <span className={`h-1 w-1 rounded-full ${statusChip(STATUS_META[selectedReq.status].tone, isLight).dot}`} />
                      {STATUS_META[selectedReq.status].label}
                    </span>
                  </div>
                  <p className={`text-[10px] mt-0.5 truncate ${ui.muted}`}>{selectedReq.email}</p>
                </div>
              </div>

              {selectedReq.blacklisted && (
                <div className={`flex items-start gap-2 rounded-xl border p-3 text-[10px] font-medium ${ui.dangerSoft}`}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold uppercase">Diqqat: qora ro‘yxat</p>
                    <p className="mt-0.5 leading-tight">Bu talaba tizim qoidalari buzilganligi sababli qora ro‘yxatga kiritilgan.</p>
                  </div>
                </div>
              )}

              {selectedReq.warning_count && selectedReq.warning_count > 0 ? (
                <div className={`flex items-start gap-2 rounded-xl border p-3 text-[10px] font-medium ${
                  isLight ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                }`}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Ogohlantirishlar mavjud</p>
                    <p className="mt-0.5 leading-tight">Ushbu talabada {selectedReq.warning_count} ta faol ogohlantirish qayd etilgan.</p>
                  </div>
                </div>
              ) : null}

              {/* Data */}
              <div className="space-y-0 text-xs">
                {fieldRow(
                  selectedReq.application_type === 'imtiyozli' ? 'Pasport/ID raqami' : 'Pasport seriya',
                  <span className="font-mono">{selectedReq.passport_series}</span>,
                )}
                {selectedReq.application_type !== 'imtiyozli' && fieldRow('JShSHIR', <span className="font-mono">{selectedReq.jshshir ?? '—'}</span>)}
                {fieldRow('Telefon', selectedReq.phone)}
                {selectedReq.application_type === 'imtiyozli' && (
                  <>
                    {fieldRow('Yaqin qarindoshi tel', selectedReq.relative_phone || '—')}
                    {fieldRow('Kelib chiqqan joyi', <span className="max-w-[60%] truncate inline-block align-bottom">{[selectedReq.origin_country, selectedReq.origin_region].filter(Boolean).join(', ') || '—'}</span>)}
                    {fieldRow('Ta’lim shakli', selectedReq.study_type === 'grant' ? 'Davlat granti' : selectedReq.study_type === 'kontrakt' ? "To'lov-shartnoma" : '—')}
                  </>
                )}
                {fieldRow('Fakultet', <span className="max-w-[60%] truncate inline-block align-bottom" title={permitFacultyLabel(selectedReq.faculty)}>{permitFacultyLabel(selectedReq.faculty)}</span>)}
                {fieldRow('Yo‘nalish', <span className="max-w-[60%] truncate inline-block align-bottom" title={directionLabel(selectedReq.direction)}>{directionLabel(selectedReq.direction)}</span>)}
                {fieldRow('Kurs', `${selectedReq.course}-kurs`)}
                {fieldRow('Jinsi', genderLabel(selectedReq.gender))}
                {selectedReq.reject_reason && (
                  <div className={`mt-3 rounded-xl border p-3 ${ui.dangerSoft}`}>
                    <p className="text-[10px] font-bold uppercase">Rad etish sababi</p>
                    <p className="mt-1 text-[10px] leading-tight">{selectedReq.reject_reason}</p>
                  </div>
                )}
              </div>

              {/* Documents */}
              {selectedReq.application_type === 'imtiyozli' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => window.open(`/dekan/hujjat?id=${selectedReq.id}`, '_blank', 'noopener,noreferrer')}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.accentSolid}`}
                  >
                    Tilxat va Arizani ko‘rish <ExternalLink size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={handleViewDocument}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
                  >
                    Pasport rasmini ko‘rish <ExternalLink size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleViewDocument}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
                >
                  Ruxsatnoma faylini ko‘rish <ExternalLink size={12} />
                </button>
              )}

              {/* Actions */}
              {selectedReq.status === 'pending' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => setRejectModalOpen(true)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.dangerSoft}`}
                  >
                    <XCircle size={14} /> Rad etish
                  </button>
                  <button
                    onClick={() => setApproveModalOpen(true)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.accentSolid}`}
                  >
                    <CheckCircle size={14} /> Tasdiqlash
                  </button>
                </div>
              )}

              {selectedReq.status === 'approved' && (
                <div className="pt-1 space-y-2">
                  <button
                    onClick={() => setCancelModalOpen(true)}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.dangerSoft}`}
                  >
                    <Undo2 size={14} /> Tasdiqni bekor qilish
                  </button>
                  <p className={`text-center text-[9px] leading-tight ${ui.faint}`}>
                    Ariza &laquo;Kutilmoqda&raquo;ga qaytadi, biriktirilgan xona bo&apos;shatiladi. Talaba hisobini tasdiqlab ulgurgan bo&apos;lsa bekor qilib bo&apos;lmaydi.
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <div className={`rounded-2xl border p-10 flex flex-col items-center justify-center text-center ${ui.card}`}>
              <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-slate-500'}`}>
                <FileText size={20} />
              </div>
              <p className={`text-xs font-medium ${ui.muted}`}>Tafsilotlarni ko‘rish uchun ro‘yxatdan arizani tanlang</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Approve modal */}
      <ConfirmModal
        isOpen={approveModalOpen && !!selectedReq}
        title="Arizani tasdiqlash"
        description={selectedReq ? `${selectedReq.full_name} (${genderLabel(selectedReq.gender)})` : undefined}
        onClose={() => setApproveModalOpen(false)}
        onConfirm={handleApprove}
        confirmText="Tasdiqlash"
        isLoading={processing}
      >
        <p>
          Ariza tasdiqlanadi va talaba ro&apos;yxatdan o&apos;ta oladi. Xona keyinroq, ro&apos;yxatdan o&apos;tgach,
          <strong> Xonalar</strong> sahifasidagi xonasiz talabalar navbatida biriktiriladi.
        </p>
      </ConfirmModal>

      {/* Cancel approval modal */}
      <ConfirmModal
        isOpen={cancelModalOpen && !!selectedReq}
        title="Tasdiqni bekor qilish"
        description={selectedReq ? `${selectedReq.full_name} (${genderLabel(selectedReq.gender)})` : undefined}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
        confirmText="Bekor qilish"
        confirmVariant="danger"
        isLoading={processing}
      >
        <p>
          Ariza qayta <strong>&laquo;Kutilmoqda&raquo;</strong> holatiga qaytadi va talaba ro&apos;yxatdan
          o&apos;ta olmaydi. Bu arizaga biriktirilgan xona (agar bo&apos;lsa) bo&apos;shatiladi. Talabaga
          xabar yuboriladi. Agar talaba ro&apos;yxatdan o&apos;tib, hisobini email orqali
          tasdiqlagan bo&apos;lsa, bekor qilish ishlamaydi — uni chetlashtirish uchun{' '}
          <strong>Talabalar</strong> bo&apos;limidan foydalaning.
        </p>
      </ConfirmModal>

      {/* Reject modal */}
      <ConfirmModal
        isOpen={rejectModalOpen && !!selectedReq}
        title="Arizani rad etish"
        onClose={() => setRejectModalOpen(false)}
        onConfirm={handleReject}
        confirmText="Rad etish"
        confirmVariant="danger"
        isLoading={processing}
      >
        <div className="space-y-2">
          <label className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Rad etish sababi</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Talaba ma'lumotlari mos kelmadi / ruxsatnoma muddati o‘tgan / hujjat sifatsiz..."
            rows={4}
            className={`w-full text-xs p-3 rounded-lg border transition-colors ${ui.input} ${ui.ring}`}
            required
          />
        </div>
      </ConfirmModal>
    </div>
  )
}

export default function DekanArizalarPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader size={104} />
      </div>
    }>
      <ArizalarContent />
    </Suspense>
  )
}
