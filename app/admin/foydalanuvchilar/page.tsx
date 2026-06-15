'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
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
  X,
  Check,
  RotateCcw,
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
  phone_number?: string | null
  faculty?: string | null
  direction?: string | null
  course?: number | null
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
  is_floor_captain?: boolean | null
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


const ASOSIY_FIELDS = [
  { key: 'full_name', label: "To'liq ism", type: 'text' },
  { key: 'middle_name', label: 'Sharifi', type: 'text' },
  { key: 'phone', label: 'Telefon', type: 'text' },
  { key: 'faculty', label: 'Fakultet', type: 'text' },
  { key: 'direction', label: "Yo'nalish", type: 'text' },
  { key: 'course', label: 'Kurs', type: 'number' },
  { key: 'room_number', label: 'Xona', type: 'text' },
  { key: 'status', label: 'Holat', type: 'text' },
  { key: 'gender', label: 'Jinsi', type: 'text' },
  { key: 'birth_date', label: "Tug'ilgan sana", type: 'date' },
  { key: 'nationality', label: 'Millati', type: 'text' },
  { key: 'study_type', label: "Ta'lim turi", type: 'text' },
  { key: 'entry_date', label: 'Yotoqxonaga kirgan sana', type: 'date' },
] as const

const HUJJAT_FIELDS = [
  { key: 'passport_series', label: 'Passport seriya', type: 'text' },
  { key: 'jshshir', label: 'JSHSHIR', type: 'text' },
  { key: 'passport_date', label: 'Passport sanasi', type: 'date' },
  { key: 'region', label: 'Viloyat', type: 'text' },
  { key: 'district', label: 'Tuman', type: 'text' },
  { key: 'mahalla', label: 'Mahalla', type: 'text' },
] as const

