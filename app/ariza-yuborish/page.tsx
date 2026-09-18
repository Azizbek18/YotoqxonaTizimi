'use client'

import Link from 'next/link'
import { FileCheck2, Globe2, Home, ArrowLeft, ChevronRight, GraduationCap, Search, CheckCircle2, Clock, Zap } from 'lucide-react'
import ThemeToggle from '@/components/theme/ThemeToggle'
import DeveloperContactLink from '@/components/DeveloperContactLink'
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
    <div className={`relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-16 sm:py-20 overflow-x-hidden ${isLight ? 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900' : 'bg-[#020617] text-white'}`}>
      {/* Decorative ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-20%] left-[-15%] w-[55%] h-[55%] rounded-full blur-[130px] ${isLight ? 'bg-blue-200/50' : 'bg-blue-500/10'}`} />
        <div className={`absolute bottom-[-20%] right-[-15%] w-[55%] h-[55%] rounded-full blur-[130px] ${isLight ? 'bg-indigo-200/50' : 'bg-indigo-500/10'}`} />
      </div>

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="absolute top-4 left-4 z-20">
        <Link
          href="/"
          className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all border shadow-xs ${
            isLight
              ? 'bg-white/90 border-slate-200 text-slate-700 hover:bg-slate-100'
              : 'bg-[#0f172a]/80 border-white/10 text-slate-300 hover:bg-white/10'
          }`}
        >
          <ArrowLeft size={15} /> <span>Bosh sahifa</span>
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto">
        {/* Academic Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide uppercase mb-3.5 border shadow-xs backdrop-blur-md transition-all ${
              isLight
                ? 'bg-blue-50/90 border-blue-200 text-blue-700'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            <GraduationCap size={15} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
            <span>OTM Talabalar Turar Joyi Axborot Tizimi</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Ariza topshirish turini tanlang
          </h1>
          <p className={`text-xs sm:text-sm font-medium mt-2 max-w-xl mx-auto leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Yotoqxonaga joylashish yoki ijaradagi kvartirangizni hisobga kiritish — o‘zingizga mos toifani tanlab davom eting.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-stretch">
          {/* 1. O'zbekiston fuqarosi */}
          <Link
            href="/ruxsatnoma-yuborish"
            className={`group flex flex-col justify-between p-6 sm:p-7 rounded-3xl border backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${
              isLight
                ? 'bg-white/95 border-slate-200 hover:border-blue-400 shadow-lg shadow-slate-200/60'
                : 'bg-[#0b1120]/85 border-white/10 hover:border-blue-500/40 shadow-2xl shadow-black/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                  <FileCheck2 size={22} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  isLight
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                }`}>
                  my.gov.uz
                </span>
              </div>

              <h2 className="text-base font-black tracking-tight">
                O‘zbekiston fuqarosiman
              </h2>
              <p className={`text-xs leading-relaxed mt-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                my.gov.uz portalidan rasmiy <b>Yo‘llanma</b> olgan talabalar uchun.
              </p>

              {/* Requirements & Features list */}
              <div className={`mt-5 pt-4 border-t space-y-2 text-[11px] font-medium ${isLight ? 'border-slate-100 text-slate-600' : 'border-white/5 text-slate-400'}`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-blue-500 shrink-0" />
                  <span>Elektron yo‘llanma (PDF)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap size={13} className="text-blue-500 shrink-0" />
                  <span>Avtomatik tizim tekshiruvi</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-blue-500 shrink-0" />
                  <span>1 daqiqa vaqt oladi</span>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <div className="w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:from-blue-700 group-hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 transition-all">
                <span>Yo‘llanma yuborish</span>
                <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* 2. Xorijlik / Imtiyozli talaba */}
          <Link
            href="/imtiyozli-ariza"
            className={`group flex flex-col justify-between p-6 sm:p-7 rounded-3xl border backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${
              isLight
                ? 'bg-white/95 border-slate-200 hover:border-amber-400 shadow-lg shadow-slate-200/60'
                : 'bg-[#0b1120]/85 border-white/10 hover:border-amber-500/40 shadow-2xl shadow-black/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25">
                  <Globe2 size={22} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  isLight
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}>
                  Imtiyozli / Xorijiy
                </span>
              </div>

              <h2 className="text-base font-black tracking-tight">
                Xorijlik / Imtiyozli talaba
              </h2>
              <p className={`text-xs leading-relaxed mt-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Yo‘llanmasiz toifalar: xorijiy fuqarolar, yetim yoki ijtimoiy imtiyozli talabalar.
              </p>

              {/* Requirements & Features list */}
              <div className={`mt-5 pt-4 border-t space-y-2 text-[11px] font-medium ${isLight ? 'border-slate-100 text-slate-600' : 'border-white/5 text-slate-400'}`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-amber-500 shrink-0" />
                  <span>Pasport rasmi yoki guvohnoma</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-amber-500 shrink-0" />
                  <span>Ariza va Tilxat (onlayn)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-amber-500 shrink-0" />
                  <span>Dekanat ko‘rib chiqadi</span>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <div className="w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 group-hover:from-amber-600 group-hover:to-orange-700 text-white shadow-md shadow-amber-500/20 transition-all">
                <span>Ariza va Tilxat topshirish</span>
                <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* 3. Kvartira / Ijarada turaman */}
          <Link
            href="/kv-royxatdan-otish"
            className={`group flex flex-col justify-between p-6 sm:p-7 rounded-3xl border backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${
              isLight
                ? 'bg-white/95 border-slate-200 hover:border-emerald-400 shadow-lg shadow-slate-200/60'
                : 'bg-[#0b1120]/85 border-white/10 hover:border-emerald-500/40 shadow-2xl shadow-black/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
                  <Home size={22} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                }`}>
                  Ijara monitoringi
                </span>
              </div>

              <h2 className="text-base font-black tracking-tight">
                Kvartira / Ijarada turaman
              </h2>
              <p className={`text-xs leading-relaxed mt-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Yotoqxonada emas, ijarada turuvchi talabalarning rasmiy universiteti monitoringi.
              </p>

              {/* Requirements & Features list */}
              <div className={`mt-5 pt-4 border-t space-y-2 text-[11px] font-medium ${isLight ? 'border-slate-100 text-slate-600' : 'border-white/5 text-slate-400'}`}>
                <div className="flex items-center gap-2">
                  <Zap size={13} className="text-emerald-500 shrink-0" />
                  <span>Hujjat talab etilmaydi</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  <span>Tezkor anketa to‘ldirish</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-emerald-500 shrink-0" />
                  <span>Darhol shaxsiy kabinetga kirish</span>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <div className="w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 group-hover:from-emerald-600 group-hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 transition-all">
                <span>Ro‘yxatdan o‘tish</span>
                <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>

        {/* Prominent Status Check Card */}
        <div className={`mt-10 sm:mt-12 p-4 sm:p-5 rounded-2xl border backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 max-w-2xl mx-auto text-center sm:text-left transition-all ${
          isLight
            ? 'bg-white/90 border-slate-200 shadow-md shadow-slate-200/50'
            : 'bg-[#0b1120]/80 border-white/10 shadow-xl shadow-black/40'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/10 text-blue-400'}`}>
              <Search size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Avval ariza topshirganmisiz?</h3>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Arizangiz ko‘rib chiqilish holatini pasport ma‘lumotingiz orqali tekshiring
              </p>
            </div>
          </div>
          <Link
            href="/ruxsatnoma-tekshirish"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all shrink-0 w-full sm:w-auto"
          >
            <span>Holatni tekshirish</span>
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>
      <DeveloperContactLink />
    </div>
  )
}
