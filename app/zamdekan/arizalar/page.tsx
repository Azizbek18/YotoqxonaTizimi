'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import {
  Search,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useZamdekanScope } from '@/lib/hooks/useZamdekanScope'
import { getAuthHeaders } from '@/lib/auth-session'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  approvePermitRequest,
  fetchZamdekanOverview,
  rejectPermitRequest,
} from '@/features/permits/client/admin-api'

interface PermitRequest {
  id: string
  passport_series: string
  jshshir: string
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
}

function ArizalarContent() {
  const searchParams = useSearchParams()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  // Styles
  const surfaceBg = isLight
    ? 'bg-white/80 border-slate-200 shadow-md'
    : 'bg-[#0f172a]/30 border-white/5 shadow-2xl'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const inputBg = isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'

  // State
  const [requests, setRequests] = useState<PermitRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'registered'>('pending')
  const [selectedReq, setSelectedReq] = useState<PermitRequest | null>(null)
  const { faculty: zamdekanFaculty, resolved: facultyResolved } = useZamdekanScope()

  // Room Assignment Modal
  const [roomModalOpen, setRoomModalOpen] = useState(false)
  const [roomOccupancy, setRoomOccupancy] = useState<Record<string, number>>({})
  const [selectedRoom, setSelectedRoom] = useState<string>('')
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
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

  // Fetch all requests (scoped to this zamdekan's own faculty)
  const fetchRequests = async (faculty: string | null) => {
    setLoading(true)
    try {
      if (!faculty) {
        setRequests([])
        setRoomOccupancy({})
        setLoading(false)
        return
      }

      const overview = await fetchZamdekanOverview()
      setRequests(overview.requests as PermitRequest[])
      setRoomOccupancy(overview.roomOccupancy)
    } catch (err) {
      console.error('Error fetching permits:', err)
      toast.error("Yo'llanmalarni yuklashda xatolik yuz berdi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!facultyResolved) return
    fetchRequests(zamdekanFaculty)
  }, [facultyResolved, zamdekanFaculty])

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

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    const matchesStatus = req.status === statusFilter
    const matchesSearch =
      req.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.passport_series.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.jshshir.includes(searchTerm) ||
      req.faculty.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesStatus && matchesSearch
  })

  // Export to Excel helper
  const exportToExcel = (dataToExport: PermitRequest[]) => {
    const rows = dataToExport.map((req) => ({
      'F.I.Sh.': req.full_name,
      'Pasport Seriyasi': req.passport_series,
      'JShSHIR': req.jshshir,
      'Telefon': req.phone,
      'Email': req.email,
      'Jinsi': req.gender === 'male' ? 'Erkak' : 'Ayol',
      'Fakultet': req.faculty,
      'Yo‘nalish': req.direction,
      'Kurs': `${req.course}-kurs`,
      'Xona raqami': req.room_number || 'Biriktirilmagan',
      'Status': req.status,
      'Yuborilgan sana': new Date(req.created_at).toLocaleDateString('uz-UZ'),
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Arizalar')
    XLSX.writeFile(workbook, `yotoqxona_arizalar_${statusFilter}.xlsx`)
    toast.success("Excel muvaffaqiyatli yuklab olindi!")
  }

  // Handle room assignment
  const handleAssignRoom = async () => {
    if (!selectedReq) return
    if (!selectedRoom) {
      toast.error('Xona tanlang!')
      return
    }

    const currentOccupancy = roomOccupancy[selectedRoom] || 0
    if (currentOccupancy >= 4) {
      toast.error("Bu xonada bo'sh joy yo'q (maksimal 4 kishi)!")
      return
    }

    setProcessing(true)
    try {
      await approvePermitRequest(selectedReq.id, selectedRoom)

      toast.success(`${selectedReq.full_name}ga ${selectedRoom}-xona biriktirildi va ariza tasdiqlandi!`)
      setRoomModalOpen(false)
      setSelectedRoom('')

      // Auto-trigger Excel download for this approved request
      const updatedReq = { ...selectedReq, status: 'approved' as const, room_number: selectedRoom }
      exportToExcel([updatedReq])

      // Refresh list
      await fetchRequests(zamdekanFaculty)
      setSelectedReq(null)
    } catch (err) {
      console.error(err)
      toast.error("Xona biriktirishda xatolik yuz berdi")
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

      await fetchRequests(zamdekanFaculty)
      setSelectedReq(null)
    } catch (err) {
      console.error(err)
      toast.error("Rad etishda xatolik yuz berdi")
    } finally {
      setProcessing(false)
    }
  }

  // Generate 150 rooms
  const roomsList = Array.from({ length: 150 }, (_, i) => String(i + 1))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* 1. Requests List Panel (Left) */}
      <div className="lg:col-span-8 space-y-4">
        {/* Header and Actions */}
        <div className={`p-5 rounded-3xl border ${surfaceBg} flex flex-col md:flex-row md:items-center md:justify-between gap-4`}>
          <div>
            <h1 className={`text-lg font-black uppercase tracking-wider ${textStrong}`}>Yo‘llanmalar ro‘yxati</h1>
            <p className={`text-[10px] font-medium ${textMuted}`}>
              {zamdekanFaculty
                ? `${zamdekanFaculty.toUpperCase()} fakulteti bo'yicha kelib tushgan ruxsatnomalar`
                : 'Kelib tushgan ruxsatnomalarni tekshirish va tasdiqlash'}
            </p>
          </div>

          <button
            onClick={() => exportToExcel(filteredRequests)}
            disabled={filteredRequests.length === 0}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-all`}
          >
            <Download size={14} /> Excel Yuklab olish
          </button>
        </div>

        {facultyResolved && !zamdekanFaculty && (
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs font-bold flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              Hisobingizga fakultet biriktirilmagan, shuning uchun hech qanday ariza ko&apos;rsatilmayapti. Administratorga murojaat qilib, profilingizga fakultet qo&apos;shishini so&apos;rang.
            </span>
          </div>
        )}

        {/* Filters */}
        <div className={`p-4 rounded-3xl border ${surfaceBg} flex flex-col md:flex-row md:items-center justify-between gap-3`}>
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl">
            {(['pending', 'approved', 'rejected', 'registered'] as const).map((status) => {
              const count = requests.filter((r) => r.status === status).length
              const labelMap = {
                pending: 'Kutilmoqda',
                approved: 'Tasdiqlangan',
                rejected: 'Rad etilgan',
                registered: 'Ro‘yxatdan o‘tgan'
              }
              const colorMap = {
                pending: 'text-amber-500',
                approved: 'text-emerald-500',
                rejected: 'text-rose-500',
                registered: 'text-sky-500'
              }
              const activeGradientMap = {
                pending: 'from-amber-500 to-orange-600 shadow-amber-500/25',
                approved: 'from-emerald-500 to-teal-600 shadow-emerald-500/25',
                rejected: 'from-rose-500 to-red-600 shadow-rose-500/25',
                registered: 'from-sky-500 to-blue-600 shadow-sky-500/25',
              }
              const isActive = statusFilter === status
              return (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status)
                    setSelectedReq(null)
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    isActive
                      ? `bg-gradient-to-r ${activeGradientMap[status]} text-white shadow-md`
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white' : `bg-current ${colorMap[status]}`}`} />
                  {labelMap[status]} ({count})
                </button>
              )
            })}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 md:max-w-xs">
            <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textMuted}`} />
            <input
              type="text"
              placeholder="Qidirish (ism, pasport, fakultet)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full text-xs py-2.5 pl-9 pr-4 rounded-xl outline-none border transition-all ${inputBg}`}
            />
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className={`animate-spin rounded-full h-8 w-8 border-t-2 ${isLight ? 'border-indigo-600' : 'border-cyan-500'}`} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className={`p-10 rounded-3xl border ${surfaceBg} text-center`}>
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mb-3">
              <FileText size={20} />
            </div>
            <p className="text-xs font-bold text-slate-500">Ushbu holatda arizalar topilmadi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((req) => {
              const isSelected = selectedReq?.id === req.id
              return (
                <div
                  key={req.id}
                  onClick={() => setSelectedReq(req)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? isLight
                        ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-500/20'
                        : 'border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500/20'
                      : isLight
                        ? 'border-slate-200 bg-white hover:border-slate-300'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`hidden sm:flex h-9 w-9 shrink-0 rounded-full items-center justify-center text-xs font-black ${
                        req.gender === 'male' ? 'bg-sky-500/10 text-sky-500' : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {req.full_name.trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-xs font-bold ${textStrong}`}>{req.full_name}</h3>
                        {req.blacklisted && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-red-500 text-white animate-pulse">
                            Qora ro‘yxat
                          </span>
                        )}
                        {req.warning_count && req.warning_count > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-500 text-slate-900 flex items-center gap-0.5">
                            <AlertTriangle size={8} /> {req.warning_count} warning
                          </span>
                        ) : null}
                      </div>
                      <p className={`text-[10px] mt-1 ${textMuted}`}>
                        {req.faculty} • {req.direction} • {req.course}-kurs
                      </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-left sm:text-right">
                        {req.room_number ? (
                          <span className="text-[10px] font-bold text-emerald-500">
                            Xona № {req.room_number}
                          </span>
                        ) : (
                          <span className={`text-[10px] font-bold ${textMuted}`}>Xona biriktirilmagan</span>
                        )}
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {new Date(req.created_at).toLocaleDateString('uz-UZ')}
                        </p>
                      </div>
                      <ChevronRight size={16} className={textMuted} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. Detail View Panel (Right) */}
      <div className="lg:col-span-4">
        <AnimatePresence mode="wait">
          {selectedReq ? (
            <motion.div
              key={selectedReq.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`p-5 rounded-3xl border ${surfaceBg} space-y-5`}
            >
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-black uppercase tracking-wider ${textStrong}`}>Ariza Tafsilotlari</h3>
                <button onClick={() => setSelectedReq(null)} className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 ${textMuted}`}>
                  <X size={14} />
                </button>
              </div>

              {/* Student Header */}
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                  selectedReq.gender === 'male' ? 'bg-sky-500/10 text-sky-500' : 'bg-rose-500/10 text-rose-500'
                }`}>
                  {selectedReq.full_name.trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className={`text-xs font-bold leading-tight truncate ${textStrong}`}>{selectedReq.full_name}</h4>
                  <p className={`text-[9px] mt-0.5 truncate ${textMuted}`}>{selectedReq.email}</p>
                </div>
              </div>

              {/* Warnings / Blacklist Warning */}
              {selectedReq.blacklisted && (
                <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/20 text-red-500 text-[10px] font-bold flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black">DIQQAT: QORA RO&apos;YXAT!</p>
                    <p className="mt-0.5 text-[9px] leading-tight">Bu talaba tizim qoidalari buzilganligi sababli qora ro‘yxatga kiritilgan.</p>
                  </div>
                </div>
              )}

              {selectedReq.warning_count && selectedReq.warning_count > 0 ? (
                <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/20 text-amber-500 text-[10px] font-bold flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black">Ogohlantirishlar mavjud!</p>
                    <p className="mt-0.5 text-[9px] leading-tight">Ushbu talabada {selectedReq.warning_count} ta faol ogohlantirish qayd etilgan.</p>
                  </div>
                </div>
              ) : null}

              {/* Data Table */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className={textMuted}>Pasport Seriya</span>
                  <span className={`font-mono font-bold ${textStrong}`}>{selectedReq.passport_series}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className={textMuted}>JShSHIR</span>
                  <span className={`font-mono font-bold ${textStrong}`}>{selectedReq.jshshir}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className={textMuted}>Telefon</span>
                  <span className={`font-bold ${textStrong}`}>{selectedReq.phone}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className={textMuted}>Fakultet</span>
                  <span className={`font-bold text-right max-w-[60%] truncate ${textStrong}`} title={selectedReq.faculty}>
                    {selectedReq.faculty}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className={textMuted}>Yo‘nalish</span>
                  <span className={`font-bold text-right max-w-[60%] truncate ${textStrong}`} title={selectedReq.direction}>
                    {selectedReq.direction}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className={textMuted}>Kurs</span>
                  <span className={`font-bold ${textStrong}`}>{selectedReq.course}-kurs</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className={textMuted}>Jinsi</span>
                  <span className={`font-bold ${textStrong}`}>{selectedReq.gender === 'male' ? 'Erkak' : 'Ayol'}</span>
                </div>
                {selectedReq.reject_reason && (
                  <div className="py-2.5 p-3 rounded-2xl bg-rose-500/10 text-rose-500 mt-2">
                    <p className="font-bold text-[10px] uppercase">Rad etish sababi:</p>
                    <p className="mt-1 text-[10px] leading-tight font-medium">{selectedReq.reject_reason}</p>
                  </div>
                )}
              </div>

              {/* Document Link */}
              <button
                type="button"
                onClick={handleViewDocument}
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  isLight
                    ? 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    : 'border-white/10 hover:bg-white/5 text-slate-300'
                }`}
              >
                Ruxsatnoma faylini ko‘rish <ExternalLink size={12} />
              </button>

              {/* Action Buttons */}
              {selectedReq.status === 'pending' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setRejectModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                  >
                    <XCircle size={14} /> Rad etish
                  </button>
                  <button
                    onClick={() => setRoomModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider bg-indigo-500 text-white hover:bg-indigo-600 transition-all"
                  >
                    <CheckCircle size={14} /> Xona biriktirish
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <div className={`p-6 rounded-3xl border ${surfaceBg} text-center ${textMuted} text-xs font-bold`}>
              Tafsilotlarni ko‘rish uchun ro‘yxatdan arizani tanlang
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Assign Room Modal */}
      <ConfirmModal
        isOpen={roomModalOpen && !!selectedReq}
        title="Xona biriktirish"
        description={selectedReq ? `${selectedReq.full_name} (${selectedReq.gender === 'male' ? 'Erkak' : 'Ayol'})` : undefined}
        maxWidthClass="max-w-lg"
        onClose={() => setRoomModalOpen(false)}
        onConfirm={handleAssignRoom}
        confirmText="Tasdiqlash va Excel yaratish"
        isLoading={processing}
      >
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
          {roomsList.map((room) => {
            const count = roomOccupancy[room] || 0
            const isFull = count >= 4
            const isSelected = selectedRoom === room

            return (
              <button
                key={room}
                type="button"
                disabled={isFull}
                onClick={() => setSelectedRoom(room)}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                    : isFull
                      ? 'border-red-500/20 bg-red-500/5 text-red-400 opacity-40 cursor-not-allowed'
                      : isLight
                        ? 'border-slate-200 bg-white hover:border-indigo-300 text-slate-900'
                        : 'border-white/5 bg-white/[0.02] hover:border-indigo-500/30 text-white'
                }`}
              >
                <span className="text-xs font-black">{room}-xona</span>
                <span className="text-[9px] font-bold mt-0.5">
                  {isFull ? 'To‘la' : `${count}/4 band`}
                </span>
              </button>
            )
          })}
        </div>
      </ConfirmModal>

      {/* 4. Reject Request Modal */}
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
          <label className={`text-[10px] font-black uppercase tracking-wider block ${textMuted}`}>Rad etish sababi</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Talaba ma'lumotlari mos kelmadi / ruxsatnoma muddati o‘tgan / hujjat sifatsiz..."
            rows={4}
            className={`w-full text-xs p-3 rounded-xl outline-none border transition-all ${inputBg}`}
            required
          />
        </div>
      </ConfirmModal>
    </div>
  )
}

export default function ZamdekanArizalarPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-600" />
      </div>
    }>
      <ArizalarContent />
    </Suspense>
  )
}
