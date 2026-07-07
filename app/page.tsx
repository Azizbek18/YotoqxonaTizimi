"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Sparkles, ArrowRight, ShieldCheck, Cpu, Activity, Clock, CheckCircle2, XCircle, LogIn, UploadCloud, UserPlus, RefreshCw
} from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { useThemeStore } from '@/lib/stores/theme-store';
import { supabase } from '@/lib/supabase';

interface PermitRequest {
  status: 'pending' | 'rejected' | 'approved' | 'registered';
  full_name?: string;
  reject_reason?: string | null;
  room_number?: string | number | null;
  passport_series?: string;
  jshshir?: string;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [permitRequest, setPermitRequest] = useState<PermitRequest | null>(null);
  const [checkingPermit, setCheckingPermit] = useState(false);

  const theme = useThemeStore((state) => state.theme);
  const isLight = mounted && theme === 'light';

  const checkStatus = async (silent = false) => {
    if (typeof window === 'undefined') return;
    const passport = localStorage.getItem('student_permit_passport');
    const jshshir = localStorage.getItem('student_permit_jshshir');
    if (passport && jshshir) {
      if (!silent) setCheckingPermit(true);
      try {
        const { data, error } = await supabase
          .from('permit_requests')
          .select('*')
          .eq('passport_series', passport.toUpperCase().replace(/\s/g, ''))
          .eq('jshshir', jshshir.trim())
          .maybeSingle();

        if (!error && data) {
          setPermitRequest(data);
        } else {
          setPermitRequest(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!silent) setCheckingPermit(false);
      }
    } else {
      setPermitRequest(null);
    }
  };

  useEffect(() => {
    const mountId = window.setTimeout(() => {
      setMounted(true);
      setIsMobile(window.innerWidth < 640);
    }, 0);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    
    checkStatus();

    return () => {
      window.clearTimeout(mountId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleClearStatus = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('student_permit_passport');
      localStorage.removeItem('student_permit_jshshir');
      setPermitRequest(null);
    }
  };

  // Determine active step (1, 2, or 3) for visual guide
  let activeStep = 1;
  if (permitRequest) {
    if (permitRequest.status === 'pending' || permitRequest.status === 'rejected') {
      activeStep = 2;
    } else if (permitRequest.status === 'approved' || permitRequest.status === 'registered') {
      activeStep = 3;
    }
  }

  const staffRoles = [
    {
      title: "Dekan (Zamdekan)",
      desc: "Yo'llanmalarni tasdiqlash, xonalarga joylashtirish va Excel jadvallarini yuklab olish.",
      color: "from-amber-500/20 to-orange-600/25 border-amber-500/30 text-amber-300",
      btnColor: "from-amber-500 to-orange-600 shadow-amber-500/20 hover:shadow-amber-500/35",
      icon: "https://img.icons8.com/3d-fluency/188/businessman.png"
    },
    {
      title: "Tarbiyachi",
      desc: "Yotoqxona tartibini nazorat qilish, arizalarni tasdiqlash va ogohlantirishlar berish.",
      color: "from-emerald-500/20 to-teal-600/25 border-emerald-500/30 text-emerald-300",
      btnColor: "from-emerald-500 to-teal-600 shadow-emerald-500/20 hover:shadow-emerald-500/35",
      icon: "https://img.icons8.com/3d-fluency/188/manager.png"
    },
    {
      title: "Qavat Sardori",
      desc: "Navbatchilik jadvallarini tuzish va qavat tozaligini nazorat qilish.",
      color: "from-indigo-500/20 to-purple-600/25 border-indigo-500/30 text-indigo-300",
      btnColor: "from-indigo-500 to-purple-600 shadow-indigo-500/20 hover:shadow-indigo-500/35",
      icon: "https://img.icons8.com/3d-fluency/188/user-male-circle.png"
    },
    {
      title: "Tizim Admini",
      desc: "Foydalanuvchilar bazasi, sozlamalar va 3D xonalar xaritasini to'liq boshqarish.",
      color: "from-rose-500/20 to-red-600/25 border-rose-500/30 text-rose-300",
      btnColor: "from-rose-500 to-red-600 shadow-rose-500/20 hover:shadow-rose-500/35",
      icon: "https://img.icons8.com/3d-fluency/188/laptop.png"
    }
  ];

  return (
    <div className={`min-h-screen overflow-x-hidden relative pb-20 selection:bg-indigo-500 selection:text-white transition-colors duration-500 ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#02040c] text-white'
    }`} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      {/* Import premium Google Fonts dynamically */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;950&family=Syne:wght@800;950&display=swap');
        .syne-font {
          font-family: 'Syne', sans-serif;
          letter-spacing: -0.04em;
        }
        .glass-panel {
          backdrop-filter: blur(28px) saturate(120%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.12), 0 8px 32px 0 rgba(0, 0, 0, 0.4);
        }
        .light .glass-panel {
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.8), 0 8px 32px 0 rgba(15, 23, 42, 0.08);
        }
        .glow-sphere {
          border-radius: 50%;
          filter: blur(140px);
          opacity: 0.15;
          pointer-events: none;
          position: absolute;
          transform: translate3d(0,0,0);
          will-change: transform;
        }
        .light .glow-sphere {
          opacity: 0.06;
          filter: blur(100px);
        }
      `}} />

      {/* 3D Floating Glowing Background Spheres */}
      <motion.div 
        animate={isMobile ? {} : {
          x: [0, 80, -40, 0],
          y: [0, -90, 60, 0],
          scale: [1, 1.2, 0.9, 1]
        }}
        transition={{ repeat: Infinity, duration: 18, ease: "easeInOut" }}
        className="glow-sphere bg-blue-500 w-[450px] h-[450px] top-[-5%] left-[-10%]"
      />
      <motion.div 
        animate={isMobile ? {} : {
          x: [0, -100, 50, 0],
          y: [0, 80, -70, 0],
          scale: [1, 0.9, 1.1, 1]
        }}
        transition={{ repeat: Infinity, duration: 22, ease: "easeInOut" }}
        className="glow-sphere bg-purple-500 w-[500px] h-[500px] top-[20%] right-[-15%]"
      />
      <motion.div 
        animate={isMobile ? {} : {
          x: [0, 50, -60, 0],
          y: [0, -40, 80, 0],
          scale: [1, 1.15, 0.95, 1]
        }}
        transition={{ repeat: Infinity, duration: 20, ease: "easeInOut" }}
        className="glow-sphere bg-pink-500 w-[350px] h-[350px] bottom-[5%] left-[5%]"
      />

      {/* Grid Pattern overlay */}
      <div className={`absolute inset-0 bg-[size:50px_50px] pointer-events-none opacity-40 transition-opacity ${
        isLight
          ? 'bg-[linear-gradient(rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.015)_1px,transparent_1px)]'
          : 'bg-[linear-gradient(rgba(255,255,255,0.006)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.006)_1px,transparent_1px)]'
      }`} />

      {/* Navigation */}
      <nav className={`relative z-50 max-w-7xl mx-auto px-4 py-5 flex justify-between items-center border-b transition-colors duration-500 ${
        isLight ? 'border-slate-200' : 'border-white/5'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-500/30 border border-white/10 scale-105">
            S
          </div>
          <span className={`text-xl font-black uppercase tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-r transition-colors duration-300 syne-font ${
            isLight ? 'from-slate-900 to-slate-655' : 'from-white via-gray-100 to-gray-300'
          }`}>
            SmartDorm
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link 
            href="/login" 
            className={`px-5 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 shadow-md ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-350 text-slate-800 shadow-slate-200'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white shadow-black/40'
            }`}
          >
            <span>Tizimga Kirish</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 pt-12 md:pt-20 text-center space-y-5">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`inline-flex items-center gap-2.5 px-4.5 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-colors duration-500 ${
            isLight
              ? 'border-indigo-500/20 bg-indigo-500/5 text-indigo-600 shadow-sm shadow-indigo-50'
              : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400 shadow-md shadow-indigo-950/20'
          }`}
        >
          <Sparkles size={12} className="animate-pulse text-indigo-500" /> 
          YOTOQXONADA JOY OLISH MULTI-BOSQICHLI TIZIMI
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.05] uppercase max-w-4xl mx-auto transition-colors duration-500 syne-font ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}
        >
          Yotoqxonaga Joylashish <br />
          <span className="bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 bg-clip-text text-transparent drop-shadow-sm">
            3 bosqichli smart
          </span> oqimda
        </motion.h1>
      </section>

      {/* 3D Flow Timeline Visual Guide */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 pt-10">
        <div className={`p-6 sm:p-8 rounded-[36px] glass-panel ${
          isLight ? 'bg-white/80' : 'bg-white/[0.02]'
        }`}>
          <p className={`text-[10px] font-black uppercase tracking-[0.32em] text-center mb-8 ${isLight ? 'text-slate-500' : 'text-slate-400'} syne-font`}>
            Yo&apos;llanma yuklashdan tizimga kirishgacha bo&apos;lgan yo&apos;l
          </p>

          <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center flex-1 z-10 relative">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className={`w-14 h-14 rounded-[20px] flex items-center justify-center font-black transition-all ${
                  activeStep === 1 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 scale-110 shadow-lg shadow-blue-500/40 border border-blue-400/20'
                    : activeStep > 1 
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                      : isLight ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-white/5 text-slate-650 border border-white/5'
                }`}
              >
                {activeStep > 1 ? <CheckCircle2 size={24} /> : "1"}
              </motion.div>
              <h4 className={`text-xs font-black uppercase tracking-wider mt-4 syne-font ${activeStep === 1 ? 'text-blue-500' : isLight ? 'text-slate-900' : 'text-white'}`}>
                Yo&apos;llanma yuklash
              </h4>
              <p className={`text-[10px] leading-relaxed mt-1 max-w-[170px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                my.gov.uz dan olingan yo&apos;llanmani yuklab yuboring.
              </p>
            </div>

            {/* Connecting line 1 */}
            <div className={`hidden md:block absolute left-[18%] right-[52%] top-7 h-[3px] transition-colors ${
              activeStep > 1 ? 'bg-emerald-500' : isLight ? 'bg-slate-200' : 'bg-white/10'
            }`} />

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center flex-1 z-10 relative">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className={`w-14 h-14 rounded-[20px] flex items-center justify-center font-black transition-all ${
                  activeStep === 2 
                    ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20 scale-110 shadow-lg shadow-amber-500/40 border border-amber-400/20'
                    : activeStep > 2 
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                      : isLight ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-white/5 text-slate-650 border border-white/5'
                }`}
              >
                {activeStep > 2 ? <CheckCircle2 size={24} /> : activeStep === 2 ? <Clock size={22} className="animate-spin" /> : "2"}
              </motion.div>
              <h4 className={`text-xs font-black uppercase tracking-wider mt-4 syne-font ${activeStep === 2 ? 'text-amber-500' : isLight ? 'text-slate-900' : 'text-white'}`}>
                Dekan tasdig&apos;i
              </h4>
              <p className={`text-[10px] leading-relaxed mt-1 max-w-[170px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                Dekan arizani ko&apos;rib chiqib, xona biriktiradi.
              </p>
            </div>

            {/* Connecting line 2 */}
            <div className={`hidden md:block absolute left-[52%] right-[18%] top-7 h-[3px] transition-colors ${
              activeStep > 2 ? 'bg-emerald-500' : isLight ? 'bg-slate-200' : 'bg-white/10'
            }`} />

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center flex-1 z-10 relative">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className={`w-14 h-14 rounded-[20px] flex items-center justify-center font-black transition-all ${
                  activeStep === 3 
                    ? permitRequest?.status === 'registered'
                      ? 'bg-sky-500 text-white ring-4 ring-sky-500/20 scale-110 shadow-lg shadow-sky-500/40 border border-sky-400/20'
                      : 'bg-emerald-500 text-white ring-4 ring-emerald-500/20 scale-110 shadow-lg shadow-emerald-500/40 border border-emerald-400/20'
                    : isLight ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-white/5 text-slate-650 border border-white/5'
                }`}
              >
                {permitRequest?.status === 'registered' ? <CheckCircle2 size={24} /> : "3"}
              </motion.div>
              <h4 className={`text-xs font-black uppercase tracking-wider mt-4 syne-font ${activeStep === 3 ? 'text-emerald-500' : isLight ? 'text-slate-900' : 'text-white'}`}>
                Akkaunt faolligi
              </h4>
              <p className={`text-[10px] leading-relaxed mt-1 max-w-[170px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                Parol o&apos;rnatib tizimga to&apos;liq kirish!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Glass Action Container */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 pt-8">
        {checkingPermit ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] text-indigo-400 uppercase tracking-[0.25em] font-black animate-pulse syne-font">Ma&apos;lumotlar yangilanmoqda...</p>
          </div>
        ) : permitRequest ? (
          <div className={`p-6 sm:p-10 rounded-[36px] glass-panel text-center space-y-6 relative overflow-hidden transition-all ${
            isLight ? 'bg-white/90' : 'bg-[#060a17]/90'
          }`}>
            <div className="absolute inset-0 bg-radial-gradient from-indigo-500/10 via-transparent to-transparent opacity-40 pointer-events-none" />

            {permitRequest.status === 'pending' && (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-[24px] bg-amber-500/15 text-amber-500 border border-amber-500/30 shadow-lg shadow-amber-500/10">
                  <Clock size={32} className="animate-pulse" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-black uppercase tracking-wider text-amber-450 syne-font">Arizangiz Kutilmoqda</h3>
                  <p className={`text-xs leading-relaxed max-w-lg mx-auto ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Hurmatli <b>{permitRequest.full_name}</b>, siz yuborgan yotoqxona yo&apos;llanmasi hozirda ko&apos;rib chiqilmoqda. Arizangiz tasdiqlanib, Dekan xona raqamini belgilaganidan so&apos;ng ro&apos;yxatdan o&apos;tish imkoni ochiladi.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2 relative z-10">
                  <button
                    onClick={() => checkStatus(false)}
                    className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-550 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
                  >
                    <RefreshCw size={14} className="animate-spin" style={{ animationDuration: '4s' }} /> Statusni yangilash
                  </button>
                  <button
                    onClick={handleClearStatus}
                    className={`flex-1 py-3.5 px-6 rounded-2xl border font-black text-xs uppercase tracking-wider transition-all active:scale-[0.98] ${
                      isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    Boshqa yo&apos;llanma yuklash
                  </button>
                </div>
              </>
            )}

            {permitRequest.status === 'rejected' && (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-[24px] bg-rose-500/15 text-rose-500 border border-rose-500/30 shadow-lg shadow-rose-500/10">
                  <XCircle size={32} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-black uppercase tracking-wider text-rose-500 syne-font">Ariza Rad Etildi</h3>
                  <p className={`text-xs leading-relaxed max-w-lg mx-auto ${isLight ? 'text-slate-605' : 'text-slate-300'}`}>
                    Yo&apos;llanma arizangiz rad etilgan. Sababi: <span className="font-bold text-rose-455">{permitRequest.reject_reason || "Hujjat talabga javob bermaydi."}</span>
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2 relative z-10">
                  <Link
                    href="/ruxsatnoma-yuborish"
                    className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-655 text-white font-black text-xs uppercase tracking-wider text-center transition-all shadow-lg shadow-rose-500/20 active:scale-[0.98]"
                  >
                    Qayta yuborish (my.gov.uz)
                  </Link>
                  <button
                    onClick={handleClearStatus}
                    className={`flex-1 py-3.5 px-6 rounded-2xl border font-black text-xs uppercase tracking-wider transition-all active:scale-[0.98] ${
                      isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    Boshqa pasport
                  </button>
                </div>
              </>
            )}

            {permitRequest.status === 'approved' && (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-[24px] bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 size={32} className="animate-bounce" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-black uppercase tracking-wider text-emerald-555 syne-font">Yo&apos;llanmangiz tasdiqlandi!</h3>
                  <p className={`text-xs leading-relaxed max-w-lg mx-auto ${isLight ? 'text-slate-605' : 'text-slate-200'}`}>
                    Tabriklaymiz, <b>{permitRequest.full_name}</b>! Yo&apos;llanma tasdiqlandi va sizga <b>{permitRequest.room_number}-xona</b> ajratildi. Quyidagi tugmani bosib, akkauntingiz uchun parol belgilang.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2 relative z-10">
                  <Link
                    href={`/register?k=${permitRequest.passport_series}&j=${permitRequest.jshshir}`}
                    className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-550 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-550/20 active:scale-[0.98]"
                  >
                    <UserPlus size={14} /> Ro&apos;yxatdan O&apos;tish
                  </Link>
                  <button
                    onClick={handleClearStatus}
                    className={`py-4 px-6 rounded-2xl border font-black text-xs uppercase tracking-wider transition-all active:scale-[0.98] ${
                      isLight ? 'border-slate-350 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    Keshni tozalash
                  </button>
                </div>
              </>
            )}

            {permitRequest.status === 'registered' && (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-[24px] bg-sky-500/15 text-sky-500 border border-sky-500/30 shadow-lg shadow-sky-500/10">
                  <LogIn size={32} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-black uppercase tracking-wider text-sky-500 syne-font">Ro&apos;yxatdan O&apos;tish Yakunlangan</h3>
                  <p className={`text-xs leading-relaxed max-w-lg mx-auto ${isLight ? 'text-slate-605' : 'text-slate-300'}`}>
                    Hurmatli <b>{permitRequest.full_name}</b>, siz ro&apos;yxatdan o&apos;tib parolingizni kiritgansiz. Tizimdan foydalanish uchun kirish sahifasiga o&apos;ting.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2 relative z-10">
                  <Link
                    href="/login?student=1"
                    className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-sky-550 to-blue-650 hover:from-sky-600 hover:to-blue-600 text-slate-950 font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-sky-500/20"
                  >
                    <LogIn size={14} /> Tizimga Kirish
                  </Link>
                  <button
                    onClick={handleClearStatus}
                    className={`py-4 px-6 rounded-2xl border font-black text-xs uppercase tracking-wider transition-all active:scale-[0.98] ${
                      isLight ? 'border-slate-350 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    Boshqa pasport
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={`p-6 sm:p-10 rounded-[36px] glass-panel text-center space-y-6 relative overflow-hidden transition-all ${
            isLight ? 'bg-white/90' : 'bg-[#060a17]/90'
          }`}>
            <div className="absolute inset-0 bg-radial-gradient from-indigo-500/10 via-transparent to-transparent opacity-40 pointer-events-none" />

            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[24px] bg-indigo-500/15 text-indigo-500 border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
              <UploadCloud size={32} />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xl font-black uppercase tracking-wider syne-font">Yotoqxona Ruxsatnomasi</h3>
              <p className={`text-xs leading-relaxed max-w-md mx-auto ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Talabalar tizimda ro&apos;yxatdan o&apos;tishdan oldin my.gov.uz portalidan olingan yo&apos;llanma faylini yuborishlari shart.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2 relative z-10">
              <Link
                href="/ruxsatnoma-yuborish"
                className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-650 text-white font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 active:scale-[0.98] border border-white/10"
              >
                <UploadCloud size={14} /> Yo&apos;llanma Yuborish
              </Link>
              <Link
                href="/ruxsatnoma-tekshirish"
                className={`flex-1 py-4 px-6 rounded-2xl border font-black text-xs uppercase tracking-wider text-center flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                }`}
              >
                Statusni Tekshirish
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Staff and Admins Portals (Futuristic segmented layout) */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 py-20 space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-indigo-500 syne-font">Admin & Xodimlar portali</h2>
          <h3 className={`text-2xl sm:text-3xl font-black uppercase tracking-tight transition-colors duration-500 syne-font ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>Boshqaruv tizimiga o&apos;tish</h3>
          <p className={`text-[10px] max-w-md mx-auto ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Xodimlar, tarbiyachilar va administratorlar tizimga kirib, o&apos;z boshqaruv panellaridan foydalanishlari mumkin.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {staffRoles.map((role) => (
            <motion.div
              key={role.title}
              whileHover={{ y: -6, scale: 1.02 }}
              className={`border p-6 rounded-[32px] flex flex-col justify-between min-h-[340px] shadow-xl relative overflow-hidden group transition-all duration-300 ${
                isLight
                  ? 'bg-white border-slate-200 shadow-slate-200/50'
                  : `bg-[#060a17]/80 border-white/5 hover:border-white/10`
              }`}
            >
              {/* Internal glow behind icon */}
              <div className={`absolute top-[-20%] right-[-20%] w-[50%] h-[40%] rounded-full blur-[40px] bg-gradient-to-br ${role.color} opacity-20 group-hover:opacity-45 transition-opacity pointer-events-none`} />

              <div className="space-y-4">
                <div className="relative h-24 mt-4">
                  <Image
                    src={role.icon}
                    alt={role.title}
                    fill
                    unoptimized
                    className="object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.2)] group-hover:scale-110 transition-transform duration-300"
                  />
                </div>

                <div className="space-y-1.5">
                  <h4 className={`text-sm font-black tracking-tight syne-font ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {role.title}
                  </h4>
                  <p className={`text-[10px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {role.desc}
                  </p>
                </div>
              </div>

              <Link 
                href="/login"
                className={`w-full mt-6 py-3 rounded-2xl bg-gradient-to-r ${role.btnColor} text-slate-950 font-black text-[10px] uppercase tracking-wider text-center flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all`}
              >
                <span className="text-white">Tizimga Kirish</span>
                <ArrowRight size={11} className="text-white group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Statistics & Trust footer */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 py-10 text-center space-y-4 border-t border-slate-250/20 dark:border-white/5">
        <div className={`flex justify-center gap-6 text-[10px] font-black uppercase tracking-wider transition-colors duration-500 ${
          isLight ? 'text-slate-500' : 'text-gray-600'
        }`}>
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-indigo-500 animate-pulse" />
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
        <p className={`text-[9px] transition-colors duration-500 ${isLight ? 'text-slate-400' : 'text-gray-700'}`}>
          © {new Date().getFullYear()} SmartDorm. Barcha huquqlar himoyalangan. O&apos;zbekiston Milliy Universiteti hamkorligida.
        </p>
      </section>
    </div>
  );
}
