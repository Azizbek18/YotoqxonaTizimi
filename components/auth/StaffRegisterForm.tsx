'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserCog } from 'lucide-react'
import toast from 'react-hot-toast'

type StaffRole = 'zamdekan'

const ROLE_META: Record<StaffRole, { title: string; icon: React.ReactNode; loginUrl: string }> = {
  zamdekan: {
    title: "Zamdekan ro'yxatdan o'tishi",
    icon: <UserCog size={22} />,
    loginUrl: '/login',
  },
}

export default function StaffRegisterForm({ role, linkKey }: { role: StaffRole; linkKey: string }) {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [staffId, setStaffId] = useState('')
  const [registerCode, setRegisterCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [faculty, setFaculty] = useState('')
  const [loading, setLoading] = useState(false)

  const showToast = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      toast.success(message)
    } else {
      toast.error(message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullName || !email || !staffId || !registerCode || !password || !confirmPassword) {
      showToast('error', "Majburiy maydonlarni to'ldiring")
      return
    }

    if (!faculty.trim()) {
      showToast('error', 'Fakultetni kiriting')
      return
    }

    if (password !== confirmPassword) {
      showToast('error', 'Parollar bir xil emas')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/staff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          role,
          staffId,
          registerCode,
          password,
          confirmPassword,
          faculty: faculty.trim(),
          linkKey,
        }),
      })
      const result: { ok: boolean; error?: string } = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Ro'yxatdan o'tishda xatolik")
      }

      showToast('success', "Muvaffaqiyatli ro'yxatdan o'tdingiz")
      setTimeout(() => {
        router.push(`/login?portal=${role}&k=${encodeURIComponent(linkKey)}`)
      }, 1000)
    } catch (error: unknown) {
      showToast('error', error instanceof Error ? error.message : 'Nomaʼlum xatolik')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1120]/85 p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
            {ROLE_META[role].icon}
          </div>
          <h1 className="text-xl font-black">{ROLE_META[role].title}</h1>
          <p className="mt-1 text-xs text-slate-400">Talaba formasisiz tezkor ro&apos;yxatdan o&apos;tish</p>
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
            placeholder="Telefon (ixtiyoriy)"
          />
          <input
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            placeholder="Maxsus ID"
            required
          />
          <input
            value={faculty}
            onChange={(e) => setFaculty(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            placeholder="Fakultet (masalan: Amaliy Matematika va Informatika Texnologiyalari)"
            required
          />
          <input
            value={registerCode}
            onChange={(e) => setRegisterCode(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            placeholder="Maxsus ro'yxatdan o'tish kodi"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
            placeholder="Parol"
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none"
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
          <Link href={`${ROLE_META[role].loginUrl}?k=${encodeURIComponent(linkKey)}`} className="text-indigo-400 hover:underline">
            Kirish sahifasi
          </Link>
        </p>
      </div>
    </main>
  )
}
