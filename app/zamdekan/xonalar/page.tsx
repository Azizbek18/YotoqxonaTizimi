'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  AlertTriangle,
  X
} from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Occupant {
  id: string
  full_name: string
  passport_series: string
  jshshir: string
  phone: string
  gender: string
  faculty: string
  direction: string
  course: number
  status: 'registered' | 'approved'
  warning_count?: number
}

interface RoomData {
  roomNumber: string
  occupants: Occupant[]
  floor: number
  gender: string | null // 'male', 'female', or 'mixed' (warning)
}

export default function ZamdekanXonalarMap() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  // Styling tokens
  const surfaceBg = isLight
    ? 'bg-white/80 border-slate-200 shadow-md'
    : 'bg-[#0f172a]/30 border-white/5 shadow-2xl'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const inputBg = isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'

  // State
  const [rooms, setRooms] = useState<RoomData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null)
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchRoomsData = async () => {
    setLoading(true)
    try {
      // 1. Fetch registered users with rooms
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, passport_series, jshshir, phone, gender, faculty, direction, course, room_number, warning_count')
        .eq('role', 'talaba')
        .not('room_number', 'is', null)

      if (usersError) throw usersError

      // 2. Fetch approved permit requests with rooms (not yet registered)
      const { data: permits, error: permitsError } = await supabase
        .from('permit_requests')
        .select('id, full_name, passport_series, jshshir, phone, gender, faculty, direction, course, room_number')
        .eq('status', 'approved')
        .not('room_number', 'is', null)

      if (permitsError) throw permitsError

      // Map to combined occupants list
      const occupantsMap: Record<string, Occupant[]> = {}

      users?.forEach((u) => {
        if (!u.room_number) return
        const occupant: Occupant = {
          id: u.id,
          full_name: u.full_name || 'Noma‘lum',
          passport_series: u.passport_series || '',
          jshshir: u.jshshir || '',
          phone: u.phone || '',
          gender: u.gender || '',
          faculty: u.faculty || '',
          direction: u.direction || '',
          course: u.course || 1,
          status: 'registered',
          warning_count: u.warning_count ?? 0
        }
        if (!occupantsMap[u.room_number]) {
          occupantsMap[u.room_number] = []
        }
        occupantsMap[u.room_number].push(occupant)
      })

      permits?.forEach((p) => {
        if (!p.room_number) return
        const occupant: Occupant = {
          id: p.id,
          full_name: p.full_name,
          passport_series: p.passport_series,
          jshshir: p.jshshir,
          phone: p.phone,
          gender: p.gender,
          faculty: p.faculty,
          direction: p.direction,
          course: p.course,
          status: 'approved',
          warning_count: 0
        }
        if (!occupantsMap[p.room_number]) {
          occupantsMap[p.room_number] = []
        }
        // Avoid duplicate if already registered (though status 'approved' vs 'registered' should handle this)
        const exists = occupantsMap[p.room_number].some((o) => o.passport_series === p.passport_series)
        if (!exists) {
          occupantsMap[p.room_number].push(occupant)
        }
      })

      // Construct rooms 1-150
      const constructedRooms: RoomData[] = Array.from({ length: 150 }, (_, i) => {
        const roomNum = String(i + 1)
        const roomOccs = occupantsMap[roomNum] || []

        // Floor mapping
        // 1-30: 1st floor, 31-60: 2nd floor, 61-90: 3rd floor, 91-120: 4th floor, 121-150: 5th floor
        const num = i + 1
        let floor = 1
        if (num > 120) floor = 5
        else if (num > 90) floor = 4
        else if (num > 60) floor = 3
        else if (num > 30) floor = 2

        // Gender mapping/warnings
        let gender: string | null = null
        if (roomOccs.length > 0) {
          const genders = roomOccs.map((o) => o.gender)
          const allMale = genders.every((g) => g === 'male')
          const allFemale = genders.every((g) => g === 'female')
          if (allMale) gender = 'male'
          else if (allFemale) gender = 'female'
          else gender = 'mixed'
        }

        return {
          roomNumber: roomNum,
          occupants: roomOccs,
          floor,
          gender
        }
      })

      setRooms(constructedRooms)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoomsData()
  }, [])

  // Filters
  const filteredRooms = rooms.filter((r) => {
    const matchesFloor = floorFilter === 'all' || r.floor === floorFilter
    const matchesSearch =
      r.roomNumber.includes(searchTerm) ||
      r.occupants.some((o) => o.full_name.toLowerCase().includes(searchTerm.toLowerCase()))

    return matchesFloor && matchesSearch
  })

  // Calculate totals
  const totalOccupiedBeds = rooms.reduce((acc, r) => acc + r.occupants.length, 0)
  const totalRoomsWithMixedGenders = rooms.filter((r) => r.gender === 'mixed').length
  const totalEmptyRooms = rooms.filter((r) => r.occupants.length === 0).length
  const totalFullRooms = rooms.filter((r) => r.occupants.length === 4).length

  return (
    <div className="space-y-6">
      {/* 1. Header Overview Stats */}
      <div className={`p-5 rounded-3xl border ${surfaceBg} grid grid-cols-2 md:grid-cols-4 gap-4`}>
        <div>
          <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Jami band joylar</span>
          <h3 className={`text-2xl font-black mt-1 ${textStrong}`}>{totalOccupiedBeds} / 600</h3>
        </div>
        <div>
          <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Bo‘sh xonalar</span>
          <h3 className={`text-2xl font-black mt-1 ${textStrong}`}>{totalEmptyRooms} ta</h3>
        </div>
        <div>
          <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>To‘la xonalar (4/4)</span>
          <h3 className={`text-2xl font-black mt-1 ${textStrong}`}>{totalFullRooms} ta</h3>
        </div>
        <div>
          <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Gender xatoliklar</span>
          <h3 className={`text-2xl font-black mt-1 ${totalRoomsWithMixedGenders > 0 ? 'text-rose-500 animate-pulse' : textStrong}`}>
            {totalRoomsWithMixedGenders} ta xona
          </h3>
        </div>
      </div>

      {/* 2. Map Controls */}
      <div className={`p-4 rounded-3xl border ${surfaceBg} flex flex-col md:flex-row md:items-center justify-between gap-3`}>
        {/* Floor Selection */}
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl">
          <button
            onClick={() => setFloorFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              floorFilter === 'all'
                ? isLight
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-white/10 text-white'
                : 'text-slate-455 hover:text-slate-700 dark:hover:text-white'
            }`}
          >
            Barchasi
          </button>
          {[1, 2, 3, 4, 5].map((fl) => (
            <button
              key={fl}
              onClick={() => setFloorFilter(fl)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                floorFilter === fl
                  ? isLight
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'bg-white/10 text-white'
                  : 'text-slate-455 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              {fl}-qavat
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 md:max-w-xs">
          <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textMuted}`} />
          <input
            type="text"
            placeholder="Xona raqami yoki talaba ismi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full text-xs py-2.5 pl-9 pr-4 rounded-xl outline-none border transition-all ${inputBg}`}
          />
        </div>
      </div>

      {/* 3. Main Occupancy Grid and Side Detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Rooms Grid (Left) */}
        <div className={`lg:col-span-8 p-5 rounded-3xl border ${surfaceBg}`}>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className={`animate-spin rounded-full h-8 w-8 border-t-2 ${isLight ? 'border-indigo-600' : 'border-cyan-500'}`} />
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {filteredRooms.map((room) => {
                const count = room.occupants.length
                const isSelected = selectedRoom?.roomNumber === room.roomNumber

                // Color coding based on occupants
                let roomBorderColor = 'border-slate-200 dark:border-white/5'
                let roomBgColor = 'bg-white/[0.01]'

                if (room.gender === 'mixed') {
                  roomBorderColor = 'border-rose-500 bg-rose-500/5'
                } else if (isSelected) {
                  roomBorderColor = 'border-indigo-500 bg-indigo-500/[0.04]'
                } else if (room.gender === 'male') {
                  roomBgColor = isLight ? 'bg-sky-50/50' : 'bg-sky-950/10'
                  roomBorderColor = isLight ? 'border-sky-200' : 'border-sky-500/10'
                } else if (room.gender === 'female') {
                  roomBgColor = isLight ? 'bg-rose-50/50' : 'bg-rose-950/10'
                  roomBorderColor = isLight ? 'border-rose-200' : 'border-rose-500/10'
                }

                return (
                  <div
                    key={room.roomNumber}
                    onClick={() => setSelectedRoom(room)}
                    className={`p-3 rounded-2xl border cursor-pointer hover:scale-105 active:scale-95 transition-all text-center flex flex-col justify-between h-24 ${roomBorderColor} ${roomBgColor}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>
                        Q-{room.floor}
                      </span>
                      {room.gender === 'mixed' && (
                        <AlertTriangle size={12} className="text-rose-500 animate-pulse" />
                      )}
                    </div>

                    <div>
                      <h4 className={`text-sm font-black ${textStrong}`}>{room.roomNumber}-xona</h4>
                      <p className={`text-[9px] font-bold ${textMuted}`}>{count} / 4 o&apos;rin</p>
                    </div>

                    {/* Visual beds representation (4 dots) */}
                    <div className="flex justify-center gap-1 mt-1 shrink-0">
                      {Array.from({ length: 4 }).map((_, idx) => {
                        const isOccupied = idx < count
                        const occ = room.occupants[idx]

                        let dotColor = isLight ? 'bg-slate-200' : 'bg-slate-800'
                        if (isOccupied) {
                          if (occ.gender === 'male') dotColor = 'bg-sky-500'
                          else if (occ.gender === 'female') dotColor = 'bg-rose-500'
                          else dotColor = 'bg-indigo-500'
                        }

                        return (
                          <div
                            key={idx}
                            className={`h-2 w-2 rounded-full transition-all ${dotColor}`}
                            title={occ ? `${occ.full_name} (${occ.status === 'registered' ? 'Faol' : 'Ruxsatnomali'})` : "Bo'sh joy"}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Room Detail Sidebar (Right) */}
        <div className="lg:col-span-4">
          <AnimatePresence mode="wait">
            {selectedRoom ? (
              <motion.div
                key={selectedRoom.roomNumber}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`p-5 rounded-3xl border ${surfaceBg} space-y-4`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                  <div>
                    <h3 className={`text-sm font-black uppercase tracking-wider ${textStrong}`}>
                      {selectedRoom.roomNumber}-xona tafsiloti
                    </h3>
                    <p className={`text-[9px] font-bold ${textMuted}`}>{selectedRoom.floor}-qavatda joylashgan</p>
                  </div>
                  <button
                    onClick={() => setSelectedRoom(null)}
                    className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 ${textMuted}`}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Mixed Gender Error message */}
                {selectedRoom.gender === 'mixed' && (
                  <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/20 text-rose-500 text-[10px] font-bold flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black">GENDER ARALASHUVI XATOSI!</p>
                      <p className="mt-0.5 text-[9px] leading-tight">
                        Xonada ham o‘g‘il bolalar, ham qiz bolalar joylashtirilgan. Iltimos, xona taqsimotini o‘zgartiring!
                      </p>
                    </div>
                  </div>
                )}

                {/* Occupants list */}
                <div className="space-y-3">
                  {selectedRoom.occupants.length === 0 ? (
                    <div className="text-center py-8 text-xs font-bold text-slate-500">Xona bo‘sh</div>
                  ) : (
                    selectedRoom.occupants.map((occ) => (
                      <div
                        key={occ.id}
                        className={`p-3 rounded-2xl border ${
                          isLight ? 'bg-slate-50/50 border-slate-200' : 'bg-white/[0.02] border-white/5'
                        } space-y-2`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className={`text-xs font-bold ${textStrong}`}>{occ.full_name}</h4>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                              occ.status === 'registered'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-amber-500/10 text-amber-500'
                            }`}
                          >
                            {occ.status === 'registered' ? 'Faol' : 'Kutmoqda'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[9px] font-bold">
                          <div>
                            <span className={textMuted}>Fakultet:</span>
                            <p className={`truncate ${textStrong}`} title={occ.faculty}>
                              {occ.faculty}
                            </p>
                          </div>
                          <div>
                            <span className={textMuted}>Kurs/Jinsi:</span>
                            <p className={textStrong}>
                              {occ.course}-kurs • {occ.gender === 'male' ? 'Erkak' : 'Ayol'}
                            </p>
                          </div>
                          <div>
                            <span className={textMuted}>Telefon:</span>
                            <p className={textStrong}>{occ.phone}</p>
                          </div>
                          {occ.warning_count && occ.warning_count > 0 ? (
                            <div>
                              <span className="text-amber-500">Ogohlantirishlar:</span>
                              <p className="text-amber-550 font-black">{occ.warning_count} ta</p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 text-[9px] font-bold text-slate-500 flex justify-between">
                  <span>Jami o‘rindagi joylar:</span>
                  <span>{selectedRoom.occupants.length} / 4 band</span>
                </div>
              </motion.div>
            ) : (
              <div className={`p-6 rounded-3xl border ${surfaceBg} text-center ${textMuted} text-xs font-bold`}>
                Xona tafsilotlarini ko‘rish uchun xarita bo‘limidan xonani bosing
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
