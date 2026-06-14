'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Building2, DoorOpen, Layers3, Users, Map as MapIcon, Info, MousePointer2, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useThemeStore } from '@/lib/stores/theme-store'

interface StudentInfo {
  id: string
  name: string
}

interface RoomOccupancySnapshot {
  roomNumber: string
  occupied: number
  capacity: number
  students: StudentInfo[]
}

interface FloorConfig {
  id: number
  name: string
  rooms: string[]
}

export default function Admin3DXonalarPage() {
  const [roomSnapshots, setRoomSnapshots] = useState<RoomOccupancySnapshot[]>([])
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string | null>(null)
  const [selectedBedIndex, setSelectedBedIndex] = useState<number | null>(null)
  const [currentFloorId, setCurrentFloorId] = useState(1)
  const [loading, setLoading] = useState(true)

  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const surfaceBg = isLight ? 'bg-white/80 border-slate-200 shadow-lg' : 'bg-[#0b1120]/50 border-white/10 shadow-[0_0_20px_rgba(6,182,212,0.05)]'
  const cardBg = isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-white/[0.04] border-white/10'
  const textMuted = isLight ? 'text-slate-600' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const svgCorridor = isLight ? 'text-slate-200/50' : 'text-white/5'
  const svgText = isLight ? 'fill-slate-500' : 'fill-white/10'
  const roomNumText = isLight ? 'fill-slate-700' : 'fill-slate-400'

  const floors: FloorConfig[] = useMemo(() =>
    [1, 2, 3, 4].map(f => ({
      id: f,
      name: `${f}-qavat`,
      rooms: Array.from({ length: 15 }, (_, i) => `${f}${String(i + 1).padStart(2, '0')}`)
    })), [])

  useEffect(() => {
    async function loadRoomOccupancy() {
      try {
        const { data } = await supabase
          .from('users')
          .select('id, room_number, full_name')
          .eq('role', 'talaba')
          .not('room_number', 'is', null)

        const occupancyMap = new Map<string, { count: number, students: StudentInfo[] }>()
        data?.forEach((user) => {
          if (!user.room_number) return
          const existing = occupancyMap.get(user.room_number) || { count: 0, students: [] }
          occupancyMap.set(user.room_number, {
            count: existing.count + 1,
            students: [...existing.students, { id: user.id, name: user.full_name }]
          })
        })

        setRoomSnapshots(
          Array.from(occupancyMap.entries()).map(([roomNumber, info]) => ({
            roomNumber,
            occupied: info.count,
            students: info.students,
            capacity: 4,
          }))
        )
      } catch (error) {
        console.error('3D xonalar bandligini yuklashda xato:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRoomOccupancy()
  }, [])

  const summary = useMemo(() => {
    const occupiedPlaces = roomSnapshots.reduce((total, room) => total + room.occupied, 0)
    const totalRooms = floors.reduce((acc, f) => acc + f.rooms.length, 0)

    return {
      occupiedPlaces,
      totalRooms,
      freePlaces: Math.max(totalRooms * 4 - occupiedPlaces, 0),
    }
  }, [roomSnapshots, floors])

  const selectedFloor = floors.find(f => f.id === currentFloorId)
  const selectedRoomData = useMemo(() => {
    if (!selectedRoomNumber) return null
    const snap = roomSnapshots.find(s => s.roomNumber === selectedRoomNumber)
    return {
      number: selectedRoomNumber,
      occupied: snap?.occupied ?? 0,
      capacity: 4,
      students: snap?.students ?? []
    }
  }, [selectedRoomNumber, roomSnapshots])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-400">
            <MapIcon className="h-4 w-4" />
            Xonalar interaktiv xaritasi
          </div>
          <h1 className={`mt-4 text-3xl font-black tracking-tight sm:text-4xl ${textStrong}`}>
            Bino qavatlari rejasi (SVG)
          </h1>
          <p className={`mt-3 max-w-3xl text-sm leading-6 ${textMuted}`}>
            Qavatlar bo&apos;yicha xonalar joylashuvini ko&apos;rish va boshqarish. Ranglar xonaning bandlik
            darajasini bildiradi. Xonani tanlash uchun ustiga bosing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <div className={`flex items-center gap-2 ${textMuted}`}>
              <Users className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">Band joy</span>
            </div>
            <p className={`mt-2 text-2xl font-black ${textStrong}`}>{loading ? '...' : summary.occupiedPlaces}</p>
          </div>
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <div className={`flex items-center gap-2 ${textMuted}`}>
              <DoorOpen className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">Bo&apos;sh joy</span>
            </div>
            <p className={`mt-2 text-2xl font-black ${textStrong}`}>{loading ? '...' : summary.freePlaces}</p>
          </div>
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <div className={`flex items-center gap-2 ${textMuted}`}>
              <Layers3 className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">Faol qavat</span>
            </div>
            <p className={`mt-2 truncate text-2xl font-black ${textStrong}`}>{selectedFloor?.name}</p>
          </div>
        </div>
      </div>

      {/* Floor Selector */}
      <div className="flex flex-wrap gap-2">
        {floors.map((floor) => (
          <button
            key={floor.id}
            onClick={() => {
              setCurrentFloorId(floor.id)
              setSelectedRoomNumber(null)
              setSelectedBedIndex(null)
            }}
            className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border ${currentFloorId === floor.id
              ? 'bg-cyan-500 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]'
              : isLight
                ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
          >
            {floor.name}
          </button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative min-h-[500px] rounded-[2rem] border p-8 backdrop-blur-xl overflow-hidden ${surfaceBg}`}
      >
        <div className="absolute top-6 left-6 z-10 flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cardBg}`}>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className={`text-[10px] font-bold uppercase tracking-tighter ${textStrong}`}>Bo&apos;sh</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cardBg}`}>
            <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            <span className={`text-[10px] font-bold uppercase tracking-tighter ${textStrong}`}>Qisman</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cardBg}`}>
            <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
            <span className={`text-[10px] font-bold uppercase tracking-tighter ${textStrong}`}>To&apos;la</span>
          </div>
        </div>

        <div className="flex items-center justify-center h-full pt-10">
          <svg viewBox="0 0 820 420" className="w-full max-w-5xl h-auto">
            {/* Corridor */}
            <rect x="40" y="190" width="740" height="40" fill="currentColor" className={svgCorridor} rx="4" />
            <text x="410" y="215" textAnchor="middle" className={`${svgText} text-[10px] font-bold uppercase tracking-[0.5em]`}>Yo&apos;lak (Corridor)</text>

            {selectedFloor?.rooms.map((roomNum, idx) => {
              const isTop = idx < 8
              const xPos = 60 + (isTop ? idx : idx - 8) * 85
              const yPos = isTop ? 50 : 270
              const snap = roomSnapshots.find(s => s.roomNumber === roomNum)
              const occupied = snap?.occupied ?? 0
              const isSelected = selectedRoomNumber === roomNum

              let colorClass = "fill-emerald-500/10 stroke-emerald-500/30"
              if (occupied >= 4) colorClass = "fill-rose-500/10 stroke-rose-500/30"
              else if (occupied > 0) colorClass = "fill-amber-500/10 stroke-amber-500/30"

              return (
                <g
                  key={roomNum}
                  className="cursor-pointer group transition-all"
                  onClick={() => {
                    setSelectedRoomNumber(roomNum)
                    setSelectedBedIndex(null)
                  }}
                >
                  {/* Xona devorlari */}
                  <rect
                    x={xPos} y={yPos} width="70" height="100" rx="10"
                    className={`${colorClass} stroke-2 transition-all ${isSelected ? (isLight ? 'stroke-indigo-600 stroke-[3px] filter drop-shadow-[0_0_10px_rgba(79,70,229,0.15)]' : 'stroke-white/80 stroke-[3px] filter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]') : 'group-hover:stroke-slate-400 group-hover:dark:stroke-white/40'}`}
                  />

                  {/* Eshik belgisi */}
                  <rect
                    x={xPos + 25} y={isTop ? yPos + 98 : yPos - 2}
                    width="20" height="4"
                    className="fill-cyan-400/50"
                  />

                  {/* Xona ichidagi yotoq joylari */}
                  {[0, 1, 2, 3].map((bedIdx) => {
                    const bedOccupied = bedIdx < occupied
                    const bx = xPos + (bedIdx < 2 ? 8 : 42)
                    const by = yPos + (bedIdx % 2 === 0 ? 10 : 60)
                    const isSelectedBed = isSelected && selectedBedIndex === bedIdx

                    return (
                      <g
                        key={bedIdx}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedRoomNumber(roomNum)
                          setSelectedBedIndex(bedIdx)
                        }}
                      >
                        {/* Karovat ramkasi */}
                        <rect
                          x={bx} y={by} width="20" height="30" rx="3"
                          className={`${bedOccupied ? 'fill-cyan-500/40 stroke-cyan-400/50' : isLight ? 'fill-slate-100 stroke-slate-200' : 'fill-white/5 stroke-white/10'} transition-all ${isSelectedBed ? (isLight ? 'stroke-indigo-600 stroke-2' : 'stroke-white stroke-2') : ''}`}
                        />
                        {/* Yostiq belgisi */}
                        <rect
                          x={bx + 4} y={by + 2} width="12" height="6" rx="1"
                          className={bedOccupied ? 'fill-cyan-200/40' : isLight ? 'fill-slate-200' : 'fill-white/10'}
                        />
                      </g>
                    )
                  })}

                  {/* Xona raqami (o'rtada, o'qish qulay bo'lishi uchun fon bilan) */}
                  <rect x={xPos + 18} y={yPos + 43} width="34" height="14" rx="4" className={isLight ? 'fill-slate-100/90' : 'fill-[#0b1120]/80'} />
                  <text
                    x={xPos + 35} y={yPos + 53}
                    textAnchor="middle"
                    className={`text-[9px] font-black tracking-tighter ${isSelected ? (isLight ? 'fill-indigo-600' : 'fill-white') : roomNumText}`}
                  >
                    {roomNum}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {selectedRoomData && (
          <motion.div
            key={selectedRoomData.number}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`rounded-[2rem] border p-6 sm:p-8 backdrop-blur-2xl shadow-2xl ${surfaceBg}`}
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Building2 size={24} />
                </div>
                <div>
                  <h2 className={`text-2xl font-black tracking-tight ${textStrong}`}>Xona #{selectedRoomData.number}</h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{selectedFloor?.name}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${cardBg}`}>
                <Info size={16} className="text-cyan-400" />
                <span className={`text-[10px] font-black uppercase tracking-widest ${textStrong}`}>Tafsilotlar</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Detail label="Xona raqami" value={`#${selectedRoomData.number}`} icon={<MousePointer2 size={16} />} textStrong={textStrong} cardBg={cardBg} />
              <Detail
                label="Bandlik holati"
                value={`${selectedRoomData.occupied} / ${selectedRoomData.capacity}`}
                icon={<Users size={16} />}
                status={selectedRoomData.occupied >= 4 ? 'full' : selectedRoomData.occupied > 0 ? 'partial' : 'empty'}
                textStrong={textStrong}
                cardBg={cardBg}
              />
              <Detail
                label="Bo'sh joylar"
                value={`${selectedRoomData.capacity - selectedRoomData.occupied} ta`}
                icon={<DoorOpen size={16} />}
                textStrong={textStrong}
                cardBg={cardBg}
              />
              {selectedBedIndex !== null && (
                <div className="md:col-span-3">
                  <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${cardBg} hover:bg-white/[0.08]`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                        <Users size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tanlangan yotoqdagi talaba</p>
                        <p className={`text-xl font-black ${textStrong}`}>{selectedRoomData.students[selectedBedIndex]?.name || "Bo&apos;sh joy"}</p>
                      </div>
                    </div>
                    {selectedRoomData.students[selectedBedIndex] && (
                      <Link
                        href={`/admin/foydalanuvchilar?id=${selectedRoomData.students[selectedBedIndex].id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-widest transition-all border border-cyan-500/20 shadow-lg shadow-cyan-500/5"
                      >
                        Profilga o&apos;tish
                        <ExternalLink size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 flex justify-end">
              <button className="px-8 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-lg shadow-cyan-500/20">
                Talabalar ro&apos;yxati
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Detail({ label, value, icon, status, textStrong, cardBg }: { label: string; value: string; icon?: React.ReactNode; status?: 'empty' | 'partial' | 'full'; textStrong: string; cardBg: string }) {
  const statusColors = {
    empty: 'text-emerald-400',
    partial: 'text-amber-400',
    full: 'text-rose-400'
  }

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${cardBg} hover:bg-white/[0.08]`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-slate-500">{icon}</div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      </div>
      <p className={`text-2xl font-black ${status ? statusColors[status] : textStrong}`}>{value}</p>
    </div>
  )
}
