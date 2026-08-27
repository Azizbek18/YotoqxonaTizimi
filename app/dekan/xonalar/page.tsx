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
import { dekanUI, statusChip } from '@/lib/dekan-ui'

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
  const ui = dekanUI(isLight)

  // Styling tokens
  const surfaceBg = ui.card
  const textMuted = ui.muted
  const textStrong = ui.strong

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
          { label: 'Jami band joylar', value: `${totalOccupiedBeds} / ${totalBeds}`, icon: BedDouble },
          { label: 'Bo‘sh xonalar', value: `${totalEmptyRooms} ta`, icon: DoorOpen },
          { label: `To‘la xonalar (${roomCapacity}/${roomCapacity})`, value: `${totalFullRooms} ta`, icon: DoorClosed },
          { label: 'Gender xatoliklar', value: `${totalRoomsWithMixedGenders} ta xona`, icon: Users2, warn: totalRoomsWithMixedGenders > 0 },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.2 }}
            className={`p-4 rounded-xl border ${surfaceBg} flex items-center gap-3`}
          >
            <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${
              stat.warn ? statusChip('danger', isLight).chip : ui.accentSoft
            }`}>
              <stat.icon size={18} strokeWidth={2.1} />
            </div>
            <div className="min-w-0">
              <span className={`block text-[9px] font-semibold uppercase tracking-wider truncate ${textMuted}`}>{stat.label}</span>
              <h3 className={`text-lg sm:text-xl font-bold mt-0.5 ${stat.warn ? statusChip('danger', isLight).text : textStrong}`}>
                {stat.value}
              </h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 2. Map Controls */}
      <div className={`p-4 rounded-2xl border ${surfaceBg} flex flex-col gap-3`}>
        <div className="relative">
          <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${ui.faint}`} />
          <input
            type="text"
            placeholder="Xona raqami yoki talaba ismi bo'yicha qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full text-sm py-3 pl-12 pr-11 rounded-xl border transition-colors ${ui.input} ${ui.ring}`}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Qidiruvni tozalash"
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Floor Selection */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`flex flex-wrap gap-1 rounded-xl p-1 ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`}>
            {(['all', ...floors] as const).map((fl) => (
              <button
                key={fl}
                onClick={() => setFloorFilter(fl as number | 'all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  floorFilter === fl
                    ? 'bg-indigo-600 text-white'
                    : `${ui.muted} ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-200'}`
                }`}
              >
                {fl === 'all' ? 'Barchasi' : `${fl}-qavat`}
              </button>
            ))}
          </div>

          <button
            onClick={() => setGeneratorOpen(true)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
          >
            <Plus size={13} /> Xona qo&apos;shish
          </button>
        </div>
      </div>

      {/* 3. Main Occupancy Grid and Side Detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Rooms Grid (Left) */}
        <div className={`lg:col-span-8 p-5 rounded-2xl border ${surfaceBg}`}>
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 pb-4 border-b text-[10px] font-medium ${ui.border} ${textMuted}`}>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> O&apos;g&apos;il bolalar</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Qiz bolalar</span>
            <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`} /> Bo&apos;sh joy</span>
            <span className="flex items-center gap-1.5"><AlertTriangle size={11} className={isLight ? 'text-rose-500' : 'text-rose-400'} /> Gender aralashuvi</span>
            <span className="flex items-center gap-1.5"><Snowflake size={11} className={ui.faint} /> Muzlatilgan (ta&apos;mirlash)</span>
          </div>
          {loading || !floorsLoaded ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-slate-500'}`}>
                <LayoutGrid size={24} />
              </div>
              <h3 className={`text-sm font-semibold ${textStrong}`}>Xonalar hali kiritilmagan</h3>
              <p className={`mx-auto mt-2 max-w-md text-[11px] leading-relaxed ${textMuted}`}>
                Qaysi xona qaysi qavatda ekanini admin &laquo;Qavat tarxi quruvchisi&raquo;da belgilaydi. Admin
                kiritishini kutishingiz yoki xonalarni hozirning o&apos;zida o&apos;zingiz yaratishingiz mumkin —
                yaratganingiz adminda ham ko&apos;rinadi.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setGeneratorOpen(true)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${ui.accentSolid}`}
                >
                  <Plus size={14} /> O&apos;zingiz kiriting
                </button>
                <button
                  onClick={() => { void reloadRoomFloors(); void fetchRoomsData() }}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${ui.btnGhost}`}
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
                <div className={`mb-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                  isLight ? 'border-amber-200 bg-amber-50' : 'border-amber-500/25 bg-amber-500/10'
                }`}>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                      Xonalar tarxi kiritilmagan
                    </p>
                    <p className={`mt-1 text-[10px] leading-relaxed ${isLight ? 'text-amber-800' : 'text-amber-200'}`}>
                      Quyida faqat talabasi bor {rooms.length} ta xona ko&apos;rsatilmoqda. Barcha xonalar
                      ko&apos;rinishi va yangi talaba joylashtira olishingiz uchun tarx kiritilishi kerak.
                    </p>
                  </div>
                  <button
                    onClick={() => setGeneratorOpen(true)}
                    className={`flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${ui.accentSolid}`}
                  >
                    <Plus size={14} /> O&apos;zingiz kiriting
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {filteredRooms.map((room) => {
                const count = room.occupants.length
                const isSelected = selectedRoom?.roomNumber === room.roomNumber

                // Structural cue first (mixed / frozen / selected), then a
                // faint gender wash on a normal room. All within the panel's
                // slate + indigo palette; rose stays reserved for the genuine
                // mixed-gender error.
                let roomBorderColor = ui.border
                let roomBgColor = ''

                if (room.gender === 'mixed') {
                  roomBorderColor = isLight ? 'border-rose-300 bg-rose-50' : 'border-rose-500/40 bg-rose-500/10'
                } else if (room.frozen) {
                  roomBorderColor = isLight ? 'border-slate-300 bg-slate-100' : 'border-slate-600 bg-slate-800/60'
                } else if (isSelected) {
                  roomBorderColor = isLight ? 'border-indigo-400 bg-indigo-50' : 'border-indigo-500/60 bg-indigo-500/10'
                } else if (room.gender === 'male' || room.gender === 'female') {
                  const accent = genderAccent(room.gender)
                  roomBgColor = isLight ? accent.badgeBgLight : accent.badgeBg
                  roomBorderColor = isLight ? accent.borderLight : accent.border
                }

                return (
                  <div
                    key={room.roomNumber}
                    onClick={() => selectRoom(room)}
                    className={`p-3 rounded-xl border cursor-pointer transition-colors text-center flex flex-col justify-between h-24 hover:border-indigo-400/60 ${roomBorderColor} ${roomBgColor} ${room.frozen ? 'opacity-75' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
                        {room.floor > 0 ? `Q-${room.floor}` : 'Q-?'}
                      </span>
                      {room.gender === 'mixed' ? (
                        <AlertTriangle size={12} className={isLight ? 'text-rose-500' : 'text-rose-400'} />
                      ) : room.frozen ? (
                        <Snowflake size={12} className={ui.faint} />
                      ) : null}
                    </div>

                    <div>
                      <h4 className={`text-sm font-bold ${textStrong}`}>{room.roomNumber}-xona</h4>
                      <p className={`text-[9px] font-medium ${textMuted}`}>
                        {room.frozen ? "Muzlatilgan" : `${count} / ${roomCapacity} o'rin`}
                      </p>
                    </div>

                    {/* One dot per bed, per the admin's xona sig'imi setting */}
                    <div className="flex justify-center gap-1 mt-1 shrink-0">
                      {Array.from({ length: roomCapacity }).map((_, idx) => {
                        const isOccupied = idx < count
                        const occ = room.occupants[idx]

                        let dotColor = isLight ? 'bg-slate-200' : 'bg-slate-700'
                        if (isOccupied) {
                          const occGender = normalizeGender(occ.gender)
                          dotColor = occGender ? genderAccent(occGender).dot : 'bg-indigo-500'
                        }

                        return (
                          <div
                            key={idx}
                            className={`h-2 w-2 rounded-full ${dotColor}`}
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
                className={`flex flex-col max-h-[calc(100vh-7.5rem)] p-5 rounded-2xl border ${surfaceBg}`}
              >
                <div className={`flex items-center justify-between border-b pb-3 shrink-0 ${ui.border}`}>
                  <div>
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${textStrong}`}>
                      {selectedRoom.roomNumber}-xona tafsiloti
                    </h3>
                    <p className={`text-[9px] font-medium ${textMuted}`}>
                      {selectedRoom.floor > 0
                        ? `${selectedRoom.floor}-qavatda joylashgan`
                        : 'Qavat tarxida belgilanmagan xona'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedRoom(null)}
                    className={`p-1.5 rounded-lg shrink-0 ${textMuted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex-1 min-h-0 space-y-4 overflow-y-auto custom-scrollbar pt-4 -mr-1 pr-1">
                {selectedRoom.gender === 'mixed' || selectedRoom.frozen ? null : selectedRoom.occupants.length >= roomCapacity ? (
                  <div className={`p-2.5 rounded-lg text-center text-[10px] font-medium ${ui.inset} ${textMuted}`}>
                    Xona to&apos;la — yangi talaba joylashtirib bo&apos;lmaydi
                  </div>
                ) : (
                  <button
                    onClick={() => setAssignModalOpen(true)}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${ui.accentSolid}`}
                  >
                    <UserPlus size={14} /> Talaba joylashtirish
                  </button>
                )}

                {/* Frozen (ta'mirlash) notice — the room's only unfreeze control. */}
                {selectedRoom.frozen && (
                  <div className={`p-3 rounded-lg border text-[10px] flex items-start gap-2 ${ui.inset} ${textMuted}`}>
                    <Snowflake size={14} className="shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold ${textStrong}`}>Xona muzlatilgan</p>
                      <p className="mt-0.5 leading-tight">
                        {selectedRoom.frozenReason || "Ta'mirlash tufayli vaqtincha yopilgan."} Yangi talaba
                        joylashtirib bo&apos;lmaydi — mavjud talabalar o&apos;z joyida qoladi.
                      </p>
                      <button
                        onClick={handleUnfreezeRoom}
                        disabled={freezingRoom}
                        className={`mt-2.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${ui.accentSolid}`}
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
                    className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${ui.btnGhost}`}
                  >
                    <Snowflake size={14} /> Xonani muzlatish (ta&apos;mirlash)
                  </button>
                )}

                {/* Mixed Gender Error message */}
                {selectedRoom.gender === 'mixed' && (
                  <div className={`p-3 rounded-lg border text-[10px] flex items-start gap-2 ${ui.dangerSoft}`}>
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold uppercase">Gender aralashuvi xatosi</p>
                      <p className="mt-0.5 leading-tight">
                        Xonada ham o‘g‘il bolalar, ham qiz bolalar joylashtirilgan. Iltimos, xona taqsimotini o‘zgartiring.
                      </p>
                    </div>
                  </div>
                )}

                {/* Occupants list */}
                <div className="space-y-3">
                  {selectedRoom.occupants.length === 0 ? (
                    <div className={`text-center py-8 text-xs font-medium ${ui.faint}`}>Xona bo‘sh</div>
                  ) : (
                    selectedRoom.occupants.map((occ, occIndex) => {
                      const st = statusChip(occ.status === 'registered' ? 'success' : 'warning', isLight)
                      return (
                      <div
                        key={occ.id || `${selectedRoom.roomNumber}-anon-${occIndex}`}
                        className={`p-3 rounded-lg border space-y-2 ${ui.inset}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${genderAccent(occ.gender).dot}`} />
                            <h4 className={`text-xs font-semibold truncate ${textStrong}`}>{occ.full_name}</h4>
                          </div>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${st.chip}`}>
                            {occ.status === 'registered' ? 'Faol' : 'Kutmoqda'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 text-[10px] font-medium">
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
                              <span className={statusChip('warning', isLight).text}>Ogohlantirishlar:</span>
                              <p className={`font-semibold ${statusChip('warning', isLight).text}`}>{occ.warning_count} ta</p>
                            </div>
                          ) : null}
                        </div>

                        {occ.id && (
                          confirmRemoveId === occ.id ? (
                            <div className={`mt-1 flex items-center gap-2 rounded-lg border px-2.5 py-2 ${ui.dangerSoft}`}>
                              <AlertTriangle size={12} className="shrink-0" />
                              <span className="flex-1 text-[9px] font-bold uppercase tracking-wider">
                                Rostdan chiqarilsinmi?
                              </span>
                              <button
                                onClick={() => handleRemoveStudent(occ)}
                                disabled={removingId === occ.id}
                                className={`rounded-md px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider disabled:opacity-50 ${ui.btnDanger}`}
                              >
                                {removingId === occ.id ? '...' : 'Ha'}
                              </button>
                              <button
                                onClick={() => setConfirmRemoveId(null)}
                                className={`rounded-md border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${ui.btnGhost}`}
                              >
                                Yo&apos;q
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmRemoveId(occ.id)}
                              className={`mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${ui.dangerSoft}`}
                            >
                              <UserMinus size={11} />
                              {occ.status === 'approved' ? "Xona biriktirishni bekor qilish" : 'Xonadan chiqarish'}
                            </button>
                          )
                        )}
                      </div>
                      )
                    })
                  )}
                </div>
                </div>

                <div className={`shrink-0 pt-3 mt-1 border-t text-[9px] font-medium flex justify-between ${ui.border} ${textMuted}`}>
                  <span>Jami o‘rindagi joylar:</span>
                  <span>{selectedRoom.occupants.length} / {roomCapacity} band</span>
                </div>
              </motion.div>
            ) : (
              <div className={`p-10 rounded-2xl border ${surfaceBg} flex flex-col items-center justify-center text-center`}>
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-slate-500'}`}>
                  <BedDouble size={20} />
                </div>
                <p className={`text-xs font-medium ${textMuted}`}>Xona tafsilotlarini ko‘rish uchun xarita bo‘limidan xonani bosing</p>
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
            <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${ui.faint}`} />
            <input
              type="text"
              autoFocus
              placeholder="Talaba ismi bo'yicha qidirish..."
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              className={`w-full text-sm py-3 pl-12 pr-11 rounded-lg border transition-colors ${ui.input} ${ui.ring}`}
            />
            {assignSearch && (
              <button
                type="button"
                onClick={() => setAssignSearch('')}
                aria-label="Qidiruvni tozalash"
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}
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
                className={`w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${ui.card} hover:border-indigo-400/50`}
              >
                <div className="min-w-0 flex items-start gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 mt-1 ${genderAccent(s.gender).dot}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className={`text-xs font-semibold truncate ${textStrong}`}>{s.full_name}</p>
                      {s.source === 'permit' && (
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusChip('warning', isLight).chip}`}>
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
                  <span className={`shrink-0 text-[9px] font-bold uppercase ${ui.accentText}`}>...</span>
                ) : (
                  <UserPlus size={16} className={`shrink-0 ${ui.accentText}`} />
                )}
              </button>
            ))}

            {assignableStudents.length === 0 && (
              <p className={`py-6 text-center text-xs font-medium ${ui.faint}`}>Talaba topilmadi</p>
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
          <label className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
            Sabab (ixtiyoriy)
          </label>
          <textarea
            value={freezeReason}
            onChange={(e) => setFreezeReason(e.target.value)}
            rows={3}
            placeholder="Masalan: Santexnika ta'mirlanmoqda"
            className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors ${ui.input} ${ui.ring}`}
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
