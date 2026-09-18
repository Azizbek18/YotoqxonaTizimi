'use client'

import DormTabs from '@/components/dekan/DormTabs'
import { useDormTabs } from '@/lib/hooks/useDormTabs'
import { studentsInDorm } from '@/features/faculty-students/domain/dorm-scope'

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, FileText, Filter, RotateCcw, Check, X as XIcon, Edit2, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTable, { type TableColumn } from '@/components/admin/AdminTable'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CustomSelect from '@/components/ui/CustomSelect'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useStaffPanel } from '@/lib/hooks/useStaffPanel'
import { adminUI, adminStatusChip, type AdminStatusTone } from '@/lib/admin-ui'
import ArizaPdfViewerModal from '@/components/applications/ArizaPdfViewerModal'

interface ApplicationRequest {
  id: string
  dorm_id: string | null
  room_number: string | null
  student_name: string
  text: string
  type: 'ariza' | 'tushuntirish'
  level: 'info' | 'warning' | 'critical'
  status?: string
  created_at?: string | null
  updated_at?: string | null
  tushuntirish_count: number
}

// A student who has written this many "tushuntirish xati" (explanation
// letters) needs a visible flag — the dekan/tarbiyachi asked to spot a
// repeat pattern at a glance instead of counting rows themselves.
const TUSHUNTIRISH_WARNING_THRESHOLD = 3

const TYPE_LABELS: Record<ApplicationRequest['type'], string> = {
  ariza: 'Ariza',
  tushuntirish: 'Tushuntirish xati',
}

const REAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
}

const REAL_STATUS_TONE: Record<string, AdminStatusTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const LEVEL_LABELS: Record<ApplicationRequest['level'], string> = {
  info: 'Info',
  warning: 'Ogohlantirish',
  critical: 'Muhim',
}

function StatusPill({ tone, label, isLight }: { tone: AdminStatusTone; label: string; isLight: boolean }) {
  const s = adminStatusChip(tone, isLight)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  )
}

