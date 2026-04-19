"use client";

import React from 'react';
import { 
  Search, Bell, Zap, Calendar, Clock, 
  Tv, Megaphone, CheckCircle2, BookOpen,
  Users, Star, CreditCard, ShieldCheck, ArrowRight,
  Info, Landmark, Calculator, Cpu
} from 'lucide-react';

export default function AsosiyQism() {
  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:py-8 md:px-0 space-y-8 animate-in fade-in duration-1000">
      
      {/* 1. HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Amaliy matematika va IT fakulteti</p>
          <h1 className="text-4xl font-black italic text-white tracking-tighter">SHERZOD KARIMOV</h1>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input type="text" placeholder="Qidirish..." className="w-full bg-[#0f172a]/40 border border-white/5 rounded-2xl py-2.5 pl-10 pr-4 outline-none text-white text-sm focus:border-indigo-500/50" />
          </div>
          <button className="p-2.5 bg-[#0f172a]/40 border border-white/5 rounded-2xl relative hover:bg-white/5 transition-all">
            <Bell size={20} className="text-gray-400" />
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#050810] animate-pulse"></span>
          </button>
        </div>
      </header>

      {/* 2. ASOSIY GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* CHAP USTUN */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* ROOM CARD */}
          <div className="group relative bg-gradient-to-br from-indigo-600 via-blue-700 to-indigo-900 p-8 rounded-[45px] shadow-2xl shadow-indigo-500/20 overflow-hidden">
            <div className="absolute -right-4 -top-4 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
            <p className="text-[10px] font-black tracking-[0.3em] text-white/60 uppercase mb-2">Yotoqxona</p>
            <h2 className="text-6xl font-black italic text-white drop-shadow-2xl mb-8">#87</h2>
            <div className="grid grid-cols-4 gap-2 pt-6 border-t border-white/20">
              <StatMini l="QAVAT" v="3" />
              <StatMini l="KURS" v="2" />
              <StatMini l="GURUH" v="AM-22" />
              <StatMini l="HOLAT" v="Aktiv" active />
            </div>
          </div>

          {/* XONADOSHLAR QISMI - Siz qo'shildingiz */}
          <div className="bg-[#0f172a]/40 border border-white/5 rounded-[32px] p-6 backdrop-blur-md">
            <h3 className="text-[10px] font-black text-green-400 tracking-[0.2em] mb-6 flex items-center gap-2 uppercase">
              <Users size={14} /> Xonadoshlar (4 kishi)
            </h3>
            <div className="space-y-3">
              <Xonadosh name="Sherzod Karimov" role="Men (Siz)" img="SK" me />
              <Xonadosh name="Asadbek Jumanov" role="Sardor" img="AJ" />
              <Xonadosh name="Diyorbek Alimov" role="Talaba" img="DA" />
              <Xonadosh name="Javohir Toshpo'latov" role="Talaba" img="JT" />
            </div>
          </div>

          {/* TEZKOR AMALLAR */}
          <div className="bg-[#0f172a]/40 border border-white/5 rounded-[32px] p-6">
            <h3 className="text-[10px] font-black text-orange-400 tracking-[0.2em] mb-6 flex items-center gap-2 uppercase font-mono">
              <Zap size={14} fill="currentColor" /> Tezkor amallar
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <QuickAction icon={<Clock className="text-blue-400" />} label="Dush Navbati" />
              <QuickAction icon={<Calculator className="text-green-400" />} label="Kalkulyator" />
            </div>
          </div>
        </div>

        {/* O'NG USTUN */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* E'LONLAR - Yangi e'lonlar qo'shildi */}
          <div className="bg-[#0f172a]/40 border border-white/5 rounded-[32px] p-7">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-[10px] font-black text-indigo-400 tracking-[0.2em] flex items-center gap-2 uppercase">
                <Megaphone size={14} className="animate-pulse" /> Fakultet va TTJ Yangiliklari
              </h3>
              <span className="text-[9px] px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg font-bold">YANGI</span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <ElonCard icon={<Users />} title="3-Qavat bollariga majlis" time="Bugun 22:00" desc="3-qavat foyesida barcha talabalar qatnashishi shart." col="text-red-400" bg="bg-red-400/10" />
              <ElonCard icon={<Cpu />} title="IT Fakultet: Hackathon" time="25-Aprel" desc="Sun'iy intellekt yo'nalishida musobaqa ro'yxatdan o'tish boshlandi." col="text-emerald-400" bg="bg-emerald-400/10" />
              <ElonCard icon={<BookOpen />} title="Frontend: React JS" time="Bugun 20:00" desc="Ma'naviyat xonasida amaliy loyiha ustida ishlash." col="text-indigo-400" bg="bg-indigo-400/10" />
              <ElonCard icon={<Calculator />} title="Matematika Olimpiadasi" time="Dushanba" desc="Fakultetlararo olimpiadada qatnashish uchun ariza bering." col="text-yellow-400" bg="bg-yellow-400/10" />
            </div>
          </div>

          {/* TO'LOV QISMI - Detallashtirildi */}
          <div className="bg-[#0f172a]/40 border border-white/5 rounded-[32px] p-8 group">
             <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 italic font-black text-2xl">₿</div>
                <div>
                  <h4 className="text-xl font-black text-white italic">To'lovlar Monitoringi</h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Shaxsiy hisob-kitob</p>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4 mb-6">
                <PaymentInfo label="Oxirgi to'lov" value="350,000 UZS" date="12.03.2026" color="text-green-400" />
                <PaymentInfo label="Keyingi to'lov" value="350,000 UZS" date="12.04.2026" color="text-orange-400" />
             </div>

             <div className="p-5 bg-white/5 rounded-[24px] border border-white/5">
                <div className="flex justify-between items-center mb-3">
                   <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">To'lov muddati (Deadline)</span>
                   <span className="text-xs font-bold text-red-400">20-Aprel, 2026</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                   <div className="w-[85%] h-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500"></div>
                </div>
                <p className="text-[9px] text-gray-500 mt-3 italic text-center">* Muddati o'tgan to'lovlar uchun jarima hisoblanishi mumkin.</p>
             </div>
          </div>

          {/* JADVAL */}
          <div className="bg-[#0f172a]/40 border border-white/5 rounded-[32px] p-7">
            <h3 className="text-[10px] font-black text-white tracking-[0.2em] flex items-center gap-2 uppercase italic mb-6">
              <Calendar size={14} className="text-indigo-500" /> Kechki Rejalar
            </h3>
            <div className="space-y-3">
              <ScheduleItem t="20:00" task="Frontend kursi" st="Hozir" active />
              <ScheduleItem t="22:00" task="3-qavat Majlisi" st="Kutilmoqda" warning />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- KOMPONENTLAR ---

function StatMini({ l, v, active = false }: any) {
  return (
    <div className="text-center">
      <p className="text-[15px] font-black text-white/40 mb-1">{l}</p>
      <p className={`text-xl font-black ${active ? 'text-green-300' : 'text-white'}`}>{v}</p>
    </div>
  );
}

function Xonadosh({ name, role, img, me = false }: any) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-2xl transition-all border ${me ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-bold border ${me ? 'bg-indigo-600 text-white' : 'bg-indigo-600/20 text-indigo-400 border-indigo-500/20'}`}>{img}</div>
        <div>
          <p className="text-xs font-bold text-white leading-none mb-1">{name}</p>
          <p className={`text-[10px] ${me ? 'text-indigo-300 font-bold' : 'text-gray-500'}`}>{role}</p>
        </div>
      </div>
      <div className={`w-1.5 h-1.5 rounded-full ${me ? 'bg-indigo-400 animate-pulse' : 'bg-green-500'}`}></div>
    </div>
  );
}

function ElonCard({ icon, title, time, desc, col, bg }: any) {
  return (
    <div className={`flex items-start gap-4 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all ${bg}`}>
      <div className={`p-2 rounded-xl ${col} bg-white/5`}>{icon}</div>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs font-black text-white uppercase italic">{title}</p>
          <span className="text-[9px] text-gray-500 font-black tracking-tighter uppercase">{time}</span>
        </div>
        <p className="text-[10px] text-gray-400 leading-tight">{desc}</p>
      </div>
    </div>
  );
}

function PaymentInfo({ label, value, date, color }: any) {
  return (
    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
      <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">{label}</p>
      <p className={`text-sm font-black italic mb-1 ${color}`}>{value}</p>
      <p className="text-[9px] text-gray-600 font-bold">{date}</p>
    </div>
  );
}

function QuickAction({ icon, label }: any) {
  return (
    <button className="flex flex-col items-center justify-center p-5 bg-white/5 rounded-[28px] border border-white/5 hover:border-indigo-500/30 transition-all group w-full">
      <div className="mb-2 group-hover:scale-110 transition-transform">{icon}</div>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
    </button>
  );
}

function ScheduleItem({ t, task, st, active = false, warning = false }: any) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl border ${active ? 'bg-indigo-600 border-indigo-400' : warning ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-transparent'}`}>
      <div className="flex items-center gap-4">
        <span className={`text-[10px] font-black font-mono ${active ? 'text-white' : 'text-gray-500'}`}>{t}</span>
        <span className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-300'}`}>{task}</span>
      </div>
      <span className={`text-[9px] px-2 py-1 rounded-lg font-black uppercase ${active ? 'bg-white text-indigo-600' : warning ? 'text-red-400 border border-red-500/20' : 'text-gray-500'}`}>{st}</span>
    </div>
  );
}