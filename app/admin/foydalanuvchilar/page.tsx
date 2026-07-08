'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  Edit2,
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
  ArrowLeft,
  MessageSquare,
  DollarSign,
  Eye,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { supabase } from '@/lib/supabase'

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
  warning_count?: number | null
}

type StudentPayment = {
  id: string
  month: string
  year: number
  amount: number
  status: 'paid' | 'pending' | 'rejected' | 'waiting' | 'approved'
  receipt_url?: string
  admin_message?: string
  created_at?: string
}

type ChatMessage = {
  id: string
  student_id: string
  type: string
  title: 'admin' | 'talaba'
  reason: string
  status: string
  created_at: string
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
  { key: 'warning_count', label: 'Ogohlantirishlar soni', type: 'number' },
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
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [activeFolder, setActiveFolder] = useState<'all' | 'talaba' | 'tarbiyachi' | 'admin' | 'pending'>('all')

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [detailTab, setDetailTab] = useState<'profil' | 'hujjatlar' | 'oila' | 'tolovlar' | 'chat'>('profil')
  const [payments, setPayments] = useState<StudentPayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [loadingChat, setLoadingChat] = useState(false)
  const [sendingChat, setSendingChat] = useState(false)
  const [chatInput, setChatInput] = useState('')

  const deleteModal = useConfirmModal<string>()
  const rejectModal = useConfirmModal<string>()
  const [editModal, setEditModal] = useState<{ isOpen: boolean; user?: UserRow }>({ isOpen: false })
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
    warning_count: '',
  })

  const [isUpdating, setIsUpdating] = useState(false)

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

  const loadUsers = useCallback(async () => {
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

      setSelectedUser((prev) => {
        if (!prev) return prev
        const updated = usersList.find((u) => u.id === prev.id)
        return updated ?? prev
      })
      return usersList
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Foydalanuvchilarni yuklashda xato!"
      console.error('Foydalanuvchilarni yuklashda xato:', message)
      toast.error(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

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
            setSelectedUser(user)
          }
        }
      }
    }
    void init()
  }, [loadUsers])

  const loadStudentPayments = async (studentId: string) => {
    try {
      setPaymentsLoading(true)
      const { data, error } = await supabase
        .from('tolovlar')
        .select('*')
        .eq('student_id', studentId)
        .order('year', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setPayments(data || [])
    } catch (error) {
      console.error('To\'lovlarni yuklashda xatolik:', error)
      toast.error('To\'lov ma\'lumotlarini yuklab bo\'lmadi')
    } finally {
      setPaymentsLoading(false)
    }
  }

  const loadChatMessages = async (studentId: string) => {
    try {
      setLoadingChat(true)
      const { data, error } = await supabase
        .from('arizalar')
        .select('*')
        .eq('student_id', studentId)
        .eq('type', 'chat')
        .order('created_at', { ascending: true })

      if (error) throw error
      setChatMessages(data || [])
    } catch (error) {
      console.error('Chat yuklashda xato:', error)
    } finally {
      setLoadingChat(false)
    }
  }

  useEffect(() => {
    if (selectedUser && selectedUser.role === 'talaba') {
      void loadStudentPayments(selectedUser.id)
      if (detailTab === 'chat') {
        void loadChatMessages(selectedUser.id)
      }
    } else {
      setPayments([])
      setChatMessages([])
    }
  }, [selectedUser, detailTab])

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !chatInput.trim() || sendingChat) return

    const messageText = chatInput.trim()
    setChatInput('')
    setSendingChat(true)

    try {
      const response = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedUser.id,
          message: messageText
        })
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Xabar yuborishda xatolik')
      }

      setChatMessages(prev => [...prev, result.message])
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Xabar yuborishda xatolik')
      setChatInput(messageText)
    } finally {
      setSendingChat(false)
    }
  }

  const paymentStats = useMemo(() => {
    const totalContractFee = 3000000
    const approvedPayments = payments.filter(p => p.status === 'paid' || p.status === 'approved')
    const waitingPayments = payments.filter(p => p.status === 'waiting' || p.status === 'pending')
    
    const paidAmount = approvedPayments.reduce((sum, p) => sum + p.amount, 0)
    const waitingAmount = waitingPayments.reduce((sum, p) => sum + p.amount, 0)
    const remainingAmount = Math.max(0, totalContractFee - paidAmount)
    const progressPercent = Math.round((paidAmount / totalContractFee) * 100) || 0

    return {
      totalContractFee,
      paidAmount,
      waitingAmount,
      remainingAmount,
      progressPercent
    }
  }, [payments])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesRoom = !filterRoom || (user.room_number?.toLowerCase().includes(filterRoom.toLowerCase()))
      
      let matchesFolder = true
      if (activeFolder === 'pending') {
        matchesFolder = user.status === 'pending'
      } else if (activeFolder !== 'all') {
        matchesFolder = user.role === activeFolder
      }

      return matchesSearch && matchesRoom && matchesFolder
    })
  }, [users, searchTerm, filterRoom, activeFolder])

  const roommates = useMemo(() => {
    const activeUser = selectedUser
    if (!activeUser?.room_number) return []
    return users.filter((u) => u.room_number === activeUser.room_number && u.id !== activeUser.id)
  }, [users, selectedUser])

  const handleDeleteClick = (userId: string) => {
    deleteModal.open(userId)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteModal.target) return

    try {
      deleteModal.setIsLoading(true)
      const user = users.find((item) => item.id === deleteModal.target)
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

      setUsers(users.filter((userItem) => userItem.id !== deleteModal.target))
      if (selectedUser?.id === deleteModal.target) {
        setSelectedUser(null)
      }
      deleteModal.close()
      toast.success("Foydalanuvchi o'chirildi!")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "O'chirishda xato!"
      console.error("O'chirishda xato:", message)
      toast.error(message)
    } finally {
      deleteModal.setIsLoading(false)
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
      if (selectedUser?.id === id) {
        setSelectedUser(prev => prev ? { ...prev, status: 'active' } : null)
      }
      toast.success("Talaba muvaffaqiyatli tasdiqlandi!")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Tasdiqlashda xato!"
      toast.error(message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReject = (id: string) => {
    rejectModal.open(id)
  }

  const handleRejectConfirm = async () => {
    const id = rejectModal.target
    if (!id) return

    try {
      rejectModal.setIsLoading(true)
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          source: 'users',
          status: 'rejected',
        }),
      })

      const result = (await response.json()) as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Rad etishda xato!")
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: 'rejected' } : u))
      )
      if (selectedUser?.id === id) {
        setSelectedUser(prev => prev ? { ...prev, status: 'rejected' } : null)
      }
      toast.success("Talaba arizasi rad etildi")
      rejectModal.close()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Rad etishda xato!"
      toast.error(message)
    } finally {
      rejectModal.setIsLoading(false)
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
      warning_count: user.warning_count !== undefined && user.warning_count !== null ? String(user.warning_count) : '0',
    })
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
            warning_count: editForm.warning_count ? Number(editForm.warning_count) : 0,
          } : {
            full_name: editForm.full_name,
            phone_number: editForm.phone,
            status: editForm.status,
            assigned_floor: editForm.assigned_floor ? Number(editForm.assigned_floor) : null,
            assigned_gender: editForm.assigned_gender || null
          }),
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
            warning_count: editForm.warning_count ? Number(editForm.warning_count) : 0,
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

      if (selectedUser?.id === updatedUser.id) {
        setSelectedUser(updatedUser)
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

  const totalCount = users.length || 1
  const talabaCount = users.filter((u) => u.role === 'talaba').length
  const tarbiyachiCount = users.filter((u) => u.role === 'tarbiyachi').length
  const adminCount = users.filter((u) => u.role === 'admin').length
  const pendingCount = users.filter((u) => u.role === 'talaba' && u.status === 'pending').length

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
  ]

  return (
    <div>
      {/* Title Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tighter text-slate-900 dark:text-white sm:text-4xl">
            <div className="rounded-2xl bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
              <Users size={30} />
            </div>
            Foydalanuvchilar boshqaruvi
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Tizimdagi barcha foydalanuvchilar va xodimlar ro&apos;yxati</p>
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

      {/* Stats Section */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => {
          const Icon = card.icon
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
          )
        })}
      </div>

      {/* Telegram Split Chat Layout */}
      <div className={`grid grid-cols-1 md:grid-cols-12 rounded-3xl border ${
        isLight ? 'bg-white border-slate-200 shadow-xl' : 'bg-[#0f172a]/30 border-white/10 shadow-2xl shadow-black/40'
      } overflow-hidden h-[620px]`}>
        
        {/* Left Side: Users List */}
        <div className={`col-span-12 md:col-span-4 lg:col-span-3 border-r h-full min-h-0 ${
          isLight ? 'border-slate-200 bg-[#f8fafc]' : 'border-white/5 bg-[#17212b]'
        } ${selectedUser ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
          
          {/* List Search inputs */}
          <div className="p-4 space-y-2.5">
            <div className="relative">
              <Search className={`absolute left-3 top-3.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} size={16} />
              <input
                type="text"
                placeholder="Ism yoki email bo'yicha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full rounded-2xl py-3 pl-10 pr-4 text-xs outline-none transition-all ${
                  isLight
                    ? 'bg-slate-100 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500'
                    : 'bg-[#24303f] border border-transparent text-white focus:bg-[#1f2936] focus:border-purple-500/50'
                }`}
              />
            </div>
            <div className="relative">
              <Home className={`absolute left-3 top-3.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} size={16} />
              <input
                type="text"
                placeholder="Xona raqami bo'yicha..."
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className={`w-full rounded-2xl py-3 pl-10 pr-4 text-xs outline-none transition-all ${
                  isLight
                    ? 'bg-slate-100 border border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500'
                    : 'bg-[#24303f] border border-transparent text-white focus:bg-[#1f2936] focus:border-purple-500/50'
                }`}
              />
            </div>
          </div>

          {/* Folder Tabs (Horizontally scrollable list filters) */}
          <div className={`flex gap-1 overflow-x-auto px-4 pb-2 border-b no-scrollbar ${
            isLight ? 'border-slate-100' : 'border-white/5'
          }`}>
            {([
              { key: 'all', label: 'Barchasi' },
              { key: 'talaba', label: 'Talabalar' },
              { key: 'tarbiyachi', label: 'Tarbiyachilar' },
              { key: 'admin', label: 'Adminlar' },
              { key: 'pending', label: 'Kutilayotgan' }
            ] as const).map((folder) => {
              const isActive = activeFolder === folder.key
              const count = folder.key === 'all' 
                ? users.length 
                : folder.key === 'pending'
                  ? users.filter(u => u.status === 'pending').length
                  : users.filter(u => u.role === folder.key).length
              return (
                <button
                  key={folder.key}
                  onClick={() => setActiveFolder(folder.key)}
                  className={`relative shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? isLight
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-[#2b5278] text-white'
                      : isLight
                        ? 'text-slate-500 hover:bg-slate-100'
                        : 'text-slate-400 hover:bg-[#202b36]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {folder.label}
                    {count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                        isActive
                          ? isLight ? 'bg-blue-600 text-white' : 'bg-[#182533] text-[#4f9ed9]'
                          : isLight ? 'bg-slate-200 text-slate-600' : 'bg-[#24303f] text-slate-400'
                      }`}>
                        {count}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto min-h-0 no-scrollbar">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Yuklanmoqda...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Foydalanuvchi topilmadi</div>
            ) : (
              filteredUsers.map((user) => {
                const isActive = selectedUser?.id === user.id && selectedUser?.source === user.source
                const initials = getInitials(user.full_name)
                
                return (
                  <button
                    key={`${user.id}-${user.source}`}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full text-left p-3 flex items-center gap-3 transition-colors border-b ${
                      isLight 
                        ? 'border-slate-100/50' 
                        : 'border-white/5'
                    } ${
                      isActive
                        ? isLight
                          ? 'bg-[#2f8ccf] text-white'
                          : 'bg-[#2b5278] text-white'
                        : isLight
                          ? 'hover:bg-slate-100 text-slate-900'
                          : 'hover:bg-[#202b36] text-white'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="relative h-11 w-11 overflow-hidden rounded-full bg-slate-800 border border-white/10">
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt={user.full_name}
                            fill
                            sizes="44px"
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div className={`flex h-full w-full items-center justify-center text-xs font-black ${
                            isActive
                              ? 'bg-white/10 text-white'
                              : isLight
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-[#24303f] text-[#4f9ed9]'
                          }`}>
                            {initials}
                          </div>
                        )}
                      </div>
                      
                      {/* Status Dot */}
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 ${
                        isLight ? 'border-white' : 'border-[#17212b]'
                      } ${
                        user.status === 'pending'
                          ? 'bg-amber-400 animate-pulse'
                          : user.status === 'rejected'
                            ? 'bg-rose-500'
                            : 'bg-emerald-500'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs truncate leading-none">{user.full_name}</p>
                        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          isActive
                            ? 'bg-white/20 text-white border-transparent'
                            : ROLE_COLORS[user.role]
                        }`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <p className={`text-[10px] truncate ${
                          isActive
                            ? 'text-sky-100'
                            : isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {user.room_number ? `Xona: ${user.room_number}` : user.email}
                        </p>
                        {user.role === 'talaba' && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 border shrink-0 ${
                            isActive
                              ? 'bg-white/20 text-white border-white/10'
                              : (user.warning_count ?? 0) === 0
                                ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20'
                                : (user.warning_count ?? 0) <= 2
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 animate-pulse'
                          }`}>
                            {(user.warning_count ?? 0) === 0 ? (
                              <>
                                <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-white' : 'bg-emerald-500'}`} />
                                A&apos;lo
                              </>
                            ) : (
                              <>
                                <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-white' : (user.warning_count ?? 0) <= 2 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                                {user.warning_count} ta
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Side: Chat / User Details View */}
        <div className={`col-span-12 md:col-span-8 lg:col-span-9 h-full overflow-hidden min-h-0 ${
          isLight ? 'bg-slate-50' : 'bg-[#0e1621]'
        } ${!selectedUser ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
          
          {!selectedUser ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-radial-gradient from-white/[0.02] to-transparent">
              <div className={`rounded-full p-6 ${
                isLight ? 'bg-slate-200 text-slate-400' : 'bg-[#182533] text-slate-500 border border-white/5'
              } mb-4`}>
                <MessageSquare size={48} />
              </div>
              <p className={`text-sm max-w-xs ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Foydalanuvchining to&apos;liq ma&apos;lumotlari va boshqaruv amallarini ko&apos;rish uchun chap ro&apos;yxatdan tanlang
              </p>
            </div>
          ) : (
            <>
              {/* Active User Header */}
              <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isLight ? 'border-slate-200 bg-white' : 'border-white/5 bg-[#17212b]'
              }`}>
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 md:hidden"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  
                  <div
                    className="relative h-11 w-11 overflow-hidden rounded-full bg-slate-800 cursor-pointer border border-white/10 shrink-0"
                    onClick={() => selectedUser.avatar_url && setFullScreenImage(selectedUser.avatar_url)}
                  >
                    {selectedUser.avatar_url ? (
                      <Image
                        src={selectedUser.avatar_url}
                        alt={selectedUser.full_name}
                        fill
                        sizes="44px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center text-xs font-black bg-purple-500/20 text-purple-300`}>
                        {getInitials(selectedUser.full_name)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight break-words">{selectedUser.full_name}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <p className="text-[10px] text-slate-400">
                        {selectedUser.status === 'active' ? (
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            Tizimda faol
                          </span>
                        ) : selectedUser.status === 'rejected' ? (
                          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Rad etilgan
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Kutilmoqda
                          </span>
                        )}
                      </p>
                      {selectedUser.role === 'talaba' && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border shrink-0 whitespace-nowrap ${
                          (selectedUser.warning_count ?? 0) === 0
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : (selectedUser.warning_count ?? 0) <= 2
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 animate-pulse'
                        }`}>
                          {(selectedUser.warning_count ?? 0) === 0 ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Ogohlantirish yo&apos;q (A&apos;lo)
                            </>
                          ) : (
                            <>
                              <span className={`w-1.5 h-1.5 rounded-full ${(selectedUser.warning_count ?? 0) <= 2 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                              {selectedUser.warning_count} ta ogohlantirish
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end shrink-0">
                  {selectedUser.role === 'talaba' && (selectedUser.status === 'pending' || selectedUser.status === 'rejected') && (
                    <button
                      onClick={() => handleApprove(selectedUser.id)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1 shadow-md shadow-emerald-500/10"
                    >
                      <Check size={14} />
                      Tasdiqlash
                    </button>
                  )}
                  {selectedUser.role === 'talaba' && selectedUser.status === 'pending' && (
                    <button
                      onClick={() => handleReject(selectedUser.id)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white transition-all flex items-center gap-1 shadow-md shadow-rose-500/10"
                    >
                      <X size={14} />
                      Rad etish
                    </button>
                  )}
                  <button
                    onClick={() => handleEditClick(selectedUser)}
                    className={`p-2 rounded-lg border transition-all ${
                      isLight 
                        ? 'border-slate-200 bg-white hover:bg-slate-50 text-amber-500' 
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-amber-400'
                    }`}
                    title="Tahrirlash"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(selectedUser.id)}
                    className={`p-2 rounded-lg border transition-all ${
                      isLight 
                        ? 'border-slate-200 bg-white hover:bg-slate-50 text-rose-500' 
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-red-400'
                    }`}
                    title="O'chirish"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Details Pane Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                
                 {/* Details Tab Menu */}
                <div className={`flex gap-1 rounded-xl p-1 border overflow-x-auto no-scrollbar flex-nowrap ${
                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/5'
                }`}>
                  {([
                    { key: 'profil', label: 'Profil' },
                    { key: 'hujjatlar', label: 'Hujjat & Manzil' },
                    ...(selectedUser.role === 'talaba' ? [
                      { key: 'oila', label: 'Oila' },
                      { key: 'tolovlar', label: 'To\'lovlar' },
                      { key: 'chat', label: 'Xabarlar' }
                    ] : []),
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setDetailTab(tab.key as 'profil' | 'hujjatlar' | 'oila' | 'tolovlar' | 'chat')}
                      className={`flex-1 shrink-0 whitespace-nowrap py-2 px-3 sm:px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        detailTab === tab.key
                          ? 'bg-purple-600 text-white shadow-lg'
                          : `${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab: Profil (Basic Info) */}
                {detailTab === 'profil' && (
                  <div className={`rounded-2xl border p-4 shadow-md space-y-3.5 ${
                    isLight ? 'bg-white border-slate-200/50' : 'bg-[#182533] border-white/5'
                  }`}>
                    <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Asosiy ma&apos;lumotlar</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {studentInfoItems(selectedUser)
                        .filter(item => !['Passport seriya', 'JSHSHIR', 'Passport sanasi', 'Hudud', 'Millati', 'Jinsi'].includes(item.label))
                        .map((item, idx) => {
                          const Icon = item.icon
                          return (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="rounded-lg p-2.5 bg-slate-800/40 text-slate-400 shrink-0">
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-white text-xs font-semibold truncate">{item.value}</p>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{item.label}</p>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Tab: Hujjatlar */}
                {detailTab === 'hujjatlar' && (
                  <div className={`rounded-2xl border p-4 shadow-md space-y-3.5 ${
                    isLight ? 'bg-white border-slate-200/50' : 'bg-[#182533] border-white/5'
                  }`}>
                    <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-2">Hujjat va manzillar</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {studentInfoItems(selectedUser)
                        .filter(item => ['Passport seriya', 'JSHSHIR', 'Passport sanasi', 'Hudud', 'Millati', 'Jinsi'].includes(item.label))
                        .map((item, idx) => {
                          const Icon = item.icon
                          return (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="rounded-lg p-2.5 bg-slate-800/40 text-slate-400 shrink-0">
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-white text-xs font-semibold truncate">{item.value}</p>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{item.label}</p>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Tab: Oila */}
                {detailTab === 'oila' && selectedUser.role === 'talaba' && (
                  <div className={`rounded-2xl border p-4 shadow-md space-y-3.5 ${
                    isLight ? 'bg-white border-slate-200/50' : 'bg-[#182533] border-white/5'
                  }`}>
                    <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">Oila a&apos;zolari</h3>
                    {familyInfoItems(selectedUser).length === 0 ? (
                      <p className="text-xs text-slate-400">Kiritilmagan</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {familyInfoItems(selectedUser).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-xs font-semibold truncate">{item.value}</p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{item.label}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: To'lovlar */}
                {detailTab === 'tolovlar' && selectedUser.role === 'talaba' && (
                  <div className="space-y-4">
                    {/* Summary cards grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Paid card */}
                      <div className={`rounded-2xl border p-4 shadow-md flex items-center gap-3 ${
                        isLight ? 'bg-white border-slate-200/50' : 'bg-[#182533] border-white/5'
                      }`}>
                        <div className="rounded-lg p-2.5 bg-emerald-500/10 text-emerald-500 shrink-0">
                          <CheckCircle2 size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-black leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {paymentStats.paidAmount.toLocaleString('uz-UZ')} UZS
                          </p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">To&apos;langan summa</p>
                        </div>
                      </div>

                      {/* Remaining card */}
                      <div className={`rounded-2xl border p-4 shadow-md flex items-center gap-3 ${
                        isLight ? 'bg-white border-slate-200/50' : 'bg-[#182533] border-white/5'
                      }`}>
                        <div className="rounded-lg p-2.5 bg-rose-500/10 text-rose-500 shrink-0">
                          <DollarSign size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-black leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {paymentStats.remainingAmount.toLocaleString('uz-UZ')} UZS
                          </p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">Qolgan summa</p>
                        </div>
                      </div>

                      {/* Contract Fee card */}
                      <div className={`rounded-2xl border p-4 shadow-md flex items-center gap-3 ${
                        isLight ? 'bg-white border-slate-200/50' : 'bg-[#182533] border-white/5'
                      }`}>
                        <div className="rounded-lg p-2.5 bg-purple-500/10 text-purple-400 shrink-0">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-black leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {paymentStats.totalContractFee.toLocaleString('uz-UZ')} UZS
                          </p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">Shartnoma miqdori</p>
                        </div>
                      </div>

                      {/* Waiting Approval card */}
                      <div className={`rounded-2xl border p-4 shadow-md flex items-center gap-3 ${
                        isLight ? 'bg-white border-slate-200/50' : 'bg-[#182533] border-white/5'
                      }`}>
                        <div className="rounded-lg p-2.5 bg-amber-500/10 text-amber-500 shrink-0">
                          <Clock size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-black leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {paymentStats.waitingAmount.toLocaleString('uz-UZ')} UZS
                          </p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">Kutilayotgan to&apos;lovlar</p>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar Card */}
                    <div className={`rounded-2xl border p-4 shadow-md ${
                      isLight ? 'bg-white border-slate-200/50' : 'bg-[#182533] border-white/5'
                    }`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To&apos;lov progressi</span>
                        <span className="text-xs font-black text-emerald-500">{paymentStats.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-800/40 rounded-full h-2.5 overflow-hidden border border-white/5">
                        <div 
                          className="bg-linear-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full transition-all duration-500" 
                          style={{ width: `${paymentStats.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Payments list / history */}
                    <div className={`rounded-2xl border p-4 shadow-md ${
                      isLight ? 'bg-white border-slate-200/50' : 'bg-[#182533] border-white/5'
                    }`}>
                      <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">To&apos;lov kvitansiyalari tarixi</h3>
                      
                      {paymentsLoading ? (
                        <p className="text-center text-xs text-slate-500 py-4">Yuklanmoqda...</p>
                      ) : payments.length === 0 ? (
                        <p className="text-center text-xs text-slate-500 py-4">To&apos;lovlar kvitansiyalari mavjud emas</p>
                      ) : (
                        <div className="space-y-2.5">
                          {payments.map((record) => {
                            const isApproved = record.status === 'paid' || record.status === 'approved'
                            const isWaiting = record.status === 'waiting' || record.status === 'pending'

                            return (
                              <div 
                                key={record.id} 
                                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                                  isLight ? 'bg-slate-50 border-slate-100' : 'bg-[#1b2836] border-white/5'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    {record.month}, {record.year}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    Summa: {record.amount.toLocaleString('uz-UZ')} UZS
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                    isApproved
                                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                      : isWaiting
                                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                        : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                  }`}>
                                    {isApproved ? 'Tasdiqlangan' : isWaiting ? 'Kutilmoqda' : 'Rad etilgan'}
                                  </span>

                                  {record.receipt_url && (
                                    <button
                                      onClick={() => setFullScreenImage(record.receipt_url || null)}
                                      className={`p-1.5 rounded-lg border transition-all ${
                                        isLight
                                          ? 'border-slate-200 bg-white hover:bg-slate-100 text-slate-600'
                                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300'
                                      }`}
                                      title="Kvitansiyani ko'rish"
                                    >
                                      <Eye size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab: Chat */}
                {detailTab === 'chat' && selectedUser.role === 'talaba' && (
                  <div className={`rounded-2xl border p-4 shadow-md flex flex-col h-[420px] ${
                    isLight ? 'bg-white border-slate-200/50' : 'bg-[#182533] border-white/5'
                  }`}>
                    <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3 shrink-0">Talaba bilan suhbat</h3>
                    
                    {/* Chat bubbles container */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3 custom-scrollbar flex flex-col min-h-0">
                      {loadingChat ? (
                        <p className="text-center text-xs text-slate-500 my-auto">Yuklanmoqda...</p>
                      ) : chatMessages.length === 0 ? (
                        <p className="text-center text-xs text-slate-500 my-auto">Xabarlar mavjud emas. Birinchi xabarni yuboring.</p>
                      ) : (
                        chatMessages.map((msg) => {
                          const isAdminSender = msg.title === 'admin'
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col max-w-[80%] rounded-2xl p-3 text-xs ${
                                isAdminSender
                                  ? 'self-end bg-purple-600 text-white rounded-br-none'
                                  : isLight
                                    ? 'self-start bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                                    : 'self-start bg-slate-800 text-slate-100 rounded-bl-none border border-white/5'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words font-medium">{msg.reason}</p>
                              <span className={`text-[8px] self-end mt-1 font-bold ${
                                isAdminSender ? 'text-purple-200' : 'text-slate-400'
                              }`}>
                                {formatDate(msg.created_at) !== '-' ? new Date(msg.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>

                    {/* Chat composer form */}
                    <form onSubmit={handleSendChatMessage} className="flex gap-2 shrink-0 border-t border-white/5 pt-3">
                      <input
                        type="text"
                        placeholder="Xabar yozing..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-xs outline-none transition-all ${
                          isLight
                            ? 'bg-slate-100 border border-slate-200 text-slate-900 focus:bg-white focus:border-purple-500'
                            : 'bg-white/5 border border-white/10 text-white focus:bg-[#1f2936] focus:border-purple-500/50'
                        }`}
                        disabled={sendingChat}
                      />
                      <button
                        type="submit"
                        disabled={sendingChat || !chatInput.trim()}
                        className="px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                      >
                        {sendingChat ? '...' : 'Yuborish'}
                      </button>
                    </form>
                  </div>
                )}

                {/* Roommates Card (If student and roommates exist) */}
                {selectedUser.role === 'talaba' && roommates.length > 0 && (
                  <div className={`rounded-2xl border p-4 shadow-md ${
                    isLight ? 'bg-white border-slate-200/50' : 'bg-[#182533] border-white/5'
                  }`}>
                    <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">Xonadoshlar</h3>
                    <div className="flex flex-wrap gap-4">
                      {roommates.map((roommate) => (
                        <div
                          key={`${roommate.id}-${roommate.source}`}
                          className="flex flex-col items-center gap-1.5 group cursor-pointer"
                          title={roommate.full_name}
                          onClick={() => setSelectedUser(roommate)}
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

                <div className={`rounded-2xl border p-4 text-center ${
                  isLight ? 'bg-slate-100 border-slate-200/50' : 'bg-[#182533]/50 border-white/5'
                }`}>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    Ro&apos;yxatdan o&apos;tgan sana: {formatDate(selectedUser.created_at)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Foydalanuvchini o'chirish"
        description="Ushbu amalni qaytarib bo'lmaydi. Tizimdan o'chirishni tasdiqlaysizmi?"
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        confirmText="O'chirish"
        confirmVariant="danger"
        isLoading={deleteModal.isLoading}
      />

      {/* Reject Application Confirmation Modal */}
      <ConfirmModal
        isOpen={rejectModal.isOpen}
        title="Arizani rad etish"
        description="Talaba tizimdan o'chirilmaydi — arizasi rad etilgan deb belgilanadi va kerak bo'lsa keyinroq qayta tasdiqlashingiz mumkin."
        onClose={rejectModal.close}
        onConfirm={handleRejectConfirm}
        confirmText="Rad etish"
        confirmVariant="danger"
        isLoading={rejectModal.isLoading}
      />

      {/* Edit User Modal */}
      <ConfirmModal
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
      </ConfirmModal>

      {/* Staff Invite Creation Modal */}
      <ConfirmModal
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
      </ConfirmModal>

      {/* Full Screen Image Modal */}
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
