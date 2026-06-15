'use client'

import Image from 'next/image'
import { useState, useEffect, useRef, type SyntheticEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { getSafeSession, getSafeUser } from '@/lib/auth-session'
import {
  Mail, Phone, GraduationCap, Home,
  ShieldCheck, LogOut, Camera, Edit2, Lock, X, Check, Loader, Award, Sparkles, Shield,
  Eye, EyeOff, Key, Clock, Info, AlertTriangle, Trash2, RefreshCw, Calendar, Activity,
  HelpCircle, ExternalLink, ChevronRight
} from 'lucide-react'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import { useThemeStore } from '@/lib/stores/theme-store'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  faculty?: string
  role?: string
  room_number?: string
  course?: string | number
  group?: string | number
  avatar_url?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.35,
      ease: [0.25, 1, 0.5, 1] as const
    },
  }),
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ─── 3D Creative Toast ────────────────────────────────────────────────────────
interface Toast3DProps {
  message: { type: 'success' | 'error'; text: string } | null
  isLight: boolean
}

function Toast3D({ message, isLight }: Toast3DProps) {
  if (!message) return null

  const isSuccess = message.type === 'success'
  const bgColor = isSuccess
    ? isLight ? 'from-green-400 to-emerald-600' : 'from-emerald-500/90 to-teal-600/90'
    : isLight ? 'from-red-400 to-pink-600' : 'from-red-500/90 to-pink-600/90'

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.8 }}
      animate={{ opacity: 1, y: 20, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.8 }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[999]"
    >
      <div className={`bg-gradient-to-r ${bgColor} rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-xl border border-white/20`}
        style={{
          boxShadow: `
            0 20px 40px rgba(0, 0, 0, 0.3),
            0 0 60px ${isSuccess ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'},
            inset 0 1px 0 rgba(255, 255, 255, 0.3)
          `
        }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="flex-shrink-0"
          >
            {isSuccess ? (
              <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                <Check size={14} className="text-white" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                <X size={14} className="text-white" />
              </div>
            )}
          </motion.div>
          <span className="text-white font-bold text-xs uppercase tracking-wider">{message.text}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
type StepState = 'done' | 'active' | 'todo'

function Timeline({ course, isLight }: { course: number; isLight: boolean }) {
  const steps = [1, 2, 3, 4].map((n) => ({
    n,
    year: String(2023 + n),
    state: (course > n ? 'done' : course === n ? 'active' : 'todo') as StepState,
  }))

  const cls: Record<StepState, string> = {
    done: isLight ? 'bg-blue-600 text-blue-100' : 'bg-blue-600/30 text-blue-300 border border-blue-500/30',
    active: isLight ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 shadow-lg shadow-blue-500/30' : 'bg-indigo-600 text-white ring-4 ring-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.5)]',
    todo: isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/5 text-gray-600 border border-white/5',
  }

  return (
    <div className="flex items-start w-full relative pt-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex-1 flex flex-col items-center relative">
          {i < 3 && (
            <div className={`absolute top-4 left-1/2 w-full h-0.5 ${
              isLight ? 'bg-slate-200' : 'bg-white/5'
            }`} />
          )}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black z-10 mb-2 transition-all ${cls[s.state]}`}>
            {s.n}
          </div>
          <p className={`text-[10px] font-black uppercase tracking-wider ${s.state === 'active' ? isLight ? 'text-blue-600' : 'text-indigo-400' : isLight ? 'text-slate-500' : 'text-slate-500'}`}>
            {s.n}-kurs
          </p>
          <p className={`text-[9px] font-semibold mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>{s.year} - yil</p>
        </div>
      ))}
    </div>
  )
}

// ─── Info row ─────────────────────────────────────────────────────────────────
interface InfoRowProps {
  icon: React.ReactNode
  label: string
  value: string
  bg: string
  color: string
}

