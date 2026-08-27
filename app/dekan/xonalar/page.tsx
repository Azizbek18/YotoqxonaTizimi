'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  AlertTriangle,
  X,
  BedDouble,
  DoorOpen,
  DoorClosed,
  Users2,
  UserPlus,
  UserMinus,
  LayoutGrid,
  Plus,
  RotateCcw,
  Snowflake,
  Unlock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchDekanOverview } from '@/features/permits/client/admin-api'
import { fetchAssignableStudents, assignStudentRoom } from '@/features/room-assignment/client/api'
import type { FacultyStudentRow } from '@/features/room-assignment/types'
import { setRoomFrozen } from '@/features/room-layout/client/api'
import ConfirmModal from '@/components/ui/ConfirmModal'
import RoomLayoutGeneratorModal from '@/components/rooms/RoomLayoutGeneratorModal'
import { useRoomFloors } from '@/lib/hooks/useRoomFloors'
import { fetchAppSettings } from '@/features/app-settings/client/api'
import { permitFacultyLabel } from '@/lib/faculties'
import { directionLabel } from '@/lib/directions'
import { normalizeGender, genderLabel, genderAccent } from '@/lib/gender'

interface Occupant {
  id: string
  full_name: string
  passport_series: string
  jshshir: string | null
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
  frozen: boolean
  frozenReason: string | null
  // False for "orphan" rooms — occupied but missing from floor_room_layout
  // (see the comment above `orphans` below). Freezing writes to that table,
  // so a room that isn't in it can't be frozen from here.
  inLayout: boolean
}

