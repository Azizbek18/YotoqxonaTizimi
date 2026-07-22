'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Boxes,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Bell
} from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useZamdekanScope } from '@/lib/hooks/useZamdekanScope'
import { useToastOffset } from '@/lib/hooks/useToastOffset'
import { fetchZamdekanOverview } from '@/features/permits/client/admin-api'
import { supabase } from '@/lib/supabase'

export default function ZamdekanLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [mounted, setMounted] = useState(false)
  const { faculty: zamdekanFaculty, fullName: zamdekanName, resolved: facultyResolved } = useZamdekanScope()
  useToastOffset(76)
  const [recentPending, setRecentPending] = useState<{ id: string; full_name: string; direction: string; created_at: string | null }[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  useEffect(() => {
    const mountId = window.setTimeout(() => {
      setMounted(true)
      setIsMobile(window.innerWidth < 1024)
    }, 0)

    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.clearTimeout(mountId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!facultyResolved) return

    async function fetchPendingPermits() {
      if (!zamdekanFaculty) {
        setPendingCount(0)
        setRecentPending([])
        return
      }

      try {
        const { dashboard } = await fetchZamdekanOverview()
        setPendingCount(dashboard.pendingCount)
        setRecentPending(dashboard.recentRequests.map((request) => ({
          id: request.id,
          full_name: request.full_name,
          direction: request.direction,
          created_at: request.created_at,
        })))
      } catch (err) {
        console.error('Error fetching pending permits count:', err)
      }
    }
    fetchPendingPermits()
    const interval = setInterval(fetchPendingPermits, 15000)
    return () => clearInterval(interval)
  }, [facultyResolved, zamdekanFaculty])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const menuItems = useMemo(() => ([
    {
      label: 'Dashboard',
      caption: 'Umumiy hisobot',
      href: '/zamdekan/dashboard',
      icon: LayoutDashboard,
      accent: 'from-sky-500 to-blue-600',
    },
    {
      label: 'Yo‘llanmalar',
      caption: 'Yangi arizalar',
      href: '/zamdekan/arizalar',
      icon: FileText,
      accent: 'from-emerald-500 to-green-600',
      badge: pendingCount > 0 ? pendingCount : undefined
    },
    {
      label: 'Xonalar xaritasi',
      caption: 'Joylashtirish holati',
      href: '/zamdekan/xonalar',
      icon: Boxes,
      accent: 'from-amber-500 to-orange-600',
    }
  ]), [pendingCount])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success("Chiqib ketdingiz!")
      router.push('/login')
    } catch {
      toast.error("Chiqib ketishda xato!")
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" />
      </div>
    )
  }

  const shellBg = isLight ? 'bg-[#f3f6fb]' : 'bg-[#020617]'
  const sidebarSurface = isLight
    ? 'border-slate-200 bg-white/90 text-slate-900 shadow-xl'
    : 'border-white/10 bg-[#06101f]/90 text-white'
  const mutedText = isLight ? 'text-slate-500' : 'text-slate-400'
  const strongText = isLight ? 'text-slate-900' : 'text-white'

  const renderNavContent = (compact: boolean) => (
    <div className="flex h-full flex-col">
      {/* Modern Header */}
      <div className={`relative overflow-hidden backdrop-blur-2xl px-4 py-5 border-b transition-all ${isLight ? 'border-slate-200/50 bg-white/50' : 'border-white/5 bg-gradient-to-b from-white/[0.08] to-white/[0.02]'}`}>
        <div className={`absolute inset-0 opacity-40 ${isLight ? 'bg-gradient-to-br from-sky-100 via-blue-50 to-transparent' : 'bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-transparent'}`} />

        <div className="relative flex items-center justify-between gap-4">
          <div className={`flex items-center gap-3 min-w-0 ${compact ? 'justify-center w-full' : ''}`}>
            <div className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-full backdrop-blur-md border transition-all ${isLight ? 'bg-white/80 border-sky-200 text-sky-600 shadow-lg shadow-sky-200/20' : 'bg-white/[0.08] border-indigo-400/30 text-indigo-300 shadow-lg shadow-indigo-500/10'}`}>
              <UserCog size={20} strokeWidth={2.5} />
            </div>

            {!compact && (
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-black uppercase tracking-[0.32em] leading-none ${isLight ? 'text-sky-600' : 'text-indigo-400/80'}`}>
                  ZAMDEKAN
                </p>
                <h2 className={`text-sm font-black tracking-tight leading-tight mt-0.5 truncate ${strongText}`}>
                  {zamdekanName || 'Yotoqxona'}
                </h2>
                <p className={`text-[9px] font-medium mt-0.5 truncate ${mutedText}`}>
                  {zamdekanFaculty ? zamdekanFaculty.toUpperCase() : 'Fakultet sozlanmagan'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between rounded-2xl p-3 text-xs font-bold tracking-wide transition-all ${
                  active
                    ? isLight
                      ? 'bg-sky-100/80 text-sky-700 shadow-sm'
                      : 'bg-white/[0.06] text-white border border-white/5'
                    : isLight
                      ? 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      : 'text-slate-400 hover:bg-white/[0.02] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-xl transition-all ${
                    active
                      ? isLight ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : isLight ? 'bg-slate-100 text-slate-500 group-hover:bg-slate-200' : 'bg-white/[0.04] text-slate-400 group-hover:bg-white/10'
                  }`}>
                    <Icon size={16} strokeWidth={2.2} />
                  </div>
                  {!compact && (
                    <div>
                      <p>{item.label}</p>
                      <p className={`text-[9px] font-medium mt-0.5 ${active ? isLight ? 'text-sky-700' : 'text-slate-300' : mutedText}`}>
                        {item.caption}
                      </p>
                    </div>
                  )}
                </div>

                {!compact && item.badge && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Logout */}
      <div className={`p-4 border-t ${isLight ? 'border-slate-200/50' : 'border-white/5'}`}>
        <button
          onClick={handleLogout}
          className={`flex w-full items-center gap-3 rounded-2xl p-3 text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
            isLight
              ? 'text-rose-600 hover:bg-rose-50 bg-rose-500/5'
              : 'text-rose-400 hover:bg-rose-500/10 bg-rose-500/5 border border-rose-500/10'
          } ${compact ? 'justify-center' : ''}`}
        >
          <LogOut size={16} strokeWidth={2.5} />
          {!compact && <span>Chiqish</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${shellBg}`}>
      {/* 1. Desktop Sidebar */}
      {!isMobile && (
        <aside
          className={`h-full border-r shrink-0 transition-all duration-300 ease-out z-20 ${sidebarSurface} ${
            sidebarOpen ? 'w-[260px]' : 'w-[80px]'
          }`}
        >
          {renderNavContent(!sidebarOpen)}
        </aside>
      )}

      {/* 2. Mobile Sidebar Overlay */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <aside
            className={`h-full w-[260px] border-r animate-slide-in ${sidebarSurface}`}
            onClick={(e) => e.stopPropagation()}
          >
            {renderNavContent(false)}
          </aside>
        </div>
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className={`h-16 flex items-center justify-between px-4 border-b shrink-0 transition-all ${
          isLight ? 'bg-white/80 border-slate-200/80' : 'bg-[#020617]/50 border-white/5'
        } backdrop-blur-md z-10`}>
          <div className="flex items-center gap-3">
            {/* Toggle buttons */}
            {isMobile ? (
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className={`p-2 rounded-xl border ${isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-white/10 bg-white/5 text-white'}`}
              >
                <Menu size={18} />
              </button>
            ) : (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`p-2 rounded-xl border transition-all hover:scale-105 active:scale-95 ${
                  isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-white/10 bg-white/5 text-white'
                }`}
              >
                {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            )}
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-sky-600' : 'text-cyan-400'}`}>Zamdekan Paneli</p>
              <h1 className={`text-xs font-bold leading-tight ${strongText}`}>Yo&apos;llanmalar va Xonalar boshqaruvi</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((prev) => !prev)}
                className={`relative p-2 rounded-xl border transition-all hover:scale-105 ${
                  isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-white/10 bg-white/5 text-white'
                }`}
              >
                <Bell size={18} />
                {pendingCount > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-rose-500 border border-white dark:border-slate-950 animate-pulse" />
                )}
              </button>

              {notifOpen && (
                <div className={`absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border shadow-2xl z-50 overflow-hidden ${
                  isLight ? 'bg-white border-slate-200' : 'bg-[#0b101d] border-white/10'
                }`}>
                  <div className={`px-4 py-3 border-b text-xs font-black uppercase tracking-wider ${isLight ? 'border-slate-200 text-slate-700' : 'border-white/5 text-slate-300'}`}>
                    Kutilayotgan yo&apos;llanmalar {pendingCount > 0 && `(${pendingCount})`}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {recentPending.length === 0 ? (
                      <p className={`px-4 py-6 text-center text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {zamdekanFaculty ? 'Kutilayotgan yo\'llanma yo\'q.' : 'Fakultet sozlanmagan.'}
                      </p>
                    ) : (
                      recentPending.map((item) => (
                        <Link
                          key={item.id}
                          href={`/zamdekan/arizalar?id=${item.id}`}
                          onClick={() => setNotifOpen(false)}
                          className={`block px-4 py-3 border-b last:border-b-0 transition-colors ${
                            isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/5 hover:bg-white/5'
                          }`}
                        >
                          <p className="text-xs font-bold truncate">{item.full_name}</p>
                          <p className={`text-[11px] mt-0.5 truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{item.direction}</p>
                        </Link>
                      ))
                    )}
                  </div>
                  <Link
                    href="/zamdekan/arizalar"
                    onClick={() => setNotifOpen(false)}
                    className={`block px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-wider transition-colors ${
                      isLight ? 'text-sky-600 hover:bg-slate-50' : 'text-cyan-400 hover:bg-white/5'
                    }`}
                  >
                    Barcha yo&apos;llanmalarni ko&apos;rish
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar relative">
          {children}
        </main>
      </div>
    </div>
  )
}
