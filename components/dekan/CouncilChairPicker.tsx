'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, UserCheck, Loader2 } from 'lucide-react'
import { dekanUI } from '@/lib/dekan-ui'
import { normalizeGender, genderLabel, type GenderValue } from '@/lib/gender'
import { fetchFacultyStudents } from '@/features/faculty-students/client/api'
import type { StudentProfileRow } from '@/features/faculty-students/types'

export type CouncilChairPick = { fullName: string; phone: string }

// Snapshot picker: choosing a student just copies their name + phone into the
// "Talaba kengashi raisi" contact fields on the Sozlamalar page. It never
// persists a link to the student account — the manual inputs stay the source
// of truth, this is only a shortcut so the dekan doesn't retype.
export default function CouncilChairPicker({
  open,
  gender,
  isLight,
  onClose,
  onSelect,
}: {
  open: boolean
  gender: GenderValue
  isLight: boolean
  onClose: () => void
  onSelect: (pick: CouncilChairPick) => void
}) {
  const ui = dekanUI(isLight)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // Fetched once, then reused across re-opens (both genders come from the
  // same faculty roster).
  const cacheRef = useRef<StudentProfileRow[] | null>(null)
  const [students, setStudents] = useState<StudentProfileRow[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    if (cacheRef.current) {
      setStudents(cacheRef.current)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchFacultyStudents('all')
      .then((rows) => {
        if (cancelled) return
        cacheRef.current = rows
        setStudents(rows)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Talabalar ro'yxatini yuklab bo'lmadi")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const genderMatched = useMemo(
    () => students.filter((s) => normalizeGender(s.gender) === gender),
    [students, gender],
  )

  const unknownGenderCount = useMemo(
    () => students.filter((s) => normalizeGender(s.gender) === null).length,
    [students],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? genderMatched.filter(
          (s) =>
            s.full_name.toLowerCase().includes(q) ||
            (s.phone_number ?? '').toLowerCase().includes(q),
        )
      : genderMatched
    return [...base].sort((a, b) => a.full_name.localeCompare(b.full_name, 'uz'))
  }, [genderMatched, query])

  if (!mounted) return null

  const surface = isLight ? 'bg-white border-slate-200' : 'bg-[#0b1120] border-white/10'

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className={`relative z-50 flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border sm:rounded-3xl ${surface} max-h-[85vh]`}
          >
            <div className={`flex items-start justify-between gap-3 border-b p-4 sm:p-5 ${ui.border}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
                  <UserCheck size={18} />
                </span>
                <div>
                  <h2 className={`text-sm font-bold ${ui.strong}`}>Talabalardan tanlash</h2>
                  <p className={`text-[11px] ${ui.muted}`}>
                    {`Faqat ${genderLabel(gender).toLowerCase()} talabalar ko'rsatilmoqda`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`rounded-lg p-1.5 transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/5'}`}
                aria-label="Yopish"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5">
              <div className="relative">
                <Search size={15} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${ui.faint}`} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ism yoki telefon bo'yicha qidirish"
                  className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm transition-colors ${ui.input} ${ui.ring}`}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
              {loading ? (
                <div className={`flex items-center justify-center gap-2 py-12 text-sm ${ui.muted}`}>
                  <Loader2 size={16} className="animate-spin" />
                  Yuklanmoqda…
                </div>
              ) : error ? (
                <div className={`rounded-xl border p-4 text-xs ${ui.dangerSoft}`}>{error}</div>
              ) : filtered.length === 0 ? (
                <div className={`rounded-xl border p-4 text-center text-xs ${ui.inset} ${ui.muted}`}>
                  {genderMatched.length === 0
                    ? `Bu fakultetda jinsi "${genderLabel(gender).toLowerCase()}" deb belgilangan talaba topilmadi.`
                    : 'Qidiruvga mos talaba topilmadi.'}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {filtered.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect({ fullName: s.full_name, phone: s.phone_number ?? '' })
                          onClose()
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${ui.inset} ${isLight ? 'hover:border-indigo-300 hover:bg-indigo-50/60' : 'hover:border-indigo-500/40 hover:bg-indigo-500/10'}`}
                      >
                        <span className="min-w-0">
                          <span className={`block truncate text-sm font-semibold ${ui.strong}`}>{s.full_name}</span>
                          <span className={`block truncate text-[11px] ${ui.muted}`}>
                            {[
                              s.phone_number || 'telefon yo‘q',
                              s.course ? `${s.course}-kurs` : null,
                              s.room_number ? `${s.room_number}-xona` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <UserCheck size={15} className={ui.faint} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!loading && !error && unknownGenderCount > 0 && (
                <p className={`mt-3 text-[10px] leading-relaxed ${ui.faint}`}>
                  {unknownGenderCount} ta talabaning jinsi belgilanmagani uchun ro&apos;yxatga kirmadi — kerak bo&apos;lsa
                  ism va telefonni qo&apos;lda kiriting.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
