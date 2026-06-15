'use client'

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Eye, Edit2, Trash2, FileText, Filter, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTable, { type TableColumn } from '@/components/admin/AdminTable'
import AdminModal from '@/components/admin/AdminModal'
import { useThemeStore } from '@/lib/stores/theme-store'

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

const STATUS_COLORS: Record<string, string> = {
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const REAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
}

const REAL_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function AdminArizalar() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const cardBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const textBody = isLight ? 'text-slate-700' : 'text-slate-300'
  const inputBg = isLight ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500/50' : 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-purple-500/50'

  const [requests, setRequests] = useState<ApplicationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | ApplicationRequest['level']>('all')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [detailModal, setDetailModal] = useState<{ isOpen: boolean; request?: ApplicationRequest }>({ isOpen: false })
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; request?: ApplicationRequest }>({ isOpen: false })
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

  const handleDelete = async (id: string) => {
    if (!confirm("Arizani o'chirmoqchisiz?")) return

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
    } catch (error) {
      console.error("O'chirishda xato:", error)
      toast.error("O'chirishda xato!")
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
        <div className="cursor-pointer hover:text-purple-400 transition-colors" onClick={() => setDetailModal({ isOpen: true, request: row })}>
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
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[String(value)]}`}>
          {STATUS_LABELS[String(value)]}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Holat',
      sortable: true,
      render: (value: unknown) => (
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${REAL_STATUS_COLORS[String(value ?? 'pending')]}`}>
          {REAL_STATUS_LABELS[String(value ?? 'pending')]}
        </span>
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
            className={`rounded-xl border p-2.5 text-blue-400 transition-all hover:bg-blue-400/10 hover:border-blue-400/20 active:scale-95 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-white/5'}`}
            title="Ko'rish"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => {
              setStatusModal({ isOpen: true, request: row })
              setNewStatus(row.level)
              setNewRealStatus(row.status || 'pending')
            }}
            className={`rounded-xl border p-2.5 text-amber-400 transition-all hover:bg-amber-400/10 hover:border-amber-400/20 active:scale-95 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-white/5'}`}
            title="Holat o'zgartirish"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className={`rounded-xl border p-2.5 text-red-400 transition-all hover:bg-red-400/10 hover:border-red-400/20 active:scale-95 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-white/5'}`}
            title="O'chirish"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  const statCards = [
    { title: 'Jami Arizalar', count: stats.total, color: 'from-slate-500 to-slate-600', glow: 'rgba(148,163,184,0.15)', textColor: 'text-slate-400', barColor: 'bg-slate-500', percentage: 100, icon: FileText },
    { title: 'Ma\'lumot (Info)', count: stats.info, color: 'from-blue-500 to-indigo-600', glow: 'rgba(59,130,246,0.15)', textColor: 'text-blue-400', barColor: 'bg-blue-500', percentage: stats.total > 0 ? Math.round((stats.info / stats.total) * 100) : 0, icon: FileText },
    { title: 'Ogohlantirish', count: stats.warning, color: 'from-amber-500 to-orange-600', glow: 'rgba(245,158,11,0.15)', textColor: 'text-amber-400', barColor: 'bg-amber-500', percentage: stats.total > 0 ? Math.round((stats.warning / stats.total) * 100) : 0, icon: Filter },
    { title: 'Muhim (Critical)', count: stats.critical, color: 'from-rose-500 to-red-600', glow: 'rgba(244,63,94,0.15)', textColor: 'text-rose-400', barColor: 'bg-rose-500', percentage: stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0, icon: FileText },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`flex items-center gap-3 text-3xl font-black tracking-tighter sm:text-4xl ${textStrong}`}>
            <div className="rounded-2xl bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
              <FileText size={30} />
            </div>
            Arizalar boshqaruvi
          </h1>
          <p className={`mt-2 text-sm ${textMuted}`}>Talabalar tomonidan yuborilgan murojaat va arizalar ro&apos;yxati</p>
        </div>
        
        <button
          onClick={loadRequests}
          disabled={loading}
          className="inline-flex items-center justify-center p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all disabled:opacity-50 self-start sm:self-auto"
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
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              whileHover={{ y: -5, scale: 1.01 }}
              className={`relative overflow-hidden rounded-2xl border p-5 shadow-xl transition-all group ${
                isLight ? 'bg-white/80 border-slate-200 shadow-slate-100/50' : 'bg-[#0b1120]/60 border-white/10'
              }`}
              style={{
                boxShadow: isLight ? undefined : `0 10px 30px -10px ${card.glow}`,
              }}
            >
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-linear-to-br from-white/10 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>{card.title}</p>
                  <p className={`mt-2 text-3xl font-black leading-none ${textStrong}`}>
                    {loading ? '...' : card.count}
                  </p>
                </div>
                <div className={`rounded-xl p-3 bg-linear-to-br ${card.color} text-white shadow-lg`}>
                  <Icon size={20} />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mb-1">
                  <span>ULUSH</span>
                  <span>{loading ? '...' : `${card.percentage}%`}</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: loading ? 0 : `${card.percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full ${card.barColor} rounded-full`}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className={`mb-6 rounded-2xl border p-4 backdrop-blur-md ${isLight ? 'bg-white/60 border-slate-200 shadow-sm' : 'bg-[#0b1120]/40 border-white/5'}`}>
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
            <Filter className="absolute left-3 top-3.5 text-slate-400 pointer-events-none" size={18} />
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as 'all' | ApplicationRequest['level'])
                setCurrentPage(1)
              }}
              className={`w-full rounded-xl border py-3 pl-10 pr-4 text-sm outline-none transition-all appearance-none cursor-pointer ${inputBg}`}
            >
              <option value="all" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}>Barcha arizalar</option>
              <option value="info" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}>Info</option>
              <option value="warning" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}>Ogohlantirish</option>
              <option value="critical" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}>Muhim</option>
            </select>
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
      <AdminModal
        isOpen={detailModal.isOpen}
        title=""
        onClose={() => setDetailModal({ isOpen: false })}
      >
        {detailModal.request && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-400">
                <FileText size={22} />
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
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border ${cardBg}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${textMuted} mb-2`}>Daraja</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[detailModal.request.level]}`}>
                    {STATUS_LABELS[detailModal.request.level]}
                  </span>
                </div>
                <div className={`p-4 rounded-xl border ${cardBg}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${textMuted} mb-2`}>Holat</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${REAL_STATUS_COLORS[detailModal.request.status || 'pending']}`}>
                    {REAL_STATUS_LABELS[detailModal.request.status || 'pending']}
                  </span>
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
      </AdminModal>

      {/* Status Update Modal */}
      <AdminModal
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
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Yangi daraja:</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ApplicationRequest['level'])}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all ${inputBg}`}
            >
              <option value="info" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}>Info</option>
              <option value="warning" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}>Ogohlantirish</option>
              <option value="critical" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}>Muhim</option>
            </select>
          </div>
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Yangi holat:</label>
            <select
              value={newRealStatus}
              onChange={(e) => setNewRealStatus(e.target.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all ${inputBg}`}
            >
              <option value="pending" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}>Kutilmoqda</option>
              <option value="approved" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}>Tasdiqlangan</option>
              <option value="rejected" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}>Rad etilgan</option>
            </select>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-1">
            <p className="text-xs text-purple-300 font-semibold">
              Hozirgi daraja: <span className="font-bold text-white">{STATUS_LABELS[statusModal.request?.level || 'info']}</span>
            </p>
            <p className="text-xs text-purple-300 font-semibold">
              Hozirgi holat: <span className="font-bold text-white">{REAL_STATUS_LABELS[statusModal.request?.status || 'pending']}</span>
            </p>
          </div>
        </div>
      </AdminModal>
    </div>
  )
}
