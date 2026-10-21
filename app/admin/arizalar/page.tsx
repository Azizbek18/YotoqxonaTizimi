'use client'

import DormTabs from '@/components/dekan/DormTabs'
import { useDormTabs } from '@/lib/hooks/useDormTabs'
import { studentsInDorm } from '@/features/faculty-students/domain/dorm-scope'

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Sparkles,
  CheckCheck,
  LayoutGrid,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTable, { type TableColumn } from '@/components/admin/AdminTable'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CustomSelect from '@/components/ui/CustomSelect'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useStaffPanel } from '@/lib/hooks/useStaffPanel'
import { dekanUI } from '@/lib/dekan-ui'
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

  const ui = dekanUI(isLight)
  const { isTarbiyachi, canDeleteArizalar, canModerateArizalar } = useStaffPanel()
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
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBatchDeciding, setIsBatchDeciding] = useState(false)

  const [pdfModal, setPdfModal] = useState<{ id: string | null; name?: string }>({ id: null })
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; request?: ApplicationRequest }>({ isOpen: false })
  const [batchModal, setBatchModal] = useState<{
    isOpen: boolean
    action: 'approved' | 'rejected'
    ids: string[]
    title: string
    description: string
  }>({
    isOpen: false,
    action: 'approved',
    ids: [],
    title: '',
    description: '',
  })
  const deleteModal = useConfirmModal<string>()
  const [newStatus, setNewStatus] = useState<ApplicationRequest['level']>('info')
  const [newRealStatus, setNewRealStatus] = useState<string>('pending')
  const [isUpdating, setIsUpdating] = useState(false)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 12

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

  // Sorted requests
  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortBy]
      const bVal = (b as unknown as Record<string, unknown>)[sortBy]
      const normA = typeof aVal === 'number' ? aVal : String(aVal ?? '')
      const normB = typeof bVal === 'number' ? bVal : String(bVal ?? '')
      if (normA < normB) return sortOrder === 'asc' ? -1 : 1
      if (normA > normB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredRequests, sortBy, sortOrder])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRequests.length / pageSize))
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRequests.slice(start, start + pageSize)
  }, [sortedRequests, currentPage, pageSize])

  // Pending queue for sequential modal review
  const pendingRequests = useMemo(
    () => filteredRequests.filter((r) => (r.status ?? 'pending') === 'pending'),
    [filteredRequests]
  )

  const activePdfRequest = useMemo(() => {
    if (!pdfModal.id) return null
    return requests.find((r) => r.id === pdfModal.id) ?? null
  }, [requests, pdfModal.id])

  const activePdfIndexInPending = useMemo(() => {
    if (!pdfModal.id) return -1
    return pendingRequests.findIndex((r) => r.id === pdfModal.id)
  }, [pendingRequests, pdfModal.id])

  // Apply single or batch status change to API and update local state
  const applyStatusChange = async (
    target: string | string[],
    patch: { status: string; level?: ApplicationRequest['level'] }
  ) => {
    const ids = Array.isArray(target) ? target : [target]
    if (ids.length === 0) return

    const payload = ids.length === 1 ? { id: ids[0], ...patch } : { ids, ...patch }
    const response = await fetch('/api/admin/arizalar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await response.json() as { ok: boolean; count?: number; error?: string }
    if (!response.ok || !result.ok) throw new Error(result.error ?? 'Yangilashda xato!')

    const idSet = new Set(ids)
    setRequests((prev) =>
      prev.map((r) => (idSet.has(r.id) ? { ...r, status: patch.status, level: patch.level ?? r.level } : r))
    )
    setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)))
  }

  // 1-Click fast decision from card or table row
  // Resolves true only when the decision was saved, so the review modal does
  // not skip past an application whose update failed.
  const quickDecide = async (request: ApplicationRequest, status: 'approved' | 'rejected'): Promise<boolean> => {
    setDecidingId(request.id)
    try {
      await applyStatusChange(request.id, { status })
      toast.success(status === 'approved' ? '✓ Ariza tasdiqlandi' : '✕ Ariza rad etildi')
      return true
    } catch (error) {
      console.error('Yangilashda xato:', error)
      toast.error(error instanceof Error ? error.message : 'Yangilashda xato!')
      return false
    } finally {
      setDecidingId(null)
    }
  }

  // Batch actions
  const handleBatchAllPending = () => {
    const allPendingIds = pendingRequests.map((r) => r.id)
    if (allPendingIds.length === 0) {
      toast.error('Kutilayotgan arizalar mavjud emas')
      return
    }
    setBatchModal({
      isOpen: true,
      action: 'approved',
      ids: allPendingIds,
      title: 'Barcha arizalarni tasdiqlash',
      description: `Haqiqatan ham barcha ${allPendingIds.length} ta kutilayotgan arizani tasdiqlamoqchimisiz?`,
    })
  }

  const handleBatchSelected = (action: 'approved' | 'rejected') => {
    if (selectedIds.length === 0) return
    const actionLabel = action === 'approved' ? 'tasdiqlash' : 'rad etish'
    setBatchModal({
      isOpen: true,
      action,
      ids: selectedIds,
      title: `Tanlangan arizalarni ${actionLabel}`,
      description: `Haqiqatan ham tanlangan ${selectedIds.length} ta arizani ${actionLabel}ni xohlaysizmi?`,
    })
  }

  const confirmBatchAction = async () => {
    if (batchModal.ids.length === 0) return
    setIsBatchDeciding(true)
    try {
      await applyStatusChange(batchModal.ids, { status: batchModal.action })
      toast.success(
        batchModal.action === 'approved'
          ? `✓ ${batchModal.ids.length} ta ariza muvaffaqiyatli tasdiqlandi`
          : `✕ ${batchModal.ids.length} ta ariza rad etildi`
      )
      setBatchModal({ isOpen: false, action: 'approved', ids: [], title: '', description: '' })
    } catch (error) {
      console.error('Ommaviy yangilashda xato:', error)
      toast.error(error instanceof Error ? error.message : 'Yangilashda xato!')
    } finally {
      setIsBatchDeciding(false)
    }
  }

  // Modal queue actions
  const handleModalNext = () => {
    if (activePdfIndexInPending >= 0 && activePdfIndexInPending < pendingRequests.length - 1) {
      const nextReq = pendingRequests[activePdfIndexInPending + 1]
      setPdfModal({ id: nextReq.id, name: nextReq.student_name })
    }
  }

  const handleModalPrev = () => {
    if (activePdfIndexInPending > 0) {
      const prevReq = pendingRequests[activePdfIndexInPending - 1]
      setPdfModal({ id: prevReq.id, name: prevReq.student_name })
    }
  }

  const handleModalApprove = async (id: string) => {
    const req = requests.find((r) => r.id === id)
    if (!req) return
    if (!(await quickDecide(req, 'approved'))) return
    const remaining = pendingRequests.filter((r) => r.id !== id)
    if (remaining.length > 0) {
      const nextIdx = Math.min(activePdfIndexInPending, remaining.length - 1)
      const nextReq = remaining[nextIdx]
      setPdfModal({ id: nextReq.id, name: nextReq.student_name })
    } else {
      setPdfModal({ id: null })
      toast.success("Barcha kutilayotgan arizalar ko'rib chiqildi!")
    }
  }

  const handleModalReject = async (id: string) => {
    const req = requests.find((r) => r.id === id)
    if (!req) return
    if (!(await quickDecide(req, 'rejected'))) return
    const remaining = pendingRequests.filter((r) => r.id !== id)
    if (remaining.length > 0) {
      const nextIdx = Math.min(activePdfIndexInPending, remaining.length - 1)
      const nextReq = remaining[nextIdx]
      setPdfModal({ id: nextReq.id, name: nextReq.student_name })
    } else {
      setPdfModal({ id: null })
    }
  }

  // Selection toggle
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAllCurrent = () => {
    const pendingOnCurrentPage = paginatedRequests
      .filter((r) => (r.status ?? 'pending') === 'pending')
      .map((r) => r.id)
    const allSelected = pendingOnCurrentPage.every((id) => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pendingOnCurrentPage.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pendingOnCurrentPage])))
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
      setSelectedIds((prev) => prev.filter(itemId => itemId !== id))
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
      label: 'Tezkor amallar',
      render: (_value: unknown, row: ApplicationRequest) => {
        const pending = (row.status ?? 'pending') === 'pending'
        return (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPdfModal({ id: row.id, name: row.student_name })}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 shadow-xs ${
                isLight
                  ? 'border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300'
                  : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
              }`}
              title="Hujjatni to‘liq ko‘rish"
            >
              <FileText size={13} className="text-indigo-500" />
              <span>Hujjat</span>
            </button>

            {pending && canModerateArizalar ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => quickDecide(row, 'approved')}
                  disabled={decidingId === row.id}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all active:scale-95 disabled:opacity-50 shadow-xs ${
                    isLight
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                  }`}
                  title="Arizani darhol tasdiqlash"
                >
                  {decidingId === row.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={14} strokeWidth={2.8} className="text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>Tasdiqlash</span>
                </button>
                <button
                  type="button"
                  onClick={() => quickDecide(row, 'rejected')}
                  disabled={decidingId === row.id}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-xs ${
                    isLight
                      ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                  }`}
                  title="Arizani rad etish"
                >
                  {decidingId === row.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <XIcon size={14} strokeWidth={2.6} className="text-rose-500" />
                  )}
                  <span>Rad</span>
                </button>
              </div>
            ) : null}

            {/* Dekan/admin keep their edit + delete controls on every row,
                including pending ones (quick decide is shown in addition). */}
            {!isTarbiyachi ? (
              <div className="flex items-center gap-1">
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
            ) : !pending ? (
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic px-1">
                Ko‘rib chiqilgan
              </span>
            ) : null}
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
          setSelectedIds([])
          setPdfModal({ id: null })
          setStatusModal({ isOpen: false })
          deleteModal.close()
        }}
      />

      {/* Hero banner */}
      <div className="no-shelf relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-4 sm:p-5 shadow-lg shadow-indigo-950/15 border border-white/20 text-white">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-16 h-48 w-48 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.07]" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md text-white border border-white/25 shadow-inner shrink-0">
              <FileText size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Jami: {requests.length}
                </span>
                {stats.pending > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/25 text-amber-200 border border-amber-400/35">
                    <Sparkles size={11} className="text-amber-300" />
                    {stats.pending} ta kutilmoqda
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white" style={{ color: '#ffffff' }}>
                Arizalar boshqaruvi
              </h1>
              <p className="mt-0.5 text-xs text-indigo-100" style={{ color: '#e0e7ff' }}>
                Talabalar murojaatlari va tushuntirish xatlarini ko‘rib chiqish paneli
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {pendingRequests.length > 0 && canModerateArizalar && (
              <button
                type="button"
                onClick={handleBatchAllPending}
                className="no-shelf inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold transition-all active:scale-95 shadow-md shadow-emerald-950/20 border border-emerald-400/40 cursor-pointer"
                title="Barcha kutilayotgan arizalarni bir bosishda tasdiqlash"
              >
                <CheckCheck size={15} strokeWidth={2.8} />
                <span>Barchasini tasdiqlash ({pendingRequests.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadRequests}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white text-xs font-bold transition-all disabled:opacity-50 no-shelf cursor-pointer active:scale-95 shadow-xs"
              title="Ma'lumotlarni yangilash"
            >
              <motion.div
                animate={loading ? { rotate: 360 } : {}}
                transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
              >
                <RotateCcw size={14} />
              </motion.div>
              <span style={{ color: '#ffffff' }}>{loading ? '...' : 'Yangilash'}</span>
            </button>
          </div>
        </div>
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

      {/* Fast Batch Action Toolbar when items are selected OR pending items exist */}
      <AnimatePresence>
        {canModerateArizalar && (selectedIds.length > 0 || (pendingRequests.length > 0 && filterStatus !== 'approved' && filterStatus !== 'rejected')) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-3 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              selectedIds.length > 0
                ? isLight
                  ? 'bg-indigo-50/70 border-indigo-200'
                  : 'bg-indigo-950/30 border-indigo-500/30'
                : isLight
                  ? 'bg-amber-50/70 border-amber-200'
                  : 'bg-amber-950/20 border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                selectedIds.length > 0
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-amber-500 text-white shadow-xs'
              }`}>
                {selectedIds.length > 0 ? <CheckCheck size={16} /> : <Sparkles size={16} />}
              </div>
              <div>
                <p className={`text-xs font-extrabold ${textStrong}`}>
                  {selectedIds.length > 0
                    ? `${selectedIds.length} ta ariza tanlandi`
                    : `Kutilayotgan arizalar: ${stats.pending} ta`}
                </p>
                <p className={`text-[11px] ${textMuted}`}>
                  {selectedIds.length > 0
                    ? 'Tanlangan arizalar ustida bir vaqtda qaror qabul qiling'
                    : 'Arizalarni navbat bilan yoki barchasini birdaniga tasdiqlang'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedIds.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleBatchSelected('approved')}
                    className="no-shelf inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-extrabold shadow-sm hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all"
                  >
                    <Check size={14} strokeWidth={2.8} />
                    <span>Tanlanganlarni tasdiqlash ({selectedIds.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchSelected('rejected')}
                    className="no-shelf inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 active:scale-95 transition-all"
                  >
                    <XIcon size={14} strokeWidth={2.6} />
                    <span>Rad etish</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className={`no-shelf text-xs font-bold px-2.5 py-2 rounded-xl transition-colors ${
                      isLight ? 'text-slate-600 hover:bg-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Tozalash
                  </button>
                </>
              ) : (
                <>
                  {pendingRequests.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const first = pendingRequests[0]
                        setPdfModal({ id: first.id, name: first.student_name })
                      }}
                      className={`no-shelf inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                        isLight
                          ? 'border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50'
                          : 'border-indigo-500/40 bg-slate-800 text-indigo-300 hover:bg-slate-700'
                      }`}
                    >
                      <FileText size={14} />
                      <span>Ko‘rib chiqishni boshlash (1/{pendingRequests.length})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleBatchAllPending}
                    className="no-shelf inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-extrabold shadow-sm hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all"
                  >
                    <CheckCheck size={15} strokeWidth={2.8} />
                    <span>Barchasini tasdiqlash ({pendingRequests.length})</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

          {/* View mode toggle (Cards vs Table) */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className={`no-shelf inline-flex items-center p-1 rounded-xl border gap-1 transition-colors ${
              isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-950/70 border-slate-800/90'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`no-shelf inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'cards'
                    ? isLight
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/70'
                      : 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Kartalar ko'rinishi"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Kartalar</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`no-shelf inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? isLight
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/70'
                      : 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Jadval ko'rinishi"
              >
                <TableIcon size={14} />
                <span className="hidden sm:inline">Jadval</span>
              </button>
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
                <span>Tozalash</span>
              </button>
            )}
          </div>
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

      {/* Main Content Area: Cards View OR Table View */}
      {viewMode === 'cards' ? (
        <div className="space-y-4">
          {/* Batch select header for cards */}
          {paginatedRequests.some((r) => (r.status ?? 'pending') === 'pending') && (
            <div className="flex items-center justify-between text-xs font-bold px-1">
              <button
                type="button"
                onClick={toggleSelectAllCurrent}
                className={`no-shelf inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg border transition-colors ${
                  isLight
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <CheckCheck size={13} />
                <span>Sahifadagi barcha kutilayotganlarni tanlash</span>
              </button>
              <span className={textMuted}>
                Jami: {filteredRequests.length} ta ariza
              </span>
            </div>
          )}

          {loading ? (
            <div className={`p-12 rounded-2xl border text-center ${ui.card}`}>
              <Loader2 size={28} className="animate-spin mx-auto text-indigo-500 mb-2" />
              <p className={`text-sm font-bold ${textStrong}`}>Arizalar yuklanmoqda...</p>
            </div>
          ) : paginatedRequests.length === 0 ? (
            <div className={`p-12 rounded-2xl border text-center ${ui.card}`}>
              <Inbox size={36} className="mx-auto text-slate-400 mb-2 opacity-60" />
              <p className={`text-sm font-bold ${textStrong}`}>
                {hasActiveFilters ? 'Filtr bo‘yicha ariza topilmadi' : 'Hozircha arizalar mavjud emas'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                >
                  <RotateCcw size={12} />
                  Filtrni bekor qilish
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
              {paginatedRequests.map((req) => {
                const isPending = (req.status ?? 'pending') === 'pending'
                const isApproved = req.status === 'approved'
                const isRejected = req.status === 'rejected'
                const isAriza = req.type === 'ariza'
                const isSelected = selectedIds.includes(req.id)
                const dateStr = req.created_at
                  ? new Date(req.created_at).toLocaleDateString('uz-UZ', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null

                return (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? isLight
                          ? 'border-indigo-400 ring-2 ring-indigo-400/20 bg-indigo-50/20 shadow-md'
                          : 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-950/20 shadow-md'
                        : ui.card
                    } ${ui.hoverLift}`}
                  >
                    {/* Top Row: Avatar + Name + Checkbox & Status */}
                    <div>
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          {isPending && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(req.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer shrink-0"
                            />
                          )}
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border shadow-xs ${
                              isLight
                                ? 'bg-slate-100 text-slate-700 border-slate-200/80'
                                : 'bg-slate-800 text-slate-200 border-slate-700'
                            }`}
                          >
                            {getInitials(req.student_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => setPdfModal({ id: req.id, name: req.student_name })}
                              className={`text-left font-black text-sm tracking-tight transition-colors truncate block ${
                                isLight ? 'text-slate-900 hover:text-indigo-600' : 'text-slate-100 hover:text-indigo-400'
                              }`}
                            >
                              {req.student_name}
                            </button>
                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              <Building2 size={12} className="opacity-70 shrink-0" />
                              <span className="font-medium truncate">
                                {req.room_number ? `${req.room_number}-xona` : 'Xona ko‘rsatilmagan'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25">
                              <Check size={11} strokeWidth={3} />
                              Tasdiqlangan
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/25">
                              <XIcon size={11} strokeWidth={3} />
                              Rad etilgan
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Kutilmoqda
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Warning notice if high tushuntirish count */}
                      {req.tushuntirish_count >= TUSHUNTIRISH_WARNING_THRESHOLD && (
                        <div className="mt-3 p-2 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/25 flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                          <span>Talaba {req.tushuntirish_count} marta tushuntirish yozgan!</span>
                        </div>
                      )}

                      {/* Metadata pills */}
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                          isAriza
                            ? isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-500/15 text-blue-300'
                            : isLight ? 'bg-amber-50 text-amber-800' : 'bg-amber-500/15 text-amber-300'
                        }`}>
                          {isAriza ? <FileText size={11} /> : <AlertCircle size={11} />}
                          {TYPE_LABELS[req.type]}
                        </span>
                        {dateStr && (
                          <span className={`inline-flex items-center gap-1 text-[11px] ${textMuted}`}>
                            <Calendar size={11} className="opacity-70" />
                            {dateStr}
                          </span>
                        )}
                      </div>

                      {/* Excerpt text snippet */}
                      {req.text && (
                        <p className={`mt-2.5 text-xs line-clamp-2 leading-relaxed ${textMuted} italic`}>
                          &ldquo;{req.text}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Card Actions Bottom Toolbar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPdfModal({ id: req.id, name: req.student_name })}
                        className={`no-shelf inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 shadow-2xs ${
                          isLight
                            ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-600'
                            : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-indigo-300'
                        }`}
                      >
                        <FileText size={13} className="text-indigo-500" />
                        <span>Hujjat</span>
                      </button>

                      {isPending && canModerateArizalar ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => quickDecide(req, 'approved')}
                            disabled={decidingId === req.id}
                            className="no-shelf inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-500 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                          >
                            {decidingId === req.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Check size={14} strokeWidth={3} />
                            )}
                            <span>Tasdiqlash</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => quickDecide(req, 'rejected')}
                            disabled={decidingId === req.id}
                            className="no-shelf inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 active:scale-95 disabled:opacity-50 text-xs font-bold transition-all dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                            title="Rad etish"
                          >
                            {decidingId === req.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <XIcon size={14} strokeWidth={2.6} />
                            )}
                            <span>Rad</span>
                          </button>
                        </div>
                      ) : null}

                      {!isTarbiyachi ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setStatusModal({ isOpen: true, request: req })
                              setNewStatus(req.level)
                              setNewRealStatus(req.status || 'pending')
                            }}
                            className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all active:scale-90 ${
                              isLight
                                ? 'border-slate-200 bg-white text-slate-600 hover:text-indigo-600'
                                : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-indigo-300'
                            }`}
                            title="Holatni tahrirlash"
                          >
                            <Edit2 size={13} />
                          </button>
                          {canDeleteArizalar && (
                            <button
                              type="button"
                              onClick={() => handleDelete(req.id)}
                              className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all active:scale-90 ${
                                isLight
                                  ? 'border-slate-200 bg-white text-rose-600 hover:bg-rose-50'
                                  : 'border-slate-700 bg-slate-800 text-rose-400 hover:bg-rose-500/10'
                              }`}
                              title="O'chirish"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ) : !isPending ? (
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic px-1">
                          Ko‘rib chiqilgan
                        </span>
                      ) : null}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Cards Pagination */}
          {totalPages > 1 && (
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${ui.card}`}>
              <p className={`text-xs ${textMuted}`}>
                Jami {filteredRequests.length} tadan {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredRequests.length)} ko‘rsatilmoqda
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={`no-shelf inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 ${
                    isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  <ChevronLeft size={13} />
                  <span>Oldingi</span>
                </button>
                <span className={`text-xs font-black px-2 ${textStrong}`}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={`no-shelf inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 ${
                    isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  <span>Keyingi</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Table View */
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
      )}

      {/* Full PDF Viewer Modal with direct 1-tap decision buttons & queue navigation */}
      <ArizaPdfViewerModal
        arizaId={pdfModal.id}
        studentName={pdfModal.name}
        status={activePdfRequest?.status}
        roomNumber={activePdfRequest?.room_number}
        createdAt={activePdfRequest?.created_at}
        tushuntirishCount={activePdfRequest?.tushuntirish_count ?? 0}
        canModerate={canModerateArizalar}
        isLight={isLight}
        isDeciding={decidingId === pdfModal.id}
        onApprove={handleModalApprove}
        onReject={handleModalReject}
        onClose={() => setPdfModal({ id: null })}
        currentIndex={activePdfIndexInPending >= 0 ? activePdfIndexInPending : undefined}
        totalCount={pendingRequests.length > 0 ? pendingRequests.length : undefined}
        onPrev={activePdfIndexInPending > 0 ? handleModalPrev : undefined}
        onNext={activePdfIndexInPending >= 0 && activePdfIndexInPending < pendingRequests.length - 1 ? handleModalNext : undefined}
      />

      {/* Batch Action Confirmation Modal */}
      <ConfirmModal
        isOpen={batchModal.isOpen}
        title={batchModal.title}
        description={batchModal.description}
        onClose={() => setBatchModal({ isOpen: false, action: 'approved', ids: [], title: '', description: '' })}
        onConfirm={confirmBatchAction}
        confirmText={batchModal.action === 'approved' ? 'Ha, barchasini tasdiqlash' : 'Ha, rad etish'}
        confirmVariant={batchModal.action === 'approved' ? 'primary' : 'danger'}
        isLoading={isBatchDeciding}
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
