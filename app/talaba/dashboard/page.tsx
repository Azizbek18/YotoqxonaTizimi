"use client";

import React, { useState, useEffect } from 'react';
import {
  Search, X,
  Plus, CreditCard, Trash2, CheckCircle2,
  Megaphone, MapPin, User, FileText, AlertTriangle
} from 'lucide-react';
import { useThemeStore } from '@/lib/stores/theme-store';
import { supabase } from '@/lib/supabase';

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

interface Ariza {
  id: number;
  ism: string;
  kurs: string;
  yonalish: string;
  sana: string;
  matn: string;
  daraja: 'warning' | 'danger' | 'info';
}

interface Elon {
  title: string;
  type: string;
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

  // State - Theme
  const theme = useThemeStore((state) => state.theme);
  const isLight = theme === 'light';

  // State - Tasks
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: "Matematik analiz topshirig'ini yuklash", completed: true },
    { id: 2, text: "3-qavat majlisiga borish", completed: false }
  ]);
  const [newTask, setNewTask] = useState("");

  // State - Applications (Demo data - keyin database dan olinadi)
  const [arizalar] = useState<Ariza[]>([
    {
      id: 1,
      ism: "Sherzod G'apparov",
      kurs: "1-kurs",
      yonalish: "Amaliy Matematika",
      sana: "10.03.2026",
      matn: "Yotoqxona ichki tartib qoidalarini buzganlik (kech qolish) bo'yicha tushuntirish xati.",
      daraja: "warning"
    },
    {
      id: 2,
      ism: "Sherzod G'apparov",
      kurs: "1-kurs",
      yonalish: "Amaliy Matematika",
      sana: "15.03.2026",
      matn: "Xona tozaligi talablariga rioya qilmaganlik uchun rasmiy ogohlantirish.",
      daraja: "warning"
    }
  ]);

  // Fetch Profile and Roommates
  useEffect(() => {
    async function fetchProfileData() {
      try {
        setLoadingProfile(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Profil ma'lumotlarini olish
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

          if (!profileError && profileData) {
            setProfile(profileData);

            // Xonadoshlarni olish
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
            return;
          }
        }

        // Demo ma'lumotlar
        setProfile({
          id: '1',
          full_name: "Sherzod G'apparov",
          email: "sherzod@univer.uz",
          phone: "+998 90 123 45 67",
          faculty: "Amaliy Matematika & IT",
          role: "Talaba",
          room_number: "87-xona",
          course: "1",
          group: "TMI-03"
        });

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
          },
          {
            id: '4',
            full_name: "Melisbek Kulishev",
            email: "melisbek@univer.uz",
            phone: "+998 90 456 78 90",
            faculty: "Amaliy Matematika",
            role: "Talaba",
            room_number: "87-xona",
            course: "1",
            group: "TMI-03"
          }
        ]);
      } catch (error) {
        console.error('Profil yuklashda xato:', error);
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchProfileData();
  }, []);

  const arizaSoni = arizalar.length;
  const haydalishArafasida = arizaSoni >= 3;

  // Xona raqamini ajratish (masalan: "87-xona" dan "87" olish)
  const roomNumber = profile?.room_number?.split('-')[0] || '—';
  const floor = calculateFloor(Number(roomNumber) || 0);
  const fullName = profile?.full_name || 'Talaba';
  const faculty = profile?.faculty || 'Fakultet';
  const course = Number(profile?.course ?? 1);
  const group = profile?.group || '—';
  const status = 'Aktiv';

  if (loadingProfile) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#050810]'}`}>
        <div className={`w-10 h-10 border-4 rounded-full animate-spin ${isLight ? 'border-blue-200 border-t-blue-600' : 'border-blue-500/20 border-t-blue-500'}`} />
      </div>
    );
  }

  return (
    <div className={`relative w-full max-w-275 mx-auto p-4 md:p-8 space-y-8 min-h-screen font-sans transition-colors ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100 text-slate-900' : 'bg-[#050810] text-white'
      }`}>

      {/* 1. HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`}>{faculty}</p>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase">{fullName}</h1>
        </div>

        <div className="relative w-full md:w-72">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 size-4.5 ${isLight ? 'text-slate-400' : 'text-gray-600'}`} />
          <input
            type="text"
            placeholder="Qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full border rounded-2xl py-3 pl-10 pr-4 outline-none text-sm transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200' : 'bg-[#0f172a]/60 border-white/5 text-white'
              }`}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-8">
          {/* ROOM CARD */}
          <div className={`p-8 rounded-[45px] shadow-2xl hover:scale-[1.02] transition-all duration-300 ${isLight ? 'bg-linear-to-br from-blue-500 via-blue-600 to-blue-700 text-white' : 'bg-linear-to-br from-indigo-600 via-blue-700 to-indigo-900 text-white'
            }`}>
            <div className="flex items-baseline gap-2 mb-8">
              <h2 className="text-6xl font-black italic text-white tracking-tighter">{roomNumber}</h2>
              <span className="text-sm font-black uppercase tracking-[0.2em] text-white/40 italic">XONA</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-6 border-t border-white/20">
              <StatMini l="QAVAT" v={floor === 0 ? '—' : String(floor)} />
              <StatMini l="KURS" v={String(course)} />
              <StatMini l="GURUH" v={String(group)} />
              <StatMini l="HOLAT" v={status} active />
            </div>
          </div>

          {/* XONADOSHLAR */}
          {roommates.length > 0 ? (
            <div className={`border rounded-4xl p-6 hover:scale-[1.01] transition-all ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0f172a]/40 border-white/5'
              }`}>
              <h3 className={`text-[10px] font-black tracking-[0.2em] mb-6 uppercase ${isLight ? 'text-blue-600' : 'text-green-400'
                }`}>Xonadoshlar ({roommates.length} kishi)</h3>
              <div className="space-y-3">
                {roommates.map((roommate) => (
                  <Xonadosh
                    key={roommate.id}
                    name={roommate.full_name}
                    kurs={`${roommate.course || 1}-kurs`}
                    img={roommate.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    isLight={isLight}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className={`border rounded-4xl p-6 ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0f172a]/40 border-white/5'}`}>
              <p className={`text-sm text-center ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                Xonadoshlar ma&apos;lumoti kiyin yuklanadi...
              </p>
            </div>
          )}

          {/* TALABA ARIZALARI */}
          <div className={`border rounded-4xl p-6 transition-all duration-500 ${haydalishArafasida
            ? isLight ? 'bg-red-100 border-red-300 shadow-[0_0_30px_rgba(239,68,68,0.1)]' : 'bg-red-500/20 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]'
            : isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0f172a]/40 border-white/5'
            }`}>
            <h3 className={`text-[10px] font-black tracking-[0.2em] mb-4 uppercase ${haydalishArafasida
              ? 'text-red-600' : isLight ? 'text-blue-600' : 'text-indigo-400'
              }`}>
              Tartib-intizom holati
            </h3>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className={`text-2xl font-black italic ${isLight ? 'text-slate-900' : 'text-white'}`}>{arizaSoni} ta ariza</p>
                <p className={`text-[10px] font-bold ${haydalishArafasida ? isLight ? 'text-red-600' : 'text-red-400' : isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                  {haydalishArafasida ? "CHIQARILISH ARAFSIDA!" : "Hozircha xavfsiz"}
                </p>
              </div>
              <div className={`p-3 rounded-2xl ${haydalishArafasida
                ? isLight ? 'bg-red-200 text-red-600' : 'bg-red-500 text-white'
                : isLight ? 'bg-blue-100 text-blue-600' : 'bg-white/5 text-indigo-400'
                }`}>
                <AlertTriangle size={24} />
              </div>
            </div>
            <ServiceBtn
              icon={<FileText className={haydalishArafasida ? isLight ? "text-red-600" : "text-red-400" : isLight ? "text-blue-600" : "text-blue-400"} />}
              label="Arizalarni ko'rish"
              onClick={() => setShowArizalar(true)}
              isLight={isLight}
            />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-8">
          {/* E'LONLAR */}
          <div className={`border rounded-4xl p-7 hover:scale-[1.01] transition-all ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0f172a]/40 border-white/5'
            }`}>
            <h3 className={`text-[10px] font-black mb-6 uppercase tracking-widest flex items-center gap-2 ${isLight ? 'text-blue-600' : 'text-indigo-400'
              }`}>
              <Megaphone size={14} /> So&apos;nggi e&apos;lonlar
            </h3>
            <div className="space-y-4">
              <ElonCard
                title="Fakultet Bayram Tadbiri"
                time="Ertaga"
                desc="Navro'z sayli va talabalar bayrami bo'lib o'tadi."
                onClick={() => setSelectedElon({
                  title: "Navro'z va Fakultet bayrami",
                  type: "TADBIR",
                  teacher: "Ma'naviyat bo'limi",
                  room: "Fakultet hovlisi",
                  time: "Ertaga, 10:00",
                  desc: "Milliy taomlar sayli, sport musobaqalari va bayram konserti barchangizni kutmoqda!"
                })}
                isLight={isLight}
              />
              <ElonCard
                title="Frontend darslari"
                time="Bugun"
                desc="React bo'yicha amaliy darslar."
                onClick={() => setSelectedElon({
                  title: "Frontend darslari",
                  type: "DARSLAR",
                  teacher: "Mo'minov Azizbek ",
                  room: "302-xona",
                  time: "Bugun, 20:00",
                  desc: "React.js kutubxonasi bo'yicha amaliy darslar davom etadi."
                })}
                isLight={isLight}
              />
            </div>
          </div>

          {/* TO-DO LIST */}
          <div className={`border rounded-4xl p-7 hover:scale-[1.01] transition-all ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0f172a]/40 border-white/5'
            }`}>
            <h3 className={`text-[10px] font-black mb-6 uppercase tracking-widest ${isLight ? 'text-amber-600' : 'text-yellow-400'
              }`}>To-Do List</h3>
            <div className="flex gap-2 mb-6">
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Yangi vazifa..." className={`flex-1 border rounded-xl px-4 py-3 text-xs outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200' : 'bg-white/5 border-white/10 text-white focus:border-yellow-500/30'
                }`} />
              <button onClick={() => { if (newTask) { setTasks([...tasks, { id: Date.now(), text: newTask, completed: false }]); setNewTask("") } }} className={`px-4 rounded-xl transition-all ${isLight ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                }`}><Plus size={20} /></button>
            </div>
            <div className="space-y-3">
              {tasks.map(t => (
                <div key={t.id} onClick={() => { setTasks(tasks.map(task => task.id === t.id ? { ...task, completed: !task.completed } : task)) }} className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer group transition-all ${isLight ? 'bg-white border-slate-300 hover:bg-slate-50' : 'bg-[#161f31]/60 border-white/5 hover:bg-[#1e293b]'
                  }`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${t.completed ? isLight ? 'bg-green-600 shadow-[0_0_10px_rgba(22,163,74,0.4)]' : 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : isLight ? 'bg-slate-200 border border-slate-400' : 'bg-white/5 border border-white/10'
                    }`}>
                    {t.completed && <CheckCircle2 size={16} className="text-white" />}
                  </div>
                  <span className={`flex-1 text-sm font-medium ${t.completed ? isLight ? 'line-through text-slate-500 italic' : 'line-through text-gray-500 italic' : isLight ? 'text-slate-900' : 'text-gray-200'
                    }`}>{t.text}</span>
                  <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(task => task.id !== t.id)) }} className={`opacity-0 group-hover:opacity-100 p-1 transition-all ${isLight ? 'text-slate-400 hover:text-red-600' : 'text-gray-600 hover:text-red-400'
                    }`}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* TO'LOV HOLATI */}
          <div className={`border rounded-4xl p-8 hover:scale-[1.01] transition-all ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0f172a]/40 border-white/5'
            }`}>
            <h4 className={`text-xl font-black mb-6 italic flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'
              }`}>
              <CreditCard className={isLight ? "text-blue-600" : "text-indigo-400"} /> To&apos;lov Holati
            </h4>
            <div className="flex flex-col md:flex-row gap-8 items-center mb-8">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" className={isLight ? "text-slate-300" : "text-white/5"} />
                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray="364" strokeDashoffset="54" className={isLight ? "text-blue-600" : "text-indigo-500"} style={{ transition: 'all 1000ms' }} />
                </svg>
                <div className={`absolute flex flex-col items-center ${isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                  <span className="text-xl font-black italic">85%</span>
                  <span className={`text-[8px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>To&apos;langan</span>
                </div>
              </div>
              <div className="flex-1 space-y-4 w-full">
                <div className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${isLight ? 'bg-white border-slate-300' : 'bg-white/5 border-white/5'
                  }`}>
                  <span className={`text-[10px] font-black uppercase ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>To&apos;langan miqdor</span>
                  <span className={`text-sm font-black ${isLight ? 'text-green-600' : 'text-green-400'}`}>350,000 UZS</span>
                </div>
                <div className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${isLight ? 'bg-white border-slate-300' : 'bg-white/5 border-white/5'
                  }`}>
                  <span className={`text-[10px] font-black uppercase ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Oxirgi sana</span>
                  <span className={`text-sm font-black italic ${isLight ? 'text-slate-900' : 'text-white'
                    }`}>12.03.2026</span>
                </div>
                <div className={`flex justify-between items-center p-4 rounded-2xl border animate-pulse ${isLight ? 'bg-red-100 border-red-300' : 'bg-red-500/10 border-red-500/20'
                  }`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-red-600' : 'text-red-400'}`}>Qolgan vaqt</span>
                  <span className={`text-sm font-black ${isLight ? 'text-red-600' : 'text-red-400'}`}>8 kun ichida</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ARIZALAR RO'YXATI MODALI */}
      {showArizalar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowArizalar(false)}>
          <div className="bg-[#0f172a] border border-white/10 p-7 rounded-[40px] shadow-2xl w-full max-w-112.5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 text-white">
              <h4 className="text-xl font-black italic flex items-center gap-2 uppercase tracking-tighter text-indigo-400">
                <FileText /> Arizalar va Ogohlantirishlar
              </h4>
              <button onClick={() => setShowArizalar(false)} className="p-2 hover:bg-white/5 rounded-full transition-all"><X /></button>
            </div>
            <div className="space-y-3 mb-4 max-h-100 overflow-y-auto pr-2 custom-scrollbar">
              {arizalar.length > 0 ? (
                arizalar.map((ariza) => (
                  <div
                    key={ariza.id}
                    onClick={() => setSelectedAriza(ariza)}
                    className="p-4 rounded-2xl border bg-white/5 border-white/5 hover:border-indigo-500/50 cursor-pointer transition-all hover:translate-x-1"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{ariza.sana}</span>
                      <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                    </div>
                    <p className="text-sm font-bold text-white mb-1">{ariza.ism}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-black">{ariza.kurs} | {ariza.yonalish}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-400 py-8">Arizalar topilmadi</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ARIZA TO'LIQ MATNI MODALI */}
      {selectedAriza && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/95 backdrop-blur-lg p-4" onClick={() => setSelectedAriza(null)}>
          <div className="bg-[#0f172a] border border-red-500/30 p-8 rounded-[45px] shadow-2xl w-full max-w-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500"><AlertTriangle size={32} /></div>
            </div>
            <h3 className="text-center text-2xl font-black italic mb-2 uppercase tracking-tighter">Ariza Tafsiloti</h3>
            <div className="space-y-4 my-8">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Talaba</p>
                <p className="text-sm font-bold text-white">{selectedAriza.ism}</p>
                <p className="text-[10px] text-indigo-400 font-bold">{selectedAriza.yonalish}</p>
              </div>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 italic text-sm text-gray-300 leading-relaxed">
                &quot;{selectedAriza.matn}&quot;
              </div>
            </div>
            <button onClick={() => setSelectedAriza(null)} className="w-full py-4 bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500/30 transition-all">Yopish</button>
          </div>
        </div>
      )}

      {/* E'LONLAR MODALI */}
      {selectedElon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setSelectedElon(null)}>
          <div className="bg-[#0f172a] border border-white/10 p-0 rounded-[45px] shadow-2xl w-full max-w-112.5 overflow-hidden animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-indigo-600 p-8 text-white relative">
              <div className="absolute top-6 right-6">
                <button onClick={() => setSelectedElon(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"><X size={20} /></button>
              </div>
              <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest mb-4 inline-block">{selectedElon.type}</span>
              <h3 className="text-3xl font-black italic tracking-tighter leading-tight">{selectedElon.title}</h3>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1"><User size={14} /><span className="text-[9px] font-black uppercase">Mas&apos;ul</span></div>
                  <p className="text-xs font-bold text-white">{selectedElon.teacher}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1"><MapPin size={14} /><span className="text-[9px] font-black uppercase">Joy</span></div>
                  <p className="text-xs font-bold text-white">{selectedElon.room}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Batafsil ma&apos;lumot</p>
                <p className="text-sm text-gray-300 leading-relaxed italic">&quot;{selectedElon.desc}&quot;</p>
              </div>
              <button onClick={() => setSelectedElon(null)} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all">Tushunarli</button>
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

interface StatMiniProps {
  l: string;
  v: string;
  active?: boolean;
}

function StatMini({ l, v, active = false }: StatMiniProps) {
  return (
    <div className="text-center">
      <p className="text-[14px] font-black text-white/40 mb-1 tracking-widest">{l}</p>
      <p className={`text-xl font-black ${active ? 'text-green-300' : 'text-white'}`}>{v}</p>
    </div>
  );
}

interface XonadoshProps {
  name: string;
  kurs: string;
  img: string;
  me?: boolean;
  isLight?: boolean;
}

function Xonadosh({ name, kurs, img, me = false, isLight = false }: XonadoshProps) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${me
      ? isLight ? 'bg-blue-100 border-blue-300' : 'bg-indigo-600/10 border-indigo-500/30'
      : isLight ? 'bg-white border-slate-300' : 'bg-white/5 border-transparent'
      }`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-bold border ${isLight ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white/10 border-white/5 text-white'
          }`}>{img}</div>
        <div><p className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{name}</p><p className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{kurs}</p></div>
      </div>
      <div className={`w-1.5 h-1.5 rounded-full ${me ? isLight ? 'bg-blue-600 animate-pulse' : 'bg-indigo-400 animate-pulse' : isLight ? 'bg-green-600' : 'bg-green-500'
        }`}></div>
    </div>
  );
}

interface ServiceBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isLight?: boolean;
}

function ServiceBtn({ icon, label, onClick, isLight = false }: ServiceBtnProps) {
  return (
    <button onClick={onClick} className={`w-full flex flex-col items-center p-5 rounded-3xl border transition-all hover:scale-[1.02] ${isLight ? 'bg-slate-50 border-slate-300 text-slate-900 hover:border-blue-500' : 'bg-white/5 border-white/5 text-gray-400 hover:border-indigo-500/30'
      }`}>
      <div className="mb-2">{icon}</div>
      <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>{label}</span>
    </button>
  );
}

interface ElonCardProps {
  title: string;
  time: string;
  desc: string;
  onClick: () => void;
  isLight?: boolean;
}

function ElonCard({ title, time, desc, onClick, isLight = false }: ElonCardProps) {
  return (
    <button onClick={onClick} className={`w-full text-left p-4 rounded-2xl border transition-all hover:translate-x-1 group ${isLight ? 'bg-white border-slate-300 hover:border-blue-500' : 'bg-white/5 border-white/5 hover:border-indigo-500/30'
      }`}>
      <div className="flex justify-between mb-1">
        <p className={`text-xs font-black uppercase italic transition-colors ${isLight ? 'text-slate-900 group-hover:text-blue-600' : 'text-white group-hover:text-indigo-400'
          }`}>{title}</p>
        <span className={`text-[9px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{time}</span>
      </div>
      <p className={`text-[10px] line-clamp-1 ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>{desc}</p>
    </button>
  );
}