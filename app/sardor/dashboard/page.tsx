'use client'

import React, { useEffect, useState, useMemo } from 'react'
import {
  Users, Megaphone, Search, Clock,
  Trash2, Plus, Building2, Phone, Mail,
  ShieldCheck, X, ClipboardCheck, ChevronRight, ShieldHalf,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { getSafeUser, getAuthHeaders } from '@/lib/auth-session'
import Link from 'next/link'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CustomSelect from '@/components/ui/CustomSelect'
import { SkelPage } from '@/components/ui/skeletons'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useMyCaptainPermissions } from '@/lib/hooks/useMyCaptainPermissions'
import { fetchStudentProfile } from '@/features/profile/client/api'
import LeaderBackdrop from '@/components/leader/LeaderBackdrop'
import LeaderHeader from '@/components/leader/LeaderHeader'
import LeaderTabs, { type LeaderTab } from '@/components/leader/LeaderTabs'
import SectionHeading from '@/components/leader/SectionHeading'
import EmptyState from '@/components/leader/EmptyState'
import ModalShell from '@/components/leader/ModalShell'
import { glassCard, leaderTheme } from '@/components/leader/leader-theme'

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

const listStagger = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } }
const cardIn = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }

function initialsOf(name: string) {
  return name?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'ST'
}

