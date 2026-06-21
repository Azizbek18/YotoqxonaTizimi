'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Lock,
  User,
  ChevronRight,
  Shield,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  BadgeCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminRegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [bootstrapCode, setBootstrapCode] = useState('')
  const [bootstrapMode, setBootstrapMode] = useState(false)
  const [checkingBootstrap, setCheckingBootstrap] = useState(true)

  const show3DToast = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      toast.success(message)
    } else {
      toast.error(message)
    }
  };

  useEffect(() => {
    async function checkBootstrap() {
      try {
        const response = await fetch('/api/admin/bootstrap')
        const result = await response.json()
        if (response.ok && result.ok) {
          setBootstrapMode(Boolean(result.needsBootstrap))
        }
      } finally {
        setCheckingBootstrap(false)
      }
    }

    void checkBootstrap()
  }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    const requiredCode = bootstrapMode ? bootstrapCode : inviteCode

    if (!name || !email || !password || !confirmPassword || !requiredCode) {
      return show3DToast('error', "Barcha maydonlarni to'liq kiriting")
    }

    if (password !== confirmPassword) {
      return show3DToast('error', "Parollar bir-biriga mos kelmadi!")
    }

    if (password.length < 6) {
      return show3DToast('error', "Parol kamida 6 ta belgidan iborat bo'lishi kerak!")
    }

    setLoading(true)
    try {
      const cleanEmail = email.trim().toLowerCase()

      if (bootstrapMode) {
        const response = await fetch('/api/admin/bootstrap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fullName: name,
            email: cleanEmail,
            password,
            confirmPassword,
            bootstrapCode,
          }),
        })
        const result: { ok: boolean; error?: string } = await response.json()

        if (!response.ok || !result.ok) {
          throw new Error(result.error ?? "Birinchi adminni yaratishda xatolik")
        }

        show3DToast('success', 'Birinchi admin akkaunti muvaffaqiyatli yaratildi!')
        setTimeout(() => {
          router.push('/admin/login')
        }, 1200)
        return
      }

      const { data: inviteExists } = await supabase
        .from('admin_invites')
        .select('id, email, used')
        .eq('code', inviteCode.trim())
        .eq('email', cleanEmail)
        .maybeSingle()

      if (!inviteExists) {
        throw new Error("Taklif kodi noto'g'ri yoki email bilan mos kelmadi!")
      }

      if (inviteExists.used) {
        throw new Error("Bu taklif kodi allaqachon ishlatilgan!")
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error("Bu email allaqachon ro'yxatdan o'tgan!")
        }
        throw new Error(authError.message)
      }

      if (!authData.user?.id) {
        throw new Error('Autentifikatsiya xatosi!')
      }

      const { error: insertError } = await supabase.from('staff').insert({
        id: authData.user.id,
        email: cleanEmail,
        full_name: name,
        staff_id: inviteCode.trim(),
        role: 'admin',
        created_at: new Date().toISOString(),
      })

      if (insertError) {
        throw new Error("Foydalanuvchi ma'lumotlarini saqlashda xato!")
      }

      await supabase
        .from('admin_invites')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', inviteExists.id)

      show3DToast('success', 'Admin akkaunt muvaffaqiyatli yaratildi!')

      setTimeout(() => {
        router.push('/admin/login')
      }, 1200)
    } catch (err) {
      const error = err as Error
      show3DToast('error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] p-3 sm:p-5">
      <div className="pointer-events-none absolute left-0 top-0 h-full w-full">
        <div className="absolute left-[-10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[320px] sm:max-w-[440px]">
        <div className="mb-6 text-center sm:mb-10">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[1px] shadow-xl sm:h-20 sm:w-20">
            <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-[#020617] text-blue-500">
              <Shield size={28} className="sm:size-[40px]" />
            </div>
          </div>
          <h1 className="text-xl font-black uppercase italic leading-none tracking-tighter text-white sm:text-4xl">
            Admin Portali
          </h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 sm:text-xs">
            {bootstrapMode ? 'Birinchi adminni ishga tushirish' : 'Taklif kodi orqali ro‘yxatdan o‘tish'}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1120]/80 p-3 shadow-2xl backdrop-blur-3xl sm:rounded-[40px] sm:max-h-[90vh] sm:overflow-y-auto sm:p-10">
          <div className="mb-6 flex gap-1 rounded-xl border border-white/5 bg-white/5 p-1 sm:mb-8">
            <Link
              href="/admin/login"
              className="flex-1 py-2 text-center text-[8px] font-black uppercase tracking-widest text-slate-500 transition-all hover:text-white sm:py-3 sm:text-[10px]"
            >
              Kirish
            </Link>
            <div className="flex-1 rounded-lg bg-blue-600 py-2 text-center text-[8px] font-black uppercase tracking-widest text-white shadow-lg sm:py-3 sm:text-[10px]">
              Ro&apos;yxatdan o&apos;tish
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 sm:mb-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400">
                <BadgeCheck size={18} />
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">
                  {checkingBootstrap ? 'Tekshirilmoqda' : bootstrapMode ? 'Bootstrap rejimi' : 'Faqat taklif bilan'}
                </p>
                <p className="text-xs leading-5 text-slate-300">
                  {bootstrapMode
                    ? 'Tizimda hali admin yo‘q. Birinchi adminni yaratish uchun bootstrap koddan foydalaning.'
                    : 'Admin akkaunt ochish uchun emailingizga biriktirilgan taklif kodini kiriting. Agar sizda kod bo‘lmasa, mavjud admin uni Sozlamalar bo‘limidan yaratib beradi.'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <label className="ml-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                To&apos;liq ism
              </label>
              <div className="group relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-blue-500">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ism familiya"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 pl-12 text-sm text-white outline-none transition-all focus:border-blue-500/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                Email manzil
              </label>
              <div className="group relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-blue-500">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@system.local"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 pl-12 text-sm text-white outline-none transition-all focus:border-blue-500/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                {bootstrapMode ? 'Bootstrap kodi' : 'Taklif kodi'}
              </label>
              <div className="group relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-blue-500">
                  <KeyRound size={18} />
                </div>
                <input
                  type="text"
                  value={bootstrapMode ? bootstrapCode : inviteCode}
                  onChange={(e) => bootstrapMode ? setBootstrapCode(e.target.value) : setInviteCode(e.target.value)}
                  placeholder={bootstrapMode ? 'ADMIN-BOOTSTRAP-CODE' : 'INVITE-2026'}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 pl-12 text-sm text-white outline-none transition-all focus:border-blue-500/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                Parol
              </label>
              <div className="group relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-blue-500">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 pl-12 pr-12 text-sm text-white outline-none transition-all focus:border-blue-500/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-white"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                Parolni tasdiqlang
              </label>
              <div className="group relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-blue-500">
                  <Lock size={18} />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 pl-12 pr-12 text-sm text-white outline-none transition-all focus:border-blue-500/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl font-black uppercase tracking-widest transition-all sm:h-14 sm:rounded-[22px] sm:text-[12px] ${loading
                  ? 'bg-white/5 text-slate-600'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl hover:shadow-blue-600/20 active:scale-[0.98]'
                } text-[10px]`}
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <>
                  <span>Admin akkaunt yaratish</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs font-bold text-slate-500">
              Akkauntingiz bormi?{' '}
              <Link href="/admin/login" className="text-blue-500 hover:underline">
                Admin kirish
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/login"
              className="inline-flex rounded-xl border border-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:border-white/10 hover:bg-white/5 hover:text-white"
            >
              Oddiy kirish sahifasiga qaytish
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
