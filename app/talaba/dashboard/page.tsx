'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { createBrowserClient } from '@supabase/ssr' 
import { Bell, DoorOpen, Clock, Star, Zap, User, MapPin, Phone, LayoutDashboard, Calendar, Shield, LogOut } from 'lucide-react'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()
          if (data) setUser(data)
        }
      } catch (err) {
        console.error("Xatolik:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [])

  if (loading) return (
    <div className="h-screen bg-[#020617] flex items-center justify-center">
       <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-blue-500/30 pb-24 lg:pb-8">
      
      {/* KONTEYNER: 
        max-w-7xl - Katta ekranlarda kenglikni cheklaydi (Laptop uchun muhim)
        mx-auto - Kontentni markazlashtiradi
      */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-10">
          <div className="space-y-1">
            <h1 className="text-2xl lg:text-3xl font-black tracking-tighter uppercase">
              ASOSIY <span className="text-blue-500">PANEL</span>
            </h1>
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.3em]">Dashboard / Talaba</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-bold">{user?.full_name}</p>
              <p className="text-[10px] text-slate-500 uppercase">{user?.faculty}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 relative">
              <Bell size={20} className="text-slate-400" />
              <span className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#020617]" />
            </div>
          </div>
        </header>

        {/* BENTO GRID SYSTEM:
          grid-cols-1 - Telda 1ta ustun
          md:grid-cols-2 - Planshetda 2ta ustun
          lg:grid-cols-4 - Laptopda 4ta ustun
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-min lg:auto-rows-[200px]">
          
          {/* PROFIL (Laptopda 2ta ustun, 2ta qator egallaydi) */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="md:col-span-2 lg:row-span-2 bg-slate-900/40 rounded-[2.5rem] p-6 lg:p-10 border border-white/5 relative overflow-hidden flex flex-col justify-between shadow-2xl backdrop-blur-md"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] -mr-20 -mt-20" />
            
            <div className="relative z-10">
              <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
                <User size={32} className="text-white" />
              </div>
              <h2 className="text-3xl lg:text-5xl font-black tracking-tighter leading-none mb-3">
                {user?.first_name} <br /> {user?.last_name}
              </h2>
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                <MapPin size={14} className="text-blue-500" />
                <span>{user?.region}, {user?.district}</span>
              </div>
            </div>

            <div className="relative z-10 pt-8 grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Kurs</p>
                <p className="text-xs font-bold text-slate-200">{user?.course}-kurs</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Guruh</p>
                <p className="text-xs font-bold text-slate-200">Noma'lum</p>
              </div>
            </div>
          </motion.div>

          {/* XONA VIDJETI (Laptopda 2ta ustun joy egallaydi) */}
          <motion.div 
            whileHover={{ scale: 1.01 }}
            className="md:col-span-2 bg-white rounded-[2.5rem] p-6 lg:p-10 flex items-center justify-between relative overflow-hidden group shadow-xl"
          >
            <div className="relative z-10 text-slate-900">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Yotoqxona raqami</p>
              <h3 className="text-6xl lg:text-8xl font-black tracking-tighter my-2">#{user?.room_number || '00'}</h3>
              <div className="flex items-center gap-2 bg-slate-900/5 w-fit px-3 py-1.5 rounded-full border border-slate-900/10">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[9px] font-bold uppercase tracking-wider">Status: Joylashgan</span>
              </div>
            </div>
            
            <div className="relative z-10 hidden sm:flex w-28 h-28 lg:w-36 lg:h-36 rounded-full border-[10px] border-slate-100 items-center justify-center">
               <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-600/40">
                  <DoorOpen size={32} className="text-white" />
               </div>
            </div>
          </motion.div>

          {/* KICHIK VIDJETLAR */}
          <div className="grid grid-cols-2 md:col-span-2 gap-6 lg:contents">
             {/* Navbatchilik */}
             <motion.div whileHover={{ y: -5 }} className="bg-slate-900/40 rounded-[2rem] p-6 border border-white/5 flex flex-col justify-between">
                <div className="p-3 bg-amber-500/10 rounded-2xl w-fit text-amber-500 mb-4">
                   <Clock size={24} />
                </div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Navbatchilik</p>
                   <p className="text-xl font-bold">Shanba</p>
                </div>
             </motion.div>

             {/* Reyting */}
             <motion.div whileHover={{ y: -5 }} className="bg-slate-900/40 rounded-[2rem] p-6 border border-white/5 flex flex-col justify-between">
                <div className="p-3 bg-purple-500/10 rounded-2xl w-fit text-purple-500 mb-4">
                   <Star size={24} />
                </div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Reyting</p>
                   <p className="text-xl font-bold">4.9 / 5.0</p>
                </div>
             </motion.div>
          </div>

          {/* ALOQA VIDJETI (Laptopda 2ta ustun) */}
          <motion.div 
            className="md:col-span-2 bg-blue-600 rounded-[2.5rem] p-6 lg:p-8 flex items-center justify-between group cursor-pointer overflow-hidden relative"
          >
            <div className="flex items-center gap-4 lg:gap-6">
              <div className="p-4 bg-white/20 rounded-[1.5rem] backdrop-blur-md">
                <Phone size={24} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-blue-100 tracking-widest mb-1">Bog'lanish</p>
                <p className="text-lg lg:text-xl font-bold">{user?.phone || '+998 -- --- -- --'}</p>
              </div>
            </div>
            <Zap size={32} className="opacity-20 group-hover:opacity-100 group-hover:scale-110 transition-all hidden sm:block" />
          </motion.div>

        </div>

        {/* NAVBAR: 
          Telda pastda (fixed), 
          Laptopda ham pastda markazda ixcham turadi
        */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-fit px-4">
          <nav className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 p-2 rounded-full shadow-2xl flex items-center gap-1 overflow-x-auto no-scrollbar">
            <NavItem icon={<LayoutDashboard size={18}/>} label="Asosiy" active />
            <NavItem icon={<Calendar size={18}/>} label="E'lonlar" />
            <NavItem icon={<Clock size={18}/>} label="Navbat" />
            <NavItem icon={<Shield size={18}/>} label="Qoidalar" />
            <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block" />
            <NavItem icon={<LogOut size={18}/>} label="Chiqish" danger />
          </nav>
        </div>

      </div>
    </div>
  )
}

function NavItem({ icon, label, active = false, danger = false }: any) {
  return (
    <div className={`
      flex items-center gap-2 px-4 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap
      ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:bg-white/5'}
      ${danger ? 'hover:text-rose-500' : ''}
    `}>
      {icon}
      {active && <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">{label}</span>}
    </div>
  )
}