'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { Mail, Lock, ChevronRight, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import DeveloperContactLink from '@/components/DeveloperContactLink'
import { useThemeStore } from '@/lib/stores/theme-store'
import { appFont as baloo2 } from '@/lib/app-font'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // /auth/confirm buzilgan yoki muddati o'tgan havolani shu yerga qaytaradi.
  const linkError = searchParams.get('error')
  useEffect(() => {
    if (!linkError) return
    toast.error(
      linkError === 'link_expired'
        ? "Havolaning muddati tugagan yoki u allaqachon ishlatilgan. Quyidagi “Tiklash” orqali yangi havola so'rang."
        : linkError === 'link_invalid'
          ? "Havola noto'g'ri. Emaildagi havolani to'liq nusxalab ko'ring."
          : "Server xatoligi yuz berdi. Birozdan keyin qayta urinib ko'ring.",
    )
  }, [linkError])

  const show3DToast = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      toast.success(message)
    } else {
      toast.error(message)
    }
  };

  const resolveSignedInRole = async (accessToken?: string) => {
    const retryDelays = [0, 200, 500]
    let lastResponse: Response | null = null
    let lastResult: { ok?: boolean; role?: string | null; reason?: string; error?: string } | null = null

    for (const retryDelay of retryDelays) {
      if (retryDelay) {
        await new Promise<void>((resolve) => setTimeout(resolve, retryDelay))
      }
      lastResponse = await fetch('/api/auth/resolve-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      })
      lastResult = await lastResponse.json().catch(() => null)

      // A just-created Supabase session may take a brief moment to become
      // visible to the server's live-session check. Retry only 401; role,
      // account-state and server errors must be returned immediately.
      if (lastResponse.status !== 401) break
    }

    return { response: lastResponse, result: lastResult }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return show3DToast('error', "Ma'lumotlarni to'liq kiriting")

    setLoading(true)
    try {
      const cleanEmail = email.trim().toLowerCase()

      // Login oldidan users/staff jadvallarini anonim qidirmaymiz. Bu hisob
      // mavjudligini oshkor qiladigan account-enumeration xatosini yopadi.
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      })

      // Mavjud bo'lmagan hisob va noto'g'ri parol uchun bir xil xabar
      // qaytaramiz; aks holda login formasi account-enumeration oracle bo'ladi.
      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          throw new Error("Email yoki parol noto'g'ri.")
        }
        throw new Error(authError.message)
      }

      // 3. Tizimga kirish muvaffaqiyatli bo'lsa, rolini aniqlaymiz.
      // Server nosozligi (env yetishmasligi, rate limit, tarmoq uzilishi) bilan
      // "roli yo'q" holatini bir xil xabarga yig'ib yubormaymiz — aks holda
      // productionda haqiqiy sabab ko'rinmay qoladi.
      let userRole: string | null = null
      let failure: string | null = null
      try {
        const { response: roleResponse, result: roleResult } = await resolveSignedInRole(
          authData.session?.access_token,
        )
        if (!roleResponse) throw new Error('Rolni aniqlash so‘rovi bajarilmadi')
        if (!roleResponse.ok || !roleResult?.ok) {
          failure = roleResult?.error
            ? `${roleResult.error} (${roleResponse.status})`
            : `Rolni aniqlash so'rovi ${roleResponse.status} bilan tugadi.`
        } else if (roleResult.role) {
          userRole = roleResult.role
        } else if (roleResult.reason === 'email_not_verified') {
          failure = "Emailingiz hali tasdiqlanmagan. Ro'yxatdan o'tishda yuborilgan havola orqali parol o'rnating."
        } else if (roleResult.reason === 'awaiting_dean_approval') {
          failure = "Arizangiz dekanga yuborilgan, hali tasdiqlanmagan. Tasdiqlangach shu email va parol bilan kirishingiz mumkin bo'ladi."
        } else {
          failure = "Hisob faol emas yoki tizim roliga biriktirilmagan."
        }
      } catch (roleError) {
        console.error('Role resolution error:', roleError)
        failure = "Server bilan bog'lanib bo'lmadi. Internet aloqasini tekshiring."
      }

      if (!userRole) {
        await supabase.auth.signOut()
        throw new Error(failure ?? "Hisob faol emas yoki tizim roliga biriktirilmagan.")
      }

      show3DToast('success', 'Xush kelibsiz!')

      setTimeout(() => {
        // `admin` is the cross-faculty superadmin. It shares the dekan shell,
        // but must land on global oversight rather than the legacy AMIT view.
        if (userRole === 'admin') {
          router.push('/dekan/dekanlar')
        } else if (userRole === 'dekan') {
          router.push('/dekan/dashboard')
        } else if (userRole === 'tarbiyachi') {
          router.push('/tarbiyachi/dashboard')
        } else {
          router.push('/talaba/dashboard')
        }
      }, 1000)

    } catch (err) {
      const error = err as Error
      show3DToast('error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={`min-h-screen flex items-center justify-center p-3 sm:p-5 relative overflow-hidden ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#020617]'} ${baloo2.className}`} style={{ fontFamily: baloo2.style.fontFamily }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sweep {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .cyber-border {
          background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          padding: 1px;
          border-radius: 12px;
          transition: all 0.35s ease;
        }
        .cyber-border.focused {
          background: linear-gradient(90deg, #6366f1, #3b82f6, #ec4899, #6366f1);
          background-size: 200% 200%;
          animation: sweep 2s linear infinite;
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.15);
        }
        .light .cyber-border.focused {
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.08);
        }
        .cyber-input-inner {
          background: rgba(11, 17, 32, 0.75);
          backdrop-filter: blur(15px);
          border-radius: 11px;
          transition: all 0.3s ease;
        }
        .light .cyber-input-inner {
          background: rgba(255, 255, 255, 0.95);
        }

        /* Har necha soniyada bir marta: logo aylanadi, shu payt do'ppi
           "yechilib" havoga ko'tariladi va aylanish tugagach yana
           kiyib qo'yilgandek joyiga tushadi. */
        @keyframes loginLogoSpin {
          0% { transform: rotate(0deg); }
          14% { transform: rotate(360deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes loginDoppiLift {
          0% { transform: translateY(0) rotate(0deg); }
          6% { transform: translateY(-15px) rotate(-12deg); }
          14% { transform: translateY(-15px) rotate(-12deg); }
          19% { transform: translateY(3px) rotate(6deg); }
          24% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        .login-logo-spin {
          animation: loginLogoSpin 5s ease-in-out infinite;
          animation-delay: 1s;
        }
        .login-doppi-lift {
          animation: loginDoppiLift 5s ease-in-out infinite;
          animation-delay: 1s;
        }
        @media (prefers-reduced-motion: reduce) {
          .login-logo-spin, .login-doppi-lift { animation: none; }
        }
      `}} />
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Static Background Glows */}
      <div className={`absolute top-0 left-0 w-full h-full pointer-events-none ${isLight ? 'opacity-30' : ''}`}>
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] ${isLight ? 'bg-blue-200' : 'bg-blue-500/10'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] ${isLight ? 'bg-indigo-200' : 'bg-indigo-500/10'}`} />
      </div>

      <div className="relative z-10 w-full max-w-[320px] sm:max-w-110">
        {/* Logo Section */}
        <div className="text-center mb-6 sm:mb-10">
          <div className="relative mb-4 inline-flex">
            {/* Do'ppi logoga bog'langan: forma va ekran o'lchamidan mustaqil turadi.
                Tashqi div joylashuvni (markazlashni) ushlab turadi, o'rtadagi
                div davriy "yechilib-kiyilish" animatsiyasini bajaradi, ichki
                div esa doimiy og'ma burchakni saqlaydi. */}
            <div
              className="pointer-events-none absolute left-[calc(50%+8px)] top-[-18px] z-20 h-11 w-11 -translate-x-1/2 sm:top-[-26px] sm:h-15 sm:w-15"
              aria-hidden="true"
            >
              <div className="login-doppi-lift h-full w-full">
                <div className="relative h-full w-full rotate-[12deg] sm:rotate-[14deg]">
                  <Image
                    src="/doppi-black-transparent.png"
                    alt=""
                    fill
                    sizes="(max-width: 640px) 44px, 60px"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </div>

            <div className="login-logo-spin inline-flex items-center justify-center w-18 h-18 sm:w-24 sm:h-24 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 shadow-xl p-1">
              <div className="relative w-full h-full rounded-full overflow-hidden">
                <Image src="/logo.png" alt="Mening yotoqxonam" fill sizes="80px" className="object-cover" priority />
              </div>
            </div>
          </div>
          <h1
            className="text-xl sm:text-4xl font-black tracking-tighter uppercase italic leading-none bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent"
            style={{ fontFamily: baloo2.style.fontFamily }}
          >
            Mening yotoqxonam
          </h1>
        </div>

        <div className={`relative backdrop-blur-3xl border rounded-3xl sm:rounded-4xl p-3 sm:p-10 shadow-2xl overflow-visible ${isLight ? 'bg-white/80 border-slate-200' : 'bg-[#0b1120]/80 border-white/10'}`}>
          {/* Tabs */}
          <div className="flex gap-2.5 mb-6 sm:mb-10">
            <button type="button" className={`flex-1 py-2 sm:py-3 text-center text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl border ${isLight ? 'text-white bg-blue-600 border-blue-700' : 'text-white bg-blue-600 border-blue-500'}`}>Kirish</button>
            <Link href="/register" className={`flex-1 py-2 sm:py-3 text-center text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all italic ${isLight ? 'text-slate-500 hover:text-slate-700 bg-white border-slate-200' : 'text-slate-500 hover:text-white bg-white/5 border-white/10'}`}>Ro&apos;yxatdan o&apos;tish</Link>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <label className={`text-[9px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>Email Manzil</label>
              <div className={`cyber-border ${focusedField === 'email' ? 'focused' : ''}`}>
                <div className="cyber-input-inner relative">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'email' ? 'text-blue-500 scale-110 drop-shadow-[0_0_8px_#3b82f6]' : isLight ? 'text-slate-400' : 'text-slate-600'}`}>
                    <Mail size={18} />
                  </div>
                  {focusedField === 'email' && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-blue-500/10 blur-[6px] pointer-events-none" />
                  )}
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    maxLength={254}
                    value={email}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="misol@gmail.com"
                    className={`w-full bg-transparent p-3 pl-12 rounded-xl text-sm outline-none transition-colors ${isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'}`}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className={`text-[9px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>Maxfiy Parol</label>
              <div className={`cyber-border ${focusedField === 'password' ? 'focused' : ''}`}>
                <div className="cyber-input-inner relative">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'password' ? 'text-blue-500 scale-110 drop-shadow-[0_0_8px_#3b82f6]' : isLight ? 'text-slate-400' : 'text-slate-600'}`}>
                    <Lock size={18} />
                  </div>
                  {focusedField === 'password' && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-blue-500/10 blur-[6px] pointer-events-none" />
                  )}
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    maxLength={128}
                    value={password}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full bg-transparent p-3 pl-12 pr-12 rounded-xl text-sm outline-none transition-colors ${isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-white'}`}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              disabled={loading}
              className={`w-full h-12 sm:h-14 rounded-xl sm:rounded-[22px] font-black text-[10px] sm:text-[12px] tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${loading ? isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-600' : isLight ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]' : 'bg-linear-to-r from-blue-600 to-indigo-700 text-white active:scale-[0.98]'}`}
            >
              {loading ? (
                <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isLight ? 'border-slate-300 border-t-slate-600' : 'border-white/20 border-t-white'}`} />
              ) : (
                <>
                  <span>Tizimga kirish</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className={`text-[14px] sm:text-[14px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
              Parolni unutdingizmi?{' '}
              <Link href="/forgot-password" className={`hover:underline ${isLight ? 'text-blue-600 hover:text-blue-700' : 'text-blue-500'}`}>Tiklash</Link>
            </p>
          </div>

        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020617]" />}>
      <LoginContent />
      <DeveloperContactLink />
    </Suspense>
  )
}
