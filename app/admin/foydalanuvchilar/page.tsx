'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Trash2, Edit2, Filter, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTable from '@/components/admin/AdminTable'
import AdminModal from '@/components/admin/AdminModal'

type UserRow = {
  id: string
  full_name: string
  email: string
  role: 'talaba' | 'tarbiyachi' | 'admin'
  created_at: string
  updated_at?: string
  source: 'users' | 'staff'
}

const ROLE_OPTIONS: UserRow['role'][] = ['talaba', 'tarbiyachi', 'admin']

const ROLE_LABELS: Record<string, string> = {
  talaba: 'Talaba',
  tarbiyachi: 'Tarbiyachi',
  admin: 'Admin',
}

const ROLE_COLORS: Record<string, string> = {
  talaba: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  tarbiyachi: 'bg-green-500/20 text-green-400 border-green-500/30',
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<'all' | UserRow['role']>('all')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; userId?: string }>({ isOpen: false })
  const [editModal, setEditModal] = useState<{ isOpen: boolean; user?: UserRow }>({ isOpen: false })
  const [editingRole, setEditingRole] = useState<UserRow['role']>('talaba')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const getAllowedRoles = (user: UserRow): UserRow['role'][] => {
    return user.source === 'staff' ? ['tarbiyachi', 'admin'] : ['talaba']
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = (await response.json()) as {
        ok: boolean
        users?: UserRow[]
        error?: string
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Foydalanuvchilarni yuklashda xato!")
      }

      setUsers(result.users ?? [])
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Foydalanuvchilarni yuklashda xato!"
      console.error('Foydalanuvchilarni yuklashda xato:', message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // Filter and search
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesRole = filterRole === 'all' || user.role === filterRole
      return matchesSearch && matchesRole
    })
  }, [users, searchTerm, filterRole])

  // Pagination
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, currentPage])

  const handleDeleteClick = (userId: string) => {
    setDeleteModal({ isOpen: true, userId })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteModal.userId) return

    try {
      setIsDeleting(true)
      const user = users.find((item) => item.id === deleteModal.userId)
      if (!user) {
        throw new Error('Foydalanuvchi topilmadi')
      }

      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          source: user.source,
        }),
      })

      const result = (await response.json()) as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "O'chirishda xato!")
      }

      setUsers(users.filter(u => u.id !== deleteModal.userId))
      setDeleteModal({ isOpen: false })
      toast.success("Foydalanuvchi o'chirildi!")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "O'chirishda xato!"
      console.error("O'chirishda xato:", message)
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEditClick = (user: UserRow) => {
    setEditModal({ isOpen: true, user })
    setEditingRole(user.role)
  }

  const handleEditConfirm = async () => {
    if (!editModal.user) return

    try {
      setIsUpdating(true)
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editModal.user.id,
          role: editingRole,
          source: editModal.user.source,
        }),
      })

      const result = (await response.json()) as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Yangilashda xato!")
      }

      setUsers(users.map(u => u.id === editModal.user?.id ? { ...u, role: editingRole } : u))
      setEditModal({ isOpen: false })
      toast.success("Foydalanuvchi yangilandi!")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Yangilashda xato!"
      console.error('Yangilashda xato:', message)
      toast.error(message)
    } finally {
      setIsUpdating(false)
    }
  }

  const columns = [
    {
      key: 'full_name',
      label: 'Ism',
      sortable: true,
      render: (value: string, row: UserRow) => (
        <div>
          <p className="font-semibold text-white">{value}</p>
          <p className="text-xs text-slate-400">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Rol',
      sortable: true,
      render: (value: UserRow['role']) => (
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[value]}`}>
          {ROLE_LABELS[value]}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Yaratilgan',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString('uz-UZ'),
    },
    {
      key: 'actions',
      label: 'Amallar',
      render: (_value: unknown, row: UserRow) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEditClick(row)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-amber-400 hover:text-amber-300"
            title="Tahrir qilish"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => handleDeleteClick(row.id)}
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
            <Users size={32} />
            Foydalanuvchilar
          </h1>
          <p className="text-slate-400 mt-2">Jami: {filteredUsers.length} ta foydalanuvchi</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2 lg:col-span-2">
          <Search className="absolute left-3 top-3 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Ism yoki email bo'yicha izlash..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Filter by Role */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-2">
          <Filter size={20} className="text-slate-400" />
          <select
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value as 'all' | UserRow['role'])
              setCurrentPage(1)
            }}
            className="flex-1 bg-transparent text-white focus:outline-none text-sm"
          >
            <option value="all">Barcha rollar</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center"
        >
          <p className="text-xs text-blue-400 mb-1">Talabalar</p>
          <p className="text-xl font-bold text-blue-300">{users.filter(u => u.role === 'talaba').length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center"
        >
          <p className="text-xs text-green-400 mb-1">Tarbiyachilar</p>
          <p className="text-xl font-bold text-green-300">{users.filter(u => u.role === 'tarbiyachi').length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center"
        >
          <p className="text-xs text-red-400 mb-1">Adminlar</p>
          <p className="text-xl font-bold text-red-300">{users.filter(u => u.role === 'admin').length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center col-span-2 sm:col-span-1"
        >
          <p className="text-xs text-purple-400 mb-1">Jami</p>
          <p className="text-xl font-bold text-purple-300">{users.length}</p>
        </motion.div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <AdminTable
          columns={columns}
          data={paginatedUsers}
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
            total: filteredUsers.length,
            pageSize,
            onPageChange: setCurrentPage,
          }}
        />
      </motion.div>

      {/* Delete Modal */}
      <AdminModal
        isOpen={deleteModal.isOpen}
        title="Foydalanuvchini o'chirish"
        description="Bu amalni qaytarlib bo'lmaydi. Raqiblikdan davom etmoqchisiz?"
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={handleDeleteConfirm}
        confirmText="O'chirish"
        confirmVariant="danger"
        isLoading={isDeleting}
      />

      {/* Edit Modal */}
      <AdminModal
        isOpen={editModal.isOpen}
        title="Rolni o'zgartirish"
        description={`${editModal.user?.full_name} uchun yangi rolni tanlang`}
        onClose={() => setEditModal({ isOpen: false })}
        onConfirm={handleEditConfirm}
        confirmText="Saqlash"
        isLoading={isUpdating}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Yangi rol:</label>
            <select
              value={editingRole}
              onChange={(e) => setEditingRole(e.target.value as UserRow['role'])}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              {editModal.user ? getAllowedRoles(editModal.user).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              )) : ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              Hozirgi rol: <span className="font-bold">{ROLE_LABELS[editModal.user?.role || 'talaba']}</span>
            </p>
            <p className="text-xs text-blue-200/80 mt-1">
              {editModal.user?.source === 'staff'
                ? 'Staff yozuvi uchun faqat admin yoki tarbiyachi roli tanlanadi.'
                : 'Talaba yozuvi faqat talaba roli bilan qoladi.'}
            </p>
          </div>
        </div>
      </AdminModal>
    </div>
  )
}

