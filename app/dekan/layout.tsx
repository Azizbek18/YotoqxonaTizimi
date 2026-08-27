'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Boxes,
  Layers3,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Users,
  Megaphone,
  FileSpreadsheet,
  Bell,
  Building2,
  Settings,
  ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useDekanScope } from '@/lib/hooks/useDekanScope'
import { useToastOffset } from '@/lib/hooks/useToastOffset'
import { fetchDekanOverview } from '@/features/permits/client/admin-api'
import { fetchAppSettings } from '@/features/app-settings/client/api'
import { getSafeSession } from '@/lib/auth-session'
import { directionLabel } from '@/lib/directions'
import { supabase } from '@/lib/supabase'

export default function DekanLayout({
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const { faculty: dekanFaculty, fullName: dekanName, resolved: facultyResolved } = useDekanScope()
  useToastOffset(84)
  const [recentPending, setRecentPending] = useState<{ id: string; full_name: string; direction: string; created_at: string | null }[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  // null while unchecked — only render the reminder once we actually know
  // it's missing, never as a false-positive flash before settings load.
  const [ttjNameMissing, setTtjNameMissing] = useState<boolean | null>(null)

  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  useEffect(() => {
    const mountId = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(mountId)
  }, [])

  useEffect(() => {
    if (!facultyResolved) return
    let active = true

    async function fetchPendingPermits() {
      if (!dekanFaculty) {
        setPendingCount(0)
        setRecentPending([])
        return
      }

      // The layout can sit open in a tab long after the session expires —
      // the 15s poll would otherwise hit /api/dekan/overview unauthenticated
      // forever, spamming the console with "Autentifikatsiya talab
      // qilinadi". Check for a live session first and quietly skip the tick
      // if there isn't one, same as admin/layout.tsx's payment poll.
      const session = await getSafeSession()
      if (!session || !active) return

      try {
        const { dashboard } = await fetchDekanOverview()
        if (!active) return
        setPendingCount(dashboard.pendingCount)
        setRecentPending(dashboard.recentRequests.map((request) => ({
          id: request.id,
          full_name: request.full_name,
          direction: request.direction,
          created_at: request.created_at,
        })))
      } catch {
        // Silently swallow unauthenticated background polling errors
      }
    }
    fetchPendingPermits()
    const interval = setInterval(fetchPendingPermits, 15000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [facultyResolved, dekanFaculty])

  // Re-checked on every navigation (not polled — this rarely changes) so
  // the reminder banner below both shows up promptly and clears itself
  // right after the dekan saves it in Sozlamalar and navigates away,
  // rather than staying stale until a hard refresh.
  useEffect(() => {
    let active = true
    async function checkTtjName() {
      const session = await getSafeSession()
      if (!session || !active) return
      try {
        const settings = await fetchAppSettings()
        if (active) setTtjNameMissing(!settings.ttjName.trim())
      } catch {
        // Silently swallow — this is a convenience nag, not critical.
      }
    }
    void checkTtjName()
    return () => { active = false }
  }, [pathname])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Each item keeps its own icon tint as a wayfinding cue (visible whether
  // active or not), while "you are here" is always the same single indigo
  // treatment — matching the admin sidebar's convention instead of diluting
  // "selected" across three unrelated hues.
  const menuItems = useMemo(() => ([
    {
      label: 'Dashboard',
      caption: 'Umumiy hisobot',
      href: '/dekan/dashboard',
      icon: LayoutDashboard,
      gradient: 'from-sky-500 to-blue-600',
      lightBg: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300',
      glow: 'shadow-sky-500/25',
    },
    {
      label: 'Yo‘llanmalar',
      caption: 'Yangi arizalar',
      href: '/dekan/arizalar',
      icon: FileText,
      gradient: 'from-emerald-500 to-teal-600',
      lightBg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
      glow: 'shadow-emerald-500/25',
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      label: 'Xonalar xaritasi',
      caption: 'Joylashtirish holati',
      href: '/dekan/xonalar',
      icon: Boxes,
      gradient: 'from-amber-500 to-orange-600',
      lightBg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300',
      glow: 'shadow-amber-500/25',
    },
    {
      label: '3D Xonalar',
      caption: 'Qavat tarxi quruvchisi',
      href: '/dekan/3d-xonalar',
      icon: Layers3,
      gradient: 'from-cyan-500 to-teal-600',
      lightBg: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300',
      glow: 'shadow-teal-500/25',
    },
    {
      label: 'Talabalar',
      caption: 'Joylashgan talabalar',
      href: '/dekan/talabalar',
      icon: Users,
      gradient: 'from-purple-500 to-violet-600',
      lightBg: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300',
      glow: 'shadow-purple-500/25',
    },
    {
      label: 'E‘lonlar',
      caption: 'Fakultet talabalariga',
      href: '/dekan/elonlar',
      icon: Megaphone,
      gradient: 'from-cyan-500 to-sky-600',
      lightBg: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300',
      glow: 'shadow-cyan-500/25',
    },
    {
      label: 'Hisobotlar',
      caption: 'Excel eksport',
      href: '/dekan/hisobotlar',
      icon: FileSpreadsheet,
      gradient: 'from-emerald-500 to-green-600',
      lightBg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
      glow: 'shadow-emerald-500/25',
    },
    {
      label: 'Sozlamalar',
      caption: 'Tizim boshqaruvi',
      href: '/dekan/sozlamalar',
      icon: Settings,
      gradient: 'from-slate-600 to-slate-800',
      lightBg: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
      glow: 'shadow-slate-500/25',
    },
  ]), [pendingCount])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Chiqib ketdingiz!')
      router.push('/login')
    } catch {
      toast.error('Chiqib ketishda xato!')
    } finally {
      setShowLogoutConfirm(false)
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
    ? 'border-slate-200/90 bg-gradient-to-b from-[#ffffff] via-[#f9fbfe] to-[#f2f6fc] text-slate-900 shadow-[4px_0_30px_rgba(79,70,229,0.06)]'
    : 'border-white/[0.08] bg-gradient-to-b from-[#090e24] via-[#060a1a] to-[#040714] text-white shadow-[4px_0_40px_rgba(0,0,0,0.8)]'
  const panelSurface = isLight
    ? 'bg-white/80 border-slate-200/80 shadow-sm'
    : 'bg-white/[0.02] border-white/10'
  const mutedText = isLight ? 'text-slate-500' : 'text-slate-400'
  const strongText = isLight ? 'text-slate-900' : 'text-white'

  const activeItem = menuItems.find((item) => item.href === pathname)

  const renderNavContent = (compact: boolean) => (
    <div className="relative flex h-full flex-col select-none no-shelf overflow-hidden" data-sidebar="true">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-12 -left-12 h-44 w-44 rounded-full bg-indigo-500/15 blur-3xl dark:bg-indigo-500/20" />
      <div className="pointer-events-none absolute top-1/3 -right-12 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/15" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-500/15" />

      {/* Brand Header */}
      <div className={`relative px-4 py-4 border-b transition-all ${
        isLight
          ? 'border-slate-200/80 bg-white/60 backdrop-blur-md'
          : 'border-white/[0.08] bg-white/[0.02] backdrop-blur-md'
      }`}>
        <div className={`relative flex items-center gap-3 min-w-0 ${compact ? 'justify-center w-full' : ''}`}>
          {/* Glowing 3D Avatar */}
          <div className="shrink-0 relative group">
            <div className="flex items-center justify-center h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-black text-sm shadow-[0_4px_16px_rgba(99,102,241,0.4)] ring-2 ring-white/80 dark:ring-white/20 transition-transform duration-300 group-hover:scale-105">
              {dekanName ? dekanName.trim().charAt(0).toUpperCase() : <UserCog size={20} strokeWidth={2.5} />}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#070b19]" />
            </span>
          </div>

          {!compact && (
            <div className="min-w-0 flex-1">
              <h2 className={`text-xs font-black tracking-tight leading-snug truncate ${strongText}`} title={dekanName || 'Dekan'}>
                {dekanName || 'Dekan Boshqaruvi'}
              </h2>
              <p className={`text-[10px] font-semibold truncate ${mutedText}`} title={dekanFaculty || 'Fakultet'}>
                {dekanFaculty ? dekanFaculty.toUpperCase() : 'Fakultet sozlanmagan'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 px-3 py-3 overflow-y-auto space-y-1.5">
        {/* Holographic "Kutilmoqda" Widget */}
        {!compact && (
          <Link
            href="/dekan/arizalar"
            onClick={() => setMobileSidebarOpen(false)}
            className="group relative block overflow-hidden rounded-2xl p-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-[0_10px_25px_rgba(245,158,11,0.3)] hover:shadow-[0_14px_32px_rgba(245,158,11,0.45)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 mb-2.5"
          >
            {/* Shimmer / light effect */}
            <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-white/20 blur-xl pointer-events-none transition-transform duration-500 group-hover:scale-150" />
            <div className="absolute -left-6 -top-6 h-20 w-20 rounded-full bg-yellow-300/30 blur-lg pointer-events-none" />

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-white/25 backdrop-blur-md text-white shadow-sm ring-1 ring-white/40 group-hover:rotate-6 transition-transform duration-300">
                  <FileText size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-100 leading-tight">
                      Kutilmoqda
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  </div>
                  <p className="text-sm font-black leading-tight mt-0.5 text-white">
                    {pendingCount} <span className="text-xs font-bold text-amber-100">ta yangi ariza</span>
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-white/25 backdrop-blur-sm text-white group-hover:translate-x-1 transition-transform duration-200">
                <ChevronRight size={16} strokeWidth={2.5} />
              </div>
            </div>
          </Link>
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
                className={`group relative flex items-center gap-3 rounded-2xl p-2 transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 text-white shadow-[0_8px_25px_rgba(79,70,229,0.35)] ring-1 ring-white/30 scale-[1.01]'
                    : isLight
                      ? 'bg-white/80 border border-slate-200/80 hover:bg-white hover:border-indigo-400/40 hover:shadow-[0_8px_20px_rgba(79,70,229,0.08)] hover:translate-x-1 text-slate-700'
                      : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:border-indigo-400/30 hover:shadow-[0_8px_20px_rgba(0,0,0,0.5)] hover:translate-x-1 text-slate-300 hover:text-white'
                } ${compact ? 'justify-center p-2' : ''}`}
              >
                {/* 3D Themed Squircle Icon */}
                <div
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${
                    active
                      ? 'bg-white/20 backdrop-blur-md text-white ring-1 ring-white/40 shadow-inner'
                      : `bg-gradient-to-br ${item.gradient} text-white shadow-md ${item.glow} ring-1 ring-white/20`
                  }`}
                >
                  <Icon size={17} strokeWidth={2.3} />
                </div>

                {!compact && (
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-black leading-tight truncate ${active ? 'text-white' : (isLight ? 'text-slate-800' : 'text-slate-100')} group-hover:text-indigo-600 dark:group-hover:text-white transition-colors`}>
                      {item.label}
                    </p>
                    <p className={`text-[10px] font-medium leading-tight mt-0.5 truncate ${active ? 'text-indigo-100' : mutedText}`}>
                      {item.caption}
                    </p>
                  </div>
                )}

                {!compact && item.badge !== undefined && (
                  <span className="shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-[0_2px_10px_rgba(244,63,94,0.5)] animate-pulse">
                    {item.badge}
                  </span>
                )}

                {!compact && !item.badge && (
                  <div className={`shrink-0 transition-transform duration-200 ${active ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 group-hover:opacity-80 group-hover:translate-x-0'}`}>
                    <ChevronRight size={14} strokeWidth={2.5} className={active ? 'text-white' : 'text-slate-400'} />
                  </div>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Theme + Live Status + Logout */}
      <div className={`p-3 border-t space-y-2 mt-auto ${
        isLight
          ? 'border-slate-200/80 bg-white/60 backdrop-blur-md'
          : 'border-white/[0.08] bg-white/[0.02] backdrop-blur-md'
      }`}>
        {!compact ? (
          <>
            <div className={`flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2 border transition-all ${
              isLight ? 'bg-white/80 border-slate-200/80 shadow-xs' : 'bg-white/[0.04] border-white/[0.08]'
            }`}>
              <div>
                <p className={`text-[9px] font-black uppercase tracking-wider leading-none ${mutedText}`}>Tema</p>
                <p className={`mt-0.5 text-xs font-bold ${strongText}`}>Ko&apos;rinish</p>
              </div>
              <ThemeToggle />
            </div>
          </>
        ) : (
          <div className="flex justify-center py-1">
            <ThemeToggle />
          </div>
        )}

        <button
          onClick={() => setShowLogoutConfirm(true)}
          className={`group flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-black tracking-wider uppercase transition-all duration-200 active:scale-95 ${
            isLight
              ? 'text-rose-700 bg-rose-100 hover:bg-gradient-to-r hover:from-rose-500 hover:to-red-600 hover:text-white border border-rose-300 hover:border-transparent shadow-sm hover:shadow-[0_8px_20px_rgba(244,63,94,0.35)]'
              : 'text-rose-400 bg-rose-500/10 hover:bg-gradient-to-r hover:from-rose-500 hover:to-red-600 hover:text-white border border-rose-500/20 hover:border-transparent hover:shadow-[0_8px_25px_rgba(244,63,94,0.4)]'
          } ${compact ? 'justify-center px-2 py-2.5' : ''}`}
        >
          <LogOut size={16} strokeWidth={2.5} className="shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-x-0.5" />
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
                <p className={`text-[10px] font-black uppercase tracking-[0.24em] ${isLight ? 'text-sky-600' : 'text-indigo-400'}`}>Dekan Paneli</p>
                <h1 className={`truncate text-base sm:text-lg font-black tracking-tight ${strongText}`}>
                  {activeItem?.label ?? 'Yotoqxona boshqaruvi'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:flex items-center gap-2 rounded-xl px-3 py-2 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-300">
                <Building2 size={14} />
                <span className="text-[11px] font-bold truncate max-w-[160px]">
                  {dekanFaculty ? dekanFaculty.toUpperCase() : 'Fakultet yo‘q'}
                </span>
              </div>

              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((prev) => !prev)}
                  className={`relative px-2.5 py-2.5 rounded-xl border transition-all hover:scale-105 ${
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
                          {dekanFaculty ? 'Kutilayotgan yo\'llanma yo\'q.' : 'Fakultet sozlanmagan.'}
                        </p>
                      ) : (
                        recentPending.map((item) => (
                          <Link
                            key={item.id}
                            href={`/dekan/arizalar?id=${item.id}`}
                            onClick={() => setNotifOpen(false)}
                            className={`block px-4 py-3 border-b last:border-b-0 transition-colors ${
                              isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/5 hover:bg-white/5'
                            }`}
                          >
                            <p className="text-xs font-bold truncate">{item.full_name}</p>
                            <p className={`text-[11px] mt-0.5 truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{directionLabel(item.direction)}</p>
                          </Link>
                        ))
                      )}
                    </div>
                    <Link
                      href="/dekan/arizalar"
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
          {ttjNameMissing && pathname !== '/dekan/sozlamalar' && (
            <Link
              href="/dekan/sozlamalar"
              className={`mb-4 flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4 transition-all hover:-translate-y-0.5 ${
                isLight ? 'border-amber-200 bg-amber-50 hover:bg-amber-100' : 'border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/15'
              }`}
            >
              <ShieldAlert size={18} className="shrink-0 text-amber-500" />
              <p className={`min-w-0 flex-1 text-xs font-bold ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                TTJ nomi hali kiritilmagan — xorijlik/imtiyozli talabalar arizasida &laquo;___-sonli talabalar turar joyi&raquo; bo&apos;sh chiqadi.
                <span className="underline"> Sozlamalardan kiriting</span>.
              </p>
            </Link>
          )}
          <div className={`min-h-[calc(100vh-7rem)] rounded-2xl sm:rounded-[28px] border p-3 sm:p-6 lg:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ${panelSurface}`}>
            {children}
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Chiqishni tasdiqlang"
        description="Rostdan ham tizimdan chiqmoqchimisiz?"
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        confirmText="Ha, chiqish"
        confirmVariant="danger"
      />
    </div>
  )
}
