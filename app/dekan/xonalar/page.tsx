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
  Minus,
  RotateCcw,
  Snowflake,
  Unlock,
  Venus,
  Mars,
  MousePointerSquareDashed,
  Check
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchDekanOverview } from '@/features/permits/client/admin-api'
import { fetchAssignableStudents, assignStudentRoom } from '@/features/room-assignment/client/api'
import type { FacultyStudentRow } from '@/features/room-assignment/types'
import {
  setRoomFrozen,
  setRoomCapacity as setRoomCapacityApi,
  setRoomGender as setRoomGenderApi,
  bulkSetRoomGender as bulkSetRoomGenderApi,
} from '@/features/room-layout/client/api'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Skel } from '@/components/ui/skeletons'
import RoomLayoutGeneratorModal from '@/components/rooms/RoomLayoutGeneratorModal'
import { compareRoomNumbers } from '@/features/room-layout/plan'
import { useRoomFloors } from '@/lib/hooks/useRoomFloors'
import { useStaffPanel } from '@/lib/hooks/useStaffPanel'
import { computeFloorBalance, checkFloorPlacement } from '@/lib/floor-balance'
import FloorBalanceCard from '@/components/dekan/FloorBalanceCard'
import { fetchAppSettings } from '@/features/app-settings/client/api'
import { getRoomOccupancyTone } from '@/features/app-settings/presentation'
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
  gender: string | null // derived from occupants: 'male', 'female', or 'mixed' (warning)
  /**
   * Gender the dekan reserved this room for, set before anyone is placed
   * (floor_room_layout.gender). null = undeclared. Drives the card wash and
   * blocks a mismatched assignment inside the assign RPCs.
   */
  declaredGender: 'male' | 'female' | null
  frozen: boolean
  frozenReason: string | null
  /** Per-room bed-count override; null = inherit the dorm default. */
  capacity: number | null
  // False for "orphan" rooms — occupied but missing from floor_room_layout
  // (see the comment above `orphans` below). Freezing writes to that table,
  // so a room that isn't in it can't be frozen from here.
  inLayout: boolean
}

