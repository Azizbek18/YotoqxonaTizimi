'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  Megaphone, 
  ListOrdered, 
  ShieldCheck, 
  UserCircle 
} from 'lucide-react'

export default function TalabaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Navigatsiya elementlari ro'yxati
  const navItems = [
    { icon: LayoutDashboard, label: 'Asosiy', href: '/talaba/dashboard' },
    { icon: Megaphone, label: 'E\'lonlar', href: '/talaba/elonlar' },
    { icon: ListOrdered, label: 'Navbat', href: '/talaba/navbat' },
    { icon: ShieldCheck, label: 'Qoidalar', href: '/talaba/qoidalar' },
    { icon: UserCircle, label: 'Profil', href: '/talaba/profil' },
  ]

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-blue-500/30">
      {/* Sahifa mazmuni */}
      {/* pb-24 padding-bottom berish shart, aks holda bottom nav kontentni to'sib qo'yadi */}
      <main className="pb-24 pt-4 px-4 max-w-md mx-auto min-h-screen">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 pointer-events-none">
        <div className="max-w-md mx-auto bg-[#0f172a]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] flex justify-around items-center p-2 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] pointer-events-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href

            return (
              <Link key={item.href} href={item.href} className="relative py-2 px-3 outline-none">
                <div className={`flex flex-col items-center transition-all duration-300 ${isActive ? 'text-blue-500' : 'text-slate-500'}`}>
                  
                  {/* Aktiv bo'lganda orqa fondagi yorug'lik */}
                  {isActive && (
                    <motion.div 
                      layoutId="nav-active"
                      className="absolute inset-0 bg-blue-500/10 rounded-2xl -z-10"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}

                  <item.icon 
                    size={22} 
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''} transition-transform`}
                  />
                  
                  <span className={`text-[9px] font-bold mt-1.5 uppercase tracking-tighter transition-opacity ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                    {item.label}
                  </span>

                  {/* Aktiv indikator nuqtasi */}
                  {isActive && (
                    <motion.div 
                      layoutId="active-dot"
                      className="absolute -bottom-1 w-1 h-1 bg-blue-500 rounded-full"
                    />
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}