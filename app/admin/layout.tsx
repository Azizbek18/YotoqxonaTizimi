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
import { adminUI } from '@/lib/admin-ui'

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
  const ui = adminUI(isLight)
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
    // First item is the way back to the faculty (dekan) panel. Harmless for
    // a system admin — /dekan/* just redirects them straight back here.
    { label: 'Fakultet paneli', caption: 'Xonalar, yo‘llanmalar, sozlamalar', href: '/dekan/dashboard', icon: LayoutDashboard },
    { label: 'Dashboard', caption: 'Umumiy ko‘rinish', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Arizalar', caption: 'Jarayon nazorati', href: '/admin/arizalar', icon: FileText },
    {
      label: 'To‘lovlar',
      caption: 'Kvitansiyalar',
      href: '/admin/tolovlar',
      icon: CreditCard,
      badge: waitingCount > 0 ? waitingCount : undefined,
    },
    { label: 'Foydalanuvchilar', caption: 'Rollar va kirish', href: '/admin/foydalanuvchilar', icon: Users },
    { label: 'Tarbiyachilar', caption: 'Yangi xodim qo‘shish', href: '/admin/xodimlar', icon: UserCog },
    { label: "E'lonlar", caption: 'Talabalarga xabar', href: '/admin/elonlar', icon: Megaphone },
    { label: 'Hisobotlar', caption: 'Tahlil va eksport', href: '/admin/reports', icon: BarChart3 },
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
      <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-[#f3f4f9]' : 'bg-slate-950'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#4f46e5] border-t-transparent" />
      </div>
    )
  }

  const shellBg = isLight ? 'bg-[#f3f4f9]' : 'bg-slate-950'
  const sidebarSurface = isLight
    ? 'border-slate-200 bg-white text-slate-900 shadow-[6px_0_24px_-12px_rgba(79,70,229,0.12)]'
    : 'border-slate-800 bg-slate-900 text-slate-100 shadow-[6px_0_28px_-12px_rgba(0,0,0,0.7)]'
  const mutedText = ui.muted
  const strongText = ui.strong

  // Login sahifasida sidebar ko'rinmasligi kerak
  const isAuthPage = pathname === '/admin/login'

  if (isAuthPage) {
    return <>{children}</>
  }

  const renderNavContent = (compact: boolean) => (
    <div className="relative flex h-full flex-col select-none no-shelf overflow-hidden" data-sidebar="true">
      {/* Header — brand mark + name, no badge */}
      <div className={`relative px-4 py-4 border-b ${ui.border}`}>
        <div className={`relative flex items-center gap-3 min-w-0 ${compact ? 'justify-center w-full' : ''}`}>
          <div className="shrink-0 flex items-center justify-center h-11 w-11 rounded-2xl bg-[#4f46e5] text-white shadow-[0_4px_0_0_#3730a3]">
            <ShieldCheck size={20} strokeWidth={2.5} />
          </div>

          {!compact && (
            <div className="min-w-0 flex-1">
              <h2 className={`text-sm font-bold tracking-tight leading-snug truncate ${strongText}`}>
                Yotoqxona Boshqaruvi
              </h2>
              <p className={`text-[11px] font-medium truncate ${mutedText}`}>
                Tizim administratori
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-3 py-3 overflow-y-auto space-y-1.5">
        {/* Waiting payments — single-hue call-out */}
        {!compact && waitingCount > 0 && (
          <Link
            href="/admin/tolovlar"
            onClick={() => setMobileSidebarOpen(false)}
            className="group relative block overflow-hidden rounded-2xl p-3.5 mb-2.5 bg-[#4f46e5] text-white shadow-[0_5px_0_0_#3730a3,0_12px_22px_-8px_rgba(79,70,229,0.4)] hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-[0_2px_0_0_#3730a3] transition-all duration-150"
          >
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-white/20 text-white ring-1 ring-white/30">
                  <CreditCard size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/80 leading-tight">
                    To&apos;lovlar
                  </span>
                  <p className="text-sm font-extrabold leading-tight mt-0.5 text-white">
                    {waitingCount} <span className="text-xs font-bold text-white/80">ta kutilmoqda</span>
                  </p>
                </div>
              </div>
              <ChevronRight size={16} strokeWidth={2.5} className="shrink-0 text-white/90 group-hover:translate-x-0.5 transition-transform" />
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
                className={`group relative flex items-center gap-3 rounded-2xl p-2 transition-all duration-150 ${
                  isActive
                    ? isLight
                      ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200 shadow-[0_3px_0_0_#c7d2fe]'
                      : 'bg-indigo-500/12 ring-1 ring-inset ring-indigo-500/25'
                    : isLight
                      ? 'hover:bg-slate-100 hover:translate-x-0.5'
                      : 'hover:bg-slate-800/60 hover:translate-x-0.5'
                } ${compact ? 'justify-center p-2' : ''}`}
              >
                <div
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-[0_2px_0_0_#3730a3]'
                      : isLight
                        ? 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-indigo-600'
                        : 'bg-slate-800 text-slate-400 group-hover:text-indigo-300'
                  }`}
                >
                  <Icon size={17} strokeWidth={2.4} />
                </div>

                {!compact && (
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-bold leading-tight truncate ${
                      isActive
                        ? (isLight ? 'text-indigo-700' : 'text-indigo-300')
                        : (isLight ? 'text-slate-500 group-hover:text-slate-700' : 'text-slate-300')
                    }`}>
                      {item.label}
                    </p>
                    <p className={`text-[10px] font-medium leading-tight mt-0.5 truncate ${
                      isActive
                        ? (isLight ? 'text-indigo-400' : 'text-indigo-400/80')
                        : 'text-slate-400'
                    }`}>
                      {item.caption}
                    </p>
                  </div>
                )}

                {!compact && item.badge !== undefined && (
                  <span className="shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold bg-indigo-600 text-white shadow-[0_2px_0_0_#3730a3]">
                    {item.badge}
                  </span>
                )}

                {!compact && item.badge === undefined && (
                  <ChevronRight
                    size={14}
                    strokeWidth={2.5}
                    className={`shrink-0 transition-all duration-150 ${
                      isActive
                        ? 'opacity-100 translate-x-0 text-indigo-400'
                        : 'opacity-0 -translate-x-1 group-hover:opacity-70 group-hover:translate-x-0 text-slate-400'
                    }`}
                  />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Theme + Logout */}
      <div className={`p-3 border-t space-y-2 mt-auto ${ui.border}`}>
        {!compact ? (
          <div className={`flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2 border ${ui.inset}`}>
            <div>
              <p className={`text-[9px] font-extrabold uppercase tracking-wider leading-none ${mutedText}`}>Tema</p>
              <p className={`mt-0.5 text-xs font-bold ${strongText}`}>Ko&apos;rinish</p>
            </div>
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <ThemeToggle />
          </div>
        )}

        <button
          onClick={() => setShowLogoutConfirm(true)}
          className={`no-shelf group flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-extrabold tracking-wide uppercase transition-all duration-150 active:translate-y-[2px] ${
            isLight
              ? 'text-rose-700 bg-rose-100 hover:bg-rose-200 border border-rose-200'
              : 'text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20'
          } ${compact ? 'justify-center px-2 py-2.5' : ''}`}
        >
          <LogOut size={16} strokeWidth={2.5} className="shrink-0" />
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
        className={`fixed left-0 top-0 z-50 h-screen border-r transition-all duration-300 ${sidebarSurface} ${
          isMobile ? 'w-[280px]' : sidebarOpen ? 'w-[300px]' : 'w-[88px]'
        } ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {renderNavContent(isMobile ? false : !sidebarOpen)}
      </aside>

      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-[300px]' : 'lg:ml-[88px]'}`}>
        <header className={`sticky top-0 z-30 border-b ${ui.border} ${isLight ? 'bg-[#f3f4f9]/85 backdrop-blur-xl' : 'bg-slate-950/80 backdrop-blur-xl'}`}>
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
                className={`no-shelf inline-flex rounded-xl border p-2.5 transition-all active:translate-y-[2px] ${
                  isLight
                    ? 'border-slate-300 bg-white text-slate-700 shadow-[0_3px_0_0_rgba(51,65,85,0.15)] hover:bg-slate-50'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {isMobile ? (
                  <Menu size={18} />
                ) : (
                  sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />
                )}
              </button>

              <h1 className={`truncate text-lg font-bold tracking-tight sm:text-xl ${strongText}`}>
                {menuItems.find((item) => item.href === pathname)?.label ?? 'Admin Panel'}
              </h1>
            </div>
          </div>
        </header>

        <div className={`min-h-screen p-2.5 sm:p-6 lg:p-8 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
          <div className={`min-h-[calc(100vh-7rem)] rounded-2xl sm:rounded-[28px] border p-3 sm:p-6 lg:p-8 ${ui.card}`}>
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
