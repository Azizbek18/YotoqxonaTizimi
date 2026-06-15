'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ListOrdered, Loader2, ShieldCheck, User, Sparkles
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getSafeSession } from '@/lib/auth-session'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
  gender: string
  room_number: string | null
  faculty?: string | null
}

interface FloorCaptain {
  id: string
  full_name: string
  room_number: string | null
  phone_number: string | null
  avatar_url: string | null
}

interface DutyMember {
  id: string
  name: string
  room: string
}

export default function NavbatPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'

  const [profile, setProfile] = useState<Profile | null>(null)
  const [floorCaptains, setFloorCaptains] = useState<FloorCaptain[]>([])
  const [dutySchedule, setDutySchedule] = useState<Record<string, DutyMember[]>>({})
  const [dutyAdmins, setDutyAdmins] = useState<DutyMember[]>([])
  const [loading, setLoading] = useState(true)

  const WEEKDAYS = useMemo(() => [
    "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"
  ], [])

  const todayName = useMemo(() => {
    const days = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"]
    const todayIdx = new Date().getDay()
    return days[todayIdx]
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const session = await getSafeSession()
        if (!session) return

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        if (!userData) return
        setProfile(userData as Profile)

        const floor = userData.room_number ? Math.floor(parseInt(userData.room_number) / 100) : null
        
        if (floor) {
          // Fetch Floor Captains
          const { data: captains } = await supabase
            .from('users')
            .select('id, full_name, room_number, phone_number, avatar_url')
            .eq('is_floor_captain', true)
            .eq('assigned_floor', floor)
            .eq('gender', userData.gender)
          
          setFloorCaptains(captains || [])

          // Fetch Duty Schedule from Announcements
          const { data: dutyAnn } = await supabase
            .from('elonlar')
            .select('*')
            .eq('title', 'HAFTALIK_NAVBATCHILIK_JADVALI')
            .eq('target_floor', floor)
            .eq('target_gender', userData.gender)
            .maybeSingle()

          if (dutyAnn && dutyAnn.text) {
            try {
              const parsed = JSON.parse(dutyAnn.text)
              if (parsed.schedule) setDutySchedule(parsed.schedule)
              if (parsed.admins) setDutyAdmins(parsed.admins)
            } catch (e) {
              console.error("Navbatchilik JSON o'qish xatosi:", e)
            }
          }
        }
      } catch (error) {
        console.error("Xatolik:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#020617] text-white'}`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="text-purple-500 animate-spin" />
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Ma&apos;lumotlar yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  const floorNumber = profile?.room_number ? Math.floor(parseInt(profile.room_number) / 100) : '—'

  return (
    <div className={`min-h-screen font-sans overflow-x-hidden relative pb-24 transition-colors duration-300 ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#020617] text-white'}`}>
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] bg-purple-500/5 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] bg-indigo-500/5 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-8">
        
        {/* Header */}
        <header className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6 ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl border ${
              isLight 
                ? 'bg-purple-50 border-purple-100 text-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.05)]' 
                : 'bg-purple-500/10 border-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
            }`}>
              <ListOrdered size={22} />
            </div>
            <div>
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                isLight 
                  ? 'border-purple-200 bg-purple-50 text-purple-600' 
                  : 'border-purple-500/30 bg-purple-500/10 text-purple-400'
              }`}>
                <Sparkles size={10} className="animate-pulse" /> {floorNumber}-qavat navbatchiligi
              </div>
              <h1 className={`text-2xl font-black tracking-tighter uppercase mt-1 ${textStrong}`}>
                NAV<span className="text-purple-500">BAT</span>
              </h1>
            </div>
          </div>
        </header>

        {/* Top Section: Captain & Admins */}
        <section className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Qavat Ma&apos;murlari</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Qavat Sardori */}
            {floorCaptains.length > 0 ? (
              floorCaptains.map((captain) => (
                <motion.div
                  key={captain.id}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className={`backdrop-blur-xl border p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] flex items-center gap-3 sm:gap-4 relative overflow-hidden shadow-xl ${
                    isLight ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-white/[0.02] border-white/10'
                  }`}
                >
                  <div className="absolute right-[-10%] top-[-10%] w-[35%] h-[35%] rounded-full blur-[35px] bg-purple-500/10" />
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
                    isLight ? 'bg-purple-50 border-purple-100 text-purple-600' : 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                  }`}>
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                      isLight ? 'text-purple-600 bg-purple-50 border-purple-100' : 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                    }`}>Qavat Sardori</span>
                    <h3 className={`text-sm font-extrabold mt-1.5 ${textStrong}`}>{captain.full_name}</h3>
                    <p className={`text-[10px] mt-0.5 ${textMuted}`}>Xona #{captain.room_number || '—'} · {captain.phone_number || 'Tel mavjud emas'}</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className={`backdrop-blur-xl border border-dashed p-5 rounded-[2rem] flex items-center gap-4 text-xs font-bold uppercase tracking-wider justify-center ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-white/[0.01] border-white/5 text-slate-500'
              }`}>
                Qavat sardori biriktirilmagan
              </div>
            )}

            {/* Yordamchi Adminlar */}
            {dutyAdmins.slice(0, 2).map((admin) => (
              <motion.div
                key={admin.id}
                whileHover={{ y: -4, scale: 1.01 }}
                className={`backdrop-blur-xl border p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] flex items-center gap-3 sm:gap-4 relative overflow-hidden shadow-xl ${
                  isLight ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-white/[0.02] border-white/10'
                }`}
              >
                <div className="absolute right-[-10%] top-[-10%] w-[35%] h-[35%] rounded-full blur-[35px] bg-indigo-500/10" />
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
                  isLight ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                }`}>
                  <User size={24} />
                </div>
                <div>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                    isLight ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                  }`}>Navbatchilik Admini</span>
                  <h3 className={`text-sm font-extrabold mt-1.5 ${textStrong}`}>{admin.name}</h3>
                  <p className={`text-[10px] mt-0.5 ${textMuted}`}>Xona #{admin.room || '—'}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Weekly Duty Schedule Grid */}
        <section className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Haftalik Navbatchilar Jadvali</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {WEEKDAYS.map((day) => {
              const isToday = todayName === day
              const dayDuties = dutySchedule[day] || []

              return (
                <motion.div
                  key={day}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className={`backdrop-blur-xl rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 border flex flex-col justify-between min-h-[200px] relative overflow-hidden transition-all duration-300 ${
                    isToday
                      ? isLight
                        ? 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200 shadow-[0_0_30px_rgba(168,85,247,0.06)]'
                        : 'bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.12)]'
                      : isLight
                        ? 'bg-white border-slate-200 hover:border-purple-300 hover:shadow-sm'
                        : 'bg-white/[0.02] border-white/10 hover:border-purple-500/20'
                  }`}
                >
                  {/* Glowing light for today */}
                  {isToday && (
                    <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full blur-[40px] bg-purple-500/20 animate-pulse pointer-events-none" />
                  )}

                  <div className="relative z-10 flex justify-between items-center mb-5">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-6 rounded-full ${isToday ? 'bg-purple-500' : 'bg-slate-300'}`} />
                      <h3 className={`text-base font-extrabold ${isToday ? isLight ? 'text-purple-600' : 'text-purple-400' : textStrong}`}>{day}</h3>
                    </div>
                    {isToday && (
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full animate-bounce ${
                        isLight ? 'text-purple-600 bg-purple-100 border border-purple-200' : 'text-purple-400 bg-purple-500/10 border border-purple-500/25'
                      }`}>
                        Bugun
                      </span>
                    )}
                  </div>

                  <div className="relative z-10 flex-1 space-y-2.5">
                    {dayDuties.length > 0 ? (
                      dayDuties.map((duty, idx) => (
                        <div 
                          key={duty.id || idx}
                          className={`flex items-center gap-2 sm:gap-2.5 border rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-3.5 sm:py-2.5 ${
                            isLight ? 'bg-slate-50 border-slate-200/60' : 'bg-white/5 border-white/5'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-xl border flex items-center justify-center text-[10px] font-black ${
                            isLight ? 'bg-purple-50 border-purple-100 text-purple-600' : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                          }`}>
                            {duty.name ? duty.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'ST'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-bold truncate ${textStrong}`}>{duty.name}</p>
                            <p className="text-[9px] text-slate-500 font-semibold mt-0.5">Xona #{duty.room || '—'}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={`h-full flex items-center justify-center py-8 border border-dashed rounded-2xl ${
                        isLight ? 'border-slate-200 bg-slate-50/30' : 'border-white/5'
                      }`}>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Navbatchi yo&apos;q</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
