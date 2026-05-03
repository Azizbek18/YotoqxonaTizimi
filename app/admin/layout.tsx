'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Users, FileText, LogOut, Menu, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

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
      toast.success('Chiqib ketdingiz!')
      router.push('/login')
    } catch (error) {
      toast.error('Chiqib ketishda xato!')
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] flex">
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-[#0b1120]/80 backdrop-blur-3xl border-r border-white/10 transition-all duration-300 z-40 ${sidebarOpen ? 'w-64' : 'w-20'
          }`}
      >
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-4 border-b border-white/10">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                S
              </div>
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">System</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-white transition-colors p-2"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
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
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
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
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20"
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="text-sm font-medium">Chiqib ketish</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <div className="min-h-screen p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
