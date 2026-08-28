'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { KeyRound, User, Mail, Phone, GraduationCap, Users, Lock, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react'
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
    subtitle: 'F.I.Sh., telefon va jinsingizni kiriting — email va fakultet taklif kodidan olinadi',
  },
  dekan: {
    eyebrow: 'Fakultet dekani',
    title: 'Dekan sifatida ro‘yxatdan o‘tish',
    subtitle: "Fakultetingizni tanlang — ro'yxatdan o'tgach fakultetingiz boshqaruv paneli ochiladi",
  },
} as const

const FACULTY_OPTIONS = PERMIT_FACULTIES.map((f) => ({ value: f.value, label: f.label }))
const GENDER_OPTIONS = [
  { value: 'male', label: 'Erkak' },
  { value: 'female', label: 'Ayol' },
]

// Staff registration via an invite code. Shares the visual language of
// app/ruxsatnoma-yuborish — the animated "cyber-border" fields and glass
// "pass-card". `audience` swaps copy and which fields show:
//  - 'xodim': a tarbiyachi code a dekan issued. The code carries the faculty
//    AND the email, so the form only asks for name / phone / gender / password.
//  - 'dekan': one shared code for every faculty's dean; the dean enters their
//    own email and picks their faculty, and the server enforces one active
//    dekan per faculty.
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
  const [gender, setGender] = useState('')
  const [faculty, setFaculty] = useState('')
  const [inviteCode, setInviteCode] = useState(initialCode)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  const isDekan = audience === 'dekan'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !fullName || !inviteCode || !password || !confirmPassword || !phone
      || (isDekan && (!email || !faculty))
      || (!isDekan && !gender)
    ) {
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
        body: JSON.stringify({
          fullName,
          email: isDekan ? email : '',
          phone: `+998${phone}`,
          gender: isDekan ? '' : gender,
          faculty, password, confirmPassword, inviteCode,
        }),
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

  const chip = isLight
    ? 'bg-white/80 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
    : 'bg-[#0f172a]/80 border-white/5 text-slate-400 hover:bg-white/5'
  const inputText = isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'
  const labelCls = isLight ? 'text-slate-500' : 'text-slate-400'
  const idleIcon = isLight ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full bg-transparent text-sm outline-none ${inputText}`

  // Fields render in a fixed order; the stagger delay follows their position.
  let step = 0
  const stagger = () => {
    const i = step++
    return {
      initial: { opacity: 0, y: 14 },
      animate: { opacity: 1, y: 0 },
      transition: { delay: 0.15 + i * 0.055, duration: 0.45, ease: 'easeOut' as const },
    }
  }
  const wrapCls = (id: string) => `cyber-border ${focused === id ? 'focused' : ''}`
  const innerCls = 'cyber-input-inner flex items-center gap-3 px-3.5 py-3'
  const iconCls = (id: string) => `shrink-0 ${focused === id ? 'icon-pulse text-indigo-400' : idleIcon}`
  const on = (id: string) => ({ onFocus: () => setFocused(id), onBlur: () => setFocused(null) })

  return (
    <div className={`relative flex min-h-screen items-center justify-center overflow-hidden p-3 sm:p-4 ${isLight ? 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900' : 'bg-[#020617] text-white'}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .pass-card {
          backdrop-filter: blur(25px);
          border: 1.5px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.2), 0 15px 30px -10px rgba(0,0,0,0.3), 0 0 20px rgba(99,102,241,0.06);
          background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
        }
        .light .pass-card {
          border: 1.5px solid rgba(15,23,42,0.08);
          box-shadow: inset 0 1px 2px rgba(255,255,255,0.8), 0 10px 20px rgba(15,23,42,0.05), 0 0 15px rgba(99,102,241,0.03);
          background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%);
        }
        @keyframes sweep { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        .cyber-border {
          background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          padding: 1px; border-radius: 12px; transition: all 0.35s ease;
        }
        .light .cyber-border { background: linear-gradient(90deg, rgba(15,23,42,0.08), rgba(15,23,42,0.03)); }
        .cyber-border.focused {
          background: linear-gradient(90deg, #6366f1, #3b82f6, #ec4899, #6366f1);
          background-size: 200% 200%;
          animation: sweep 2s linear infinite;
          box-shadow: 0 0 12px rgba(99,102,241,0.15);
        }
        .cyber-input-inner { background: rgba(11,17,32,0.75); backdrop-filter: blur(15px); border-radius: 11px; transition: all 0.3s ease; }
        .light .cyber-input-inner { background: rgba(255,255,255,0.96); }
        @keyframes iconPulse {
          0%,100% { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
          50% { transform: scale(1.12); filter: drop-shadow(0 0 6px rgba(99,102,241,0.6)); }
        }
        .icon-pulse { animation: iconPulse 2s infinite ease-in-out; }
        @keyframes float1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-20px)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,25px)} }
      `}} />

      <div className="pointer-events-none absolute -left-[15%] -top-[20%] h-[55%] w-[55%] rounded-full bg-indigo-500/10 blur-[130px]" style={{ animation: 'float1 14s ease-in-out infinite' }} />
      <div className="pointer-events-none absolute -bottom-[20%] -right-[15%] h-[55%] w-[55%] rounded-full bg-blue-500/10 blur-[130px]" style={{ animation: 'float2 16s ease-in-out infinite' }} />

      <div className="absolute right-4 top-4 z-20"><ThemeToggle /></div>
      <div className="absolute left-4 top-4 z-20">
        <Link href="/login" className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all ${chip}`}>
          <ArrowLeft size={13} /> Kirish
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="pass-card relative z-10 w-full max-w-md rounded-3xl p-6 sm:p-8"
      >
        <motion.div {...stagger()} className="mb-7 text-center">
          <motion.div
            initial={{ scale: 0.5, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 14 }}
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 text-indigo-400 ring-1 ring-inset ring-indigo-500/20"
          >
            <ShieldCheck size={26} />
          </motion.div>
          <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400">{copy.eyebrow}</p>
          <h1 className="text-xl font-black leading-tight sm:text-2xl">{copy.title}</h1>
          <p className={`mx-auto mt-2 max-w-xs text-xs leading-relaxed ${labelCls}`}>{copy.subtitle}</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <motion.div {...stagger()}>
            <div className={wrapCls('fullName')}>
              <div className={innerCls}>
                <User size={16} className={iconCls('fullName')} />
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} {...on('fullName')} className={inputCls} placeholder="F.I.Sh" required />
              </div>
            </div>
          </motion.div>

          {isDekan && (
            <motion.div {...stagger()}>
              <div className={wrapCls('email')}>
                <div className={innerCls}>
                  <Mail size={16} className={iconCls('email')} />
                  <input type="email" name="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} {...on('email')} className={inputCls} placeholder="Email" required />
                </div>
              </div>
            </motion.div>
          )}

          <motion.div {...stagger()}>
            <div className={wrapCls('phone')}>
              <div className={innerCls}>
                <Phone size={16} className={iconCls('phone')} />
                <span className={`shrink-0 text-sm font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>+998</span>
                <input
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  {...on('phone')}
                  className={`${inputCls} tracking-wide`}
                  placeholder="90 123 45 67"
                  required
                />
              </div>
            </div>
          </motion.div>

          {!isDekan && (
            <motion.div {...stagger()} className="space-y-1.5">
              <span className={`flex items-center gap-1.5 pl-1 text-[10px] font-bold uppercase tracking-wider ${labelCls}`}>
                <Users size={12} /> Jins
              </span>
              <div className={wrapCls('gender')}>
                <div className="cyber-input-inner px-3.5 py-3">
                  <CustomSelect
                    value={gender} onChange={setGender} options={GENDER_OPTIONS}
                    placeholder="Jinsingizni tanlang"
                    onFocus={() => setFocused('gender')} onBlur={() => setFocused(null)}
                    className="w-full bg-transparent px-0 text-sm"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {isDekan && (
            <motion.div {...stagger()} className="space-y-1.5">
              <span className={`flex items-center gap-1.5 pl-1 text-[10px] font-bold uppercase tracking-wider ${labelCls}`}>
                <GraduationCap size={12} /> Fakultet
              </span>
              <div className={wrapCls('faculty')}>
                <div className="cyber-input-inner px-3.5 py-3">
                  <CustomSelect
                    value={faculty} onChange={setFaculty} options={FACULTY_OPTIONS}
                    placeholder="Fakultetingizni tanlang"
                    onFocus={() => setFocused('faculty')} onBlur={() => setFocused(null)}
                    className="w-full bg-transparent px-0 text-sm"
                  />
                </div>
              </div>
            </motion.div>
          )}

          <motion.div {...stagger()}>
            <div className={wrapCls('code')}>
              <div className={innerCls}>
                <KeyRound size={16} className={iconCls('code')} />
                <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} {...on('code')} className={`${inputCls} font-mono uppercase tracking-[0.25em]`} placeholder="XXXX-XXXX-XXXX" autoComplete="off" required />
              </div>
            </div>
          </motion.div>

          <motion.div {...stagger()}>
            <div className={wrapCls('pw1')}>
              <div className={innerCls}>
                <Lock size={16} className={iconCls('pw1')} />
                <input type="password" name="new-password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} {...on('pw1')} className={inputCls} placeholder="Parol" required />
              </div>
            </div>
          </motion.div>

          <motion.div {...stagger()}>
            <div className={wrapCls('pw2')}>
              <div className={innerCls}>
                <Lock size={16} className={iconCls('pw2')} />
                <input type="password" name="confirm-password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} {...on('pw2')} className={inputCls} placeholder="Parolni tasdiqlang" required />
              </div>
            </div>
          </motion.div>

          <motion.button
            {...stagger()}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.015 }}
            whileTap={{ scale: loading ? 1 : 0.985 }}
            className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-[length:200%_auto] px-4 py-3.5 text-xs font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-indigo-600/25 transition-[background-position,transform] duration-500 hover:bg-right disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            {loading ? 'Yuborilmoqda…' : "Ro'yxatdan o'tish"}
          </motion.button>
        </form>

        <motion.p {...stagger()} className={`mt-6 text-center text-xs ${labelCls}`}>
          Akkauntingiz bormi?{' '}
          <Link href="/login" className="font-bold text-indigo-400 hover:underline">Kirish sahifasi</Link>
        </motion.p>
      </motion.div>
    </div>
  )
}
