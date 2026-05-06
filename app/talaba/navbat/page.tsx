// 'use client'

// import React, { useEffect, useState } from 'react'
// import { motion, AnimatePresence } from 'framer-motion'
// import { createBrowserClient } from '@supabase/ssr'
// import {
//   ListOrdered, Calendar, CalendarDays, CalendarRange,
//   Clock, CheckCircle2, XCircle, Loader2, Building2, Users
// } from 'lucide-react'
// import { NavbatEntry, NavbatTuri, bugunSana, holatRangi, turLabel } from '@/lib/navbat'

// type Tab = NavbatTuri

// export default function NavbatPage() {
//   const [activeTab, setActiveTab] = useState<Tab>('kunlik')
//   const [navbatlar, setNavbatlar] = useState<NavbatEntry[]>([])
//   const [mening, setMening] = useState<NavbatEntry[]>([])
//   const [loading, setLoading] = useState(true)
//   const [userId, setUserId] = useState<string | null>(null)

//   const supabase = createBrowserClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
//   )

//   useEffect(() => {
//     const init = async () => {
//       const { data: { session } } = await supabase.auth.getSession()
//       if (session) setUserId(session.user.id)
//     }
//     init()
//   }, [])

//   useEffect(() => {
//     if (!userId) return
//     fetchNavbat()
//   }, [userId, activeTab])

//   const fetchNavbat = async () => {
//     setLoading(true)
//     try {
//       // Foydalanuvchi ma'lumotlarini olish (etaj va gender uchun)
//       const { data: userData } = await supabase
//         .from('users')
//         .select('room_number, gender')
//         .eq('id', userId)
//         .maybeSingle()

//       if (!userData) return

//       const etaj = Math.floor(parseInt(userData.room_number) / 100)

//       // Bugungi/joriy navbatlarni olish (bir etaj, bir gender)
//       const { data: navbatData } = await supabase
//         .from('navbat')
//         .select(`
//           *,
//           users (first_name, last_name, room_number, gender)
//         `)
//         .eq('tur', activeTab)
//         .eq('etaj', etaj)
//         .eq('gender', userData.gender)
//         .order('sana', { ascending: false })
//         .limit(20)

//       setNavbatlar(navbatData  [])

//       // Mening navbatlarim
//       const { data: meningData } = await supabase
//         .from('navbat')
//         .select('*')
//         .eq('user_id', userId)
//         .eq('tur', activeTab)
//         .order('sana', { ascending: false })
//         .limit(10)

//       setMening(meningData  [])
//     } finally {
//       setLoading(false)
//     }
//   }

//   const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
//     { key: 'kunlik', label: 'Kunlik', icon: <Clock size={16} />, color: 'blue' },
//     { key: 'haftalik', label: 'Haftalik', icon: <CalendarDays size={16} />, color: 'purple' },
//     { key: 'oylik', label: 'Oylik', icon: <CalendarRange size={16} />, color: 'amber' },
//   ]

//   const tabColor = {
//     kunlik: { active: 'bg-blue-600 text-white shadow-blue-600/30', dot: 'bg-blue-500', glow: 'bg-blue-500/10' },
//     haftalik: { active: 'bg-purple-600 text-white shadow-purple-600/30', dot: 'bg-purple-500', glow: 'bg-purple-500/10' },
//     oylik: { active: 'bg-amber-600 text-white shadow-amber-600/30', dot: 'bg-amber-500', glow: 'bg-amber-500/10' },
//   }

//   // Bugungi navbatchilar (kunlik uchun)
//   const bugunNavbat = navbatlar.filter(n => n.sana === bugunSana())

//   return (
//     <div className="min-h-screen bg-[#020617] text-white font-sans">
//       <div className="max-w-md mx-auto px-4 pt-6 pb-28">

//         {/* Header */}
//         <header className="mb-8">
//           <div className="flex items-center gap-3 mb-1">
//             <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400">
//               <ListOrdered size={20} />
//             </div>
//             <div>
//               <h1 className="text-2xl font-black tracking-tighter uppercase">
//                 NAV<span className="text-blue-500">BAT</span>
//               </h1>
//               <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em]">Navbatchilik jadvali</p>
//             </div>
//           </div>
//         </header>
//         {/* Tabs */}
//         <div className="flex gap-2 mb-6 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5">
//           {tabs.map(tab => (
//             <button
//               key={tab.key}
//               onClick={() => setActiveTab(tab.key)}
//               className={`
//                 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300
//                 ${activeTab === tab.key
//                   ? ${tabColor[tab.key].active} shadow-lg
//                   : 'text-slate-500 hover:text-slate-300'}
//               `}
//             >
//               {tab.icon}
//               {tab.label}
//             </button>
//           ))}
//         </div>

