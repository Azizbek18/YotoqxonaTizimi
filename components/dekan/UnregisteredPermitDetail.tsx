'use client'

import type { ComponentType, ReactNode } from 'react'
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Edit2,
  GraduationCap,
  Home,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'
import { permitFacultyLabel } from '@/lib/faculties'
import { directionLabel } from '@/lib/directions'
import { genderAccent, genderLabel } from '@/lib/gender'
import type { UnregisteredPermitRow } from '@/features/faculty-students/types'

type Item = { icon: ComponentType<{ size?: number; className?: string }>; label: string; value?: ReactNode }

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('uz-UZ')
}

const APPLICATION_TYPE: Record<string, string> = {
  yollanma: "Yo'llanma",
  imtiyozli: 'Imtiyozli',
}

const AI_REVIEW: Record<string, string> = {
  passed: "AI tekshiruvidan o'tgan",
  manual: "Qo'lda tekshirilgan",
}

/**
 * Detail panel for an approved yo'llanma holder who has not registered yet.
 * Mirrors the registered-student card's tiles, but shows the application's own
 * data (passport, JSHSHIR, region, relative's phone …) with full, un-truncated
 * values so the dekan can read and verify them.
 */
export default function UnregisteredPermitDetail({
  row,
  dormLabel,
  readOnly,
  onBack,
  onChangeEmail,
}: {
  row: UnregisteredPermitRow
  dormLabel: string
  readOnly: boolean
  onBack: () => void
  onChangeEmail: () => void
}) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)
  const accent = genderAccent(row.gender)
  const initials = row.full_name.trim().split(/\s+/).map((part) => part[0] ?? '').slice(0, 2).join('').toUpperCase()

  const sections: { title: string; subtitle: string; icon: Item['icon']; items: Item[] }[] = [
    {
      title: 'Shaxsiy ma\'lumotlar',
      subtitle: 'Ariza topshirishda kiritilgan ma\'lumotlar',
      icon: UserRound,
      items: [
        { icon: UserRound, label: 'Jinsi', value: row.gender ? genderLabel(row.gender) : undefined },
        { icon: Phone, label: 'Telefon', value: row.phone },
        { icon: Phone, label: 'Qarindosh telefoni', value: row.relative_phone },
        { icon: Mail, label: 'Email', value: row.email },
        { icon: MapPin, label: 'Hudud', value: [row.origin_region, row.origin_country].filter(Boolean).join(', ') || undefined },
        { icon: ShieldCheck, label: 'Passport seriya', value: row.passport_series },
        { icon: ShieldCheck, label: 'JSHSHIR', value: row.jshshir },
      ],
    },
    {
      title: "Ta'lim",
      subtitle: "Fakultet, yo'nalish va ta'lim turi",
      icon: GraduationCap,
      items: [
        { icon: GraduationCap, label: 'Fakultet', value: permitFacultyLabel(row.faculty) || undefined },
        { icon: GraduationCap, label: "Yo'nalish", value: directionLabel(row.direction) || undefined },
        { icon: ShieldCheck, label: 'Kurs', value: row.course ? `${row.course}-kurs` : undefined },
        { icon: ShieldCheck, label: "Ta'lim turi", value: row.study_type },
      ],
    },
    {
      title: 'Yotoqxona',
      subtitle: row.room_number ? "Unga xona ajratilgan, ro'yxatdan o'tgach shu xonaga joylashadi" : 'Hali xona ajratilmagan',
      icon: Home,
      items: [
        { icon: Home, label: 'Yotoqxona', value: dormLabel || undefined },
        { icon: Home, label: 'Blok', value: row.block },
        { icon: BedDouble, label: 'Qavat', value: row.assigned_floor ? `${row.assigned_floor}-qavat` : undefined },
        { icon: Home, label: 'Xona', value: row.room_number },
      ],
    },
    {
      title: 'Ariza',
      subtitle: 'Yo\'llanma holati',
      icon: CalendarDays,
      items: [
        { icon: ShieldCheck, label: 'Ariza turi', value: row.application_type ? APPLICATION_TYPE[row.application_type] ?? row.application_type : undefined },
        { icon: CalendarDays, label: 'Ariza sanasi', value: formatDate(row.created_at) },
        { icon: ShieldCheck, label: 'AI tekshiruvi', value: row.ai_review ? AI_REVIEW[row.ai_review] ?? row.ai_review : undefined },
      ],
    },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex shrink-0 items-start gap-3.5 border-b p-4 ${
        isLight ? 'border-slate-200/80 bg-white shadow-xs' : 'border-slate-800 bg-slate-900'
      }`}>
        <button
          type="button"
          onClick={onBack}
          className={`no-shelf -ml-1 rounded-xl p-2 transition-colors md:hidden ${
            isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-800'
          }`}
          aria-label="Ro'yxatga qaytish"
        >
          <ArrowLeft size={18} />
        </button>
        <div className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border-2 text-sm font-black ${
          isLight ? 'border-slate-200 bg-indigo-50 text-indigo-600' : 'border-slate-700 bg-indigo-950/60 text-indigo-300'
        }`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`break-words text-base font-black leading-snug tracking-tight sm:text-lg ${ui.strong}`}>{row.full_name}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
              isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/15 text-amber-300'
            }`}>Ro&apos;yxatdan o&apos;tmagan</span>
            {row.gender && (
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${accent.text} ${isLight ? accent.badgeBgLight : accent.badgeBg}`}>
                {genderLabel(row.gender)}
              </span>
            )}
            {row.room_number ? (
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/15 text-emerald-300'
              }`}>{dormLabel ? `${dormLabel} · ` : ''}{row.room_number}-xona</span>
            ) : (
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-700 text-slate-300'
              }`}>Xonasiz</span>
            )}
          </div>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={onChangeEmail}
            className={`no-shelf inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${ui.accentSoft}`}
          >
            <Edit2 size={13} /> Emailni o&apos;zgartirish
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4">
        <div className={`rounded-xl border px-3 py-2.5 text-[11px] leading-snug ${
          isLight ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        }`}>
          Yo&apos;llanmasi tasdiqlangan, lekin sayt orqali hali ro&apos;yxatdan o&apos;tmagan. Ro&apos;yxatdan o&apos;tgach
          profil, hujjatlar va to&apos;lov ma&apos;lumotlari shu yerdagi talaba kartasida paydo bo&apos;ladi.
        </div>

        {sections.map((section) => {
          const SectionIcon = section.icon
          const items = section.items.filter((item) => item.value !== undefined && item.value !== null && item.value !== '')
          return (
            <div key={section.title} className={`rounded-2xl border p-4 ${
              isLight ? 'border-slate-200/80 bg-white shadow-xs' : 'border-slate-800 bg-slate-900'
            }`}>
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-lg bg-indigo-500/10 p-1.5 text-indigo-600 dark:text-indigo-400">
                  <SectionIcon size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>{section.title}</h3>
                  <p className={`text-[10px] ${ui.muted}`}>{section.subtitle}</p>
                </div>
              </div>
              {items.length === 0 ? (
                <p className={`text-xs ${ui.faint}`}>Ma&apos;lumot kiritilmagan</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={item.label}
                        className={`flex items-start gap-3 rounded-xl border p-2.5 ${
                          isLight ? 'border-slate-100 bg-slate-50/70' : 'border-slate-800 bg-slate-800/40'
                        }`}
                      >
                        <div className={`shrink-0 rounded-lg p-2 ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-800/40 text-slate-400'}`}>
                          <Icon size={16} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                          <p className={`mt-0.5 break-words text-xs font-bold ${ui.strong}`}>{item.value}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