export default function DekanXonalarMap() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const ui = dekanUI(isLight)
  // The tarbiyachi panel renders this same map view-only — every
  // assign / freeze / capacity / gender / generate control is hidden.
  const { readOnly } = useStaffPanel()

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
  const [defaultCapacity, setDefaultCapacity] = useState(4)
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
          // Every occupant here is the dekan's own faculty — the overview API
          // is faculty-scoped at the source. `|| ''` is just a null guard.
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
        setDefaultCapacity(settings.defaultRoomCapacity)
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

    const fromLayout: RoomData[] = layoutRooms.map(({ roomNumber, floor, frozen, frozenReason, capacity, gender }) => {
      const occupants = occupantsByRoom[roomNumber] ?? []
      return { roomNumber, occupants, floor, gender: roomGender(occupants), declaredGender: gender, frozen, frozenReason, capacity, inLayout: true }
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
        declaredGender: null,
        frozen: false,
        frozenReason: null,
        capacity: null,
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

  // Set when a placement would skew the floor's course mix — the modal below
  // reads it, and its confirm button calls performAssign() to go ahead anyway.
  const [balanceWarn, setBalanceWarn] = useState<{
    studentId: string
    source: 'user' | 'permit'
    course: number
    floor: number
    suggestion: { course: number; gap: number; available: number } | null
  } | null>(null)

  const performAssign = async (studentId: string, source: 'user' | 'permit') => {
    if (!selectedRoom) return
    setBalanceWarn(null)
    setAssigningId(studentId)
    try {
      const res = await assignStudentRoom({ studentId, roomNumber: selectedRoom.roomNumber, source })
      toast.success(
        source === 'permit'
          ? "Xona biriktirildi — talaba ro'yxatdan o'tganda shu xonaga joylashadi"
          : 'Talaba xonaga joylashtirildi',
      )
      if (res.documentDelivery === 'deferred_no_dekan_signature') {
        toast.error('Elektron imzoingiz yo‘q — Ariza va Tilxat yuborilmadi. Sozlamalar → Elektron imzo bo‘limida imzo qo‘ying.', { duration: 8000 })
      } else if (res.documentDelivery === 'deferred_no_channel') {
        toast('Ariza va Tilxat tayyor, ammo talabaning Telegram/email manzili topilmadi — keyinroq qayta yuboriladi.', { icon: '📭', duration: 7000 })
      } else if (res.documentDelivery === 'delivered') {
        toast.success('Imzolangan Ariza va Tilxat talabaga yuborildi', { icon: '📄' })
      }
      setAssignModalOpen(false)
      setAssignSearch('')
      await Promise.all([fetchRoomsData(), loadStudents()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Joylashtirishda xatolik yuz berdi")
    } finally {
      setAssigningId(null)
    }
  }

  const handleAssignStudent = (studentId: string, source: 'user' | 'permit') => {
    if (!selectedRoom) return
    const course = students.find((s) => s.id === studentId)?.course ?? null
    const floor = selectedRoom.floor
    if (course && floor > 0) {
      const floorGender = floorBalance.genderByFloor[floor] ?? selectedRoom.declaredGender ?? null
      const check = checkFloorPlacement(floorBalance, floor, course, {
        availableByCourse: roomlessCountByCourse(floorGender),
      })
      if (check?.wouldOverfill) {
        setBalanceWarn({ studentId, source, course, floor, suggestion: check.suggestion })
        return
      }
    }
    void performAssign(studentId, source)
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

  // Per-room bed count. null clears the override -> the room follows the dorm
  // default again. Enforced for real inside assign_*_room_atomic.
  const [savingCapacity, setSavingCapacity] = useState(false)
  const handleSetCapacity = async (capacity: number | null) => {
    if (!selectedRoom || !selectedRoom.inLayout) return
    setSavingCapacity(true)
    try {
      await setRoomCapacityApi(selectedRoom.roomNumber, capacity)
      setSelectedRoom((room) => (room ? { ...room, capacity } : room))
      await reloadRoomFloors()
      toast.success(
        capacity === null
          ? "Xona sig'imi standartga qaytarildi"
          : `Xona sig'imi ${capacity} ta o'ringa o'zgartirildi`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sig'imni o'zgartirib bo'lmadi")
    } finally {
      setSavingCapacity(false)
    }
  }

  // Declared room gender — the dekan reserves a room for boys/girls before
  // anyone lives in it. null clears the reservation. Enforced for real
  // inside assign_*_room_atomic (a mismatched student is refused).
  const [savingGender, setSavingGender] = useState(false)
  const handleSetGender = async (gender: 'male' | 'female' | null) => {
    if (!selectedRoom || !selectedRoom.inLayout || savingGender) return
    setSavingGender(true)
    try {
      await setRoomGenderApi(selectedRoom.roomNumber, gender)
      setSelectedRoom((room) => (room ? { ...room, declaredGender: gender } : room))
      await reloadRoomFloors()
      toast.success(
        gender === null
          ? 'Xona jinsi belgilanmadi'
          : gender === 'female'
            ? `${selectedRoom.roomNumber}-xona qizlar xonasi deb belgilandi`
            : `${selectedRoom.roomNumber}-xona o'g'il bolalar xonasi deb belgilandi`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xona jinsini o'zgartirib bo'lmadi")
    } finally {
      setSavingGender(false)
    }
  }

  // Multi-select bulk mode: pick several rooms on the map, then stamp them
  // all girls / boys at once (mirrors the capacity bulk in the builder).
  const [selectMode, setSelectMode] = useState(false)
  const [selectedRoomNumbers, setSelectedRoomNumbers] = useState<Set<string>>(new Set())
  const [savingBulkGender, setSavingBulkGender] = useState(false)

  const toggleRoomSelection = (roomNumber: string) => {
    setSelectedRoomNumbers((prev) => {
      const next = new Set(prev)
      if (next.has(roomNumber)) next.delete(roomNumber)
      else next.add(roomNumber)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedRoomNumbers(new Set())
  }

  const handleBulkSetGender = async (gender: 'male' | 'female' | null) => {
    const roomNumbers = [...selectedRoomNumbers].filter((n) =>
      rooms.some((r) => r.roomNumber === n && r.inLayout),
    )
    if (roomNumbers.length === 0 || savingBulkGender) return
    setSavingBulkGender(true)
    try {
      const { changed } = await bulkSetRoomGenderApi(roomNumbers, gender)
      await reloadRoomFloors()
      toast.success(
        gender === null
          ? `${changed} ta xona jinsi belgilanmadi`
          : gender === 'female'
            ? `${changed} ta xona qizlar xonasi deb belgilandi`
            : `${changed} ta xona o'g'il bolalar xonasi deb belgilandi`,
      )
      exitSelectMode()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xonalar jinsini o'zgartirib bo'lmadi")
    } finally {
      setSavingBulkGender(false)
    }
  }

  // Effective gender for the card wash: the dekan's declaration wins; if the
  // room isn't declared yet it falls back to what the occupants imply.
  const roomWashGender = (room: RoomData): 'male' | 'female' | null =>
    room.declaredGender ?? (room.gender === 'male' || room.gender === 'female' ? room.gender : null)

  // A real conflict: occupants are mixed, or a declared room already holds
  // someone of the other gender.
  const roomGenderConflict = (room: RoomData): boolean =>
    room.gender === 'mixed'
    || Boolean(room.declaredGender && (room.gender === 'male' || room.gender === 'female') && room.declaredGender !== room.gender)

  const CAPACITY_MIN = 1
  const CAPACITY_MAX = 12
  const stepCapacity = (delta: number) => {
    if (!selectedRoom || savingCapacity) return
    const current = selectedRoom.capacity ?? defaultCapacity
    const next = Math.min(CAPACITY_MAX, Math.max(CAPACITY_MIN, current + delta))
    if (next === current) return
    // Landing back on the building default means "follow the default" again,
    // not "pin an override that happens to equal it".
    void handleSetCapacity(next === defaultCapacity ? null : next)
  }

  // Filters. Sorted floor-then-natural so "10-xona" doesn't sit between
  // "1-xona" and "2-xona" (orphan rooms are appended unsorted upstream).
  const filteredRooms = rooms
    .filter((r) => {
      const matchesFloor = floorFilter === 'all' || r.floor === floorFilter
      const matchesSearch =
        r.roomNumber.includes(searchTerm) ||
        r.occupants.some((o) => o.full_name.toLowerCase().includes(searchTerm.toLowerCase()))

      return matchesFloor && matchesSearch
    })
    .sort((a, b) => a.floor - b.floor || compareRoomNumbers(a.roomNumber, b.roomNumber))

  // Assignable students for the currently selected room: name search, plus
  // gender-matched to the room's declared gender (or, if undeclared, to the
  // existing occupants). An undeclared, empty/mixed room allows anyone.
  const selectedRoomGenderLock = selectedRoom
    ? selectedRoom.declaredGender ?? (selectedRoom.gender === 'mixed' ? null : selectedRoom.gender)
    : null
  const assignableStudents = students
    .filter((s) => s.full_name.toLowerCase().includes(assignSearch.toLowerCase()))
    .filter((s) => {
      if (!selectedRoomGenderLock) return true
      return normalizeGender(s.gender) === selectedRoomGenderLock
    })

  // Effective bed count for a room: its own override, else the dorm default.
  const roomBeds = (room: RoomData) => room.capacity ?? defaultCapacity

  // ---- live per-floor course balance ----
  // Recomputed from the same data the map already holds, so it stays current
  // as the dekan places students (the dashboard payload would go stale). Plain
  // const — the React compiler memoises it; a manual useMemo here trips
  // react-hooks/preserve-manual-memoization.
  const floorBalance = (() => {
    const floorCap = new Map<number, number>()
    const floorGenders = new Map<number, Set<'male' | 'female'>>()
    for (const r of layoutRooms) {
      if (!r.frozen) floorCap.set(r.floor, (floorCap.get(r.floor) ?? 0) + (r.capacity ?? defaultCapacity))
      if (r.gender === 'male' || r.gender === 'female') {
        const set = floorGenders.get(r.floor) ?? new Set<'male' | 'female'>()
        set.add(r.gender)
        floorGenders.set(r.floor, set)
      }
    }
    const placed: { floor: number; course: number | null }[] = []
    for (const [roomNumber, occs] of Object.entries(occupantsByRoom)) {
      const fl = floorOf(roomNumber)
      if (fl == null) continue
      for (const o of occs) placed.push({ floor: fl, course: o.course || null })
    }
    const totalToHouse: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const p of placed) if (p.course && totalToHouse[p.course] !== undefined) totalToHouse[p.course]++
    for (const s of students) if (s.course && totalToHouse[s.course] !== undefined) totalToHouse[s.course]++

    const genderByFloor: Record<number, 'male' | 'female' | null> = {}
    for (const [f, set] of floorGenders) genderByFloor[f] = set.size === 1 ? [...set][0] : null

    return {
      ...computeFloorBalance({
        floors: [...floorCap.entries()].map(([floor, capacity]) => ({ floor, capacity })),
        placed,
        totalToHouse,
      }),
      genderByFloor,
    }
  })()

  // Roomless students still to place, counted by course for one gender (or
  // all). Feeds the "place a 4th-year" suggestion so it only names a course
  // there's actually someone available for. Cheap + only needed on a click.
  const roomlessCountByCourse = (gender: 'male' | 'female' | null) => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const s of students) {
      if (!s.course || counts[s.course] === undefined) continue
      if (gender && normalizeGender(s.gender) !== gender) continue
      counts[s.course] += 1
    }
    return counts
  }

  // Room numbers with a resident / approved permit — the generator uses this
  // to know which rooms it must never delete when trimming a floor.
  const occupiedRoomNumbers = useMemo(
    () => new Set(Object.entries(occupantsByRoom).filter(([, o]) => o.length > 0).map(([n]) => n)),
    [occupantsByRoom],
  )

  // Calculate totals. `rooms` is already scoped to this dekan's floors
  // (useRoomFloors -> repository scopeFor). A frozen room contributes no
  // capacity and no free places — it's out of circulation, not empty.
  const totalOccupiedBeds = rooms.reduce((acc, r) => acc + r.occupants.length, 0)
  const availableBeds = rooms.reduce((acc, r) => acc + (r.frozen ? 0 : roomBeds(r)), 0)
  const freePlaces = rooms.reduce(
    (acc, r) => acc + (r.frozen ? 0 : Math.max(0, roomBeds(r) - r.occupants.length)),
    0,
  )
  const frozenRooms = rooms.filter((r) => r.frozen).length
  const totalRoomsWithMixedGenders = rooms.filter((r) => r.gender === 'mixed').length
  const totalFullRooms = rooms.filter((r) => !r.frozen && r.occupants.length >= roomBeds(r)).length

  return (
    <div className="space-y-6">
      {/* 1. Header Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Band joylar', value: `${totalOccupiedBeds} / ${availableBeds}`, icon: BedDouble },
          {
            label: 'Bo‘sh joylar',
            value: `${freePlaces} ta`,
            icon: DoorOpen,
            tone: freePlaces === 0 ? 'danger' as const : undefined,
          },
          // Roomless active students + approved-but-unregistered permits of
          // this faculty — the same list the "Talaba joylashtirish" modal
          // draws from. Surfaced here so a student left without a room (e.g.
          // just removed from one) is visible without opening every room.
          { label: 'Xonasiz talabalar', value: `${students.length} ta`, icon: UserMinus, tone: students.length > 0 ? 'warning' as const : undefined },
          {
            label: frozenRooms > 0 ? `To‘la xonalar · ${frozenRooms} muzlatilgan` : 'To‘la xonalar',
            value: `${totalFullRooms} ta`,
            icon: DoorClosed,
          },
          { label: 'Gender xatoliklar', value: `${totalRoomsWithMixedGenders} ta xona`, icon: Users2, tone: totalRoomsWithMixedGenders > 0 ? 'danger' as const : undefined },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.2 }}
            className={`p-4 rounded-2xl border ${surfaceBg} ${ui.hoverLift} flex items-center gap-3`}
          >
            <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${
              stat.tone ? statusChip(stat.tone, isLight).chip : ui.accentTile
            }`}>
              <stat.icon size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <span className={`block text-[9px] font-semibold uppercase tracking-wider truncate ${textMuted}`}>{stat.label}</span>
              <h3 className={`text-lg sm:text-xl font-bold mt-0.5 tracking-tight ${stat.tone ? statusChip(stat.tone, isLight).text : textStrong}`}>
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

          {!readOnly && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                selectMode ? ui.accentSolid : ui.btnGhost
              }`}
            >
              <MousePointerSquareDashed size={13} /> {selectMode ? 'Tanlashni tugatish' : 'Xonalarni tanlash'}
            </button>
            <button
              onClick={() => setGeneratorOpen(true)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
            >
              <Plus size={13} /> Xona qo&apos;shish
            </button>
          </div>
          )}
        </div>
        {selectMode && (
          <p className={`text-[10px] font-medium ${textMuted}`}>
            Xonalarni bosib belgilang, so&apos;ng pastdagi paneldan jinsni tanlang.
          </p>
        )}
      </div>

      {/* 3. Main Occupancy Grid and Side Detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Rooms Grid (Left) */}
        <div className={`lg:col-span-8 p-5 rounded-2xl border ${surfaceBg}`}>
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 pb-4 border-b text-[10px] font-medium ${ui.border} ${textMuted}`}>
            <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded border ${isLight ? 'bg-emerald-100 border-emerald-300' : 'bg-emerald-500/15 border-emerald-500/40'}`} /> O&apos;g&apos;il bolalar xonasi</span>
            <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded border ${isLight ? 'bg-pink-100 border-pink-300' : 'bg-pink-500/15 border-pink-500/40'}`} /> Qizlar xonasi</span>
            <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded border ${ui.border}`} /> Belgilanmagan</span>
            <span className="flex items-center gap-1.5"><AlertTriangle size={11} className={isLight ? 'text-amber-500' : 'text-amber-400'} /> Jins nomuvofiqligi</span>
            <span className="flex items-center gap-1.5"><Snowflake size={11} className={isLight ? 'text-cyan-500' : 'text-cyan-400'} /> Muzlatilgan (ta&apos;mirlash)</span>
          </div>
          {loading || !floorsLoaded ? (
            <div className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skel key={i} className="h-24 rounded-2xl" />
              ))}
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
                {!readOnly && (
                <button
                  onClick={() => setGeneratorOpen(true)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${ui.accentSolid}`}
                >
                  <Plus size={14} /> O&apos;zingiz kiriting
                </button>
                )}
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
                      {readOnly
                        ? `Quyida faqat talabasi bor ${rooms.length} ta xona ko'rsatilmoqda. To'liq xarita uchun dekan qavat tarxini kiritishi kerak.`
                        : `Quyida faqat talabasi bor ${rooms.length} ta xona ko'rsatilmoqda. Barcha xonalar ko'rinishi va yangi talaba joylashtira olishingiz uchun tarx kiritilishi kerak.`}
                    </p>
                  </div>
                  {!readOnly && (
                  <button
                    onClick={() => setGeneratorOpen(true)}
                    className={`flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${ui.accentSolid}`}
                  >
                    <Plus size={14} /> O&apos;zingiz kiriting
                  </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {filteredRooms.map((room) => {
                const count = room.occupants.length
                const isSelected = selectedRoom?.roomNumber === room.roomNumber
                const isMultiPicked = selectMode && selectedRoomNumbers.has(room.roomNumber)
                const conflict = roomGenderConflict(room)
                const washGender = roomWashGender(room)

                // Card wash by gender so the grid reads as boy/girl at a
                // glance — green = o'g'il xona, pink = qiz xona. A frozen
                // room (cyan) or a gender conflict (amber) overrides it;
                // selection is a ring so the wash colour stays visible.
                let roomBorderColor = ui.border
                let roomBgColor = ''

                if (washGender === 'female') {
                  roomBgColor = isLight ? 'bg-pink-100/70' : 'bg-pink-500/10'
                  roomBorderColor = isLight ? 'border-pink-200' : 'border-pink-500/30'
                } else if (washGender === 'male') {
                  roomBgColor = isLight ? 'bg-emerald-100/70' : 'bg-emerald-500/10'
                  roomBorderColor = isLight ? 'border-emerald-200' : 'border-emerald-500/30'
                }

                if (conflict) {
                  roomBgColor = ''
                  roomBorderColor = isLight ? 'border-amber-300 bg-amber-50' : 'border-amber-500/40 bg-amber-500/10'
                } else if (room.frozen) {
                  roomBgColor = ''
                  roomBorderColor = isLight ? 'border-cyan-300 bg-cyan-50' : 'border-cyan-500/40 bg-cyan-500/10'
                }

                const roomRing = isMultiPicked
                  ? (isLight ? 'ring-2 ring-indigo-600 ring-offset-1' : 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900')
                  : isSelected
                    ? (isLight ? 'ring-2 ring-indigo-500 ring-offset-1' : 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900')
                    : ''

                return (
                  <div
                    key={room.roomNumber}
                    onClick={() => (selectMode ? toggleRoomSelection(room.roomNumber) : selectRoom(room))}
                    className={`relative p-3 rounded-xl border cursor-pointer transition-colors text-center flex flex-col justify-between h-24 hover:border-indigo-400/60 ${roomBorderColor} ${roomBgColor} ${roomRing} ${room.frozen ? 'opacity-75' : ''}`}
                  >
                    {isMultiPicked && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
                        {room.floor > 0 ? `Q-${room.floor}` : 'Q-?'}
                      </span>
                      {conflict ? (
                        <AlertTriangle size={12} className={isLight ? 'text-amber-500' : 'text-amber-400'} />
                      ) : room.frozen ? (
                        <Snowflake size={12} className={isLight ? 'text-cyan-500' : 'text-cyan-400'} />
                      ) : washGender === 'female' ? (
                        <Venus size={12} className={isLight ? 'text-pink-500' : 'text-pink-400'} />
                      ) : washGender === 'male' ? (
                        <Mars size={12} className={isLight ? 'text-emerald-600' : 'text-emerald-400'} />
                      ) : null}
                    </div>

                    <div>
                      <h4 className={`text-sm font-bold ${textStrong}`}>{room.roomNumber}-xona</h4>
                      <p className={`text-[9px] font-medium ${textMuted}`}>
                        {room.frozen
                          ? "Muzlatilgan"
                          : count === 0 && room.declaredGender
                            ? (room.declaredGender === 'female' ? 'Qizlar xonasi' : "O'g'il bolalar xonasi")
                            : `${count} / ${roomBeds(room)} o'rin${room.capacity != null ? ' •' : ''}`}
                      </p>
                    </div>

                    {/* One dot per bed — the room's own sig'im, else the dorm default */}
                    <div className="flex justify-center gap-1 mt-1 shrink-0">
                      {Array.from({ length: roomBeds(room) }).map((_, idx) => {
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
                {readOnly ? null : selectedRoom.gender === 'mixed' || selectedRoom.frozen ? null : selectedRoom.occupants.length >= roomBeds(selectedRoom) ? (
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
                      {!readOnly && (
                      <button
                        onClick={handleUnfreezeRoom}
                        disabled={freezingRoom}
                        className={`mt-2.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${ui.accentSolid}`}
                      >
                        <Unlock size={12} /> {freezingRoom ? 'Bajarilmoqda...' : 'Muzlatishni bekor qilish'}
                      </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Freeze (ta'mirlash) action — a labeled button, not just an icon, so
                    it's actually noticed instead of blending into the header. Shown
                    regardless of capacity/gender: a full or mixed room can still need
                    to go into repair. Orphan rooms (not in floor_room_layout) can't be
                    frozen from here — see the RoomData.inLayout comment. */}
                {!readOnly && selectedRoom.inLayout && !selectedRoom.frozen && (
                  <button
                    onClick={() => setFreezeModalOpen(true)}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${ui.btnGhost}`}
                  >
                    <Snowflake size={14} /> Xonani muzlatish (ta&apos;mirlash)
                  </button>
                )}

                {/* Declared room gender — set it before anyone is placed so
                    the building can be planned. A choice that clashes with a
                    student already in the room is disabled. */}
                {!readOnly && selectedRoom.inLayout && (() => {
                  const occGenders = new Set(
                    selectedRoom.occupants.map((o) => normalizeGender(o.gender)).filter(Boolean),
                  )
                  const opts: { value: 'male' | 'female' | null; label: string; icon: typeof Venus }[] = [
                    { value: 'male', label: "O'g'il bolalar", icon: Mars },
                    { value: 'female', label: 'Qizlar', icon: Venus },
                    { value: null, label: 'Belgilanmagan', icon: X },
                  ]
                  return (
                    <div className={`rounded-xl border overflow-hidden ${ui.inset}`}>
                      <div className={`flex items-center gap-3 p-3 border-b ${ui.border}`}>
                        <Users2 size={16} className={`shrink-0 ${ui.accentText}`} />
                        <p className={`flex-1 text-[10px] font-bold uppercase tracking-wider ${textStrong}`}>
                          Xona jinsi
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 p-2">
                        {opts.map((opt) => {
                          const active = (selectedRoom.declaredGender ?? null) === opt.value
                          const clashes = opt.value !== null && occGenders.size > 0 && !occGenders.has(opt.value)
                          return (
                            <button
                              key={String(opt.value)}
                              type="button"
                              disabled={savingGender || clashes}
                              onClick={() => handleSetGender(opt.value)}
                              title={clashes ? 'Xonada boshqa jinsdagi talaba bor' : undefined}
                              className={`flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40 ${
                                active
                                  ? opt.value === 'female'
                                    ? (isLight ? 'bg-pink-100 text-pink-700' : 'bg-pink-500/20 text-pink-300')
                                    : opt.value === 'male'
                                      ? (isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-300')
                                      : ui.accentSoft
                                  : `${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`
                              }`}
                            >
                              <opt.icon size={14} />
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Declared-gender conflict — a student of the other gender is
                    already in a room the dekan reserved. */}
                {roomGenderConflict(selectedRoom) && selectedRoom.gender !== 'mixed' && selectedRoom.declaredGender && (
                  <div className={`p-3 rounded-lg border text-[10px] flex items-start gap-2 ${
                    isLight ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  }`}>
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold uppercase">Jins nomuvofiqligi</p>
                      <p className="mt-0.5 leading-tight">
                        Xona {selectedRoom.declaredGender === 'female' ? 'qizlar' : "o'g'il bolalar"} uchun belgilangan,
                        lekin ichida boshqa jinsdagi talaba bor. Talabani ko&apos;chiring yoki belgini o&apos;zgartiring.
                      </p>
                    </div>
                  </div>
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

                {/* This floor's course balance — so the dekan sees the mix
                    they're adding to before picking a student. */}
                {selectedRoom.floor > 0 && floorBalance.floors.some((f) => f.floor === selectedRoom.floor) && (
                  <FloorBalanceCard balance={floorBalance} isLight={isLight} onlyFloor={selectedRoom.floor} />
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

                        {!readOnly && occ.id && (
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

                {/* Capacity + occupancy — one calm block. Bed count is a
                    stepper; landing on the building default clears the
                    override (see stepCapacity). A frozen room's beds never
                    count as free. */}
                {(() => {
                  const isOverride = selectedRoom.inLayout && selectedRoom.capacity != null
                  const beds = roomBeds(selectedRoom)
                  const occ = selectedRoom.occupants.length
                  const free = Math.max(0, beds - occ)
                  const tone = getRoomOccupancyTone(occ, beds)
                  const toneText = {
                    empty: isLight ? 'text-emerald-600' : 'text-emerald-400',
                    partial: isLight ? 'text-amber-600' : 'text-amber-400',
                    full: isLight ? 'text-rose-600' : 'text-rose-400',
                    unknown: isLight ? 'text-slate-500' : 'text-slate-400',
                  }[tone]
                  return (
                    <div className={`shrink-0 mt-3 rounded-xl border overflow-hidden ${ui.inset}`}>
                      {selectedRoom.inLayout && (
                        <div className={`p-3 border-b ${ui.border}`}>
                          <div className="flex items-center gap-3">
                            <BedDouble size={16} className={`shrink-0 ${ui.accentText}`} />
                            <p className={`flex-1 text-[10px] font-bold uppercase tracking-wider ${textStrong}`}>
                              Xona sig&apos;imi
                            </p>
                            {readOnly ? (
                              <span className={`shrink-0 text-lg font-black tabular-nums ${isOverride ? ui.accentText : textStrong}`}>
                                {beds} ta
                              </span>
                            ) : (
                            <div className="shrink-0 flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label="Kamaytirish"
                                disabled={savingCapacity || beds <= CAPACITY_MIN}
                                onClick={() => stepCapacity(-1)}
                                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${ui.btnGhost}`}
                              >
                                <Minus size={13} />
                              </button>
                              <span className={`w-8 text-center text-lg font-black tabular-nums ${isOverride ? ui.accentText : textStrong}`}>
                                {beds}
                              </span>
                              <button
                                type="button"
                                aria-label="Ko‘paytirish"
                                disabled={savingCapacity || beds >= CAPACITY_MAX}
                                onClick={() => stepCapacity(1)}
                                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${ui.accentSolid}`}
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 pl-7">
                            <span className={`text-[10px] ${textMuted}`}>
                              {isOverride ? `Istisno · bino standarti ${defaultCapacity} ta` : 'Bino standarti bo’yicha'}
                            </span>
                            {isOverride && !readOnly && (
                              <button
                                type="button"
                                disabled={savingCapacity}
                                onClick={() => handleSetCapacity(null)}
                                className={`shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${ui.accentSoft}`}
                              >
                                <RotateCcw size={11} />
                                Standart
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
                            {selectedRoom.frozen ? 'Bandlik' : "Bo'sh joylar"}
                          </span>
                          <span className={`text-xs font-black tabular-nums ${selectedRoom.frozen ? textMuted : toneText}`}>
                            {selectedRoom.frozen ? `${occ} / ${beds}` : `${free} / ${beds}`}
                          </span>
                        </div>
                        {selectedRoom.frozen && (
                          <p className={`mt-1.5 flex items-center gap-1.5 text-[10px] font-medium ${isLight ? 'text-cyan-600' : 'text-cyan-400'}`}>
                            <Snowflake size={11} className="shrink-0" />
                            Muzlatilgan — o&apos;rinlar bo&apos;sh hisoblanmaydi
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()}
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

      {/* Multi-select bulk gender bar */}
      <AnimatePresence>
        {!readOnly && selectMode && selectedRoomNumbers.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
          >
            <div className={`flex w-full max-w-lg flex-wrap items-center gap-2 rounded-2xl border p-2.5 shadow-xl ${surfaceBg}`}>
              <span className={`px-1.5 text-[11px] font-bold ${textStrong}`}>
                {selectedRoomNumbers.size} ta xona
              </span>
              <button
                onClick={() => handleBulkSetGender('male')}
                disabled={savingBulkGender}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                  isLight ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                }`}
              >
                <Mars size={13} /> O&apos;g&apos;il bolalar
              </button>
              <button
                onClick={() => handleBulkSetGender('female')}
                disabled={savingBulkGender}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                  isLight ? 'bg-pink-100 text-pink-700 hover:bg-pink-200' : 'bg-pink-500/15 text-pink-300 hover:bg-pink-500/25'
                }`}
              >
                <Venus size={13} /> Qizlar
              </button>
              <button
                onClick={() => handleBulkSetGender(null)}
                disabled={savingBulkGender}
                className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${ui.btnGhost}`}
              >
                Tozalash
              </button>
              <button
                onClick={exitSelectMode}
                className={`rounded-lg p-2 ${textMuted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}
                aria-label="Bekor qilish"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Student Modal */}
      <ConfirmModal
        isOpen={assignModalOpen && !!selectedRoom && !readOnly}
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
            {assignableStudents.map((s) => {
              const floorRow = selectedRoom ? floorBalance.floors.find((f) => f.floor === selectedRoom.floor) : undefined
              const courseOver = Boolean(s.course && floorRow?.statusByCourse[s.course] === 'over')
              return (
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
                      {courseOver && (
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusChip('warning', isLight).chip}`}>
                          Bu qavatда ko&apos;p
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
              )
            })}

            {assignableStudents.length === 0 && (
              <p className={`py-6 text-center text-xs font-medium ${ui.faint}`}>Talaba topilmadi</p>
            )}
          </div>
        </div>
      </ConfirmModal>

      {/* Floor course-balance warning */}
      <ConfirmModal
        isOpen={!!balanceWarn}
        title={balanceWarn ? `${balanceWarn.floor}-qavat muvozanati` : 'Qavat muvozanati'}
        confirmText={assigningId ? 'Joylashtirilmoqda...' : 'Baribir joylashtirish'}
        onConfirm={() => balanceWarn && performAssign(balanceWarn.studentId, balanceWarn.source)}
        onClose={() => setBalanceWarn(null)}
        isLoading={!!assigningId}
      >
        {balanceWarn && (() => {
          const row = floorBalance.floors.find((f) => f.floor === balanceWarn.floor)
          const c = balanceWarn.course
          return (
            <div className={`space-y-2 text-[11px] leading-relaxed ${textMuted}`}>
              <p>
                <span className="font-bold">{balanceWarn.floor}-qavatда {c}-kurs talabalar yetarli</span>
                {row ? ` (${row.byCourse[c]} ta, ideal ${row.targetByCourse[c]} ta).` : '.'}
              </p>
              {balanceWarn.suggestion ? (
                <p className={isLight ? 'text-indigo-700' : 'text-indigo-300'}>
                  Bu qavatga <span className="font-bold">{balanceWarn.suggestion.course}-kurs</span> kerak —
                  {' '}{balanceWarn.suggestion.gap} ta kam. Roʻyxatда {balanceWarn.suggestion.available} ta mos talaba bor.
                </p>
              ) : (
                <p>Iloji boʻlsa boshqa kurs talabasini yoki boshqa qavatni tanlang.</p>
              )}
            </div>
          )
        })()}
      </ConfirmModal>

      {/* Freeze room modal */}
      <ConfirmModal
        isOpen={freezeModalOpen && !!selectedRoom && !readOnly}
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
        isOpen={generatorOpen && !readOnly}
        floorCount={floorCount}
        existingRooms={layoutRooms}
        occupiedRoomNumbers={occupiedRoomNumbers}
        onClose={() => setGeneratorOpen(false)}
        onCreated={() => {
          void reloadRoomFloors()
          void fetchRoomsData()
        }}
      />
    </div>
  )
}