//         {loading ? (
//           <div className="flex items-center justify-center py-20">
//             <Loader2 size={32} className="text-blue-500 animate-spin" />
//           </div>
//         ) : (
//           <AnimatePresence mode="wait">
//             <motion.div
//               key={activeTab}
//               initial={{ opacity: 0, y: 10 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0, y: -10 }}
//               transition={{ duration: 0.25 }}
//               className="space-y-5"
//             >
//               {/* Mening navbatim kartasi */}
//               {mening.length > 0 && (
//                 <div className={`rounded-[1.5rem] p-5 border ${tabColor[activeTab].glow} border-white/10`}>
//                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Mening navbatlarim</p>
//                   <div className="space-y-2">
//                     {mening.slice(0, 3).map(n => (
//                       <div key={n.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
//                         <div className="flex items-center gap-3">
//                           <Calendar size={14} className="text-slate-400" />
//                           <span className="text-sm font-semibold">{n.sana}</span>
//                         </div>
//                         <span className={text-[10px] font-bold px-2.5 py-1 rounded-full border ${holatRangi(n.holat)}}>
//                           {n.holat === 'kutilmoqda' ? 'Kutilmoqda' : n.holat === 'bajarildi' ? 'Bajarildi' : 'Bajarilmadi'}
//                         </span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}

//               {/* Bugungi navbatchilar (kunlik) */}
//               {activeTab === 'kunlik' && (
//                 <NavbatSection
//                   title="Bugungi navbatchilar"
//                   icon={<Clock size={16} className="text-blue-400" />}
//                   items={bugunNavbat}
//                   emptyText="Bugun uchun navbatchi belgilanmagan"
//                 />
//               )}

//               {/* Barcha navbatlar ro'yxati */}
//               <NavbatSection
//                 title={${turLabel(activeTab)} navbat jadvali}
//                 icon={<Building2 size={16} className="text-slate-400" />}
//                 items={navbatlar}
//                 emptyText="Navbat ma'lumotlari topilmadi"
//                 showDate
//               />
//             </motion.div>
//           </AnimatePresence>
//         )}
//       </div>
//     </div>
//   )
// }

// // Navbat ro'yxati komponenti
// function NavbatSection({
//   title, icon, items, emptyText, showDate = false
// }: {
//   title: string
//   icon: React.ReactNode
//   items: NavbatEntry[]
//   emptyText: string
//   showDate?: boolean
// }) {
//   return (
//     <div className="bg-slate-900/40 rounded-[1.5rem] p-5 border border-white/5">
//       <div className="flex items-center gap-2 mb-4">
//         {icon}
//         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
//         <span className="ml-auto text-[10px] font-bold text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">
//           {items.length}
//         </span>
//       </div>
//       {items.length === 0 ? (
//         <div className="text-center py-8">
//           <Users size={32} className="text-slate-700 mx-auto mb-2" />
//           <p className="text-slate-600 text-xs">{emptyText}</p>
//         </div>
//       ) : (
//         <div className="space-y-2">
//           {items.map((n, i) => (
//             <motion.div
//               key={n.id}
//               initial={{ opacity: 0, x: -10 }}
//               animate={{ opacity: 1, x: 0 }}
//               transition={{ delay: i * 0.05 }}
//               className="flex items-center gap-3 bg-white/[0.03] rounded-2xl px-4 py-3 border border-white/5"
//             >
//               <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[11px] font-black text-slate-400">
//                 {i + 1}
//               </div>
//               <div className="flex-1 min-w-0">
//                 <p className="text-sm font-bold truncate">
//                   {n.users?.first_name} {n.users?.last_name}
//                 </p>
//                 <p className="text-[10px] text-slate-500">
//                   Xona #{n.users?.room_number} · {n.etaj}-etaj
//                   {showDate &&  · ${n.sana}}
//                 </p>
//               </div>
//               <HolatIcon holat={n.holat} />
//             </motion.div>
//           ))}
//         </div>
//       )}
//     </div>
//   )
// }

// function HolatIcon({ holat }: { holat: string }) {
//   if (holat === 'bajarildi') return <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
//   if (holat === 'bajarilmadi') return <XCircle size={18} className="text-rose-400 shrink-0" />
//   return <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
// }
'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createBrowserClient } from '@supabase/ssr'
import {
  ListOrdered, Calendar, CalendarDays, CalendarRange,
  Clock, CheckCircle2, XCircle, Loader2, Building2, Users
} from 'lucide-react'
// Eslatma: @/lib/navbat fayli mavjudligiga ishonch hosil qiling
import { NavbatEntry, NavbatTuri, bugunSana, holatRangi, turLabel } from '@/lib/navbat'

type Tab = NavbatTuri

