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
  UserPlus,
  Bell,
  Building2,
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
  const [mounted, setMounted] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const { faculty: zamdekanFaculty, fullName: zamdekanName, resolved: facultyResolved } = useZamdekanScope()
  useToastOffset(84)
  const [recentPending, setRecentPending] = useState<{ id: string; full_name: string; direction: string; created_at: string | null }[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  useEffect(() => {
    const mountId = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(mountId)
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
      accentSoft: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    },
    {
      label: 'Yo‘llanmalar',
      caption: 'Yangi arizalar',
      href: '/zamdekan/arizalar',
      icon: FileText,
      accent: 'from-emerald-500 to-green-600',
      accentSoft: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      label: 'Xonalar xaritasi',
      caption: 'Joylashtirish holati',
      href: '/zamdekan/xonalar',
      icon: Boxes,
      accent: 'from-amber-500 to-orange-600',
      accentSoft: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    },
    {
      label: 'Xodimlar',
      caption: 'Admin va tarbiyachilar',
      href: '/zamdekan/xodimlar',
      icon: UserPlus,
      accent: 'from-purple-500 to-violet-600',
      accentSoft: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    },
  ]), [pendingCount])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Chiqib ketdingiz!')
      router.push('/login')
    } catch {
      toast.error('Chiqib ketishda xato!')
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500" />
      </div>
    )
  }

  const shellBg = isLight ? 'bg-[#f3f6fb]' : 'bg-[#020617]'
  const sidebarSurface = isLight
    ? 'border-slate-200 bg-white/95 text-slate-900 shadow-xl'
    : 'border-white/10 bg-[#070b1d]/95 text-white'
  const panelSurface = isLight
    ? 'bg-white/70 border-slate-200/70'
    : 'bg-white/[0.02] border-white/10'
  const mutedText = isLight ? 'text-slate-500' : 'text-slate-400'
  const strongText = isLight ? 'text-slate-900' : 'text-white'

  const activeItem = menuItems.find((item) => item.href === pathname)

  const renderNavContent = (compact: boolean) => (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className={`relative overflow-hidden px-4 py-5 border-b transition-all ${isLight ? 'border-slate-200/50 bg-gradient-to-br from-indigo-50 via-white to-white' : 'border-white/5 bg-gradient-to-br from-indigo-950/60 via-[#070b1d] to-[#070b1d]'}`}>
        <div className="absolute -left-10 -top-16 h-40 w-40 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />

        <div className={`relative flex items-center gap-3 min-w-0 ${compact ? 'justify-center w-full' : ''}`}>
          <div className="shrink-0 flex items-center justify-center h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-sm shadow-lg shadow-indigo-500/40 ring-2 ring-white/20">
            {zamdekanName ? zamdekanName.trim().charAt(0).toUpperCase() : <UserCog size={20} strokeWidth={2.5} />}
          </div>

          {!compact && (
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-black uppercase tracking-[0.32em] leading-none bg-gradient-to-r bg-clip-text text-transparent ${isLight ? 'from-indigo-600 to-violet-600' : 'from-indigo-300 to-violet-300'}`}>
                ZAMDEKAN
              </p>
              <h2 className={`text-sm font-black tracking-tight leading-tight mt-1 truncate ${strongText}`}>
                {zamdekanName || 'Yotoqxona'}
              </h2>
              <p className={`text-[9px] font-medium mt-0.5 truncate ${mutedText}`}>
                {zamdekanFaculty ? zamdekanFaculty.toUpperCase() : 'Fakultet sozlanmagan'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        {!compact && (
          <div className="relative overflow-hidden mb-4 rounded-2xl p-4 bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
            <div className="absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="shrink-0 rounded-lg p-2.5 bg-white/20 text-white">
                <FileText size={16} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] leading-tight text-amber-50">
                  Kutilmoqda
                </p>
                <p className="mt-1.5 text-lg font-black leading-none text-white">
                  {pendingCount} <span className="text-xs font-bold align-middle text-amber-50">ta ariza</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-xs font-bold tracking-wide transition-all ${
                  active
                    ? `bg-gradient-to-r ${item.accent} text-white shadow-lg`
                    : isLight
                      ? 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                      : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                } ${compact ? 'justify-center px-2' : ''}`}
              >
                <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                  active
                    ? 'bg-white/20 text-white'
                    : isLight ? 'bg-slate-100 text-slate-500 group-hover:bg-slate-200' : 'bg-white/[0.04] text-slate-400 group-hover:bg-white/10'
                }`}>
                  <Icon size={16} strokeWidth={2.2} />
                </div>

                {!compact && (
                  <div className="min-w-0 flex-1">
                    <p className={active ? 'text-white' : ''}>{item.label}</p>
                    <p className={`text-[9px] font-medium mt-0.5 truncate ${active ? 'text-white/75' : mutedText}`}>
                      {item.caption}
                    </p>
                  </div>
                )}

                {!compact && item.badge !== undefined && (
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black shadow-[0_0_8px_rgba(244,63,94,0.5)] ${active ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Theme + Logout */}
      <div className={`p-3 border-t space-y-2 ${isLight ? 'border-slate-200/50' : 'border-white/5'}`}>
        {!compact && (
          <div className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${isLight ? 'bg-white/40 border-sky-200/20' : 'bg-white/[0.03] border-white/5'}`}>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-[0.24em] leading-tight ${mutedText}`}>Tema</p>
              <p className={`mt-1 text-xs font-semibold ${strongText}`}>Ko&apos;rinish</p>
            </div>
            <ThemeToggle />
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`flex w-full items-center gap-3 rounded-xl p-3 text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
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
    <div className={`min-h-screen ${shellBg} transition-colors`}>
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Sidebarni yopish"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen border-r backdrop-blur-3xl transition-all duration-300 ${sidebarSurface} ${
          sidebarOpen ? 'w-[280px]' : 'w-[88px]'
        } ${mobileSidebarOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full'} lg:translate-x-0`}
      >
        {renderNavContent(mobileSidebarOpen ? false : !sidebarOpen)}
      </aside>

      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-[280px]' : 'lg:ml-[88px]'}`}>
        <header className={`sticky top-0 z-30 border-b backdrop-blur-2xl relative ${isLight ? 'border-slate-200/80 bg-white/70' : 'border-white/10 bg-[#020617]/72'}`}>
          <div className="absolute inset-x-0 -bottom-px h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500" />
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setMobileSidebarOpen(true)
                  } else {
                    setSidebarOpen((value) => !value)
                  }
                }}
                className={`inline-flex shrink-0 rounded-xl border p-2.5 transition-colors ${isLight ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'}`}
              >
                <Menu size={18} className="lg:hidden" />
                <span className="hidden lg:block">
                  {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </span>
              </button>

              <div className="min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-[0.24em] ${isLight ? 'text-sky-600' : 'text-indigo-400'}`}>Zamdekan Paneli</p>
                <h1 className={`truncate text-base sm:text-lg font-black tracking-tight ${strongText}`}>
                  {activeItem?.label ?? 'Yotoqxona boshqaruvi'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:flex items-center gap-2 rounded-xl px-3 py-2 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-300">
                <Building2 size={14} />
                <span className="text-[11px] font-bold truncate max-w-[160px]">
                  {zamdekanFaculty ? zamdekanFaculty.toUpperCase() : 'Fakultet yo‘q'}
                </span>
              </div>

              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((prev) => !prev)}
                  className={`relative p-2.5 rounded-xl border transition-all hover:scale-105 ${
                    pendingCount > 0
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-500'
                      : isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-white/10 bg-white/5 text-white'
                  }`}
                >
                  <Bell size={18} />
                  {pendingCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 border border-white dark:border-slate-950 animate-pulse" />
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
                        isLight ? 'text-sky-600 hover:bg-slate-50' : 'text-indigo-400 hover:bg-white/5'
                      }`}
                    >
                      Barcha yo&apos;llanmalarni ko&apos;rish
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-screen p-3 sm:p-6 lg:p-8">
          <div className={`min-h-[calc(100vh-7rem)] rounded-2xl sm:rounded-[28px] border p-3 sm:p-6 lg:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ${panelSurface}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
