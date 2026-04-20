"use client";

import { useState } from "react";
import Link from "next/link";
import React from "react";
import { 
  Home, 
  Bell, 
  Clock, 
  FileText, 
  User, 
  AlertTriangle, 
  ChevronDown 
} from "lucide-react";

// ─── Turlar ───────────────────────────────────────────────────────────────────
interface QoidaItem {
  id: string;
  sarlavha: string;
  emoji: string;
  soni: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  bandlar: string[];
}

// ─── Ma'lumotlar ──────────────────────────────────────────────────────────────
const qoidalarData: QoidaItem[] = [
  {
    id: "yashash",
    sarlavha: "Yashash tartibi",
    emoji: "🏠",
    soni: "4 ta qoida",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/30",
    bandlar: [
      "Kirish-chiqish vaqti: 06:00 dan 23:00 gacha.",
      "Xonalarni har kuni soat 09:00 gacha tozalash shart.",
      "Begona shaxslarni olib kirish taqiqlanadi.",
      "Haftalik umumiy tozalik ishlarida qatnashish majburiy.",
    ],
  },
  {
    id: "intizom",
    sarlavha: "Intizom",
    emoji: "🔇",
    soni: "3 ta qoida",
    colorClass: "text-purple-500",
    bgClass: "bg-purple-500/10",
    borderClass: "border-purple-500/30",
    bandlar: [
      "Sukunat vaqti: 22:00 dan 07:00 gacha.",
      "Alkogol va tamaki mahsulotlari qat'iyan man etiladi.",
      "Jamoat joylarida baland ovozda gaplashish taqiqlanadi.",
    ],
  },
  {
    id: "kommunal",
    sarlavha: "Kommunal xizmatlar",
    emoji: "⚡",
    soni: "3 ta qoida",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    bandlar: [
      "Elektr energiyasini tejash va chiroqni o'chirib yurish.",
      "Suvdan oqilona foydalanish shart.",
      "Nosozliklar haqida darhol ma'muriyatga xabar bering.",
    ],
  },
  {
    id: "jazo",
    sarlavha: "Jazo choralari",
    emoji: "🛡️",
    soni: "3 ta qoida",
    colorClass: "text-red-500",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/30",
    bandlar: [
      "Birinchi qoidabuzarlik: rasmiy ogohlantirish.",
      "Ikkinchi qoidabuzarlik: reytingdan 30 ball chegirish.",
      "Takroriy holatda: yotoqxonadan chetlatish.",
    ],
  },
];

// ─── Nav tugmasi Komponenti ───────────────────────────────────────────────────
function NavItem({ href, label, icon: Icon, isActive = false }: any) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
      <Icon size={24} />
      <span className="text-[10px] font-medium">{label}</span>
      {isActive && <div className="w-1 h-1 rounded-full bg-blue-500" />}
    </Link>
  );
}

export default function QoidalarPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white px-5 py-10 pb-32 font-sans selection:bg-blue-500/30">
      
      {/* BACKGROUND DECORATION */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_2px_2px,rgba(59,130,246,0.05)_1px,transparent_0)] bg-[size:32px_32px] pointer-events-none" />

      <div className="relative max-w-2xl mx-auto">
        
        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]">
            QOIDALAR
          </h1>
          <p className="text-gray-500 text-sm mt-2 font-medium tracking-wide">YOTOQXONA ICHKI TARTIBI</p>
        </div>

        {/* WARNING CARD */}
        <div className="flex items-center gap-4 p-4 bg-red-500/10 border-l-4 border-red-500 rounded-xl mb-8 animate-pulse-subtle">
          <AlertTriangle className="text-red-500 shrink-0" size={20} />
          <p className="text-red-400 text-xs md:text-sm font-bold italic leading-tight">
            Qoidalarni buzish talaba reytingiga va yashash huquqiga ta&apos;sir qiladi!
          </p>
        </div>

        {/* QOIDALAR RO'YXATI */}
        <div className="space-y-4">
          {qoidalarData.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setOpenId(isOpen ? null : item.id)}
                className={`group cursor-pointer rounded-2xl border transition-all duration-300 backdrop-blur-md overflow-hidden
                  ${isOpen ? `bg-white/10 ${item.borderClass} shadow-lg` : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
              >
                {/* Accordion Header */}
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${item.bgClass} flex items-center justify-center text-2xl`}>
                      {item.emoji}
                    </div>
                    <div>
                      <h3 className="font-bold text-[15px]">{item.sarlavha}</h3>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${item.bgClass} ${item.colorClass}`}>
                        {item.soni}
                      </span>
                    </div>
                  </div>
                  <ChevronDown 
                    className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-white' : ''}`} 
                    size={20} 
                  />
                </div>

                {/* Accordion Body */}
                <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-5 pb-5 pt-2 border-t border-white/5 ml-16">
                    <ul className="space-y-3">
                      {item.bandlar.map((band, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-gray-400">
                          <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-current ${item.colorClass}`} />
                          <span className="leading-relaxed">{band}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MOBILE NAVIGATION */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#0a0f1e]/80 backdrop-blur-xl border-t border-white/5 flex justify-around items-center px-4 z-50">
        <NavItem href="/talaba/dashboard" label="Asosiy" icon={Home} />
        <NavItem href="/talaba/elonlar" label="E'lonlar" icon={Bell} />
        <NavItem href="/talaba/navbat" label="Navbat" icon={Clock} />
        <NavItem href="/talaba/qoidalar" label="Qoidalar" icon={FileText} isActive />
        <NavItem href="/talaba/profil" label="Profil" icon={User} />
      </nav>

      {/* TAILWIND ANIMATIONS (Config faylda yoki bu yerda) */}
      <style jsx global>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          animation: gradient-x 3s linear infinite;
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}