'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPasswordPolicyError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/password-policy'

// Staff registration via a dekan-issued invite code. The code alone decides
// the faculty and role — there is no faculty picker here.
export default function InviteRegisterForm({ initialCode = '' }: { initialCode?: string }) {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [inviteCode, setInviteCode] = useState(initialCode)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullName || !email || !inviteCode || !password || !confirmPassword) {
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
        body: JSON.stringify({ fullName, email, phone, password, confirmPassword, inviteCode }),
      })
      const result: { ok: boolean; error?: string } = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Ro'yxatdan o'tishda xatolik")
      }

      toast.success("Muvaffaqiyatli ro'yxatdan o'tdingiz")
      setTimeout(() => router.push('/login'), 1000)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Nomaʼlum xatolik')
    } finally {
      setLoading(false)
    }
  }

  const fieldCls = 'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none'

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1120]/85 p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
            <KeyRound size={22} />
          </div>
          <h1 className="text-xl font-black">Taklif kodi bilan ro&apos;yxatdan o&apos;tish</h1>
          <p className="mt-1 text-xs text-slate-400">Fakultet va rol taklif kodidan olinadi</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={fieldCls} placeholder="F.I.Sh" required />
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldCls}
            placeholder="Email"
            required
          />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldCls} placeholder="Telefon (ixtiyoriy)" />
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className={`${fieldCls} font-mono tracking-widest uppercase`}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            required
          />
          <input
            type="password"
            name="new-password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldCls}
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
            className={fieldCls}
            placeholder="Parolni tasdiqlang"
            required
          />
          <button
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 px-4 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-60"
          >
            {loading ? 'Yuborilmoqda...' : 'Ro‘yxatdan o‘tish'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          Akkauntingiz bormi?{' '}
          <Link href="/login" className="text-indigo-400 hover:underline">
            Kirish sahifasi
          </Link>
        </p>
      </div>
    </main>
  )
}
