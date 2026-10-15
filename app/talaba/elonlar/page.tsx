"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  Info,
  Building2,
  Phone,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';
import { useThemeStore } from '@/lib/stores/theme-store';
import { fetchStudentAnnouncements } from '@/features/announcements/client/api';
import { fetchAppSettings } from '@/features/app-settings/client/api';
import { TalabaElonlarSkeleton } from '@/components/talaba/skeletons';
import { StaggerList, StaggerItem } from '@/components/motion/StaggerList';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { useVisiblePoll } from '@/lib/hooks/useVisiblePoll';

interface Elon {
  id: string | number;
  title: string;
  text: string;
  date: string;
  type: 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish';
  audience: 'all' | 'faculty' | 'floor' | 'system' | 'council';
  faculty: string | null;
  teacher: string;
  room: string;
  is_from_captain?: boolean;
  captain_floor?: number;
  is_from_council_chair?: boolean;
}

interface DbElon {
  id: string;
  title: string;
  text: string;
  type: Elon['type'];
  audience: 'all' | 'faculty' | 'floor' | 'system' | 'council';
  faculty: string | null;
  is_published?: boolean;
  created_at: string;
  published_at: string | null;
  author_name?: string | null;
  location?: string | null;
  is_from_captain?: boolean;
  captain_floor?: number;
  is_from_council_chair?: boolean;
}

type ViewMode = 'dorm' | 'faculty';
type FilterType = 'Barchasi' | Elon['type'];

const FILTERS: FilterType[] = ['Barchasi', 'Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish'];

