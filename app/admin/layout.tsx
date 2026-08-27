'use client'

import React, { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  UserCog,
  CreditCard,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getSafeSession } from '@/lib/auth-session'
import { fetchAdminPaymentSummary } from '@/features/payments/client/api'
import { useToastOffset } from '@/lib/hooks/useToastOffset'
import { FontScopeProvider } from '@/lib/font-scope-context'
import { appFont as baloo2 } from '@/lib/app-font'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [waitingCount, setWaitingCount] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  useToastOffset(88)

  useEffect(() => {
    const mountId = window.setTimeout(() => {
      setMounted(true)
      setIsMobile(window.innerWidth < 1024)
    }, 0)

    // Listen to resize
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
    let active = true

    async function fetchWaitingPayments() {
      if (pathname.startsWith('/admin/login')) {
        return
      }

      const session = await getSafeSession()
      if (!session || !active) return

      try {
        const summary = await fetchAdminPaymentSummary()
        if (active && summary) {
          setWaitingCount(summary.waitingCount || 0)
        }
      } catch {
        // Silently swallow unauthenticated background polling errors
      }
    }

    fetchWaitingPayments()
    const interval = setInterval(fetchWaitingPayments, 15000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [pathname])

  const menuItems = useMemo(() => ([
    {
      label: 'Dashboard',
      caption: 'Umumiy ko‘rinish',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
      gradient: 'from-sky-500 to-blue-600',
      lightBg: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300',
      glow: 'shadow-sky-500/25',
    },
    {
      label: 'Arizalar',
      caption: 'Jarayon nazorati',
      href: '/admin/arizalar',
      icon: FileText,
      gradient: 'from-emerald-500 to-green-600',
      lightBg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
      glow: 'shadow-emerald-500/25',
    },
    {
      label: 'To‘lovlar',
      caption: 'Kvitansiyalar',
      href: '/admin/tolovlar',
      icon: CreditCard,
      gradient: 'from-cyan-500 to-blue-600',
      lightBg: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300',
      glow: 'shadow-cyan-500/25',
      badge: waitingCount > 0 ? waitingCount : undefined,
    },
    {
      label: 'Foydalanuvchilar',
      caption: 'Rollar va kirish',
      href: '/admin/foydalanuvchilar',
      icon: Users,
      gradient: 'from-amber-500 to-orange-600',
      lightBg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300',
      glow: 'shadow-amber-500/25',
    },
    {
      label: 'Tarbiyachilar',
      caption: 'Yangi xodim qo‘shish',
      href: '/admin/xodimlar',
      icon: UserCog,
      gradient: 'from-purple-500 to-violet-600',
      lightBg: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300',
      glow: 'shadow-purple-500/25',
    },
    {
      label: "E'lonlar",
      caption: 'Talabalarga xabar',
      href: '/admin/elonlar',
      icon: Megaphone,
      gradient: 'from-violet-500 to-purple-600',
      lightBg: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300',
      glow: 'shadow-violet-500/25',
    },
    {
      label: 'Hisobotlar',
      caption: 'Tahlil va eksport',
      href: '/admin/reports',
      icon: BarChart3,
      gradient: 'from-fuchsia-500 to-pink-600',
      lightBg: 'bg-fuchsia-500/10 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-300',
      glow: 'shadow-fuchsia-500/25',
    },
  ]), [waitingCount])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success("Chiqib ketdingiz!")
      router.push('/login')
    } catch {
      toast.error("Chiqib ketishda xato!")
    } finally {
      setShowLogoutConfirm(false)
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
    ? 'border-slate-200/90 bg-gradient-to-b from-[#ffffff] via-[#f9fbfe] to-[#f2f6fc] text-slate-900 shadow-[4px_0_30px_rgba(14,165,233,0.06)]'
    : 'border-white/[0.08] bg-gradient-to-b from-[#090e24] via-[#060a1a] to-[#040714] text-white shadow-[4px_0_40px_rgba(0,0,0,0.8)]'
  const panelSurface = isLight
    ? 'border-slate-200/80 bg-white/80 shadow-sm'
    : 'border-white/10 bg-white/[0.03]'
  const mutedText = isLight ? 'text-slate-500' : 'text-slate-400'
  const strongText = isLight ? 'text-slate-900' : 'text-white'

  // Login sahifasida sidebar ko'rinmasligi kerak
  const isAuthPage = pathname === '/admin/login'

  if (isAuthPage) {
    return <>{children}</>
  }

  const renderNavContent = (compact: boolean) => (
    <div className="relative flex h-full flex-col select-none no-shelf overflow-hidden" data-sidebar="true">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-12 -left-12 h-44 w-44 rounded-full bg-cyan-500/15 blur-3xl dark:bg-cyan-500/20" />
      <div className="pointer-events-none absolute top-1/3 -right-12 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/15" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl dark:bg-teal-500/15" />

      {/* Modern Header */}
      <div className={`relative px-4 py-4 border-b transition-all ${
        isLight
          ? 'border-slate-200/80 bg-white/60 backdrop-blur-md'
          : 'border-white/[0.08] bg-white/[0.02] backdrop-blur-md'
      }`}>
        <div className={`relative flex items-center gap-3 min-w-0 ${compact ? 'justify-center w-full' : ''}`}>
          {/* Glowing Avatar */}
          <div className="shrink-0 relative group">
            <div className="flex items-center justify-center h-11 w-11 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white font-black text-sm shadow-[0_4px_16px_rgba(14,165,233,0.4)] ring-2 ring-white/80 dark:ring-white/20 transition-transform duration-300 group-hover:scale-105">
              <ShieldCheck size={20} strokeWidth={2.5} />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#06101f]" />
            </span>
          </div>

          {!compact && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_2px_8px_rgba(14,165,233,0.35)]">
                  <Sparkles size={10} className="text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
                  ADMIN
                </span>
              </div>
              <h2 className={`text-xs font-black tracking-tight leading-snug mt-1 truncate ${strongText}`}>
                Yotoqxona Boshqaruvi
              </h2>
              <p className={`text-[10px] font-semibold truncate ${mutedText}`}>
                Tizim administratori
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-3 py-3 overflow-y-auto space-y-1.5">
        {/* Rich Waiting Payments Widget */}
        {!compact && waitingCount > 0 && (
          <Link
            href="/admin/tolovlar"
            onClick={() => setMobileSidebarOpen(false)}
            className="group relative block overflow-hidden rounded-2xl p-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-[0_10px_25px_rgba(245,158,11,0.3)] hover:shadow-[0_14px_32px_rgba(245,158,11,0.45)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 mb-2.5"
          >
            <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-white/20 blur-xl pointer-events-none transition-transform duration-500 group-hover:scale-150" />
            <div className="absolute -left-6 -top-6 h-20 w-20 rounded-full bg-yellow-300/30 blur-lg pointer-events-none" />

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-white/25 backdrop-blur-md text-white shadow-sm ring-1 ring-white/40 group-hover:rotate-6 transition-transform duration-300">
                  <CreditCard size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-100 leading-tight">
                      To&apos;lovlar
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  </div>
                  <p className="text-sm font-black leading-tight mt-0.5 text-white">
                    {waitingCount} <span className="text-xs font-bold text-amber-100">ta kutilmoqda</span>
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
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`group relative flex items-center gap-3 rounded-2xl p-2 transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 text-white shadow-[0_8px_25px_rgba(14,165,233,0.35)] ring-1 ring-white/30 scale-[1.01]'
                    : isLight
                      ? 'bg-white/80 border border-slate-200/80 hover:bg-white hover:border-sky-400/40 hover:shadow-[0_8px_20px_rgba(14,165,233,0.08)] hover:translate-x-1 text-slate-700'
                      : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:border-cyan-400/30 hover:shadow-[0_8px_20px_rgba(0,0,0,0.5)] hover:translate-x-1 text-slate-300 hover:text-white'
                } ${compact ? 'justify-center p-2' : ''}`}
              >
                {/* 3D Themed Squircle Icon */}
                <div
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${
                    isActive
                      ? 'bg-white/20 backdrop-blur-md text-white ring-1 ring-white/40 shadow-inner'
                      : `bg-gradient-to-br ${item.gradient} text-white shadow-md ${item.glow} ring-1 ring-white/20`
                  }`}
                >
                  <Icon size={17} strokeWidth={2.3} />
                </div>

                {!compact && (
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-black leading-tight truncate ${isActive ? 'text-white' : (isLight ? 'text-slate-800' : 'text-slate-100')} group-hover:text-sky-600 dark:group-hover:text-white transition-colors`}>
                      {item.label}
                    </p>
                    <p className={`text-[10px] font-medium leading-tight mt-0.5 truncate ${isActive ? 'text-sky-100' : mutedText}`}>
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
                  <div className={`shrink-0 transition-transform duration-200 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 group-hover:opacity-80 group-hover:translate-x-0'}`}>
                    <ChevronRight size={14} strokeWidth={2.5} className={isActive ? 'text-white' : 'text-slate-400'} />
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
            {/* Live System Beacon */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>Tizim holati</span>
              </div>
              <span className="font-extrabold uppercase tracking-wider text-[9px]">Onlayn</span>
            </div>

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
    <FontScopeProvider value={baloo2.style.fontFamily}>
    <div className={`baloo-scope min-h-screen ${shellBg} transition-colors`} style={{ fontFamily: baloo2.style.fontFamily }}>
      {/* Every /admin/* page (dashboard, foydalanuvchilar, tolovlar, arizalar,
          elonlar, reports) renders through this layout
          via {children}, and each uses `font-sans` wrappers / plain h1-h6
          headings that resolve through the global --app-font-sans /
          --app-font-display custom properties. Overriding those two
          variables here — instead of editing every admin page — cascades
          Baloo 2 through the entire admin section for free, since CSS
          custom properties inherit down the tree. (/admin/login is exempt
          — it returns early above and renders its own full-page markup,
          see that page's own Baloo 2 setup.) */}
      <style dangerouslySetInnerHTML={{ __html: `
        .baloo-scope {
          --app-font-sans: ${baloo2.style.fontFamily};
          --app-font-display: ${baloo2.style.fontFamily};
        }
      `}} />
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
          isMobile ? 'w-[280px]' : sidebarOpen ? 'w-[310px]' : 'w-[92px]'
        } ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {renderNavContent(isMobile ? false : !sidebarOpen)}
      </aside>

      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-[310px]' : 'lg:ml-[92px]'}`}>
        <header className={`sticky top-0 z-30 border-b backdrop-blur-2xl ${isLight ? 'border-slate-200/80 bg-white/70' : 'border-white/10 bg-[#020817]/72'}`}>
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (isMobile) {
                    setMobileSidebarOpen(true)
                  } else {
                    setSidebarOpen((value) => !value)
                  }
                }}
                className={`inline-flex rounded-2xl border p-3 transition-colors ${isLight ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'}`}
              >
                {isMobile ? (
                  <Menu size={18} />
                ) : (
                  sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />
                )}
              </button>

              <div className="min-w-0">
                <p className={`text-[11px] font-black uppercase tracking-[0.26em] ${mutedText}`}>Admin Workspace</p>
                <h1 className={`truncate text-lg font-black tracking-tight sm:text-xl ${strongText}`}>
                  {menuItems.find((item) => item.href === pathname)?.label ?? 'Admin Panel'}
                </h1>
              </div>
            </div>

            <div className={`hidden items-center gap-3 rounded-2xl border px-4 py-2 sm:flex ${panelSurface}`}>
              <div className={`rounded-xl p-2 ${isLight ? 'bg-sky-100 text-sky-600' : 'bg-cyan-400/10 text-cyan-300'}`}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${mutedText}`}>Holat</p>
                <p className={`text-sm font-semibold ${strongText}`}>Boshqaruv faol</p>
              </div>
            </div>
          </div>
        </header>

        <div className={`min-h-screen p-2.5 sm:p-6 lg:p-8 ${isLight ? 'text-slate-900' : 'text-white'}`}>
          <div className={`min-h-[calc(100vh-7rem)] rounded-2xl sm:rounded-[28px] border p-3 sm:p-6 lg:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ${panelSurface}`}>
            {children}
          </div>
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
    </FontScopeProvider>
  )
}
