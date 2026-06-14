"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, X, Plus, CreditCard, Trash2, CheckCircle2,
  Megaphone, MapPin, User, FileText, AlertTriangle,
  Sparkles, ArrowRight, Phone, Heart, Calendar, Clock, ClipboardList, CheckCircle
} from 'lucide-react';
import { useThemeStore } from '@/lib/stores/theme-store';
import { supabase } from '@/lib/supabase';
import { getSafeUser } from '@/lib/auth-session';

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

interface Ariza {
  id: string | number;
  ism: string;
  kurs: string;
  yonalish: string;
  sana: string;
  matn: string;
  daraja: 'warning' | 'danger' | 'info';
}

interface Elon {
  id: string | number;
  title: string;
  type: 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish';
  teacher: string;
  room: string;
  time: string;
  desc: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  faculty?: string;
  role?: string;
  room_number?: string;
  course?: string | number;
  group?: string | number;
  avatar_url?: string;
}

function formatElonDate(value: string | null | undefined) {
  if (!value) return 'Bugun';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Bugun';
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Bugun';
  if (diffDays === 1) return 'Kecha';
  if (diffDays < 7) return `${diffDays} kun avval`;
  return date.toLocaleDateString('uz-UZ');
}

export default function TalabaDashboard() {
  // State - Profile va Roommates
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roommates, setRoommates] = useState<Profile[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // State - UI
  const [showArizalar, setShowArizalar] = useState(false);
  const [selectedElon, setSelectedElon] = useState<Elon | null>(null);
  const [selectedAriza, setSelectedAriza] = useState<Ariza | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [elonCategory, setElonCategory] = useState<string>("Barchasi");

  // State - Cleaning Duty
  const [cleaningDone, setCleaningDone] = useState(false);

  // State - Theme
  const theme = useThemeStore((state) => state.theme);
  const isLight = theme === 'light';

  // State - Tasks (Persisted)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");

  // State - Dynamic Data
  const [elonlar, setElonlar] = useState<Elon[]>([]);
  const [arizalar, setArizalar] = useState<Ariza[]>([]);

  // Load Tasks and Settings on Mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('talaba_tasks');
      if (saved) {
        try {
          setTasks(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse tasks:", e);
        }
      } else {
        const defaultTasks = [
          { id: 1, text: "Yotoqxona tozalik qoidalarini tekshirish", completed: true },
          { id: 2, text: "Xona to'lov chekini yuklash", completed: false }
        ];
        setTasks(defaultTasks);
        localStorage.setItem('talaba_tasks', JSON.stringify(defaultTasks));
      }

      // Load Cleaning Duty Status
      const savedCleaning = localStorage.getItem('room_cleaning_done');
      const savedCleaningDate = localStorage.getItem('room_cleaning_date');
      const todayStr = new Date().toDateString();

      if (savedCleaningDate === todayStr) {
        setCleaningDone(savedCleaning === 'true');
      } else {
        setCleaningDone(false);
        localStorage.setItem('room_cleaning_done', 'false');
        localStorage.setItem('room_cleaning_date', todayStr);
      }
    }
  }, []);

  // Save Tasks Helper
  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    if (typeof window !== 'undefined') {
      localStorage.setItem('talaba_tasks', JSON.stringify(newTasks));
    }
  };

  // Toggle Cleaning status
  const handleCleaningToggle = () => {
    const nextVal = !cleaningDone;
    setCleaningDone(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('room_cleaning_done', String(nextVal));
    }
  };

  // Fetch Profile, Roommates, Announcements, and Disciplinary Writeups
  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingProfile(true);
        const user = await getSafeUser();

        let currentProfile: Profile | null = null;

        if (user) {
          // 1. Profil ma'lumotlarini olish
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

          if (!profileError && profileData) {
            currentProfile = profileData as Profile;
            setProfile(currentProfile);

            // 2. Xonadoshlarni olish
            if (profileData.room_number) {
              const { data: roommatesData, error: roommatesError } = await supabase
                .from('users')
                .select('id, full_name, email, phone, faculty, role, room_number, course, group, avatar_url')
                .eq('room_number', profileData.room_number)
                .neq('id', user.id)
                .order('full_name', { ascending: true });

              if (!roommatesError && roommatesData) {
                setRoommates(roommatesData as Profile[]);
              }
            }
          }
        }

        // Mock mode if not logged in or database error
        if (!currentProfile) {
          const mockProfile = {
            id: '1',
            full_name: "Sherzod G'apparov",
            email: "sherzod@univer.uz",
            phone: "+998 90 123 45 67",
            faculty: "Amaliy Matematika & IT",
            role: "Talaba",
            room_number: "87-xona",
            course: "1",
            group: "TMI-03"
          };
          setProfile(mockProfile);
          currentProfile = mockProfile;

          setRoommates([
            {
              id: '2',
              full_name: "Dilshod Latipov",
              email: "dilshod@univer.uz",
              phone: "+998 90 234 56 78",
              faculty: "Amaliy Matematika",
              role: "Talaba",
              room_number: "87-xona",
              course: "1",
              group: "TMI-03"
            },
            {
              id: '3',
              full_name: "Gaxriman Araznepesov",
              email: "gaxriman@univer.uz",
              phone: "+998 90 345 67 89",
              faculty: "Amaliy Matematika",
              role: "Talaba",
              room_number: "87-xona",
              course: "1",
              group: "TMI-03"
            }
          ]);
        }

        // 3. Real E'lonlarni Yuklash (elonlar table)
        const { data: elonData, error: elonError } = await supabase
          .from('elonlar')
          .select('*')
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(8);

        if (!elonError && elonData && elonData.length > 0) {
          const mappedElons = elonData.map((e: {
            id: string | number;
            title: string;
            type: string;
            author_name?: string;
            location?: string;
            published_at?: string;
            created_at?: string;
            text: string;
          }) => ({
            id: e.id,
            title: e.title,
            type: e.type as Elon['type'],
            teacher: e.author_name || "Tizim ma'muri",
            room: e.location || "4-bino",
            time: formatElonDate(e.published_at ?? e.created_at),
            desc: e.text,
          }));
          setElonlar(mappedElons);
        } else {
          // Mock announcements if DB is empty
          setElonlar([
            {
              id: 1,
              title: "Fakultet Bayram Tadbiri",
              type: "Tadbir",
              teacher: "Ma'naviyat bo'limi",
              room: "Fakultet hovlisi",
              time: "Bugun",
              desc: "Navro'z sayli va talabalar bayrami bo'lib o'tadi."
            },
            {
              id: 2,
              title: "Frontend darslari boshlandi",
              type: "Yangilik",
              teacher: "Mo'minov Azizbek",
              room: "302-xona",
              time: "Kecha",
              desc: "React.js kutubxonasi bo'yicha amaliy darslar davom etadi."
            },
            {
              id: 3,
              title: "Yong'in xavfsizligi bo'yicha yo'riqnoma",
              type: "Muhim",
              teacher: "Xavfsizlik xizmati",
              room: "Majlislar zali",
              time: "2 kun avval",
              desc: "Barcha talabalar yong'in xavfsizligi talablariga rioya etishi shart."
            }
          ]);
        }

        // 4. Real Arizalar / Ogohlantirishlarni Yuklash (arizalar table)
        if (currentProfile && currentProfile.full_name) {
          const { data: arizalarData, error: arizalarError } = await supabase
            .from('arizalar')
            .select('*')
            .eq('student_name', currentProfile.full_name)
            .order('created_at', { ascending: false });

          if (!arizalarError && arizalarData && arizalarData.length > 0) {
            const mappedArizalar = arizalarData.map((a: {
              id: string | number;
              student_name: string;
              created_at?: string;
              text: string;
              level?: string;
            }) => ({
              id: a.id,
              ism: a.student_name,
              kurs: currentProfile?.course ? `${currentProfile.course}-kurs` : "—",
              yonalish: currentProfile?.faculty || "—",
              sana: a.created_at ? new Date(a.created_at).toLocaleDateString('uz-UZ') : '—',
              matn: a.text,
              daraja: (a.level === 'critical' ? 'danger' : a.level === 'warning' ? 'warning' : 'info') as Ariza['daraja'],
            }));
            setArizalar(mappedArizalar);
          } else {
            // Mock disciplinary records if DB is empty
            setArizalar([
              {
                id: 1,
                ism: currentProfile.full_name,
                kurs: `${currentProfile.course || 1}-kurs`,
                yonalish: currentProfile.faculty || "IT & Amaliy Matematika",
                sana: "10.05.2026",
                matn: "Yotoqxona ichki tartib qoidalarini buzganlik (kech qolish) bo'yicha tushuntirish xati.",
                daraja: "warning"
              }
            ]);
          }
        }

      } catch (error) {
        console.error('Ma\'lumotlarni yuklashda xato:', error);
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchData();
  }, []);

  const arizaSoni = arizalar.length;
  // Calculate health metrics
  const maxWarnings = 3;
  const healthPercent = Math.max(0, Math.min(100, Math.round(((maxWarnings - arizaSoni) / maxWarnings) * 100)));
  const healthColor = healthPercent >= 100 ? 'bg-emerald-500 shadow-emerald-500/30' :
                        healthPercent >= 66 ? 'bg-yellow-500 shadow-yellow-500/30' :
                        healthPercent >= 33 ? 'bg-orange-500 shadow-orange-500/30' :
                        'bg-rose-500 shadow-rose-500/30 animate-pulse';

  // Room parameters - Fully visible room number
  const roomNumberFull = profile?.room_number || '—';
  const roomNumberOnly = profile?.room_number?.split('-')[0] || '';
  const floor = calculateFloor(Number(roomNumberOnly) || 0);
  const fullName = profile?.full_name || 'Talaba';
  const faculty = profile?.faculty || 'Fakultet';
  const course = Number(profile?.course ?? 1);
  const group = profile?.group || '—';

  // Search & tab filter announcements
  const filteredElonlar = useMemo(() => {
    return elonlar.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) || 
                            e.desc.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchesTab = elonCategory === "Barchasi" || e.type === elonCategory;
      return matchesSearch && matchesTab;
    });
  }, [elonlar, searchQuery, elonCategory]);

  const surfaceBg = isLight 
    ? 'bg-white/80 border-slate-200/80 shadow-xl shadow-slate-100/40' 
    : 'bg-[#0f172a]/30 border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.3)]';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';
  const textStrong = isLight ? 'text-slate-900' : 'text-white';
  const cardBorder = isLight ? 'border-slate-100' : 'border-white/5';
  const cardInnerBg = isLight ? 'bg-slate-50/70 hover:bg-slate-100/50' : 'bg-white/5 hover:bg-white/10';

  if (loadingProfile) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#02040a]'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 rounded-full animate-spin border-blue-500/20 border-t-blue-500" />
          <p className={`text-xs font-bold ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Tizim yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-6xl mx-auto p-2 sm:p-4 md:p-6 space-y-6 sm:space-y-8 min-h-screen transition-colors duration-300">
      
      {/* 1. HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-white/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-black uppercase tracking-[0.24em] px-2.5 py-1 rounded-full ${
              isLight ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-blue-500/10 text-cyan-400 border border-blue-500/20'
            }`}>
              {faculty}
            </span>
            <span className={`text-[9px] font-black uppercase tracking-[0.24em] px-2.5 py-1 rounded-full ${
              isLight ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {group}
            </span>
          </div>
          <Link href="/talaba/profil" className="group flex items-center gap-2">
            <h1 className={`text-2xl sm:text-4xl font-black italic tracking-tight uppercase group-hover:text-blue-500 transition-colors ${textStrong}`}>
              {fullName}
            </h1>
            <Sparkles className="size-5 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <p className={`text-xs ${textMuted}`}>Yotoqxona boshqaruv tizimidagi shaxsiy boshqaruv panelingiz.</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 ${isLight ? 'text-slate-400' : 'text-gray-600'}`} />
          <input
            type="text"
            placeholder="E'lonlarni qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full border rounded-2xl py-3.5 pl-11 pr-4 outline-none text-xs sm:text-sm transition-all ${
              isLight 
                ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm' 
                : 'bg-white/5 border-white/5 text-white placeholder:text-gray-500 focus:border-blue-500/30'
            }`}
          />
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        
        {/* ================= LEFT COLUMN ================= */}
        <div className="lg:col-span-4 space-y-6 sm:space-y-8">
          
          {/* Room Card & Cleaning Schedule (Tozalik Navbatchiligi) */}
          <div 
            className={`relative overflow-hidden p-6 rounded-[32px] shadow-2xl transition-all duration-300 ${
              isLight 
                ? 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white' 
                : 'bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-900 text-white border border-white/5 shadow-indigo-950/20'
            }`}
          >
            {/* Background Glow */}
            <div className="absolute right-[-10%] top-[-10%] w-[50%] h-[50%] rounded-full blur-[80px] bg-cyan-400/20" />
            
            <div className="relative z-10 space-y-5">
              {/* Header Room Info (Room number is fully displayed inside custom container with padding to avoid clip) */}
              <div className="flex justify-between items-center py-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Yotgan Joyi</span>
                  <h2 className="text-3xl sm:text-4xl font-black italic tracking-tight text-white select-none">
                    {roomNumberFull}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-xs font-black">
                  <Calendar size={14} className="text-cyan-300" />
                  <span>{floor === 0 ? '—' : `${floor}-qavat`}</span>
                </div>
              </div>
              
              {/* Replacing Room Controls with Cleaning Duty Schedule */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <p className="text-[9px] font-black tracking-widest text-white/55 uppercase">Tozalik Navbatchiligi</p>
                  
                  {/* Duty checklist status */}
                  <button 
                    onClick={handleCleaningToggle}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black transition-all uppercase ${
                      cleaningDone 
                        ? 'bg-green-500 text-white shadow-md shadow-green-500/30' 
                        : 'bg-white/15 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {cleaningDone ? <CheckCircle size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-white/40" />}
                    <span>{cleaningDone ? 'Tozalangan' : 'Bajarilmadi'}</span>
                  </button>
                </div>
                
                <div className="space-y-2 text-xs font-semibold text-white/90">
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="opacity-60">Dushanba / Payshanba</span>
                    <span className="font-bold">Dilshod Latipov</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="opacity-60">Seshanba / Juma</span>
                    <span className="font-bold text-cyan-200">Sherzod G&apos;apparov (Siz)</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="opacity-60">Chorshanba / Shanba</span>
                    <span className="font-bold">Gaxriman Araznepesov</span>
                  </div>
                </div>
              </div>

              {/* Floor/Course indicators */}
              <div className="grid grid-cols-3 gap-2 text-center pt-4 border-t border-white/10">
                <div>
                  <p className="text-[9px] font-black text-white/40 mb-0.5 tracking-wider uppercase">Kurs</p>
                  <p className="text-sm font-black">{course}-kurs</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-white/40 mb-0.5 tracking-wider uppercase">Guruh</p>
                  <p className="text-sm font-black truncate">{group}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-white/40 mb-0.5 tracking-wider uppercase">Xona statusi</p>
                  <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/20 inline-block">
                    Namunali
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Turniket Logs (Gate Passes) */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-[10px] font-black tracking-[0.2em] uppercase ${
                isLight ? 'text-blue-600' : 'text-cyan-400'
              }`}>
                Kirish-chiqish Tarixi
              </h3>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Turniket: FAOL
              </span>
            </div>

            <div className="space-y-3">
              <div className={`flex justify-between items-center p-3 rounded-2xl border ${cardBorder} ${cardInnerBg}`}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className={`text-xs font-bold ${textStrong}`}>Kirish (Asosiy darvoza)</span>
                </div>
                <span className={`text-[10px] font-semibold ${textMuted}`}>Bugun, 18:30</span>
              </div>
              
              <div className={`flex justify-between items-center p-3 rounded-2xl border ${cardBorder} ${cardInnerBg}`}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span className={`text-xs font-bold ${textStrong}`}>Chiqish (Asosiy darvoza)</span>
                </div>
                <span className={`text-[10px] font-semibold ${textMuted}`}>Bugun, 14:15</span>
              </div>

              <div className={`flex justify-between items-center p-3 rounded-2xl border ${cardBorder} ${cardInnerBg}`}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className={`text-xs font-bold ${textStrong}`}>Kirish (B bino)</span>
                </div>
                <span className={`text-[10px] font-semibold ${textMuted}`}>Kecha, 21:55</span>
              </div>
            </div>
          </div>

          {/* Xonadoshlar Ro'yxati */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
            <h3 className={`text-[10px] font-black tracking-[0.2em] mb-4 uppercase ${
              isLight ? 'text-blue-600' : 'text-cyan-400'
            }`}>
              Xonadoshlar ({roommates.length} kishi)
            </h3>
            
            <div className="space-y-3">
              {roommates.map((roommate) => {
                const initials = roommate.full_name.split(' ').map(n => n[0]).join('').substring(0, 2);
                return (
                  <div 
                    key={roommate.id} 
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black border bg-blue-500/10 text-cyan-400 border-blue-500/20">
                        {initials}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${textStrong}`}>{roommate.full_name}</p>
                        <p className={`text-[9px] ${textMuted}`}>{roommate.course || 1}-kurs | {roommate.faculty || 'Talaba'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`tel:${roommate.phone || '+998900000000'}`} className={`p-1.5 rounded-lg border hover:bg-blue-500/10 ${isLight ? 'border-slate-200 text-slate-600' : 'border-white/5 text-gray-400'}`}>
                        <Phone size={12} />
                      </a>
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    </div>
                  </div>
                );
              })}
              {roommates.length === 0 && (
                <p className={`text-xs text-center py-4 ${textMuted}`}>Xonadoshlar ma&apos;lumoti topilmadi.</p>
              )}
            </div>
          </div>

          {/* Quick Support Contacts */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
            <h3 className={`text-[10px] font-black tracking-[0.2em] mb-4 uppercase ${
              isLight ? 'text-blue-600' : 'text-cyan-400'
            }`}>
              Yordam & Aloqa (Qo&apos;llab-quvvatlash)
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className={`text-xs font-bold ${textStrong}`}>Tarbiyachi (Navbatchi)</p>
                  <p className={`text-[9px] ${textMuted}`}>Mo&apos;minov Azizbek</p>
                </div>
                <a href="tel:+998909998877" className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[10px] font-black ${
                  isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/5 text-gray-300 hover:bg-white/5'
                }`}>
                  <Phone size={10} /> Call
                </a>
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t border-white/5">
                <div>
                  <p className={`text-xs font-bold ${textStrong}`}>Komedant</p>
                  <p className={`text-[9px] ${textMuted}`}>Qodirov Sardor</p>
                </div>
                <a href="tel:+998931112233" className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[10px] font-black ${
                  isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/5 text-gray-300 hover:bg-white/5'
                }`}>
                  <Phone size={10} /> Call
                </a>
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t border-white/5">
                <div>
                  <p className={`text-xs font-bold ${textStrong}`}>Tibbiy yordam xonasi</p>
                  <p className={`text-[9px] ${textMuted}`}>Sultonova Ra&apos;no (Shifokor)</p>
                </div>
                <a href="tel:+998944445566" className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[10px] font-black ${
                  isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/5 text-gray-300 hover:bg-white/5'
                }`}>
                  <Phone size={10} /> Call
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-8">
          
          {/* Quick Actions (Tezkor Xizmatlar) */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${
              isLight ? 'text-blue-600' : 'text-indigo-400'
            }`}>
              Tezkor Xizmatlar
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Link href="/talaba/arizalar" className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-300 group ${
                isLight ? 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-white' : 'bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-white/10'
              }`}>
                <FileText className={`size-6 mb-2.5 transition-transform duration-300 group-hover:scale-110 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${textStrong}`}>Ariza Yozish</span>
              </Link>
              
              <Link href="/talaba/tolova" className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-300 group ${
                isLight ? 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-white' : 'bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-white/10'
              }`}>
                <CreditCard className={`size-6 mb-2.5 transition-transform duration-300 group-hover:scale-110 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${textStrong}`}>To&apos;lov qilish</span>
              </Link>

              <Link href="/talaba/navbat" className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-300 group ${
                isLight ? 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-white' : 'bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-white/10'
              }`}>
                <Plus className={`size-6 mb-2.5 transition-transform duration-300 group-hover:scale-110 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${textStrong}`}>Navbatga turish</span>
              </Link>

              <Link href="/talaba/qoidalar" className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-300 group ${
                isLight ? 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-white' : 'bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-white/10'
              }`}>
                <AlertTriangle className={`size-6 mb-2.5 transition-transform duration-300 group-hover:scale-110 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${textStrong}`}>Tizim qoidalari</span>
              </Link>
            </div>
          </div>

          {/* E'lonlar Bo'limi (RE-DESIGNED NOTICE BOARD - TIMELINE CARDS) */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className={`text-base font-black uppercase tracking-wider flex items-center gap-2 ${
                  isLight ? 'text-blue-600' : 'text-indigo-400'
                }`}>
                  <Megaphone size={18} /> E&apos;lonlar va Xabarnomalar
                </h3>
                <p className={`text-[10px] mt-1 ${textMuted}`}>Yotoqxona ma&apos;muriyati tomonidan chop etilgan so&apos;nggi yangiliklar.</p>
              </div>
              
              <div className="flex flex-wrap gap-1">
                {['Barchasi', 'Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish'].map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setElonCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                      elonCategory === cat 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                        : isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-4">
              {filteredElonlar.map((elon) => {
                // Determine category color parameters
                const typeStyles = 
                  elon.type === 'Muhim' 
                    ? { border: 'border-l-rose-500', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', glow: 'shadow-rose-950/20' } :
                  elon.type === 'Tadbir' 
                    ? { border: 'border-l-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', glow: 'shadow-emerald-950/20' } :
                  elon.type === 'Ogohlantirish' 
                    ? { border: 'border-l-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', glow: 'shadow-amber-950/20' } :
                    { border: 'border-l-cyan-500', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', glow: 'shadow-cyan-950/20' };

                return (
                  <div 
                    key={elon.id} 
                    onClick={() => setSelectedElon(elon)}
                    className={`relative overflow-hidden rounded-2xl border-l-[6px] border border-y-transparent border-r-transparent p-5 cursor-pointer transition-all duration-200 hover:translate-x-1 group flex flex-col md:flex-row md:items-center justify-between gap-4 ${typeStyles.border} ${
                      isLight ? 'bg-white hover:bg-slate-50/50 border-slate-200 shadow-sm' : 'bg-white/5 hover:bg-white/10 border-white/5'
                    }`}
                  >
                    {/* Main content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${typeStyles.badge}`}>
                          {elon.type}
                        </span>
                        <div className={`flex items-center gap-1 text-[10px] ${textMuted}`}>
                          <Clock size={11} />
                          <span>{elon.time}</span>
                        </div>
                      </div>
                      
                      <h4 className={`text-base font-extrabold tracking-tight group-hover:text-blue-500 transition-colors ${textStrong}`}>
                        {elon.title}
                      </h4>
                      <p className={`text-xs leading-relaxed line-clamp-2 ${textMuted}`}>{elon.desc}</p>
                    </div>

                    {/* Metadata right-side block */}
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-white/5 pt-3 md:pt-0 gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className={isLight ? 'text-slate-400' : 'text-gray-500'} />
                        <span className={`text-[10px] font-bold ${textStrong}`}>{elon.teacher}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className={isLight ? 'text-slate-400' : 'text-gray-500'} />
                        <span className={`text-[10px] font-bold ${textMuted}`}>{elon.room}</span>
                      </div>
                      <div className={`hidden md:flex items-center gap-0.5 text-xs font-black uppercase tracking-wider ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
                        <span>Batafsil</span>
                        <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredElonlar.length === 0 && (
                <div className={`text-center py-12 border border-dashed rounded-2xl ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                  <Megaphone className={`size-8 mx-auto mb-2 opacity-30 ${textMuted}`} />
                  <p className={`text-xs ${textMuted} italic`}>Ushbu toifaga tegishli e&apos;lonlar topilmadi.</p>
                </div>
              )}
            </div>
          </div>

          {/* Replaced Cafe Menu with Mening Murojaatlarim Statusi (My Application Statuses) */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <ClipboardList className={isLight ? 'text-blue-600' : 'text-indigo-400'} size={18} />
                <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${textStrong}`}>
                  Murojaat va Arizalarim Statusi
                </h3>
              </div>
              <Link href="/talaba/arizalar" className={`text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl border transition-all ${
                isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/5 text-gray-300 hover:bg-white/5'
              }`}>
                Yangi Ariza Yozish
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1 */}
              <div className={`p-4 rounded-2xl border ${cardBorder} ${cardInnerBg} flex flex-col justify-between gap-3`}>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black uppercase text-indigo-400">Ariza</span>
                    <span className="text-[9px] font-bold text-gray-500">12.06.2026</span>
                  </div>
                  <h4 className={`text-xs font-bold ${textStrong}`}>Turarjoyni o&apos;zgartirish haqida ariza</h4>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg self-start">
                  <Clock size={10} />
                  <span>Ko&apos;rib chiqilmoqda</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className={`p-4 rounded-2xl border ${cardBorder} ${cardInnerBg} flex flex-col justify-between gap-3`}>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black uppercase text-indigo-400">Tushuntirish</span>
                    <span className="text-[9px] font-bold text-gray-500">08.06.2026</span>
                  </div>
                  <h4 className={`text-xs font-bold ${textStrong}`}>Dars qoldirish bo&apos;yicha tushuntirish xati</h4>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg self-start">
                  <CheckCircle2 size={10} />
                  <span>Qabul qilindi</span>
                </div>
              </div>

              {/* Card 3 */}
              <div className={`p-4 rounded-2xl border ${cardBorder} ${cardInnerBg} flex flex-col justify-between gap-3`}>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black uppercase text-indigo-400">Ariza</span>
                    <span className="text-[9px] font-bold text-gray-500">Bugun</span>
                  </div>
                  <h4 className={`text-xs font-bold ${textStrong}`}>Texnik yordam: Xona rozetkasini ta&apos;mirlash</h4>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2.5 py-1 rounded-lg self-start">
                  <FileText size={10} />
                  <span>Qoralama (Draft)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gamified Health Card & Disciplinary Status */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 transition-all duration-300 ${
            arizaSoni >= 3
              ? isLight ? 'bg-red-50 border-red-200 shadow-[0_0_30px_rgba(239,68,68,0.15)]' : 'bg-red-950/20 border-red-500/30'
              : surfaceBg
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-[10px] font-black tracking-[0.2em] uppercase ${
                arizaSoni >= 3 ? 'text-red-500' : isLight ? 'text-blue-600' : 'text-indigo-400'
              }`}>
                Tartib-intizom & Salomatlik Indeksi
              </h3>
              
              <div className="flex items-center gap-1.5">
                <Heart size={14} className={arizaSoni >= 3 ? 'text-red-500 animate-pulse' : 'text-emerald-500'} />
                <span className={`text-[10px] font-black uppercase ${arizaSoni >= 3 ? 'text-red-500' : 'text-emerald-500'}`}>
                  Tizim sog&apos;ligi: {healthPercent}%
                </span>
              </div>
            </div>

            {/* Health Bar */}
            <div className="relative w-full h-3 rounded-full bg-white/5 overflow-hidden mb-6 border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${healthColor}`}
                style={{ width: `${healthPercent}%` }}
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className={`text-2xl font-black italic ${textStrong}`}>{arizaSoni} ta faol ogohlantirish</p>
                <p className={`text-[10px] font-bold mt-1 ${
                  arizaSoni >= 3 ? 'text-red-500 animate-pulse' : textMuted
                }`}>
                  {arizaSoni >= 3 ? "⚠️ DIQQAT: CHIQARILISH ARAFSIDA! 3 ta ogohlantirish berilgan." : "Siz intizom qoidalariga to'liq rioya etyapsiz."}
                </p>
              </div>

              <button 
                onClick={() => setShowArizalar(true)}
                className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
                  arizaSoni >= 3
                    ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                    : isLight ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-blue-500' : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <FileText size={14} />
                <span>Barcha Ogohlantirishlar ({arizaSoni})</span>
              </button>
            </div>
          </div>

          {/* Payment & Tasks (Grid inside column) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            
            {/* Payment Card */}
            <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg} flex flex-col justify-between`}>
              <div>
                <h4 className={`text-sm font-black mb-6 italic flex items-center gap-2 ${textStrong}`}>
                  <CreditCard className={isLight ? "text-blue-600" : "text-indigo-400"} /> To&apos;lov holati
                </h4>
                
                <div className="flex gap-4 items-center mb-6">
                  <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className={isLight ? "text-slate-100" : "text-white/5"} />
                      <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="213" strokeDashoffset="142" className={isLight ? "text-blue-600" : "text-indigo-500"} style={{ transition: 'all 1000ms' }} />
                    </svg>
                    <div className={`absolute flex flex-col items-center ${textStrong}`}>
                      <span className="text-sm font-black italic">33%</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className={`text-xs font-bold ${textStrong}`}>1,000,000 UZS to&apos;landi</p>
                    <p className={`text-[10px] ${textMuted}`}>Jami summa: 3,000,000 UZS</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${cardBorder} ${cardInnerBg}`}>
                    <span className={`text-[9px] font-black uppercase ${textMuted}`}>Qolgan to&apos;lov</span>
                    <span className={`text-xs font-black ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>2,000,000 UZS</span>
                  </div>
                  <div className={`flex justify-between items-center p-3 rounded-xl border animate-pulse ${
                    isLight ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/20'
                  }`}>
                    <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-red-600' : 'text-red-400'}`}>Muddati</span>
                    <span className={`text-xs font-black ${isLight ? 'text-red-600' : 'text-red-400'}`}>8 kun ichida</span>
                  </div>
                </div>
              </div>

              <Link 
                href="/talaba/tolova" 
                className="w-full mt-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-center text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 transition-all"
              >
                Kvitansiya Yuklash
              </Link>
            </div>

            {/* To-Do List */}
            <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
              <h3 className={`text-[10px] font-black mb-4 uppercase tracking-widest ${
                isLight ? 'text-amber-600' : 'text-yellow-400'
              }`}>
                Shaxsiy Vazifalarim
              </h3>
              
              <div className="flex gap-2 mb-4">
                <input 
                  value={newTask} 
                  onChange={(e) => setNewTask(e.target.value)} 
                  placeholder="Yangi vazifa..." 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTask.trim()) {
                      saveTasks([...tasks, { id: Date.now(), text: newTask.trim(), completed: false }]);
                      setNewTask("");
                    }
                  }}
                  className={`flex-1 border rounded-xl px-4 py-3 text-xs outline-none transition-all ${
                    isLight 
                      ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white' 
                      : 'bg-white/5 border-white/5 text-white placeholder:text-gray-500 focus:border-yellow-500/30'
                  }`} 
                />
                <button 
                  onClick={() => { 
                    if (newTask.trim()) { 
                      saveTasks([...tasks, { id: Date.now(), text: newTask.trim(), completed: false }]); 
                      setNewTask("") 
                    } 
                  }} 
                  className={`px-4 rounded-xl transition-all ${
                    isLight ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  }`}
                >
                  <Plus size={16} />
                </button>
              </div>
              
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {tasks.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => { 
                      saveTasks(tasks.map(task => task.id === t.id ? { ...task, completed: !task.completed } : task)) 
                    }} 
                    className={`flex items-center gap-3 p-3 border rounded-2xl cursor-pointer group transition-all duration-200 ${
                      isLight ? 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm' : 'bg-white/5 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                      t.completed 
                        ? 'bg-green-500 text-white shadow-[0_0_8px_rgba(34,197,94,0.4)]' 
                        : isLight ? 'bg-slate-50 border border-slate-300' : 'bg-white/5 border border-white/10'
                    }`}>
                      {t.completed && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    
                    <span className={`flex-1 text-xs font-semibold transition-all ${
                      t.completed 
                        ? 'line-through text-slate-400 italic' 
                        : textStrong
                    }`}>
                      {t.text}
                    </span>
                    
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        saveTasks(tasks.filter(task => task.id !== t.id)); 
                      }} 
                      className={`opacity-0 group-hover:opacity-100 p-1 transition-opacity ${
                        isLight ? 'text-slate-400 hover:text-red-600' : 'text-gray-500 hover:text-red-400'
                      }`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <p className={`text-xs text-center py-6 ${textMuted} italic`}>Hozircha vazifalar yo&apos;q.</p>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* 2. ARIZALAR RO'YXATI MODALI */}
      {showArizalar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowArizalar(false)}>
          <div className="bg-[#0b0f19] border border-white/5 p-7 rounded-[40px] shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-xl font-black italic flex items-center gap-2 uppercase tracking-tighter text-indigo-400">
                <FileText /> Arizalar & Ogohlantirishlar
              </h4>
              <button onClick={() => setShowArizalar(false)} className="p-2 hover:bg-white/5 rounded-full transition-all text-gray-400"><X /></button>
            </div>
            
            <div className="space-y-3 mb-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
              {arizalar.map((ariza) => {
                const borderGlow = ariza.daraja === 'danger' ? 'border-red-500/30 hover:border-red-500' :
                                   ariza.daraja === 'warning' ? 'border-amber-500/30 hover:border-amber-500' :
                                   'border-blue-500/20 hover:border-blue-500';
                return (
                  <div
                    key={ariza.id}
                    onClick={() => setSelectedAriza(ariza)}
                    className={`p-4 rounded-2xl border bg-white/5 cursor-pointer transition-all duration-200 hover:translate-x-1 ${borderGlow}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{ariza.sana}</span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${
                        ariza.daraja === 'danger' ? 'bg-red-500/10 text-red-400' :
                        ariza.daraja === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>
                        {ariza.daraja}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white line-clamp-2">{ariza.matn}</p>
                  </div>
                );
              })}
              {arizalar.length === 0 && (
                <p className="text-center text-gray-500 py-8 italic">Ogohlantirishlar topilmadi.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. ARIZA TO'LIQ MATNI MODALI */}
      {selectedAriza && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-lg p-4" onClick={() => setSelectedAriza(null)}>
          <div className="bg-[#0b0f19] border border-red-500/20 p-8 rounded-[40px] shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500"><AlertTriangle size={28} /></div>
            </div>
            
            <h3 className="text-center text-xl font-black italic mb-2 uppercase tracking-tight text-white">Intizomiy Ogohlantirish</h3>
            
            <div className="space-y-4 my-6 text-center">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase mb-0.5">Sana</p>
                <p className="text-xs font-bold text-white">{selectedAriza.sana}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-xl border border-white/5 italic text-xs sm:text-sm text-gray-300 leading-relaxed text-left">
                &quot;{selectedAriza.matn}&quot;
              </div>
            </div>
            
            <button 
              onClick={() => setSelectedAriza(null)} 
              className="w-full py-3.5 bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-500/30 transition-all"
            >
              Yopish
            </button>
          </div>
        </div>
      )}

      {/* 4. E'LONLAR MODALI */}
      {selectedElon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4" onClick={() => setSelectedElon(null)}>
          <div className="bg-[#0b0f19] border border-white/5 p-0 rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white relative">
              <div className="absolute top-6 right-6">
                <button onClick={() => setSelectedElon(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white"><X size={16} /></button>
              </div>
              <span className="text-[9px] font-black bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">
                {selectedElon.type}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black italic tracking-tight leading-tight">{selectedElon.title}</h3>
            </div>
            
            <div className="p-7 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <User size={14} />
                    <span className="text-[8px] font-black uppercase">Mas&apos;ul</span>
                  </div>
                  <p className="text-xs font-bold text-white">{selectedElon.teacher}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <MapPin size={14} />
                    <span className="text-[8px] font-black uppercase">Joy</span>
                  </div>
                  <p className="text-xs font-bold text-white">{selectedElon.room}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Batafsil ma&apos;lumot</p>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5 italic">
                  &quot;{selectedElon.desc}&quot;
                </p>
              </div>
              
              <button 
                onClick={() => setSelectedElon(null)} 
                className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all text-white"
              >
                Tushunarli
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Helper Functions ──────────────────────────────────────────────────────

function calculateFloor(roomNumber: number): number {
  if (roomNumber === 0 || isNaN(roomNumber)) return 0;
  if (roomNumber < 100) return 1;
  if (roomNumber < 200) return 2;
  if (roomNumber < 300) return 3;
  if (roomNumber < 400) return 4;
  return 5;
}
