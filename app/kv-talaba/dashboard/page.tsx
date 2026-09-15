'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Home, LogOut, Megaphone, Phone, Mail, GraduationCap, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { fetchStudentProfile } from '@/features/profile/client/api'
import { fetchStudentAnnouncements } from '@/features/announcements/client/api'
import type { StudentProfile } from '@/features/profile/types'
import type { StudentAnnouncement } from '@/features/announcements/types'
import { directionLabel } from '@/lib/directions'
import { permitFacultyLabel } from '@/lib/faculties'
import { genderLabel } from '@/lib/gender'

const TYPE_STYLE: Record<string, string> = {
  Muhim: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  Tadbir: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Yangilik: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Ogohlantirish: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

// KV-talaba's own panel — a talaba who lives off-campus, so none of the
// dorm modules (room, sardor, cleaning duty, attendance, payments) apply.
// v1 scope, deliberately minimal: their own profile + faculty-wide
// announcements. See plans/harmonic-roaming-quokka.md for what's next.
export default function KvTalabaDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [elonlar, setElonlar] = useState<StudentAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const payload = await fetchStudentProfile()
        if (cancelled) return
        if (!payload.profile.is_off_campus) {
          // Not a KV-talaba (e.g. a dorm student who typed this URL by
          // hand) — send them to the panel that's actually theirs.
          setDenied(true)
          router.replace('/talaba/dashboard')
          return
        }
        setProfile(payload.profile)
        const announcements = await fetchStudentAnnouncements()
        if (!cancelled) setElonlar(announcements.elonlar)
      } catch {
        if (!cancelled) toast.error("Ma'lumotlarni yuklab bo'lmadi")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading || denied) {
    return (
      <div className="flex min-h-screen items-center justify-center text-emerald-200/60 text-sm">
        Yuklanmoqda...
      </div>
    )
  }
  if (!profile) return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            <Home size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">KV-talaba</p>
            <h1 className="text-lg font-black">{profile.full_name}</h1>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10"
        >
          <LogOut size={13} /> Chiqish
        </button>
      </div>

      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-emerald-400/80">Profil</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Fakultet</dt>
            <dd className="font-bold">{permitFacultyLabel(profile.faculty ?? '') || profile.faculty || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Yo&apos;nalish</dt>
            <dd className="font-bold">{directionLabel(profile.direction) || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Kurs / Guruh</dt>
            <dd className="font-bold flex items-center gap-1"><GraduationCap size={13} className="text-slate-500" /> {profile.course ?? '—'}-kurs{profile.group ? ` · ${profile.group}` : ''}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Jinsi</dt>
            <dd className="font-bold">{genderLabel(profile.gender)}</dd>
          </div>
          <div className="col-span-2 flex flex-wrap gap-4 pt-1 border-t border-white/5">
            {profile.phone_number && (
              <a href={`tel:${profile.phone_number}`} className="flex items-center gap-1.5 text-xs text-slate-300"><Phone size={13} /> {profile.phone_number}</a>
            )}
            <a href={`mailto:${profile.email}`} className="flex items-center gap-1.5 text-xs text-slate-300"><Mail size={13} /> {profile.email}</a>
          </div>
        </dl>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400/80">
          <Megaphone size={14} /> E&apos;lonlar
        </h2>
        {elonlar.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center text-xs text-slate-500">
            Hozircha e&apos;lon yo&apos;q.
          </div>
        ) : (
          <div className="space-y-3">
            {elonlar.map((elon) => (
              <div key={elon.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${TYPE_STYLE[elon.type] ?? 'bg-white/10 text-slate-300 border-white/10'}`}>
                    {elon.type}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock size={11} /> {new Date(elon.published_at ?? elon.created_at).toLocaleDateString('uz-UZ')}
                  </span>
                </div>
                <h3 className="text-sm font-bold">{elon.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{elon.text}</p>
                <p className="mt-2 text-[10px] text-slate-500">{elon.author_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