export default function NavbatPage() {
  const [activeTab, setActiveTab] = useState<Tab>('kunlik')
  const [navbatlar, setNavbatlar] = useState<NavbatEntry[]>([])
  const [mening, setMening] = useState<NavbatEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchNavbat = useCallback(async () => {
    setLoading(true)
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('room_number, gender')
        .eq('id', userId)
        .maybeSingle()

      if (!userData) return

      const etaj = Math.floor(parseInt(userData.room_number) / 100)

      const { data: navbatData } = await supabase
        .from('navbat')
        .select(`
          *,
          users (first_name, last_name, room_number, gender)
        `)
        .eq('tur', activeTab)
        .eq('etaj', etaj)
        .eq('gender', userData.gender)
        .order('sana', { ascending: false })
        .limit(20)

      setNavbatlar(navbatData || [])

      const { data: meningData } = await supabase
        .from('navbat')
        .select('*')
        .eq('user_id', userId)
        .eq('tur', activeTab)
        .order('sana', { ascending: false })
        .limit(10)

      setMening(meningData || [])
    } catch (error) {
      console.error("Xatolik:", error)
    } finally {
      setLoading(false)
    }
  }, [activeTab, userId, supabase])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setUserId(session.user.id)
    }
    init()
  }, [supabase])

  useEffect(() => {
    if (!userId) return
    fetchNavbat()
  }, [userId, activeTab, fetchNavbat])

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'kunlik', label: 'Kunlik', icon: <Clock size={16} />, color: 'blue' },
    { key: 'haftalik', label: 'Haftalik', icon: <CalendarDays size={16} />, color: 'purple' },
    { key: 'oylik', label: 'Oylik', icon: <CalendarRange size={16} />, color: 'amber' },
  ]

  const tabColor = {
    kunlik: { active: 'bg-blue-600 text-white shadow-blue-600/30', dot: 'bg-blue-500', glow: 'bg-blue-500/10' },
    haftalik: { active: 'bg-purple-600 text-white shadow-purple-600/30', dot: 'bg-purple-500', glow: 'bg-purple-500/10' },
    oylik: { active: 'bg-amber-600 text-white shadow-amber-600/30', dot: 'bg-amber-500', glow: 'bg-amber-500/10' },
  }

  const bugunNavbat = navbatlar.filter(n => n.sana === bugunSana())

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans">
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-28">

        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400">
              <ListOrdered size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase">
                NAV<span className="text-blue-500">BAT</span>
              </h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em]">Navbatchilik jadvali</p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white/3 p-1.5 rounded-2xl border border-white/5">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300
                ${activeTab === tab.key
                  ? tabColor[tab.key].active
                  : 'text-slate-500 hover:text-slate-300'}
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="text-blue-500 animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Mening navbatim kartasi */}
              {mening.length > 0 && (
                <div className={`rounded-3xl p-5 border ${tabColor[activeTab].glow} border-white/10`}>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Mening navbatlarim</p>
                  <div className="space-y-2">
                    {mening.slice(0, 3).map(n => (
                      <div key={n.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="text-sm font-semibold">{n.sana}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${holatRangi(n.holat)}`}>
                          {n.holat === 'kutilmoqda' ? 'Kutilmoqda' : n.holat === 'bajarildi' ? 'Bajarildi' : 'Bajarilmadi'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'kunlik' && (
                <NavbatSection
                  title="Bugungi navbatchilar"
                  icon={<Clock size={16} className="text-blue-400" />}
                  items={bugunNavbat}
                  emptyText="Bugun uchun navbatchi belgilanmagan"
                />
              )}

              <NavbatSection
                title={`${turLabel(activeTab)} navbat jadvali`}
                icon={<Building2 size={16} className="text-slate-400" />}
                items={navbatlar}
                emptyText="Navbat ma'lumotlari topilmadi"
                showDate
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

function NavbatSection({
  title, icon, items, emptyText, showDate = false
}: {
  title: string
  icon: React.ReactNode
  items: NavbatEntry[]
  emptyText: string
  showDate?: boolean
}) {
  return (
    <div className="bg-slate-900/40 rounded-3xl p-5 border border-white/5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <span className="ml-auto text-[10px] font-bold text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-8">
          <Users size={32} className="text-slate-700 mx-auto mb-2" />
          <p className="text-slate-600 text-xs">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 bg-white/3 rounded-2xl px-4 py-3 border border-white/5"
            >
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[11px] font-black text-slate-400">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">
                  {n.users?.first_name} {n.users?.last_name}
                </p>
                <p className="text-[10px] text-slate-500">
                  Xona #{n.users?.room_number} · {n.etaj}-etaj
                  {showDate && ` · ${n.sana}`}
                </p>
              </div>
              <HolatIcon holat={n.holat} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function HolatIcon({ holat }: { holat: string }) {
  if (holat === 'bajarildi') return <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
  if (holat === 'bajarilmadi') return <XCircle size={18} className="text-rose-400 shrink-0" />
  return <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
}