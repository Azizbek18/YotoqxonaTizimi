"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  GraduationCap,
  Megaphone,
  Search,
  Sparkles,
  X,
  MapPin,
  User,
  Info
} from 'lucide-react';
import { useThemeStore } from '@/lib/stores/theme-store';
import { supabase } from '@/lib/supabase';
import { fetchStudentAnnouncements } from '@/features/announcements/client/api';

interface Elon {
  id: string | number;
  title: string;
  text: string;
  date: string;
  type: 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish';
  audience: 'all' | 'faculty' | 'floor';
  faculty: string | null;
  teacher: string;
  room: string;
  is_from_captain?: boolean;
  captain_floor?: number;
}

interface DbElon {
  id: string;
  title: string;
  text: string;
  type: Elon['type'];
  audience: 'all' | 'faculty' | 'floor';
  faculty: string | null;
  is_published?: boolean;
  created_at: string;
  published_at: string | null;
  author_name?: string | null;
  location?: string | null;
  is_from_captain?: boolean;
  captain_floor?: number;
}

type ViewMode = 'dorm' | 'faculty';
type FilterType = 'Barchasi' | Elon['type'];

const FILTERS: FilterType[] = ['Barchasi', 'Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish'];

const typeStyles: Record<Elon['type'], { badge: string; border: string; bg: string; rail: string; icon: React.ReactNode }> = {
  Muhim: {
    badge: 'border-red-500/30 bg-red-500/10 text-red-400',
    border: 'border-l-red-500',
    bg: 'bg-red-500/5',
    rail: 'from-red-500 to-rose-600',
    icon: <Bell size={16} />,
  },
  Tadbir: {
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/5',
    rail: 'from-emerald-500 to-teal-600',
    icon: <CalendarDays size={16} />,
  },
  Yangilik: {
    badge: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
    border: 'border-l-sky-500',
    bg: 'bg-sky-500/5',
    rail: 'from-sky-500 to-blue-600',
    icon: <Megaphone size={16} />,
  },
  Ogohlantirish: {
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/5',
    rail: 'from-amber-500 to-orange-600',
    icon: <Clock3 size={16} />,
  },
};

function formatElonDate(value: string | null | undefined) {
  if (!value) return 'Bugun';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Bugun';

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Bugun';
  if (diffDays === 1) return 'Kecha';
  if (diffDays < 7) return `${diffDays} kun avval`;
  if (diffDays < 14) return '1 hafta avval';
  return date.toLocaleDateString('uz-UZ');
}

function mapDbElon(elon: DbElon): Elon {
  return {
    id: elon.id,
    title: elon.title,
    text: elon.text,
    type: elon.type,
    audience: elon.audience,
    faculty: elon.faculty,
    date: formatElonDate(elon.published_at ?? elon.created_at),
    teacher: elon.author_name || "Tizim ma'muri",
    room: elon.is_from_captain ? `${elon.captain_floor}-qavat sardori` : (elon.location || "4-bino"),
    is_from_captain: elon.is_from_captain,
    captain_floor: elon.captain_floor
  };
}

