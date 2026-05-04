"use client";

import React, { useState } from 'react';
import { useThemeStore } from '@/lib/stores/theme-store';

// Ma'lumotlar strukturasi
const DATA = {
  umumiy: [
    { id: 1, title: "Internet tezligi 100 Mbit/s", text: "Yotoqxona bo'ylab barcha routerlar 5G standartiga o'tkazildi.", date: "Bugun", type: "Yangilik" },
    { id: 2, title: "Liftlar yangilandi", text: "Barcha bloklardagi liftlar Germaniya texnologiyasi asosida to'liq modernizatsiya qilindi.", date: "Bugun", type: "Muhim" },
    { id: 3, title: "Futbol turniri: Final", text: "Ertaga soat 17:00 da 1-va 4-blok jamoalari o'rtasida final o'yini bo'lib o'tadi.", date: "Bugun", type: "Tadbir" },
    { id: 4, title: "Kutubxona 24/7", text: "Imtihonlar mavsumi sababli kutubxona tunu-kun ishlash tartibiga o'tdi.", date: "Kecha", type: "Yangilik" },
    { id: 5, title: "Elektr uzilishi", text: "Texnik ishlar sababli juma kuni soat 14:00 dan 16:00 gacha svet o'chadi.", date: "Kecha", type: "Ogohlantirish" },
    { id: 6, title: "Yangi yuvinish xonasi", text: "2-blok talabalari uchun yangi dush kabinalari foydalanishga topshirildi.", date: "2 kun avval", type: "Muhim" },
    { id: 7, title: "Kibersport musobaqasi", text: "CS2 va Dota 2 bo'yicha yotoqxona ochiq birinchiligi boshlanmoqda.", date: "2 kun avval", type: "Tadbir" },
    { id: 8, title: "Oshxona gigiyenasi", text: "Barcha umumiy oshxonalarda haftalik sanitar tozalash ishlari yakunlandi.", date: "3 kun avval", type: "Muhim" },
    { id: 9, title: "Badiiy kecha", text: "Mashhur shoirlar bilan ijodiy uchrashuv yotoqxona majlislar zalida.", date: "3 kun avval", type: "Tadbir" },
    { id: 10, title: "Tibbiy ko'rik", text: "Barcha 1-kurs talabalari uchun bepul tibbiy ko'rik tashkil etilmoqda.", date: "4 kun avval", type: "Yangilik" }
  ],
  fakultetlar: {
    "Matematika": [
      { id: 101, title: "Al-Xorazmiy olimpiadasi", text: "Xalqaro matematika olimpiadasiga saralash bosqichi boshlandi.", date: "3 kun avval", type: "Tadbir" },
      { id: 102, title: "Yangi seminar", text: "Zamonaviy algebra muammolari bo'yicha ilmiy seminar tashkil etiladi.", date: "5 kun avval", type: "Yangilik" },
      { id: 103, title: "Grant yutib olindi", text: "Fakultetimizning 3 ta talabasi xorijiy universitetda o'qish grantini qo'lga kiritdi.", date: "1 hafta avval", type: "Muhim" },
      { id: 104, title: "Kutubxonaga yangi kitoblar", text: "Matematik analiz bo'yicha 50 ta yangi xorijiy darsliklar olib kelindi.", date: "10 kun avval", type: "Yangilik" },
      { id: 105, title: "Shaxmat musobaqasi", text: "Fakultet ichki turnirining g'oliblari aniqlandi.", date: "2 hafta avval", type: "Tadbir" }
    ],
    "Fizika": [
      { id: 201, title: "Kvant fizikasi laboratoriyasi", text: "Yotoqxonada fiziklar uchun mini-laboratoriya ishga tushdi.", date: "2 kun avval", type: "Yangilik" },
      { id: 202, title: "NASA bilan uchrashuv", text: "Onlayn tarzda NASA mutaxassisi bilan dars tashkil etiladi.", date: "4 kun avval", type: "Tadbir" },
      { id: 203, title: "Yillik hisobot", text: "Ilmiy ishlar bo'yicha fakultet reytingi e'lon qilindi.", date: "1 hafta avval", type: "Muhim" },
      { id: 204, title: "Fizika kechasi", text: "Qiziqarli tajribalar namoyish etiladigan shou dastur.", date: "10 kun avval", type: "Tadbir" },
      { id: 205, title: "Yangi asbob-uskunalar", text: "Yotoqxonadagi dars tayyorlash xonasiga yangi mikroskoplar berildi.", date: "2 hafta avval", type: "Yangilik" }
    ],
    "Iqtisodiyot": [
      { id: 301, title: "Startap sammit", text: "Talabalar startap loyihalari uchun investitsiya yig'ish imkoniyati.", date: "Bugun", type: "Tadbir" },
      { id: 302, title: "Valyuta birjasi tahlili", text: "Haftalik moliyaviy tahlil darsi yotoqxona foyesida.", date: "3 kun avval", type: "Yangilik" },
      { id: 303, title: "Amaliyot yangiliklari", text: "Banklarda pullik amaliyot o'tash uchun arizalar qabul qilinmoqda.", date: "6 kun avval", type: "Muhim" },
      { id: 304, title: "Biznes nonushta", text: "Muvaffaqiyatli tadbirkorlar bilan uchrashuv.", date: "9 kun avval", type: "Tadbir" },
      { id: 305, title: "Yangi kurslar", text: "Python for Finance kursi bepul asosda boshlanmoqda.", date: "2 hafta avval", type: "Yangilik" }
    ]
  }
};

