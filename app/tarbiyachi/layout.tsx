'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Boxes,
  Layers3,
  Users,
  ClipboardList,
  ClipboardCheck,
  Megaphone,
  FileSpreadsheet,
  Wallet,
  Settings,
  Bell,
  Building2,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserCog,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { SkelShell } from '@/components/ui/skeletons'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useDekanScope } from '@/lib/hooks/useDekanScope'
import { useToastOffset } from '@/lib/hooks/useToastOffset'
import { getAuthHeaders, getSafeSession } from '@/lib/auth-session'
import { permitFacultyLabel } from '@/lib/faculties'
import { dekanUI } from '@/lib/dekan-ui'
import { supabase } from '@/lib/supabase'

// Mirrors the dekan panel's navigation, minus Yo'llanmalar (permits) and the
// superadmin-only sections. Every page here is the shared dekan component
// rendered read-only (see useStaffPanel), except Yo'qlama and To'lovlar
// which stay genuine tarbiyachi responsibilities.
const NAV = [
  { label: 'Dashboard', caption: 'Umumiy holat', href: '/tarbiyachi/dashboard', icon: LayoutDashboard },
  { label: 'Xonalar xaritasi', caption: 'Joylashuv holati', href: '/tarbiyachi/xonalar', icon: Boxes },
  { label: '3D Xonalar', caption: 'Qavat tarxi', href: '/tarbiyachi/3d-xonalar', icon: Layers3 },
  { label: 'Talabalar', caption: 'Yotoqxona aholisi', href: '/tarbiyachi/talabalar', icon: Users },
  { label: 'Arizalar', caption: 'Talaba murojaatlari', href: '/tarbiyachi/arizalar', icon: ClipboardList },
  { label: 'Yo‘qlama', caption: 'Kunlik nazorat', href: '/tarbiyachi/yoqlama', icon: ClipboardCheck },
  { label: 'To‘lovlar', caption: 'Chek tasdiqlash', href: '/tarbiyachi/tolovlar', icon: Wallet },
  { label: 'E‘lonlar', caption: 'Talabalarga', href: '/tarbiyachi/elonlar', icon: Megaphone },
  { label: 'Hisobotlar', caption: 'Excel eksport', href: '/tarbiyachi/hisobotlar', icon: FileSpreadsheet },
  { label: 'Sozlamalar', caption: 'Tizim ma‘lumoti', href: '/tarbiyachi/sozlamalar', icon: Settings },
] as const

interface PendingAriza {
  id: string
  student_name: string
  text: string
  status: string
}

