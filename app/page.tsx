"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Sparkles, ArrowRight, ShieldCheck, Cpu, Layers, Activity 
} from 'lucide-react';

export default function Home() {
  const roles = [
    {
      title: "Talaba",
      desc: "Arizalar yozish, to'lovlar monitoringi, haftalik navbatchilik jadvali va shaxsiy vazifalar boshqaruvi.",
      icon: "/3d-icons/student_3d_v4.png",
      route: "/login",
      color: "from-blue-600 to-cyan-500",
      glow: "shadow-blue-500/20 hover:shadow-blue-500/30 border-blue-500/20",
      badge: "IT & Masofaviy Ta'lim"
    },
    {
      title: "Qavat Sardori",
      desc: "Qavatdagi navbatchilik jadvalini boshqarish, talabalar davomati va tezkor e'lonlar tarqatish paneli.",
      icon: "/3d-icons/user_3d_v4.png",
      route: "/sardor/dashboard",
      color: "from-indigo-600 to-purple-500",
      glow: "shadow-indigo-500/20 hover:shadow-indigo-500/30 border-indigo-500/20",
      badge: "Nazorat va Intizom"
    },
    {
      title: "Tarbiyachi",
      desc: "Talabalar arizalarini ko'rib chiqish, ogohlantirishlar yozish va umumiy yotoqxona tartibini kuzatish.",
      icon: "/3d-icons/educator_3d_v4.png",
      route: "/kirish/tarbiyachi",
      color: "from-emerald-600 to-teal-500",
      glow: "shadow-emerald-500/20 hover:shadow-emerald-500/30 border-emerald-500/20",
      badge: "Pedagogik Boshqaruv"
    },
    {
      title: "Tizim Admini",
      desc: "Foydalanuvchilar bazasi, to'lov kvitansiyalari, 3D xonalar xaritasi va tizim sozlamalarini boshqarish.",
      icon: "/3d-icons/server_3d.png",
      route: "/kirish/admin",
      color: "from-rose-600 to-orange-500",
      glow: "shadow-rose-500/20 hover:shadow-rose-500/30 border-rose-500/20",
      badge: "To'liq Nazorat"
    }
  ];

  const features = [
    {
      title: "Sun'iy Intellekt",
      desc: "AI yordamida bir necha soniyada rasmiy ariza va tushuntirish xatlarini yaratish.",
      icon: "/3d-icons/document_3d_v4.png"
    },
    {
      title: "Interaktiv Jadval",
      desc: "Haftalik tozalik navbatchiligi jadvalini drag-and-drop orqali oson taqsimlash.",
      icon: "/3d-icons/clock_3d_v4.png"
    },
    {
      title: "Xavfsizlik",
      desc: "Supabase RLS qoidalari asosida himoyalangan ma'lumotlar va xavfsiz autentifikatsiya.",
      icon: "/3d-icons/check_3d_v4.png"
    },
    {
      title: "Tezkor Sinxronizatsiya",
      desc: "Real-time rejimda e'lonlar va ma'lumotlarning barcha qurilmalarda bir zumda yangilanishi.",
      icon: "/3d-icons/refresh_3d.png"
    }
  ];

  return (
    <div className="min-h-screen bg-[#02040a] text-white font-sans overflow-x-hidden relative pb-20 selection:bg-indigo-500 selection:text-white">
      {/* Mesh Glow Background */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-radial-gradient from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.007)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.007)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-50" />

      {/* Navigation */}
      <nav className="relative z-50 max-w-7xl mx-auto px-4 py-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-500/20">
            S
          </div>
          <span className="text-base font-black uppercase tracking-widest bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            SmartDorm
          </span>
        </div>
        
        <Link 
          href="/login" 
          className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95"
        >
          <span>Kirish</span>
          <ArrowRight size={12} />
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 pt-12 md:pt-20 pb-16 text-center space-y-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-[10px] font-black uppercase tracking-widest text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
        >
          <Sparkles size={11} className="animate-pulse" /> 
          Smart Yotoqxona Boshqaruv Tizimi
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] uppercase max-w-4xl mx-auto"
        >
          Yotoqxonangizni <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Smart Tizimga
          </span> O&apos;tkazing
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xs sm:text-sm text-gray-400 max-w-2xl mx-auto leading-relaxed"
        >
          Talabalar, Sardorlar, Tarbiyachilar va Adminstratorlar uchun barcha boshqaruv funksiyalarini jamlagan, zamonaviy AI texnologiyalariga asoslangan mukammal platforma.
        </motion.p>

        {/* 3D Mockup element */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="relative max-w-2xl mx-auto pt-8 flex items-center justify-center"
        >
          <div className="absolute w-[250px] h-[250px] bg-indigo-500/10 rounded-full blur-[80px] -z-10 animate-pulse" />
          <motion.img 
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            src="/3d-icons/server_3d.png" 
            alt="Dashboard 3D"
            className="w-48 sm:w-64 drop-shadow-[0_15px_50px_rgba(99,102,241,0.25)] relative z-10"
          />
          {/* Floating icons around */}
          <motion.img 
            animate={{ y: [0, 8, 0], rotate: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
            src="/3d-icons/student_3d_v4.png"
            className="absolute left-[10%] top-[40%] w-16 sm:w-20 opacity-90 drop-shadow-lg"
          />
          <motion.img 
            animate={{ y: [0, -8, 0], rotate: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
            src="/3d-icons/educator_3d_v4.png"
            className="absolute right-[10%] top-[30%] w-16 sm:w-20 opacity-90 drop-shadow-lg"
          />
        </motion.div>
      </section>

      {/* Role Selection Grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 py-16 space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-indigo-400">Tizimga Kirish</h2>
          <h3 className="text-2xl font-black uppercase tracking-tight text-white">Kirish toifasini tanlang</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {roles.map((role, idx) => (
            <motion.div
              key={role.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              whileHover={{ y: -6 }}
              className={`backdrop-blur-xl bg-white/[0.02] border p-6 rounded-[32px] flex flex-col justify-between min-h-[360px] shadow-2xl relative overflow-hidden group ${role.glow}`}
            >
              {/* Colored Glow behind icon */}
              <div className={`absolute top-[-20%] right-[-20%] w-[50%] h-[40%] rounded-full blur-[40px] bg-gradient-to-br ${role.color} opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none`} />

              <div className="space-y-4">
                <span className="text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-gray-400">
                  {role.badge}
                </span>

                <div className="h-32 flex items-center justify-center pt-2">
                  <motion.img 
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 3 + idx * 0.3, ease: "easeInOut" }}
                    src={role.icon} 
                    alt={role.title}
                    className="h-28 object-contain drop-shadow-[0_10px_20px_rgba(255,255,255,0.05)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-lg font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                    {role.title}
                  </h4>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    {role.desc}
                  </p>
                </div>
              </div>

              <Link 
                href={role.route}
                className={`w-full mt-6 py-3 rounded-2xl bg-gradient-to-r ${role.color} text-white font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-1.5 shadow-lg transition-transform active:scale-95`}
              >
                <span>Tizimga Kirish</span>
                <ArrowRight size={12} />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Showcase */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 py-16 space-y-12 border-t border-white/5">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-indigo-400">Imkoniyatlar</h2>
          <h3 className="text-2xl font-black uppercase tracking-tight text-white">Tizimning eng kuchli jihatlari</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feat, idx) => (
            <div 
              key={feat.title}
              className="p-5 rounded-3xl bg-white/[0.01] border border-white/5 flex items-start gap-4 transition-all hover:bg-white/[0.03]"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                <img src={feat.icon} alt={feat.title} className="w-8 h-8 object-contain" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-white">{feat.title}</h4>
                <p className="text-[10px] text-gray-500 leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Statistics & Trust footer */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 py-10 text-center space-y-4">
        <div className="flex justify-center gap-6 text-gray-600 text-xs font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-indigo-500" />
            <span>Ishonchli va Xavfsiz</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu size={14} className="text-indigo-500" />
            <span>AI Integratsiya</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity size={14} className="text-indigo-500" />
            <span>Real-time monitoring</span>
          </div>
        </div>
        <p className="text-[9px] text-gray-700">
          © {new Date().getFullYear()} SmartDorm. Barcha huquqlar himoyalangan. Farg&apos;ona Davlat Universiteti hamkorligida.
        </p>
      </section>
    </div>
  );
}