const typeStyles: Record<Elon['type'], {
  badge: string;
  border: string;
  dot: string;
  rail: string;
  icon: React.ReactNode;
}> = {
  Muhim: {
    badge: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300',
    border: 'border-l-rose-500',
    dot: 'bg-rose-500',
    rail: 'from-rose-600 to-red-600',
    icon: <Bell size={14} className="shrink-0" />,
  },
  Tadbir: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
    border: 'border-l-emerald-500',
    dot: 'bg-emerald-500',
    rail: 'from-emerald-600 to-teal-600',
    icon: <CalendarDays size={14} className="shrink-0" />,
  },
  Yangilik: {
    badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300',
    border: 'border-l-blue-500',
    dot: 'bg-blue-500',
    rail: 'from-blue-600 to-indigo-600',
    icon: <Megaphone size={14} className="shrink-0" />,
  },
  Ogohlantirish: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
    rail: 'from-amber-500 to-orange-600',
    icon: <Clock3 size={14} className="shrink-0" />,
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
  return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
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
    room: elon.is_from_captain
      ? `${elon.captain_floor}-qavat sardori`
      : elon.is_from_council_chair ? 'Talaba kengashi raisi' : (elon.location || "4-bino"),
    is_from_captain: elon.is_from_captain,
    captain_floor: elon.captain_floor,
    is_from_council_chair: elon.is_from_council_chair,
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
  const reduceMotion = useReducedMotion();
  const [emergencyContacts, setEmergencyContacts] = useState<{ securityPhone: string; doctorPhone: string } | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsStatus('loading');
    try {
      const settings = await fetchAppSettings();
      setEmergencyContacts({ securityPhone: settings.securityPhone, doctorPhone: settings.doctorPhone });
      setSettingsStatus('ready');
    } catch {
      setEmergencyContacts(null);
      setSettingsStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Lock body scroll when modal is open
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

  // Audience-filtered server API visible polling
  useVisiblePoll(async (silent) => {
    try {
      const result = await fetchStudentAnnouncements();
      if (Array.isArray(result.elonlar)) {
        setElonlar(result.elonlar.map((elon: DbElon) => mapDbElon(elon)));
        setCurrentFaculty(typeof result.currentFaculty === 'string' ? result.currentFaculty : null);
      }
    } catch (error) {
      console.error("E'lonlarni yuklashda xatolik:", error);
      if (!silent) setElonlar([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, 90_000);

  const dormElonlar = useMemo(
    () => elonlar.filter((elon) => elon.audience === 'all' || elon.audience === 'system'),
    [elonlar]
  );

  const facultyElonlar = useMemo(
    () => elonlar.filter((elon) =>
      (elon.audience === 'faculty' || elon.audience === 'floor' || elon.audience === 'council')
      && currentFaculty && elon.faculty?.toLowerCase() === currentFaculty.toLowerCase()),
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

  const switchView = (nextView: ViewMode) => {
    setSearch('');
    setFilter('Barchasi');
    setView(nextView);
  };

  const facultyLabel = currentFaculty ? currentFaculty.toUpperCase() : 'FAKULTET';

  return (
    <div className={`relative min-h-screen px-2.5 py-3 sm:p-5 md:p-6 transition-colors duration-300 ${
      isLight ? 'bg-slate-50/70 text-slate-900' : 'bg-[#060a12] text-slate-100'
    }`}>
      
      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">
        
        {/* Header Section */}
        <header className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-4 sm:p-6 no-shelf outline-none ${
          isLight
            ? 'border-slate-200/90 bg-white shadow-xs'
            : 'border-slate-800 bg-slate-900/90'
        }`}>
          {/* Academic top line accent */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />
          
          <div className="flex flex-col gap-3.5 sm:gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 no-shelf">
                <Sparkles size={11} className="shrink-0 text-blue-600 dark:text-blue-400" />
                <span>Rasmiy xabarlar</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                E&apos;lonlar markazi
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                Talabalar turar joyi va fakultet ma&apos;muriyatining rasmiy xabarnomalari hamda muhim eslatmalari.
              </p>
            </div>

            {/* Stat Badges */}
            <div className="flex items-center gap-2 shrink-0 pt-0.5 sm:pt-0">
              <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 no-shelf ${
                isLight ? 'border-slate-200/90 bg-slate-50/80' : 'border-slate-800 bg-slate-800/60'
              }`}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shrink-0">
                  <Megaphone size={15} />
                </div>
                <div className="leading-tight">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Jami</div>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">{activeList.length} ta</div>
                </div>
              </div>

              <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 no-shelf ${
                isLight ? 'border-rose-200/80 bg-rose-50/60' : 'border-rose-900/50 bg-rose-950/30'
              }`}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 shrink-0">
                  <Bell size={15} />
                </div>
                <div className="leading-tight">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Muhim</div>
                  <div className="text-sm sm:text-base font-extrabold text-rose-700 dark:text-rose-300">{importantCount} ta</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* View Switchers & Controls Panel */}
        <section className={`rounded-2xl border p-3 sm:p-4 space-y-3 no-shelf outline-none ${
          isLight ? 'border-slate-200/90 bg-white shadow-xs' : 'border-slate-800 bg-slate-900/90'
        }`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            
            {/* Segmented Control Tabs */}
            <div className={`grid grid-cols-2 gap-1 rounded-xl border p-1 no-shelf shrink-0 ${
              isLight ? 'border-slate-200 bg-slate-100/80' : 'border-slate-800 bg-slate-950/60'
            }`}>
              <button
                type="button"
                data-student-button="plain"
                aria-pressed={view === 'dorm'}
                onClick={() => switchView('dorm')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-bold transition-all no-shelf ${
                  view === 'dorm'
                    ? isLight
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                      : 'bg-slate-800 text-blue-400 shadow-xs border border-slate-700/80'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 size={13} className="shrink-0" />
                <span className="truncate">Umumiy</span>
              </button>

              <button
                type="button"
                data-student-button="plain"
                aria-pressed={view === 'faculty'}
                onClick={() => switchView('faculty')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-bold transition-all no-shelf ${
                  view === 'faculty'
                    ? isLight
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                      : 'bg-slate-800 text-blue-400 shadow-xs border border-slate-700/80'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <GraduationCap size={13} className="shrink-0" />
                <span className="truncate">{facultyLabel}</span>
              </button>
            </div>

            {/* Search bar & Filter pills */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center min-w-0 flex-1 justify-end">
              {/* Search bar */}
              <div className={`relative flex items-center gap-2 rounded-xl border px-3 py-1.5 min-w-0 sm:w-60 shrink-0 no-shelf ${
                isLight ? 'border-slate-200/90 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10' : 'border-slate-800 bg-slate-950/60 focus-within:border-blue-500'
              }`}>
                <Search size={14} className="shrink-0 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="E'lonlardan qidirish..."
                  className="h-7 w-full min-w-0 bg-transparent text-xs font-medium outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
                />
                {search && (
                  <button
                    type="button"
                    data-student-button="plain"
                    onClick={() => setSearch('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 no-shelf"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((item) => {
                  const active = filter === item;
                  return (
                    <button
                      type="button"
                      key={item}
                      data-student-button="plain"
                      aria-pressed={active}
                      onClick={() => setFilter(item)}
                      className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all no-shelf ${
                        active
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : isLight
                            ? 'border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </section>

        {/* Notices Board Content */}
        <section className="grid gap-4 sm:gap-6 lg:grid-cols-12 items-start">
          
          {/* Main List Column */}
          <div className="lg:col-span-8 space-y-3 sm:space-y-4">
            {loading && view === 'dorm' ? (
              <TalabaElonlarSkeleton />
            ) : filteredElonlar.length === 0 ? (
              <div className={`rounded-2xl border p-8 sm:p-12 text-center no-shelf outline-none ${
                isLight ? 'border-slate-200/90 bg-white shadow-xs' : 'border-slate-800 bg-slate-900/90'
              }`}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
                  <Megaphone size={22} />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Hech qanday e&apos;lon topilmadi
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {search || filter !== 'Barchasi'
                    ? "Qidiruv so'rovi yoki filtr turini o'zgartirib ko'ring."
                    : view === 'faculty'
                      ? `${facultyLabel} fakulteti uchun hozircha xabarnomalar mavjud emas.`
                      : "Yotoqxona bo'yicha hozircha faol e'lonlar kiritilmagan."}
                </p>
                {(search || filter !== 'Barchasi') && (
                  <button
                    type="button"
                    data-student-button="plain"
                    onClick={() => {
                      setSearch('');
                      setFilter('Barchasi');
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 no-shelf"
                  >
                    <RotateCcw size={12} />
                    <span>Filtrlarni tozalash</span>
                  </button>
                )}
              </div>
            ) : (
              <StaggerList className="space-y-3">
                {filteredElonlar.map((elon) => {
                  const styles = typeStyles[elon.type];
                  return (
                    <StaggerItem key={elon.id}>
                      <button
                        type="button"
                        data-student-button="plain"
                        onClick={() => setSelectedElon(elon)}
                        className={`group relative w-full overflow-hidden rounded-2xl border border-l-4 p-4 text-left transition-all duration-200 hover:shadow-md flex flex-col justify-between gap-3 no-shelf outline-none ${styles.border} ${
                          isLight
                            ? 'bg-white border-slate-200/90 hover:border-slate-300'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Header info */}
                        <div className="space-y-2 w-full min-w-0">
                          <div className="flex flex-wrap justify-between items-center gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles.badge} no-shelf`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                                <span>{elon.type}</span>
                              </span>
                              {elon.is_from_captain && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300 no-shelf">
                                  <span>⭐ Sardor</span>
                                </span>
                              )}
                              {elon.is_from_council_chair && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300 no-shelf">
                                  <span>🎓 Kengash raisi</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                              <Clock3 size={12} className="shrink-0 text-slate-400" />
                              <span>{elon.date}</span>
                            </div>
                          </div>

                          {/* Title & Preview */}
                          <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug line-clamp-2">
                            {elon.title}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                            {elon.text}
                          </p>
                        </div>

                        {/* Metadata Footer */}
                        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 w-full min-w-0">
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
                            <div className="flex items-center gap-1 truncate">
                              <User size={12} className="shrink-0 text-slate-400" />
                              <span className="truncate font-semibold text-slate-700 dark:text-slate-300">{elon.teacher || "Tizim ma'muri"}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <MapPin size={12} className="shrink-0 text-slate-400" />
                              <span className="truncate">{elon.room || "—"}</span>
                            </div>
                          </div>

                          <div className="inline-flex items-center gap-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0 group-hover:translate-x-0.5 transition-transform">
                            <span>Batafsil</span>
                            <ChevronRight size={13} />
                          </div>
                        </div>
                      </button>
                    </StaggerItem>
                  );
                })}
              </StaggerList>
            )}
          </div>

          {/* Right Sidebar Column */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Filters count widget */}
            <div className={`rounded-2xl border p-4 space-y-3 no-shelf outline-none ${
              isLight ? 'border-slate-200/90 bg-white shadow-xs' : 'border-slate-800 bg-slate-900/90'
            }`}>
              <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Toifalar bo&apos;yicha
              </h3>
              
              <div className="space-y-1.5">
                {FILTERS.slice(1).map((item) => {
                  const count = activeList.filter((elon) => elon.type === item).length;
                  const styles = typeStyles[item as Elon['type']];
                  const isSelected = filter === item;
                  
                  return (
                    <button
                      type="button"
                      key={item}
                      data-student-button="plain"
                      onClick={() => setFilter(isSelected ? 'Barchasi' : item)}
                      className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all no-shelf ${
                        isSelected 
                          ? `${styles.badge} shadow-xs font-bold`
                          : isLight 
                            ? 'border-slate-100 bg-slate-50/70 hover:bg-slate-100/70 text-slate-700' 
                            : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className={isSelected ? '' : 'text-slate-400'}>{styles.icon}</span>
                        <span>{item}</span>
                      </div>
                      <span className={`text-[11px] font-extrabold rounded-full px-2 py-0.5 ${
                        isSelected
                          ? 'bg-white/80 dark:bg-black/30'
                          : isLight ? 'bg-slate-200/70 text-slate-700' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {count} ta
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Emergency Hotline Info Widget */}
            <div className={`rounded-2xl border p-4 space-y-3 no-shelf outline-none ${
              isLight ? 'border-slate-200/90 bg-white shadow-xs' : 'border-slate-800 bg-slate-900/90'
            }`}>
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <Info size={16} />
                <h4 className="text-xs font-extrabold uppercase tracking-wider">Favqulodda Aloqa</h4>
              </div>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Texnik nosozlik yoki favqulodda holatlar yuzaga kelsa, mas&apos;ul xodimlarga zudlik bilan qo&apos;ng&apos;iroq qiling:
              </p>
              
              {emergencyContacts ? (
                <div className="space-y-2 pt-1 text-xs">
                  <div className={`flex items-center justify-between p-2 rounded-xl border no-shelf ${
                    isLight ? 'border-slate-100 bg-slate-50/70' : 'border-slate-800 bg-slate-800/40'
                  }`}>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Xavfsizlik bo&apos;limi:</span>
                    {emergencyContacts.securityPhone ? (
                      <a
                        href={`tel:${emergencyContacts.securityPhone}`}
                        className="inline-flex items-center gap-1 font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 no-shelf"
                      >
                        <Phone size={11} />
                        <span>{emergencyContacts.securityPhone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400">Mavjud emas</span>
                    )}
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-xl border no-shelf ${
                    isLight ? 'border-slate-100 bg-slate-50/70' : 'border-slate-800 bg-slate-800/40'
                  }`}>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Tibbiyot xonasi:</span>
                    {emergencyContacts.doctorPhone ? (
                      <a
                        href={`tel:${emergencyContacts.doctorPhone}`}
                        className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 no-shelf"
                      >
                        <Phone size={11} />
                        <span>{emergencyContacts.doctorPhone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400">Mavjud emas</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="pt-1 text-xs">
                  <p className="text-slate-400">
                    {settingsStatus === 'loading' ? 'Kontaktlar yuklanmoqda...' : 'Kontaktlarni yuklab bo‘lmadi.'}
                  </p>
                  {settingsStatus === 'error' && (
                    <button
                      type="button"
                      data-student-button="plain"
                      onClick={() => void loadSettings()}
                      className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 no-shelf"
                    >
                      Qayta urinish
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

        </section>

      </div>

      {/* Detail Modal */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedElon && (
            <motion.div
              {...(reduceMotion ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } })}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setSelectedElon(null)}
            >
              <motion.div
                {...(reduceMotion ? {} : {
                  initial: { scale: 0.95, y: 16, opacity: 0 },
                  animate: { scale: 1, y: 0, opacity: 1 },
                  exit: { scale: 0.95, y: 16, opacity: 0 },
                  transition: { type: 'spring' as const, duration: 0.4 },
                })}
                className={`relative w-full max-w-lg overflow-hidden rounded-2xl sm:rounded-3xl border shadow-2xl no-shelf outline-none ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Bar */}
                <div className={`p-4 sm:p-5 text-white relative bg-gradient-to-r ${typeStyles[selectedElon.type].rail}`}>
                  <button
                    type="button"
                    data-student-button="plain"
                    onClick={() => setSelectedElon(null)}
                    className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-black/20 hover:bg-black/35 text-white transition-all no-shelf"
                    aria-label="Yopish"
                  >
                    <X size={15} />
                  </button>
                  
                  <div className="space-y-2 pr-8">
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/20 backdrop-blur-xs border border-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white no-shelf">
                      {selectedElon.type}
                    </span>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight leading-snug">
                      {selectedElon.title}
                    </h2>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  
                  {/* Meta Info Grid */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className={`p-2.5 sm:p-3 rounded-xl border no-shelf ${
                      isLight ? 'border-slate-200/80 bg-slate-50/80' : 'border-slate-800 bg-slate-800/60'
                    }`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500 dark:text-slate-400 mb-0.5">
                        Mas&apos;ul
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                        {selectedElon.teacher || "Tizim ma'muri"}
                      </span>
                    </div>
                    
                    <div className={`p-2.5 sm:p-3 rounded-xl border no-shelf ${
                      isLight ? 'border-slate-200/80 bg-slate-50/80' : 'border-slate-800 bg-slate-800/60'
                    }`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500 dark:text-slate-400 mb-0.5">
                        Sana va Joy
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                        {selectedElon.date} • {selectedElon.room || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Announcement full body */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Xabarnoma matni
                    </span>
                    <div className={`p-3.5 sm:p-4 rounded-xl border text-xs sm:text-sm leading-relaxed max-h-[45vh] overflow-y-auto no-shelf ${
                      isLight
                        ? 'bg-slate-50/70 border-slate-200/80 text-slate-800'
                        : 'bg-slate-950/50 border-slate-800 text-slate-200'
                    }`}>
                      {selectedElon.text}
                    </div>
                  </div>

                  {/* Bottom confirmation action */}
                  <button
                    type="button"
                    data-student-button="plain"
                    onClick={() => setSelectedElon(null)}
                    className="w-full py-2.5 sm:py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-xs no-shelf flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={15} />
                    <span>Tushunarli</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
}
