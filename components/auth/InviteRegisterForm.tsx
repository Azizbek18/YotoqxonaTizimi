'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { KeyRound, User, Mail, Phone, GraduationCap, Lock, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import CustomSelect from '@/components/ui/CustomSelect'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getPasswordPolicyError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/password-policy'
import { PERMIT_FACULTIES } from '@/lib/faculties'

const COPY = {
  xodim: {
    eyebrow: 'Xodim ro‘yxati',
    title: "Taklif kodi bilan ro'yxatdan o'tish",
    subtitle: 'Fakultet va rol taklif kodidan olinadi',
  },
  dekan: {
    eyebrow: 'Fakultet dekani',
    title: 'Dekan sifatida ro‘yxatdan o‘tish',
    subtitle: "Fakultetingizni tanlang — ro'yxatdan o'tgach fakultetingiz boshqaruv paneli ochiladi",
  },
} as const

const FACULTY_OPTIONS = PERMIT_FACULTIES.map((f) => ({ value: f.value, label: f.label }))

// Staff registration via an invite code.
//  - 'xodim': tarbiyachi codes a dekan issues; the code carries the faculty.
//  - 'dekan': one shared code for every faculty's dean; the dean picks their
//    own faculty here, and the server enforces one active dekan per faculty.
export default function InviteRegisterForm({
  initialCode = '',
  audience = 'xodim',
}: {
  initialCode?: string
  audience?: 'xodim' | 'dekan'
}) {
  const copy = COPY[audience]
  const router = useRouter()
  const isLight = useThemeStore((s) => s.theme === 'light')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [faculty, setFaculty] = useState('')
  const [inviteCode, setInviteCode] = useState(initialCode)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const isDekan = audience === 'dekan'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullName || !email || !inviteCode || !password || !confirmPassword || (isDekan && (!phone || !faculty))) {
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
      const response = await fetch('/api/staff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phone, faculty, password, confirmPassword, inviteCode }),
      })
      const result: { ok: boolean; error?: string } = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Ro'yxatdan o'tishda xatolik")
      }

      toast.success(
        isDekan
          ? "Ro'yxatdan o'tdingiz — endi tizimga kiring, fakultet paneli ochiladi"
          : "Muvaffaqiyatli ro'yxatdan o'tdingiz",
      )
      setTimeout(() => router.push('/login'), 1200)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Nomaʼlum xatolik')
    } finally {
      setLoading(false)
    }
  }

  const shell = isLight
    ? 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900'
    : 'bg-[#020617] text-white'
  const card = isLight
    ? 'bg-white/85 border-slate-200 shadow-2xl shadow-slate-300/40'
    : 'bg-[#0b1120]/85 border-white/10 shadow-2xl shadow-black/40'
  const fieldWrap = isLight
    ? 'border-slate-200 bg-white/70 focus-within:border-indigo-400 focus-within:bg-white'
    : 'border-white/10 bg-white/5 focus-within:border-indigo-400/60 focus-within:bg-white/[0.07]'
  const inputCls = `w-full bg-transparent text-sm outline-none placeholder:${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const iconCls = isLight ? 'text-slate-400' : 'text-slate-500'
  const chip = isLight ? 'bg-white/80 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-[#0f172a]/80 border-white/5 text-slate-400 hover:bg-white/5'

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.12 + i * 0.05, duration: 0.4, ease: 'easeOut' as const },
  })

  return (
    <div className={`relative min-h-screen overflow-hidden flex items-center justify-center p-4 sm:p-6 ${shell}`}>
      <div className="pointer-events-none absolute -top-[20%] -left-[15%] h-[55%] w-[55%] rounded-full bg-indigo-500/10 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-[20%] -right-[15%] h-[55%] w-[55%] rounded-full bg-blue-500/10 blur-[130px]" />

      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      <div className="absolute left-4 top-4 z-20">
        <Link
          href="/login"
          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all ${chip}`}
        >
          <ArrowLeft size={13} /> Kirish
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`relative z-10 w-full max-w-md rounded-3xl border p-6 backdrop-blur-2xl sm:p-8 ${card}`}
      >
        <motion.div {...stagger(0)} className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
            <ShieldCheck size={26} />
          </div>
          <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400">{copy.eyebrow}</p>
          <h1 className="text-xl font-black leading-tight sm:text-2xl">{copy.title}</h1>
          <p className={`mx-auto mt-2 max-w-xs text-xs leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{copy.subtitle}</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <motion.div {...stagger(1)} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${fieldWrap}`}>
            <User size={16} className={iconCls} />
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="F.I.Sh" required />
          </motion.div>

          <motion.div {...stagger(2)} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${fieldWrap}`}>
            <Mail size={16} className={iconCls} />
            <input
              type="email" name="email" autoComplete="email" maxLength={254}
              value={email} onChange={(e) => setEmail(e.target.value)}
              className={inputCls} placeholder="Email" required
            />
          </motion.div>

          <motion.div {...stagger(3)} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${fieldWrap}`}>
            <Phone size={16} className={iconCls} />
            <input
              value={phone} onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
              placeholder={isDekan ? 'Telefon' : 'Telefon (ixtiyoriy)'}
              required={isDekan}
            />
          </motion.div>

          {isDekan && (
            <motion.div {...stagger(4)} className="space-y-1.5">
              <span className={`flex items-center gap-1.5 pl-1 text-[10px] font-bold uppercase tracking-wider ${iconCls}`}>
                <GraduationCap size={12} /> Fakultet
              </span>
              <CustomSelect
                value={faculty}
                onChange={setFaculty}
                options={FACULTY_OPTIONS}
                placeholder="Fakultetingizni tanlang"
                className={`w-full rounded-xl border px-3.5 py-3 text-sm ${fieldWrap}`}
              />
            </motion.div>
          )}

          <motion.div {...stagger(isDekan ? 5 : 4)} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${fieldWrap}`}>
            <KeyRound size={16} className={iconCls} />
            <input
              value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
              className={`${inputCls} font-mono uppercase tracking-[0.25em]`}
              placeholder="XXXX-XXXX-XXXX" autoComplete="off" required
            />
          </motion.div>

          <motion.div {...stagger(isDekan ? 6 : 5)} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${fieldWrap}`}>
            <Lock size={16} className={iconCls} />
            <input
              type="password" name="new-password" autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className={inputCls} placeholder="Parol" required
            />
          </motion.div>

          <motion.div {...stagger(isDekan ? 7 : 6)} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${fieldWrap}`}>
            <Lock size={16} className={iconCls} />
            <input
              type="password" name="confirm-password" autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH}
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputCls} placeholder="Parolni tasdiqlang" required
            />
          </motion.div>

          <motion.button
            {...stagger(isDekan ? 8 : 7)}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.015 }}
            whileTap={{ scale: loading ? 1 : 0.985 }}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 px-4 py-3.5 text-xs font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-indigo-600/25 transition-all hover:from-indigo-500 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            {loading ? 'Yuborilmoqda…' : "Ro'yxatdan o'tish"}
          </motion.button>
        </form>

        <p className={`mt-6 text-center text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Akkauntingiz bormi?{' '}
          <Link href="/login" className="font-bold text-indigo-400 hover:underline">Kirish sahifasi</Link>
        </p>
      </motion.div>
    </div>
  )
}
