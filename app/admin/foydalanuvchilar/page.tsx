'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  Edit2,
  Filter,
  GraduationCap,
  Home,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTable, { type TableColumn } from '@/components/admin/AdminTable'
import AdminModal from '@/components/admin/AdminModal'

type UserRow = {
  id: string
  full_name: string
  email: string
  role: 'talaba' | 'tarbiyachi' | 'admin'
  created_at: string
  updated_at?: string
  source: 'users' | 'staff'
  avatar_url?: string | null
  phone?: string | null
  faculty?: string | null
  direction?: string | null
  course?: number | null
  group?: string | number | null
  room_number?: string | null
  status?: string | null
  middle_name?: string | null
  region?: string | null
  district?: string | null
  mahalla?: string | null
  passport_series?: string | null
  jshshir?: string | null
  passport_date?: string | null
  birth_date?: string | null
  nationality?: string | null
  study_type?: string | null
  gender?: string | null
  father_full_name?: string | null
  father_workplace?: string | null
  father_phone?: string | null
  mother_full_name?: string | null
  mother_workplace?: string | null
  mother_phone?: string | null
  entry_date?: string | null
  assigned_floor?: number | null
  assigned_gender?: string | null
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
  const [detailModal, setDetailModal] = useState<{ isOpen: boolean; user?: UserRow }>({ isOpen: false })
  const [editingRole, setEditingRole] = useState<UserRow['role']>('talaba')
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    faculty: '',
    direction: '',
    course: '',
    group: '',
    room_number: '',
    status: '',
    middle_name: '',
    region: '',
    district: '',
    mahalla: '',
    passport_series: '',
    jshshir: '',
    passport_date: '',
    birth_date: '',
    nationality: '',
    study_type: '',
    gender: '',
    father_full_name: '',
    father_workplace: '',
    father_phone: '',
    mother_full_name: '',
    mother_workplace: '',
    mother_phone: '',
    entry_date: '',
    assigned_floor: '',
    assigned_gender: '',
  })
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const getAllowedRoles = (user: UserRow): UserRow['role'][] => {
    return user.source === 'staff' ? ['tarbiyachi', 'admin'] : ['talaba']
  }

  const getInitials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase()

  const formatDate = (value?: string | null) => {
    if (!value) return '-'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    return date.toLocaleDateString('uz-UZ')
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

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesRole = filterRole === 'all' || user.role === filterRole
      return matchesSearch && matchesRole
    })
  }, [users, searchTerm, filterRole])

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, currentPage])

  const studentInfoItems = (user: UserRow) =>
    [
      { icon: Mail, label: 'Email', value: user.email },
      { icon: Phone, label: 'Telefon', value: user.phone },
      { icon: GraduationCap, label: 'Fakultet', value: user.faculty },
      { icon: GraduationCap, label: "Yo'nalish", value: user.direction },
      { icon: ShieldCheck, label: 'Kurs', value: user.course ? `${user.course}-kurs` : undefined },
      { icon: UserRound, label: 'Guruh', value: user.group ? String(user.group) : undefined },
      { icon: Home, label: 'Xona', value: user.room_number },
      { icon: Home, label: 'Biriktirilgan qavat', value: user.assigned_floor ? `${user.assigned_floor}-qavat` : undefined },
      { icon: ShieldCheck, label: 'Holat', value: user.status },
      { icon: UserRound, label: 'Biriktirilgan jins', value: user.assigned_gender },
      { icon: CalendarDays, label: "Tug'ilgan sana", value: formatDate(user.birth_date) !== '-' ? formatDate(user.birth_date) : undefined },
      { icon: CalendarDays, label: 'Passport sanasi', value: formatDate(user.passport_date) !== '-' ? formatDate(user.passport_date) : undefined },
      { icon: CalendarDays, label: 'Yotoqxonaga kirgan sana', value: formatDate(user.entry_date) !== '-' ? formatDate(user.entry_date) : undefined },
      { icon: MapPin, label: 'Hudud', value: [user.region, user.district, user.mahalla].filter(Boolean).join(', ') || undefined },
      { icon: UserRound, label: 'Millati', value: user.nationality },
      { icon: UserRound, label: 'Jinsi', value: user.gender },
      { icon: ShieldCheck, label: "Ta'lim turi", value: user.study_type },
      { icon: ShieldCheck, label: 'Passport seriya', value: user.passport_series },
      { icon: ShieldCheck, label: 'JSHSHIR', value: user.jshshir },
    ].filter((item) => item.value)

  const familyInfoItems = (user: UserRow) =>
    [
      { label: 'Ota F.I.Sh.', value: user.father_full_name },
      { label: 'Ota ish joyi', value: user.father_workplace },
      { label: 'Ota telefoni', value: user.father_phone },
      { label: 'Ona F.I.Sh.', value: user.mother_full_name },
      { label: 'Ona ish joyi', value: user.mother_workplace },
      { label: 'Ona telefoni', value: user.mother_phone },
    ].filter((item) => item.value)

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

      setUsers(users.filter((userItem) => userItem.id !== deleteModal.userId))
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
    setEditForm({
      full_name: user.full_name ?? '',
      phone: user.phone ?? '',
      faculty: user.faculty ?? '',
      direction: user.direction ?? '',
      course: user.course ? String(user.course) : '',
      group: user.group ? String(user.group) : '',
      room_number: user.room_number ?? '',
      status: user.status ?? '',
      middle_name: user.middle_name ?? '',
      region: user.region ?? '',
      district: user.district ?? '',
      mahalla: user.mahalla ?? '',
      passport_series: user.passport_series ?? '',
      jshshir: user.jshshir ?? '',
      passport_date: user.passport_date ? String(user.passport_date).slice(0, 10) : '',
      birth_date: user.birth_date ? String(user.birth_date).slice(0, 10) : '',
      nationality: user.nationality ?? '',
      study_type: user.study_type ?? '',
      gender: user.gender ?? '',
      father_full_name: user.father_full_name ?? '',
      father_workplace: user.father_workplace ?? '',
      father_phone: user.father_phone ?? '',
      mother_full_name: user.mother_full_name ?? '',
      mother_workplace: user.mother_workplace ?? '',
      mother_phone: user.mother_phone ?? '',
      entry_date: user.entry_date ? String(user.entry_date).slice(0, 10) : '',
      assigned_floor: user.assigned_floor ? String(user.assigned_floor) : '',
      assigned_gender: user.assigned_gender ?? '',
    })
  }

  const handleDetailOpen = (user: UserRow) => {
    setDetailModal({ isOpen: true, user })
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
          ...(editModal.user.source === 'users' ? editForm : {}),
        }),
      })

      const result = (await response.json()) as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'Yangilashda xato!')
      }

      setUsers(users.map((user) => (
        user.id === editModal.user?.id
          ? {
              ...user,
              role: editingRole,
              ...(editModal.user?.source === 'users'
                ? {
                    ...editForm,
                    course: editForm.course ? Number(editForm.course) : null,
                    group: editForm.group || null,
                  }
                : {
                    full_name: editForm.full_name || user.full_name,
                    phone: editForm.phone || null,
                    status: editForm.status || null,
                    assigned_floor: editForm.assigned_floor ? Number(editForm.assigned_floor) : null,
                    assigned_gender: editForm.assigned_gender || null,
                  }),
            }
          : user
      )))
      if (detailModal.user?.id === editModal.user.id) {
        setDetailModal({
          isOpen: true,
          user: {
            ...detailModal.user,
            role: editingRole,
            ...(editModal.user.source === 'users'
              ? {
                  ...editForm,
                  course: editForm.course ? Number(editForm.course) : null,
                  group: editForm.group || null,
                }
              : {
                  full_name: editForm.full_name || detailModal.user.full_name,
                  phone: editForm.phone || null,
                  status: editForm.status || null,
                  assigned_floor: editForm.assigned_floor ? Number(editForm.assigned_floor) : null,
                  assigned_gender: editForm.assigned_gender || null,
                }),
          },
        })
      }
      setEditModal({ isOpen: false })
      toast.success('Foydalanuvchi yangilandi!')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Yangilashda xato!'
      console.error('Yangilashda xato:', message)
      toast.error(message)
    } finally {
      setIsUpdating(false)
    }
  }

  const columns: TableColumn<UserRow>[] = [
    {
      key: 'full_name',
      label: 'Ism',
      sortable: true,
      render: (value: unknown, row: UserRow) => (
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/10 bg-white/5">
            {row.avatar_url ? (
              <Image
                src={row.avatar_url}
                alt={row.full_name}
                fill
                sizes="44px"
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500/30 to-cyan-500/20 text-sm font-bold text-blue-100">
                {getInitials(row.full_name)}
              </div>
            )}
          </div>
          <div>
            <p className="font-semibold text-white">{String(value ?? '')}</p>
            <p className="text-xs text-slate-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Rol',
      sortable: true,
      render: (value: unknown) => (
        <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${ROLE_COLORS[String(value)]}`}>
          {ROLE_LABELS[String(value)]}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Yaratilgan',
      sortable: true,
      render: (value: unknown) => (value ? new Date(String(value)).toLocaleDateString('uz-UZ') : '-'),
    },
    {
      key: 'actions',
      label: 'Amallar',
      render: (_value: unknown, row: UserRow) => (
        <div className="flex gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation()
              handleEditClick(row)
            }}
            className="rounded-lg p-2 text-amber-400 transition-colors hover:bg-white/10 hover:text-amber-300"
            title="Tahrir qilish"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation()
              handleDeleteClick(row.id)
            }}
            className="rounded-lg p-2 text-red-400 transition-colors hover:bg-white/10 hover:text-red-300"
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
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-black tracking-tighter text-white sm:text-4xl">
            <Users size={32} />
            Foydalanuvchilar
          </h1>
          <p className="mt-2 text-slate-400">Jami: {filteredUsers.length} ta foydalanuvchi</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative col-span-1 sm:col-span-2 lg:col-span-2">
          <Search className="absolute left-3 top-3 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Ism yoki email bo'yicha izlash..."
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setCurrentPage(1)
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-white transition-colors placeholder-slate-400 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2">
          <Filter size={20} className="text-slate-400" />
          <select
            value={filterRole}
            onChange={(event) => {
              setFilterRole(event.target.value as 'all' | UserRow['role'])
              setCurrentPage(1)
            }}
            className="flex-1 bg-transparent text-sm text-white focus:outline-none"
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

      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-center"
        >
          <p className="mb-1 text-xs text-blue-400">Talabalar</p>
          <p className="text-xl font-bold text-blue-300">{users.filter((user) => user.role === 'talaba').length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center"
        >
          <p className="mb-1 text-xs text-green-400">Tarbiyachilar</p>
          <p className="text-xl font-bold text-green-300">{users.filter((user) => user.role === 'tarbiyachi').length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center"
        >
          <p className="mb-1 text-xs text-red-400">Adminlar</p>
          <p className="text-xl font-bold text-red-300">{users.filter((user) => user.role === 'admin').length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="col-span-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-center sm:col-span-1"
        >
          <p className="mb-1 text-xs text-purple-400">Jami</p>
          <p className="text-xl font-bold text-purple-300">{users.length}</p>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <AdminTable<UserRow>
          columns={columns}
          data={paginatedUsers}
          isLoading={loading}
          onRowClick={handleDetailOpen}
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

      <AdminModal
        isOpen={detailModal.isOpen}
        title={detailModal.user?.full_name || "Foydalanuvchi ma'lumotlari"}
        description={detailModal.user?.source === 'users' ? "Talaba haqida to'liq ma'lumot" : "Foydalanuvchi haqida mavjud ma'lumotlar"}
        maxWidthClass="max-w-4xl"
        onClose={() => setDetailModal({ isOpen: false })}
      >
        {detailModal.user && (
          <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {detailModal.user.avatar_url ? (
                  <Image
                    src={detailModal.user.avatar_url}
                    alt={detailModal.user.full_name}
                    fill
                    sizes="80px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500/30 to-cyan-500/20 text-2xl font-black text-blue-100">
                    {getInitials(detailModal.user.full_name)}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold text-white">{detailModal.user.full_name}</p>
                <p className="mt-1 text-sm text-slate-400">{detailModal.user.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${ROLE_COLORS[detailModal.user.role]}`}>
                    {ROLE_LABELS[detailModal.user.role]}
                  </span>
                  {detailModal.user.status && (
                    <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      {detailModal.user.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-bold uppercase tracking-wide text-slate-300">Asosiy ma&apos;lumotlar</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {studentInfoItems(detailModal.user).map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.label} className="rounded-xl border border-white/10 bg-black/10 p-3">
                        <div className="mb-2 flex items-center gap-2 text-slate-400">
                          <Icon size={15} />
                          <span className="text-xs uppercase tracking-wide">{item.label}</span>
                        </div>
                        <p className="break-words text-sm font-medium text-white">{item.value}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-bold uppercase tracking-wide text-slate-300">Qo&apos;shimcha ma&apos;lumotlar</p>
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Yaratilgan sana</p>
                    <p className="mt-2 text-sm font-medium text-white">{formatDate(detailModal.user.created_at)}</p>
                  </div>
                  {detailModal.user.middle_name && (
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Sharifi</p>
                      <p className="mt-2 text-sm font-medium text-white">{detailModal.user.middle_name}</p>
                    </div>
                  )}
                  {familyInfoItems(detailModal.user).length > 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Oila ma&apos;lumotlari</p>
                      <div className="mt-3 space-y-2">
                        {familyInfoItems(detailModal.user).map((item) => (
                          <div key={item.label} className="flex items-start justify-between gap-3 border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
                            <span className="text-sm text-slate-400">{item.label}</span>
                            <span className="text-right text-sm font-medium text-white">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-3 text-sm text-slate-400">
                      Qo&apos;shimcha oilaviy ma&apos;lumot topilmadi.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminModal>

      <AdminModal
        isOpen={editModal.isOpen}
        title={editModal.user?.source === 'users' ? "Talaba ma'lumotlarini tahrirlash" : "Xodim ma'lumotlarini tahrirlash"}
        description={`${editModal.user?.full_name} uchun ma'lumotlarni yangilang`}
        onClose={() => setEditModal({ isOpen: false })}
        onConfirm={handleEditConfirm}
        confirmText="Saqlash"
        isLoading={isUpdating}
        maxWidthClass={editModal.user?.source === 'users' ? 'max-w-5xl' : 'max-w-3xl'}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">Yangi rol:</label>
            <select
              value={editingRole}
              onChange={(event) => setEditingRole(event.target.value as UserRow['role'])}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
            >
              {editModal.user
                ? getAllowedRoles(editModal.user).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))
                : ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
            </select>
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
            <p className="text-sm text-blue-300">
              Hozirgi rol: <span className="font-bold">{ROLE_LABELS[editModal.user?.role || 'talaba']}</span>
            </p>
            <p className="mt-1 text-xs text-blue-200/80">
              {editModal.user?.source === 'staff'
                ? 'Staff yozuvi uchun faqat admin yoki tarbiyachi roli tanlanadi.'
                : 'Talaba yozuvi faqat talaba roli bilan qoladi.'}
            </p>
          </div>
          {editModal.user?.source === 'users' && (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { key: 'full_name', label: "To'liq ism", type: 'text' },
                { key: 'middle_name', label: 'Sharifi', type: 'text' },
                { key: 'phone', label: 'Telefon', type: 'text' },
                { key: 'faculty', label: 'Fakultet', type: 'text' },
                { key: 'direction', label: "Yo'nalish", type: 'text' },
                { key: 'course', label: 'Kurs', type: 'number' },
                { key: 'group', label: 'Guruh', type: 'text' },
                { key: 'room_number', label: 'Xona', type: 'text' },
                { key: 'status', label: 'Holat', type: 'text' },
                { key: 'region', label: 'Viloyat', type: 'text' },
                { key: 'district', label: 'Tuman', type: 'text' },
                { key: 'mahalla', label: 'Mahalla', type: 'text' },
                { key: 'passport_series', label: 'Passport seriya', type: 'text' },
                { key: 'jshshir', label: 'JSHSHIR', type: 'text' },
                { key: 'birth_date', label: "Tug'ilgan sana", type: 'date' },
                { key: 'passport_date', label: 'Passport sanasi', type: 'date' },
                { key: 'entry_date', label: 'Yotoqxonaga kirgan sana', type: 'date' },
                { key: 'nationality', label: 'Millati', type: 'text' },
                { key: 'study_type', label: "Ta'lim turi", type: 'text' },
                { key: 'gender', label: 'Jinsi', type: 'text' },
                { key: 'father_full_name', label: 'Ota F.I.Sh.', type: 'text' },
                { key: 'father_workplace', label: 'Ota ish joyi', type: 'text' },
                { key: 'father_phone', label: 'Ota telefoni', type: 'text' },
                { key: 'mother_full_name', label: 'Ona F.I.Sh.', type: 'text' },
                { key: 'mother_workplace', label: 'Ona ish joyi', type: 'text' },
                { key: 'mother_phone', label: 'Ona telefoni', type: 'text' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="mb-2 block text-sm font-semibold text-white">{field.label}</label>
                  <input
                    type={field.type}
                    value={editForm[field.key as keyof typeof editForm]}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
          {editModal.user?.source === 'staff' && (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { key: 'full_name', label: "To'liq ism", type: 'text' },
                { key: 'phone', label: 'Telefon', type: 'text' },
                { key: 'status', label: 'Holat', type: 'text' },
                { key: 'assigned_floor', label: 'Biriktirilgan qavat', type: 'number' },
                { key: 'assigned_gender', label: 'Biriktirilgan jins', type: 'text' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="mb-2 block text-sm font-semibold text-white">{field.label}</label>
                  <input
                    type={field.type}
                    value={editForm[field.key as keyof typeof editForm]}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              ))}
              <div className="md:col-span-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                `assigned_gender` uchun `male` yoki `female` kiriting. `assigned_floor` bo&apos;sh bo&apos;lsa barcha qavatlar ko&apos;rinadi.
              </div>
            </div>
          )}
        </div>
      </AdminModal>
    </div>
  )
}
