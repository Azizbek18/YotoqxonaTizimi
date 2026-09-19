'use client'

import DormTabs from '@/components/dekan/DormTabs'
import { useDormTabs } from '@/lib/hooks/useDormTabs'
import { studentsInDorm } from '@/features/faculty-students/domain/dorm-scope'

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  FileText,
  RotateCcw,
  Check,
  X as XIcon,
  Edit2,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Loader2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTable, { type TableColumn } from '@/components/admin/AdminTable'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CustomSelect from '@/components/ui/CustomSelect'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useStaffPanel } from '@/lib/hooks/useStaffPanel'
import { adminUI } from '@/lib/admin-ui'
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

// A student who has written this many "tushuntirish xati" needs a visible flag
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

const LEVEL_LABELS: Record<ApplicationRequest['level'], string> = {
  info: 'Info',
  warning: 'Ogohlantirish',
  critical: 'Muhim',
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export default function AdminArizalar() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const ui = adminUI(isLight)
  const { isTarbiyachi, canDeleteArizalar } = useStaffPanel()
  const textMuted = ui.muted
  const textStrong = ui.strong
  const inputBg = `${ui.input} ${ui.ring}`

  const dormScope = useDormTabs()
  const [allRequests, setRequests] = useState<ApplicationRequest[]>([])
  const requests = useMemo(() => studentsInDorm(allRequests, dormScope.dormId), [allRequests, dormScope.dormId])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [filterType, setFilterType] = useState<'all' | 'ariza' | 'tushuntirish'>('all')
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
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !term
        || request.student_name.toLowerCase().includes(term)
        || (request.room_number ?? '').toLowerCase().includes(term)
      const matchesStatus = filterStatus === 'all' || (request.status ?? 'pending') === filterStatus
      const matchesType = filterType === 'all' || request.type === filterType
      return matchesSearch && matchesStatus && matchesType
    })
  }, [requests, searchTerm, filterStatus, filterType])

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

  // Tarbiyachi's one-click decide
  const quickDecide = async (request: ApplicationRequest, status: 'approved' | 'rejected') => {
    setDecidingId(request.id)
    try {
      await applyStatusChange(request.id, { status })
      toast.success(status === 'approved' ? 'Ariza tasdiqlandi' : 'Ariza rad etildi')
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

  // Real-time counts
  const stats = {
    total: requests.length,
    pending: requests.filter(r => (r.status ?? 'pending') === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    ariza: requests.filter(r => r.type === 'ariza').length,
    tushuntirish: requests.filter(r => r.type === 'tushuntirish').length,
  }

  const columns: TableColumn<ApplicationRequest>[] = [
    {
      key: 'student_name',
      label: 'Talaba',
      sortable: true,
      render: (value: unknown, row: ApplicationRequest) => (
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border transition-colors ${
              isLight
                ? 'bg-slate-100 text-slate-700 border-slate-200/80'
                : 'bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            {getInitials(row.student_name)}
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setPdfModal({ id: row.id, name: row.student_name })}
              className={`text-left font-bold text-sm tracking-tight transition-colors truncate block max-w-[260px] sm:max-w-[320px] ${
                isLight ? 'text-slate-800 hover:text-indigo-600' : 'text-slate-100 hover:text-indigo-400'
              }`}
            >
              {String(value ?? '')}
            </button>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 text-xs ${
                row.room_number ? (isLight ? 'text-slate-600 font-medium' : 'text-slate-300 font-medium') : 'text-slate-400 italic'
              }`}>
                <Building2 size={12} className="opacity-70" />
                {row.room_number ? `${row.room_number}-xona` : 'Xona biriktirilmagan'}
              </span>
              {row.tushuntirish_count >= TUSHUNTIRISH_WARNING_THRESHOLD && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  isLight
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                  {row.tushuntirish_count} marta tushuntirish yozgan
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Turi',
      sortable: true,
      render: (value: unknown, row: ApplicationRequest) => {
        const isAriza = row.type === 'ariza'
        return (
          <div className="inline-flex flex-col">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                isAriza
                  ? isLight
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs'
                    : 'bg-blue-500/10 text-blue-300 border-blue-500/25 shadow-xs'
                  : isLight
                    ? 'bg-amber-50 text-amber-800 border-amber-200 shadow-xs'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/25 shadow-xs'
              }`}
            >
              {isAriza ? (
                <FileText size={12} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
              ) : (
                <AlertCircle size={12} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
              )}
              {TYPE_LABELS[row.type] ?? String(value)}
            </span>
            {row.tushuntirish_count > 0 && row.tushuntirish_count < TUSHUNTIRISH_WARNING_THRESHOLD && (
              <span className={`mt-1 text-[10px] font-medium pl-1 ${textMuted}`}>
                {row.tushuntirish_count}-marta yozgan
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Holat',
      sortable: true,
      render: (value: unknown) => {
        const status = String(value ?? 'pending')
        if (status === 'approved') {
          return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${
              isLight
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
            }`}>
              <Check size={12} strokeWidth={2.8} className={isLight ? 'text-emerald-600' : 'text-emerald-400'} />
              Tasdiqlangan
            </span>
          )
        }
        if (status === 'rejected') {
          return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${
              isLight
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/25'
            }`}>
              <XIcon size={12} strokeWidth={2.8} className={isLight ? 'text-rose-600' : 'text-rose-400'} />
              Rad etilgan
            </span>
          )
        }
        return (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${
            isLight
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
          }`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            Kutilmoqda
          </span>
        )
      },
    },
    {
      key: 'created_at',
      label: 'Sana',
      sortable: true,
      render: (value: unknown) => {
        if (!value) return <span className="text-slate-400 text-xs">—</span>
        const d = new Date(String(value))
        const formatted = d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
        return (
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <span>{formatted}</span>
          </div>
        )
      },
    },
    {
      key: 'actions',
      label: 'Amallar',
      render: (_value: unknown, row: ApplicationRequest) => {
        const pending = (row.status ?? 'pending') === 'pending'
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPdfModal({ id: row.id, name: row.student_name })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 shadow-xs ${
                isLight
                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600'
                  : 'border-white/10 bg-slate-800/80 text-slate-200 hover:bg-slate-800 hover:border-indigo-400/50 hover:text-indigo-300'
              }`}
              title="Hujjatni ko‘rish"
            >
              <FileText size={13} className="text-indigo-500" />
              <span>Hujjat</span>
            </button>

            {isTarbiyachi ? (
              pending ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => quickDecide(row, 'approved')}
                    disabled={decidingId === row.id}
                    className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 shadow-xs ${
                      isLight
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-300'
                        : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40'
                    }`}
                    title="Tasdiqlash"
                  >
                    {decidingId === row.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} strokeWidth={2.6} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => quickDecide(row, 'rejected')}
                    disabled={decidingId === row.id}
                    className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 shadow-xs ${
                      isLight
                        ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300'
                        : 'border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40'
                    }`}
                    title="Rad etish"
                  >
                    {decidingId === row.id ? <Loader2 size={13} className="animate-spin" /> : <XIcon size={14} strokeWidth={2.6} />}
                  </button>
                </div>
              ) : (
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic px-1">
                  Ko‘rib chiqilgan
                </span>
              )
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setStatusModal({ isOpen: true, request: row })
                    setNewStatus(row.level)
                    setNewRealStatus(row.status || 'pending')
                  }}
                  className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all active:scale-90 ${
                    isLight
                      ? 'border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:border-indigo-300'
                      : 'border-white/10 bg-slate-800/80 text-slate-300 hover:text-indigo-300 hover:border-indigo-400/50'
                  }`}
                  title="Holat o'zgartirish"
                >
                  <Edit2 size={13} />
                </button>
                {canDeleteArizalar && (
                  <button
                    type="button"
                    onClick={() => handleDelete(row.id)}
                    className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all active:scale-90 ${
                      isLight
                        ? 'border-slate-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300'
                        : 'border-white/10 bg-slate-800/80 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30'
                    }`}
                    title="O'chirish"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        )
      },
    },
  ]

  const statCards: {
    key: 'all' | 'pending' | 'approved' | 'rejected'
    title: string
    count: number
    percentage: number
    icon: typeof FileText
    gradient: string
    activeClass: string
    dotColor: string
  }[] = [
    {
      key: 'all',
      title: 'Jami arizalar',
      count: stats.total,
      percentage: 100,
      icon: FileText,
      gradient: 'from-blue-600 to-indigo-600',
      activeClass: isLight
        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40'
        : 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-500/10',
      dotColor: 'bg-indigo-500',
    },
    {
      key: 'pending',
      title: 'Kutilmoqda',
      count: stats.pending,
      percentage: stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-500',
      activeClass: isLight
        ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/40'
        : 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/10',
      dotColor: 'bg-amber-500',
    },
    {
      key: 'approved',
      title: 'Tasdiqlangan',
      count: stats.approved,
      percentage: stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0,
      icon: CheckCircle2,
      gradient: 'from-emerald-500 to-teal-600',
      activeClass: isLight
        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40'
        : 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/10',
      dotColor: 'bg-emerald-500',
    },
    {
      key: 'rejected',
      title: 'Rad etilgan',
      count: stats.rejected,
      percentage: stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0,
      icon: XCircle,
      gradient: 'from-rose-500 to-red-600',
      activeClass: isLight
        ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40'
        : 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/10',
      dotColor: 'bg-rose-500',
    },
  ]

  const hasActiveFilters = searchTerm !== '' || filterStatus !== 'all' || filterType !== 'all'

  const resetFilters = () => {
    setSearchTerm('')
    setFilterStatus('all')
    setFilterType('all')
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Scope Tabs if multiple dorms */}
      <DormTabs
        scope={dormScope}
        isLight={isLight}
        onChange={() => {
          setCurrentPage(1)
          setSearchTerm('')
          setPdfModal({ id: null })
          setStatusModal({ isOpen: false })
          deleteModal.close()
        }}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20">
              <FileText size={22} strokeWidth={2.4} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${textStrong}`}>
                  Arizalar boshqaruvi
                </h1>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                }`}>
                  Jami: {requests.length}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${textMuted}`}>
                Talabalar murojaatlari va tushuntirish xatlarini ko‘rib chiqish paneli
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadRequests}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 self-start sm:self-auto shadow-xs active:scale-95 ${
            isLight
              ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              : 'border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800'
          }`}
          title="Ma'lumotlarni yangilash"
        >
          <motion.div
            animate={loading ? { rotate: 360 } : {}}
            transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
          >
            <RotateCcw size={14} />
          </motion.div>
          <span>Yangilash</span>
        </button>
      </div>

      {/* Interactive KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon
          const isCurrentActive = filterStatus === card.key

          return (
            <motion.button
              key={card.title}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => {
                setFilterStatus(isCurrentActive && card.key !== 'all' ? 'all' : card.key)
                setCurrentPage(1)
              }}
              className={`no-shelf p-4 rounded-2xl border text-left transition-all relative overflow-hidden group active:scale-[0.98] ${
                isCurrentActive ? card.activeClass : ui.card
              } ${ui.hoverLift}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                    {card.title}
                  </p>
                  <p className={`text-2xl sm:text-3xl font-black mt-1.5 leading-none ${textStrong}`}>
                    {loading ? '—' : card.count}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} text-white flex items-center justify-center shrink-0 shadow-md shadow-black/10 group-hover:scale-105 transition-transform`}
                >
                  <Icon size={18} strokeWidth={2.4} />
                </div>
              </div>

              {/* Progress track */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                  <span>Ulush</span>
                  <span>{loading ? '—' : `${card.percentage}%`}</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: loading ? 0 : `${card.percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${card.dotColor}`}
                  />
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Filter and Search Controls */}
      <div className={`p-3.5 sm:p-4 rounded-2xl border space-y-3.5 ${ui.card}`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" size={17} />
            <input
              type="text"
              placeholder="Talaba ismi yoki xona raqami bo‘yicha qidirish..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className={`w-full rounded-xl border py-2.5 pl-10 pr-9 text-sm outline-none transition-all shadow-xs ${inputBg}`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setCurrentPage(1)
                }}
                className="no-shelf absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Reset Filters button if active */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className={`no-shelf inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all shrink-0 active:scale-95 ${
                isLight
                  ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                  : 'border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
              }`}
            >
              <X size={13} />
              <span>Filtrni tozalash</span>
            </button>
          )}
        </div>

        {/* Quick Segmented Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider mr-0.5 ${textMuted}`}>
              Holat:
            </span>
            <div className={`no-shelf inline-flex items-center p-1 rounded-xl border gap-1 transition-colors ${
              isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-950/70 border-slate-800/90'
            }`}>
              {[
                { id: 'all', label: 'Barchasi', count: stats.total },
                { id: 'pending', label: 'Kutilmoqda', count: stats.pending, highlight: stats.pending > 0 },
                { id: 'approved', label: 'Tasdiqlangan', count: stats.approved },
                { id: 'rejected', label: 'Rad etilgan', count: stats.rejected },
              ].map((tab) => {
                const isActive = filterStatus === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setFilterStatus(tab.id as typeof filterStatus)
                      setCurrentPage(1)
                    }}
                    className={`no-shelf relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 ${
                      isActive
                        ? isLight
                          ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/70 font-black'
                          : 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30 border border-indigo-500/30 font-black'
                        : isLight
                          ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                        isActive
                          ? isLight
                            ? 'bg-indigo-50 text-indigo-700 font-black'
                            : 'bg-white/20 text-white font-black'
                          : isLight
                            ? 'bg-slate-200/80 text-slate-600'
                            : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tab.highlight && !isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1 animate-pulse" />
                      )}
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Type Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider mr-0.5 ${textMuted}`}>
              Turi:
            </span>
            <div className={`no-shelf inline-flex items-center p-1 rounded-xl border gap-1 transition-colors ${
              isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-950/70 border-slate-800/90'
            }`}>
              {[
                { id: 'all', label: 'Barchasi' },
                { id: 'ariza', label: 'Ariza' },
                { id: 'tushuntirish', label: 'Tushuntirish xati' },
              ].map((t) => {
                const isActive = filterType === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setFilterType(t.id as typeof filterType)
                      setCurrentPage(1)
                    }}
                    className={`no-shelf relative inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 ${
                      isActive
                        ? isLight
                          ? 'bg-white text-slate-900 shadow-xs border border-slate-200/70 font-black'
                          : 'bg-slate-800 text-white shadow-xs border border-slate-700/80 font-black'
                        : isLight
                          ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
                    }`}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
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
          emptyMessage={
            hasActiveFilters
              ? 'Filtr bo‘yicha hech qanday ariza topilmadi'
              : 'Hozircha arizalar mavjud emas'
          }
          pagination={{
            current: currentPage,
            total: filteredRequests.length,
            pageSize,
            onPageChange: setCurrentPage,
          }}
        />
      </motion.div>

      {/* PDF Modal */}
      <ArizaPdfViewerModal
        arizaId={pdfModal.id}
        studentName={pdfModal.name}
        isLight={isLight}
        onClose={() => setPdfModal({ id: null })}
      />

      {/* Status Update Modal — admin/dekan only */}
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
