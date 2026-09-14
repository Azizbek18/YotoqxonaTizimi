'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Home, ArrowLeft, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPasswordPolicyError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/password-policy'
import { PERMIT_FACULTIES } from '@/lib/faculties'
import { directionsForFaculty } from '@/lib/directions'

const COURSES = [1, 2, 3, 4, 5, 6]

// KV-talaba (off-campus student) self-registration — deliberately its own
// standalone page, not a step in the /register wizard: that wizard's whole
// step machine assumes an approved permit_requests row exists somewhere,
// which a KV-talaba never has. No document upload here — just enough to
// identify the applicant and let a dekan sanity-check them (see
// hemisStudentId, the field a future HEMIS/OneID check will read instead).
export default function KvRoyxatdanOtish() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState('')
  const [faculty, setFaculty] = useState('')
  const [direction, setDirection] = useState('')
  const [course, setCourse] = useState('')
  const [group, setGroup] = useState('')
  const [hemisStudentId, setHemisStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const directionOptions = useMemo(() => directionsForFaculty(faculty), [faculty])

  const handleFacultyChange = (value: string) => {
    setFaculty(value)
    setDirection('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName || !email || !gender || !faculty || !direction || !course || !password || !confirmPassword) {
      toast.error("Majburiy maydonlarni to'ldiring")
      return
    }
    if (password !== confirmPassword) {
      toast.error('Parollar bir xil emas')
      return
    }
    const passwordError = getPasswordPolicyError(password)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/kv-talaba/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, email, phone, gender, faculty, direction,
          course: Number(course), group, hemisStudentId, password, confirmPassword,
        }),
      })
      const result: { ok: boolean; error?: string } = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Ro'yxatdan o'tishda xatolik")
      setSubmitted(true)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Noma'lum xatolik")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#020617] px-4 py-8 text-white flex items-center justify-center">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1120]/85 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-lg font-black">Arizangiz yuborildi</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Ma&apos;lumotlaringiz fakultet dekaniga yuborildi. Tasdiqlangach, shu email va parolingiz bilan tizimga kira olasiz.
          </p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 hover:underline">
            <ArrowLeft size={14} /> Bosh sahifaga qaytish
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1120]/85 p-6 shadow-2xl">
        <Link href="/ariza-yuborish" className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={14} /> Orqaga
        </Link>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
            <Home size={22} />
          </div>
          <h1 className="text-xl font-black">KV-talaba ro&apos;yxatdan o&apos;tishi</h1>
          <p className="mt-1 text-xs text-slate-400">Ijarada/kvartirada turadigan talabalar uchun — hujjat kerak emas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            placeholder="F.I.Sh"
            required
          />
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            placeholder="Email"
            required
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            placeholder="Telefon"
          />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            required
          >
            <option value="" disabled>Jinsingiz</option>
            <option value="male">O&apos;g&apos;il</option>
            <option value="female">Qiz</option>
          </select>
          <select
            value={faculty}
            onChange={(e) => handleFacultyChange(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            required
          >
            <option value="" disabled>Fakultetni tanlang</option>
            {PERMIT_FACULTIES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none disabled:opacity-50"
            required
            disabled={!faculty}
          >
            <option value="" disabled>Yo&apos;nalishni tanlang</option>
            {directionOptions.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
              required
            >
              <option value="" disabled>Kurs</option>
              {COURSES.map((c) => (
                <option key={c} value={c}>{c}-kurs</option>
              ))}
            </select>
            <input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
              placeholder="Guruh"
            />
          </div>
          <input
            value={hemisStudentId}
            onChange={(e) => setHemisStudentId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            placeholder="HEMIS talaba ID (ixtiyoriy)"
          />
          <input
            type="password"
            name="new-password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            placeholder="Parol"
            required
          />
          <input
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            placeholder="Parolni tasdiqlang"
            required
          />
          <button
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-60"
          >
            {loading ? 'Yuborilmoqda...' : "Ariza yuborish"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          Akkauntingiz bormi?{' '}
          <Link href="/login" className="text-emerald-400 hover:underline">
            Kirish sahifasi
          </Link>
        </p>
      </div>
    </main>
  )
}
