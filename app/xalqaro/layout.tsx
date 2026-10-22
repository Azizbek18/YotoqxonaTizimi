'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe2, KeyRound, LogOut, ShieldCheck, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import ChangePasswordModal from '@/components/xalqaro/ChangePasswordModal'
import { supabase } from '@/lib/supabase'
import { getSafeUser } from '@/lib/auth-session'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'

// International office shell: one read-only page, so a slim top bar instead of
// the dekan/tarbiyachi sidebar. Role access is enforced by proxy.ts (page) and
// the /api/xalqaro/* guard (data) — this layout is presentation only.
export default function XalqaroLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isLight = useThemeStore((state) => state.theme === 'light')
  const ui = dekanUI(isLight)
  const [email, setEmail] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  useEffect(() => {
    let active = true
    void getSafeUser().then((user) => {
      if (active) setEmail(user?.email ?? null)
    })
    return () => { active = false }
  }, [])

  const logout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      toast.error('Chiqib ketishda xato!')
      setLoggingOut(false)
    }
  }

  return (
    // data-flat: bu panelda globals.css dagi qalin "shelf" (3D) soyalari o'chiriladi.
    <div data-flat className={`min-h-screen ${ui.shell}`}>
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-xl transition-colors duration-200 ${
          isLight
            ? 'border-slate-200/80 bg-white/90'
            : 'border-slate-800/80 bg-slate-950/90 shadow-sm shadow-black/20'
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="flex min-w-0 flex-1 basis-[170px] items-center gap-2.5 sm:gap-3">
            <div className={`relative flex h-9 w-9 shrink-0 items-center sm:h-10 sm:w-10 justify-center rounded-xl border text-white ${
              isLight ? 'bg-slate-900 border-slate-700' : 'bg-slate-800 border-slate-700'
            }`}>
              <Globe2 size={20} className="text-slate-200" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                  isLight
                    ? 'bg-slate-100 text-slate-800 border-slate-300'
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}>
                  <span className="hidden min-[380px]:inline">O‘zMU · </span>Xalqaro bo‘lim
                </span>
                <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  <ShieldCheck size={11} className="text-emerald-600 dark:text-emerald-400" /> Markaziy nazorat
                </span>
              </div>
              {/* Sahifaning o'zida katta <h1> bor, shuning uchun bu yerda oddiy matn. */}
              <p className={`truncate text-[13px] sm:text-base font-black tracking-tight mt-0.5 ${ui.strong}`}>
                Viza va propiska nazorati
              </p>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            {email && (
              <div
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                  isLight
                    ? 'bg-slate-100/90 border-slate-200/80 text-slate-700'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}
              >
                <UserCheck size={13} className="text-slate-500 dark:text-slate-400" />
                <span className="max-w-[200px] truncate">{email}</span>
              </div>
            )}
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className={`no-shelf inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition-colors sm:px-3 ${
                isLight
                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
              title="Parolni o‘zgartirish"
            >
              <KeyRound size={14} />
              <span className="hidden sm:inline">Parol</span>
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className={`no-shelf inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold transition-all active:scale-95 sm:px-3 disabled:opacity-50 ${
                isLight
                  ? 'border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-200'
                  : 'border border-slate-800 bg-slate-900 text-rose-400 hover:bg-rose-950/30 hover:border-rose-900/40'
              }`}
              title="Tizimdan chiqish"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Chiqish</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">{children}</main>
      {/* Sarlavhadan tashqarida: u backdrop-blur ishlatadi va ichidagi fixed oyna siljib ketardi. */}
      <ChangePasswordModal open={passwordOpen} email={email} isLight={isLight} onClose={() => setPasswordOpen(false)} />
    </div>
  )
}
