'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ClipboardList, LayoutDashboard, LogOut, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getAuthHeaders } from '@/lib/auth-session'
import { useToastOffset } from '@/lib/hooks/useToastOffset'

const NAV = [
  { href: '/tarbiyachi/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tarbiyachi/talabalar', label: 'Talabalar', icon: Users },
  { href: '/tarbiyachi/arizalar', label: 'Arizalar', icon: ClipboardList },
]

interface PendingAriza {
  id: string
  student_name: string
  text: string
  created_at: string | null
}

export default function TarbiyachiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  useToastOffset(72)
  const [mounted, setMounted] = useState(false)
  const [pending, setPending] = useState<PendingAriza[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mountId = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(mountId)
  }, [])

  useEffect(() => {
    async function loadPending() {
      try {
        const headers = await getAuthHeaders()
        const response = await fetch('/api/staff/arizalar', { headers })
        const result = (await response.json()) as { ok: boolean; requests?: (PendingAriza & { status: string })[] }
        if (response.ok && result.ok) {
          setPending((result.requests ?? []).filter((r) => r.status === 'pending').slice(0, 5))
        }
      } catch (err) {
        console.error('Error fetching pending arizalar count:', err)
      }
    }
    loadPending()
    const interval = setInterval(loadPending, 30000)
    return () => clearInterval(interval)
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

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" />
      </div>
    )
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Tizimdan chiqdingiz')
    window.location.href = '/login'
  }

  return (
    <div className={`min-h-screen transition-colors ${isLight ? 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900' : 'bg-[#020617] text-white'}`}>
      <header className={`sticky top-0 z-40 border-b backdrop-blur px-4 py-3 transition-all ${isLight ? 'bg-white/70 border-slate-200' : 'bg-[#020617]/90 border-white/10'}`}>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div>
            <p className={`text-[10px] uppercase tracking-[0.2em] font-bold ${isLight ? 'text-blue-600' : 'text-indigo-400'}`}>Tarbiyachi paneli</p>
            <h1 className="text-lg font-black">Yotoqxona nazorati</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((prev) => !prev)}
                className={`relative rounded-xl border p-2 transition-all ${isLight ? 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200' : 'border-white/10 bg-white/5 text-white'}`}
              >
                <Bell size={18} />
                {pending.length > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 border border-white dark:border-slate-950 animate-pulse" />
                )}
              </button>

              {notifOpen && (
                <div className={`absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border shadow-2xl z-50 overflow-hidden ${
                  isLight ? 'bg-white border-slate-200' : 'bg-[#0b101d] border-white/10'
                }`}>
                  <div className={`px-4 py-3 border-b text-xs font-black uppercase tracking-wider ${isLight ? 'border-slate-200 text-slate-700' : 'border-white/5 text-slate-300'}`}>
                    Kutilayotgan arizalar {pending.length > 0 && `(${pending.length})`}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {pending.length === 0 ? (
                      <p className={`px-4 py-6 text-center text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        Kutilayotgan ariza yo&apos;q.
                      </p>
                    ) : (
                      pending.map((item) => (
                        <Link
                          key={item.id}
                          href="/tarbiyachi/arizalar"
                          onClick={() => setNotifOpen(false)}
                          className={`block px-4 py-3 border-b last:border-b-0 transition-colors ${
                            isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/5 hover:bg-white/5'
                          }`}
                        >
                          <p className="text-xs font-bold truncate">{item.student_name}</p>
                          <p className={`text-[11px] mt-0.5 line-clamp-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{item.text}</p>
                        </Link>
                      ))
                    )}
                  </div>
                  <Link
                    href="/tarbiyachi/arizalar"
                    onClick={() => setNotifOpen(false)}
                    className={`block px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-wider transition-colors ${
                      isLight ? 'text-blue-600 hover:bg-slate-50' : 'text-cyan-400 hover:bg-white/5'
                    }`}
                  >
                    Barcha arizalarni ko&apos;rish
                  </Link>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${isLight ? 'border-red-300 bg-red-100 text-red-600 hover:bg-red-200' : 'border-red-400/30 bg-red-500/10 text-red-300'}`}
            >
              <LogOut size={14} /> Chiqish
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className={`h-fit rounded-2xl border p-2 transition-all ${isLight ? 'border-slate-300 bg-white/50' : 'border-white/10 bg-white/5'}`}>
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? isLight ? 'bg-blue-100/60 text-blue-600' : 'bg-indigo-500/20 text-indigo-300' : isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300 hover:bg-white/5'
                  }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </aside>
        <section>{children}</section>
      </main>
    </div>
  )
}
