'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Megaphone, ListOrdered, ShieldCheck,
  UserCircle, Bell, Moon, Sun, Zap, Clock
} from 'lucide-react'

const NAV = [
  { icon: LayoutDashboard, label: 'Asosiy', href: '/talaba/dashboard' },
  { icon: Megaphone, label: "E'lonlar", href: '/talaba/elonlar' },
  { icon: ListOrdered, label: 'Navbat', href: '/talaba/navbat' },
  { icon: ShieldCheck, label: 'Qoidalar', href: '/talaba/qoidalar' },
  { icon: UserCircle, label: 'Profil', href: '/talaba/profil' },
]

const QUICK_ACTIONS = [
  { label: 'Tungi ruxsat', icon: Moon, color: 'text-purple-400' },
  { label: 'Navbat almashish', icon: Zap, color: 'text-yellow-400' },
  { label: 'Tozalik auditi', icon: ShieldCheck, color: 'text-green-400' },
]

export default function TalabaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [time, setTime] = useState(new Date())

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMounted(true);
    }, 0);
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(timer);
    };
  }, []);

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#02040a]  text-white selection:bg-cyan-500/30 overflow-x-hidden font-sans">

      {/* --- 1. DYNAMIC BACKGROUND LAYER --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[80%] h-[70%] bg-blue-600/10 blur-[140px] rounded-full opacity-60" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full opacity-40" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: `radial-gradient(#fff 1.2px, transparent 1px)`, backgroundSize: '40px 40px' }}
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      {/* --- 2. PREMIUM TOP BAR (HEADER) --- */}
      <header className="sticky top-0 z-[60] px-6 py-4 backdrop-blur-md bg-[#02040a]/40 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-px">
              <div className="w-full h-full rounded-[15px] bg-[#02040a] flex items-center justify-center">
                <UserCircle className="text-cyan-400" size={24} />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Azizbek 👋</h2>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                <Clock size={10} /> {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 4-Bino
              </div>
            </div>
          </div>

          <button className="relative p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
            <Bell size={20} className="text-slate-400 group-hover:text-white" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-cyan-500 rounded-full border-2 border-[#02040a] animate-pulse" />
          </button>
        </div>
      </header>

      {/* --- 3. MAIN CONTENT --- */}
      <main className="relative z-10 w-full max-w-6xl mx-auto  pt-8 pb-40">

        {/* Quick Actions Scrollable Row */}
        <section className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 ml-1">Tezkor amallar</p>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {QUICK_ACTIONS.map((action) => (
              <motion.button
                key={action.label}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur-xl whitespace-nowrap hover:border-white/20 transition-all"
              >
                <action.icon size={18} className={action.color} />
                <span className="text-xs font-bold tracking-wide">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Page Content with Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.02, y: -10 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- 4. FLOATING BOTTOM NAVIGATION --- */}
      <nav className="fixed bottom-8 left-0 right-0 z-[70] flex justify-center px-6">
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="relative flex items-center w-full max-w-[500px] bg-slate-950/60 backdrop-blur-[30px] border border-white/10 rounded-[32px] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
        >
          {/* Inner Glossy Glow */}
          <div className="absolute inset-0 rounded-[32px] bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />

          {NAV.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="relative flex-1">
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className="flex flex-col items-center justify-center py-2.5 relative z-10"
                >
                  {/* Active Indicator (Liquid Pill) */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        layoutId="nav-active-pill"
                        className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-blue-500/10 to-transparent rounded-[20px] border border-cyan-500/20 shadow-inner"
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      />
                    )}
                  </AnimatePresence>

                  <div className="relative mb-1">
                    <item.icon
                      size={22}
                      strokeWidth={isActive ? 2.5 : 1.8}
                      className={`transition-all duration-300 ${isActive ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                    />
                  </div>

                  <span className={`text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${isActive ? 'text-cyan-400 opacity-100' : 'text-slate-500 opacity-0 h-0 overflow-hidden'
                    }`}>
                    {item.label}
                  </span>

                  {/* Active Bottom Bar */}
                  {isActive && (
                    <motion.div
                      layoutId="active-bar"
                      className="absolute -bottom-1 w-4 h-[2px] bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]"
                    />
                  )}
                </motion.div>
              </Link>
            )
          })}
        </motion.div>
      </nav>

      {/* --- 5. CUSTOM GLOBAL SCROLLBAR STYLE --- */}
      <style jsx global>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { 
          background: rgba(34, 211, 238, 0.1); 
          border-radius: 10px; 
        }
        ::-webkit-scrollbar-thumb:hover { background: rgba(34, 211, 238, 0.3); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}