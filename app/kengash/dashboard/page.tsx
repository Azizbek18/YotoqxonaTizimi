'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Users, Megaphone, Search, Clock,
  Trash2, Plus, Phone, PhoneCall, Mail, X,
  FileText, MessageSquareWarning, ShieldHalf,
  Building2, DoorClosed, Snowflake, Crown,
  ShieldCheck, Check, ExternalLink, Layers, Sparkles, AlertCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSafeUser, getAuthHeaders } from '@/lib/auth-session'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CustomSelect from '@/components/ui/CustomSelect'
import { SkelPage } from '@/components/ui/skeletons'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useMyCouncilPermissions } from '@/lib/hooks/useMyCouncilPermissions'
import { useRoomFloors } from '@/lib/hooks/useRoomFloors'
import { fetchStudentProfile } from '@/features/profile/client/api'
import { directionLabel } from '@/lib/directions'
import { normalizeGender } from '@/lib/gender'
import LeaderBackdrop from '@/components/leader/LeaderBackdrop'
import LeaderHeader from '@/components/leader/LeaderHeader'
import LeaderTabs, { type LeaderTab } from '@/components/leader/LeaderTabs'
import SectionHeading from '@/components/leader/SectionHeading'
import EmptyState from '@/components/leader/EmptyState'
import ModalShell from '@/components/leader/ModalShell'
import KengashStoryManager from '@/components/kengash/StoryManager'
import { glassCard, getLeaderTheme, accentChip, type AccentColor } from '@/components/leader/leader-theme'
import { usePanelTheme } from '@/components/leader/PanelThemeContext'

interface Student {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  room_number: string | null
  faculty: string | null
  course: number | null
  group: string | null
  direction: string | null
  avatar_url: string | null
  gender: string
  assigned_floor: number | null
  is_floor_captain: boolean
  arizaCount: number
  tushuntirishCount: number
}

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
  gender: string
  is_council_chair: boolean
  faculty?: string | null
}

interface Elon {
  id: string
  title: string
  text: string
  type: 'Yangilik' | 'Ogohlantirish' | 'Muhim' | 'Tadbir'
  created_at: string
}

const ELON_TYPE_STYLE: Record<Elon['type'], { dot: string; color: AccentColor }> = {
  Muhim: { dot: 'bg-rose-500', color: 'rose' },
  Tadbir: { dot: 'bg-emerald-500', color: 'emerald' },
  Ogohlantirish: { dot: 'bg-amber-500', color: 'amber' },
  Yangilik: { dot: 'bg-cyan-500', color: 'cyan' },
}

const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.025 } },
}

const rowIn = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

function initialsOf(name: string) {
  return name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'ST'
}