const OILA_FIELDS = [
  { key: 'father_full_name', label: 'Ota F.I.Sh.', type: 'text' },
  { key: 'father_workplace', label: 'Ota ish joyi', type: 'text' },
  { key: 'father_phone', label: 'Ota telefoni', type: 'text' },
  { key: 'mother_full_name', label: 'Ona F.I.Sh.', type: 'text' },
  { key: 'mother_workplace', label: 'Ona ish joyi', type: 'text' },
  { key: 'mother_phone', label: 'Ona telefoni', type: 'text' },
] as const

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [filterRole, setFilterRole] = useState<'all' | UserRow['role']>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; userId?: string }>({ isOpen: false })
  const [editModal, setEditModal] = useState<{ isOpen: boolean; user?: UserRow }>({ isOpen: false })
  const [detailModal, setDetailModal] = useState<{ isOpen: boolean; user?: UserRow }>({ isOpen: false })
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<UserRow['role']>('talaba')
  const [activeEditTab, setActiveEditTab] = useState<'asosiy' | 'hujjatlar' | 'oila'>('asosiy')
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [generatedInviteCode, setGeneratedInviteCode] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    faculty: '',
    direction: '',
    course: '',
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
    is_floor_captain: false as boolean,
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

      const usersList = result.users ?? []
      setUsers(usersList)
      return usersList
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Foydalanuvchilarni yuklashda xato!"
      console.error('Foydalanuvchilarni yuklashda xato:', message)
      toast.error(message)
      return []
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedEmail = inviteEmail.trim().toLowerCase()

    if (!normalizedEmail) {
      toast.error('Email manzilini kiriting')
      return
    }

    setCreatingInvite(true)
    try {
      const response = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Taklif kodi yaratilmadi')
      }

      setGeneratedInviteCode(result.inviteCode)
      setInviteEmail('')
      toast.success('Taklif kodi muvaffaqiyatli yaratildi!')
      void loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Xatolik yuz berdi')
    } finally {
      setCreatingInvite(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      const loaded = await loadUsers()
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const userId = params.get('id')
        if (userId && loaded.length > 0) {
          const user = loaded.find((u) => u.id === userId)
          if (user) {
            setDetailModal({ isOpen: true, user })
          }
        }
      }
    }
    void init()
  }, [])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesRole = filterRole === 'all' || user.role === filterRole
      const matchesRoom = !filterRoom || (user.room_number?.toLowerCase().includes(filterRoom.toLowerCase()))
      const userStatus = user.status || 'active'
      const matchesStatus = filterStatus === 'all' || userStatus === filterStatus
      return matchesSearch && matchesRole && matchesRoom && matchesStatus
    })
  }, [users, searchTerm, filterRole, filterRoom, filterStatus])

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, currentPage])

  const roommates = useMemo(() => {
    const activeUser = detailModal.user
    if (!activeUser?.room_number) return []
    return users.filter((u) => u.room_number === activeUser.room_number && u.id !== activeUser.id)
  }, [users, detailModal.user])

  const studentInfoItems = (user: UserRow) =>
    [
      { icon: Mail, label: 'Email', value: user.email },
      { icon: Phone, label: 'Telefon', value: user.phone_number },
      { icon: GraduationCap, label: 'Fakultet', value: user.faculty },
      { icon: GraduationCap, label: "Yo'nalish", value: user.direction },
      { icon: ShieldCheck, label: 'Kurs', value: user.course ? `${user.course}-kurs` : undefined },
      { icon: Home, label: 'Xona', value: user.room_number },
      { icon: Home, label: 'Biriktirilgan qavat', value: user.assigned_floor ? `${user.assigned_floor}-qavat` : undefined },
      { icon: ShieldCheck, label: 'Sardorlik holati', value: user.is_floor_captain ? 'Qavat sardori' : undefined },
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

  const handleApprove = async (id: string) => {
    try {
      setIsUpdating(true)
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          source: 'users',
          status: 'active',
        }),
      })

      const result = (await response.json()) as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Tasdiqlashda xato!")
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: 'active' } : u))
      )
      toast.success("Talaba muvaffaqiyatli tasdiqlandi!")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Tasdiqlashda xato!"
      toast.error(message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReject = async (id: string) => {
    if (!window.confirm("Ushbu talabaning ro'yxatdan o'tish arizasini rad etib, tizimdan butunlay o'chirib tashlaysizmi?")) {
      return
    }

    try {
      setIsDeleting(true)
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          source: 'users',
        }),
      })

      const result = (await response.json()) as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Rad etishda xato!")
      }

      setUsers((prev) => prev.filter((u) => u.id !== id))
      toast.success("Talaba arizasi rad etildi va o'chirildi!")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Rad etishda xato!"
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEditClick = (user: UserRow) => {
    setEditModal({ isOpen: true, user })
    setEditingRole(user.role)
    setActiveEditTab('asosiy')
    setEditForm({
      full_name: user.full_name ?? '',
      phone: user.phone_number ?? '',
      faculty: user.faculty ?? '',
      direction: user.direction ?? '',
      course: user.course ? String(user.course) : '',
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
      assigned_gender: user.assigned_gender || '',
      is_floor_captain: user.is_floor_captain || false,
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
          ...(editModal.user.source === 'users' ? {
            ...editForm,
            phone_number: editForm.phone,
            course: editForm.course ? Number(editForm.course) : null,
            assigned_floor: editForm.assigned_floor ? Number(editForm.assigned_floor) : null,
            is_floor_captain: editForm.is_floor_captain || false,
          } : {
            full_name: editForm.full_name,
            phone_number: editForm.phone,
            status: editForm.status,
            assigned_floor: editForm.assigned_floor ? Number(editForm.assigned_floor) : null,
            assigned_gender: editForm.assigned_gender || null
          }), // Only include fields present in staff table
        }),
      })

      const result = (await response.json()) as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'Yangilashda xato!')
      }

      const updatedUser = {
        ...editModal.user,
        role: editingRole,
        ...(editModal.user.source === 'users'
          ? {
            ...editForm,
            phone_number: editForm.phone,
            course: editForm.course ? Number(editForm.course) : null,
            assigned_floor: editForm.assigned_floor ? Number(editForm.assigned_floor) : null,
            is_floor_captain: editForm.is_floor_captain || false,
          }
          : {
            full_name: editForm.full_name || editModal.user.full_name,
            phone_number: editForm.phone || editModal.user.phone_number,
            status: editForm.status || editModal.user.status,
            assigned_floor: editForm.assigned_floor ? Number(editForm.assigned_floor) : null,
            assigned_gender: editForm.assigned_gender || null,
          }),
      } as UserRow

      setUsers(users.map((u) => (u.id === updatedUser.id ? updatedUser : u)))

      if (detailModal.user?.id === updatedUser.id) {
        setDetailModal({
          isOpen: true,
          user: updatedUser,
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
          <div className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)] bg-[#0b1120]">
            {row.avatar_url ? (
              <Image
                src={row.avatar_url}
                alt={row.full_name}
                fill
                sizes="44px"
                unoptimized
                className="object-cover transition-transform duration-300 hover:scale-110"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-purple-500/20 to-pink-500/10 text-sm font-black text-purple-300">
                {getInitials(row.full_name)}
              </div>
            )}
          </div>
          <div>
            <p className="font-bold text-white transition-colors hover:text-purple-400 cursor-pointer" onClick={() => handleDetailOpen(row)}>
              {String(value ?? '')}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Rol',
      sortable: true,
      render: (value: unknown, row: UserRow) => {
        const roleStr = String(value)
        const isCaptain = row.source === 'users' && row.is_floor_captain
        return (
          <div className="flex flex-col gap-1.5">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${ROLE_COLORS[roleStr]}`}>
              {roleStr === 'tarbiyachi' && (
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              )}
              {roleStr === 'admin' && (
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                </span>
              )}
              {roleStr === 'talaba' && (
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                </span>
              )}
              {ROLE_LABELS[roleStr]}
            </span>
            {isCaptain && (
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-400 w-fit">
                ⭐ {row.assigned_floor}-qavat sardori
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
      render: (value: unknown, row: UserRow) => {
        const statusStr = String(value ?? 'active')
        let color = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        let label = 'Faol'
        if (statusStr === 'pending') {
          color = 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          label = 'Kutilmoqda'
        } else if (statusStr === 'rejected') {
          color = 'bg-rose-500/20 text-rose-400 border-rose-500/30'
          label = 'Rad etilgan'
        }
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}>
            {statusStr === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
            {label}
          </span>
        )
      }
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
          {row.role === 'talaba' && row.status === 'pending' && (
            <>
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  handleApprove(row.id)
                }}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-400 transition-all hover:bg-emerald-500/20 hover:border-emerald-500/30 active:scale-95"
                title="Tasdiqlash"
              >
                <Check size={15} />
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  handleReject(row.id)
                }}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-rose-400 transition-all hover:bg-rose-500/20 hover:border-rose-500/30 active:scale-95"
                title="Rad etish (O'chirish)"
              >
                <X size={15} />
              </button>
            </>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation()
              handleEditClick(row)
            }}
            className="rounded-xl border border-white/5 bg-white/5 p-2.5 text-amber-400 transition-all hover:bg-amber-400/10 hover:border-amber-400/20 active:scale-95"
            title="Tahrir qilish"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation()
              handleDeleteClick(row.id)
            }}
            className="rounded-xl border border-white/5 bg-white/5 p-2.5 text-red-400 transition-all hover:bg-red-400/10 hover:border-red-400/20 active:scale-95"
            title="O'chirish"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  const totalCount = users.length || 1;
  const talabaCount = users.filter((u) => u.role === 'talaba').length;
  const tarbiyachiCount = users.filter((u) => u.role === 'tarbiyachi').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const pendingCount = users.filter((u) => u.role === 'talaba' && u.status === 'pending').length;
 
  const statCards = [
    {
      title: 'Talabalar',
      count: talabaCount,
      percentage: Math.round((talabaCount / totalCount) * 100),
      color: 'from-blue-500 to-indigo-600',
      glow: 'rgba(59,130,246,0.15)',
      textColor: 'text-blue-400',
      barColor: 'bg-blue-500',
      icon: GraduationCap,
      description: pendingCount > 0 ? `${pendingCount} ta tasdiqlash kutilmoqda` : undefined,
    },
    {
      title: 'Tarbiyachilar',
      count: tarbiyachiCount,
      percentage: Math.round((tarbiyachiCount / totalCount) * 100),
      color: 'from-emerald-500 to-teal-600',
      glow: 'rgba(16,185,129,0.15)',
      textColor: 'text-emerald-400',
      barColor: 'bg-emerald-500',
      icon: ShieldCheck,
    },
    {
      title: 'Adminlar',
      count: adminCount,
      percentage: Math.round((adminCount / totalCount) * 100),
      color: 'from-rose-500 to-red-600',
      glow: 'rgba(244,63,94,0.15)',
      textColor: 'text-rose-400',
      barColor: 'bg-rose-500',
      icon: Users,
    },
    {
      title: 'Jami Foydalanuvchilar',
      count: users.length,
      percentage: 100,
      color: 'from-purple-500 to-fuchsia-600',
      glow: 'rgba(168,85,247,0.15)',
      textColor: 'text-purple-400',
      barColor: 'bg-purple-500',
      icon: Users,
    },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tighter text-white sm:text-4xl">
            <div className="rounded-2xl bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
              <Users size={30} />
            </div>
            Foydalanuvchilar boshqaruvi
          </h1>
          <p className="mt-2 text-slate-400">Tizimdagi barcha foydalanuvchilar va xodimlar ro&apos;yxati</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setInviteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-purple-500/20 active:scale-[0.98] transition-all"
          >
            <Users size={16} />
            Taklif Yaratish
          </button>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="inline-flex items-center justify-center p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all disabled:opacity-50"
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
      </div>

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
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1120]/60 p-5 backdrop-blur-xl shadow-xl transition-all group"
              style={{
                boxShadow: `0 10px 30px -10px ${card.glow}`,
              }}
            >
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-linear-to-br from-white/10 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{card.title}</p>
                  <p className="mt-2 text-3xl font-black text-white leading-none">
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

              {'description' in card && card.description && !loading && (
                <div className="mt-2 text-[10px] text-amber-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  {card.description}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mb-6 rounded-2xl border border-white/5 bg-[#0b1120]/40 p-4 backdrop-blur-md">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Ism yoki email bo'yicha izlash..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white transition-all placeholder-slate-400 focus:border-purple-500/50 focus:bg-white/[0.07] outline-none"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-3.5 text-slate-400 pointer-events-none" size={18} />
            <select
              value={filterRole}
              onChange={(event) => {
                setFilterRole(event.target.value as 'all' | UserRow['role'])
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white transition-all outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
            >
              <option value="all" className="bg-slate-950">Barcha rollar</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role} className="bg-slate-950">
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Home className="absolute left-3 top-3.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Xona raqami..."
              value={filterRoom}
              onChange={(event) => {
                setFilterRoom(event.target.value)
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white transition-all placeholder-slate-400 focus:border-purple-500/50 outline-none"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-3.5 text-slate-400 pointer-events-none" size={18} />
            <select
              value={filterStatus}
              onChange={(event) => {
                setFilterStatus(event.target.value)
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white transition-all outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
            >
              <option value="all" className="bg-slate-950">Barcha holatlar</option>
              <option value="active" className="bg-slate-950">Faol</option>
              <option value="pending" className="bg-slate-950">Kutilmoqda</option>
            </select>
          </div>
        </div>
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
        description="Ushbu amalni qaytarib bo'lmaydi. Tizimdan butunlay o'chirishni tasdiqlaysizmi?"
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={handleDeleteConfirm}
        confirmText="O'chirish"
        confirmVariant="danger"
        isLoading={isDeleting}
      />

      <AdminModal
        isOpen={detailModal.isOpen}
        title=""
        maxWidthClass="max-w-lg"
        onClose={() => setDetailModal({ isOpen: false })}
      >
        {detailModal.user && (
          <div className="max-h-[80vh] overflow-y-auto no-scrollbar -m-6">
            <div className="relative h-60 w-full bg-linear-to-b from-purple-700 to-indigo-900 overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/20 to-transparent z-10" />
              {detailModal.user.avatar_url ? (
                <Image
                  src={detailModal.user.avatar_url}
                  alt={detailModal.user.full_name}
                  fill
                  unoptimized
                  className="object-cover cursor-pointer transition-transform duration-500 hover:scale-105"
                  onClick={() => setFullScreenImage(detailModal.user!.avatar_url!)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-purple-600 to-indigo-800 text-6xl font-black text-white/20">
                  {getInitials(detailModal.user.full_name)}
                </div>
              )}
              
              <div className="absolute bottom-0 left-0 w-full p-6 z-20">
                <span className={`inline-block mb-2 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${ROLE_COLORS[detailModal.user.role]}`}>
                  {ROLE_LABELS[detailModal.user.role]}
                </span>
                <h2 className="text-2xl font-black text-white tracking-tight">{detailModal.user.full_name}</h2>
                <p className="text-slate-300 text-xs mt-1">
                  {detailModal.user.status === 'active' ? (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Tizimda faol
                    </span>
                  ) : (
                    `Oxirgi faollik: ${formatDate(detailModal.user.updated_at || detailModal.user.created_at)}`
                  )}
                </p>
              </div>
            </div>

            <div className="p-3 space-y-3 bg-[#020617]/40">
              <div className="bg-[#0b1120]/80 rounded-2xl p-4 border border-white/5 shadow-xl space-y-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl p-2.5 bg-blue-500/10 text-blue-400">
                    <Phone size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{detailModal.user.phone_number || 'Kiritilmagan'}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Telefon raqami</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="rounded-xl p-2.5 bg-purple-500/10 text-purple-400">
                    <Mail size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{detailModal.user.email}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Elektron pochta</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="rounded-xl p-2.5 bg-emerald-500/10 text-emerald-400">
                    <UserRound size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">@{detailModal.user.email.split('@')[0]}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Foydalanuvchi nomi</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#0b1120]/80 rounded-2xl p-4 border border-white/5 shadow-xl">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-4">O&apos;qish va Yashash joyi</h3>
                <div className="grid grid-cols-1 gap-4">
                  {studentInfoItems(detailModal.user).filter(i => !['Email', 'Telefon'].includes(i.label)).map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div key={idx} className="flex items-center gap-4">
                        <div className="rounded-lg p-2 bg-slate-800/50 text-slate-400">
                          <Icon size={16} />
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{item.value}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{item.label}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {familyInfoItems(detailModal.user).length > 0 && (
                <div className="bg-[#0b1120]/80 rounded-2xl p-4 border border-white/5 shadow-xl">
                  <h3 className="text-xs font-black text-purple-400 uppercase tracking-[0.2em] mb-4">Oila ma&apos;lumotlari</h3>
                  <div className="space-y-4">
                    {familyInfoItems(detailModal.user).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)] shrink-0" />
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{item.value}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{item.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {roommates.length > 0 && (
                <div className="bg-[#0b1120]/80 rounded-2xl p-4 border border-white/5 shadow-xl">
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">Xonadoshlar</h3>
                  <div className="flex flex-wrap gap-4">
                    {roommates.map((roommate) => (
                      <div
                        key={roommate.id}
                        className="flex flex-col items-center gap-1.5 group cursor-pointer"
                        title={roommate.full_name}
                        onClick={() => setDetailModal({ isOpen: true, user: roommate })}
                      >
                        <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-all group-hover:scale-105 group-hover:border-emerald-500/50">
                          {roommate.avatar_url ? (
                            <Image
                              src={roommate.avatar_url}
                              alt={roommate.full_name}
                              fill
                              sizes="48px"
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-emerald-500/20 to-teal-500/20 text-[10px] font-black text-emerald-200">
                              {getInitials(roommate.full_name)}
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold max-w-[64px] truncate">{roommate.full_name.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#0b1120]/50 rounded-2xl p-4 border border-white/5 text-center">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Ro&apos;yxatdan o&apos;tgan sana: {formatDate(detailModal.user.created_at)}
                </p>
              </div>

              {detailModal.user.role === 'talaba' && detailModal.user.status === 'pending' && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={async () => {
                      await handleApprove(detailModal.user!.id)
                      setDetailModal({ isOpen: false })
                    }}
                    disabled={isUpdating}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg"
                  >
                    <Check size={18} />
                    <span>Tasdiqlash</span>
                  </button>
                  <button
                    onClick={async () => {
                      await handleReject(detailModal.user!.id)
                      setDetailModal({ isOpen: false })
                    }}
                    disabled={isDeleting}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 py-3 text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg"
                  >
                    <X size={18} />
                    <span>Rad etish</span>
                  </button>
                </div>
              )}
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
            <label className="mb-2 block text-xs font-bold text-slate-400 uppercase tracking-wider">Yangi rol:</label>
            <select
              value={editingRole}
              onChange={(event) => setEditingRole(event.target.value as UserRow['role'])}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition-all focus:border-purple-500/50 outline-none"
            >
              {editModal.user
                ? getAllowedRoles(editModal.user).map((role) => (
                  <option key={role} value={role} className="bg-slate-950">
                    {ROLE_LABELS[role]}
                  </option>
                ))
                : ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role} className="bg-slate-950">
                    {ROLE_LABELS[role]}
                  </option>
                ))}
            </select>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-sm text-blue-300 font-semibold">
              Hozirgi rol: <span className="font-bold">{ROLE_LABELS[editModal.user?.role || 'talaba']}</span>
            </p>
            <p className="mt-1 text-xs text-blue-200/60">
              {editModal.user?.source === 'staff'
                ? 'Staff yozuvi uchun faqat admin yoki tarbiyachi roli tanlanadi.'
                : 'Talaba yozuvi faqat talaba roli bilan qoladi.'}
            </p>
          </div>
          {editModal.user?.source === 'users' && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-purple-300">Qavat Sardori sifatida tayinlash</p>
                  <p className="text-xs text-purple-300/60 mt-0.5">Ushbu talabani qavat sardori qilib belgilash va qo&apos;shimcha huquqlar berish</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(editForm.is_floor_captain)}
                  onChange={(e) => setEditForm(prev => ({ ...prev, is_floor_captain: e.target.checked }))}
                  className="w-5 h-5 accent-purple-500 cursor-pointer rounded"
                />
              </div>
              {editForm.is_floor_captain && (
                <div className="space-y-1.5 pt-2 border-t border-purple-500/10">
                  <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider">Biriktirilgan qavat:</label>
                  <select
                    value={editForm.assigned_floor || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, assigned_floor: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-white outline-none focus:border-purple-500"
                  >
                    <option value="">Qavatni tanlang</option>
                    <option value="1">1-qavat</option>
                    <option value="2">2-qavat</option>
                    <option value="3">3-qavat</option>
                    <option value="4">4-qavat</option>
                    <option value="5">5-qavat</option>
                  </select>
                </div>
              )}
            </div>
          )}
          {editModal.user?.source === 'users' && (
            <>
              <div className="mb-6 flex gap-1 rounded-xl border border-white/5 bg-white/5 p-1">
                {([
                  { key: 'asosiy', label: 'Asosiy' },
                  { key: 'hujjatlar', label: 'Hujjat & Manzil' },
                  { key: 'oila', label: 'Oila' },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveEditTab(tab.key)}
                    className={`flex-1 rounded-lg py-2.5 text-center text-xs font-black uppercase tracking-widest transition-all ${
                      activeEditTab === tab.key
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2 pr-2">
                {(activeEditTab === 'asosiy'
                  ? ASOSIY_FIELDS
                  : activeEditTab === 'hujjatlar'
                  ? HUJJAT_FIELDS
                  : OILA_FIELDS
                ).map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                    <input
                      type={field.type}
                      value={(editForm[field.key as keyof typeof editForm] as string | number) || ''}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition-all focus:border-purple-500/50 outline-none"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
          {editModal.user?.source === 'staff' && (
            <div className="grid gap-4 md:grid-cols-2 pr-2">
              {[
                { key: 'full_name', label: "To'liq ism", type: 'text' },
                { key: 'phone', label: 'Telefon', type: 'text' },
                { key: 'status', label: 'Holat', type: 'text' },
                { key: 'assigned_floor', label: 'Biriktirilgan qavat', type: 'number' },
              ].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                  <input
                    type={field.type}
                    value={(editForm[field.key as keyof typeof editForm] as string | number) || ''}
                    onChange={(event) => setEditForm((c) => ({ ...c, [field.key]: event.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition-all focus:border-cyan-500/50 outline-none"
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Biriktirilgan jins</label>
                <select
                  value={editForm.assigned_gender || ''}
                  onChange={(event) => setEditForm((c) => ({ ...c, assigned_gender: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition-all focus:border-cyan-500/50 outline-none"
                >
                  <option value="" className="bg-slate-950">Tanlanmagan</option>
                  <option value="male" className="bg-slate-950">Erkak</option>
                  <option value="female" className="bg-slate-950">Ayol</option>
                </select>
              </div>
              <div className="md:col-span-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-xs text-amber-200/70 leading-relaxed">
                  <span className="font-bold text-amber-300">Ma&apos;lumot:</span> Tarbiyachi biriktirilgan jinsi bo&apos;yicha faqat o&apos;sha jinsga oid qavatlarni ko&apos;ra oladi. Agar qavat bo&apos;sh qoldirilsa, barcha qavatlar ochiq bo&apos;ladi.
                </p>
              </div>
            </div>
          )}
        </div>
      </AdminModal>

      <AdminModal
        isOpen={inviteModalOpen}
        title="Yangi Xodim Taklif Yaratish"
        description="Admin yoki Tarbiyachi ro'yxatdan o'tishi uchun taklif kodi yarating"
        onClose={() => {
          setInviteModalOpen(false)
          setGeneratedInviteCode('')
          setInviteEmail('')
        }}
      >
        <div className="space-y-6">
          {!generatedInviteCode ? (
            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Manzil</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="xodim@yotoqxona.uz"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition-all focus:border-purple-500/50 outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={creatingInvite}
                className="w-full h-11 rounded-xl bg-linear-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-purple-500/10 transition-all disabled:opacity-50 active:scale-95"
              >
                {creatingInvite ? 'Yaratilmoqda...' : 'Taklif Kodini Yaratish'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Taklif havolasi tayyor!</p>
                <p className="mt-2 text-xs text-slate-300">
                  Ushbu taklif havolasini ro&apos;yxatdan o&apos;tuvchi xodimga yuboring. Havola faqat ko&apos;rsatilgan email uchun amal qiladi.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Taklif Havolasi</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/admin/register?code=${generatedInviteCode}`}
                    className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs text-slate-300 outline-none"
                  />
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/admin/register?code=${generatedInviteCode}`
                      navigator.clipboard.writeText(link)
                      toast.success('Nusxalandi!')
                    }}
                    className="px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all"
                  >
                    Nusxalash
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Taklif Kodi</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteCode}
                    className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs text-slate-300 outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteCode)
                      toast.success('Nusxalandi!')
                    }}
                    className="px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all"
                  >
                    Nusxalash
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminModal>

      <AnimatePresence>
        {fullScreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullScreenImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative aspect-square w-full max-w-2xl overflow-hidden rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={fullScreenImage}
                alt="Full screen profile"
                fill
                className="object-cover"
                unoptimized
              />
            </motion.div>
            <button className="absolute right-6 top-6 text-white/50 hover:text-white transition-colors">
              <X size={32} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
