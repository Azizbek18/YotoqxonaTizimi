'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Users, Megaphone, Search, Clock,
  Trash2, Plus, Phone, Mail, X,
  FileText, MessageSquareWarning, ShieldHalf,
  Building2, DoorClosed, Snowflake, Crown,
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
import { glassCard, leaderTheme } from '@/components/leader/leader-theme'

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

const ELON_TYPE_STYLE: Record<Elon['type'], { dot: string; badge: string }> = {
  Muhim: { dot: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  Tadbir: { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  Ogohlantirish: { dot: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  Yangilik: { dot: 'bg-cyan-500', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
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

/** One person card — used for both the "Talabalar" and "Sardorlar" tabs so
 *  the two lists read as one system, not two differently-designed screens.
 *  `onToggleCaptain` is only passed where the raisi is allowed to appoint —
 *  its absence (room occupant popup, revoked captains.manage) hides the
 *  action instead of showing a button that would 403. */
function PersonRow({ person, onToggleCaptain }: { person: Student; onToggleCaptain?: (person: Student) => void }) {
  const meta = [
    person.direction ? directionLabel(person.direction) : null,
    person.course ? `${person.course}-kurs` : null,
    person.room_number ? `${person.room_number}-xona` : 'Xonasiz',
  ].filter(Boolean).join(' · ')

  return (
    <motion.div variants={rowIn} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.035]">
      <div className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-inset ${
        person.is_floor_captain ? 'ring-purple-500/40 bg-purple-500/10' : 'ring-indigo-500/25 bg-indigo-500/10'
      }`}>
        {person.avatar_url ? (
          <Image src={person.avatar_url} alt={person.full_name} fill sizes="44px" unoptimized className="object-cover" />
        ) : (
          <div className={`flex h-full w-full items-center justify-center text-xs font-bold ${person.is_floor_captain ? 'text-purple-300' : 'text-indigo-300'}`}>
            {initialsOf(person.full_name)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{person.full_name}</p>
        <p className="truncate text-[11px] text-slate-400">
          {person.is_floor_captain && (
            <span className="mr-1.5 inline-flex items-center gap-1 text-purple-400">
              <ShieldHalf size={10} />
              {person.assigned_floor ? `${person.assigned_floor}-qavat sardori` : 'Sardor'} ·
            </span>
          )}
          {meta}
        </p>
      </div>

      {(person.arizaCount > 0 || person.tushuntirishCount > 0) && (
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          {person.arizaCount > 0 && (
            <span
              title="Yozgan arizalari"
              className="flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-300"
            >
              <FileText size={11} /> {person.arizaCount}
            </span>
          )}
          {person.tushuntirishCount > 0 && (
            <span
              title="Yozgan tushuntirish xatlari"
              className="flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300"
            >
              <MessageSquareWarning size={11} /> {person.tushuntirishCount}
            </span>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1.5 opacity-90 transition-opacity group-hover:opacity-100">
        {person.phone_number && (
          <a
            href={`tel:${person.phone_number}`}
            title="Qo'ng'iroq qilish"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-indigo-500/10 hover:text-indigo-300"
          >
            <Phone size={13} />
          </a>
        )}
        <a
          href={`mailto:${person.email}`}
          title="Email yozish"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-indigo-500/10 hover:text-indigo-300"
        >
          <Mail size={13} />
        </a>
        {onToggleCaptain && (person.is_floor_captain || person.assigned_floor) && (
          <button
            onClick={() => onToggleCaptain(person)}
            title={person.is_floor_captain ? 'Sardorlikdan olish' : 'Sardor tayinlash'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
              person.is_floor_captain
                ? 'border-purple-500/25 bg-purple-500/10 text-purple-300 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/25'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-300'
            }`}
          >
            <ShieldHalf size={13} />
          </button>
        )}
      </div>
    </motion.div>
  )
}

function PersonList({ people, emptyLabel, onToggleCaptain }: { people: Student[]; emptyLabel: string; onToggleCaptain?: (person: Student) => void }) {
  if (people.length === 0) {
    return <EmptyState role="kengash" icon={Users} title={emptyLabel} />
  }
  return (
    <motion.div
      variants={listStagger}
      initial="hidden"
      animate="show"
      className={`${glassCard()} divide-y divide-white/5`}
    >
      {people.map((person) => <PersonRow key={person.id} person={person} onToggleCaptain={onToggleCaptain} />)}
    </motion.div>
  )
}

export default function KengashDashboard() {
  const router = useRouter()
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
    type: 'Yangilik' as Elon['type']
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dekan-tunable rights (Sozlamalar → Ruxsatlar): a revoked one closes the
  // matching tab/action here, matching what the API already answers 403 for.
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

      // Students, captains and announcements load independently: the dekan
      // can revoke students.view / council.announcements separately, and a
      // raisi missing one must still get a working panel for the rest, not
      // a dashboard that fails to load entirely over a single 403.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; loadDashboardData isn't memoized
  }, [])

  // The default tab is "Talabalar" — if the dekan has revoked that right,
  // once we actually know (permissions !== null) hop to a tab that's there.
  useEffect(() => {
    if ((activeTab === 'students' || activeTab === 'captains' || activeTab === 'rooms') && !allows('students.view')) setActiveTab('elonlar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, permissions])

  // "which room is on which floor" is open to any signed-in user (see
  // app/api/room-floors) — no kengash-specific endpoint needed for the
  // layout itself. Occupancy is derived from `students`, which the server
  // already scoped to this raisi's own gender, so a mixed-declared room
  // never surfaces the other gender's names here.
  const { rooms: layoutRooms, floors, loaded: roomsLoaded } = useRoomFloors()

  const matchesSearch = (person: Student, query: string) =>
    person.full_name?.toLowerCase().includes(query) ||
    person.room_number?.toLowerCase().includes(query) ||
    person.group?.toLowerCase().includes(query)

  const matchesFilters = (person: Student) =>
    (filterFloor === 'all' || String(person.assigned_floor ?? '') === filterFloor) &&
    (filterCourse === 'all' || String(person.course ?? '') === filterCourse) &&
    (filterDirection === 'all' || person.direction === filterDirection)

  // Every filter option is derived from the faculty's own roster (both
  // students and captains), not a hardcoded list — a raisi should only ever
  // be offered a floor/course/direction that actually has someone in it.
  const allPeople = useMemo(() => [...students, ...captains], [students, captains])
  const floorOptions = useMemo(
    () => Array.from(new Set(allPeople.map((p) => p.assigned_floor).filter((f): f is number => f != null)))
      .sort((a, b) => a - b),
    [allPeople],
  )
  const courseOptions = useMemo(
    () => Array.from(new Set(allPeople.map((p) => p.course).filter((c): c is number => c != null)))
      .sort((a, b) => a - b),
    [allPeople],
  )
  const directionOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: { value: string; label: string }[] = []
    for (const p of allPeople) {
      if (!p.direction || seen.has(p.direction)) continue
      seen.add(p.direction)
      out.push({ value: p.direction, label: directionLabel(p.direction) })
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'uz'))
  }, [allPeople])

  const filtersActive = filterFloor !== 'all' || filterCourse !== 'all' || filterDirection !== 'all'
  const clearFilters = () => { setFilterFloor('all'); setFilterCourse('all'); setFilterDirection('all') }

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    return students.filter((s) => (!q || matchesSearch(s, q)) && matchesFilters(s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, studentSearch, filterFloor, filterCourse, filterDirection])

  const filteredCaptains = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    return captains.filter((s) => (!q || matchesSearch(s, q)) && matchesFilters(s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captains, studentSearch, filterFloor, filterCourse, filterDirection])

  // ---- Xonalar xaritasi (read-only, own-gender only) ----

  const raisiGender = normalizeGender(profile?.gender)

  // A room the dekan declared for the OTHER gender is dropped entirely; an
  // undeclared ('mixed') room is kept — its occupant list below still only
  // ever contains this raisi's own gender, since `students` was already
  // scoped server-side, so the other gender's residents there stay unseen.
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
          ...authHeader
        },
        body: JSON.stringify(newElonForm)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "E'lon yuborishda xato")

      toast.success("E'lon muvaffaqiyatli chop etildi!")
      setElonlar(prev => [data.elon, ...prev])
      setNewElonOpen(false)
      setNewElonForm({ title: '', text: '', type: 'Yangilik' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi")
    } finally {
      setIsSubmitting(false)
    }
  }

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
        headers: authHeader
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "O'chirishda xatolik")
      }

      toast.success("E'lon o'chirildi")
      setElonlar(prev => prev.filter(e => e.id !== id))
      deleteElonModal.close()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi")
    } finally {
      deleteElonModal.setIsLoading(false)
    }
  }

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

      // The RPC also demotes whoever else held the same floor/gender slot,
      // so a local merge would leave that other row stale — re-fetch both
      // lists (students + captains) the way the dekan panel does.
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
        <LeaderBackdrop role="kengash" />
        <div className="relative z-10 px-4 py-8 sm:px-6 lg:px-8">
          <SkelPage />
        </div>
      </div>
    )
  }

  const genderLabel = profile?.gender === 'Ayol' || profile?.gender === 'female' ? 'Qizlar' : 'Yigitlar'
  const t = leaderTheme.kengash

  const tabs: LeaderTab[] = [
    ...(allows('students.view')
      ? [
          { key: 'students', label: 'Talabalar', icon: Users, count: students.length },
          { key: 'captains', label: 'Sardorlar', icon: ShieldHalf, count: captains.length },
          { key: 'rooms', label: 'Xonalar xaritasi', icon: Building2 },
        ]
      : []),
    { key: 'elonlar', label: "E'lonlarim", icon: Megaphone, count: elonlar.length },
  ]

  return (
    <div className="relative min-h-screen bg-[#070b13] text-white">
      <LeaderBackdrop role="kengash" />
      <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <LeaderHeader
          role="kengash"
          icon={Crown}
          badgeText={`Talaba kengashi raisi · ${genderLabel}`}
          name={profile?.full_name ?? ''}
          subtitle={`Butun fakultet ${genderLabel.toLowerCase()} talabalarini boshqarish va e'lonlar yuborish`}
          backHref="/talaba/dashboard"
          stats={[
            { icon: Users, value: students.length, label: 'Talabalar' },
            { icon: ShieldHalf, value: captains.length, label: 'Sardorlar' },
            { icon: Megaphone, value: elonlar.length, label: "E'lonlar" },
          ]}
        />

        <LeaderTabs role="kengash" tabs={tabs} active={activeTab} onChange={(k) => setActiveTab(k as typeof activeTab)} />

        {/* Main Tab Panels */}
        <AnimatePresence mode="wait">
          {activeTab === 'rooms' && allows('students.view') ? (
            <motion.div
              key="rooms"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              <SectionHeading
                title="Xonalar xaritasi"
                description={`Butun fakultet ${genderLabel.toLowerCase()} xonalari — faqat ko'rish uchun`}
                action={
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Xona raqami..."
                      value={roomSearch}
                      onChange={(e) => setRoomSearch(e.target.value)}
                      className="w-full border rounded-2xl py-2.5 pl-11 pr-4 bg-white/5 border-white/5 text-white placeholder:text-gray-500 focus:border-indigo-500/30 outline-none text-xs transition-all"
                    />
                  </div>
                }
              />

              {!roomsLoaded ? (
                <EmptyState role="kengash" icon={Building2} title="Yuklanmoqda..." />
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {floors.map((f) => {
                      const occ = floorOccupancy.get(f)
                      const pct = occ && occ.total > 0 ? Math.round((occ.occupied / occ.total) * 100) : 0
                      const isActive = activeFloor === f
                      return (
                        <button
                          key={f}
                          onClick={() => setActiveFloor(f)}
                          className={`shrink-0 rounded-2xl border px-4 py-2.5 text-left transition-all ${
                            isActive
                              ? `border-transparent text-white ${t.gradient}`
                              : 'border-white/5 bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <span className="block text-xs font-black uppercase tracking-wider">{f}-qavat</span>
                          <span className={`mt-1 block h-1 w-14 overflow-hidden rounded-full ${isActive ? 'bg-white/25' : 'bg-white/10'}`}>
                            <span
                              className={`block h-full rounded-full ${isActive ? 'bg-white' : 'bg-indigo-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {roomsOnFloor.length === 0 ? (
                    <EmptyState role="kengash" icon={DoorClosed} title={`Bu qavatda ${genderLabel.toLowerCase()} uchun xona topilmadi`} />
                  ) : (
                    <motion.div
                      variants={listStagger}
                      initial="hidden"
                      animate="show"
                      className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
                    >
                      {roomsOnFloor.map((room) => {
                        const occupants = occupantsByRoom.get(room.roomNumber) ?? []
                        const tone = room.frozen
                          ? 'border-amber-500/25 bg-amber-500/5 text-amber-300'
                          : occupants.length > 0
                            ? 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200 hover:border-indigo-500/50'
                            : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20'
                        return (
                          <motion.button
                            key={room.roomNumber}
                            variants={rowIn}
                            onClick={() => setSelectedRoom(room.roomNumber)}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-all hover:-translate-y-0.5 ${tone}`}
                          >
                            {room.frozen ? <Snowflake size={14} /> : <DoorClosed size={14} />}
                            <span className="text-sm font-black">{room.roomNumber}</span>
                            <span className="text-[10px] font-semibold">
                              {room.frozen ? "Ta'mirlash" : `${occupants.length} kishi`}
                            </span>
                          </motion.button>
                        )
                      })}
                    </motion.div>
                  )}

                  <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-500/20 border border-indigo-500/25" /> Band</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-white/5 border border-white/10" /> Bo&apos;sh</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500/10 border border-amber-500/25" /> Ta&apos;mirlash</span>
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
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ism, xona yoki guruh bo'yicha qidirish..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full border rounded-2xl py-3 pl-11 pr-4 bg-white/5 border-white/5 text-white placeholder:text-gray-500 focus:border-indigo-500/30 outline-none text-xs sm:text-sm transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <CustomSelect
                  value={filterFloor}
                  onChange={setFilterFloor}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs sm:w-auto"
                  options={[
                    { value: 'all', label: 'Barcha qavatlar' },
                    ...floorOptions.map((f) => ({ value: String(f), label: `${f}-qavat` })),
                  ]}
                />
                <CustomSelect
                  value={filterCourse}
                  onChange={setFilterCourse}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs sm:w-auto"
                  options={[
                    { value: 'all', label: 'Barcha kurslar' },
                    ...courseOptions.map((c) => ({ value: String(c), label: `${c}-kurs` })),
                  ]}
                />
                <CustomSelect
                  value={filterDirection}
                  onChange={setFilterDirection}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs sm:w-auto"
                  options={[
                    { value: 'all', label: 'Barcha yo\'nalishlar' },
                    ...directionOptions,
                  ]}
                />
                {filtersActive && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-white/10"
                  >
                    <X size={12} /> Saralashni tozalash
                  </button>
                )}
              </div>

              {activeTab === 'students' ? (
                <PersonList
                  people={filteredStudents}
                  emptyLabel="Hech qanday talaba topilmadi"
                  onToggleCaptain={allows('captains.manage') ? handleToggleCaptain : undefined}
                />
              ) : (
                <PersonList
                  people={filteredCaptains}
                  emptyLabel="Bu fakultetda hali sardor tayinlanmagan"
                  onToggleCaptain={allows('captains.manage') ? handleToggleCaptain : undefined}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="elonlar"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              <SectionHeading
                title="Fakultet E'lonlari"
                description={`Faqat ${genderLabel.toLowerCase()} talabalarga ko'rinadigan xabarnomalar`}
                action={
                  allows('council.announcements') && (
                    <button
                      onClick={() => setNewElonOpen(true)}
                      className={`flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition-all duration-300 sm:w-auto ${t.gradient} hover:brightness-110`}
                    >
                      <Plus size={16} />
                      Yangi E&apos;lon
                    </button>
                  )
                }
              />

              {elonlar.length > 0 ? (
                <motion.div variants={listStagger} initial="hidden" animate="show" className={`${glassCard()} divide-y divide-white/5`}>
                  {elonlar.map((elon) => {
                    const style = ELON_TYPE_STYLE[elon.type]
                    return (
                      <motion.div variants={rowIn} key={elon.id} className="flex items-start gap-3 p-4">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${style.badge}`}>
                              {elon.type}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                              <Clock size={10} /> {new Date(elon.created_at).toLocaleDateString('uz-UZ')}
                            </span>
                          </div>
                          <h4 className="truncate text-sm font-bold text-white">{elon.title}</h4>
                          <p className="text-xs leading-relaxed text-slate-400">{elon.text}</p>
                        </div>
                        {allows('council.announcements') && (
                          <button
                            onClick={() => handleDeleteElon(elon.id)}
                            title="O'chirish"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:border-rose-500/25 hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </motion.div>
                    )
                  })}
                </motion.div>
              ) : (
                <EmptyState role="kengash" icon={Megaphone} title="Hozircha hech qanday e'lon chop etilmagan" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Announcement Modal */}
        <AnimatePresence>
          {newElonOpen && (
            <ModalShell
              role="kengash"
              icon={Megaphone}
              title="Yangi E'lon Chop Etish"
              description={`Ushbu e'lon butun fakultet ${genderLabel.toLowerCase()} talabalariga yuboriladi.`}
              onClose={() => setNewElonOpen(false)}
            >
              <form onSubmit={handleCreateElon} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Mavzu / Sarlavha</label>
                  <input
                    type="text"
                    required
                    value={newElonForm.title}
                    onChange={(e) => setNewElonForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition-all focus:border-indigo-500/50 outline-none text-sm"
                    placeholder="Masalan: Kengash yig'ilishi"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Turi / Toifa</label>
                  <CustomSelect
                    value={newElonForm.type}
                    onChange={(val) => setNewElonForm(prev => ({ ...prev, type: val as Elon['type'] }))}
                    options={[
                      { value: 'Yangilik', label: 'Yangilik' },
                      { value: 'Ogohlantirish', label: 'Ogohlantirish' },
                      { value: 'Muhim', label: 'Muhim' },
                      { value: 'Tadbir', label: 'Tadbir' },
                    ]}
                    className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">E&apos;lon Matni</label>
                  <textarea
                    required
                    rows={4}
                    value={newElonForm.text}
                    onChange={(e) => setNewElonForm(prev => ({ ...prev, text: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition-all focus:border-indigo-500/50 outline-none text-sm resize-none"
                    placeholder="E'lon tafsilotlarini batafsil kiriting..."
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setNewElonOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-wider transition-all"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex-1 py-3 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-55 ${t.gradient} hover:brightness-110`}
                  >
                    {isSubmitting ? 'Chop etilmoqda...' : 'Chop etish'}
                  </button>
                </div>
              </form>
            </ModalShell>
          )}
        </AnimatePresence>

        {/* Delete Announcement Confirm Modal */}
        <ConfirmModal
          isOpen={deleteElonModal.isOpen}
          title="E'lonni o'chirish"
          description="Ushbu e'lonni o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi."
          onClose={deleteElonModal.close}
          onConfirm={confirmDeleteElon}
          confirmText="O'chirish"
          confirmVariant="danger"
          isLoading={deleteElonModal.isLoading}
        />

        {/* Appoint / revoke floor captain (qavat sardori) modal — states the
            floor explicitly: captaincy always tracks the student's own
            residence floor (assigned_floor), never a floor picked separately,
            so this is a confirmation of that floor, not a choice of it. */}
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
            <div className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 p-3 text-[11px] leading-relaxed text-indigo-200">
              {captainModal.target.is_floor_captain ? (
                <>
                  Talaba <span className="font-black">{captainModal.target.assigned_floor}-qavat</span> sardorligidan
                  olib tashlanadi. Qavat <span className="font-black">sardorsiz qoladi</span> — kerak bo&apos;lsa
                  boshqa talabani tayinlang.
                </>
              ) : (
                <>
                  <span className="font-black">{captainModal.target.full_name}</span> o&apos;zi yashaydigan{' '}
                  <span className="font-black">{captainModal.target.assigned_floor}-qavat</span> sardori etib
                  tayinlanadi. Shu qavatda hozir sardor bo&apos;lsa, <span className="font-black">avtomatik
                  almashtiriladi</span> — bir qavatda bitta sardor bo&apos;ladi.
                </>
              )}
            </div>
          )}
        </ConfirmModal>

        {/* Room occupants (read-only) */}
        <AnimatePresence>
          {selectedRoom && (
            <ModalShell
              role="kengash"
              icon={DoorClosed}
              title={`${selectedRoom}-xona`}
              description={`${(occupantsByRoom.get(selectedRoom) ?? []).length} kishi yashaydi`}
              onClose={() => setSelectedRoom(null)}
            >
              {(occupantsByRoom.get(selectedRoom) ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Bu xona hozircha bo&apos;sh</p>
              ) : (
                <div className={`${glassCard()} -mx-2 divide-y divide-white/5`}>
                  {(occupantsByRoom.get(selectedRoom) ?? []).map((person) => (
                    <PersonRow key={person.id} person={person} />
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