export default function ElonlarPage() {
  const [view, setView] = useState<'main' | 'fakultetlar' | 'fakultet_ichi'>('main');
  const [selectedFakultet, setSelectedFakultet] = useState<string | null>(null);
  const [selectedElon, setSelectedElon] = useState<any>(null);
  const theme = useThemeStore((state) => state.theme);
  const isLight = theme === 'light';

  const colors = {
    Muhim: "border-l-red-500 shadow-red-500/10 hover:shadow-red-500/20",
    Tadbir: "border-l-green-500 shadow-green-500/10 hover:shadow-green-500/20",
    Yangilik: "border-l-blue-500 shadow-blue-500/10 hover:shadow-blue-500/20",
    Ogohlantirish: "border-l-yellow-500 shadow-yellow-500/10 hover:shadow-yellow-500/20",
  };

  return (
    <div className={`min-h-screen w-full p-6 md:p-12 transition-colors ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100 text-slate-900 selection:bg-blue-200' : 'bg-[#050507] text-white selection:bg-blue-600/30'
      }`}>
      <div className="max-w-360 mx-auto">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-20 gap-10">
          <div>
            <div className="flex flex-col mb-4">
              <h1 className="text-3xl font-black tracking-tighter bg-linear-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">YOTOQXONA</h1>
              <span className="text-[10px] text-gray-600 tracking-[0.5em] font-bold uppercase ml-1">Celestial Sanctuary</span>
            </div>
            <div className="flex items-center gap-6">
              {view !== 'main' && (
                <button
                  onClick={() => setView(view === 'fakultet_ichi' ? 'fakultetlar' : 'main')}
                  className={`p-4 rounded-full transition-all ${isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-white'
                    }`}
                >
                  <svg className="w-6 h-6 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              )}
              <h2 className={`text-5xl md:text-8xl font-black tracking-tighter ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {view === 'main' ? <>Xabarlar <span className="text-blue-600 italic">bo'limi</span></> :
                  view === 'fakultetlar' ? "Fakultetlar" : selectedFakultet}
              </h2>
            </div>
          </div>

          {/* FAKULTET YANGILIKLARI TUGMASI (O'zMU logosi bilan) */}
          {view === 'main' && (
            <button
              onClick={() => setView('fakultetlar')}
              className={`group flex items-center gap-6 border p-3 pr-10 rounded-[2.5rem] transition-all hover:scale-105 shadow-2xl active:scale-95 ${isLight ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center p-2 border-4 shadow-[0_0_30px_rgba(37,99,235,0.4)] overflow-hidden ${isLight ? 'bg-slate-50 border-blue-500' : 'bg-white border-blue-600'
                }`}>
                <img
                  src="https://upload.wikimedia.org/wikipedia/uz/b/b2/Uzbekistan_National_University_logo.png"
                  alt="O'zMU"
                  className="w-full h-full object-contain scale-125"
                  onError={(e) => { e.currentTarget.src = 'https://nuu.uz/wp-content/uploads/2021/05/logo-nuu-1.png' }}
                />
              </div>
              <div className="text-left">
                <span className="text-[10px] text-blue-500 font-black tracking-[0.2em] uppercase">O'zMU Tizimi</span>
                <p className={`text-xl font-black leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>Fakultet yangiliklari</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center group-hover:translate-x-2 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
            </button>
          )}
        </div>

        {/* ASOSIY GRID (10 TA ELON YOKI FAKULTETLAR) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 animate-in fade-in slide-in-from-bottom-10 duration-700">

          {/* 1. ASOSIY SAHIFA - 10 TA ELON */}
          {view === 'main' && DATA.umumiy.map((elon) => (
            <div
              key={elon.id}
              onClick={() => setSelectedElon(elon)}
              className={`group border-l-10 ${colors[elon.type as keyof typeof colors]} p-10 rounded-[3.5rem] cursor-pointer transition-all duration-500 hover:scale-[1.05] hover:-translate-y-4 shadow-2xl relative overflow-hidden ${isLight ? 'bg-white border-y border-r border-slate-200 shadow-slate-200' : 'bg-[#0f0f12]'
                }`}
            >
              <div className="flex justify-between items-center mb-8">
                <span className={`text-[10px] font-black px-4 py-1.5 rounded-xl border uppercase tracking-widest ${isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10'
                  }`}>{elon.type}</span>
                <span className={`text-xs font-bold italic ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>{elon.date}</span>
              </div>
              <h3 className={`text-3xl font-bold mb-5 transition-colors leading-tight ${isLight ? 'text-slate-900 group-hover:text-blue-600' : 'text-white group-hover:text-blue-500'
                }`}>{elon.title}</h3>
              <p className={`text-lg leading-relaxed line-clamp-2 italic font-medium ${isLight ? 'text-slate-600' : 'text-gray-500'
                }`}>"{elon.text}"</p>
              <div className="mt-8 flex items-center gap-3 text-blue-500 text-[10px] font-black tracking-[0.3em] uppercase">
                Batafsil <div className="h-0.5 w-10 bg-blue-600 group-hover:w-20 transition-all"></div>
              </div>
            </div>
          ))}

          {/* 2. FAKULTETLAR RO'YXATI (ASOSIY E'LONLAR DIZAYNIDA) */}
          {view === 'fakultetlar' && Object.keys(DATA.fakultetlar).map((name) => (
            <div
              key={name}
              onClick={() => { setSelectedFakultet(name); setView('fakultet_ichi'); }}
              className={`group border-l-10 border-l-purple-600 p-12 rounded-[4rem] cursor-pointer transition-all duration-500 hover:scale-[1.05] hover:shadow-[0_40px_100px_rgba(147,51,234,0.1)] relative ${isLight ? 'bg-white border-y border-r border-slate-200' : 'bg-[#0f0f12] border border-white/5'
                }`}
            >
              <div className="text-[10px] font-black text-purple-500 tracking-[0.4em] uppercase mb-4">O'zMU Fakulteti</div>
              <h3 className={`text-4xl md:text-5xl font-black mb-8 leading-none tracking-tighter ${isLight ? 'text-slate-900' : 'text-white'
                }`}>{name}</h3>
              <p className={`text-lg mb-10 font-medium italic ${isLight ? 'text-slate-500' : 'text-gray-500'
                }`}>Ushbu fakultetga oid so'nggi 2 haftalik yangiliklarni ko'rish uchun bosing.</p>
              <div className="flex items-center gap-4 text-purple-500 font-black tracking-widest text-xs">
                KIRISH <div className="h-1 w-12 bg-purple-600 group-hover:w-24 transition-all"></div>
              </div>
            </div>
          ))}

          {/* 3. FAKULTET ICHI - 5 TA YANGILIK */}
          {view === 'fakultet_ichi' && DATA.fakultetlar[selectedFakultet as keyof typeof DATA.fakultetlar].map((elon) => (
            <div
              key={elon.id}
              onClick={() => setSelectedElon(elon)}
              className={`group border-l-10 ${colors[elon.type as keyof typeof colors]} p-10 rounded-[3.5rem] cursor-pointer transition-all duration-500 hover:scale-[1.05] shadow-2xl ${isLight ? 'bg-white border-y border-r border-slate-200 shadow-slate-200' : 'bg-[#0f0f12]'
                }`}
            >
              <div className="flex justify-between mb-8">
                <span className={`text-[10px] font-black px-4 py-1.5 rounded-xl border uppercase ${isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10'
                  }`}>{elon.type}</span>
                <span className={`text-xs font-bold ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>{elon.date}</span>
              </div>
              <h3 className={`text-3xl font-bold mb-4 ${isLight ? 'text-slate-900' : 'text-white'}`}>{elon.title}</h3>
              <p className={`italic mb-6 ${isLight ? 'text-slate-600' : 'text-gray-500'}`}>"{elon.text}"</p>
              <div className="text-blue-500 font-black text-[10px] tracking-widest uppercase">Batafsil o'qish →</div>
            </div>
          ))}

        </div>

        {/* MODAL OYNA */}
        {selectedElon && (
          <div className={`fixed inset-0 z-100 flex items-center justify-center p-6 backdrop-blur-3xl animate-in zoom-in-95 duration-300 ${isLight ? 'bg-white/70' : 'bg-black/95'
            }`}>
            <div className={`w-full max-w-3xl rounded-[4rem] p-12 md:p-20 border shadow-2xl relative overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f0f12] border-white/10'
              }`}>
              <div className="absolute top-0 left-0 w-full h-4 bg-linear-to-r from-blue-600 via-purple-600 to-pink-600"></div>
              <h3 className={`text-5xl md:text-7xl font-black mb-10 tracking-tighter leading-[0.9] ${isLight ? 'text-slate-900' : 'text-white'
                }`}>{selectedElon.title}</h3>
              <p className={`text-2xl md:text-3xl leading-relaxed mb-16 font-medium italic opacity-90 ${isLight ? 'text-slate-600' : 'text-gray-400'
                }`}>"{selectedElon.text}"</p>
              <button
                onClick={() => setSelectedElon(null)}
                className={`w-full py-8 rounded-[2.5rem] font-black text-2xl transition-all active:scale-95 shadow-2xl ${isLight ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20' : 'bg-white text-black hover:bg-gray-200 shadow-white/10'
                  }`}
              >
                TUSHUNARLI
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}