function InfoRow({ icon, label, value, bg, color }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3.5 group">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
        style={{ background: bg, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-0.5 opacity-60" style={{ color }}>
          {label}
        </p>
        <p className="text-xs font-bold truncate dark:text-slate-100 text-slate-800">
          {value}
        </p>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  return (
    <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#02040a]'}`}>
      <div className="flex flex-col items-center gap-3">
        <div className={`w-12 h-12 border-4 rounded-full animate-spin ${isLight ? 'border-blue-200 border-t-blue-600' : 'border-blue-500/20 border-t-blue-500'}`} />
        <p className={`text-xs font-bold ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Profil yuklanmoqda...</p>
      </div>
    </div>
  )
}

// ─── Roommate Card ─────────────────────────────────────────────────────────────
interface RoommateCardProps {
  roommate: Profile
  isLight: boolean
}

function RoommateCard({ roommate, isLight }: RoommateCardProps) {
  const initials = getInitials(roommate.full_name)
  const course = Number(roommate.course ?? 1)

  return (
    <div className={`border rounded-2xl p-3 flex items-center justify-between transition-all duration-200 hover:scale-[1.01] ${
      isLight ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-white/5 border-white/5'
    }`}>
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-xl p-0.5 shrink-0"
          style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}
        >
          <div className={`w-full h-full rounded-lg flex items-center justify-center overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-[#0a0f1d]'}`}>
            {roommate.avatar_url ? (
              <Image
                src={roommate.avatar_url}
                alt={roommate.full_name}
                width={44}
                height={44}
                unoptimized
                className="object-cover w-full h-full"
              />
            ) : (
              <span className={`text-xs font-black ${isLight ? 'text-green-600' : 'text-emerald-400'}`}>
                {initials}
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0">
          <p className="font-bold text-xs truncate dark:text-white text-slate-900">
            {roommate.full_name}
          </p>
          <p className="text-[9px] font-semibold dark:text-slate-400 text-slate-500">
            {course}-kurs · {roommate.group || '—'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a href={`tel:${roommate.phone || ''}`} className={`p-1.5 rounded-lg border hover:bg-emerald-500/10 ${
          isLight ? 'border-slate-200 text-slate-600' : 'border-white/5 text-gray-400'
        }`}>
          <Phone size={11} />
        </a>
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StudentProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roommates, setRoommates] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Profile>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Last login
  const [lastLogin, setLastLogin] = useState<string | null>(null)
  // Lock body scroll when any modal is open
  useEffect(() => {
    if (showEditModal || showPasswordModal || showDeleteConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showEditModal, showPasswordModal, showDeleteConfirm]);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true)
        const user = await getSafeUser()

        if (user) {
          // Set last login from user metadata
          const loginTime = user.last_sign_in_at || user.created_at
          if (loginTime) {
            setLastLogin(loginTime)
          }

          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

          if (!error && data) {
            setProfile({
              ...data,
              phone: data.phone_number
            })

            // Roommates load
            if (data.room_number) {
              const { data: roommatesData, error: roommatesError } = await supabase
                .from('users')
                .select('id, full_name, email, phone_number, faculty, role, room_number, course, group, avatar_url')
                .eq('room_number', data.room_number)
                .neq('id', user.id)
                .order('full_name', { ascending: true })

              if (!roommatesError && roommatesData) {
                const mappedRoommates = roommatesData.map((r: {
                  id: string
                  full_name: string
                  email: string
                  phone_number?: string
                  faculty?: string
                  role?: string
                  room_number?: string
                  course?: string | number
                  group?: string | number
                  avatar_url?: string
                }) => ({
                  ...r,
                  phone: r.phone_number
                }))
                setRoommates(mappedRoommates)
              }
            }
            return
          }
        }

        // Mock profile fallback
        setProfile({
          id: '1',
          full_name: "Azizbek Karimov",
          email: "azizbek@univer.uz",
          phone: "+998 90 123 45 67",
          faculty: "Dasturiy Injiniring",
          role: "Talaba",
          room_number: "204-xona",
          course: "3",
          group: "412"
        })
        setLastLogin(new Date().toISOString())
        setRoommates([
          {
            id: '2',
            full_name: "Dilshod Latipov",
            email: "dilshod@univer.uz",
            phone: "+998 90 234 56 78",
            faculty: "Dasturiy Injiniring",
            role: "Talaba",
            room_number: "204-xona",
            course: "3",
            group: "412"
          },
          {
            id: '3',
            full_name: "Gaxriman Araznepesov",
            email: "gaxriman@univer.uz",
            phone: "+998 90 345 67 89",
            faculty: "Dasturiy Injiniring",
            role: "Talaba",
            room_number: "204-xona",
            course: "3",
            group: "412"
          }
        ])

      } catch {
        console.log("Offline mode fallback enabled")
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const refreshProfile = async () => {
    if (!profile) return
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', profile.id)
        .single()

      if (!error && data) {
        setProfile(data)
      }
    } catch (error) {
      console.error('Profile refresh xatosi:', error)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleDeleteAvatar = async () => {
    if (!profile) return

    setUploading(true)
    try {
      const session = await getSafeSession()
      if (!session?.access_token) {
        setMessage({ type: 'error', text: 'Autentifikatsiya xatosi' })
        return
      }

      const response = await fetch(
        `/api/student/profile/upload-avatar?userId=${profile.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Avatar o\'chirilishida xato' })
        return
      }

      await refreshProfile()
      setMessage({ type: 'success', text: 'Avatar o\'chirildi' })
      setTimeout(() => setMessage(null), 4000)
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Xato yuz berdi' })
    } finally {
      setUploading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Faqat rasm formatidagi fayllar qabul qilinadi' })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Rasm 5MB dan kichik bo\'lishi shart' })
      return
    }

    setUploading(true)
    try {
      const session = await getSafeSession()
      if (!session?.access_token) {
        setMessage({ type: 'error', text: 'Autentifikatsiya xatosi' })
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', profile.id)

      const response = await fetch('/api/student/profile/upload-avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Yuklashda xato yuz berdi' })
        return
      }

      await refreshProfile()
      setMessage({ type: 'success', text: 'Rasm muvaffaqiyatli saqlandi' })
      setTimeout(() => setMessage(null), 4000)
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Xato yuz berdi' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleEditOpen = () => {
    if (profile) {
      setEditForm({
        full_name: profile.full_name,
        phone: profile.phone,
        faculty: profile.faculty,
        group: profile.group,
        room_number: profile.room_number,
      })
      setShowEditModal(true)
    }
  }

  const handleEditSave = async () => {
    if (!profile) return

    setSavingEdit(true)
    try {
      const response = await fetch('/api/student/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          ...editForm,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Yangilashda xato yuz berdi' })
        setTimeout(() => setMessage(null), 4000)
        return
      }

      setProfile(data.data)
      setShowEditModal(false)
      setMessage({ type: 'success', text: 'Profil muvaffaqiyatli yangilandi! ✅' })
      setTimeout(() => setMessage(null), 4000)
    } catch {
      setMessage({ type: 'error', text: 'Tizim xatosi yuz berdi' })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ─── Password change handler ─────────────────────────────────────────────────
  const passwordChecks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
  }
  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length
  const strengthLabel = ['', 'Juda zaif', 'Zaif', 'O\'rtacha', 'Kuchli'][passwordStrength] || ''
  const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'][passwordStrength] || '#64748b'

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmNewPassword) {
      setMessage({ type: 'error', text: 'Barcha maydonlarni to\'ldiring' })
      setTimeout(() => setMessage(null), 4000)
      return
    }
    if (newPassword !== confirmNewPassword) {
      setMessage({ type: 'error', text: 'Yangi parollar mos kelmaydi' })
      setTimeout(() => setMessage(null), 4000)
      return
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' })
      setTimeout(() => setMessage(null), 4000)
      return
    }

    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setMessage({ type: 'error', text: error.message || 'Parolni o\'zgartirishda xato' })
      } else {
        setMessage({ type: 'success', text: 'Parol muvaffaqiyatli o\'zgartirildi!' })
        setShowPasswordModal(false)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
      }
      setTimeout(() => setMessage(null), 4000)
    } catch {
      setMessage({ type: 'error', text: 'Tizim xatosi yuz berdi' })
      setTimeout(() => setMessage(null), 4000)
    } finally {
      setChangingPassword(false)
    }
  }

  // ─── Format date helper ─────────────────────────────────────────────────────
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Hozir'
    if (minutes < 60) return `${minutes} daqiqa oldin`
    if (hours < 24) return `${hours} soat oldin`
    if (days < 7) return `${days} kun oldin`
    return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Safe values
  const fullName = profile?.full_name || 'Talaba'
  const faculty = profile?.faculty || 'Fakultet kiritilmagan'
  const role = profile?.role || 'Talaba'
  const email = profile?.email || '—'
  const phone = profile?.phone || '+998 -- --- -- --'
  const roomNumber = profile?.room_number || 'Biriktirilmagan'
  const course = Number(profile?.course ?? 1)
  const group = profile?.group ? String(profile.group) : '—'
  const initials = getInitials(fullName)

  // Subtly dark overlay style
  const cardOverlay = isLight 
    ? 'bg-white/80 border-slate-200/80 shadow-lg' 
    : 'bg-slate-900/40 backdrop-blur-xl border-white/5 shadow-2xl';

  return (
    <div className={`w-full relative py-4 space-y-6 sm:space-y-8 min-h-screen transition-colors duration-300`}>
      
      {/* Toast */}
      <Toast3D message={message} isLight={isLight} />

      {/* Decorative Glow Spheres */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {!isLight && (
          <>
            <div className="absolute top-[-10%] left-[-5%] w-[70%] h-[50%] bg-indigo-600/5 blur-[120px] rounded-full" />
            <div className="absolute top-[40%] right-[-5%] w-[60%] h-[40%] bg-cyan-600/5 blur-[120px] rounded-full" />
          </>
        )}
      </div>

      <div className="relative z-10 space-y-6 sm:space-y-8">
        
        {/* Header Row */}
        <motion.div
          custom={0} variants={fadeUp} initial="hidden" animate="show"
          className="flex justify-between items-center pb-5 border-b border-white/5"
        >
          <div>
            <span className={`text-[9px] font-black uppercase tracking-[0.22em] px-2.5 py-1 rounded-full ${
              isLight ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-blue-500/10 text-cyan-400 border border-blue-500/25'
            }`}>
              Profil Paneli
            </span>
            <h1 className={`text-2xl sm:text-3xl font-black italic tracking-tight uppercase mt-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Talaba kartasi
            </h1>
          </div>

          <button
            onClick={handleLogout}
            className={`flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 active:scale-95 ${
              isLight 
                ? 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 shadow-sm' 
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white'
            }`}
          >
            <LogOut size={13} />
            <span>Chiqish</span>
          </button>
        </motion.div>

        {/* 3D Glass Passport Card (Hero) */}
        <motion.div
          custom={1} variants={fadeUp} initial="hidden" animate="show"
          className={`relative overflow-hidden rounded-[36px] border p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-start justify-between gap-6 ${cardOverlay}`}
          style={{
            boxShadow: !isLight 
              ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 25px 50px -12px rgba(0,0,0,0.4)' 
              : '0 20px 40px rgba(0,0,0,0.05)'
          }}
        >
          {/* Inner Light reflection accent */}
          {!isLight && (
            <div className="absolute right-0 top-0 w-48 h-48 rounded-full blur-3xl opacity-20 bg-indigo-500 pointer-events-none" />
          )}

          <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10 w-full md:w-auto text-center sm:text-left">
            {/* Avatar Glowing Frame */}
            <div className="relative shrink-0 group">
              <div
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-[32px] p-0.5 flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #2563eb, #06b6d4, #6366f1)' }}
              >
                <div className={`w-full h-full rounded-[30px] flex items-center justify-center overflow-hidden relative ${
                  isLight ? 'bg-slate-50' : 'bg-[#0a0f1d]'
                }`}>
                  {profile?.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={fullName}
                      width={112}
                      height={112}
                      priority
                      unoptimized
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <span className={`text-3xl font-black tracking-tighter select-none ${
                      isLight ? 'text-blue-400' : 'text-cyan-400/50'
                    }`}>
                      {initials}
                    </span>
                  )}
                </div>
              </div>

              {/* Upload/Camera Overlay controls */}
              <div className="absolute -bottom-1 -right-1 flex gap-1 shadow-lg">
                <button
                  onClick={handleAvatarClick}
                  disabled={uploading}
                  aria-label="Upload Photo"
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50 ${
                    isLight ? 'bg-blue-600 border-white text-white hover:bg-blue-700' : 'bg-indigo-600 border-slate-900 text-white hover:bg-indigo-500'
                  }`}
                >
                  {uploading ? <Loader size={13} className="animate-spin" /> : <Camera size={13} />}
                </button>
                {profile?.avatar_url && (
                  <button
                    onClick={handleDeleteAvatar}
                    disabled={uploading}
                    aria-label="Delete Photo"
                    className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50 ${
                      isLight ? 'bg-red-600 border-white text-white hover:bg-red-700' : 'bg-rose-600 border-slate-900 text-white hover:bg-rose-500'
                    }`}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            {/* Profile Info text */}
            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className={`text-xl sm:text-2xl font-black tracking-tight uppercase italic leading-none ${textStrong}`}>
                  {fullName}
                </h2>
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
                  {faculty}
                </p>
              </div>

              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-1">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                  isLight ? 'bg-green-50 border-green-200 text-green-600' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                  <ShieldCheck size={11} />
                  <span>Ruxsatnoma faol</span>
                </span>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                  isLight ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-blue-500/10 border-blue-500/20 text-cyan-300'
                }`}>
                  <Award size={11} />
                  <span>Namunali talaba</span>
                </span>
              </div>
            </div>
          </div>

          {/* Large dynamic role tag */}
          <div className="mt-4 md:mt-0 flex flex-col md:items-end justify-center self-center shrink-0">
            <span className={`text-[9px] font-black uppercase tracking-widest ${textMuted} mb-1`}>Foydalanuvchi</span>
            <div className={`px-4.5 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-widest ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-gray-300'
            }`}>
              {role}
            </div>
          </div>
        </motion.div>

        {/* 3D Glass Stat Cards Row */}
        <motion.div
          custom={2} variants={fadeUp} initial="hidden" animate="show"
          className="grid grid-cols-3 gap-4"
        >
          {[
            { val: course, label: 'KURS', color: '#60a5fa', desc: 'Bosqich', icon: <GraduationCap size={16} /> },
            { val: group, label: 'GURUH', color: '#34d399', desc: 'Guruh kodi', icon: <Award size={16} /> },
            { val: roomNumber, label: 'XONA', color: '#fcd34d', desc: 'Xona raqami', icon: <Home size={16} /> },
          ].map((s) => (
            <div
              key={s.label}
              className={`border rounded-2xl p-4 text-center relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px] ${cardOverlay}`}
            >
              <div className="flex justify-center mb-1 text-slate-400 opacity-40">{s.icon}</div>
              <p
                className="font-black leading-none mb-1 text-transparent bg-clip-text bg-gradient-to-r"
                style={{
                  backgroundImage: `linear-gradient(to right, ${s.color}, #ffffff)`,
                  fontSize: String(s.val).length > 5 ? '13px' : '22px',
                }}
              >
                {s.val}
              </p>
              <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${textMuted}`}>
                {s.label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Side-by-side Info panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Aloqa Section */}
          <motion.section
            custom={3} variants={fadeUp} initial="hidden" animate="show"
            className={`group border rounded-[28px] p-5 space-y-4 ${cardOverlay}`}
          >
            <h3 className={`text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <Shield size={12} className={isLight ? 'text-blue-600' : 'text-blue-500'} />
              <span>Aloqa Tafsilotlari</span>
            </h3>
            
            <div className="space-y-4">
              <InfoRow
                icon={<Mail size={16} />}
                label="E-mail Manzil"
                value={email}
                bg={isLight ? "rgba(37,99,235,0.08)" : "rgba(59,130,246,0.08)"}
                color={isLight ? "#2563eb" : "#60a5fa"}
              />
              <div className="h-px bg-white/5" />
              <InfoRow
                icon={<Phone size={16} />}
                label="Telefon Raqam"
                value={phone}
                bg={isLight ? "rgba(79,70,229,0.08)" : "rgba(99,102,241,0.08)"}
                color={isLight ? "#4f46e5" : "#a5b4fc"}
              />
            </div>
          </motion.section>

          {/* O'qish Section */}
          <motion.section
            custom={4} variants={fadeUp} initial="hidden" animate="show"
            className={`group border rounded-[28px] p-5 space-y-4 ${cardOverlay}`}
          >
            <h3 className={`text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <Shield size={12} className={isLight ? 'text-emerald-600' : 'text-emerald-500'} />
              <span>O&apos;qish ma&apos;lumotlari</span>
            </h3>
            
            <div className="space-y-4">
              <InfoRow
                icon={<Home size={16} />}
                label="Yashash joyi"
                value={roomNumber}
                bg={isLight ? "rgba(22,163,74,0.08)" : "rgba(16,185,129,0.08)"}
                color={isLight ? "#16a34a" : "#34d399"}
              />
              <div className="h-px bg-white/5" />
              <InfoRow
                icon={<GraduationCap size={16} />}
                label="Bosqich & Guruh"
                value={`${course}-kurs talabasi, ${group}-guruh`}
                bg={isLight ? "rgba(217,119,6,0.08)" : "rgba(245,158,11,0.08)"}
                color={isLight ? "#d97706" : "#fcd34d"}
              />
            </div>
          </motion.section>

        </div>

        {/* Timeline (Ta'lim davri) */}
        <motion.div
          custom={5} variants={fadeUp} initial="hidden" animate="show"
          className={`border rounded-[28px] p-5 ${cardOverlay}`}
        >
          <h3 className={`text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5 mb-5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className={`block w-1.5 h-1.5 rounded-full ${isLight ? 'bg-violet-600' : 'bg-violet-500'}`} />
            <span>Ta&apos;lim olish davri</span>
          </h3>
          <Timeline course={course} isLight={isLight} />
        </motion.div>

        {/* Roommates section */}
        {roommates.length > 0 && (
          <motion.div
            custom={6} variants={fadeUp} initial="hidden" animate="show"
            className={`border rounded-[28px] p-5 space-y-4 ${cardOverlay}`}
          >
            <h3 className={`text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={`block w-1.5 h-1.5 rounded-full ${isLight ? 'bg-emerald-600' : 'bg-emerald-500'}`} />
              <span>Xonadoshlarim ({roommates.length} kishi)</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {roommates.map((roommate) => (
                <RoommateCard key={roommate.id} roommate={roommate} isLight={isLight} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Bottom Actions Row */}
        <motion.div
          custom={roommates.length > 0 ? 7 : 6} variants={fadeUp} initial="hidden" animate="show"
          className="flex gap-3 sm:gap-4"
        >
          <button
            onClick={handleEditOpen}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all duration-200 active:scale-95 shadow-lg ${
              isLight 
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25' 
                : 'bg-white hover:bg-blue-600 text-slate-900 hover:text-white'
            }`}
          >
            <Edit2 size={14} />
            <span>Profilni tahrirlash</span>
          </button>
          
          <button 
            onClick={() => setShowPasswordModal(true)}
            className={`flex items-center justify-center gap-1.5 px-5 sm:px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-wider transition-all duration-200 active:scale-95 ${
              isLight 
                ? 'bg-violet-50 border border-violet-200 text-violet-600 hover:bg-violet-100' 
                : 'bg-violet-500/10 border border-violet-500/25 text-violet-300 hover:bg-violet-500/20'
            }`}
          >
            <Key size={13} />
            <span>Parol</span>
          </button>
        </motion.div>

        {/* Last Activity & Account Info Section */}
        <motion.div
          custom={roommates.length > 0 ? 8 : 7} variants={fadeUp} initial="hidden" animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Oxirgi Faollik */}
          <div className={`border rounded-[28px] p-5 space-y-4 ${cardOverlay}`}>
            <h3 className={`text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <Activity size={12} className={isLight ? 'text-orange-600' : 'text-orange-400'} />
              <span>Oxirgi Faollik</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isLight ? 'bg-green-50' : 'bg-green-500/10'
                }`}>
                  <Clock size={16} className={isLight ? 'text-green-600' : 'text-green-400'} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-0.5 ${textMuted}`}>Oxirgi kirish</p>
                  <p className={`text-xs font-bold truncate ${textStrong}`}>
                    {lastLogin ? formatDate(lastLogin) : 'Ma\'lumot yo\'q'}
                  </p>
                </div>
              </div>

              {lastLogin && (
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isLight ? 'bg-blue-50' : 'bg-blue-500/10'
                  }`}>
                    <Calendar size={16} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-0.5 ${textMuted}`}>Sana va Vaqt</p>
                    <p className={`text-xs font-bold truncate ${textStrong}`}>
                      {formatFullDate(lastLogin)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isLight ? 'bg-emerald-50' : 'bg-emerald-500/10'
                }`}>
                  <ShieldCheck size={16} className={isLight ? 'text-emerald-600' : 'text-emerald-400'} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-0.5 ${textMuted}`}>Hisob holati</p>
                  <p className="text-xs font-bold text-green-500">Faol</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tizim Haqida */}
          <div className={`border rounded-[28px] p-5 space-y-4 ${cardOverlay}`}>
            <h3 className={`text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <Info size={12} className={isLight ? 'text-cyan-600' : 'text-cyan-400'} />
              <span>Tizim Haqida</span>
            </h3>

            <div className="space-y-3">
              <div className={`flex items-center justify-between p-3 rounded-xl border ${
                isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-white/[0.02] border-white/5'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'bg-blue-50' : 'bg-blue-500/10'}`}>
                    <Sparkles size={14} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
                  </div>
                  <div>
                    <p className={`text-[8px] font-black uppercase tracking-widest ${textMuted}`}>Versiya</p>
                    <p className={`text-xs font-bold ${textStrong}`}>1.0.0</p>
                  </div>
                </div>
                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  isLight ? 'bg-green-50 text-green-600' : 'bg-green-500/10 text-green-400'
                }`}>Yangilangan</span>
              </div>

              <button
                onClick={() => window.open('https://t.me/yotoqxona_support', '_blank')}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  isLight ? 'bg-slate-50/70 border-slate-100 hover:bg-slate-100' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'bg-violet-50' : 'bg-violet-500/10'}`}>
                    <HelpCircle size={14} className={isLight ? 'text-violet-600' : 'text-violet-400'} />
                  </div>
                  <div className="text-left">
                    <p className={`text-[8px] font-black uppercase tracking-widest ${textMuted}`}>Yordam</p>
                    <p className={`text-xs font-bold ${textStrong}`}>Qo&apos;llab-quvvatlash</p>
                  </div>
                </div>
                <ChevronRight size={14} className={textMuted} />
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  isLight ? 'bg-red-50/50 border-red-100 hover:bg-red-50' : 'bg-red-500/5 border-red-500/10 hover:bg-red-500/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'bg-red-50' : 'bg-red-500/10'}`}>
                    <Trash2 size={14} className={isLight ? 'text-red-500' : 'text-red-400'} />
                  </div>
                  <div className="text-left">
                    <p className={`text-[8px] font-black uppercase tracking-widest ${isLight ? 'text-red-400' : 'text-red-400/60'}`}>Xavfli</p>
                    <p className={`text-xs font-bold ${isLight ? 'text-red-600' : 'text-red-400'}`}>Hisobni o&apos;chirish</p>
                  </div>
                </div>
                <ChevronRight size={14} className={isLight ? 'text-red-400' : 'text-red-400/60'} />
              </button>
            </div>
          </div>
        </motion.div>

      </div>

      {/* ═══════ Full-Screen Glassmorphism Edit Modal ═══════ */}
      <AnimatePresence>
        {showEditModal && profile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] overflow-y-auto"
          >
            {/* Animated Background */}
            <div className={`fixed inset-0 ${isLight ? 'bg-gradient-to-br from-blue-50/95 via-white/95 to-violet-50/95' : 'bg-[#020409]/95'}`}>
              {!isLight && (
                <>
                  <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/8 blur-[150px] rounded-full animate-pulse" />
                  <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-violet-600/8 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                  <div className="absolute top-[40%] right-[10%] w-[30%] h-[30%] bg-cyan-600/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                </>
              )}
              <div className="absolute inset-0 backdrop-blur-3xl" />
            </div>

            {/* Content */}
            <div className="relative z-10 min-h-screen flex flex-col px-4 sm:px-6 py-6 sm:py-8">
              
              {/* Top Bar */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-between mb-6 sm:mb-8"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{
                      background: isLight
                        ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                        : 'linear-gradient(135deg, #6366f1, #06b6d4)',
                      boxShadow: isLight
                        ? '0 8px 24px rgba(59,130,246,0.3)'
                        : '0 8px 24px rgba(99,102,241,0.3)',
                    }}
                  >
                    <Edit2 size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className={`text-xl sm:text-2xl font-black italic uppercase tracking-tight leading-none ${textStrong}`}>
                      Profilni tahrirlash
                    </h2>
                    <p className={`text-[9px] font-black uppercase tracking-[0.2em] mt-0.5 ${textMuted}`}>
                      Ma&apos;lumotlarni yangilang
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowEditModal(false)}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-200 hover:scale-105 active:scale-95 ${
                    isLight
                      ? 'bg-white/80 backdrop-blur-xl border-slate-200/80 text-slate-600 hover:bg-red-50 hover:text-red-500 hover:border-red-200 shadow-lg'
                      : 'bg-white/5 backdrop-blur-xl border-white/10 text-gray-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                  }`}
                >
                  <X size={18} />
                </button>
              </motion.div>

              {/* Avatar Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className={`rounded-[28px] p-5 sm:p-6 border mb-5 ${
                  isLight
                    ? 'bg-white/60 backdrop-blur-2xl border-white/80 shadow-xl shadow-black/5'
                    : 'bg-white/[0.03] backdrop-blur-2xl border-white/[0.06] shadow-2xl'
                }`}
                style={{
                  boxShadow: !isLight
                    ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 40px rgba(0,0,0,0.3)'
                    : undefined,
                }}
              >
                <p className={`text-[9px] font-black uppercase tracking-[0.22em] mb-4 flex items-center gap-1.5 ${textMuted}`}>
                  <Camera size={11} className={isLight ? 'text-blue-500' : 'text-cyan-400'} />
                  Profil surati
                </p>

                <div className="flex items-center gap-5">
                  {/* Avatar with gradient frame */}
                  <div className="relative shrink-0 group">
                    <div
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-[24px] p-[3px] transition-transform duration-300 group-hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)',
                        boxShadow: isLight
                          ? '0 12px 30px rgba(99,102,241,0.2)'
                          : '0 12px 30px rgba(99,102,241,0.15), 0 0 60px rgba(99,102,241,0.08)',
                      }}
                    >
                      <div className={`w-full h-full rounded-[21px] flex items-center justify-center overflow-hidden ${
                        isLight ? 'bg-white' : 'bg-[#0a0f1d]'
                      }`}>
                        {profile?.avatar_url ? (
                          <Image
                            key={`${profile.avatar_url}-modal`}
                            src={profile.avatar_url}
                            alt="Avatar preview"
                            width={96}
                            height={96}
                            unoptimized
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className={`text-2xl font-black select-none ${
                            isLight ? 'text-blue-300' : 'text-cyan-400/40'
                          }`}>
                            {getInitials(profile?.full_name || '')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Upload Actions */}
                  <div className="flex flex-col gap-2 flex-1">
                    <button
                      onClick={handleAvatarClick}
                      disabled={uploading}
                      className={`w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${
                        isLight
                          ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30'
                          : 'bg-gradient-to-r from-blue-600/80 to-violet-600/80 text-white border border-white/10 shadow-lg shadow-blue-500/10 hover:from-blue-500 hover:to-violet-500'
                      }`}
                    >
                      {uploading ? <Loader size={13} className="animate-spin" /> : <Camera size={13} />}
                      <span>{uploading ? 'Yuklanyapti...' : 'Rasm yuklash'}</span>
                    </button>

                    {profile?.avatar_url && (
                      <button
                        onClick={handleDeleteAvatar}
                        disabled={uploading}
                        className={`w-full px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${
                          isLight
                            ? 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'
                            : 'bg-red-500/10 border border-red-500/15 text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        <Trash2 size={12} />
                        <span>Rasmni o&apos;chirish</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Form Fields Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`rounded-[28px] p-5 sm:p-6 border flex-1 ${
                  isLight
                    ? 'bg-white/60 backdrop-blur-2xl border-white/80 shadow-xl shadow-black/5'
                    : 'bg-white/[0.03] backdrop-blur-2xl border-white/[0.06] shadow-2xl'
                }`}
                style={{
                  boxShadow: !isLight
                    ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 40px rgba(0,0,0,0.3)'
                    : undefined,
                }}
              >
                <p className={`text-[9px] font-black uppercase tracking-[0.22em] mb-5 flex items-center gap-1.5 ${textMuted}`}>
                  <Shield size={11} className={isLight ? 'text-violet-500' : 'text-violet-400'} />
                  Shaxsiy ma&apos;lumotlar
                </p>

                <div className="space-y-4">
                  {[
                    { key: 'full_name', label: "To'liq ism", placeholder: "Ism va familiya", icon: <Award size={15} /> },
                    { key: 'phone', label: 'Telefon raqam', placeholder: '+998 90 123 45 67', icon: <Phone size={15} /> },
                    { key: 'faculty', label: 'Fakultet', placeholder: 'Dasturiy Injiniring', icon: <GraduationCap size={15} /> },
                    { key: 'group', label: 'Guruh raqami', placeholder: '412', icon: <Shield size={15} /> },
                    { key: 'room_number', label: 'Xona raqami', placeholder: '204-xona', icon: <Home size={15} /> },
                  ].map(({ key, label, placeholder, icon }, idx) => (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + idx * 0.05 }}
                    >
                      <label className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] mb-2 ${textMuted}`}>
                        <span className={`${isLight ? 'text-blue-500' : 'text-cyan-400'}`}>{icon}</span>
                        {label}
                      </label>
                      <input
                        type="text"
                        placeholder={placeholder}
                        value={editForm[key as keyof Profile] || ''}
                        onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                        className={`w-full px-4 py-3.5 rounded-2xl border text-sm outline-none transition-all duration-200 font-semibold ${
                          isLight
                            ? 'bg-white/80 backdrop-blur-xl border-slate-200/80 text-slate-900 focus:border-blue-400 focus:bg-white focus:shadow-lg focus:shadow-blue-500/10 placeholder:text-slate-300'
                            : 'bg-white/[0.04] backdrop-blur-xl border-white/[0.06] text-white focus:border-blue-500/40 focus:bg-white/[0.08] focus:shadow-lg focus:shadow-blue-500/5 placeholder:text-slate-600'
                        }`}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Bottom Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex gap-3 mt-5 pb-2"
              >
                <button
                  onClick={() => setShowEditModal(false)}
                  className={`flex-1 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
                    isLight
                      ? 'bg-white/70 backdrop-blur-xl border border-slate-200/80 text-slate-600 hover:bg-white shadow-lg shadow-black/5'
                      : 'bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] text-gray-400 hover:bg-white/[0.08]'
                  }`}
                >
                  <X size={14} />
                  <span>Bekor qilish</span>
                </button>

                <button
                  onClick={handleEditSave}
                  disabled={savingEdit}
                  className="flex-1 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xl"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    boxShadow: '0 12px 30px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                >
                  {savingEdit ? <Loader size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>{savingEdit ? 'Saqlanmoqda...' : 'Saqlash'}</span>
                </button>
              </motion.div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Password Change Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto" onClick={() => setShowPasswordModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`rounded-[36px] p-6 sm:p-7 w-full max-w-md my-auto shadow-2xl relative border ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#0b1120] border-white/5'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isLight ? 'bg-violet-100' : 'bg-violet-500/15'
                  }`}>
                    <Key size={18} className={isLight ? 'text-violet-600' : 'text-violet-400'} />
                  </div>
                  <div>
                    <h2 className={`text-lg font-black italic uppercase tracking-tight ${textStrong}`}>
                      Parolni o&apos;zgartirish
                    </h2>
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${textMuted}`}>Xavfsizlik sozlamalari</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPasswordModal(false)} 
                  className={`p-2 rounded-xl transition-all ${isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/5 text-gray-400'}`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Password Fields */}
              <div className="space-y-4">
                {/* New Password */}
                <div>
                  <label className={`block text-[9px] font-black uppercase tracking-widest mb-1.5 ${textMuted}`}>
                    Yangi parol
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      placeholder="Yangi parolni kiriting"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`w-full px-4 py-3 pr-12 rounded-xl border text-xs outline-none transition-all font-semibold ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-violet-500 focus:bg-white shadow-inner'
                          : 'bg-white/5 border-white/5 text-white focus:border-violet-500/50 focus:bg-white/10'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${
                        isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Indicator */}
                {newPassword.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className="flex-1 h-1.5 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: passwordStrength >= level ? strengthColor : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)'),
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: strengthColor }}>
                        {strengthLabel}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { key: 'length', label: '8+ belgi' },
                        { key: 'upper', label: 'Katta harf' },
                        { key: 'lower', label: 'Kichik harf' },
                        { key: 'number', label: 'Raqam' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-1">
                          {passwordChecks[key as keyof typeof passwordChecks] ? (
                            <Check size={10} className="text-green-500" />
                          ) : (
                            <X size={10} className={textMuted} />
                          )}
                          <span className={`text-[9px] font-semibold ${
                            passwordChecks[key as keyof typeof passwordChecks] ? 'text-green-500' : textMuted
                          }`}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confirm Password */}
                <div>
                  <label className={`block text-[9px] font-black uppercase tracking-widest mb-1.5 ${textMuted}`}>
                    Parolni tasdiqlash
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      placeholder="Parolni qayta kiriting"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className={`w-full px-4 py-3 pr-12 rounded-xl border text-xs outline-none transition-all font-semibold ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-violet-500 focus:bg-white shadow-inner'
                          : 'bg-white/5 border-white/5 text-white focus:border-violet-500/50 focus:bg-white/10'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${
                        isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {showConfirmPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
                    <p className="text-[9px] font-bold text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle size={10} />
                      Parollar mos kelmaydi
                    </p>
                  )}
                  {confirmNewPassword.length > 0 && newPassword === confirmNewPassword && (
                    <p className="text-[9px] font-bold text-green-500 mt-1 flex items-center gap-1">
                      <Check size={10} />
                      Parollar mos keldi
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-7">
                <button
                  onClick={() => {
                    setShowPasswordModal(false)
                    setNewPassword('')
                    setConfirmNewPassword('')
                  }}
                  className={`flex-1 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  ✕ Bekor qilish
                </button>
                
                <button
                  onClick={handlePasswordChange}
                  disabled={changingPassword || !newPassword || !confirmNewPassword || newPassword !== confirmNewPassword}
                  className="flex-1 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center gap-1.5 shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {changingPassword ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{changingPassword ? 'Saqlanmoqda...' : 'Saqlash'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Delete Account Confirmation Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" onClick={() => setShowDeleteConfirm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className={`rounded-[28px] p-6 sm:p-7 w-full max-w-sm shadow-2xl relative border ${
                isLight ? 'bg-white border-red-100' : 'bg-[#0b1120] border-red-500/10'
              }`}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  isLight ? 'bg-red-50' : 'bg-red-500/10'
                }`}>
                  <AlertTriangle size={28} className={isLight ? 'text-red-500' : 'text-red-400'} />
                </div>
                
                <div>
                  <h3 className={`text-lg font-black uppercase tracking-tight ${textStrong}`}>Hisobni o&apos;chirish</h3>
                  <p className={`text-xs mt-2 leading-relaxed ${textMuted}`}>
                    Bu amalni qaytarib bo&apos;lmaydi. Barcha ma&apos;lumotlaringiz butunlay o&apos;chiriladi. Davom etishni xohlaysizmi?
                  </p>
                </div>

                <div className="flex gap-3 w-full pt-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
                      isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    Bekor qilish
                  </button>
                  <button
                    onClick={async () => {
                      setMessage({ type: 'error', text: 'Hisobni o\'chirish uchun administratorga murojaat qiling' })
                      setShowDeleteConfirm(false)
                      setTimeout(() => setMessage(null), 5000)
                    }}
                    className="flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 transition-all"
                  >
                    O&apos;chirish
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
