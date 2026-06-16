'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ClipboardList, LayoutDashboard, LogOut, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'

const NAV = [
  { href: '/tarbiyachi/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tarbiyachi/talabalar', label: 'Talabalar', icon: Users },
  { href: '/tarbiyachi/arizalar', label: 'Arizalar', icon: ClipboardList },
]

export default function TarbiyachiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
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
            <button className={`rounded-xl border p-2 transition-all ${isLight ? 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200' : 'border-white/10 bg-white/5 text-white'}`}>
              <Bell size={18} />
            </button>
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
