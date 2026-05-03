'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ClipboardList, LayoutDashboard, LogOut, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const NAV = [
  { href: '/tarbiyachi/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tarbiyachi/talabalar', label: 'Talabalar', icon: Users },
  { href: '/tarbiyachi/arizalar', label: 'Arizalar', icon: ClipboardList },
]

export default function TarbiyachiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Tizimdan chiqdingiz')
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#020617]/90 backdrop-blur px-4 py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-bold">Tarbiyachi paneli</p>
            <h1 className="text-lg font-black">Yotoqxona nazorati</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-white/10 bg-white/5 p-2">
              <Bell size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300"
            >
              <LogOut size={14} /> Chiqish
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-2xl border border-white/10 bg-white/5 p-2">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-300 hover:bg-white/5'
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
