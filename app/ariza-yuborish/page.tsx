'use client'

import Link from 'next/link'
import { FileCheck2, Globe2, ArrowLeft, ChevronRight } from 'lucide-react'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'

// The very first fork every applicant hits: a government "yo'llanma" only
// exists for regular Uzbek citizens applying through my.gov.uz — foreign
// and privileged-category (imtiyozli) students never get one, and submit a
// filled Ariza + Tilxat + passport photo instead (see app/imtiyozli-ariza).
// Both paths land in the same dekan queue afterwards.
export default function ArizaTuriTanlash() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden ${isLight ? 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900' : 'bg-[#020617] text-white'}`}>
      <div className="absolute top-[-20%] left-[-15%] w-[55%] h-[55%] bg-blue-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-15%] w-[55%] h-[55%] bg-indigo-500/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="absolute top-4 left-4 z-20">
        <Link
          href="/"
          className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all border ${
            isLight ? 'bg-white/80 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-xs' : 'bg-[#0f172a]/80 border-white/5 text-slate-400 hover:bg-white/5'
          }`}
        >
          <ArrowLeft size={14} /> <span>Bosh sahifa</span>
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-3xl">
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-xl sm:text-3xl font-black uppercase tracking-tight">Siz kimsiz?</h1>
          <p className={`text-xs sm:text-sm font-medium mt-2 max-w-lg mx-auto ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Yotoqxonaga joylashish uchun to&apos;ldiriladigan hujjat toifangizga qarab farq qiladi — to&apos;g&apos;ri variantni tanlang.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div>
            <Link
              href="/ruxsatnoma-yuborish"
              className={`group h-full flex flex-col justify-between p-6 sm:p-7 rounded-3xl border backdrop-blur-3xl transition-all hover:-translate-y-1 ${
                isLight
                  ? 'bg-white/90 border-slate-200 hover:border-blue-400 shadow-lg shadow-slate-200/60'
                  : 'bg-[#0b1120]/80 border-white/10 hover:border-blue-500/40 shadow-2xl shadow-black/40'
              }`}
            >
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-600/25 mb-4">
                  <FileCheck2 size={22} />
                </div>
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wide">O&apos;zbekiston fuqarosiman</h2>
                <p className={`text-[11px] sm:text-xs leading-relaxed mt-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  my.gov.uz portalidan olingan rasmiy <b>Yo&apos;llanma</b> hujjatingiz bor. Uni yuklab, tizim orqali avtomatik tekshirtirasiz.
                </p>
              </div>
              <div className="flex items-center gap-1.5 mt-6 text-[10px] font-black uppercase tracking-widest text-blue-500 group-hover:gap-2.5 transition-all">
                <span>Yo&apos;llanma yuborish</span>
                <ChevronRight size={14} />
              </div>
            </Link>
          </div>

          <div>
            <Link
              href="/imtiyozli-ariza"
              className={`group h-full flex flex-col justify-between p-6 sm:p-7 rounded-3xl border backdrop-blur-3xl transition-all hover:-translate-y-1 ${
                isLight
                  ? 'bg-white/90 border-slate-200 hover:border-amber-400 shadow-lg shadow-slate-200/60'
                  : 'bg-[#0b1120]/80 border-white/10 hover:border-amber-500/40 shadow-2xl shadow-black/40'
              }`}
            >
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-600/25 mb-4">
                  <Globe2 size={22} />
                </div>
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wide">Xorijlik / Imtiyozli talabaman</h2>
                <p className={`text-[11px] sm:text-xs leading-relaxed mt-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Menga Yo&apos;llanma berilmaydi (xorijiy fuqaro, yetim, nogironligi bor yoki kam ta&apos;minlangan oila farzandiman). <b>Ariza va Tilxat</b>{' '}to&apos;ldirib, pasportim rasmini yuklayman.
                </p>
              </div>
              <div className="flex items-center gap-1.5 mt-6 text-[10px] font-black uppercase tracking-widest text-amber-500 group-hover:gap-2.5 transition-all">
                <span>Ariza va Tilxat yuborish</span>
                <ChevronRight size={14} />
              </div>
            </Link>
          </div>
        </div>

        <p className={`text-center text-[10px] font-medium mt-8 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Ariza yuborganingiz bor edimi?{' '}
          <Link href="/ruxsatnoma-tekshirish" className="text-blue-500 font-bold hover:underline">
            Statusni tekshiring
          </Link>
        </p>
      </div>
    </div>
  )
}
