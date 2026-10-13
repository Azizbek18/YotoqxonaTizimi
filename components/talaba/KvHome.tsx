'use client'

import Link from 'next/link'
import { GraduationCap, Home, Megaphone, ChevronRight, Phone } from 'lucide-react'
import ForeignDocsCard from '@/components/talaba/foreign-docs/ForeignDocsCard'
import { directionLabel } from '@/lib/directions'
import { permitFacultyLabel } from '@/lib/faculties'

type KvProfile = {
  full_name: string
  faculty?: string
  direction?: string
  course?: string | number
  group?: string | number
  phone_number?: string
  country?: string | null
}

// Kvartirada turuvchi (KV) talabaning bosh sahifasi. Yotoqxona modullari
// (xona, navbatchilik, to'lov, yo'qlama, ariza) unga tegishli emas — asosiysi
// viza (faqat xorijiy fuqaro) va propiska muddati nazorati.
export default function KvHome({ profile, isLight }: { profile: KvProfile | null; isLight: boolean }) {
  const card = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.03]'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'
  const strong = isLight ? 'text-slate-900' : 'text-white'

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className={`rounded-3xl border p-4 sm:p-5 ${card}`}>
        <div className="flex items-center gap-3">
          <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-300'}`}>
            <Home size={20} />
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-emerald-600' : 'text-emerald-300'}`}>Kvartirada turaman</p>
            <h1 className={`truncate text-base font-extrabold ${strong}`}>{profile?.full_name ?? 'Talaba'}</h1>
          </div>
        </div>
        {profile && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div className="col-span-2">
              <dt className={`text-[10px] font-semibold uppercase ${muted}`}>Fakultet</dt>
              <dd className={`font-bold ${strong}`}>{permitFacultyLabel(profile.faculty ?? '') || profile.faculty || '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className={`text-[10px] font-semibold uppercase ${muted}`}>Yo‘nalish</dt>
              <dd className={`font-bold ${strong}`}>{directionLabel(profile.direction) || '—'}</dd>
            </div>
            <div>
              <dt className={`text-[10px] font-semibold uppercase ${muted}`}>Kurs / guruh</dt>
              <dd className={`flex items-center gap-1 font-bold ${strong}`}>
                <GraduationCap size={13} className={muted} />
                {profile.course ?? '—'}-kurs{profile.group ? ` · ${profile.group}` : ''}
              </dd>
            </div>
            {profile.phone_number && (
              <div>
                <dt className={`text-[10px] font-semibold uppercase ${muted}`}>Telefon</dt>
                <dd className={`flex items-center gap-1 font-bold ${strong}`}>
                  <Phone size={13} className={muted} /> {profile.phone_number}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <ForeignDocsCard mode={profile?.country ? 'foreign' : 'registration'} isLight={isLight} />

      <Link
        href="/talaba/elonlar"
        data-student-button="plain"
        className={`flex items-center justify-between rounded-2xl border p-4 transition-colors ${card} ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.06]'}`}
      >
        <span className={`flex items-center gap-2 text-sm font-bold ${strong}`}>
          <Megaphone size={16} className={isLight ? 'text-blue-600' : 'text-blue-300'} /> E‘lonlar
        </span>
        <ChevronRight size={16} className={muted} />
      </Link>
    </div>
  )
}
