'use client'

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Eye, Edit2, Trash2, FileText, Filter, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTable, { type TableColumn } from '@/components/admin/AdminTable'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CustomSelect from '@/components/ui/CustomSelect'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useStaffPanel } from '@/lib/hooks/useStaffPanel'
import { adminUI, adminStatusChip, type AdminStatusTone } from '@/lib/admin-ui'
import ArizaSignatureBadge from '@/components/applications/ArizaSignatureBadge'

interface ApplicationRequest {
  id: string
  student_name: string
  text: string
  level: 'info' | 'warning' | 'critical'
  status?: string
  created_at?: string | null
  updated_at?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  info: 'Info',
  warning: 'Ogohlantirish',
  critical: 'Muhim',
}

const STATUS_TONE: Record<string, AdminStatusTone> = {
  info: 'info',
  warning: 'warning',
  critical: 'danger',
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
  // In the tarbiyachi panel: approve/reject only — no severity edits, no
  // re-opening a decided ariza, no delete.
  const { isTarbiyachi, canDeleteArizalar } = useStaffPanel()
  const cardBg = ui.inset
  const textMuted = ui.muted
  const textStrong = ui.strong
  const textBody = ui.body
  const inputBg = `${ui.input} ${ui.ring}`

  const [requests, setRequests] = useState<ApplicationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | ApplicationRequest['level']>('all')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [detailModal, setDetailModal] = useState<{ isOpen: boolean; request?: ApplicationRequest }>({ isOpen: false })
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; request?: ApplicationRequest }>({ isOpen: false })
  const deleteModal = useConfirmModal<string>()
  const [newStatus, setNewStatus] = useState<ApplicationRequest['level']>('info')
  const [newRealStatus, setNewRealStatus] = useState<string>('pending')
  const [isUpdating, setIsUpdating] = useState(false)
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
      const matchesSearch =
        request.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.text.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = filterStatus === 'all' || request.level === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [requests, searchTerm, filterStatus])

  // Pagination
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRequests.slice(start, start + pageSize)
  }, [filteredRequests, currentPage])

  const handleStatusUpdate = async () => {
    if (!statusModal.request) return

    try {
      setIsUpdating(true)
      const response = await fetch('/api/admin/arizalar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: statusModal.request.id,
          level: newStatus,
          status: newRealStatus,
        }),
      })
      const result = await response.json() as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'Yangilashda xato!')
      }

      setRequests(requests.map(r => r.id === statusModal.request?.id ? { ...r, level: newStatus, status: newRealStatus } : r))
      setStatusModal({ isOpen: false })
      toast.success("Holat yangilandi!")
    } catch (error) {
      console.error('Yangilashda xato:', error)
      toast.error("Yangilashda xato!")
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

      setRequests(requests.filter(r => r.id !== id))
      toast.success("Ariza o'chirildi!")
      deleteModal.close()
    } catch (error) {
      console.error("O'chirishda xato:", error)
      toast.error("O'chirishda xato!")
    } finally {
      deleteModal.setIsLoading(false)
    }
  }

  // Stats
  const stats = {
    total: requests.length,
    info: requests.filter(r => r.level === 'info').length,
    warning: requests.filter(r => r.level === 'warning').length,
    critical: requests.filter(r => r.level === 'critical').length,
  }

  const columns: TableColumn<ApplicationRequest>[] = [
    {
      key: 'student_name',
      label: 'Talaba',
      sortable: true,
      render: (value: unknown, row: ApplicationRequest) => (
        <div className="cursor-pointer transition-colors hover:text-indigo-500" onClick={() => setDetailModal({ isOpen: true, request: row })}>
          <p className={`font-semibold ${textStrong}`}>{String(value ?? '')}</p>
          <p className={`text-xs ${textMuted} line-clamp-1`}>{row.text}</p>
        </div>
      ),
    },
    {
      key: 'text',
      label: 'Matn',
      sortable: false,
      render: (value: unknown) => (
        <p className={`text-sm ${textBody} line-clamp-2`}>{String(value ?? '')}</p>
      ),
    },
    {
      key: 'level',
      label: 'Daraja',
      sortable: true,
      render: (value: unknown) => (
        <StatusPill tone={STATUS_TONE[String(value)] ?? 'neutral'} label={STATUS_LABELS[String(value)] ?? String(value)} isLight={isLight} />
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
      label: 'Yaratilgan',
      sortable: true,
      render: (value: unknown) =>
        value ? new Date(String(value)).toLocaleDateString('uz-UZ') : '-',
    },
    {
      key: 'actions',
      label: 'Amallar',
      render: (_value: unknown, row: ApplicationRequest) => (
        <div className="flex gap-2">
          <button
            onClick={() => setDetailModal({ isOpen: true, request: row })}
            className={`no-shelf rounded-xl border p-2.5 transition-all active:scale-95 ${isLight ? 'border-slate-200 bg-slate-50 text-slate-500 hover:text-indigo-600 hover:border-indigo-300' : 'border-white/5 bg-white/5 text-slate-400 hover:text-indigo-300'}`}
            title="Ko'rish"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => {
              setStatusModal({ isOpen: true, request: row })
              setNewStatus(row.level)
              setNewRealStatus(isTarbiyachi ? 'approved' : (row.status || 'pending'))
            }}
            className={`no-shelf rounded-xl border p-2.5 transition-all active:scale-95 ${isLight ? 'border-slate-200 bg-slate-50 text-slate-500 hover:text-indigo-600 hover:border-indigo-300' : 'border-white/5 bg-white/5 text-slate-400 hover:text-indigo-300'}`}
            title={isTarbiyachi ? 'Ko‘rib chiqish' : "Holat o'zgartirish"}
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
        </div>
      ),
    },
  ]

  const statCards: { title: string; count: number; percentage: number; icon: typeof FileText; tone: AdminStatusTone }[] = [
    { title: 'Jami Arizalar', count: stats.total, percentage: 100, icon: FileText, tone: 'neutral' },
    { title: "Ma'lumot (Info)", count: stats.info, percentage: stats.total > 0 ? Math.round((stats.info / stats.total) * 100) : 0, icon: FileText, tone: 'info' },
    { title: 'Ogohlantirish', count: stats.warning, percentage: stats.total > 0 ? Math.round((stats.warning / stats.total) * 100) : 0, icon: Filter, tone: 'warning' },
    { title: 'Muhim (Critical)', count: stats.critical, percentage: stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0, icon: FileText, tone: 'danger' },
  ]

  return (
    <div>
      {/* Header */}
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
              placeholder="Talaba ismi yoki murojaat matni bo'yicha qidirish..."
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
                setFilterStatus(val as 'all' | ApplicationRequest['level'])
                setCurrentPage(1)
              }}
              options={[
                { value: 'all', label: 'Barcha arizalar' },
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Ogohlantirish' },
                { value: 'critical', label: 'Muhim' },
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

      {/* Detail Modal */}
      <ConfirmModal
        isOpen={detailModal.isOpen}
        title=""
        onClose={() => setDetailModal({ isOpen: false })}
      >
        {detailModal.request && (
          <div className="space-y-6">
            <div className={`flex items-center gap-3 pb-4 border-b ${ui.border}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTileSoft}`}>
                <FileText size={20} strokeWidth={2.4} />
              </div>
              <div>
                <h2 className={`text-xl font-black tracking-tight ${textStrong}`}>{detailModal.request.student_name}</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Murojaat tafsilotlari</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${cardBg}`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${textMuted} mb-2`}>Murojaat matni</h3>
                <p className={`text-sm leading-relaxed ${textBody}`}>{detailModal.request.text}</p>
                <div className="mt-3">
                  <ArizaSignatureBadge arizaId={detailModal.request.id} isLight={isLight} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border ${cardBg}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${textMuted} mb-2`}>Daraja</h3>
                  <StatusPill tone={STATUS_TONE[detailModal.request.level] ?? 'neutral'} label={STATUS_LABELS[detailModal.request.level]} isLight={isLight} />
                </div>
                <div className={`p-4 rounded-xl border ${cardBg}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${textMuted} mb-2`}>Holat</h3>
                  <StatusPill
                    tone={REAL_STATUS_TONE[detailModal.request.status || 'pending'] ?? 'neutral'}
                    label={REAL_STATUS_LABELS[detailModal.request.status || 'pending']}
                    isLight={isLight}
                  />
                </div>
                <div className={`p-4 rounded-xl border ${cardBg}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${textMuted} mb-2`}>Yuborilgan sana</h3>
                  <p className={`text-sm font-semibold ${textStrong}`}>
                    {detailModal.request.created_at ? new Date(detailModal.request.created_at).toLocaleDateString('uz-UZ') : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </ConfirmModal>

      {/* Status Update Modal */}
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
          {!isTarbiyachi && (
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Yangi daraja:</label>
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
          )}
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Yangi holat:</label>
            <CustomSelect
              value={newRealStatus}
              onChange={(val) => setNewRealStatus(val)}
              options={[
                ...(isTarbiyachi ? [] : [{ value: 'pending', label: 'Kutilmoqda' }]),
                { value: 'approved', label: 'Tasdiqlangan' },
                { value: 'rejected', label: 'Rad etilgan' },
              ]}
              className={`rounded-xl border px-4 py-2.5 text-sm ${inputBg}`}
            />
          </div>
          <div className={`p-3 rounded-xl border space-y-1 ${ui.accentSoft} ${ui.accentBorder}`}>
            <p className="text-xs font-semibold">
              Hozirgi daraja: <span className={`font-bold ${textStrong}`}>{STATUS_LABELS[statusModal.request?.level || 'info']}</span>
            </p>
            <p className="text-xs font-semibold">
              Hozirgi holat: <span className={`font-bold ${textStrong}`}>{REAL_STATUS_LABELS[statusModal.request?.status || 'pending']}</span>
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