export default function ElonlarPage() {
  const [view, setView] = useState<ViewMode>('dorm');
  const [selectedElon, setSelectedElon] = useState<Elon | null>(null);
  const [elonlar, setElonlar] = useState<Elon[]>([]);
  const [currentFaculty, setCurrentFaculty] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('Barchasi');
  const theme = useThemeStore((state) => state.theme);
  const isLight = theme === 'light';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (selectedElon) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedElon]);

  useEffect(() => {
    let isMounted = true;

    const loadElonlar = async () => {
      try {
        const result = await fetchStudentAnnouncements();

        if (isMounted && Array.isArray(result.elonlar)) {
          const mapped = result.elonlar.map((elon: DbElon) => mapDbElon(elon));
          setElonlar(mapped);
          setCurrentFaculty(typeof result.currentFaculty === 'string' ? result.currentFaculty : null);
        }
      } catch (error) {
        console.error("E'lonlarni yuklashda xatolik:", error);
        if (isMounted) setElonlar([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadElonlar();

    const channel = supabase
      .channel('talaba-elonlar')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'elonlar' },
        (payload) => {
          const next = payload.new as DbElon | null;
          const old = payload.old as { id?: string } | null;

          if (payload.eventType === 'INSERT' && next?.is_published) {
            setElonlar((current) => [mapDbElon(next), ...current.filter((item) => item.id !== next.id)]);
          }

          if (payload.eventType === 'UPDATE' && next) {
            setElonlar((current) => {
              if (!next.is_published) {
                return current.filter((item) => item.id !== next.id);
              }

              const mapped = mapDbElon(next);
              const exists = current.some((item) => item.id === next.id);
              return exists ? current.map((item) => (item.id === next.id ? mapped : item)) : [mapped, ...current];
            });
          }

          if (payload.eventType === 'DELETE' && old?.id) {
            setElonlar((current) => current.filter((item) => item.id !== old.id));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const dormElonlar = useMemo(() => elonlar.filter((elon) => elon.audience === 'all'), [elonlar]);
  const facultyElonlar = useMemo(
    () => elonlar.filter((elon) => elon.audience === 'faculty' && currentFaculty && elon.faculty === currentFaculty),
    [currentFaculty, elonlar]
  );
  const activeList = view === 'faculty' ? facultyElonlar : dormElonlar;

  const filteredElonlar = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activeList.filter((elon) => {
      const matchesType = filter === 'Barchasi' || elon.type === filter;
      const matchesSearch = !query || elon.title.toLowerCase().includes(query) || elon.text.toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [activeList, filter, search]);

  const importantCount = activeList.filter((elon) => elon.type === 'Muhim' || elon.type === 'Ogohlantirish').length;

  const pageBg = isLight
    ? 'bg-linear-to-br from-slate-50 to-slate-100 text-slate-900'
    : 'bg-[#02040a] text-white';
  const panel = isLight
    ? 'border-slate-200 bg-white/80 shadow-xl shadow-slate-100/40'
    : 'border-white/5 bg-slate-950/30 backdrop-blur-xl shadow-2xl';
  const cardBg = isLight
    ? 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50/35'
    : 'bg-[#0f172a]/30 border-white/5 hover:border-indigo-500/30 hover:bg-[#0f172a]/50';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';
  const textStrong = isLight ? 'text-slate-900' : 'text-white';

  const switchView = (nextView: ViewMode) => {
    setSearch('');
    setFilter('Barchasi');
    setView(nextView);
  };

  return (
    <div className={`relative min-h-screen p-3 sm:p-5 md:p-6 transition-colors duration-300 ${pageBg}`}>
      
      {/* Decorative Glow Elements */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {!isLight && (
          <>
            <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-emerald-600/5 blur-[120px] rounded-full" />
          </>
        )}
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
        
        {/* Header Section */}
        <section className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${panel}`}>
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-sky-400 via-emerald-400 to-amber-300" />
          
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2.5">
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                isLight ? 'border-blue-100 bg-blue-50 text-blue-600' : 'border-blue-500/20 bg-blue-500/10 text-cyan-400'
              }`}>
                <Sparkles size={12} />
                <span>E&apos;lonlar Boshqaruvi</span>
              </div>
              <h1 className={`text-3xl font-black italic tracking-tight sm:text-5xl uppercase ${textStrong}`}>
                E&apos;lonlar markazi
              </h1>
              <p className={`max-w-2xl text-xs sm:text-sm leading-relaxed ${textMuted}`}>
                Yotoqxona umumiy yangiliklari va faqat sizning fakultetingizga tegishli xabarnomalar. O&apos;zingizga kerakli turdagi e&apos;lonlarni osongina qidiring va o&apos;qing.
              </p>
            </div>

            <div className="flex gap-3 shrink-0">
              <div className={`rounded-2xl border p-4 text-center min-w-20 ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/5'}`}>
                <p className={`text-[9px] font-black uppercase tracking-wider ${textMuted}`}>Jami</p>
                <p className="mt-1 text-2xl font-black">{activeList.length}</p>
              </div>
              <div className={`rounded-2xl border p-4 text-center min-w-20 ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/5'}`}>
                <p className="text-[9px] font-black uppercase tracking-wider text-rose-500">Muhim</p>
                <p className="mt-1 text-2xl font-black text-rose-500">{importantCount}</p>
              </div>
            </div>
          </div>
        </section>

        {/* View Switchers & Controls Panel */}
        <section className={`rounded-3xl border p-4 space-y-4 ${panel}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            
            {/* Left Tabs (Dorm vs Faculty) */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => switchView('dorm')}
                className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-5 py-3 text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                  view === 'dorm' 
                    ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                    : isLight ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-white/5 bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Megaphone size={14} />
                <span>Yotoqxona e&apos;lonlari</span>
              </button>
              
              <button
                type="button"
                onClick={() => switchView('faculty')}
                className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-5 py-3 text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                  view === 'faculty' 
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-500/25' 
                    : isLight ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-white/5 bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <GraduationCap size={14} />
                <span>{currentFaculty ?? 'Mening fakultetim'}</span>
              </button>
            </div>

            {/* Right side Search & Filter badges */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center min-w-0 flex-1 justify-end">
              {/* Search bar */}
              <div className={`flex items-center gap-2 rounded-2xl border px-3.5 py-1 min-w-0 md:w-64 shrink-0 ${
                isLight ? 'border-slate-200 bg-white' : 'border-white/5 bg-slate-950/30'
              }`}>
                <Search size={14} className={textMuted} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="E'lonlardan qidirish..."
                  className={`h-10 w-full min-w-0 bg-transparent text-xs font-bold outline-none placeholder:font-medium ${textStrong}`}
                />
              </div>

              {/* Filter pills */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {FILTERS.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setFilter(item)}
                    className={`shrink-0 rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-wider transition-all ${
                      filter === item 
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950' 
                        : isLight ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'border-white/5 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* Notices Board Content */}
        <section className="grid gap-6 lg:grid-cols-12 items-start">
          
          {/* Main List Column */}
          <div className="lg:col-span-8 space-y-4">
            {loading && view === 'dorm' ? (
              <div className={`rounded-[28px] border p-12 text-center text-xs font-black uppercase tracking-wider ${panel} ${textMuted}`}>
                E&apos;lonlar yuklanmoqda...
              </div>
            ) : filteredElonlar.length === 0 ? (
              <div className={`rounded-[28px] border p-12 text-center ${panel} space-y-4`}>
                <Megaphone className={`mx-auto opacity-35 ${textMuted}`} size={40} />
                <div className="space-y-1">
                  <p className={`text-base font-black uppercase tracking-wider ${textStrong}`}>Hech qanday e&apos;lon topilmadi</p>
                  <p className={`text-xs ${textMuted}`}>
                    {view === 'faculty'
                      ? `${currentFaculty ?? 'Fakultetingiz'} uchun hozircha xabarlar e'lon qilinmagan.`
                      : "Qidiruv so'rovi yoki filtr turini o'zgartirib ko'ring."}
                  </p>
                </div>
              </div>
            ) : (
              filteredElonlar.map((elon) => {
                const styles = typeStyles[elon.type];
                return (
                  <button
                    type="button"
                    key={elon.id}
                    onClick={() => setSelectedElon(elon)}
                    className={`relative overflow-hidden w-full rounded-2xl border-l-[6px] border border-y-transparent border-r-transparent p-5 text-left transition-all duration-200 hover:translate-x-1 group flex flex-col justify-between gap-4 ${styles.border} ${cardBg}`}
                  >
                    {/* Header info */}
                    <div className="space-y-2.5 w-full">
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${styles.badge}`}>
                            {elon.type}
                          </span>
                          {elon.is_from_captain && (
                            <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-purple-400">
                              🌟 Qavat Sardori
                            </span>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 text-[10px] font-semibold ${textMuted}`}>
                          <Clock3 size={11} />
                          <span>{elon.date}</span>
                        </div>
                      </div>

                      {/* Title & Body */}
                      <h3 className={`text-base font-extrabold tracking-tight group-hover:text-blue-600 transition-colors leading-snug ${textStrong}`}>
                        {elon.title}
                      </h3>
                      <p className={`text-xs leading-relaxed line-clamp-2 ${textMuted}`}>
                        {elon.text}
                      </p>
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex justify-between items-center w-full pt-3.5 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <User size={12} className={isLight ? 'text-slate-400' : 'text-gray-500'} />
                          <span className={`text-[10px] font-bold ${textStrong}`}>{elon.teacher || "Tizim ma'muri"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className={isLight ? 'text-slate-400' : 'text-gray-500'} />
                          <span className={`text-[10px] font-bold ${textMuted}`}>{elon.room || "—"}</span>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-0.5 text-xs font-black uppercase tracking-wider ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
                        <span>Ochish</span>
                        <ChevronRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Sidebar Column */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Filters count widget */}
            <div className={`rounded-[28px] border p-5 space-y-4 ${panel}`}>
              <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${textStrong}`}>
                Toifalar bo&apos;yicha
              </h3>
              
              <div className="space-y-2">
                {FILTERS.slice(1).map((item) => {
                  const count = activeList.filter((elon) => elon.type === item).length;
                  const styles = typeStyles[item as Elon['type']];
                  
                  return (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setFilter(item)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                        filter === item 
                          ? styles.badge
                          : isLight ? 'border-slate-100 bg-slate-50/50 hover:bg-slate-100/50' : 'border-white/5 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span className={filter === item ? '' : isLight ? 'text-slate-500' : 'text-gray-400'}>{styles.icon}</span>
                        <span>{item}</span>
                      </div>
                      <span className="text-xs font-black">{count} ta</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Emergency Hotline Info Widget */}
            <div className={`rounded-[28px] border p-6 space-y-4 ${panel}`}>
              <div className="flex items-center gap-2 text-rose-500">
                <Info size={16} />
                <h4 className="text-xs font-black uppercase tracking-wider">Favqulodda Aloqa</h4>
              </div>
              <p className={`text-xs leading-relaxed ${textMuted}`}>
                Agarda yotoqxonada texnik yoki boshqa xavfli holatlar yuzaga kelsa, zudlik bilan navbatchi tarbiyachiga yoki xavfsizlik bo&apos;limiga xabar bering.
              </p>
              <div className="space-y-1.5 pt-2 text-xs font-bold">
                <div className="flex justify-between">
                  <span className="opacity-60">Xavfsizlik:</span>
                  <a href="tel:+998712000000" className="text-rose-500 hover:underline">+998 71 200-00-00</a>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Shifokor:</span>
                  <a href="tel:+998944445566" className="text-blue-500 hover:underline">+998 94 444-55-66</a>
                </div>
              </div>
            </div>

          </div>

        </section>

      </div>

      {/* Frosted Detail Modal */}
      {mounted && typeof document !== 'undefined' && selectedElon && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" onClick={() => setSelectedElon(null)}>
          <div 
            className={`relative w-full max-w-lg overflow-hidden rounded-[36px] border p-0 shadow-2xl ${panel}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Banner element corresponding to announcement type */}
            <div className={`p-6 sm:p-8 text-white relative bg-gradient-to-r ${typeStyles[selectedElon.type].rail}`}>
              <button
                type="button"
                onClick={() => setSelectedElon(null)}
                className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                aria-label="Yopish"
              >
                <X size={16} />
              </button>
              
              <div className="space-y-3">
                <span className="rounded-md bg-white/20 border border-white/10 px-3 py-1 text-[8px] font-black uppercase tracking-widest inline-block">
                  {selectedElon.type}
                </span>
                <h2 className="text-xl sm:text-2xl font-black italic tracking-tight leading-tight">{selectedElon.title}</h2>
              </div>
            </div>

            {/* Body contents */}
            <div className="p-6 sm:p-7 space-y-5">
              
              {/* Metadata strip */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/5'}`}>
                  <span className={`text-[8px] font-black uppercase tracking-wider block ${textMuted} mb-0.5`}>Mas&apos;ul</span>
                  <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500 inline-block">{selectedElon.teacher || "Tizim ma'muri"}</span>
                </div>
                <div className={`p-3 rounded-xl border ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/5'}`}>
                  <span className={`text-[8px] font-black uppercase tracking-wider block ${textMuted} mb-0.5`}>Sana / Joy</span>
                  <span className={`text-xs font-bold ${textStrong}`}>{selectedElon.date} • {selectedElon.room || "—"}</span>
                </div>
              </div>

              {/* Text content details */}
              <div className="space-y-1.5">
                <span className={`text-[8px] font-black uppercase tracking-widest ${textMuted}`}>Batafsil ma&apos;lumot</span>
                <div className={`p-4 rounded-xl border italic text-xs sm:text-sm leading-relaxed ${
                  isLight ? 'bg-slate-50/50 border-slate-100 text-slate-700' : 'bg-white/5 border-white/5 text-gray-300'
                }`}>
                  &quot;{selectedElon.text}&quot;
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedElon(null)}
                className="w-full mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 py-3.5 text-xs font-black text-white shadow-lg shadow-blue-500/25 transition uppercase tracking-widest"
              >
                Tushunarli
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
