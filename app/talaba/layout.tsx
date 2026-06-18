'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import {
  LayoutDashboard, Megaphone, ListOrdered, ShieldCheck,
  UserCircle, Bell, Moon, Zap, Clock, CreditCard, FileText,
  X, AlertTriangle, CheckCircle2, AlertCircle, Upload, Sparkles,
  Code, Send, Phone, ExternalLink
} from 'lucide-react'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'
import { supabase } from '@/lib/supabase'
import { getSafeUser, getSafeSession } from '@/lib/auth-session'
import toast, { Toaster } from 'react-hot-toast'

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface Profile {
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
  is_floor_captain?: boolean
  assigned_floor?: number
  gender?: string
  warning_count?: number
  blacklisted?: boolean
  direction?: string
}

type NotificationLevel = 'info' | 'warning' | 'danger' | 'success'

type NotificationItem = {
  id: string
  title: string
  desc: string
  time: string
  type: 'elon' | 'ariza'
  level: NotificationLevel
}

type ElonNotificationRow = {
  id: string | number
  title?: string | null
  desc?: string | null
  created_at?: string | null
  type?: string | null
}

type ArizaNotificationRow = {
  id: string | number
  title?: string | null
  text?: string | null
  reason?: string | null
  date?: string | null
  type?: string | null
  status?: string | null
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

const NAV = [
  { icon: LayoutDashboard, label: 'Asosiy', href: '/talaba/dashboard' },
  { icon: Megaphone, label: "E'lonlar", href: '/talaba/elonlar' },
  { icon: ListOrdered, label: 'Navbat', href: '/talaba/navbat' },
  { icon: ShieldCheck, label: 'Qoidalar', href: '/talaba/qoidalar' },
  { icon: CreditCard, label: "To'lov", href: '/talaba/tolova' },
  { icon: FileText, label: 'Arizalar', href: '/talaba/arizalar' },
  { icon: UserCircle, label: 'Profil', href: '/talaba/profil' },
]

const QUICK_ACTIONS = [
  { label: 'Tungi ruxsat', icon: Moon, color: 'text-purple-400' },
  { label: 'Navbat almashish', icon: Zap, color: 'text-yellow-400' },
  { label: 'Tozalik auditi', icon: ShieldCheck, color: 'text-green-400' },
]

const PAGE_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export default function TalabaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [time, setTime] = useState(new Date())
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roommates, setRoommates] = useState<Profile[]>([])

  // Modal toggles
  const [isNightPermOpen, setIsNightPermOpen] = useState(false)
  const [isQueueSwapOpen, setIsQueueSwapOpen] = useState(false)
  const [isCleanAuditOpen, setIsCleanAuditOpen] = useState(false)
  const [isDevModalOpen, setIsDevModalOpen] = useState(false)

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMounted(true)
    }, 0)
    const timer = setInterval(() => setTime(new Date()), 60000)
    return () => {
      clearTimeout(timeoutId)
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    async function fetchUserData() {
      try {
        const user = await getSafeUser()
        if (user) {
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

          if (!profileError && profileData) {
            setProfile(profileData as Profile)

            if (profileData.room_number) {
              const { data: roommatesData, error: roommatesError } = await supabase
                .from('users')
                .select('id, full_name, email, phone_number, faculty, role, room_number, course, group, avatar_url')
                .eq('room_number', profileData.room_number)
                .neq('id', user.id)
                .order('full_name', { ascending: true })

              if (!roommatesError && roommatesData) {
                setRoommates(roommatesData as Profile[])
              }
            }

            // --- FETCH NOTIFICATIONS DATA ---
            try {
              // 1. Fetch latest announcements
              const { data: elonData } = await supabase
                .from('elonlar')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5)

              // 2. Fetch student's applications / warnings
              const { data: arizalarData } = await supabase
                .from('arizalar')
                .select('*')
                .eq('student_id', user.id)
                .order('date', { ascending: false })
                .limit(5)

              const combinedList: NotificationItem[] = []

              if (elonData) {
                ;(elonData as ElonNotificationRow[]).forEach((el) => {
                  combinedList.push({
                    id: `elon-${el.id}`,
                    title: el.title || 'E\'lon',
                    desc: el.desc || '',
                    time: el.created_at || new Date().toISOString(),
                    type: 'elon',
                    level: el.type === 'Muhim' || el.type === 'Ogohlantirish' ? 'warning' : 'info'
                  })
                })
              }

              if (arizalarData) {
                ;(arizalarData as ArizaNotificationRow[]).forEach((ar) => {
                  if (ar.type === 'tushuntirish' || ar.status === 'rejected' || ar.status === 'approved') {
                    combinedList.push({
                      id: `ariza-${ar.id}`,
                      title: ar.title || (ar.type === 'tushuntirish' ? 'Tushuntirish xati talabi' : 'Ariza holati o\'zgardi'),
                      desc: ar.text || ar.reason || '',
                      time: ar.date || new Date().toISOString(),
                      type: 'ariza',
                      level: ar.status === 'rejected' ? 'danger' : ar.status === 'approved' ? 'success' : 'warning'
                    })
                  }
                })
              }

              // Sort by date descending
              combinedList.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
              setNotifications(combinedList)

              // Calculate unread count using localStorage
              const readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]')
              const unread = combinedList.filter(n => !readIds.includes(n.id)).length
              setUnreadCount(unread)
            } catch (err) {
              console.error('Error fetching notifications:', err)
            }
          }
        }
      } catch (err) {
        console.error('Error fetching user data in layout:', err)
      }
    }

    fetchUserData()
  }, [mounted])

  const markAllAsRead = () => {
    const readIds = notifications.map(n => n.id)
    localStorage.setItem('read_notifications', JSON.stringify(readIds))
    setUnreadCount(0)
    toast.success("Barcha bildirishnomalar o'qildi deb belgilandi!")
  }

  const handleOpenNotifications = () => {
    setIsNotificationsOpen(true)
    const readIds = notifications.map(n => n.id)
    localStorage.setItem('read_notifications', JSON.stringify(readIds))
    setUnreadCount(0)
  }

  const refreshProfileData = async () => {
    try {
      const user = await getSafeUser()
      if (user) {
        const { data: profileData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        if (profileData) {
          setProfile(profileData as Profile)
        }
      }
    } catch (err) {
      console.error('Error refreshing profile:', err)
    }
  }

  const isProfileIncomplete = mounted && profile !== null && (!profile.avatar_url || !profile.group)

  if (!mounted) return null

  const handleQuickAction = (label: string) => {
    if (label === 'Tungi ruxsat') {
      setIsNightPermOpen(true)
    } else if (label === 'Navbat almashish') {
      setIsQueueSwapOpen(true)
    } else if (label === 'Tozalik auditi') {
      setIsCleanAuditOpen(true)
    }
  }

  return (
    <div className={`min-h-screen overflow-x-hidden font-sans transition-colors ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100 text-slate-900 selection:bg-blue-200' : 'bg-[#02040a] text-white selection:bg-cyan-500/30'}`}>
      <Toaster position="top-center" reverseOrder={false} />

      {/* --- 1. DYNAMIC BACKGROUND LAYER --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {!isLight && (
          <>
            <div className="absolute top-[-15%] left-[-10%] w-[80%] h-[70%] bg-blue-600/10 blur-[140px] rounded-full opacity-60" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full opacity-40" />
            <div className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: `radial-gradient(#fff 1.2px, transparent 1px)`, backgroundSize: '40px 40px' }}
            />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
          </>
        )}
      </div>

      {/* --- 2. PREMIUM TOP BAR (HEADER) --- */}
      <header className={`relative z-50 px-4 sm:px-6 py-4 transition-all ${isLight ? 'bg-white border-b border-slate-200' : 'bg-[#02040a] border-b border-white/5'}`}>
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-linear-to-tr p-px shrink-0 ${isLight ? 'from-blue-600 to-blue-400' : 'from-blue-600 to-cyan-400'}`}>
              <div className={`w-full h-full rounded-[15px] flex items-center justify-center ${isLight ? 'bg-white' : 'bg-[#02040a]'}`}>
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-full h-full rounded-[15px] object-cover"
                  />
                ) : (
                  <UserCircle className={isLight ? 'text-blue-600' : 'text-cyan-400'} size={20} />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className={`text-xs sm:text-sm font-bold tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {profile?.full_name ? `${profile.full_name.split(' ')[0]} 👋` : 'Talaba 👋'}
              </h2>
              <div className={`flex items-center gap-1.5 text-[8px] sm:text-[10px] font-medium uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                <Clock size={8} className="shrink-0" />
                <span className="truncate">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {profile?.room_number ? `${profile.room_number}-Xona` : 'Yotoqxona'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button
              onClick={() => setIsDevModalOpen(true)}
              className={`relative p-2 sm:p-2.5 rounded-xl transition-all group flex items-center justify-center ${
                isLight 
                  ? 'bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-600 hover:text-slate-900' 
                  : 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white'
              }`}
              title="Dasturchi va takliflar"
            >
              <Sparkles size={18} className="animate-pulse text-amber-500" />
            </button>
            <button
              onClick={handleOpenNotifications}
              className={`relative p-2 sm:p-2.5 rounded-xl transition-all group ${isLight ? 'bg-slate-100 border border-slate-300 hover:bg-slate-200' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
            >
              <Bell size={18} className={`group-hover:text-white ${isLight ? 'text-slate-600 group-hover:text-slate-900' : 'text-slate-400'}`} />
              {unreadCount > 0 && (
                <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 animate-pulse ${isLight ? 'bg-blue-500 border-white' : 'bg-cyan-500 border-[#02040a]'}`} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* --- 3. MAIN CONTENT --- */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-40">

        {/* Quick Actions Scrollable Row */}
        <section className="mb-6 sm:mb-8">
          <p className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] mb-3 sm:mb-4 ml-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Tezkor amallar</p>
          <div className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar pb-2">
            {QUICK_ACTIONS.map((action) => (
              <motion.button
                key={action.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleQuickAction(action.label)}
                className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3.5 rounded-2xl backdrop-blur-xl whitespace-nowrap transition-all text-xs sm:text-sm shrink-0 shadow-sm ${
                  isLight
                    ? 'bg-white border border-slate-200 text-slate-800 hover:border-blue-500/30 hover:bg-blue-50/10'
                    : 'bg-slate-900/40 border border-white/5 text-white hover:border-cyan-500/20 hover:bg-cyan-500/[0.02]'
                }`}
              >
                <action.icon size={16} className={`${action.color} shrink-0`} />
                <span className="font-bold tracking-wide">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Page Content with Animation */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            variants={PAGE_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 30
            }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- 4. FLOATING BOTTOM NAVIGATION --- */}
      <nav className="fixed bottom-4 sm:bottom-8 left-0 right-0 z-40 flex justify-center px-3 sm:px-6 pointer-events-none">
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className={`relative flex items-center gap-0.5 sm:gap-1 w-full max-w-full sm:max-w-4xl backdrop-blur-none sm:backdrop-blur-[30px] rounded-3xl sm:rounded-4xl p-1.5 sm:p-2 transition-all overflow-x-auto no-scrollbar pointer-events-auto ${isLight ? 'bg-white/95 sm:bg-white/80 border border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.1)]' : 'bg-slate-950/95 sm:bg-slate-950/60 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]'}`}
        >
          {/* Inner Glossy Glow */}
          <div className={`absolute inset-0 rounded-3xl sm:rounded-4xl pointer-events-none ${isLight ? 'bg-linear-to-b from-white to-transparent' : 'bg-linear-to-b from-white/5 to-transparent'}`} />

          {NAV.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} className="relative shrink-0 flex-1 min-w-0 group">
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className="flex flex-col items-center justify-center py-2 sm:py-2.5 relative z-10 px-1"
                >
                  {/* Active Indicator (Liquid Pill) */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-active-pill"
                      className={`absolute inset-0 rounded-xl sm:rounded-[20px] border shadow-inner ${isLight ? 'bg-linear-to-tr from-blue-500/15 via-blue-500/5 to-transparent border-blue-500/15' : 'bg-linear-to-tr from-cyan-500/20 via-blue-500/10 to-transparent border-cyan-500/20'}`}
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 30,
                        mass: 0.8
                      }}
                    />
                  )}

                  <div className="relative mb-0.5 sm:mb-1">
                    <item.icon
                      size={20}
                      strokeWidth={isActive ? 2.5 : 1.8}
                      className={`transition-all duration-300 ${isActive ? isLight ? 'text-blue-600 drop-shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' : isLight ? 'text-slate-400 group-hover:text-slate-500' : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                    />
                  </div>

                  <span className={`text-[7px] sm:text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? isLight ? 'text-blue-600 opacity-100' : 'text-cyan-400 opacity-100' : isLight ? 'text-slate-500 opacity-0 h-0 overflow-hidden' : 'text-slate-500 opacity-0 h-0 overflow-hidden'
                    }`}>
                    {item.label}
                  </span>

                  {/* Active Bottom Bar */}
                  {isActive && (
                    <motion.div
                      layoutId="active-bar"
                      className={`absolute -bottom-0.5 sm:-bottom-1 w-3 h-0.5 rounded-full ${isLight ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]' : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'}`}
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 30,
                        mass: 0.8
                      }}
                    />
                  )}
                </motion.div>
              </Link>
            )
          })}
        </motion.div>
      </nav>

      {/* --- 5. MODALS (REACT PORTALS) --- */}
      <AnimatePresence>
        {isNightPermOpen && (
          <NightPermModal onClose={() => setIsNightPermOpen(false)} profile={profile} isLight={isLight} />
        )}
        {isQueueSwapOpen && (
          <QueueSwapModal onClose={() => setIsQueueSwapOpen(false)} profile={profile} roommates={roommates} isLight={isLight} />
        )}
        {isCleanAuditOpen && (
          <CleanAuditModal onClose={() => setIsCleanAuditOpen(false)} profile={profile} isLight={isLight} />
        )}
        {isDevModalOpen && (
          <DeveloperModal onClose={() => setIsDevModalOpen(false)} profile={profile} isLight={isLight} />
        )}
      </AnimatePresence>

      {/* --- 7. NOTIFICATIONS SIDEBAR/DRAWER --- */}
      {isNotificationsOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10000] flex justify-end bg-black/60 backdrop-blur-xs">
          {/* Backdrop Click */}
          <div className="absolute inset-0 pointer-events-auto" onClick={() => setIsNotificationsOpen(false)} />

          <div className={`relative w-full max-w-md h-full shadow-2xl border-l flex flex-col justify-between backdrop-blur-2xl transition-all duration-300 pointer-events-auto ${
            isLight
              ? 'bg-white/95 border-slate-200 text-slate-900'
              : 'bg-[#0b101d]/95 border-white/5 text-white'
          }`}>
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={20} className={isLight ? 'text-blue-600' : 'text-cyan-400'} />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">🔔 Bildirishnomalar</h3>
                  <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tizimdagi so&apos;nggi yangiliklar</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    O&apos;qilgan
                  </button>
                )}
                <button
                  onClick={() => setIsNotificationsOpen(false)}
                  className={`p-2 rounded-xl transition-all border ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 pr-3 custom-scrollbar text-xs sm:text-sm">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                  <div className={`p-4 rounded-full ${isLight ? 'bg-blue-50 text-blue-500' : 'bg-blue-500/10 text-cyan-400'} animate-pulse`}>
                    <CheckCircle2 size={40} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider mb-1">Yangi xabarlar yo&apos;q</h4>
                    <p className={`text-[10px] max-w-[240px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Siz yotoqxona tizimidagi barcha bildirishnomalarni ko&apos;rib bo&apos;ldingiz!
                    </p>
                  </div>
                </div>
              ) : (
                notifications.map((notif) => {
                  const Icon = notif.type === 'elon' ? Megaphone : notif.level === 'danger' ? AlertTriangle : FileText
                  const colorClass = notif.level === 'danger'
                    ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                    : notif.level === 'success'
                    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                    : notif.level === 'warning'
                    ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                    : 'text-blue-500 bg-blue-500/10 border-blue-500/20'

                  return (
                    <div
                      key={notif.id}
                      className={`p-4 rounded-2xl border transition-all duration-300 flex gap-3 ${
                        isLight
                          ? 'bg-slate-50/50 hover:bg-slate-50 border-slate-200'
                          : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/5'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl shrink-0 h-10 w-10 flex items-center justify-center border ${colorClass}`}>
                        <Icon size={18} />
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-black uppercase tracking-wider truncate">{notif.title}</h4>
                          <span className="text-[8px] font-semibold shrink-0 uppercase opacity-60">
                            {new Date(notif.time).toLocaleDateString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className={`text-[10px] leading-relaxed break-words ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                          {notif.desc}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- 8. MANDATORY PROFILE SETUP MODAL FOR FIRST TIME USERS --- */}
      {isProfileIncomplete && typeof document !== 'undefined' && createPortal(
        <ProfileSetupModal profile={profile} onComplete={refreshProfileData} isLight={isLight} />,
        document.body
      )}

      {/* --- 6. CUSTOM GLOBAL SCROLLBAR STYLE --- */}
      <style jsx global>{`
        html, body {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE 10+ */
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar {
          display: none; /* WebKit (Chrome, Safari, Edge) */
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { 
          background: rgba(34, 211, 238, 0.1); 
          border-radius: 10px; 
        }
        ::-webkit-scrollbar-thumb:hover { background: rgba(34, 211, 238, 0.3); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}

// ─── HELPER QUICK ACTIONS MODALS ─────────────────────────────────────────────

interface ModalProps {
  onClose: () => void
  profile: Profile | null
  isLight: boolean
}

function NightPermModal({ onClose, profile, isLight }: ModalProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) {
      toast.error('Profil yuklanmagan. Qaytadan urinib ko\'ring.')
      return
    }
    if (!date || !time || !reason) {
      toast.error('Iltimos, barcha maydonlarni to\'ldiring.')
      return
    }

    setSubmitting(true)
    try {
      const appDate = new Date().toISOString()
      const { error } = await supabase.from('arizalar').insert({
        student_id: profile.id,
        student_name: profile.full_name,
        faculty: profile.faculty || '',
        direction: profile.direction || '',
        course: profile.course ? parseInt(String(profile.course)) : 1,
        date: appDate,
        text: `Tungi ruxsat so'rovi. Sana: ${date}, Qaytish vaqti: ${time}, Sabab: ${reason}`,
        level: 'info',
        status: 'pending',
        title: 'Tungi ruxsat so\'rovi',
        type: 'ariza',
        reason: reason,
        ai_generated: false
      })

      if (error) throw error

      toast.success('Tungi ruxsat arizasi muvaffaqiyatli yuborildi!')
      onClose()
    } catch (err) {
      console.error(err)
      const errMsg = err instanceof Error ? err.message : 'Xatolik yuz berdi.'
      toast.error(errMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className={`relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-[24px] border backdrop-blur-2xl shadow-2xl p-4 sm:p-6 ${
          isLight
            ? 'bg-white/95 border-slate-200 text-slate-900'
            : 'bg-slate-950/80 border-white/10 text-white'
        }`}
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
              <Moon size={20} />
            </div>
            <h3 className="text-lg font-black tracking-tight">{"Tungi ruxsat so'rovi"}</h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Sana
            </label>
            <input
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all ${
                isLight
                  ? 'bg-slate-50 border-slate-300 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
                  : 'bg-slate-950 border-white/10 focus:ring-cyan-500/20 focus:border-cyan-400 text-white [color-scheme:dark]'
              }`}
            />
          </div>

          <div>
            <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Qaytish vaqti
            </label>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all ${
                isLight
                  ? 'bg-slate-50 border-slate-300 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
                  : 'bg-slate-950 border-white/10 focus:ring-cyan-500/20 focus:border-cyan-400 text-white [color-scheme:dark]'
              }`}
            />
          </div>

          <div>
            <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Sabab (Batafsil)
            </label>
            <textarea
              required
              rows={3}
              placeholder="Masalan: darsdan kech qaytish, ish yuzasidan..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all resize-none ${
                isLight
                  ? 'bg-slate-50 border-slate-300 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
                  : 'bg-slate-950/40 border-white/10 focus:ring-cyan-500/20 focus:border-cyan-400 text-white'
              }`}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all bg-gradient-to-r text-white ${
                isLight
                  ? 'from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20'
                  : 'from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  )
}

interface QueueSwapModalProps {
  onClose: () => void
  profile: Profile | null
  roommates: Profile[]
  isLight: boolean
}

function QueueSwapModal({ onClose, profile, roommates, isLight }: QueueSwapModalProps) {
  const [dutyDate, setDutyDate] = useState('')
  const [targetRoommateId, setTargetRoommateId] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) {
      toast.error('Profil yuklanmagan. Qaytadan urinib ko\'ring.')
      return
    }
    if (!dutyDate || !targetRoommateId || !reason) {
      toast.error('Iltimos, barcha maydonlarni to\'ldiring.')
      return
    }

    const roommate = roommates.find(r => r.id === targetRoommateId)
    const roommateName = roommate ? roommate.full_name : 'Xonadosh'

    setSubmitting(true)
    try {
      const appDate = new Date().toISOString()
      const { error } = await supabase.from('arizalar').insert({
        student_id: profile.id,
        student_name: profile.full_name,
        faculty: profile.faculty || '',
        direction: profile.direction || '',
        course: profile.course ? parseInt(String(profile.course)) : 1,
        date: appDate,
        text: `Navbatchilik almashish so'rovi. Mening navbatchilik sanam: ${dutyDate}, Xonadosh: ${roommateName}, Sabab: ${reason}`,
        level: 'info',
        status: 'pending',
        title: 'Navbatchilik almashish so\'rovi',
        type: 'ariza',
        reason: `Sana: ${dutyDate}, Kim bilan: ${roommateName}. Sabab: ${reason}`,
        ai_generated: false
      })

      if (error) throw error

      toast.success('Navbat almashish arizasi muvaffaqiyatli yuborildi!')
      onClose()
    } catch (err) {
      console.error(err)
      const errMsg = err instanceof Error ? err.message : 'Xatolik yuz berdi.'
      toast.error(errMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className={`relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-[24px] border backdrop-blur-2xl shadow-2xl p-4 sm:p-6 ${
          isLight
            ? 'bg-white/95 border-slate-200 text-slate-900'
            : 'bg-slate-950/80 border-white/10 text-white'
        }`}
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isLight ? 'bg-yellow-100 text-yellow-600' : 'bg-yellow-500/20 text-yellow-400'}`}>
              <Zap size={20} />
            </div>
            <h3 className="text-lg font-black tracking-tight">{"Navbat almashish so'rovi"}</h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Navbatchilik sanangiz
            </label>
            <input
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              value={dutyDate}
              onChange={(e) => setDutyDate(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all ${
                isLight
                  ? 'bg-slate-50 border-slate-300 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
                  : 'bg-slate-950 border-white/10 focus:ring-cyan-500/20 focus:border-cyan-400 text-white [color-scheme:dark]'
              }`}
            />
          </div>

          <div>
            <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Kim bilan almashasiz?
            </label>
            <select
              required
              value={targetRoommateId}
              onChange={(e) => setTargetRoommateId(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all ${
                isLight
                  ? 'bg-slate-50 border-slate-300 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
                  : 'bg-slate-900 border-white/10 focus:ring-cyan-500/20 focus:border-cyan-400 text-white'
              }`}
            >
              <option value="" disabled className={isLight ? 'text-slate-500' : 'text-slate-400 bg-slate-950'}>
                Xonadoshni tanlang...
              </option>
              {roommates.map(roommate => (
                <option key={roommate.id} value={roommate.id} className={isLight ? 'text-slate-900' : 'text-white bg-slate-950'}>
                  {roommate.full_name}
                </option>
              ))}
              {roommates.length === 0 && (
                <option disabled className="text-rose-400">Xonadoshlar topilmadi</option>
              )}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Sabab
            </label>
            <textarea
              required
              rows={3}
              placeholder="Masalan: Shu kuni kechki smenada ishim bor, imtihonga tayyorgarlik..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all resize-none ${
                isLight
                  ? 'bg-slate-50 border-slate-300 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
                  : 'bg-slate-950/40 border-white/10 focus:ring-cyan-500/20 focus:border-cyan-400 text-white'
              }`}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={submitting || roommates.length === 0}
              className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all bg-gradient-to-r text-white ${
                isLight
                  ? 'from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20'
                  : 'from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  )
}

function CleanAuditModal({ onClose, profile, isLight }: ModalProps) {
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) {
      toast.error('Profil yuklanmagan. Qaytadan urinib ko\'ring.')
      return
    }

    setSubmitting(true)
    try {
      const appDate = new Date().toISOString()
      const { error } = await supabase.from('arizalar').insert({
        student_id: profile.id,
        student_name: profile.full_name,
        faculty: profile.faculty || '',
        direction: profile.direction || '',
        course: profile.course ? parseInt(String(profile.course)) : 1,
        date: appDate,
        text: `Tozalik auditi so'rovi. Xona raqami: ${profile.room_number || 'Noma\'lum'}, Izoh: ${comment || 'Yo\'q'}`,
        level: 'info',
        status: 'pending',
        title: 'Tozalik auditi so\'rovi',
        type: 'ariza',
        reason: `Xona: ${profile.room_number || 'Noma\'lum'}. Izoh: ${comment || 'Yo\'q'}`,
        ai_generated: false
      })

      if (error) throw error

      toast.success('Tozalik auditi so\'rovi muvaffaqiyatli yuborildi!')
      onClose()
    } catch (err) {
      console.error(err)
      const errMsg = err instanceof Error ? err.message : 'Xatolik yuz berdi.'
      toast.error(errMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className={`relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-[24px] border backdrop-blur-2xl shadow-2xl p-4 sm:p-6 ${
          isLight
            ? 'bg-white/95 border-slate-200 text-slate-900'
            : 'bg-slate-950/80 border-white/10 text-white'
        }`}
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isLight ? 'bg-green-100 text-green-600' : 'bg-green-500/20 text-green-400'}`}>
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-lg font-black tracking-tight">{"Tozalik auditi so'rovi"}</h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={`p-4 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}>
            <div className="text-xs font-black uppercase tracking-wider mb-1 opacity-70">
              Xona raqamingiz
            </div>
            <div className="text-lg font-bold">
              {profile?.room_number || 'Xona belgilanmagan'}
            </div>
            <div className={`text-[10px] mt-1.5 leading-relaxed opacity-60`}>
              {"Audit so'rovi yuborilgach, mas'ul tarbiyachi yoki xona boshlig'i kelib xona tozaligini tekshiradi va baholaydi."}
            </div>
          </div>

          <div>
            <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {"Qo'shimcha izoh (Ixtiyoriy)"}
            </label>
            <textarea
              rows={3}
              placeholder="Masalan: Tozalik holatini muddatidan oldin tekshirishni so'raymiz..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-hidden focus:ring-2 transition-all resize-none ${
                isLight
                  ? 'bg-slate-50 border-slate-300 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
                  : 'bg-slate-950/40 border-white/10 focus:ring-cyan-500/20 focus:border-cyan-400 text-white'
              }`}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all bg-gradient-to-r text-white ${
                isLight
                  ? 'from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20'
                  : 'from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  )
}

// ─── MANDATORY PROFILE SETUP MODAL (FOR FIRST-TIME STUDENTS) ──────────────────

interface ProfileSetupProps {
  profile: Profile | null
  onComplete: () => void
  isLight: boolean
}

function ProfileSetupModal({ profile, onComplete, isLight }: ProfileSetupProps) {
  const [group, setGroup] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [aiChecking, setAiChecking] = useState(false)
  const [aiResult, setAiResult] = useState<{ is_human: boolean; description: string; reason?: string | null } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(selectedFile.type)) {
      toast.error("Faqat JPEG, PNG yoki WebP formatidagi rasmlar qabul qilinadi")
      return
    }

    // Validate size (5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("Rasm hajmi 5MB dan kichik bo'lishi shart")
      return
    }

    setFile(selectedFile)
    setPreview(URL.createObjectURL(selectedFile))
    setAiResult(null)
    setErrorMsg('')
    setAiChecking(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/ai/photo-check', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Rasm tekshirishda xatolik")
      }

      setAiResult(data)
      if (!data.is_human) {
        toast.error(data.reason || "Yuklangan rasmda inson yuzi aniqlanmadi!")
        // Clear file and preview since validation failed
        setFile(null)
        setPreview(null)
      } else {
        toast.success("AI Rasmni tasdiqladi!")
      }
    } catch (err: unknown) {
      console.error(err)
      setErrorMsg(getErrorMessage(err, "Ulanish xatosi. Iltimos, qayta urinib ko'ring."))
      toast.error("Rasm tekshirishda xatolik yuz berdi")
      setFile(null)
      setPreview(null)
    } finally {
      setAiChecking(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    if (!file || !aiResult?.is_human) {
      toast.error("Iltimos, avval AI tomonidan tasdiqlangan 3x4 rasm yuklang")
      return
    }
    if (!group.trim()) {
      toast.error("Iltimos, guruhingizni kiriting")
      return
    }

    setSubmitting(true)
    try {
      const session = await getSafeSession()
      if (!session?.access_token) {
        toast.error("Autentifikatsiya xatosi. Tizimga qayta kiring.")
        return
      }

      // 1. Upload verified avatar to storage
      const avatarFormData = new FormData()
      avatarFormData.append('file', file)
      avatarFormData.append('userId', profile.id)

      const uploadRes = await fetch('/api/student/profile/upload-avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: avatarFormData
      })

      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Rasm saqlashda xatolik")
      }

      // 2. Update student profile group
      const updateRes = await fetch('/api/student/profile/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: profile.id,
          group: group.trim()
        })
      })

      const updateData = await updateRes.json()
      if (!updateRes.ok) {
        throw new Error(updateData.error || "Guruhni saqlashda xatolik")
      }

      toast.success("Profil sozlamalari muvaffaqiyatli saqlandi!")
      onComplete()
    } catch (err: unknown) {
      console.error(err)
      toast.error(getErrorMessage(err, "Ma'lumotlarni saqlashda xato yuz berdi"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-950/90 border-white/10 text-white'
        }`}
      >
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 text-white mb-2">
              <Sparkles size={28} className="animate-pulse" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide">Profilni Sozlash</h2>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'} max-w-md mx-auto leading-relaxed`}>
              Tizimga birinchi marta kirganingiz sababli shaxsiy 3x4 rasmingiz va guruhingizni sozlash majburiydir.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Guruh Input */}
            <div className="space-y-2">
              <label className={`block text-xs font-black uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Guruhingiz
              </label>
              <input
                type="text"
                required
                placeholder="Masalan: 301-guruh"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className={`w-full px-4 py-3 rounded-2xl border text-sm outline-none transition-all ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white'
                    : 'bg-white/5 border-white/5 text-white focus:border-cyan-500/40'
                }`}
              />
            </div>

            {/* Rasm Upload */}
            <div className="space-y-3">
              <label className={`block text-xs font-black uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Shaxsiy 3x4 Rasmingiz (AI orqali tekshiriladi)
              </label>

              <div className="flex flex-col items-center justify-center gap-4">
                {preview ? (
                  <div className="relative w-36 h-48 rounded-2xl border border-white/10 overflow-hidden shadow-inner bg-slate-900/50 flex items-center justify-center">
                    <img src={preview} alt="3x4 Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <label
                    className={`w-full h-36 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                      isLight
                        ? 'border-slate-300 bg-slate-50 hover:bg-slate-100/50 hover:border-slate-400'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
                    }`}
                  >
                    <Upload size={24} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Rasm yuklash</span>
                    <span className="text-[10px] text-gray-500">JPG, PNG (max. 5MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}

                {/* AI Checking Status */}
                {aiChecking && (
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 animate-pulse">
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span>AI Rasmni tekshirmoqda...</span>
                  </div>
                )}

                {/* AI Validation Result */}
                {aiResult && (
                  <div
                    className={`w-full p-4 rounded-2xl border flex gap-3 text-xs leading-relaxed ${
                      aiResult.is_human
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {aiResult.is_human ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold uppercase tracking-wider">
                        {aiResult.is_human ? 'Muvaffaqiyatli tekshirildi' : 'Rasm qabul qilinmadi'}
                      </h4>
                      <p className="opacity-90">{aiResult.description}</p>
                      {aiResult.reason && (
                        <p className="font-semibold text-rose-500 mt-1">Rad etilish sababi: {aiResult.reason}</p>
                      )}
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className="w-full p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    {errorMsg}
                  </div>
                )}

                {preview && !aiChecking && (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null)
                      setPreview(null)
                      setAiResult(null)
                    }}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                    }`}
                  >
                    Boshqa rasm tanlash
                  </button>
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || aiChecking || !file || !aiResult?.is_human || !group.trim()}
              className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all bg-gradient-to-r text-white ${
                isLight
                  ? 'from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20'
                  : 'from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 shadow-lg shadow-cyan-500/20'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {submitting ? "Saqlanmoqda..." : "Saqlash va davom etish"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function DeveloperModal({ onClose, profile, isLight }: ModalProps) {
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) {
      toast.error('Profil yuklanmagan. Qaytadan urinib ko\'ring.')
      return
    }
    if (!feedback.trim()) {
      toast.error('Iltimos, taklif yoki xabaringizni yozib qoldiring.')
      return
    }

    setSubmitting(true)
    try {
      const appDate = new Date().toISOString()
      const { error } = await supabase.from('arizalar').insert({
        student_id: profile.id,
        student_name: profile.full_name,
        faculty: profile.faculty || '',
        direction: profile.direction || '',
        course: profile.course ? parseInt(String(profile.course)) : 1,
        date: appDate,
        text: feedback.trim(),
        level: 'info',
        status: 'pending',
        title: 'Talab va taklif (Dasturchiga)',
        type: 'taklif',
        reason: 'Dasturchi uchun talab va takliflar',
        ai_generated: false
      })

      if (error) throw error

      toast.success('Talab va taklifingiz muvaffaqiyatli yuborildi! Rahmat!')
      setFeedback('')
      onClose()
    } catch (err) {
      console.error(err)
      const errMsg = err instanceof Error ? err.message : 'Xatolik yuz berdi.'
      toast.error(errMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className={`relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-[24px] border backdrop-blur-2xl shadow-2xl p-4 sm:p-6 ${
          isLight
            ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-200/50'
            : 'bg-slate-950/85 border-white/10 text-white shadow-black/80'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5 flex-row">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400'}`}>
              <Code size={20} />
            </div>
            <h3 className="text-lg font-black tracking-tight">Dasturchi & Takliflar</h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Developer Info Card */}
        <div className={`rounded-xl border p-4 mb-5 flex flex-col gap-4 items-center sm:items-start sm:flex-row ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
        }`}>
          {/* Developer Photo */}
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500/50 shrink-0 shadow-md">
            <img 
              src="https://qgnjhkvmuywlfdnjfpqg.supabase.co/storage/v1/object/public/avatar/005d251c-5116-4e1e-926f-4cdb97915743/1781451759533.jpg" 
              alt="Azizbek Mo'minov" 
              className="w-full h-full object-cover"
            />
          </div>
          {/* Details */}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h4 className="text-sm font-black tracking-tight leading-tight">Mo&apos;minov Azizbek</h4>
            <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mt-0.5">Senior Full-Stack Developer</p>
            <div className="mt-2.5 space-y-1.5 text-xs">
              <a 
                href="tel:+998912461050" 
                className={`flex items-center justify-center sm:justify-start gap-1.5 font-medium transition-colors ${
                  isLight ? 'text-slate-650 hover:text-blue-600' : 'text-slate-300 hover:text-cyan-400'
                }`}
              >
                <Phone size={12} className="shrink-0" />
                +998 (91) 246-10-50
              </a>
              <a 
                href="https://t.me/Azizbek_04_18" 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`flex items-center justify-center sm:justify-start gap-1.5 font-medium transition-colors ${
                  isLight ? 'text-slate-650 hover:text-blue-600' : 'text-slate-300 hover:text-cyan-400'
                }`}
              >
                <Send size={12} className="rotate-45 shrink-0" />
                Telegram: @Azizbek_04_18
                <ExternalLink size={10} className="shrink-0" />
              </a>
            </div>
          </div>
        </div>

        {/* Team MTalaba info */}
        <div className="space-y-1.5 mb-5 text-xs text-left">
          <h5 className={`font-black uppercase tracking-wider text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>MTalaba Jamoasi</h5>
          <p className={`leading-relaxed ${isLight ? 'text-slate-650' : 'text-slate-400'}`}>
            MTalaba jamoasi - oliy ta&apos;lim muassasalari va yotoqxona hayotini raqamlashtirish uchun zamonaviy dasturiy yechimlar yaratadigan talaba-dasturchilar va dizaynerlar jamoasidir.
          </p>
        </div>

        {/* Suggestion Form */}
        <div className="border-t border-dashed pt-4 border-slate-700/30 dark:border-white/10 text-left">
          <h5 className={`font-black uppercase tracking-wider text-[10px] mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Taklif yuborish</h5>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className={`text-[10px] leading-relaxed mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Ilova haqida taklifingiz, xatoliklar yoki yangi g&apos;oyalaringiz bormi? Fikringizni qoldiring:
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Taklifingiz yoki fikringizni yozing..."
                rows={3}
                className={`w-full rounded-xl p-3 text-xs outline-none transition-all resize-none border ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500'
                    : 'bg-white/5 border-white/5 text-white focus:bg-white/10 focus:border-cyan-500'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !feedback.trim()}
              className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-gradient-to-r text-white flex items-center justify-center gap-1.5 ${
                isLight
                  ? 'from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-md shadow-blue-500/10'
                  : 'from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 shadow-md shadow-cyan-500/15'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <Send size={12} />
              {submitting ? "Yuborilmoqda..." : "Taklifni Yuborish"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
