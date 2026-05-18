'use client'

import React, { useMemo, useState } from 'react'
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
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'

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
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  React.useEffect(() => {
    // Initial check
    setIsMobile(window.innerWidth < 1024)

    // Listen to resize
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const menuItems = useMemo(() => ([
    {
      label: 'Dashboard',
      caption: 'Umumiy ko‘rinish',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
      accent: 'from-sky-500 to-blue-600',
    },
    {
      label: 'Arizalar',
      caption: 'Jarayon nazorati',
      href: '/admin/arizalar',
      icon: FileText,
      accent: 'from-emerald-500 to-green-600',
    },
    {
      label: 'Foydalanuvchilar',
      caption: 'Rollar va kirish',
      href: '/admin/foydalanuvchilar',
      icon: Users,
      accent: 'from-amber-500 to-orange-600',
    },
    {
      label: 'Hisobotlar',
      caption: 'Tahlil va eksport',
      href: '/admin/reports',
      icon: BarChart3,
      accent: 'from-fuchsia-500 to-pink-600',
    },
    {
      label: 'Sozlamalar',
      caption: 'Tizim boshqaruvi',
      href: '/admin/settings',
      icon: Settings,
      accent: 'from-slate-500 to-slate-700',
    },
  ]), [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success("Chiqib ketdingiz!")
      router.push('/login')
    } catch {
      toast.error("Chiqib ketishda xato!")
    }
  }

  const shellBg = isLight ? 'bg-[#f3f6fb]' : 'bg-[#020617]'
  const sidebarSurface = isLight
    ? 'border-slate-200 bg-white/88 text-slate-900'
    : 'border-white/10 bg-[#06101f]/88 text-white'
  const panelSurface = isLight
    ? 'border-slate-200 bg-white/80'
    : 'border-white/10 bg-white/[0.03]'
  const mutedText = isLight ? 'text-slate-500' : 'text-slate-400'
  const strongText = isLight ? 'text-slate-900' : 'text-white'

  // Login va Register sahifalarida sidebar ko'rinmasligi kerak
  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/register'

  if (isAuthPage) {
    return <>{children}</>
  }

  const renderNavContent = (compact: boolean) => (
    <div className="flex h-full flex-col">
      {/* Modern Header */}
      <div className={`relative overflow-hidden backdrop-blur-2xl px-4 py-5 transition-all ${isLight ? 'border-slate-200/50 bg-white/50' : 'border-white/5 bg-gradient-to-b from-white/[0.08] to-white/[0.02]'} border-b`}>
        {/* Animated gradient background */}
        <div className={`absolute inset-0 opacity-40 ${isLight ? 'bg-gradient-to-br from-sky-100 via-blue-50 to-transparent' : 'bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent'}`} />

        <div className="relative flex items-center justify-between gap-4">
          {/* Logo Section */}
          <div className={`flex items-center gap-3 min-w-0 ${compact ? 'justify-center w-full' : ''}`}>
            {/* Icon Container */}
            <div className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-xl backdrop-blur-md border transition-all ${isLight ? 'bg-white/80 border-sky-200 text-sky-600 shadow-lg shadow-sky-200/20' : 'bg-white/[0.08] border-cyan-400/30 text-cyan-300 shadow-lg shadow-cyan-500/10'}`}>
              <ShieldCheck size={20} strokeWidth={2.5} />
            </div>

            {/* Brand Text */}
            {!compact && (
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1">
                  <p className={`text-[10px] font-black uppercase tracking-[0.32em] leading-none ${isLight ? 'text-sky-600' : 'text-cyan-400/80'}`}>
                    ADMIN
                  </p>
                </div>
                <h2 className={`text-sm font-black tracking-tight leading-tight mt-0.5 ${strongText}`}>Yotoqxona</h2>
              </div>
            )}
          </div>

          {/* Divider - compact mode */}
          {compact && (
            <div className={`hidden lg:block h-6 w-px ${isLight ? 'bg-slate-200/30' : 'bg-white/5'}`} />
          )}
        </div>
      </div>

      <div className="flex-1 px-3 py-4 overflow-y-auto">
        {!compact && (
          <div className={`mb-4 rounded-2xl backdrop-blur-xl border p-4 transition-all ${isLight ? 'bg-gradient-to-br from-sky-50/50 to-blue-50/30 border-sky-200/30 shadow-sm shadow-sky-100/20' : 'bg-gradient-to-br from-cyan-500/[0.06] to-blue-500/[0.03] border-cyan-400/20'}`}>
            <div className="flex items-start gap-3">
              <div className={`shrink-0 rounded-lg p-2.5 backdrop-blur-md ${isLight ? 'bg-sky-100/70 text-sky-600' : 'bg-cyan-500/15 text-cyan-300'}`}>
                <Sparkles size={16} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-black uppercase tracking-[0.24em] leading-tight ${isLight ? 'text-sky-700' : 'text-cyan-300'}`}>
                  Boshqaruv
                </p>
                <p className={`mt-2 text-sm font-semibold leading-snug ${strongText}`}>Barcha operatsiyalar bir joydan</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 transition-all duration-200 backdrop-blur-sm ${isActive
                  ? isLight
                    ? 'border-sky-300 bg-gradient-to-r from-sky-100/70 to-blue-100/50 text-sky-800 shadow-sm shadow-sky-300/30'
                    : 'border-cyan-400/30 bg-gradient-to-r from-cyan-500/[0.12] to-blue-500/[0.08] text-white shadow-sm shadow-cyan-500/10'
                  : isLight
                    ? 'border-slate-200/30 text-slate-600 hover:border-slate-300/50 hover:bg-slate-100/30'
                    : 'border-white/5 text-slate-400 hover:border-white/15 hover:bg-white/[0.06] hover:text-white'
                  } ${compact ? 'justify-center px-2' : ''}`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-all backdrop-blur ${isActive
                  ? isLight
                    ? 'border-sky-300 bg-white text-sky-700 shadow-sm shadow-sky-300/25'
                    : 'border-cyan-400/30 bg-white/[0.06] text-cyan-300'
                  : isLight
                    ? 'border-slate-200/40 bg-slate-50/70 text-slate-500 group-hover:bg-slate-100/50 group-hover:text-slate-700'
                    : 'border-white/10 bg-white/[0.02] text-slate-400 group-hover:bg-white/[0.05] group-hover:text-white'
                  }`}>
                  <Icon size={18} strokeWidth={2} />
                </div>

                {!compact && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">{item.label}</p>
                    <p className={`truncate text-[10px] leading-tight mt-0.5 ${isActive ? (isLight ? 'text-sky-700/90' : 'text-cyan-200/70') : mutedText}`}>
                      {item.caption}
                    </p>
                  </div>
                )}

                {!compact && (
                  <ChevronRight
                    size={16}
                    strokeWidth={2}
                    className={`shrink-0 transition-all ${isActive ? 'translate-x-0 opacity-100' : 'translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'} ${isActive ? (isLight ? 'text-sky-600' : 'text-slate-500') : (isLight ? 'text-slate-400' : 'text-slate-600')}`}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      <div className={`border-t backdrop-blur p-3 transition-all ${isLight ? 'border-slate-200/40 bg-white/30' : 'border-white/5 bg-white/[0.02]'}`}>
        <div className={`rounded-xl backdrop-blur-lg border p-3 transition-all ${isLight ? 'bg-white/40 border-sky-200/20 shadow-sm shadow-sky-100/10' : 'bg-white/[0.04] border-cyan-400/15'}`}>
          <div className="flex items-center justify-between gap-2 w-full">
            {!compact && (
              <div>
                <p className={`text-[9px] font-black uppercase tracking-[0.26em] leading-tight ${mutedText}`}>Tema</p>
                <p className={`mt-1 text-xs font-semibold ${strongText}`}>Görünüş</p>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
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
        className={`fixed left-0 top-0 z-50 h-screen border-r backdrop-blur-3xl transition-all duration-300 ${sidebarSurface} ${sidebarOpen ? 'w-[310px]' : 'w-[92px]'
          } ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {renderNavContent(!sidebarOpen)}
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
              {pathname === '/admin/settings' ? (
                <button
                  onClick={handleLogout}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-all ${isLight
                    ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                    : 'border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15'
                    }`}
                >
                  <LogOut size={16} />
                  <span>Chiqib ketish</span>
                </button>
              ) : (
                <>
                  <div className={`rounded-xl p-2 ${isLight ? 'bg-sky-100 text-sky-600' : 'bg-cyan-400/10 text-cyan-300'}`}>
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${mutedText}`}>Holat</p>
                    <p className={`text-sm font-semibold ${strongText}`}>Boshqaruv faol</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className={`min-h-screen p-4 sm:p-6 lg:p-8 ${isLight ? 'text-slate-900' : 'text-white'}`}>
          <div className={`min-h-[calc(100vh-7rem)] rounded-[28px] border p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6 lg:p-8 ${panelSurface}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