/** Person Row — clear visual hierarchy, badges, direct call, and labeled actions */
function PersonRow({
  person,
  onToggleCaptain,
  canManageCaptains,
}: {
  person: Student
  onToggleCaptain?: (person: Student) => void
  canManageCaptains?: boolean
}) {
  const isCaptain = person.is_floor_captain
  const { theme } = usePanelTheme()
  const isLight = theme === 'light'
  const [fullScreen, setFullScreen] = useState(false)

  return (
    <motion.div
      variants={rowIn}
      className={`no-shelf group relative flex min-w-0 flex-col justify-between gap-2.5 overflow-hidden rounded-2xl border p-2.5 transition-all duration-300 hover:-translate-y-0.5 min-[360px]:gap-3 min-[360px]:p-3.5 sm:rounded-3xl sm:p-4.5 ${
        isCaptain
          ? isLight
            ? 'border-purple-300/80 bg-gradient-to-br from-purple-50/90 via-white to-purple-50/40 shadow-[0_4px_20px_rgba(168,85,247,0.1)] hover:border-purple-400 hover:shadow-[0_10px_28px_rgba(168,85,247,0.18)]'
            : 'border-purple-500/40 bg-gradient-to-br from-purple-950/40 via-purple-900/10 to-slate-900/80 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:border-purple-500/60 hover:shadow-[0_10px_28px_rgba(168,85,247,0.2)]'
          : isLight
            ? 'border-slate-200/90 bg-white/95 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-purple-300 hover:bg-white hover:shadow-[0_10px_25px_rgba(147,51,234,0.08)]'
            : 'border-white/10 bg-slate-900/60 shadow-[0_4px_20px_rgba(0,0,0,0.25)] hover:border-white/20 hover:bg-slate-900/85 hover:shadow-[0_10px_25px_rgba(0,0,0,0.4)]'
      }`}
    >
      {/* Soft corner ambient aura */}
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full blur-[45px] transition-opacity opacity-40 group-hover:opacity-100 ${
          isCaptain
            ? isLight ? 'bg-purple-300/40' : 'bg-purple-600/25'
            : isLight ? 'bg-indigo-200/30' : 'bg-indigo-600/10'
        }`}
      />

      {/* Top: Avatar + Details */}
      <div className="relative z-10 flex min-w-0 items-start gap-2.5 min-[360px]:gap-3">
        {/* Avatar */}
        <div
          onClick={() => person.avatar_url && setFullScreen(true)}
          className={`no-shelf relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1.5 transition-all min-[360px]:h-12 min-[360px]:w-12 min-[360px]:rounded-2xl ${person.avatar_url ? 'cursor-zoom-in' : ''} ${
            isCaptain
              ? 'ring-purple-400/80 bg-gradient-to-br from-purple-600 to-indigo-700 shadow-md shadow-purple-950/50 text-white'
              : isLight
                ? 'ring-slate-200 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white shadow-xs'
                : 'ring-white/15 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-md shadow-black/40'
          }`}
        >
          {person.avatar_url ? (
            <Image src={person.avatar_url} alt={person.full_name} fill sizes="48px" unoptimized className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-black">
              {initialsOf(person.full_name)}
            </div>
          )}
          {isCaptain && (
            <div
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 text-amber-950 shadow-md border-2 border-slate-950"
              title="Qavat sardori"
            >
              <Crown size={10} className="fill-amber-950 stroke-[2.5]" />
            </div>
          )}
        </div>

        {/* Text details */}
        <div className="min-w-0 flex-1 space-y-1 min-[360px]:space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 min-[360px]:gap-2">
            <h4 className={`line-clamp-2 min-w-0 break-words text-xs font-extrabold leading-snug tracking-tight transition-colors min-[360px]:text-sm sm:text-base ${
              isLight ? 'text-slate-900 group-hover:text-purple-600' : 'text-white group-hover:text-purple-300'
            }`}>
              {person.full_name}
            </h4>

            {isCaptain && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-xs ${accentChip('purple', isLight)}`}>
                <Crown size={10} className="text-amber-400 fill-amber-400" />
                {person.assigned_floor ? `${person.assigned_floor}-qavat sardori` : 'Qavat sardori'}
              </span>
            )}

            {/* Badges for Arizalar / Tushuntirish */}
            {person.arizaCount > 0 && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${accentChip('sky', isLight)}`}>
                <FileText size={10} /> {person.arizaCount} ta ariza
              </span>
            )}
            {person.tushuntirishCount > 0 && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${accentChip('amber', isLight)}`}>
                <MessageSquareWarning size={10} /> {person.tushuntirishCount} ta tushuntirish
              </span>
            )}
          </div>

          {/* Academic & Room Meta Badges */}
          <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs min-[360px]:gap-1.5">
            {/* Room badge */}
            <span className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[9px] font-bold min-[360px]:px-2.5 min-[360px]:text-[10px] ${accentChip('indigo', isLight)}`}>
              <DoorClosed size={11} />
              {person.room_number ? `${person.room_number}-xona` : 'Xonasiz'}
            </span>

            {/* Course badge */}
            {person.course && (
              <span className={`inline-flex items-center rounded-lg px-1.5 py-0.5 text-[9px] font-bold min-[360px]:px-2 min-[360px]:text-[10px] ${accentChip('blue', isLight)}`}>
                {person.course}-kurs
              </span>
            )}

            {/* Group badge */}
            {person.group && (
              <span className={`inline-flex items-center rounded-lg border px-1.5 py-0.5 text-[9px] font-bold min-[360px]:px-2 min-[360px]:text-[10px] ${
                isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-white/5 text-slate-300 border-white/10'
              }`}>
                {person.group}
              </span>
            )}

            {/* Direction label */}
            {person.direction && (
              <span
                className={`inline-flex min-w-0 max-w-full items-center truncate rounded-lg border px-1.5 py-0.5 text-[9px] font-medium min-[360px]:max-w-[180px] min-[360px]:px-2 min-[360px]:text-[10px] sm:max-w-[260px] ${
                  isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white/[0.03] text-slate-400 border-white/5'
                }`}
                title={directionLabel(person.direction)}
              >
                {directionLabel(person.direction)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar: Always clean single-row on all screens down to 260px */}
      <div className={`relative z-10 flex w-full min-w-0 items-center justify-between gap-1.5 border-t pt-2 min-[360px]:gap-2 min-[360px]:pt-2.5 ${
        isLight ? 'border-slate-100' : 'border-white/5'
      }`}>
        {/* Communication group (Left) */}
        <div className="flex shrink-0 items-center gap-1">
          {person.phone_number ? (
            <a
              href={`tel:${person.phone_number.replace(/[^\d+]/g, '')}`}
              title={`Qo‘ng‘iroq: ${person.phone_number}`}
              className={`no-shelf cursor-pointer inline-flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg p-0 text-xs font-bold shadow-xs transition-all hover:brightness-110 active:scale-95 min-[360px]:h-8.5 min-[360px]:w-auto min-[360px]:rounded-xl min-[360px]:px-2.5 sm:px-3 ${accentChip('emerald', isLight)}`}
            >
              <PhoneCall size={12} className="shrink-0" />
              <span className="hidden sm:inline">Qo‘ng‘iroq</span>
            </a>
          ) : (
            <span className={`text-[10px] sm:text-[11px] italic px-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Tel yo‘q</span>
          )}

          <a
            href={`mailto:${person.email}`}
            title={`Email: ${person.email}`}
            className={`no-shelf cursor-pointer inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-xs transition-all active:scale-95 min-[360px]:h-8.5 min-[360px]:w-8.5 min-[360px]:rounded-xl ${
              isLight
                ? 'border-slate-200 bg-slate-100/80 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Mail size={13} />
          </a>
        </div>

        {/* Sardor Toggle Button (Right) */}
        {onToggleCaptain && canManageCaptains && (
          <button
            type="button"
            onClick={() => onToggleCaptain(person)}
            className={`no-shelf cursor-pointer inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-[10px] font-bold shadow-xs transition-all hover:brightness-110 active:scale-95 min-[360px]:h-8.5 min-[360px]:flex-none min-[360px]:gap-1.5 min-[360px]:rounded-xl min-[360px]:px-2.5 min-[360px]:text-xs sm:px-3 ${
              isCaptain ? accentChip('rose', isLight) : accentChip('purple', isLight)
            }`}
            title={isCaptain ? 'Qavat sardorligidan ozod qilish' : 'Ushbu talabani qavat sardori etib tayinlash'}
          >
            {isCaptain ? (
              <>
                <X size={13} className="shrink-0" />
                <span className="min-[360px]:hidden">Olish</span>
                <span className="hidden min-[360px]:inline">Sardorlikdan olish</span>
              </>
            ) : (
              <>
                <ShieldHalf size={13} className="shrink-0" />
                <span className="min-[360px]:hidden">Tayinlash</span>
                <span className="hidden min-[360px]:inline">Sardor tayinlash</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Full screen avatar — a portal, since this row sits inside a
          Framer Motion element (its own `transform` from `variants={rowIn}`,
          or an ancestor ModalShell) that would otherwise trap a nested
          `position: fixed` inside that element's own box instead of the
          viewport (same class of bug as the room-tile modal, see globals.css). */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {fullScreen && person.avatar_url && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFullScreen(false)}
              className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-[rgba(0,0,0,0.95)] p-4 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative aspect-square w-full max-w-2xl overflow-hidden rounded-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <Image src={person.avatar_url} alt={person.full_name} fill className="object-cover" unoptimized />
              </motion.div>
              <button
                type="button"
                onClick={() => setFullScreen(false)}
                className="no-shelf absolute right-6 top-6 text-white/50 transition-colors hover:text-white"
                aria-label="Yopish"
              >
                <X size={32} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </motion.div>
  )
}

function PersonList({
  people,
  emptyLabel,
  onToggleCaptain,
  canManageCaptains,
}: {
  people: Student[]
  emptyLabel: string
  onToggleCaptain?: (person: Student) => void
  canManageCaptains?: boolean
}) {
  const { theme } = usePanelTheme()
  if (people.length === 0) {
    return <EmptyState role="kengash" icon={Users} title={emptyLabel} isLight={theme === 'light'} />
  }

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="space-y-2.5">
      {people.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          onToggleCaptain={onToggleCaptain}
          canManageCaptains={canManageCaptains}
        />
      ))}
    </motion.div>
  )
}

export default function KengashDashboard() {
  const router = useRouter()
  const panelTheme = usePanelTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [captains, setCaptains] = useState<Student[]>([])
  const [elonlar, setElonlar] = useState<Elon[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'students' | 'captains' | 'rooms' | 'elonlar'>('students')
  const [activeFloor, setActiveFloor] = useState<number | null>(null)
  const [roomSearch, setRoomSearch] = useState('')

  const [studentSearch, setStudentSearch] = useState('')
  const [filterFloor, setFilterFloor] = useState('all')
  const [filterCourse, setFilterCourse] = useState('all')
  const [filterDirection, setFilterDirection] = useState('all')
  const [newElonOpen, setNewElonOpen] = useState(false)
  const deleteElonModal = useConfirmModal<string>()
  const captainModal = useConfirmModal<Student>()
  const [captainBusy, setCaptainBusy] = useState(false)
  const [newElonForm, setNewElonForm] = useState({
    title: '',
    text: '',
    type: 'Yangilik' as Elon['type'],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Granular rights
  const { allows, permissions } = useMyCouncilPermissions()

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const user = await getSafeUser()
      if (!user) {
        toast.error("Tizimga kirish talab etiladi")
        router.replace('/login')
        return
      }

      const { profile: profileData } = await fetchStudentProfile()

      if (!profileData || !profileData.is_council_chair) {
        toast.error("Ruxsat berilmagan! Siz talaba kengashi raisi emassiz.")
        router.replace('/talaba/dashboard')
        return
      }

      setProfile(profileData as Profile)

      const authHeader = await getAuthHeaders()

      await Promise.all([
        (async () => {
          try {
            const res = await fetch('/api/kengash/students', { headers: authHeader })
            const result = await res.json()
            if (!res.ok) {
              if (result?.code !== 'PERMISSION_REVOKED') throw new Error(result.error || 'Talabalarni yuklashda xato')
              return
            }
            if (Array.isArray(result.students)) setStudents(result.students)
          } catch (err) {
            console.error(err)
            toast.error(err instanceof Error ? err.message : 'Talabalarni yuklashda xatolik yuz berdi')
          }
        })(),
        (async () => {
          try {
            const res = await fetch('/api/kengash/students?role=captain', { headers: authHeader })
            const result = await res.json()
            if (!res.ok) {
              if (result?.code !== 'PERMISSION_REVOKED') throw new Error(result.error || 'Sardorlarni yuklashda xato')
              return
            }
            if (Array.isArray(result.students)) setCaptains(result.students)
          } catch (err) {
            console.error(err)
            toast.error(err instanceof Error ? err.message : 'Sardorlarni yuklashda xatolik yuz berdi')
          }
        })(),
        (async () => {
          try {
            const res = await fetch('/api/kengash/elonlar', { headers: authHeader })
            const result = await res.json()
            if (!res.ok) {
              if (result?.code !== 'PERMISSION_REVOKED') throw new Error(result.error || "E'lonlarni yuklashda xato")
              return
            }
            if (Array.isArray(result.elonlar)) setElonlar(result.elonlar)
          } catch (err) {
            console.error(err)
            toast.error(err instanceof Error ? err.message : "E'lonlarni yuklashda xatolik yuz berdi")
          }
        })(),
      ])
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Yuklashda xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    loadDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeTab === 'students' && !allows('students.view')) setActiveTab('elonlar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, permissions])

  // Filter Options
  const floorOptions = useMemo(() => {
    const s = new Set<number>()
    for (const st of students) if (st.assigned_floor !== null) s.add(st.assigned_floor)
    return Array.from(s).sort((a, b) => a - b)
  }, [students])

  const courseOptions = useMemo(() => {
    const s = new Set<number>()
    for (const st of students) if (st.course !== null) s.add(st.course)
    return Array.from(s).sort((a, b) => a - b)
  }, [students])

  const directionOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const st of students) {
      if (st.direction) map.set(st.direction, directionLabel(st.direction))
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'uz'))
  }, [students])

  const filtersActive = filterFloor !== 'all' || filterCourse !== 'all' || filterDirection !== 'all'

  const clearFilters = () => {
    setFilterFloor('all')
    setFilterCourse('all')
    setFilterDirection('all')
    setStudentSearch('')
  }

  const applyStudentFilters = (list: Student[]) => {
    const q = studentSearch.trim().toLowerCase()
    return list.filter((s) => {
      if (q) {
        const matchesName = s.full_name?.toLowerCase().includes(q)
        const matchesRoom = s.room_number?.toLowerCase().includes(q)
        const matchesGroup = s.group?.toLowerCase().includes(q)
        if (!matchesName && !matchesRoom && !matchesGroup) return false
      }
      if (filterFloor !== 'all' && s.assigned_floor !== Number(filterFloor)) return false
      if (filterCourse !== 'all' && s.course !== Number(filterCourse)) return false
      if (filterDirection !== 'all' && s.direction !== filterDirection) return false
      return true
    })
  }

  const filteredStudents = useMemo(() => applyStudentFilters(students), [students, studentSearch, filterFloor, filterCourse, filterDirection])
  const filteredCaptains = useMemo(() => applyStudentFilters(captains), [captains, studentSearch, filterFloor, filterCourse, filterDirection])

  // Rooms Data Hook
  const raisiGender = useMemo(() => normalizeGender(profile?.gender), [profile?.gender])
  const { floors, rooms: layoutRooms, loaded: roomsLoaded } = useRoomFloors()
  const roomsInScope = useMemo(
    () => layoutRooms.filter((r) => r.gender === null || r.gender === raisiGender),
    [layoutRooms, raisiGender],
  )

  const occupantsByRoom = useMemo(() => {
    const map = new Map<string, Student[]>()
    for (const s of students) {
      if (!s.room_number) continue
      const list = map.get(s.room_number) ?? []
      list.push(s)
      map.set(s.room_number, list)
    }
    return map
  }, [students])

  useEffect(() => {
    if (activeFloor === null && floors.length > 0) setActiveFloor(floors[0])
  }, [activeFloor, floors])

  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)

  const roomsOnFloor = useMemo(() => {
    const q = roomSearch.trim().toLowerCase()
    return roomsInScope
      .filter((r) => activeFloor === null || r.floor === activeFloor)
      .filter((r) => !q || r.roomNumber.toLowerCase().includes(q))
  }, [roomsInScope, activeFloor, roomSearch])

  const floorOccupancy = useMemo(() => {
    const map = new Map<number, { total: number; occupied: number }>()
    for (const r of roomsInScope) {
      const entry = map.get(r.floor) ?? { total: 0, occupied: 0 }
      entry.total += 1
      if ((occupantsByRoom.get(r.roomNumber) ?? []).length > 0) entry.occupied += 1
      map.set(r.floor, entry)
    }
    return map
  }, [roomsInScope, occupantsByRoom])

  // Create Announcement
  const handleCreateElon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newElonForm.title || !newElonForm.text) {
      toast.error("Sarlavha va matnni to'ldiring")
      return
    }

    try {
      setIsSubmitting(true)
      const authHeader = await getAuthHeaders()

      const res = await fetch('/api/kengash/elonlar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify(newElonForm),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "E'lon yuborishda xato")

      toast.success("E'lon muvaffaqiyatli chop etildi!")
      setElonlar((prev) => [data.elon, ...prev])
      setNewElonOpen(false)
      setNewElonForm({ title: '', text: '', type: 'Yangilik' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete Announcement
  const handleDeleteElon = (id: string) => {
    deleteElonModal.open(id)
  }

  const confirmDeleteElon = async () => {
    const id = deleteElonModal.target
    if (!id) return

    deleteElonModal.setIsLoading(true)
    try {
      const authHeader = await getAuthHeaders()

      const res = await fetch(`/api/kengash/elonlar?id=${id}`, {
        method: 'DELETE',
        headers: authHeader,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "O'chirishda xatolik")
      }

      toast.success("E'lon o'chirildi")
      setElonlar((prev) => prev.filter((e) => e.id !== id))
      deleteElonModal.close()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi")
    } finally {
      deleteElonModal.setIsLoading(false)
    }
  }

  // Captain Toggle Action
  const handleToggleCaptain = (person: Student) => {
    captainModal.open(person)
  }

  const confirmToggleCaptain = async () => {
    const person = captainModal.target
    if (!person || captainBusy) return
    const next = !person.is_floor_captain
    setCaptainBusy(true)
    try {
      const authHeader = await getAuthHeaders()
      const res = await fetch('/api/kengash/captains', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ studentId: person.id, isCaptain: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Amalni bajarib bo'lmadi")

      toast.success(next ? 'Talaba qavat sardori etib tayinlandi' : 'Sardorlik olib tashlandi')
      captainModal.close()
      await loadDashboardData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Amalni bajarib bo'lmadi")
    } finally {
      setCaptainBusy(false)
    }
  }

  if (!mounted || loading) {
    return (
      <div className="relative min-h-screen bg-[#070b13]">
        <LeaderBackdrop role="kengash" isLight={panelTheme.theme === 'light'} />
        <div className="relative z-10 px-4 py-8 sm:px-6 lg:px-8">
          <SkelPage />
        </div>
      </div>
    )
  }

  const genderLabel = profile?.gender === 'Ayol' || profile?.gender === 'female' ? 'Qizlar' : 'Yigitlar'
  const isLight = panelTheme.theme === 'light'
  const t = getLeaderTheme('kengash', isLight)

  const tabs: LeaderTab[] = [
    ...(allows('students.view')
      ? [
          { key: 'students', label: 'Talabalar', icon: Users, count: students.length },
          { key: 'captains', label: 'Qavat Sardorlari', icon: ShieldHalf, count: captains.length },
          { key: 'rooms', label: 'Xonalar Xaritasi', icon: Building2 },
        ]
      : []),
    { key: 'elonlar', label: "E'lonlarim", icon: Megaphone, count: elonlar.length },
  ]

  return (
    <div className="relative min-h-screen bg-[#070b13] text-white">
      <LeaderBackdrop role="kengash" isLight={isLight} />

      <div className="relative z-10 mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* 1. Executive Leader Header */}
        <LeaderHeader
          role="kengash"
          icon={Crown}
          badgeText={`Talaba Kengashi Raisi · ${genderLabel}`}
          name={profile?.full_name ?? 'Talaba Kengashi Raisi'}
          subtitle={`Fakultet ${genderLabel.toLowerCase()} talabalar turar joyini boshqarish, qavat sardorlarini tayinlash va e’lonlar yuborish`}
          backHref="/talaba/dashboard"
          stats={[
            {
              icon: Users,
              value: students.length,
              label: 'Talabalar',
              subtitle: 'Fakultet yoshlari',
              accent: 'indigo',
              onClick: () => setActiveTab('students'),
              active: activeTab === 'students',
            },
            {
              icon: ShieldHalf,
              value: captains.length,
              label: 'Sardorlar',
              subtitle: 'Qavat yetakchilari',
              accent: 'purple',
              onClick: () => setActiveTab('captains'),
              active: activeTab === 'captains',
            },
            {
              icon: Building2,
              value: roomsInScope.length,
              label: 'Xonalar',
              subtitle: `${floors.length} ta qavat bo‘yicha`,
              accent: 'emerald',
              onClick: () => setActiveTab('rooms'),
              active: activeTab === 'rooms',
            },
            {
              icon: Megaphone,
              value: elonlar.length,
              label: "E'lonlar",
              subtitle: 'Yuborilgan xabarlar',
              accent: 'amber',
              onClick: () => setActiveTab('elonlar'),
              active: activeTab === 'elonlar',
            },
          ]}
          themeToggle={{ theme: panelTheme.theme, onToggle: panelTheme.toggleTheme }}
        />

        {/* 2. Navigation Tabs */}
        <LeaderTabs
          role="kengash"
          tabs={tabs}
          active={activeTab}
          onChange={(k) => setActiveTab(k as typeof activeTab)}
          isLight={isLight}
        />

        {/* 3. Main Tab Panels */}
        <AnimatePresence mode="wait">
          {/* 3A: XONALAR XARITASI */}
          {activeTab === 'rooms' && allows('students.view') ? (
            <motion.div
              key="rooms"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Building2 size={18} className="text-indigo-400" />
                    <span>Xonalar Xaritasi</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fakultet {genderLabel.toLowerCase()} yashaydigan xonalar va qavatlar to‘liqlik holati
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Xona raqami bo‘yicha..."
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    className="no-shelf w-full border rounded-2xl py-2 pl-10 pr-4 bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus:border-indigo-500/50 outline-none text-xs transition-all"
                  />
                  {roomSearch && (
                    <button
                      type="button"
                      onClick={() => setRoomSearch('')}
                      className="no-shelf cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {!roomsLoaded ? (
                <EmptyState role="kengash" icon={Building2} title="Xonalar yuklanmoqda..." isLight={isLight} />
              ) : (
                <>
                  {/* Floor Selector Pills */}
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {floors.map((f) => {
                      const occ = floorOccupancy.get(f)
                      const pct = occ && occ.total > 0 ? Math.round((occ.occupied / occ.total) * 100) : 0
                      const isActive = activeFloor === f
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setActiveFloor(f)}
                          className={`no-shelf cursor-pointer shrink-0 rounded-2xl border px-4 py-2.5 text-left transition-all active:scale-95 ${
                            isActive
                              ? `border-white/20 text-white ${t.gradient} shadow-md shadow-purple-950/40`
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <span className="block text-xs font-black uppercase tracking-wider">{f}-qavat</span>
                          <span className={`mt-1.5 block h-1.5 w-16 overflow-hidden rounded-full ${isActive ? 'bg-white/25' : 'bg-white/10'}`}>
                            <span
                              className={`block h-full rounded-full transition-all duration-500 ${isActive ? 'bg-white' : 'bg-indigo-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {roomsOnFloor.length === 0 ? (
                    <EmptyState
                      role="kengash"
                      icon={DoorClosed}
                      title={`Ushbu qavatda ${genderLabel.toLowerCase()} uchun xona topilmadi`}
                      isLight={isLight}
                    />
                  ) : (
                    <motion.div
                      variants={listStagger}
                      initial="hidden"
                      animate="show"
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
                    >
                      {roomsOnFloor.map((room) => {
                        const occupants = occupantsByRoom.get(room.roomNumber) ?? []
                        const count = occupants.length
                        const capacity = room.capacity ?? 4
                        const isFrozen = room.frozen
                        const hasCaptain = occupants.some((s) => s.is_floor_captain)
                        const isFull = count >= capacity
                        const isPartiallyFilled = count > 0 && !isFull

                        // Thematic styling based on live occupancy. The dark
                        // `via-slate-900`/`to-slate-900` gradients below aren't
                        // covered by the light-mode CSS retrofit (only flat
                        // `bg-*` classes are), so they get a light-mode branch.
                        const isLightRoom = panelTheme.theme === 'light'
                        const statusStyles = isFrozen
                          ? {
                              border: 'border-amber-500/35 hover:border-amber-500/60',
                              // Flat, not a gradient: any `<button>` matching
                              // `bg-gradient*` gets its text force-whited by
                              // the "vivid CTA" retrofit rule (globals.css),
                              // which assumes gradients are always saturated —
                              // wrong for this pale one, so it made the room
                              // number unreadable (white-on-near-white).
                              bg: isLightRoom ? 'bg-amber-50' : 'bg-gradient-to-br from-amber-950/25 via-slate-900/60 to-slate-900/90',
                              glow: 'shadow-amber-950/20',
                              badgeBg: accentChip('amber', isLightRoom),
                              badgeText: "Ta'mirda",
                              iconColor: accentChip('amber', isLightRoom),
                            }
                          : isFull
                          ? {
                              border: 'border-indigo-500/35 hover:border-indigo-500/60',
                              bg: isLightRoom ? 'bg-indigo-50' : 'bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-900/90',
                              glow: 'shadow-indigo-950/30',
                              badgeBg: accentChip('indigo', isLightRoom),
                              badgeText: `${count}/${capacity} to‘la`,
                              iconColor: accentChip('indigo', isLightRoom),
                            }
                          : isPartiallyFilled
                          ? {
                              border: 'border-emerald-500/35 hover:border-emerald-500/60',
                              bg: isLightRoom ? 'bg-emerald-50' : 'bg-gradient-to-br from-emerald-950/30 via-slate-900/60 to-slate-900/90',
                              glow: 'shadow-emerald-950/30',
                              badgeBg: accentChip('emerald', isLightRoom),
                              badgeText: `${count}/${capacity} · ${capacity - count} bo‘sh`,
                              iconColor: accentChip('emerald', isLightRoom),
                            }
                          : {
                              border: 'border-white/10 hover:border-white/25',
                              bg: 'bg-white/[0.025] hover:bg-white/[0.05]',
                              glow: 'shadow-black/20',
                              badgeBg: 'bg-white/5 text-slate-400 border-white/10',
                              badgeText: `Bo‘sh · ${capacity} joy`,
                              iconColor: 'text-slate-400 bg-white/5 border-white/10',
                            }

                        return (
                          <motion.button
                            key={room.roomNumber}
                            variants={rowIn}
                            type="button"
                            onClick={() => setSelectedRoom(room.roomNumber)}
                            className={`no-shelf cursor-pointer group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:scale-95 ${statusStyles.border} ${statusStyles.bg} ${statusStyles.glow}`}
                          >
                            {/* Captain Crown Ribbon */}
                            {hasCaptain && (
                              <div
                                className={`absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-xs ${accentChip('amber', isLightRoom)}`}
                                title="Ushbu xonada qavat sardori yashaydi"
                              >
                                <Crown size={9} className="fill-amber-400" />
                                <span className="hidden min-[380px]:inline">Sardor</span>
                              </div>
                            )}

                            {/* Header: Door icon + Room Number */}
                            <div className="flex items-center gap-2">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-105 ${statusStyles.iconColor}`}>
                                {isFrozen ? <Snowflake size={15} /> : <DoorClosed size={15} />}
                              </div>
                              <div className="min-w-0">
                                <span className="block text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                                  {room.roomNumber}
                                </span>
                                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                  xona
                                </span>
                              </div>
                            </div>

                            {/* Middle: Vacancy dots indicator */}
                            {!isFrozen && (
                              <div className="my-2.5 flex items-center gap-1">
                                {Array.from({ length: Math.min(capacity, 6) }).map((_, i) => {
                                  const isBedOccupied = i < count
                                  return (
                                    <span
                                      key={i}
                                      className={`h-1.5 flex-1 rounded-full transition-all ${
                                        isBedOccupied
                                          ? isFull
                                            ? 'bg-indigo-400 shadow-xs shadow-indigo-400/50'
                                            : 'bg-emerald-400 shadow-xs shadow-emerald-400/50'
                                          : 'bg-white/10 border border-white/10'
                                      }`}
                                      title={isBedOccupied ? 'Band o‘rin' : 'Bo‘sh o‘rin'}
                                    />
                                  )
                                })}
                              </div>
                            )}

                            {/* Footer: Status Badge */}
                            <div className="mt-auto pt-1">
                              <span className={`inline-flex items-center gap-1 w-full justify-center rounded-lg border px-2 py-1 text-[10px] font-bold ${statusStyles.badgeBg}`}>
                                {statusStyles.badgeText}
                              </span>
                            </div>
                          </motion.button>
                        )
                      })}
                    </motion.div>
                  )}

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-2 px-1">
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-md bg-indigo-500/30 border border-indigo-500/40" /> To‘la xona
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-md bg-emerald-500/30 border border-emerald-500/40" /> Bo‘sh o‘rin bor
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-md bg-white/10 border border-white/15" /> Bo‘sh xona
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-md bg-amber-500/20 border border-amber-500/30" /> Ta’mirlashda
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Crown size={12} className="text-amber-400 fill-amber-400" /> Qavat sardori xonasi
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          ) : (activeTab === 'students' || activeTab === 'captains') && allows('students.view') ? (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Tab Info / Description Banner for Captains */}
              {activeTab === 'captains' && (
                <div className={`no-shelf rounded-2xl p-4 text-xs flex items-start gap-3 shadow-md shadow-purple-950/20 ${accentChip('purple', isLight)}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${accentChip('purple', isLight)}`}>
                    <Crown size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black uppercase tracking-wider text-white text-xs">
                      Qavat Sardorlari Kengashi
                    </h4>
                    <p className="mt-0.5 leading-relaxed opacity-90">
                      Sardorlar o‘z qavatidagi talabalar davomati, xonalar tozaligi va ichki tartib-intizomga mas’uldirlar.
                      Yangi sardor tayinlash uchun &laquo;Talabalar&raquo; bo‘limidan kerakli talabani tanlang.
                    </p>
                  </div>
                </div>
              )}

              {/* Search & Filter Toolbar */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xl space-y-3 shadow-xl">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
                  {/* Search input */}
                  <div className="relative flex-1 min-w-0">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Ism, xona yoki guruh bo‘yicha qidirish..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="no-shelf w-full h-10 rounded-xl border border-white/10 bg-white/5 pl-10 pr-9 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:border-purple-500/50 focus:bg-white/[0.08] focus:outline-none transition-all"
                    />
                    {studentSearch && (
                      <button
                        type="button"
                        onClick={() => setStudentSearch('')}
                        className="no-shelf cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Filter Dropdowns in a single horizontal row on desktop */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-nowrap items-center gap-2">
                    <div className="w-full sm:w-[140px]">
                      <CustomSelect
                        value={filterFloor}
                        onChange={setFilterFloor}
                        className="w-full h-10 rounded-xl border border-white/10 bg-slate-800/90 text-white px-3 text-xs hover:border-white/20 transition-all"
                        options={[
                          { value: 'all', label: 'Barcha qavatlar' },
                          ...floorOptions.map((f) => ({ value: String(f), label: `${f}-qavat` })),
                        ]}
                      />
                    </div>

                    <div className="w-full sm:w-[130px]">
                      <CustomSelect
                        value={filterCourse}
                        onChange={setFilterCourse}
                        className="w-full h-10 rounded-xl border border-white/10 bg-slate-800/90 text-white px-3 text-xs hover:border-white/20 transition-all"
                        options={[
                          { value: 'all', label: 'Barcha kurslar' },
                          ...courseOptions.map((c) => ({ value: String(c), label: `${c}-kurs` })),
                        ]}
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1 w-full sm:w-[170px]">
                      <CustomSelect
                        value={filterDirection}
                        onChange={setFilterDirection}
                        className="w-full h-10 rounded-xl border border-white/10 bg-slate-800/90 text-white px-3 text-xs hover:border-white/20 transition-all"
                        options={[
                          { value: 'all', label: 'Barcha yo‘nalishlar' },
                          ...directionOptions,
                        ]}
                      />
                    </div>

                    {filtersActive && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className={`no-shelf cursor-pointer col-span-2 sm:col-span-1 shrink-0 h-10 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all active:scale-95 whitespace-nowrap hover:brightness-110 ${accentChip('rose', isLight)}`}
                        title="Barcha filtrlarni tozalash"
                      >
                        <X size={12} />
                        <span>Tozalash</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Status / Count bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 px-1 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white font-bold text-[11px]">
                      {activeTab === 'students' ? filteredStudents.length : filteredCaptains.length} ta
                    </span>
                    <span>
                      talaba topildi
                      {studentSearch || filtersActive ? (
                        <span className="text-slate-500"> (jami {activeTab === 'students' ? students.length : captains.length} tadan)</span>
                      ) : null}
                    </span>
                  </div>

                  {activeTab === 'students' && allows('captains.manage') && (
                    <div className={`flex items-center gap-1.5 text-[11px] rounded-lg px-2.5 py-1 ${accentChip('purple', isLight)}`}>
                      <Sparkles size={12} className="shrink-0" />
                      <span>Sardor tayinlash uchun talaba kartasidagi «Sardor tayinlash» tugmasini bosing</span>
                    </div>
                  )}
                </div>
              </div>

              {/* List */}
              {activeTab === 'students' ? (
                <PersonList
                  people={filteredStudents}
                  emptyLabel="Hech qanday talaba topilmadi"
                  onToggleCaptain={allows('captains.manage') ? handleToggleCaptain : undefined}
                  canManageCaptains={allows('captains.manage')}
                />
              ) : (
                <PersonList
                  people={filteredCaptains}
                  emptyLabel="Bu fakultetda hali qavat sardorlari tayinlanmagan"
                  onToggleCaptain={allows('captains.manage') ? handleToggleCaptain : undefined}
                  canManageCaptains={allows('captains.manage')}
                />
              )}
            </motion.div>
          ) : (
            /* 3B: E'LONLARIM */
            <motion.div
              key="elonlar"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Megaphone size={18} className="text-amber-400" />
                    <span>Fakultet E’lonlari</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Faqat sizning fakultetingiz {genderLabel.toLowerCase()} talabalariga ko‘rinadigan rasmiy bildirishnomalar
                  </p>
                </div>

                {allows('council.announcements') && (
                  <button
                    type="button"
                    onClick={() => setNewElonOpen(true)}
                    className="no-shelf cursor-pointer inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:brightness-110 shadow-lg shadow-indigo-950/40 transition-all active:scale-95"
                  >
                    <Plus size={15} />
                    <span>Yangi E’lon</span>
                  </button>
                )}
              </div>

              {elonlar.length > 0 ? (
                <motion.div variants={listStagger} initial="hidden" animate="show" className="space-y-3">
                  {elonlar.map((elon) => {
                    const style = ELON_TYPE_STYLE[elon.type]
                    const badgeClass = accentChip(style.color, isLight)
                    return (
                      <motion.div
                        variants={rowIn}
                        key={elon.id}
                        className="no-shelf rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 flex items-start gap-3.5 transition-all hover:border-white/20 hover:bg-white/[0.05]"
                      >
                        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot} shadow-sm`} />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${badgeClass}`}>
                              {elon.type}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                              <Clock size={11} /> {new Date(elon.created_at).toLocaleDateString('uz-UZ')}
                            </span>
                          </div>
                          <h4 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                            {elon.title}
                          </h4>
                          <p className="text-xs sm:text-sm leading-relaxed text-slate-300 whitespace-pre-line">
                            {elon.text}
                          </p>
                        </div>
                        {allows('council.announcements') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteElon(elon.id)}
                            title="E'lonni o'chirish"
                            className="no-shelf cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all hover:border-rose-500/30 hover:bg-rose-500/15 hover:text-rose-300 active:scale-95"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </motion.div>
                    )
                  })}
                </motion.div>
              ) : (
                <EmptyState
                  role="kengash"
                  icon={Megaphone}
                  title="Hozircha hech qanday e’lon chop etilmagan"
                  isLight={isLight}
                />
              )}

              <KengashStoryManager isLight={isLight} canManage={allows('council.announcements')} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. New Announcement Modal */}
        <AnimatePresence>
          {newElonOpen && (
            <ModalShell
              role="kengash"
              icon={Megaphone}
              title="Yangi E’lon Chop Etish"
              description={`Ushbu e’lon butun fakultet ${genderLabel.toLowerCase()} talabalariga yuboriladi.`}
              onClose={() => setNewElonOpen(false)}
              isLight={isLight}
            >
              <form onSubmit={handleCreateElon} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Mavzu / Sarlavha</label>
                  <input
                    type="text"
                    required
                    value={newElonForm.title}
                    onChange={(e) => setNewElonForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="no-shelf w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white transition-all focus:border-indigo-500/50 outline-none text-sm"
                    placeholder="Masalan: Kengash yig'ilishi"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Turi / Toifa</label>
                  <CustomSelect
                    value={newElonForm.type}
                    onChange={(val) => setNewElonForm((prev) => ({ ...prev, type: val as Elon['type'] }))}
                    options={[
                      { value: 'Yangilik', label: 'Yangilik' },
                      { value: 'Ogohlantirish', label: 'Ogohlantirish' },
                      { value: 'Muhim', label: 'Muhim' },
                      { value: 'Tadbir', label: 'Tadbir' },
                    ]}
                    className="rounded-xl border border-white/15 bg-slate-900 px-4 py-2.5 text-sm text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">E’lon Matni</label>
                  <textarea
                    required
                    rows={4}
                    value={newElonForm.text}
                    onChange={(e) => setNewElonForm((prev) => ({ ...prev, text: e.target.value }))}
                    className="no-shelf w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white transition-all focus:border-indigo-500/50 outline-none text-sm resize-none"
                    placeholder="E'lon tafsilotlarini batafsil kiriting..."
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setNewElonOpen(false)}
                    className="no-shelf cursor-pointer flex-1 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`no-shelf cursor-pointer flex-1 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-55 ${t.gradient} hover:brightness-110 active:scale-95 shadow-lg shadow-purple-950/40`}
                  >
                    {isSubmitting ? 'Chop etilmoqda...' : 'Chop etish'}
                  </button>
                </div>
              </form>
            </ModalShell>
          )}
        </AnimatePresence>

        {/* 5. Delete Announcement Modal */}
        <ConfirmModal
          isOpen={deleteElonModal.isOpen}
          title="E’lonni o‘chirish"
          description="Ushbu e’lonni o‘chirmoqchimisiz? Bu amalni qaytarib bo‘lmaydi."
          onClose={deleteElonModal.close}
          onConfirm={confirmDeleteElon}
          confirmText="O‘chirish"
          confirmVariant="danger"
          isLoading={deleteElonModal.isLoading}
        />

        {/* 6. Appoint / Revoke Captain Modal */}
        <ConfirmModal
          isOpen={captainModal.isOpen}
          title={captainModal.target?.is_floor_captain ? 'Sardorlikdan olish' : 'Sardor etib tayinlash'}
          description={
            captainModal.target
              ? `${captainModal.target.full_name}${captainModal.target.room_number ? ` · ${captainModal.target.room_number}-xona` : ''}`
              : undefined
          }
          onClose={captainModal.close}
          onConfirm={confirmToggleCaptain}
          confirmText={captainModal.target?.is_floor_captain ? 'Olib tashlash' : 'Tayinlash'}
          confirmVariant={captainModal.target?.is_floor_captain ? 'danger' : 'primary'}
          isLoading={captainBusy}
        >
          {captainModal.target && (
            <div className={`rounded-xl p-3.5 text-xs leading-relaxed ${accentChip('indigo', isLight)}`}>
              {captainModal.target.is_floor_captain ? (
                <>
                  Talaba <strong className="text-white font-bold">{captainModal.target.assigned_floor}-qavat</strong> sardorligidan
                  ozod qilinadi. Qavat <strong className="text-white font-bold">sardorsiz qoladi</strong> — zarur bo‘lsa,
                  boshqa talabani tayinlashingiz mumkin.
                </>
              ) : (
                <>
                  <strong className="text-white font-bold">{captainModal.target.full_name}</strong> o‘zi yashaydigan{' '}
                  <strong className="text-white font-bold">{captainModal.target.assigned_floor}-qavat</strong> sardori etib
                  tayinlanadi. Shu qavatda hozir sardor bo‘lsa, u <strong className="text-white font-bold">avtomatik
                  almashtiriladi</strong>.
                </>
              )}
            </div>
          )}
        </ConfirmModal>

        {/* 7. Room Occupants Modal */}
        <AnimatePresence>
          {selectedRoom && (
            <ModalShell
              role="kengash"
              icon={DoorClosed}
              title={`${selectedRoom}-xona yashovchilari`}
              description={`${(occupantsByRoom.get(selectedRoom) ?? []).length} nafar talaba istiqomat qilmoqda`}
              maxWidthClass="max-w-xl sm:max-w-2xl"
              isLight={isLight}
              onClose={() => setSelectedRoom(null)}
            >
              {(occupantsByRoom.get(selectedRoom) ?? []).length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  Bu xona hozircha bo‘sh
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                  {(occupantsByRoom.get(selectedRoom) ?? []).map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      onToggleCaptain={allows('captains.manage') ? handleToggleCaptain : undefined}
                      canManageCaptains={allows('captains.manage')}
                    />
                  ))}
                </div>
              )}
            </ModalShell>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
