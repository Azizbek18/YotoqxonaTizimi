'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { 
  Users, Megaphone, LogOut, Search, Clock, 
  Trash2, Plus, Sparkles, Building2, Phone, Mail, 
  ArrowLeft, ShieldCheck, X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSafeUser, getAuthHeaders } from '@/lib/auth-session'
import { useThemeStore } from '@/lib/stores/theme-store'
import Link from 'next/link'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { fetchStudentProfile } from '@/features/profile/client/api'

interface Student {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  room_number: string | null
  faculty: string | null
  course: number | null
  group: string | null
  avatar_url: string | null
  gender: string
}

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
  gender: string
  assigned_floor: number | null
  is_floor_captain: boolean
  room_number: string | null
  faculty?: string | null
}

interface Elon {
  id: string
  title: string
  text: string
  type: 'Yangilik' | 'Ogohlantirish' | 'Muhim' | 'Tadbir'
  created_at: string
}

export default function SardorDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [elonlar, setElonlar] = useState<Elon[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'students' | 'elonlar' | 'navbatchilik'>('students')

  // Search and Filter States
  const [studentSearch, setStudentSearch] = useState('')
  const [newElonOpen, setNewElonOpen] = useState(false)
  const deleteElonModal = useConfirmModal<string>()
  const [newElonForm, setNewElonForm] = useState({
    title: '',
    text: '',
    type: 'Yangilik' as Elon['type']
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Navbatchilik States
  const [dutySchedule, setDutySchedule] = useState<Record<string, Array<{ id: string; name: string; room: string }>>>({
    Dushanba: [], Seshanba: [], Chorshanba: [], Payshanba: [], Juma: [], Shanba: [], Yakshanba: []
  })
  const [dutyAdmins, setDutyAdmins] = useState<Array<{ id: string; name: string; room: string }>>([])
  const [savingDuty, setSavingDuty] = useState(false)
  const [dutyElonId, setDutyElonId] = useState<string | null>(null)
  const [activeSelectDay, setActiveSelectDay] = useState<string | null>(null)
  const [activeSelectAdmin, setActiveSelectAdmin] = useState(false)

  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const surfaceBg = isLight ? 'bg-white/80 border-slate-200 shadow-lg' : 'bg-[#0b1120]/50 border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.05)]'
  const cardBg = isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-white/[0.04] border-white/5'
  const cardBorder = isLight ? 'border-slate-200' : 'border-white/5'

  // Load Dashboard Data
  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const user = await getSafeUser()
      if (!user) {
        toast.error("Tizimga kirish talab etiladi")
        window.location.href = '/login'
        return
      }

      // Fetch student profile
      const { profile: profileData } = await fetchStudentProfile()

      if (!profileData || !profileData.is_floor_captain) {
        toast.error("Ruxsat berilmagan! Siz qavat sardori emassiz.")
        window.location.href = '/talaba/dashboard'
        return
      }

      setProfile(profileData as Profile)

      const authHeader = await getAuthHeaders()

      // Fetch students under captain scope
      const resStudents = await fetch('/api/sardor/students', {
        headers: authHeader
      })
      const resultStudents = await resStudents.json()
      if (resStudents.ok && Array.isArray(resultStudents.students)) {
        setStudents(resultStudents.students)
      } else {
        throw new Error(resultStudents.error || 'Talabalarni yuklashda xato')
      }

      // Fetch announcements sent by captain
      const resElon = await fetch('/api/sardor/elonlar', {
        headers: authHeader
      })
      const resultElon = await resElon.json()
      if (resElon.ok && Array.isArray(resultElon.elonlar)) {
        setElonlar(resultElon.elonlar)
        if (resultElon.dutySchedule) {
          setDutySchedule({
            Dushanba: [], Seshanba: [], Chorshanba: [], Payshanba: [], Juma: [], Shanba: [], Yakshanba: [],
            ...(resultElon.dutySchedule.schedule || {})
          })
          setDutyAdmins(Array.isArray(resultElon.dutySchedule.admins) ? resultElon.dutySchedule.admins : [])
          setDutyElonId(resultElon.dutySchedule.id || null)
        }
      } else {
        throw new Error(resultElon.error || "E'lonlarni yuklashda xato")
      }
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Yuklashda xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    loadDashboardData()
  }, [])

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.room_number?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.group?.toLowerCase().includes(studentSearch.toLowerCase())
    )
  }, [students, studentSearch])

  // Create Announcement
  const handleCreateElon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newElonForm.title || !newElonForm.text) {
      toast.error("Sarlavha va matnni to'ldiring")
      return
    }

    try {
      setIsSubmitting(true)
      const authHeader = await getAuthHeaders()

      const res = await fetch('/api/sardor/elonlar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify(newElonForm)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "E'lon yuborishda xato")

      toast.success("E'lon muvaffaqiyatli chop etildi!")
      setElonlar(prev => [data.elon, ...prev])
      setNewElonOpen(false)
      setNewElonForm({ title: '', text: '', type: 'Yangilik' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete Announcement
  const handleDeleteElon = (id: string) => {
    deleteElonModal.open(id)
  }

  const confirmDeleteElon = async () => {
    const id = deleteElonModal.target
    if (!id) return

    deleteElonModal.setIsLoading(true)
    try {
      const authHeader = await getAuthHeaders()

      const res = await fetch(`/api/sardor/elonlar?id=${id}`, {
        method: 'DELETE',
        headers: authHeader
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "O'chirishda xatolik")
      }

      toast.success("E'lon o'chirildi")
      setElonlar(prev => prev.filter(e => e.id !== id))
      deleteElonModal.close()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi")
    } finally {
      deleteElonModal.setIsLoading(false)
    }
  }

  // Save Duty Schedule
  const handleSaveDuty = async () => {
    try {
      setSavingDuty(true)
      const authHeader = await getAuthHeaders()
      const response = await fetch('/api/sardor/elonlar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ schedule: dutySchedule, admins: dutyAdmins }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Navbatchilik jadvalini saqlab bo‘lmadi')
      setDutyElonId(result.id)
      toast.success(dutyElonId
        ? "Navbatchilik jadvali muvaffaqiyatli yangilandi!"
        : "Navbatchilik jadvali muvaffaqiyatli yaratildi va saqlandi!")
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Saqlashda xatolik yuz berdi")
    } finally {
      setSavingDuty(false)
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b13] text-white">
        <div className="relative w-16 h-16 animate-spin">
          <div className="absolute inset-0 rounded-full border-t-2 border-purple-500" />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b13] text-white">
        <div className="relative w-16 h-16 animate-spin">
          <div className="absolute inset-0 rounded-full border-t-2 border-purple-500" />
        </div>
      </div>
    )
  }

  const genderLabel = profile?.gender === 'Ayol' ? 'Qizlar' : 'Yigitlar'

  return (
    <div className="min-h-screen bg-[#070b13] text-white py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/talaba/dashboard" 
            className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition-all flex items-center justify-center"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-400">
              <ShieldCheck size={12} />
              {profile?.assigned_floor}-qavat sardori ({genderLabel})
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-2 flex items-center gap-2">
              {profile?.full_name} <Sparkles size={20} className="text-yellow-400" />
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {profile?.assigned_floor}-qavat {genderLabel.toLowerCase()} talabalarini boshqarish va e&apos;lonlar yuborish
            </p>
          </div>
        </div>

        <Link
          href="/talaba/dashboard"
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap"
        >
          <LogOut size={14} />
          Talaba paneliga qaytish
        </Link>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1.5 rounded-2xl bg-white/[0.03] border border-white/5 w-full sm:w-fit shrink-0">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'students'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/10'
              : 'text-slate-400 hover:bg-white/5'
          }`}
        >
          <Users size={14} />
          Talabalar ({students.length})
        </button>
        <button
          onClick={() => setActiveTab('elonlar')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'elonlar'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/10'
              : 'text-slate-400 hover:bg-white/5'
          }`}
        >
          <Megaphone size={14} />
          Mening E&apos;lonlarim ({elonlar.length})
        </button>
        <button
          onClick={() => setActiveTab('navbatchilik')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'navbatchilik'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/10'
              : 'text-slate-400 hover:bg-white/5'
          }`}
        >
          <Clock size={14} />
          Navbatchilik
        </button>
      </div>

      {/* Main Tab Panels */}
      <AnimatePresence mode="wait">
        {activeTab === 'students' ? (
          <motion.div
            key="students"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Search Input */}
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ism, xona yoki guruh bo'yicha qidirish..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full border rounded-2xl py-3.5 pl-11 pr-4 bg-white/5 border-white/5 text-white placeholder:text-gray-500 focus:border-purple-500/30 outline-none text-xs sm:text-sm transition-all"
              />
            </div>

            {/* Students Grid */}
            {filteredStudents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStudents.map((student) => {
                  const initials = student.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'ST'
                  return (
                    <div 
                      key={student.id} 
                      className={`backdrop-blur-xl border rounded-3xl p-5 ${surfaceBg} flex flex-col justify-between gap-5 relative overflow-hidden`}
                    >
                      <div className="absolute right-[-10%] top-[-10%] w-[35%] h-[35%] rounded-full blur-[50px] bg-purple-500/5" />
                      <div className="relative z-10 flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-base">
                          {initials}
                        </div>
                        <div>
                          <h4 className="text-base font-black tracking-tight leading-tight">{student.full_name}</h4>
                          <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider mt-1 flex items-center gap-1">
                            <Building2 size={10} /> Xona #{student.room_number || 'Biriktirilmagan'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs text-slate-400 border-t border-white/5 pt-4">
                        <div className="flex justify-between">
                          <span>Fakultet:</span>
                          <span className="font-bold text-white max-w-[160px] truncate">{student.faculty || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Guruh:</span>
                          <span className="font-bold text-white">{student.group || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Kurs:</span>
                          <span className="font-bold text-white">{student.course || '—'}-kurs</span>
                        </div>
                      </div>

                      <div className="flex gap-2 border-t border-white/5 pt-4">
                        {student.phone_number ? (
                          <a
                            href={`tel:${student.phone_number}`}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-xs font-bold transition-all"
                          >
                            <Phone size={12} />
                            Qo&apos;ng&apos;iroq qilish
                          </a>
                        ) : (
                          <div className="flex-1 text-center py-2.5 text-[10px] text-slate-500 italic font-semibold">
                            Telefon raqami yo&apos;q
                          </div>
                        )}
                        <a
                          href={`mailto:${student.email}`}
                          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all flex items-center justify-center"
                        >
                          <Mail size={12} />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-white/10 rounded-3xl">
                <Users size={32} className="mx-auto text-slate-500 mb-2" />
                <p className="text-sm text-slate-400">Hech qanday talaba topilmadi</p>
              </div>
            )}
          </motion.div>
        ) : activeTab === 'elonlar' ? (
          <motion.div
            key="elonlar"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Header / Add Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-black tracking-tight">Mening Qavatim E&apos;lonlari</h3>
                <p className="text-xs text-slate-400 mt-0.5">Faqat sizning qavatingizdagi {genderLabel.toLowerCase()}ga ko&apos;rinadigan xabarnomalar</p>
              </div>
              <button
                onClick={() => setNewElonOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-purple-500/20 whitespace-nowrap w-full sm:w-auto"
              >
                <Plus size={16} />
                Yangi E&apos;lon
              </button>
            </div>

            {/* List of Announcements */}
            {elonlar.length > 0 ? (
              <div className="space-y-4">
                {elonlar.map((elon) => {
                  const typeStyles = 
                    elon.type === 'Muhim' 
                      ? { border: 'border-l-rose-500', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' } :
                    elon.type === 'Tadbir' 
                      ? { border: 'border-l-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' } :
                    elon.type === 'Ogohlantirish' 
                      ? { border: 'border-l-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' } :
                      { border: 'border-l-cyan-500', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' };

                  return (
                    <div 
                      key={elon.id} 
                      className={`relative overflow-hidden rounded-2xl border-l-[6px] border border-y-transparent border-r-transparent p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${typeStyles.border} ${
                        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/5'
                      }`}
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${typeStyles.badge}`}>
                            {elon.type}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                            <Clock size={11} /> {new Date(elon.created_at).toLocaleDateString('uz-UZ')}
                          </span>
                        </div>
                        <h4 className="text-base font-extrabold tracking-tight">{elon.title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">{elon.text}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteElon(elon.id)}
                        className="p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all flex items-center justify-center shrink-0 self-end md:self-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-white/10 rounded-3xl">
                <Megaphone size={32} className="mx-auto text-slate-500 mb-2" />
                <p className="text-sm text-slate-400">Hozircha hech qanday e&apos;lon chop etilmagan</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="navbatchilik"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Header / Save Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-black tracking-tight">Qavat Navbatchilik Jadvali</h3>
                <p className="text-xs text-slate-400 mt-0.5">Ushbu jadval qavatingizdagi barcha talabalar uchun hafta kunlariga navbatchilarni belgilash imkonini beradi</p>
              </div>
              <button
                onClick={handleSaveDuty}
                disabled={savingDuty}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-purple-500/20 disabled:opacity-55 whitespace-nowrap w-full sm:w-auto"
              >
                <ShieldCheck size={16} />
                {savingDuty ? 'Saqlanmoqda...' : 'Jadvalni Saqlash'}
              </button>
            </div>

            {/* Grid layout for Schedule and Admin assignment */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Admin and Controls */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Duty Admins Section */}
                <div className={`backdrop-blur-xl border rounded-3xl p-5 ${surfaceBg}`}>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
                      <ShieldCheck size={16} />
                      Yordamchi Adminlar
                    </h4>
                    <button
                      onClick={() => {
                        setActiveSelectAdmin(true);
                        setActiveSelectDay(null);
                      }}
                      className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 transition-all flex items-center justify-center"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {dutyAdmins.length > 0 ? (
                    <div className="space-y-2">
                      {dutyAdmins.map((admin) => (
                        <div key={admin.id} className={`flex justify-between items-center p-3 rounded-xl ${cardBg} border ${cardBorder}`}>
                          <div>
                            <p className="text-xs font-extrabold text-white">{admin.name}</p>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Xona #{admin.room}</p>
                          </div>
                          <button
                            onClick={() => setDutyAdmins(prev => prev.filter(a => a.id !== admin.id))}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 transition-all"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-dashed border-white/5 rounded-2xl">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hozircha adminlar yo&apos;q</p>
                    </div>
                  )}
                </div>

                {/* Info Card */}
                <div className={`backdrop-blur-xl border rounded-3xl p-5 ${surfaceBg} relative overflow-hidden`}>
                  <div className="absolute right-[-10%] top-[-10%] w-[35%] h-[35%] rounded-full blur-[40px] bg-purple-500/5" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-400 mb-2">Qanday ishlaydi?</h4>
                  <ul className="space-y-2 text-[11px] text-slate-400 leading-relaxed font-semibold">
                    <li className="flex items-start gap-1.5">
                      <span className="text-purple-400">•</span>
                      <span>Qavat talabalarini haftaning istalgan kuniga navbatchi qilib belgilang.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-purple-400">•</span>
                      <span>Bir kunga istalgancha navbatchi qo&apos;shish mumkin.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-purple-400">•</span>
                      <span>O&apos;zgarishlar barcha talabalarda ko&apos;rinishi uchun yuqoridagi <b>Jadvalni Saqlash</b> tugmasini bosing.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Right Column: 7 Days Grid */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'].map((day) => {
                  const dayDuties = dutySchedule[day] || [];
                  return (
                    <div 
                      key={day} 
                      className={`backdrop-blur-xl border rounded-3xl p-5 ${surfaceBg} transition-all duration-300 hover:border-purple-500/20 relative overflow-hidden flex flex-col justify-between`}
                    >
                      <div className="absolute right-[-10%] top-[-10%] w-[30%] h-[30%] rounded-full blur-[35px] bg-purple-500/3" />
                      
                      <div className="relative z-10 flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-purple-500 to-indigo-500" />
                          <h4 className="text-sm font-black text-white">{day}</h4>
                        </div>
                        <button
                          onClick={() => {
                            setActiveSelectDay(day);
                            setActiveSelectAdmin(false);
                          }}
                          className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 transition-all flex items-center justify-center"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="relative z-10 flex-1 space-y-2 min-h-[100px]">
                        {dayDuties.length > 0 ? (
                          dayDuties.map((duty) => (
                            <div key={duty.id} className={`flex justify-between items-center p-2.5 rounded-xl ${cardBg} border ${cardBorder} hover:bg-white/[0.06] transition-all`}>
                              <div>
                                <p className="text-[11px] font-black text-white">{duty.name}</p>
                                <p className="text-[9px] text-slate-500 font-semibold mt-0.5">Xona #{duty.room}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setDutySchedule(prev => ({
                                    ...prev,
                                    [day]: (prev[day] || []).filter(d => d.id !== duty.id)
                                  }));
                                }}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 transition-all"
                              >
                                <X size={9} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex items-center justify-center py-6 border border-dashed border-white/5 rounded-2xl">
                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">Navbatchi belgilanmagan</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Selection Modals/Popovers for adding students */}
            <AnimatePresence>
              {(activeSelectDay || activeSelectAdmin) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-[2rem] border border-white/10 bg-[#0b1120] p-4 sm:p-8 space-y-5 sm:space-y-6 shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute right-[-10%] top-[-10%] w-[50%] h-[50%] rounded-full blur-[80px] bg-purple-500/10" />

                    <div className="relative z-10 flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-black tracking-tight">
                          {activeSelectAdmin ? "Yordamchi Admin Qo\u2019shish" : `${activeSelectDay} uchun Navbatchi`}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Qavatdagi talabalar orasidan tanlang</p>
                      </div>
                      <button 
                        onClick={() => {
                          setActiveSelectDay(null);
                          setActiveSelectAdmin(false);
                        }}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 transition-all"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="relative z-10 max-h-[300px] overflow-y-auto space-y-2 pr-2">
                      {students.map((student) => {
                        const isAdded = activeSelectAdmin 
                          ? dutyAdmins.some(a => a.id === student.id)
                          : (dutySchedule[activeSelectDay!] || []).some(d => d.id === student.id);

                        return (
                          <button
                            key={student.id}
                            disabled={isAdded}
                            onClick={() => {
                              const newMember = {
                                id: student.id,
                                name: student.full_name,
                                room: student.room_number || '—'
                              };
                              if (activeSelectAdmin) {
                                setDutyAdmins(prev => [...prev, newMember]);
                                setActiveSelectAdmin(false);
                              } else {
                                const day = activeSelectDay!;
                                setDutySchedule(prev => ({
                                  ...prev,
                                  [day]: [...(prev[day] || []), newMember]
                                }));
                                setActiveSelectDay(null);
                              }
                            }}
                            className={`w-full flex justify-between items-center p-3 rounded-xl border text-left transition-all ${
                              isAdded 
                                ? 'bg-white/3 border-transparent opacity-40 cursor-not-allowed' 
                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/20'
                            }`}
                          >
                            <div>
                              <p className="text-xs font-extrabold text-white">{student.full_name}</p>
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Xona #{student.room_number || '—'} · Guruh: {student.group || '—'}</p>
                            </div>
                            {isAdded && (
                              <span className="text-[8px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/25 px-2 py-0.5 rounded-md">
                                Qo&apos;shilgan
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Announcement Modal */}
      <AnimatePresence>
        {newElonOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0b1120] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute right-[-10%] top-[-10%] w-[50%] h-[50%] rounded-full blur-[80px] bg-purple-500/10" />
              
              <div className="relative z-10">
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <Megaphone size={20} className="text-purple-400" />
                  Yangi E&apos;lon Chop Etish
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ushbu e&apos;lon faqat {profile?.assigned_floor}-qavat {genderLabel.toLowerCase()} talabalariga yuboriladi.
                </p>
              </div>

              <form onSubmit={handleCreateElon} className="relative z-10 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Mavzu / Sarlavha</label>
                  <input
                    type="text"
                    required
                    value={newElonForm.title}
                    onChange={(e) => setNewElonForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition-all focus:border-purple-500/50 outline-none text-sm"
                    placeholder="Masalan: Qavat tozalik qoidalari"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Turi / Toifa</label>
                  <select
                    value={newElonForm.type}
                    onChange={(e) => setNewElonForm(prev => ({ ...prev, type: e.target.value as Elon['type'] }))}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-white transition-all focus:border-purple-500/50 outline-none text-sm"
                  >
                    <option value="Yangilik">Yangilik</option>
                    <option value="Ogohlantirish">Ogohlantirish</option>
                    <option value="Muhim">Muhim</option>
                    <option value="Tadbir">Tadbir</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">E&apos;lon Matni</label>
                  <textarea
                    required
                    rows={4}
                    value={newElonForm.text}
                    onChange={(e) => setNewElonForm(prev => ({ ...prev, text: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition-all focus:border-purple-500/50 outline-none text-sm resize-none"
                    placeholder="E'lon tafsilotlarini batafsil kiriting..."
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setNewElonOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-wider transition-all"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-purple-500/20 disabled:opacity-55"
                  >
                    {isSubmitting ? 'Chop etilmoqda...' : 'Chop etish'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Announcement Confirm Modal */}
      <ConfirmModal
        isOpen={deleteElonModal.isOpen}
        title="E'lonni o'chirish"
        description="Ushbu e'lonni o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi."
        onClose={deleteElonModal.close}
        onConfirm={confirmDeleteElon}
        confirmText="O'chirish"
        confirmVariant="danger"
        isLoading={deleteElonModal.isLoading}
      />
    </div>
  )
}