export default function DekanXonalarMap() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  // Styling tokens
  const surfaceBg = isLight
    ? 'bg-white/80 border-slate-200 shadow-md'
    : 'bg-[#0f172a]/30 border-white/5 shadow-2xl'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const inputBg = isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'

  // Which room sits on which floor is the admin's data (Qavat tarxi
  // quruvchisi), not something to infer from the room number — this page used
  // to invent rooms 1..150 and slice them into floors of 30, which silently
  // disagreed with the real building.
  const { rooms: layoutRooms, floors, floorOf, loaded: floorsLoaded, reload: reloadRoomFloors } = useRoomFloors()

  // State
  const [occupantsByRoom, setOccupantsByRoom] = useState<Record<string, Occupant[]>>({})
  const [roomCapacity, setRoomCapacity] = useState(4)
  const [floorCount, setFloorCount] = useState(0)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null)
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Room assignment state
  const [students, setStudents] = useState<FacultyStudentRow[]>([])
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const detailPanelRef = useRef<HTMLDivElement>(null)

  // Freeze / unfreeze (ta'mirlash) state
  const [freezeModalOpen, setFreezeModalOpen] = useState(false)
  const [freezeReason, setFreezeReason] = useState('')
  const [freezingRoom, setFreezingRoom] = useState(false)

  const selectRoom = (room: RoomData) => {
    setSelectedRoom(room)
    // On mobile the detail panel sits below the room grid (no sticky sidebar),
    // so bring it into view instead of leaving the user scrolled elsewhere.
    if (window.innerWidth < 1024) {
      window.requestAnimationFrame(() => {
        detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  const loadStudents = async () => {
    try {
      const rows = await fetchAssignableStudents()
      setStudents(rows)
    } catch (err) {
      console.error('Error fetching faculty students:', err)
    }
  }

  const fetchRoomsData = async () => {
    setLoading(true)
    try {
      const { usersWithRooms: users, approvedPermitsWithRooms: permits } = await fetchDekanOverview()

      // Map to combined occupants list
      const occupantsMap: Record<string, Occupant[]> = {}

      users?.forEach((u) => {
        if (!u.room_number) return
        const occupant: Occupant = {
          // Other-faculty occupants have their auth id redacted server-side
          // (a dekan has no jurisdiction to act on them) — falls back to
          // '' rather than undefined so it never collides with a real id.
          id: u.id || '',
          full_name: u.full_name || 'Noma‘lum',
          passport_series: u.passport_series || '',
          jshshir: u.jshshir || '',
          phone: u.phone_number || '',
          gender: u.gender || '',
          faculty: u.faculty || '',
          direction: u.direction || '',
          course: u.course || 0,
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
          id: p.id || '',
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
        // Avoid duplicate if already registered (though status 'approved' vs 'registered' should handle this).
        // Redacted cross-faculty rows share the same blank passport_series,
        // so only apply this de-dup when there's an actual passport to match on.
        const exists = Boolean(p.passport_series) && occupantsMap[p.room_number].some((o) => o.passport_series === p.passport_series)
        if (!exists) {
          occupantsMap[p.room_number].push(occupant)
        }
      })

      setOccupantsByRoom(occupantsMap)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoomsData()
    loadStudents()
    fetchAppSettings()
      .then((settings) => {
        setRoomCapacity(settings.defaultRoomCapacity)
        setFloorCount(settings.floorCount)
      })
      .catch((err) => console.error('Xona sozlamalarini yuklashda xato:', err))
  }, [])

  const rooms = useMemo<RoomData[]>(() => {
    const roomGender = (occupants: Occupant[]): string | null => {
      if (occupants.length === 0) return null
      const genders = occupants.map((o) => normalizeGender(o.gender))
      if (genders.every((g) => g === 'male')) return 'male'
      if (genders.every((g) => g === 'female')) return 'female'
      return 'mixed'
    }

    const fromLayout: RoomData[] = layoutRooms.map(({ roomNumber, floor, frozen, frozenReason }) => {
      const occupants = occupantsByRoom[roomNumber] ?? []
      return { roomNumber, occupants, floor, gender: roomGender(occupants), frozen, frozenReason, inLayout: true }
    })

    // A room can hold students and still be absent from the layout (placed
    // before the tarx was drawn, or drawn on a floor that was later reset).
    // Dropping it here would hide real residents from the dekan entirely, so
    // it's appended with a best-effort floor instead.
    const known = new Set(layoutRooms.map((room) => room.roomNumber))
    const orphans: RoomData[] = Object.entries(occupantsByRoom)
      .filter(([roomNumber, occupants]) => occupants.length > 0 && !known.has(roomNumber))
      .map(([roomNumber, occupants]) => ({
        roomNumber,
        occupants,
        floor: floorOf(roomNumber) ?? 0,
        gender: roomGender(occupants),
        frozen: false,
        frozenReason: null,
        inLayout: false,
      }))

    return [...fromLayout, ...orphans]
  }, [layoutRooms, occupantsByRoom, floorOf])

  // Keep the open detail panel in sync with the freshly-refetched room list
  // (e.g. after assigning/removing a student) instead of showing a stale snapshot.
  useEffect(() => {
    setSelectedRoom((prev) => {
      if (!prev) return prev
      return rooms.find((r) => r.roomNumber === prev.roomNumber) ?? prev
    })
  }, [rooms])

  const handleAssignStudent = async (studentId: string, source: 'user' | 'permit') => {
    if (!selectedRoom) return
    setAssigningId(studentId)
    try {
      await assignStudentRoom({ studentId, roomNumber: selectedRoom.roomNumber, source })
      toast.success(
        source === 'permit'
          ? "Xona biriktirildi — talaba ro'yxatdan o'tganda shu xonaga joylashadi"
          : 'Talaba xonaga joylashtirildi',
      )
      setAssignModalOpen(false)
      setAssignSearch('')
      await Promise.all([fetchRoomsData(), loadStudents()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Joylashtirishda xatolik yuz berdi")
    } finally {
      setAssigningId(null)
    }
  }

  // A room's occupants list mixes real residents ('registered') with
  // approved-but-unregistered permits ('approved') that already have a room
  // pre-assigned — both can be released the same way, just via different
  // backend rows (users vs permit_requests), hence the source lookup here.
  const handleRemoveStudent = async (occ: Occupant) => {
    setRemovingId(occ.id)
    try {
      const source = occ.status === 'approved' ? 'permit' : 'user'
      await assignStudentRoom({ studentId: occ.id, roomNumber: null, source })
      toast.success(`${occ.full_name} xonadan chiqarildi`)
      setConfirmRemoveId(null)
      await Promise.all([fetchRoomsData(), loadStudents()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chiqarishda xatolik yuz berdi")
    } finally {
      setRemovingId(null)
    }
  }

  const handleFreezeRoom = async () => {
    if (!selectedRoom) return
    setFreezingRoom(true)
    try {
      await setRoomFrozen(selectedRoom.roomNumber, true, freezeReason)
      toast.success(`${selectedRoom.roomNumber}-xona muzlatildi`)
      setFreezeModalOpen(false)
      setFreezeReason('')
      await Promise.all([reloadRoomFloors(), fetchRoomsData()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xonani muzlatib bo'lmadi")
    } finally {
      setFreezingRoom(false)
    }
  }

  const handleUnfreezeRoom = async () => {
    if (!selectedRoom) return
    setFreezingRoom(true)
    try {
      await setRoomFrozen(selectedRoom.roomNumber, false)
      toast.success(`${selectedRoom.roomNumber}-xona qayta ochildi`)
      await Promise.all([reloadRoomFloors(), fetchRoomsData()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xonani ochib bo'lmadi")
    } finally {
      setFreezingRoom(false)
    }
  }

  // Filters
  const filteredRooms = rooms.filter((r) => {
    const matchesFloor = floorFilter === 'all' || r.floor === floorFilter
    const matchesSearch =
      r.roomNumber.includes(searchTerm) ||
      r.occupants.some((o) => o.full_name.toLowerCase().includes(searchTerm.toLowerCase()))

    return matchesFloor && matchesSearch
  })

  // Assignable students for the currently selected room: name search, plus
  // gender-matched to existing occupants (an empty/mixed room allows anyone).
  const assignableStudents = students
    .filter((s) => s.full_name.toLowerCase().includes(assignSearch.toLowerCase()))
    .filter((s) => {
      if (!selectedRoom?.gender || selectedRoom.gender === 'mixed') return true
      return normalizeGender(s.gender) === selectedRoom.gender
    })

  // Calculate totals
  const totalOccupiedBeds = rooms.reduce((acc, r) => acc + r.occupants.length, 0)
  const totalBeds = rooms.length * roomCapacity
  const totalRoomsWithMixedGenders = rooms.filter((r) => r.gender === 'mixed').length
  const totalEmptyRooms = rooms.filter((r) => r.occupants.length === 0).length
  const totalFullRooms = rooms.filter((r) => r.occupants.length >= roomCapacity).length

  return (
    <div className="space-y-6">
      {/* 1. Header Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Jami band joylar', value: `${totalOccupiedBeds} / ${totalBeds}`, icon: BedDouble, color: 'from-indigo-500 to-purple-600' },
          { label: 'Bo‘sh xonalar', value: `${totalEmptyRooms} ta`, icon: DoorOpen, color: 'from-emerald-500 to-teal-600' },
          { label: `To‘la xonalar (${roomCapacity}/${roomCapacity})`, value: `${totalFullRooms} ta`, icon: DoorClosed, color: 'from-sky-500 to-blue-600' },
          { label: 'Gender xatoliklar', value: `${totalRoomsWithMixedGenders} ta xona`, icon: Users2, color: 'from-rose-500 to-red-600', warn: totalRoomsWithMixedGenders > 0 },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`relative overflow-hidden p-4 pt-5 rounded-2xl border ${surfaceBg} flex items-center gap-3`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.color}`} />
            <div className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-tr ${stat.color} flex items-center justify-center text-white shadow-lg`}>
              <stat.icon size={19} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <span className={`block text-[9px] font-black uppercase tracking-wider truncate ${textMuted}`}>{stat.label}</span>
              <h3 className={`text-lg sm:text-xl font-black mt-0.5 ${stat.warn ? 'text-rose-500 animate-pulse' : textStrong}`}>
                {stat.value}
              </h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 2. Map Controls */}
      <div className={`p-4 rounded-3xl border ${surfaceBg} flex flex-col gap-3`}>
        {/* Search — o'z qatorida, to'liq kenglikda */}
        <div className="relative">
          <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${textMuted}`} />
          <input
            type="text"
            placeholder="Xona raqami yoki talaba ismi bo'yicha qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full text-sm font-medium py-3.5 pl-12 pr-11 rounded-2xl outline-none border transition-all placeholder:font-normal focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${inputBg}`}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Qidiruvni tozalash"
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors hover:bg-slate-200/70 dark:hover:bg-white/10 ${textMuted}`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Floor Selection */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl">
            <button
              onClick={() => setFloorFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                floorFilter === 'all'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              Barchasi
            </button>
            {floors.map((fl) => (
              <button
                key={fl}
                onClick={() => setFloorFilter(fl)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  floorFilter === fl
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'
                }`}
              >
                {fl}-qavat
              </button>
            ))}
          </div>

          {/* Always available, not just on an empty layout — a floor can
              always be missing a few rooms nobody's drawn yet. */}
          <button
            onClick={() => setGeneratorOpen(true)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
              isLight
                ? 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-indigo-500/30 hover:text-white'
            }`}
          >
            <Plus size={13} /> Xona qo&apos;shish
          </button>
        </div>

      </div>

      {/* 3. Main Occupancy Grid and Side Detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Rooms Grid (Left) */}
        <div className={`lg:col-span-8 p-5 rounded-3xl border ${surfaceBg}`}>
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 pb-4 border-b text-[10px] font-bold ${isLight ? 'border-slate-100' : 'border-white/5'} ${textMuted}`}>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" /> O&apos;g&apos;il bolalar</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Qiz bolalar</span>
            <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${isLight ? 'bg-slate-300' : 'bg-slate-700'}`} /> Bo&apos;sh joy</span>
            <span className="flex items-center gap-1.5"><AlertTriangle size={11} className="text-rose-500" /> Gender aralashuvi</span>
            <span className="flex items-center gap-1.5"><Snowflake size={11} className="text-sky-500" /> Muzlatilgan (ta&apos;mirlash)</span>
          </div>
          {loading || !floorsLoaded ? (
            <div className="flex h-64 items-center justify-center">
              <div className={`animate-spin rounded-full h-8 w-8 border-t-2 ${isLight ? 'border-indigo-600' : 'border-cyan-500'}`} />
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isLight ? 'bg-amber-50 text-amber-500' : 'bg-amber-500/10 text-amber-400'}`}>
                <LayoutGrid size={24} />
              </div>
              <h3 className={`text-sm font-black ${textStrong}`}>Xonalar hali kiritilmagan</h3>
              <p className={`mx-auto mt-2 max-w-md text-[11px] font-bold leading-relaxed ${textMuted}`}>
                Qaysi xona qaysi qavatda ekanini admin &laquo;Qavat tarxi quruvchisi&raquo;da belgilaydi. Admin
                kiritishini kutishingiz yoki xonalarni hozirning o&apos;zida o&apos;zingiz yaratishingiz mumkin —
                yaratganingiz adminda ham ko&apos;rinadi.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setGeneratorOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:from-indigo-600 hover:to-violet-700 active:scale-95"
                >
                  <Plus size={14} /> O&apos;zingiz kiriting
                </button>
                <button
                  onClick={() => { void reloadRoomFloors(); void fetchRoomsData() }}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                    isLight
                      ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <RotateCcw size={14} /> Qayta tekshirish
                </button>
              </div>

            </div>
          ) : (
            <>
              {/* Rooms exist only because students live in them — the building
                  itself was never entered, so most rooms are missing and the
                  dekan can't place anyone into them. */}
              {layoutRooms.length === 0 && (
                <div className={`mb-4 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                  isLight ? 'border-amber-200 bg-amber-50' : 'border-amber-500/25 bg-amber-500/10'
                }`}>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-amber-500">
                      Xonalar tarxi kiritilmagan
                    </p>
                    <p className={`mt-1 text-[10px] font-bold leading-relaxed ${textMuted}`}>
                      Quyida faqat talabasi bor {rooms.length} ta xona ko&apos;rsatilmoqda. Barcha xonalar
                      ko&apos;rinishi va yangi talaba joylashtira olishingiz uchun tarx kiritilishi kerak.
                    </p>
                  </div>
                  <button
                    onClick={() => setGeneratorOpen(true)}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:from-amber-600 hover:to-orange-700 active:scale-95"
                  >
                    <Plus size={14} /> O&apos;zingiz kiriting
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {filteredRooms.map((room) => {
                const count = room.occupants.length
                const isSelected = selectedRoom?.roomNumber === room.roomNumber

                // Color coding based on occupants
                let roomBorderColor = 'border-slate-200 dark:border-white/5'
                let roomBgColor = 'bg-white/[0.01]'

                if (room.gender === 'mixed') {
                  roomBorderColor = 'border-rose-500 bg-rose-500/5 ring-2 ring-rose-500/20'
                } else if (room.frozen) {
                  roomBorderColor = 'border-sky-400 bg-sky-500/5 ring-2 ring-sky-400/20'
                } else if (isSelected) {
                  roomBorderColor = 'border-indigo-500 bg-indigo-500/[0.05] ring-2 ring-indigo-500/20'
                } else if (room.gender === 'male' || room.gender === 'female') {
                  const accent = genderAccent(room.gender)
                  roomBgColor = isLight ? accent.badgeBgLight : accent.badgeBg
                  roomBorderColor = isLight ? accent.borderLight : accent.border
                }

                return (
                  <div
                    key={room.roomNumber}
                    onClick={() => selectRoom(room)}
                    className={`p-3 rounded-2xl border cursor-pointer hover:scale-105 hover:shadow-lg active:scale-95 transition-all text-center flex flex-col justify-between h-24 ${roomBorderColor} ${roomBgColor} ${room.frozen ? 'opacity-80' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>
                        {room.floor > 0 ? `Q-${room.floor}` : 'Q-?'}
                      </span>
                      {room.gender === 'mixed' ? (
                        <AlertTriangle size={12} className="text-rose-500 animate-pulse" />
                      ) : room.frozen ? (
                        <Snowflake size={12} className="text-sky-500" />
                      ) : null}
                    </div>

                    <div>
                      <h4 className={`text-sm font-black ${textStrong}`}>{room.roomNumber}-xona</h4>
                      <p className={`text-[9px] font-bold ${room.frozen ? 'text-sky-500' : textMuted}`}>
                        {room.frozen ? "Muzlatilgan" : `${count} / ${roomCapacity} o'rin`}
                      </p>
                    </div>

                    {/* One dot per bed, per the admin's xona sig'imi setting */}
                    <div className="flex justify-center gap-1 mt-1 shrink-0">
                      {Array.from({ length: roomCapacity }).map((_, idx) => {
                        const isOccupied = idx < count
                        const occ = room.occupants[idx]

                        let dotColor = isLight ? 'bg-slate-200' : 'bg-slate-800'
                        if (isOccupied) {
                          const occGender = normalizeGender(occ.gender)
                          dotColor = occGender ? genderAccent(occGender).dot : 'bg-indigo-500'
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
            </>
          )}
        </div>

        {/* Room Detail Sidebar (Right) */}
        <div ref={detailPanelRef} className="lg:col-span-4 lg:sticky lg:top-24 self-start scroll-mt-24">
          <AnimatePresence mode="wait">
            {selectedRoom ? (
              <motion.div
                key={selectedRoom.roomNumber}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`flex flex-col max-h-[calc(100vh-7.5rem)] p-5 rounded-3xl border ${surfaceBg}`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
                  <div>
                    <h3 className={`text-sm font-black uppercase tracking-wider ${textStrong}`}>
                      {selectedRoom.roomNumber}-xona tafsiloti
                    </h3>
                    <p className={`text-[9px] font-bold ${textMuted}`}>
                      {selectedRoom.floor > 0
                        ? `${selectedRoom.floor}-qavatda joylashgan`
                        : 'Qavat tarxida belgilanmagan xona'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedRoom(null)}
                    className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 shrink-0 ${textMuted}`}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex-1 min-h-0 space-y-4 overflow-y-auto custom-scrollbar pt-4 -mr-1 pr-1">
                {selectedRoom.gender === 'mixed' || selectedRoom.frozen ? null : selectedRoom.occupants.length >= roomCapacity ? (
                  <div className={`p-2.5 rounded-xl text-center text-[10px] font-bold ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}>
                    Xona to&apos;la — yangi talaba joylashtirib bo&apos;lmaydi
                  </div>
                ) : (
                  <button
                    onClick={() => setAssignModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95"
                  >
                    <UserPlus size={14} /> Talaba joylashtirish
                  </button>
                )}

                {/* Frozen (ta'mirlash) notice — the room's only unfreeze control, made
                    at least as prominent as the freeze button below so a dekan who
                    lands here from a frozen tile isn't left hunting for it. */}
                {selectedRoom.frozen && (
                  <div className="p-3 rounded-2xl bg-sky-500/15 border border-sky-500/20 text-sky-500 text-[10px] font-bold flex items-start gap-2">
                    <Snowflake size={14} className="shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-black">XONA MUZLATILGAN</p>
                      <p className="mt-0.5 text-[9px] leading-tight">
                        {selectedRoom.frozenReason || "Ta'mirlash tufayli vaqtincha yopilgan."} Yangi talaba
                        joylashtirib bo&apos;lmaydi — mavjud talabalar o&apos;z joyida qoladi.
                      </p>
                      <button
                        onClick={handleUnfreezeRoom}
                        disabled={freezingRoom}
                        className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                      >
                        <Unlock size={12} /> {freezingRoom ? 'Bajarilmoqda...' : 'Muzlatishni bekor qilish'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Freeze (ta'mirlash) action — a labeled button, not just an icon, so
                    it's actually noticed instead of blending into the header. Shown
                    regardless of capacity/gender: a full or mixed room can still need
                    to go into repair. Orphan rooms (not in floor_room_layout) can't be
                    frozen from here — see the RoomData.inLayout comment. */}
                {selectedRoom.inLayout && !selectedRoom.frozen && (
                  <button
                    onClick={() => setFreezeModalOpen(true)}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                      isLight
                        ? 'border-sky-200 bg-sky-50 text-sky-600 hover:border-sky-300 hover:bg-sky-100'
                        : 'border-sky-500/25 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 hover:text-sky-300'
                    }`}
                  >
                    <Snowflake size={14} /> Xonani muzlatish (ta&apos;mirlash)
                  </button>
                )}

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
                    selectedRoom.occupants.map((occ, occIndex) => (
                      <div
                        key={occ.id || `${selectedRoom.roomNumber}-anon-${occIndex}`}
                        className={`p-3 rounded-2xl border ${
                          isLight ? 'bg-slate-50/50 border-slate-200' : 'bg-white/[0.02] border-white/5'
                        } space-y-2`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${genderAccent(occ.gender).dot}`} />
                            <h4 className={`text-xs font-bold truncate ${textStrong}`}>{occ.full_name}</h4>
                          </div>
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                              occ.status === 'registered'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-amber-500/10 text-amber-500'
                            }`}
                          >
                            {occ.status === 'registered' ? 'Faol' : 'Kutmoqda'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 text-[10px] font-bold">
                          <div>
                            <span className={textMuted}>Fakultet:</span>
                            <p className={`truncate ${textStrong}`} title={permitFacultyLabel(occ.faculty)}>
                              {permitFacultyLabel(occ.faculty) || '—'}
                            </p>
                          </div>
                          <div>
                            <span className={textMuted}>Kurs/Jinsi:</span>
                            <p className={textStrong}>
                              {occ.course ? `${occ.course}-kurs • ` : ''}{genderLabel(occ.gender)}
                            </p>
                          </div>
                          <div>
                            <span className={textMuted}>Telefon:</span>
                            <p className={textStrong}>{occ.phone}</p>
                          </div>
                          {occ.warning_count && occ.warning_count > 0 ? (
                            <div>
                              <span className="text-amber-500">Ogohlantirishlar:</span>
                              <p className="text-amber-500 font-black">{occ.warning_count} ta</p>
                            </div>
                          ) : null}
                        </div>

                        {occ.id && (
                          confirmRemoveId === occ.id ? (
                            <div
                              className={`mt-1 flex items-center gap-2 rounded-xl border px-2.5 py-2 ${
                                isLight ? 'border-rose-200 bg-rose-50' : 'border-rose-500/25 bg-rose-500/10'
                              }`}
                            >
                              <AlertTriangle size={12} className="shrink-0 text-rose-500" />
                              <span className="flex-1 text-[9px] font-black uppercase tracking-wider text-rose-500">
                                Rostdan chiqarilsinmi?
                              </span>
                              <button
                                onClick={() => handleRemoveStudent(occ)}
                                disabled={removingId === occ.id}
                                className="rounded-lg bg-rose-500 hover:bg-rose-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                              >
                                {removingId === occ.id ? '...' : 'Ha'}
                              </button>
                              <button
                                onClick={() => setConfirmRemoveId(null)}
                                className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                                  isLight
                                    ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                                }`}
                              >
                                Yo&apos;q
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmRemoveId(occ.id)}
                              className={`mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border py-1.5 text-[9px] font-black uppercase tracking-wider transition-colors ${
                                isLight
                                  ? 'border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100'
                                  : 'border-rose-500/25 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300'
                              }`}
                            >
                              <UserMinus size={11} />
                              {occ.status === 'approved' ? "Xona biriktirishni bekor qilish" : 'Xonadan chiqarish'}
                            </button>
                          )
                        )}
                      </div>
                    ))
                  )}
                </div>
                </div>

                <div className={`shrink-0 pt-3 mt-1 border-t text-[9px] font-bold flex justify-between ${isLight ? 'border-slate-100 text-slate-500' : 'border-white/5 text-slate-500'}`}>
                  <span>Jami o‘rindagi joylar:</span>
                  <span>{selectedRoom.occupants.length} / {roomCapacity} band</span>
                </div>
              </motion.div>
            ) : (
              <div className={`p-10 rounded-3xl border ${surfaceBg} flex flex-col items-center justify-center text-center`}>
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mb-3">
                  <BedDouble size={20} />
                </div>
                <p className={`text-xs font-bold ${textMuted}`}>Xona tafsilotlarini ko‘rish uchun xarita bo‘limidan xonani bosing</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Assign Student Modal */}
      <ConfirmModal
        isOpen={assignModalOpen && !!selectedRoom}
        title="Talaba joylashtirish"
        description={selectedRoom ? `${selectedRoom.roomNumber}-xonaga talaba tanlang` : undefined}
        onClose={() => {
          setAssignModalOpen(false)
          setAssignSearch('')
        }}
      >
        <div className="space-y-3">
          <div className="relative">
            <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${textMuted}`} />
            <input
              type="text"
              autoFocus
              placeholder="Talaba ismi bo'yicha qidirish..."
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              className={`w-full text-sm font-medium py-3.5 pl-12 pr-11 rounded-2xl outline-none border transition-all placeholder:font-normal focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${inputBg}`}
            />
            {assignSearch && (
              <button
                type="button"
                onClick={() => setAssignSearch('')}
                aria-label="Qidiruvni tozalash"
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors hover:bg-slate-200/70 dark:hover:bg-white/10 ${textMuted}`}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1 custom-scrollbar">
            {assignableStudents.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={assigningId === s.id}
                onClick={() => handleAssignStudent(s.id, s.source)}
                className={`w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all ${
                  isLight
                    ? 'border-slate-200 bg-white hover:border-indigo-300'
                    : 'border-white/5 bg-white/[0.02] hover:border-indigo-500/30'
                }`}
              >
                <div className="min-w-0 flex items-start gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 mt-1 ${genderAccent(s.gender).dot}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className={`text-xs font-bold truncate ${textStrong}`}>{s.full_name}</p>
                      {s.source === 'permit' && (
                        <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-500">
                          Ro&apos;yxatdan o&apos;tmagan
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${textMuted}`}>
                      {s.direction ? `${directionLabel(s.direction)} • ` : ''}{s.course ? `${s.course}-kurs • ` : ''}
                      {genderLabel(s.gender)}
                    </p>
                  </div>
                </div>
                {assigningId === s.id ? (
                  <span className="shrink-0 text-[9px] font-black uppercase text-indigo-500">...</span>
                ) : (
                  <UserPlus size={16} className="shrink-0 text-indigo-500" />
                )}
              </button>
            ))}

            {assignableStudents.length === 0 && (
              <p className={`py-6 text-center text-xs font-bold ${textMuted}`}>Talaba topilmadi</p>
            )}
          </div>
        </div>
      </ConfirmModal>

      {/* Freeze room modal */}
      <ConfirmModal
        isOpen={freezeModalOpen && !!selectedRoom}
        title={selectedRoom ? `${selectedRoom.roomNumber}-xonani muzlatish` : 'Xonani muzlatish'}
        description="Ta'mirlash davomida bu xonaga yangi talaba joylashtirib bo'lmaydi. Xonadagi mavjud talabalar joyida qoladi."
        confirmText={freezingRoom ? 'Saqlanmoqda...' : 'Xonani muzlatish'}
        confirmVariant="danger"
        onConfirm={handleFreezeRoom}
        onClose={() => {
          setFreezeModalOpen(false)
          setFreezeReason('')
        }}
        isLoading={freezingRoom}
      >
        <div className="space-y-1.5">
          <label className={`block text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Sabab (ixtiyoriy)
          </label>
          <textarea
            value={freezeReason}
            onChange={(e) => setFreezeReason(e.target.value)}
            rows={3}
            placeholder="Masalan: Santexnika ta'mirlanmoqda"
            className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 ${inputBg}`}
          />
        </div>
      </ConfirmModal>

      <RoomLayoutGeneratorModal
        isOpen={generatorOpen}
        floorCount={floorCount}
        existingRooms={layoutRooms}
        onClose={() => setGeneratorOpen(false)}
        onCreated={() => {
          void reloadRoomFloors()
          void fetchRoomsData()
        }}
      />
    </div>
  )
}