export default function TarbiyachiLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const ui = dekanUI(isLight)
  useToastOffset(84)

  const { fullName, faculty } = useDekanScope()
  const [mounted, setMounted] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [pending, setPending] = useState<PendingAriza[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mountId = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(mountId)
  }, [])

  useEffect(() => {
    let active = true
    async function loadPending() {
      const session = await getSafeSession()
      if (!session || !active) return
      try {
        const headers = await getAuthHeaders()
        const response = await fetch('/api/staff/arizalar', { headers })
        const result = (await response.json()) as { ok: boolean; requests?: PendingAriza[] }
        if (active && response.ok && result.ok) {
          setPending((result.requests ?? []).filter((r) => r.status === 'pending').slice(0, 6))
        }
      } catch {
        // background poll — stay quiet on a transient failure
      }
    }
    void loadPending()
    const interval = setInterval(loadPending, 30_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeItem = useMemo(
    () => NAV.find((item) => item.href === pathname),
    [pathname],
  )

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Tizimdan chiqdingiz')
      router.push('/login')
    } catch {
      toast.error('Chiqishda xato')
    } finally {
      setShowLogoutConfirm(false)
    }
  }

  if (!mounted) {
    return <SkelShell />
  }

  const facultyLabel = faculty ? (permitFacultyLabel(faculty) || faculty.toUpperCase()) : 'Fakultet yo‘q'

  const renderNavContent = (compact: boolean) => (
    <div className="relative flex h-full flex-col select-none no-shelf overflow-hidden" data-sidebar="true">
      <div className={`px-4 py-4 border-b ${ui.border}`}>
        <div className={`flex items-center gap-3 min-w-0 ${compact ? 'justify-center w-full' : ''}`}>
          <div className="shrink-0 relative">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold text-sm ${ui.accentTile}`}>
              {fullName ? fullName.trim().charAt(0).toUpperCase() : <UserCog size={20} strokeWidth={2.4} />}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ${isLight ? 'ring-white' : 'ring-slate-900'}`} />
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <h2 className={`text-xs font-bold tracking-tight leading-snug truncate ${ui.strong}`} title={fullName || 'Tarbiyachi'}>
                {fullName || 'Tarbiyachi'}
              </h2>
              <p className={`text-[10px] font-medium truncate ${ui.muted}`}>
                TARBIYACHI · {faculty ? faculty.toUpperCase() : '—'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-3 py-3 overflow-y-auto">
        <nav className="space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`group relative flex items-center gap-3 rounded-xl p-2 transition-all ${
                  active
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_6px_18px_-6px_rgba(79,70,229,0.5)]'
                    : `${ui.body} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800/70'}`
                } ${compact ? 'justify-center p-2' : ''}`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    active
                      ? 'bg-white/15 text-white'
                      : isLight
                        ? 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-indigo-500/15 group-hover:text-indigo-300'
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
                {!compact && item.href === '/tarbiyachi/arizalar' && pending.length > 0 && (
                  <span className={`shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                    active ? 'bg-white/20 text-white' : isLight ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/15 text-indigo-300'
                  }`}>
                    {pending.length}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

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
          <span className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
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
                <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${ui.accentText}`}>
                  Tarbiyachi paneli
                </p>
                <h1 className={`truncate text-base sm:text-lg font-bold tracking-tight ${ui.strong}`}>
                  {activeItem?.label ?? 'Yotoqxona nazorati'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`hidden md:flex items-center gap-2 rounded-lg border px-3 py-2 ${ui.inset} ${ui.muted}`}>
                <Building2 size={14} />
                <span className="text-[11px] font-semibold truncate max-w-[160px]">{facultyLabel}</span>
              </div>

              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((prev) => !prev)}
                  className={`relative rounded-lg border p-2.5 transition-colors ${ui.btnGhost}`}
                >
                  <Bell size={18} />
                  {pending.length > 0 && (
                    <span className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ${isLight ? 'ring-white' : 'ring-slate-950'}`} />
                  )}
                </button>
                {notifOpen && (
                  <div className={`absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border shadow-lg z-50 overflow-hidden ${ui.card}`}>
                    <div className={`px-4 py-3 border-b text-xs font-bold uppercase tracking-wider ${ui.border} ${ui.body}`}>
                      Kutilayotgan arizalar {pending.length > 0 && `(${pending.length})`}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {pending.length === 0 ? (
                        <p className={`px-4 py-6 text-center text-xs ${ui.faint}`}>Kutilayotgan ariza yo&apos;q.</p>
                      ) : (
                        pending.map((item) => (
                          <Link
                            key={item.id}
                            href="/tarbiyachi/arizalar"
                            onClick={() => setNotifOpen(false)}
                            className={`block px-4 py-3 border-b last:border-b-0 transition-colors ${ui.border} ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/60'}`}
                          >
                            <p className={`text-xs font-semibold truncate ${ui.strong}`}>{item.student_name}</p>
                            <p className={`text-[11px] mt-0.5 line-clamp-2 ${ui.muted}`}>{item.text}</p>
                          </Link>
                        ))
                      )}
                    </div>
                    <Link
                      href="/tarbiyachi/arizalar"
                      onClick={() => setNotifOpen(false)}
                      className={`block px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.accentText} ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/60'}`}
                    >
                      Barcha arizalarni ko&apos;rish
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-screen p-3 sm:p-6 lg:p-8">
          <div className={`min-h-[calc(100vh-7rem)] rounded-3xl border p-3 sm:p-6 lg:p-8 ${ui.cardElevated}`}>
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
