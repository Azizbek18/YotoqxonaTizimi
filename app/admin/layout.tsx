'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Users, FileText, LogOut, Menu, X } from 'lucide-react'
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
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  // Login va Register sahifalarida sidebar ko'rinmasligi kerak
  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/register'

  if (isAuthPage) {
    return <>{children}</>
  }

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Arizalar',
      href: '/admin/arizalar',
      icon: FileText,
    },
    {
      label: 'Foydalanuvchilar',
      href: '/admin/foydalanuvchilar',
      icon: Users,
    },
  ]

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success("Chiqib ketdingiz!")
      router.push('/login')
    } catch {
      toast.error("Chiqib ketishda xato!")
    }
  }

  return (
    <div className={`min-h-screen flex transition-colors ${isLight ? 'bg-slate-100' : 'bg-[#020617]'}`}>
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full backdrop-blur-3xl border-r transition-all duration-300 z-40 ${sidebarOpen ? 'w-64' : 'w-20'
          } ${isLight ? 'bg-white/70 border-slate-200' : 'bg-[#0b1120]/80 border-white/10'}`}
      >
        {/* Header */}
        <div className={`h-20 flex items-center justify-between px-4 border-b transition-all ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-slate-800 text-slate-400'}`}>
                S
              </div>
              <span className={`text-[10px] font-bold tracking-widest uppercase ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>System</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`transition-colors p-2 ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="mt-8 space-y-2 px-4">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                  ? isLight ? 'bg-blue-100/60 text-blue-600 border border-blue-300' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : isLight ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all border ${isLight ? 'bg-red-100 text-red-600 hover:bg-red-200 border-red-300' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20'}`}
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="text-sm font-medium">Chiqib ketish</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <div className={`min-h-screen p-6 sm:p-8 ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100 text-slate-900' : 'text-white'}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
