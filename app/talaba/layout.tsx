'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Megaphone, ListOrdered, ShieldCheck,
  UserCircle, Bell, Moon, Zap, Clock, CreditCard, FileText
} from 'lucide-react'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'

const NAV = [
  { icon: LayoutDashboard, label: 'Asosiy', href: '/talaba/dashboard' },
  { icon: Megaphone, label: "E'lonlar", href: '/talaba/elonlar' },
  { icon: ListOrdered, label: 'Navbat', href: '/talaba/navbat' },
  { icon: ShieldCheck, label: 'Qoidalar', href: '/talaba/qoidalar' },
  { icon: CreditCard, label: "To'lov", href: '/talaba/tolova' },
  { icon: FileText, label: 'Arizalar', href: '/talaba/arizalar' },
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
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

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
    <div className={`min-h-screen overflow-x-hidden font-sans transition-colors ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100 text-slate-900 selection:bg-blue-200' : 'bg-[#02040a] text-white selection:bg-cyan-500/30'}`}>

      {/* --- 1. DYNAMIC BACKGROUND LAYER --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {!isLight && (
          <>
            <div className="absolute top-[-15%] left-[-10%] w-[80%] h-[70%] bg-blue-600/10 blur-[140px] rounded-full opacity-60" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full opacity-40" />
            <div className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: `radial-gradient(#fff 1.2px, transparent 1px)`, backgroundSize: '40px 40px' }}
            />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
          </>
        )}
      </div>

      {/* --- 2. PREMIUM TOP BAR (HEADER) --- */}
      <header className={`sticky top-0 z-60 px-4 sm:px-6 py-4 backdrop-blur-md transition-all ${isLight ? 'bg-white/70 border-b border-slate-200' : 'bg-[#02040a]/40 border-b border-white/5'}`}>
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-linear-to-tr p-px shrink-0 ${isLight ? 'from-blue-600 to-blue-400' : 'from-blue-600 to-cyan-400'}`}>
              <div className={`w-full h-full rounded-[15px] flex items-center justify-center ${isLight ? 'bg-white' : 'bg-[#02040a]'}`}>
                <UserCircle className={isLight ? 'text-blue-600' : 'text-cyan-400'} size={20} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className={`text-xs sm:text-sm font-bold tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>Azizbek 👋</h2>
              <div className={`flex items-center gap-1.5 text-[8px] sm:text-[10px] font-medium uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                <Clock size={8} className="shrink-0" />
                <span className="truncate">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 4-Bino</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button className={`relative p-2 sm:p-2.5 rounded-xl transition-all group ${isLight ? 'bg-slate-100 border border-slate-300 hover:bg-slate-200' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
              <Bell size={18} className={`group-hover:text-white ${isLight ? 'text-slate-600 group-hover:text-slate-900' : 'text-slate-400'}`} />
              <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 animate-pulse ${isLight ? 'bg-blue-500 border-white' : 'bg-cyan-500 border-[#02040a]'}`} />
            </button>
          </div>
        </div>
      </header>

      {/* --- 3. MAIN CONTENT --- */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-40">

        {/* Quick Actions Scrollable Row */}
        <section className="mb-6 sm:mb-8">
          <p className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] mb-3 sm:mb-4 ml-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Tezkor amallar</p>
          <div className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar pb-2">
            {QUICK_ACTIONS.map((action) => (
              <motion.button
                key={action.label}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 rounded-2xl backdrop-blur-xl whitespace-nowrap transition-all text-xs sm:text-sm shrink-0 ${isLight ? 'bg-white border border-slate-300 text-slate-900 hover:border-slate-400 hover:bg-slate-50' : 'bg-slate-900/40 border border-white/5 text-white hover:border-white/20'}`}
              >
                <action.icon size={16} className={`${action.color} shrink-0`} />
                <span className="font-bold tracking-wide hidden sm:inline">{action.label}</span>
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
      <nav className="fixed bottom-4 sm:bottom-8 left-0 right-0 z-70 flex justify-center px-3 sm:px-6">
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className={`relative flex items-center gap-0.5 sm:gap-1 w-full max-w-full sm:max-w-4xl backdrop-blur-[30px] rounded-3xl sm:rounded-4xl p-1.5 sm:p-2 transition-all overflow-x-auto no-scrollbar ${isLight ? 'bg-white/80 border border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.1)]' : 'bg-slate-950/60 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]'}`}
        >
          {/* Inner Glossy Glow */}
          <div className={`absolute inset-0 rounded-3xl sm:rounded-4xl pointer-events-none ${isLight ? 'bg-linear-to-b from-white to-transparent' : 'bg-linear-to-b from-white/5 to-transparent'}`} />

          {NAV.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="relative shrink-0 flex-1 min-w-0">
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className="flex flex-col items-center justify-center py-2 sm:py-2.5 relative z-10 px-1"
                >
                  {/* Active Indicator (Liquid Pill) */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        layoutId="nav-active-pill"
                        className={`absolute inset-0 rounded-xl sm:rounded-[20px] border shadow-inner transition-all ${isLight ? 'bg-linear-to-tr from-blue-500/15 via-blue-500/5 to-transparent border-blue-500/15' : 'bg-linear-to-tr from-cyan-500/20 via-blue-500/10 to-transparent border-cyan-500/20'}`}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      />
                    )}
                  </AnimatePresence>

                  <div className="relative mb-0.5 sm:mb-1">
                    <item.icon
                      size={20}
                      strokeWidth={isActive ? 2.5 : 1.8}
                      className={`transition-all duration-300 ${isActive ? isLight ? 'text-blue-600 drop-shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' : isLight ? 'text-slate-400 group-hover:text-slate-500' : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                    />
                  </div>

                  <span className={`text-[7px] sm:text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? isLight ? 'text-blue-600 opacity-100' : 'text-cyan-400 opacity-100' : isLight ? 'text-slate-500 opacity-0 h-0 overflow-hidden' : 'text-slate-500 opacity-0 h-0 overflow-hidden'
                    }`}>
                    {item.label}
                  </span>

                  {/* Active Bottom Bar */}
                  {isActive && (
                    <motion.div
                      layoutId="active-bar"
                      className={`absolute -bottom-0.5 sm:-bottom-1 w-3 h-0.5 rounded-full ${isLight ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]' : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'}`}
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