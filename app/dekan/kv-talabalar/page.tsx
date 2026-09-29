'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Clock,
  Copy,
  Home,
  IdCard,
  Info,
  Mail,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { apiRequest } from '@/lib/api-client'
import { Skel } from '@/components/dekan/Skeletons'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI, statusChip } from '@/lib/dekan-ui'
import { directionLabel } from '@/lib/directions'
import { genderAccent, genderLabel, normalizeGender } from '@/lib/gender'

type KvTalaba = {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  gender: string | null
  direction: string | null
  course: number | null
  group: string | null
  hemis_student_id: string | null
  status: string
  created_at: string
}

const DAY = 86_400_000

function initials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0] ?? '').slice(0, 2).join('').toUpperCase()
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('uz-UZ')
}

function timeAgo(value: string) {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return ''
  const days = Math.floor((Date.now() - time) / DAY)
  if (days <= 0) return 'bugun'
  if (days === 1) return 'kecha'
  if (days < 30) return `${days} kun oldin`
  const months = Math.floor(days / 30)
  return months < 12 ? `${months} oy oldin` : `${Math.floor(months / 12)} yil oldin`
}

// KV-talaba (off-campus student) directory. These students register
// themselves and are active immediately — there is no approval step. This is
// its own page, not a folder on /dekan/talabalar: KV students never live in
// the dorm, so they must not mix with room assignment, occupancy or the
// dorm's student lists.
export default function KvTalabalarPage() {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const ui = dekanUI(isLight)

  const [students, setStudents] = useState<KvTalaba[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [course, setCourse] = useState<number | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const data = await apiRequest<{ ok: true; pending: KvTalaba[]; active: KvTalaba[] }>('/api/dekan/kv-talabalar')
      // Registration is instant, so `pending` is normally empty; merge it in
      // anyway so an older row is never hidden.
      setStudents([...data.pending, ...data.active].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ))
    } catch {
      setLoadFailed(true)
      toast.error("Ro'yxatni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const copy = (text: string, label: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => toast.success(`${label} nusxalandi`),
      () => toast.error("Nusxalab bo'lmadi"),
    )
  }

  const courses = useMemo(
    () => [...new Set(students.map((s) => s.course).filter((c): c is number => typeof c === 'number'))].sort(),
    [students],
  )
  const list = useMemo(() => {
    const query = search.trim().toLowerCase()
    return students.filter((student) => {
      if (course !== 'all' && student.course !== course) return false
      if (!query) return true
      return [student.full_name, student.email, student.phone_number, student.hemis_student_id, student.group]
        .some((value) => (value ?? '').toLowerCase().includes(query))
    })
  }, [students, search, course])
  const filtering = search.trim() !== '' || course !== 'all'

  const info = statusChip('info', isLight)
  const good = statusChip('success', isLight)

  const femaleCount = students.filter((s) => normalizeGender(s.gender) === 'female').length
  const maleCount = students.filter((s) => normalizeGender(s.gender) === 'male').length
  const share = (count: number) => `${students.length ? Math.round((count / students.length) * 100) : 0}% ulushi`
  const stats = [
    { title: 'Jami KV-talabalar', value: students.length, hint: "Kvartirada turadigan, ro'yxatdan o'tganlar", icon: Users },
    { title: 'Qizlar', value: femaleCount, hint: share(femaleCount), icon: UserRound },
    { title: "O'g'illar", value: maleCount, hint: share(maleCount), icon: UserRound },
  ]

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(255,255,255,0.12),transparent_45%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
              <Home size={11} /> Kvartirada turadiganlar
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">KV-talabalar</h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-indigo-100 sm:text-sm">
              Ijarada yoki kvartirada turadigan va o&apos;zi ro&apos;yxatdan o&apos;tgan talabalar. Ular yotoqxonaga joylashtirilmaydi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-xs font-bold text-indigo-700 shadow-lg shadow-black/10 transition-transform hover:bg-white active:scale-95 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Yangilash
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((card) => (
          <div key={card.title} className={`relative overflow-hidden rounded-2xl border p-5 ${ui.card}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${ui.muted}`}>{card.title}</p>
                {loading ? (
                  <Skel className="mt-3 h-8 w-14" />
                ) : (
                  <p className={`mt-2 text-3xl font-bold leading-none tracking-tight ${ui.strong}`}>{card.value}</p>
                )}
              </div>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ui.accentTile}`}>
                <card.icon size={20} strokeWidth={2.2} />
              </div>
            </div>
            <p className={`mt-4 text-[11px] font-medium ${ui.faint}`}>{card.hint}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="relative w-full sm:max-w-sm">
          <Search size={15} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${ui.faint}`} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ism, email, telefon yoki HEMIS..."
            className={`w-full rounded-xl border py-2.5 pl-9 pr-9 text-xs font-medium ${ui.input} ${ui.ring}`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Qidiruvni tozalash"
              className={`no-shelf absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 ${ui.faint} hover:text-slate-700 dark:hover:text-slate-200`}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {courses.length > 1 && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {(['all', ...courses] as const).map((value) => {
              const selected = course === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCourse(value)}
                  className={`no-shelf shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors ${ui.ring} ${
                    selected
                      ? isLight ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
                      : `${ui.inset} ${ui.muted}`
                  }`}
                >
                  {value === 'all' ? 'Barcha kurslar' : `${value}-kurs`}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`flex items-center gap-4 rounded-2xl border p-5 ${ui.card}`}>
              <Skel className="h-12 w-12 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skel className="h-4 w-1/2" />
                <Skel className="h-3 w-2/3" />
                <Skel className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : loadFailed ? (
        <div className={`flex flex-col items-center rounded-3xl border px-6 py-14 text-center ${ui.card}`}>
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${statusChip('danger', isLight).chip}`}>
            <X size={24} />
          </div>
          <h3 className={`mt-4 text-sm font-bold ${ui.strong}`}>Ro&apos;yxat yuklanmadi</h3>
          <p className={`mt-1 max-w-xs text-xs ${ui.muted}`}>Internetni tekshirib, qayta urinib ko&apos;ring.</p>
          <button type="button" onClick={() => void load()} className={`mt-5 rounded-xl px-4 py-2.5 text-xs font-bold ${ui.accentSolid}`}>
            Qayta urinish
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className={`flex flex-col items-center rounded-3xl border px-6 py-14 text-center ${ui.card}`}>
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
            {filtering ? <Search size={24} /> : <Home size={24} />}
          </div>
          <h3 className={`mt-4 text-sm font-bold ${ui.strong}`}>
            {filtering ? 'Hech narsa topilmadi' : "Hali KV-talaba yo'q"}
          </h3>
          <p className={`mt-1 max-w-sm text-xs leading-relaxed ${ui.muted}`}>
            {filtering
              ? "Qidiruv yoki kurs filtrini o'zgartirib ko'ring."
              : "Talaba kvartirada turishini tanlab ro'yxatdan o'tganda, shu yerda paydo bo'ladi."}
          </p>
          {filtering && (
            <button
              type="button"
              onClick={() => { setSearch(''); setCourse('all') }}
              className={`mt-5 rounded-xl px-4 py-2.5 text-xs font-bold ${ui.btnGhost}`}
            >
              Filtrni tozalash
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((student) => {
            const accent = genderAccent(student.gender)
            return (
              <li key={student.id} className={`rounded-2xl border p-4 sm:p-5 ${ui.card} ${ui.hoverLift}`}>
                <div className="flex min-w-0 gap-3.5">
                  <div className="relative shrink-0">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${ui.accentTileSoft}`}>
                      {initials(student.full_name)}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ${isLight ? 'ring-white' : 'ring-slate-900'} ${accent.dot}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <h3 className={`text-sm font-bold ${ui.strong}`}>{student.full_name}</h3>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${good.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${good.dot}`} />
                        Kvartirada turadi
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[
                        directionLabel(student.direction) || null,
                        student.course ? `${student.course}-kurs` : null,
                        student.group ? `Guruh ${student.group}` : null,
                        genderLabel(student.gender),
                      ].filter(Boolean).map((chip) => (
                        <span key={chip} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${info.chip}`}>{chip}</span>
                      ))}
                    </div>

                    <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
                      <div className={`flex min-w-0 items-center gap-2 ${ui.body}`}>
                        <Mail size={13} className={`shrink-0 ${ui.faint}`} />
                        <a href={`mailto:${student.email}`} className="truncate hover:underline">{student.email}</a>
                        <button
                          type="button"
                          onClick={() => copy(student.email, 'Email')}
                          aria-label="Emailni nusxalash"
                          className={`no-shelf shrink-0 rounded p-1 ${ui.faint} transition-colors hover:text-indigo-500`}
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      {student.phone_number && (
                        <div className={`flex min-w-0 items-center gap-2 ${ui.body}`}>
                          <Phone size={13} className={`shrink-0 ${ui.faint}`} />
                          <a href={`tel:${student.phone_number}`} className="truncate hover:underline">{student.phone_number}</a>
                          <button
                            type="button"
                            onClick={() => copy(student.phone_number ?? '', 'Telefon')}
                            aria-label="Telefonni nusxalash"
                            className={`no-shelf shrink-0 rounded p-1 ${ui.faint} transition-colors hover:text-indigo-500`}
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      )}
                      {student.hemis_student_id && (
                        <div className={`flex min-w-0 items-center gap-2 ${ui.body}`}>
                          <IdCard size={13} className={`shrink-0 ${ui.faint}`} />
                          <span className="truncate">HEMIS: <span className="font-semibold tabular-nums">{student.hemis_student_id}</span></span>
                        </div>
                      )}
                      <div className={`flex items-center gap-2 ${ui.muted}`}>
                        <Clock size={13} className={`shrink-0 ${ui.faint}`} />
                        <span>{formatDate(student.created_at)} · {timeAgo(student.created_at)}</span>
                      </div>
                    </dl>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-xs leading-relaxed ${info.chip}`}>
        <Info size={15} className="mt-0.5 shrink-0" />
        <span>
          KV-talabalar yotoqxona hisobiga kirmaydi: ular xona ro&apos;yxatida, yotoqxona bandligida va to&apos;lovlar hisobida ko&apos;rinmaydi.
          Yotoqxonada yashaydigan talaba bo&apos;lsa, uni yo&apos;llanma orqali ro&apos;yxatdan o&apos;tkazing.
        </span>
      </div>
    </div>
  )
}
