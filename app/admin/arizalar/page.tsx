'use client'

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Eye, Edit2, Trash2, FileText, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTable, { type TableColumn } from '@/components/admin/AdminTable'
import AdminModal from '@/components/admin/AdminModal'

interface ApplicationRequest {
  id: string
  student_name: string
  text: string
  level: 'info' | 'warning' | 'critical'
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

export default function AdminArizalar() {
  const [requests, setRequests] = useState<ApplicationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | ApplicationRequest['level']>('all')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [detailModal, setDetailModal] = useState<{ isOpen: boolean; request?: ApplicationRequest }>({ isOpen: false })
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; request?: ApplicationRequest }>({ isOpen: false })
  const [newStatus, setNewStatus] = useState<ApplicationRequest['level']>('info')
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
        }),
      })
      const result = await response.json() as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'Yangilashda xato!')
      }

      setRequests(requests.map(r => r.id === statusModal.request?.id ? { ...r, level: newStatus } : r))
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
    new: requests.filter(r => r.level === 'info').length,
    approved: requests.filter(r => r.level === 'warning').length,
    rejected: requests.filter(r => r.level === 'critical').length,
    pending: 0,
  }

  const columns: TableColumn<ApplicationRequest>[] = [
    {
      key: 'student_name',
      label: 'Talaba',
      sortable: true,
      render: (value: unknown, row: ApplicationRequest) => (
        <div className="cursor-pointer hover:text-purple-400 transition-colors" onClick={() => setDetailModal({ isOpen: true, request: row })}>
          <p className="font-semibold text-white">{String(value ?? '')}</p>
          <p className="text-xs text-slate-400 line-clamp-1">{row.text}</p>
        </div>
      ),
    },
    {
      key: 'text',
      label: 'Matn',
      sortable: false,
      render: (value: unknown) => (
        <p className="text-sm text-slate-300 line-clamp-2">{String(value ?? '')}</p>
      ),
    },
    {
      key: 'level',
      label: 'Holat',
      sortable: true,
      render: (value: unknown) => (
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[String(value)]}`}>
          {STATUS_LABELS[String(value)]}
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
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-blue-400 hover:text-blue-300"
            title="Ko'rish"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => {
              setStatusModal({ isOpen: true, request: row })
              setNewStatus(row.level)
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-amber-400 hover:text-amber-300"
            title="Holat o'zgartirish"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-red-400 hover:text-red-300"
            title="O'chirish"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter flex items-center gap-2">
            <FileText size={32} />
            Arizalar Boshqaruvi
          </h1>
          <p className="text-slate-400 mt-2">Jami: {filteredRequests.length} ta ariza</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-500/10 border border-slate-500/30 rounded-lg p-3 text-center"
        >
          <p className="text-xs text-slate-400 mb-1">Jami</p>
          <p className="text-xl font-bold text-white">{stats.total}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center"
        >
          <p className="text-xs text-blue-400 mb-1">Yangi</p>
          <p className="text-xl font-bold text-blue-300">{stats.new}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center"
        >
          <p className="text-xs text-yellow-400 mb-1">Ogohlantirish</p>
          <p className="text-xl font-bold text-yellow-300">{stats.approved}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center"
        >
          <p className="text-xs text-green-400 mb-1">Info</p>
          <p className="text-xl font-bold text-green-300">{stats.new}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center"
        >
          <p className="text-xs text-red-400 mb-1">Muhim</p>
          <p className="text-xl font-bold text-red-300">{stats.rejected}</p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="relative col-span-1 sm:col-span-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Arizani qidirish..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-2">
          <Filter size={20} className="text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as 'all' | ApplicationRequest['level'])
              setCurrentPage(1)
            }}
            className="flex-1 bg-transparent text-white focus:outline-none text-sm"
          >
            <option value="all">Barcha holatlar</option>
            <option value="info">Info</option>
            <option value="warning">Ogohlantirish</option>
            <option value="critical">Muhim</option>
          </select>
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
        title={detailModal.request?.student_name || 'Ariza Tafsilotlari'}
        onClose={() => setDetailModal({ isOpen: false })}
      >
        {detailModal.request && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Talaba:</h3>
              <p className="text-white font-medium">{detailModal.request.student_name}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Matn:</h3>
              <p className="text-white text-sm">{detailModal.request.text}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-1">Holat:</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[detailModal.request.level]}`}>
                  {STATUS_LABELS[detailModal.request.level]}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-1">Sana:</h3>
                <p className="text-white text-sm">{detailModal.request.created_at ? new Date(detailModal.request.created_at).toLocaleDateString('uz-UZ') : '-'}</p>
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
            <label className="block text-sm font-semibold text-white mb-2">Yangi holat:</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ApplicationRequest['level'])}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              <option value="info">Info</option>
              <option value="warning">Ogohlantirish</option>
              <option value="critical">Muhim</option>
            </select>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              Hozirgi holat: <span className="font-bold">{STATUS_LABELS[statusModal.request?.level || 'info']}</span>
            </p>
          </div>
        </div>
      </AdminModal>
    </div>
  )
}