export default function SardorDashboard() {
  const router = useRouter()
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

  // Dekan-tunable rights (Sozlamalar → Ruxsatlar): a revoked one closes the
  // matching tab/action here, matching what the API already answers 403 for.
  const { allows, permissions } = useMyCaptainPermissions()

  const t = leaderTheme.sardor

  // Load Dashboard Data
  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const user = await getSafeUser()
      if (!user) {
        toast.error("Tizimga kirish talab etiladi")
        router.replace('/login')
        return
      }

      // Fetch student profile
      const { profile: profileData } = await fetchStudentProfile()

      if (!profileData || !profileData.is_floor_captain) {
        toast.error("Ruxsat berilmagan! Siz qavat sardori emassiz.")
        router.replace('/talaba/dashboard')
        return
      }

      setProfile(profileData as Profile)

      const authHeader = await getAuthHeaders()

      // Students and announcements load independently: the dekan can revoke
      // either right on its own (Sozlamalar → Ruxsatlar), and a captain
      // missing one must still get a working panel for the other, not a
      // dashboard that fails to load entirely over a single 403.
      await Promise.all([
        (async () => {
          try {
            const res = await fetch('/api/sardor/students', { headers: authHeader })
            const result = await res.json()
            if (!res.ok) {
              if (result?.code !== 'PERMISSION_REVOKED') throw new Error(result.error || 'Talabalarni yuklashda xato')
              return
            }
            if (Array.isArray(result.students)) setStudents(result.students)
          } catch (err) {
            console.error(err)
            toast.error(err instanceof Error ? err.message : 'Talabalarni yuklashda xatolik yuz berdi')
          }
        })(),
        (async () => {
          try {
            const res = await fetch('/api/sardor/elonlar', { headers: authHeader })
            const result = await res.json()
            if (!res.ok) {
              if (result?.code !== 'PERMISSION_REVOKED') throw new Error(result.error || "E'lonlarni yuklashda xato")
              return
            }
            if (Array.isArray(result.elonlar)) setElonlar(result.elonlar)
            if (result.dutySchedule) {
              setDutySchedule({
                Dushanba: [], Seshanba: [], Chorshanba: [], Payshanba: [], Juma: [], Shanba: [], Yakshanba: [],
                ...(result.dutySchedule.schedule || {})
              })
              setDutyAdmins(Array.isArray(result.dutySchedule.admins) ? result.dutySchedule.admins : [])
              setDutyElonId(result.dutySchedule.id || null)
            }
          } catch (err) {
            console.error(err)
            toast.error(err instanceof Error ? err.message : "E'lonlarni yuklashda xatolik yuz berdi")
          }
        })(),
      ])
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; loadDashboardData isn't memoized
  }, [])

  // The default tab is "Talabalar" — if the dekan has revoked that right,
  // once we actually know (permissions !== null) hop to a tab that's there.
  useEffect(() => {
    if (activeTab === 'students' && !allows('students.view')) setActiveTab('elonlar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, permissions])

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

  if (!mounted || loading) {
    return (
      <div className="relative min-h-screen bg-[#070b13]">
        <LeaderBackdrop role="sardor" />
        <div className="relative z-10 px-4 py-8 sm:px-6 lg:px-8">
          <SkelPage />
        </div>
      </div>
    )
  }

  const genderLabel = profile?.gender === 'Ayol' ? 'Qizlar' : 'Yigitlar'
  const dutyFilled = Object.values(dutySchedule).filter((d) => d.length > 0).length

  const tabs: LeaderTab[] = [
    ...(allows('students.view') ? [{ key: 'students', label: 'Talabalar', icon: Users, count: students.length }] : []),
    { key: 'elonlar', label: "E'lonlarim", icon: Megaphone, count: elonlar.length },
    { key: 'navbatchilik', label: 'Navbatchilik', icon: Clock, count: dutyFilled },
  ]

  return (
    <div className="relative min-h-screen bg-[#070b13] text-white">
      <LeaderBackdrop role="sardor" />
      <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <LeaderHeader
          role="sardor"
          icon={ShieldHalf}
          badgeText={`${profile?.assigned_floor ?? '—'}-qavat sardori · ${genderLabel}`}
          name={profile?.full_name ?? ''}
          subtitle={`${profile?.assigned_floor ?? '—'}-qavat ${genderLabel.toLowerCase()} talabalarini boshqarish va e'lonlar yuborish`}
          backHref="/talaba/dashboard"
          stats={[
            { icon: Users, value: students.length, label: 'Talabalar' },
            { icon: Megaphone, value: elonlar.length, label: "E'lonlar" },
            { icon: Clock, value: `${dutyFilled}/7`, label: 'Navbatchi kun' },
          ]}
        />

        {/* Yo'qlama quick action */}
        {allows('attendance.mark') && (
          <Link
            href="/sardor/yoqlama"
            className={`group flex items-center gap-4 overflow-hidden rounded-2xl border p-4 transition-all ${t.softBorder} ${t.soft} hover:brightness-110`}
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${t.gradient}`}>
              <ClipboardCheck size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black tracking-tight text-white">Yo&apos;qlama</p>
              <p className="text-xs text-slate-400">Qavatingizdagi talabalarni belgilang — kim bor, kim yo&apos;q</p>
            </div>
            <ChevronRight size={18} className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${t.textSoft}`} />
          </Link>
        )}

        <LeaderTabs role="sardor" tabs={tabs} active={activeTab} onChange={(k) => setActiveTab(k as typeof activeTab)} />

        {/* Main Tab Panels */}
        <AnimatePresence mode="wait">
          {activeTab === 'students' && allows('students.view') ? (
            <motion.div
              key="students"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
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

              {filteredStudents.length > 0 ? (
                <motion.div
                  variants={listStagger}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                >
                  {filteredStudents.map((student) => (
                    <motion.div
                      key={student.id}
                      variants={cardIn}
                      className={`${glassCard({ hover: true })} flex flex-col justify-between gap-5 p-5`}
                    >
                      <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-[50px] ${t.auroraA}`} />
                      <div className="relative z-10 flex items-start gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-base font-bold ${t.softBorder} ${t.soft} ${t.text}`}>
                          {initialsOf(student.full_name)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate text-base font-black tracking-tight leading-tight text-white">{student.full_name}</h4>
                          <p className={`mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${t.textSoft}`}>
                            <Building2 size={10} /> Xona #{student.room_number || 'Biriktirilmagan'}
                          </p>
                        </div>
                      </div>

                      <div className="relative z-10 space-y-2 border-t border-white/5 pt-4 text-xs text-slate-400">
                        <div className="flex justify-between">
                          <span>Fakultet:</span>
                          <span className="max-w-[160px] truncate font-bold text-white">{student.faculty || '—'}</span>
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

                      <div className="relative z-10 flex gap-2 border-t border-white/5 pt-4">
                        {student.phone_number ? (
                          <a
                            href={`tel:${student.phone_number}`}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${t.softBorder} ${t.soft} ${t.text} hover:brightness-110`}
                          >
                            <Phone size={12} />
                            Qo&apos;ng&apos;iroq qilish
                          </a>
                        ) : (
                          <div className="flex-1 py-2.5 text-center text-[10px] italic font-semibold text-slate-500">
                            Telefon raqami yo&apos;q
                          </div>
                        )}
                        <a
                          href={`mailto:${student.email}`}
                          className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition-all hover:bg-white/10"
                        >
                          <Mail size={12} />
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <EmptyState role="sardor" icon={Users} title="Hech qanday talaba topilmadi" />
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
              <SectionHeading
                title="Mening Qavatim E'lonlari"
                description={`Faqat sizning qavatingizdagi ${genderLabel.toLowerCase()}ga ko'rinadigan xabarnomalar`}
                action={
                  allows('floor.announcements') && (
                    <button
                      onClick={() => setNewElonOpen(true)}
                      className={`flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition-all duration-300 sm:w-auto ${t.gradient} hover:brightness-110`}
                    >
                      <Plus size={16} />
                      Yangi E&apos;lon
                    </button>
                  )
                }
              />

              {elonlar.length > 0 ? (
                <motion.div variants={listStagger} initial="hidden" animate="show" className="space-y-4">
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
                      <motion.div
                        variants={cardIn}
                        key={elon.id}
                        className={`flex flex-col items-start justify-between gap-4 rounded-2xl border-l-[6px] border border-y-white/5 border-r-white/5 bg-white/[0.03] p-5 backdrop-blur-xl md:flex-row md:items-center ${typeStyles.border}`}
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
                          <h4 className="text-base font-extrabold tracking-tight text-white">{elon.title}</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">{elon.text}</p>
                        </div>

                        {allows('floor.announcements') && (
                          <button
                            onClick={() => handleDeleteElon(elon.id)}
                            className="flex shrink-0 items-center justify-center self-end rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-400 transition-all hover:bg-rose-500/20 md:self-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </motion.div>
                    )
                  })}
                </motion.div>
              ) : (
                <EmptyState role="sardor" icon={Megaphone} title="Hozircha hech qanday e'lon chop etilmagan" />
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
              <SectionHeading
                title="Qavat Navbatchilik Jadvali"
                description="Ushbu jadval qavatingizdagi barcha talabalar uchun hafta kunlariga navbatchilarni belgilash imkonini beradi"
                action={
                  allows('duty.schedule') && (
                    <button
                      onClick={handleSaveDuty}
                      disabled={savingDuty}
                      className={`flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition-all duration-300 disabled:opacity-55 sm:w-auto ${t.gradient} hover:brightness-110`}
                    >
                      <ShieldCheck size={16} />
                      {savingDuty ? 'Saqlanmoqda...' : 'Jadvalni Saqlash'}
                    </button>
                  )
                }
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                  <div className={`${glassCard()} p-5`}>
                    <div className="relative z-10 mb-4 flex items-center justify-between">
                      <h4 className={`flex items-center gap-2 text-sm font-black uppercase tracking-wider ${t.textSoft}`}>
                        <ShieldCheck size={16} />
                        Yordamchi Adminlar
                      </h4>
                      {allows('duty.schedule') && (
                        <button
                          onClick={() => {
                            setActiveSelectAdmin(true);
                            setActiveSelectDay(null);
                          }}
                          className={`flex items-center justify-center rounded-xl border px-2 py-2 transition-all ${t.softBorder} ${t.soft} ${t.text} hover:brightness-110`}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>

                    {dutyAdmins.length > 0 ? (
                      <div className="relative z-10 space-y-2">
                        {dutyAdmins.map((admin) => (
                          <div key={admin.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.04] p-3">
                            <div>
                              <p className="text-xs font-extrabold text-white">{admin.name}</p>
                              <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Xona #{admin.room}</p>
                            </div>
                            {allows('duty.schedule') && (
                              <button
                                onClick={() => setDutyAdmins(prev => prev.filter(a => a.id !== admin.id))}
                                className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-1.5 py-1.5 text-rose-400 transition-all hover:bg-rose-500/20"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="relative z-10 rounded-2xl border border-dashed border-white/5 py-6 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hozircha adminlar yo&apos;q</p>
                      </div>
                    )}
                  </div>

                  <div className={`${glassCard()} p-5`}>
                    <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-[50px] ${t.auroraA}`} />
                    <h4 className={`relative z-10 mb-2 text-xs font-black uppercase tracking-wider ${t.textSoft}`}>Qanday ishlaydi?</h4>
                    <ul className="relative z-10 space-y-2 text-[11px] font-semibold leading-relaxed text-slate-400">
                      <li className="flex items-start gap-1.5">
                        <span className={t.textSoft}>•</span>
                        <span>Qavat talabalarini haftaning istalgan kuniga navbatchi qilib belgilang.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className={t.textSoft}>•</span>
                        <span>Bir kunga istalgancha navbatchi qo&apos;shish mumkin.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className={t.textSoft}>•</span>
                        <span>O&apos;zgarishlar barcha talabalarda ko&apos;rinishi uchun yuqoridagi <b>Jadvalni Saqlash</b> tugmasini bosing.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2">
                  {['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'].map((day) => {
                    const dayDuties = dutySchedule[day] || [];
                    return (
                      <div key={day} className={`${glassCard({ hover: true })} flex flex-col justify-between p-5`}>
                        <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-[40px] ${t.auroraA}`} />

                        <div className="relative z-10 mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`h-6 w-1.5 rounded-full ${t.gradient}`} />
                            <h4 className="text-sm font-black text-white">{day}</h4>
                          </div>
                          {allows('duty.schedule') && (
                            <button
                              onClick={() => {
                                setActiveSelectDay(day);
                                setActiveSelectAdmin(false);
                              }}
                              className={`flex items-center justify-center rounded-xl border px-2 py-2 transition-all ${t.softBorder} ${t.soft} ${t.text} hover:brightness-110`}
                            >
                              <Plus size={12} />
                            </button>
                          )}
                        </div>

                        <div className="relative z-10 min-h-[100px] flex-1 space-y-2">
                          {dayDuties.length > 0 ? (
                            dayDuties.map((duty) => (
                              <div key={duty.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.04] p-2.5 transition-all hover:bg-white/[0.07]">
                                <div>
                                  <p className="text-[11px] font-black text-white">{duty.name}</p>
                                  <p className="mt-0.5 text-[9px] font-semibold text-slate-500">Xona #{duty.room}</p>
                                </div>
                                {allows('duty.schedule') && (
                                  <button
                                    onClick={() => {
                                      setDutySchedule(prev => ({
                                        ...prev,
                                        [day]: (prev[day] || []).filter(d => d.id !== duty.id)
                                      }));
                                    }}
                                    className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-1.5 py-1.5 text-rose-400 transition-all hover:bg-rose-500/20"
                                  >
                                    <X size={9} />
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/5 py-6">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Navbatchi belgilanmagan</p>
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
                  <ModalShell
                    role="sardor"
                    icon={activeSelectAdmin ? ShieldCheck : Clock}
                    title={activeSelectAdmin ? "Yordamchi Admin Qo’shish" : `${activeSelectDay} uchun Navbatchi`}
                    description="Qavatdagi talabalar orasidan tanlang"
                    onClose={() => {
                      setActiveSelectDay(null);
                      setActiveSelectAdmin(false);
                    }}
                  >
                    <div className="max-h-[300px] space-y-2 overflow-y-auto pr-2">
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
                            className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                              isAdded
                                ? 'cursor-not-allowed border-transparent bg-white/[0.02] opacity-40'
                                : `border-white/5 bg-white/5 hover:bg-white/10 hover:${t.softBorder}`
                            }`}
                          >
                            <div>
                              <p className="text-xs font-extrabold text-white">{student.full_name}</p>
                              <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Xona #{student.room_number || '—'} · Guruh: {student.group || '—'}</p>
                            </div>
                            {isAdded && (
                              <span className={`rounded-md border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${t.softBorder} ${t.soft} ${t.text}`}>
                                Qo&apos;shilgan
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ModalShell>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Announcement Modal */}
        <AnimatePresence>
          {newElonOpen && (
            <ModalShell
              role="sardor"
              icon={Megaphone}
              title="Yangi E'lon Chop Etish"
              description={`Ushbu e'lon faqat ${profile?.assigned_floor}-qavat ${genderLabel.toLowerCase()} talabalariga yuboriladi.`}
              onClose={() => setNewElonOpen(false)}
            >
              <form onSubmit={handleCreateElon} className="space-y-4">
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
                  <CustomSelect
                    value={newElonForm.type}
                    onChange={(val) => setNewElonForm(prev => ({ ...prev, type: val as Elon['type'] }))}
                    options={[
                      { value: 'Yangilik', label: 'Yangilik' },
                      { value: 'Ogohlantirish', label: 'Ogohlantirish' },
                      { value: 'Muhim', label: 'Muhim' },
                      { value: 'Tadbir', label: 'Tadbir' },
                    ]}
                    className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm"
                  />
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
                    className={`flex-1 py-3 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-55 ${t.gradient} hover:brightness-110`}
                  >
                    {isSubmitting ? 'Chop etilmoqda...' : 'Chop etish'}
                  </button>
                </div>
              </form>
            </ModalShell>
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
    </div>
  )
}