export default function AdminArizalar() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const ui = adminUI(isLight)
  // In the tarbiyachi panel: approve/reject only, one click, no severity
  // edits and no delete — see the row actions below.
  const { isTarbiyachi, canDeleteArizalar } = useStaffPanel()
  const cardBg = ui.inset
  const textMuted = ui.muted
  const textStrong = ui.strong
  const inputBg = `${ui.input} ${ui.ring}`

  const dormScope = useDormTabs()
  const [allRequests, setRequests] = useState<ApplicationRequest[]>([])
  const requests = useMemo(() => studentsInDorm(allRequests, dormScope.dormId), [allRequests, dormScope.dormId])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [pdfModal, setPdfModal] = useState<{ id: string | null; name?: string }>({ id: null })
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; request?: ApplicationRequest }>({ isOpen: false })
  const deleteModal = useConfirmModal<string>()
  const [newStatus, setNewStatus] = useState<ApplicationRequest['level']>('info')
  const [newRealStatus, setNewRealStatus] = useState<string>('pending')
  const [isUpdating, setIsUpdating] = useState(false)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/arizalar')
      const result = await response.json() as {
        ok: boolean
        requests?: ApplicationRequest[]
        error?: string
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'Arizalarni yuklashda xato!')
      }

      setRequests(result.requests ?? [])
    } catch (error) {
      console.error('Arizalarni yuklashda xato:', error)
      toast.error("Arizalarni yuklashda xato!")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const term = searchTerm.toLowerCase()
      const matchesSearch =
        !term
        || request.student_name.toLowerCase().includes(term)
        || (request.room_number ?? '').toLowerCase().includes(term)
      const matchesStatus = filterStatus === 'all' || (request.status ?? 'pending') === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [requests, searchTerm, filterStatus])

  // Pagination
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRequests.slice(start, start + pageSize)
  }, [filteredRequests, currentPage])

  const applyStatusChange = async (id: string, patch: { status: string; level?: ApplicationRequest['level'] }) => {
    const response = await fetch('/api/admin/arizalar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    const result = await response.json() as { ok: boolean; error?: string }
    if (!response.ok || !result.ok) throw new Error(result.error ?? 'Yangilashda xato!')
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: patch.status, level: patch.level ?? r.level } : r)))
  }

  // Tarbiyachi's one-click decide — no modal, no severity picker. The
  // confusing two-dropdown "Holat o'zgartirish" modal stays for admin/dekan
  // only, who actually use the severity field.
  const quickDecide = async (request: ApplicationRequest, status: 'approved' | 'rejected') => {
    setDecidingId(request.id)
    try {
      await applyStatusChange(request.id, { status })
      toast.success(status === 'approved' ? 'Tasdiqlandi' : 'Rad etildi')
    } catch (error) {
      console.error('Yangilashda xato:', error)
      toast.error(error instanceof Error ? error.message : 'Yangilashda xato!')
    } finally {
      setDecidingId(null)
    }
  }

  const handleStatusUpdate = async () => {
    if (!statusModal.request) return
    try {
      setIsUpdating(true)
      await applyStatusChange(statusModal.request.id, { status: newRealStatus, level: newStatus })
      setStatusModal({ isOpen: false })
      toast.success("Holat yangilandi!")
    } catch (error) {
      console.error('Yangilashda xato:', error)
      toast.error(error instanceof Error ? error.message : 'Yangilashda xato!')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = (id: string) => {
    deleteModal.open(id)
  }

  const confirmDelete = async () => {
    const id = deleteModal.target
    if (!id) return

    deleteModal.setIsLoading(true)
    try {
      const response = await fetch('/api/admin/arizalar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const result = await response.json() as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "O'chirishda xato!")
      }

      setRequests((prev) => prev.filter(r => r.id !== id))
      toast.success("Ariza o'chirildi!")
      deleteModal.close()
    } catch (error) {
      console.error("O'chirishda xato:", error)
      toast.error("O'chirishda xato!")
    } finally {
      deleteModal.setIsLoading(false)
    }
  }

  // Stats — by real decision status, the thing staff actually acts on. The
  // old info/warning/critical "daraja" breakdown lived here before; almost
  // no one set it, and it only confused the "Holat o'zgartirish" modal.
  const stats = {
    total: requests.length,
    pending: requests.filter(r => (r.status ?? 'pending') === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  const columns: TableColumn<ApplicationRequest>[] = [
    {
      key: 'student_name',
      label: 'Talaba',
      sortable: true,
      render: (value: unknown, row: ApplicationRequest) => (
        <button
          type="button"
          onClick={() => setPdfModal({ id: row.id, name: row.student_name })}
          className="text-left transition-colors hover:text-indigo-500"
        >
          <p className={`font-semibold ${textStrong}`}>{String(value ?? '')}</p>
          <p className={`text-xs ${textMuted}`}>{row.room_number ? `${row.room_number}-xona` : 'Xona biriktirilmagan'}</p>
          {row.tushuntirish_count >= TUSHUNTIRISH_WARNING_THRESHOLD && (
            <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/15 text-rose-300'}`}>
              <AlertTriangle size={10} /> {row.tushuntirish_count} marta tushuntirish yozgan
            </span>
          )}
        </button>
      ),
    },
    {
      key: 'type',
      label: 'Turi',
      sortable: true,
      render: (value: unknown, row: ApplicationRequest) => (
        <div>
          <StatusPill tone={row.type === 'tushuntirish' ? 'warning' : 'info'} label={TYPE_LABELS[row.type] ?? String(value)} isLight={isLight} />
          {row.tushuntirish_count > 0 && row.tushuntirish_count < TUSHUNTIRISH_WARNING_THRESHOLD && (
            <p className={`mt-1 text-[10px] font-semibold ${textMuted}`}>{row.tushuntirish_count}-marta yozgan</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Holat',
      sortable: true,
      render: (value: unknown) => (
        <StatusPill
          tone={REAL_STATUS_TONE[String(value ?? 'pending')] ?? 'neutral'}
          label={REAL_STATUS_LABELS[String(value ?? 'pending')] ?? String(value)}
          isLight={isLight}
        />
      ),
    },
    {
      key: 'created_at',
      label: 'Sana',
      sortable: true,
      render: (value: unknown) =>
        value ? new Date(String(value)).toLocaleDateString('uz-UZ') : '-',
    },
    {
      key: 'actions',
      label: 'Amallar',
      render: (_value: unknown, row: ApplicationRequest) => {
        const pending = (row.status ?? 'pending') === 'pending'
        return (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPdfModal({ id: row.id, name: row.student_name })}
              className={`no-shelf inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition-all active:scale-95 ${isLight ? 'border-slate-200 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:border-indigo-300' : 'border-white/5 bg-white/5 text-slate-300 hover:text-indigo-300'}`}
              title="Hujjatni ko'rish"
            >
              <FileText size={14} /> Hujjat
            </button>

            {isTarbiyachi ? (
              pending && (
                <>
                  <button
                    onClick={() => quickDecide(row, 'approved')}
                    disabled={decidingId === row.id}
                    className={`no-shelf rounded-xl border p-2.5 transition-all active:scale-95 disabled:opacity-50 ${isLight ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'}`}
                    title="Tasdiqlash"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={() => quickDecide(row, 'rejected')}
                    disabled={decidingId === row.id}
                    className={`no-shelf rounded-xl border p-2.5 transition-all active:scale-95 disabled:opacity-50 ${isLight ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'}`}
                    title="Rad etish"
                  >
                    <XIcon size={15} />
                  </button>
                </>
              )
            ) : (
              <>
                <button
                  onClick={() => {
                    setStatusModal({ isOpen: true, request: row })
                    setNewStatus(row.level)
                    setNewRealStatus(row.status || 'pending')
                  }}
                  className={`no-shelf rounded-xl border p-2.5 transition-all active:scale-95 ${isLight ? 'border-slate-200 bg-slate-50 text-slate-500 hover:text-indigo-600 hover:border-indigo-300' : 'border-white/5 bg-white/5 text-slate-400 hover:text-indigo-300'}`}
                  title="Holat o'zgartirish"
                >
                  <Edit2 size={15} />
                </button>
                {canDeleteArizalar && (
                  <button
                    onClick={() => handleDelete(row.id)}
                    className={`no-shelf rounded-xl border p-2.5 transition-all active:scale-95 ${isLight ? 'border-slate-200 bg-slate-50 text-rose-500 hover:bg-rose-50 hover:border-rose-300' : 'border-white/5 bg-white/5 text-rose-400 hover:bg-rose-400/10'}`}
                    title="O'chirish"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </>
            )}
          </div>
        )
      },
    },
  ]

  const statCards: { title: string; count: number; percentage: number; icon: typeof FileText; tone: AdminStatusTone }[] = [
    { title: 'Jami Arizalar', count: stats.total, percentage: 100, icon: FileText, tone: 'neutral' },
    { title: 'Kutilmoqda', count: stats.pending, percentage: stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0, icon: FileText, tone: 'warning' },
    { title: 'Tasdiqlangan', count: stats.approved, percentage: stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0, icon: FileText, tone: 'success' },
    { title: 'Rad etilgan', count: stats.rejected, percentage: stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0, icon: FileText, tone: 'danger' },
  ]

  return (
    <div>
      {/* Header */}
      <DormTabs scope={dormScope} isLight={isLight} onChange={() => {
        setCurrentPage(1); setSearchTerm(''); setPdfModal({ id: null }); setStatusModal({ isOpen: false }); deleteModal.close()
      }} />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`flex items-center gap-3 text-2xl font-extrabold tracking-tight sm:text-3xl ${textStrong}`}>
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${ui.accentTile}`}>
              <FileText size={24} strokeWidth={2.4} />
            </span>
            Arizalar boshqaruvi
          </h1>
          <p className={`mt-2 text-sm ${textMuted}`}>Talabalar tomonidan yuborilgan murojaat va arizalar ro&apos;yxati</p>
        </div>

        <button
          onClick={loadRequests}
          disabled={loading}
          className={`no-shelf inline-flex items-center justify-center p-3 rounded-xl border transition-all disabled:opacity-50 self-start sm:self-auto ${ui.btnGhost}`}
          title="Yangilash"
        >
          <motion.div
            animate={loading ? { rotate: 360 } : {}}
            transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
          >
            <RotateCcw size={18} />
          </motion.div>
        </button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => {
          const Icon = card.icon
          const s = adminStatusChip(card.tone, isLight)
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className={`rounded-2xl border p-5 ${ui.card} ${ui.hoverLift}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>{card.title}</p>
                  <p className={`mt-2 text-3xl font-extrabold leading-none ${textStrong}`}>
                    {loading ? '—' : card.count}
                  </p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${ui.accentTileSoft}`}>
                  <Icon size={20} strokeWidth={2.4} />
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-slate-400">
                  <span>ULUSH</span>
                  <span>{loading ? '—' : `${card.percentage}%`}</span>
                </div>
                <div className={`h-1.5 w-full overflow-hidden rounded-full ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: loading ? 0 : `${card.percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${card.tone === 'neutral' ? 'bg-indigo-500' : s.dot}`}
                  />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Filters */}
      <div className={`mb-6 rounded-2xl border p-4 ${ui.card}`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Talaba ismi yoki xona raqami bo'yicha qidirish..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className={`w-full rounded-xl border py-3 pl-10 pr-4 text-sm outline-none transition-all ${inputBg}`}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-3.5 text-slate-400 pointer-events-none z-10" size={18} />
            <CustomSelect
              value={filterStatus}
              onChange={(val) => {
                setFilterStatus(val as typeof filterStatus)
                setCurrentPage(1)
              }}
              options={[
                { value: 'all', label: 'Barcha arizalar' },
                { value: 'pending', label: 'Kutilmoqda' },
                { value: 'approved', label: 'Tasdiqlangan' },
                { value: 'rejected', label: 'Rad etilgan' },
              ]}
              className={`rounded-xl border py-3 pl-10 pr-4 text-sm ${inputBg}`}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <AdminTable<ApplicationRequest>
          columns={columns}
          data={paginatedRequests}
          isLoading={loading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={(key) => {
            if (sortBy === key) {
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
            } else {
              setSortBy(key)
              setSortOrder('asc')
            }
          }}
          pagination={{
            current: currentPage,
            total: filteredRequests.length,
            pageSize,
            onPageChange: setCurrentPage,
          }}
        />
      </motion.div>

      <ArizaPdfViewerModal
        arizaId={pdfModal.id}
        studentName={pdfModal.name}
        isLight={isLight}
        onClose={() => setPdfModal({ id: null })}
      />

      {/* Status Update Modal — admin/dekan only; tarbiyachi decides inline */}
      <ConfirmModal
        isOpen={statusModal.isOpen}
        title="Holat o'zgartirish"
        description={statusModal.request?.student_name}
        onClose={() => setStatusModal({ isOpen: false })}
        onConfirm={handleStatusUpdate}
        confirmText="Saqlash"
        isLoading={isUpdating}
      >
        <div className="space-y-4">
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Qaror:</label>
            <CustomSelect
              value={newRealStatus}
              onChange={(val) => setNewRealStatus(val)}
              options={[
                { value: 'pending', label: 'Kutilmoqda' },
                { value: 'approved', label: 'Tasdiqlangan' },
                { value: 'rejected', label: 'Rad etilgan' },
              ]}
              className={`rounded-xl border px-4 py-2.5 text-sm ${inputBg}`}
            />
          </div>
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Muhimlik darajasi:</label>
            <CustomSelect
              value={newStatus}
              onChange={(val) => setNewStatus(val as ApplicationRequest['level'])}
              options={[
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Ogohlantirish' },
                { value: 'critical', label: 'Muhim' },
              ]}
              className={`rounded-xl border px-4 py-2.5 text-sm ${inputBg}`}
            />
          </div>
          <div className={`p-3 rounded-xl border space-y-1 ${ui.accentSoft} ${ui.accentBorder}`}>
            <p className="text-xs font-semibold">
              Hozirgi holat: <span className={`font-bold ${textStrong}`}>{REAL_STATUS_LABELS[statusModal.request?.status || 'pending']}</span>
            </p>
            <p className="text-xs font-semibold">
              Hozirgi muhimlik: <span className={`font-bold ${textStrong}`}>{LEVEL_LABELS[statusModal.request?.level || 'info']}</span>
            </p>
          </div>
        </div>
      </ConfirmModal>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Arizani o'chirish"
        description="Ushbu arizani o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi."
        onClose={deleteModal.close}
        onConfirm={confirmDelete}
        confirmText="O'chirish"
        confirmVariant="danger"
        isLoading={deleteModal.isLoading}
      />
    </div>
  )
}
