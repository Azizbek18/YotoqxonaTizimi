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
import { dekanUI } from '@/lib/dekan-ui'
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
  const ui = dekanUI(isLight)

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

  const menuItems = useMemo(() => ([
    { label: 'Dashboard', caption: 'Umumiy hisobot', href: '/dekan/dashboard', icon: LayoutDashboard },
    { label: 'Yo‘llanmalar', caption: 'Yangi arizalar', href: '/dekan/arizalar', icon: FileText, badge: pendingCount > 0 ? pendingCount : undefined },
    { label: 'Xonalar xaritasi', caption: 'Joylashtirish holati', href: '/dekan/xonalar', icon: Boxes },
    { label: '3D Xonalar', caption: 'Qavat tarxi quruvchisi', href: '/dekan/3d-xonalar', icon: Layers3 },
    { label: 'Talabalar', caption: 'Joylashgan talabalar', href: '/dekan/talabalar', icon: Users },
    { label: 'E‘lonlar', caption: 'Fakultet talabalariga', href: '/dekan/elonlar', icon: Megaphone },
    { label: 'Hisobotlar', caption: 'Excel eksport', href: '/dekan/hisobotlar', icon: FileSpreadsheet },
    { label: 'Sozlamalar', caption: 'Tizim boshqaruvi', href: '/dekan/sozlamalar', icon: Settings },
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
      </div>
    )
  }

  const activeItem = menuItems.find((item) => item.href === pathname)

  const renderNavContent = (compact: boolean) => (
    <div className="relative flex h-full flex-col select-none no-shelf overflow-hidden" data-sidebar="true">
      {/* Brand header */}
      <div className={`px-4 py-4 border-b ${ui.border}`}>
        <div className={`flex items-center gap-3 min-w-0 ${compact ? 'justify-center w-full' : ''}`}>
          <div className="shrink-0 relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-sm">
              {dekanName ? dekanName.trim().charAt(0).toUpperCase() : <UserCog size={20} strokeWidth={2.4} />}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ${isLight ? 'ring-white' : 'ring-slate-950'}`} />
          </div>

          {!compact && (
            <div className="min-w-0 flex-1">
              <h2 className={`text-xs font-bold tracking-tight leading-snug truncate ${ui.strong}`} title={dekanName || 'Dekan'}>
                {dekanName || 'Dekan Boshqaruvi'}
              </h2>
              <p className={`text-[10px] font-medium truncate ${ui.muted}`} title={dekanFaculty || 'Fakultet'}>
                {dekanFaculty ? dekanFaculty.toUpperCase() : 'Fakultet sozlanmagan'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 px-3 py-3 overflow-y-auto">
        {!compact && pendingCount > 0 && (
          <Link
            href="/dekan/arizalar"
            onClick={() => setMobileSidebarOpen(false)}
            className={`mb-3 flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${ui.inset} hover:border-indigo-400/50`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${ui.muted}`}>Kutilmoqda</p>
                <p className={`text-sm font-bold leading-tight ${ui.strong}`}>
                  {pendingCount} <span className={`text-xs font-medium ${ui.muted}`}>ta yangi ariza</span>
                </p>
              </div>
            </div>
            <ChevronRight size={16} className={ui.faint} />
          </Link>
        )}

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`group relative flex items-center gap-3 rounded-xl p-2 transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : `${ui.body} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800/70'}`
                } ${compact ? 'justify-center p-2' : ''}`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active
                      ? 'bg-white/15 text-white'
                      : isLight ? 'bg-slate-100 text-slate-500 group-hover:text-slate-700' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  <Icon size={17} strokeWidth={2.1} />
                </div>

                {!compact && (
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold leading-tight truncate ${active ? 'text-white' : ui.strong}`}>
                      {item.label}
                    </p>
                    <p className={`text-[10px] font-medium leading-tight mt-0.5 truncate ${active ? 'text-indigo-100' : ui.muted}`}>
                      {item.caption}
                    </p>
                  </div>
                )}

                {!compact && item.badge !== undefined && (
                  <span className={`shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                    active ? 'bg-white/20 text-white' : isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-700 text-slate-200'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Theme + logout */}
      <div className={`p-3 border-t space-y-2 mt-auto ${ui.border}`}>
        {!compact ? (
          <div className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2 ${ui.inset}`}>
            <div>
              <p className={`text-[9px] font-semibold uppercase tracking-wider leading-none ${ui.muted}`}>Tema</p>
              <p className={`mt-0.5 text-xs font-bold ${ui.strong}`}>Ko&apos;rinish</p>
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
          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold tracking-wide uppercase transition-colors ${ui.dangerSoft} ${compact ? 'justify-center px-2' : ''}`}
        >
          <LogOut size={16} strokeWidth={2.3} className="shrink-0" />
          {!compact && <span>Chiqish</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className={`min-h-screen ${ui.shell} transition-colors`}>
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Sidebarni yopish"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen border-r transition-all duration-300 ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        } ${sidebarOpen ? 'w-[280px]' : 'w-[88px]'} ${
          mobileSidebarOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {renderNavContent(mobileSidebarOpen ? false : !sidebarOpen)}
      </aside>

      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-[280px]' : 'lg:ml-[88px]'}`}>
        <header className={`sticky top-0 z-30 border-b ${isLight ? 'border-slate-200 bg-white/85' : 'border-slate-800 bg-slate-950/80'} backdrop-blur`}>
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
                className={`inline-flex shrink-0 rounded-lg border p-2.5 transition-colors ${ui.btnGhost}`}
              >
                <Menu size={18} className="lg:hidden" />
                <span className="hidden lg:block">
                  {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </span>
              </button>

              <div className="min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${ui.accentText}`}>Dekan Paneli</p>
                <h1 className={`truncate text-base sm:text-lg font-bold tracking-tight ${ui.strong}`}>
                  {activeItem?.label ?? 'Yotoqxona boshqaruvi'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`hidden md:flex items-center gap-2 rounded-lg border px-3 py-2 ${ui.inset} ${ui.muted}`}>
                <Building2 size={14} />
                <span className="text-[11px] font-semibold truncate max-w-[160px]">
                  {dekanFaculty ? dekanFaculty.toUpperCase() : 'Fakultet yo‘q'}
                </span>
              </div>

              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((prev) => !prev)}
                  className={`relative rounded-lg border p-2.5 transition-colors ${ui.btnGhost}`}
                >
                  <Bell size={18} />
                  {pendingCount > 0 && (
                    <span className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ${isLight ? 'ring-white' : 'ring-slate-950'}`} />
                  )}
                </button>

                {notifOpen && (
                  <div className={`absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border shadow-lg z-50 overflow-hidden ${ui.card}`}>
                    <div className={`px-4 py-3 border-b text-xs font-bold uppercase tracking-wider ${ui.border} ${ui.body}`}>
                      Kutilayotgan yo&apos;llanmalar {pendingCount > 0 && `(${pendingCount})`}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {recentPending.length === 0 ? (
                        <p className={`px-4 py-6 text-center text-xs ${ui.faint}`}>
                          {dekanFaculty ? 'Kutilayotgan yo\'llanma yo\'q.' : 'Fakultet sozlanmagan.'}
                        </p>
                      ) : (
                        recentPending.map((item) => (
                          <Link
                            key={item.id}
                            href={`/dekan/arizalar?id=${item.id}`}
                            onClick={() => setNotifOpen(false)}
                            className={`block px-4 py-3 border-b last:border-b-0 transition-colors ${ui.border} ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/60'}`}
                          >
                            <p className={`text-xs font-semibold truncate ${ui.strong}`}>{item.full_name}</p>
                            <p className={`text-[11px] mt-0.5 truncate ${ui.muted}`}>{directionLabel(item.direction)}</p>
                          </Link>
                        ))
                      )}
                    </div>
                    <Link
                      href="/dekan/arizalar"
                      onClick={() => setNotifOpen(false)}
                      className={`block px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.accentText} ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/60'}`}
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
              className={`mb-4 flex items-center gap-3 rounded-xl border p-3.5 sm:p-4 transition-colors ${
                isLight ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/70' : 'border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/15'
              }`}
            >
              <ShieldAlert size={18} className={`shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
              <p className={`min-w-0 flex-1 text-xs font-medium ${isLight ? 'text-amber-800' : 'text-amber-200'}`}>
                TTJ nomi hali kiritilmagan — xorijlik/imtiyozli talabalar arizasida &laquo;___-sonli talabalar turar joyi&raquo; bo&apos;sh chiqadi.
                <span className="font-semibold underline"> Sozlamalardan kiriting</span>.
              </p>
            </Link>
          )}
          <div className={`min-h-[calc(100vh-7rem)] rounded-2xl border p-3 sm:p-6 lg:p-8 ${ui.card}`}>
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
