"use client";

import React, { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { useThemeStore } from '@/lib/stores/theme-store';
import { supabase } from '@/lib/supabase';

interface Elon {
  id: string | number;
  title: string;
  text: string;
  date: string;
  type: 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish';
  audience: 'all' | 'faculty';
  faculty: string | null;
}

interface DbElon {
  id: string;
  title: string;
  text: string;
  type: Elon['type'];
  audience: 'all' | 'faculty';
  faculty: string | null;
  is_published: boolean;
  created_at: string;
  published_at: string | null;
}

type ViewMode = 'dorm' | 'faculty';
type FilterType = 'Barchasi' | Elon['type'];

const FILTERS: FilterType[] = ['Barchasi', 'Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish'];

const DATA: { umumiy: Elon[] } = {
  umumiy: [
    { id: 1, title: "Internet tezligi 100 Mbit/s", text: "Yotoqxona bo'ylab barcha routerlar 5G standartiga o'tkazildi.", date: "Bugun", type: "Yangilik", audience: 'all', faculty: null },
    { id: 2, title: "Liftlar yangilandi", text: "Barcha bloklardagi liftlar Germaniya texnologiyasi asosida to'liq modernizatsiya qilindi.", date: "Bugun", type: "Muhim", audience: 'all', faculty: null },
    { id: 3, title: "Futbol turniri: Final", text: "Ertaga soat 17:00 da 1-va 4-blok jamoalari o'rtasida final o'yini bo'lib o'tadi.", date: "Bugun", type: "Tadbir", audience: 'all', faculty: null },
    { id: 4, title: "Kutubxona 24/7", text: "Imtihonlar mavsumi sababli kutubxona tunu-kun ishlash tartibiga o'tdi.", date: "Kecha", type: "Yangilik", audience: 'all', faculty: null },
    { id: 5, title: "Elektr uzilishi", text: "Texnik ishlar sababli juma kuni soat 14:00 dan 16:00 gacha svet o'chadi.", date: "Kecha", type: "Ogohlantirish", audience: 'all', faculty: null },
  ],
};

const typeStyles: Record<Elon['type'], { badge: string; rail: string; glow: string; icon: React.ReactNode }> = {
  Muhim: {
    badge: 'border-rose-400/40 bg-rose-500/12 text-rose-300',
    rail: 'from-rose-500 to-red-600',
    glow: 'shadow-rose-500/15',
    icon: <Bell size={18} />,
  },
  Tadbir: {
    badge: 'border-emerald-400/40 bg-emerald-500/12 text-emerald-300',
    rail: 'from-emerald-400 to-teal-600',
    glow: 'shadow-emerald-500/15',
    icon: <CalendarDays size={18} />,
  },
  Yangilik: {
    badge: 'border-sky-400/40 bg-sky-500/12 text-sky-300',
    rail: 'from-sky-400 to-blue-600',
    glow: 'shadow-sky-500/15',
    icon: <Megaphone size={18} />,
  },
  Ogohlantirish: {
    badge: 'border-amber-400/40 bg-amber-500/12 text-amber-300',
    rail: 'from-amber-300 to-orange-600',
    glow: 'shadow-amber-500/15',
    icon: <Clock3 size={18} />,
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
  };
}

export default function ElonlarPage() {
  const [view, setView] = useState<ViewMode>('dorm');
  const [selectedElon, setSelectedElon] = useState<Elon | null>(null);
  const [elonlar, setElonlar] = useState<Elon[]>(DATA.umumiy);
  const [currentFaculty, setCurrentFaculty] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('Barchasi');
  const theme = useThemeStore((state) => state.theme);
  const isLight = theme === 'light';

  useEffect(() => {
    let isMounted = true;

    const loadElonlar = async () => {
      try {
        const response = await fetch('/api/elonlar');
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "E'lonlarni yuklashda xatolik");
        }

        if (isMounted && Array.isArray(result.elonlar)) {
          const mapped = result.elonlar.map((elon: DbElon) => mapDbElon(elon));
          setElonlar(mapped.length > 0 ? mapped : DATA.umumiy);
          setCurrentFaculty(typeof result.currentFaculty === 'string' ? result.currentFaculty : null);
        }
      } catch (error) {
        console.error("E'lonlarni yuklashda xatolik:", error);
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

  const newestElon = filteredElonlar[0] ?? activeList[0] ?? DATA.umumiy[0];
  const importantCount = activeList.filter((elon) => elon.type === 'Muhim' || elon.type === 'Ogohlantirish').length;

  const pageBg = isLight
    ? 'bg-[linear-gradient(135deg,#eef5ff_0%,#f8fafc_44%,#edfdf8_100%)] text-slate-950'
    : 'bg-[linear-gradient(135deg,#020617_0%,#07111f_48%,#03150f_100%)] text-white';
  const panel = isLight
    ? 'border-slate-200/80 bg-white/82 shadow-[0_20px_60px_rgba(15,23,42,0.08)]'
    : 'border-white/10 bg-slate-950/58 shadow-[0_24px_80px_rgba(0,0,0,0.32)]';
  const muted = isLight ? 'text-slate-600' : 'text-slate-400';
  const strong = isLight ? 'text-slate-950' : 'text-white';

  const switchView = (nextView: ViewMode) => {
    setSearch('');
    setFilter('Barchasi');
    setView(nextView);
  };

  return (
    <div className={`relative min-h-screen overflow-hidden rounded-[24px] transition-colors ${pageBg}`}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(148,163,184,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.5)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_50%_0%,rgba(14,165,233,.18),transparent_34%),radial-gradient(circle_at_90%_80%,rgba(16,185,129,.14),transparent_30%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
          <div className={`relative overflow-hidden rounded-3xl border p-5 backdrop-blur-xl sm:p-7 ${panel}`}>
            <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-sky-400 via-emerald-400 to-amber-300" />
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] ${isLight ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-sky-400/25 bg-sky-400/10 text-sky-200'}`}>
                  <Sparkles size={14} />
                  Talaba xabarnomasi
                </div>
                <h1 className={`text-3xl font-black leading-[1.02] tracking-tight sm:text-5xl ${strong}`}>
                  E&apos;lonlar markazi
                </h1>
                <p className={`mt-3 max-w-2xl text-sm font-medium leading-6 sm:text-base ${muted}`}>
                  Yotoqxona yangiliklari va faqat sizning fakultetingizga tegishli xabarlar bir joyda, aniq va tez ochiladi.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                <div className={`rounded-2xl border px-4 py-3 ${isLight ? 'border-slate-200 bg-white/70' : 'border-white/10 bg-white/[0.05]'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${muted}`}>Jami</p>
                  <p className="mt-1 text-2xl font-black">{activeList.length}</p>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${isLight ? 'border-slate-200 bg-white/70' : 'border-white/10 bg-white/[0.05]'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${muted}`}>Muhim</p>
                  <p className="mt-1 text-2xl font-black">{importantCount}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block [perspective:1200px]">
            <button
              type="button"
              onClick={() => setSelectedElon(newestElon)}
              className={`group relative h-full min-h-[250px] w-full rounded-3xl border p-5 text-left backdrop-blur-xl transition duration-300 [transform:rotateY(-12deg)_rotateX(7deg)] hover:[transform:rotateY(-5deg)_rotateX(3deg)_translateY(-4px)] ${panel}`}
            >
              <div className="absolute inset-3 rounded-2xl border border-white/10" />
              <div className={`absolute -right-5 top-9 h-28 w-28 rounded-[28px] border ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.04]'} [transform:translateZ(40px)_rotate(10deg)]`} />
              <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border ${typeStyles[newestElon.type].badge} [transform:translateZ(55px)]`}>
                {typeStyles[newestElon.type].icon}
              </div>
              <p className={`relative mt-8 text-[10px] font-black uppercase tracking-[0.24em] ${muted} [transform:translateZ(45px)]`}>So&apos;nggi e&apos;lon</p>
              <h2 className={`relative mt-2 line-clamp-2 text-2xl font-black leading-tight ${strong} [transform:translateZ(55px)]`}>
                {newestElon.title}
              </h2>
              <p className={`relative mt-3 line-clamp-3 text-sm leading-6 ${muted} [transform:translateZ(35px)]`}>
                {newestElon.text}
              </p>
              <div className="relative mt-5 inline-flex items-center gap-2 text-sm font-black text-sky-400 [transform:translateZ(50px)]">
                Ochish <ChevronRight size={16} className="transition group-hover:translate-x-1" />
              </div>
            </button>
          </div>
        </section>

        <section className={`rounded-3xl border p-3 backdrop-blur-xl sm:p-4 ${panel}`}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => switchView('dorm')}
                className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition ${view === 'dorm' ? 'border-sky-400 bg-sky-500 text-white shadow-lg shadow-sky-500/20' : isLight ? 'border-slate-200 bg-white/70 text-slate-700' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}
              >
                <Megaphone size={16} />
                Yotoqxona e&apos;lonlari
              </button>
              <button
                type="button"
                onClick={() => switchView('faculty')}
                className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition ${view === 'faculty' ? 'border-emerald-400 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : isLight ? 'border-slate-200 bg-white/70 text-slate-700' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}
              >
                <GraduationCap size={16} />
                {currentFaculty ?? 'Mening fakultetim'}
              </button>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className={`flex min-w-0 items-center gap-2 rounded-2xl border px-3 ${isLight ? 'border-slate-200 bg-white/80' : 'border-white/10 bg-slate-950/35'}`}>
                <Search size={17} className={muted} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="E'lon qidirish"
                  className={`h-12 w-full min-w-0 bg-transparent text-sm font-semibold outline-none placeholder:font-medium ${strong}`}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {FILTERS.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setFilter(item)}
                    className={`shrink-0 rounded-2xl border px-3 py-2 text-xs font-black transition ${filter === item ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950' : isLight ? 'border-slate-200 bg-white/70 text-slate-600' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {(
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              {loading && view === 'dorm' ? (
                <div className={`rounded-3xl border p-8 text-center text-sm font-bold ${panel} ${muted}`}>
                  E&apos;lonlar yuklanmoqda...
                </div>
              ) : filteredElonlar.length === 0 ? (
                <div className={`rounded-3xl border p-8 text-center ${panel}`}>
                  <Megaphone className={`mx-auto mb-3 ${muted}`} size={30} />
                  <p className="text-lg font-black">E&apos;lon topilmadi</p>
                  <p className={`mt-2 text-sm ${muted}`}>
                    {view === 'faculty'
                      ? `${currentFaculty ?? 'Fakultetingiz'} uchun hozircha e'lon yo'q.`
                      : "Qidiruv yoki filtrni o'zgartirib ko'ring."}
                  </p>
                </div>
              ) : (
                filteredElonlar.map((elon, index) => (
                  <button
                    type="button"
                    key={elon.id}
                    onClick={() => setSelectedElon(elon)}
                    className={`group relative w-full overflow-hidden rounded-3xl border p-4 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl ${panel} ${typeStyles[elon.type].glow}`}
                  >
                    <div className={`absolute bottom-0 left-0 top-0 w-1.5 bg-linear-to-b ${typeStyles[elon.type].rail}`} />
                    <div className="grid gap-4 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center">
                      <div className="relative h-14 w-14 [perspective:700px]">
                        <div className={`absolute inset-0 rounded-2xl border ${typeStyles[elon.type].badge} [transform:rotateY(-18deg)_rotateX(14deg)] shadow-xl transition group-hover:[transform:rotateY(-8deg)_rotateX(8deg)_translateZ(10px)]`}>
                          <div className="flex h-full w-full items-center justify-center">
                            {typeStyles[elon.type].icon}
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${typeStyles[elon.type].badge}`}>
                            {elon.type}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${muted}`}>
                            <Clock3 size={13} />
                            {elon.date}
                          </span>
                        </div>
                        <h3 className={`line-clamp-2 text-lg font-black leading-tight sm:text-xl ${strong}`}>
                          {elon.title}
                        </h3>
                        <p className={`mt-2 line-clamp-2 text-sm leading-6 ${muted}`}>
                          {elon.text}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <span className={`text-xs font-black ${muted}`}>#{String(index + 1).padStart(2, '0')}</span>
                        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition group-hover:translate-x-1 ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-white/10 bg-white/[0.04] text-white'}`}>
                          <ChevronRight size={18} />
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <aside className="hidden lg:block">
              <div className={`sticky top-28 rounded-3xl border p-5 backdrop-blur-xl ${panel}`}>
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${muted}`}>Ko&apos;rinish</p>
                <div className="mt-5 space-y-3">
                  {FILTERS.slice(1).map((item) => {
                    const count = activeList.filter((elon) => elon.type === item).length;
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => setFilter(item)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${filter === item ? typeStyles[item].badge : isLight ? 'border-slate-200 bg-white/60' : 'border-white/10 bg-white/[0.03]'}`}
                      >
                        <span className="text-sm font-black">{item}</span>
                        <span className="text-sm font-black">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          </section>
        )}
      </div>

      {selectedElon && (
        <div className={`fixed inset-0 z-100 flex items-end justify-center p-3 backdrop-blur-2xl sm:items-center sm:p-6 ${isLight ? 'bg-slate-950/30' : 'bg-black/70'}`}>
          <div className={`relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border p-5 shadow-2xl sm:p-7 ${panel}`}>
            <button
              type="button"
              onClick={() => setSelectedElon(null)}
              className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl border ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-white/10 bg-white/[0.06] text-white'}`}
              aria-label="Yopish"
            >
              <X size={18} />
            </button>

            <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border ${typeStyles[selectedElon.type].badge}`}>
              {typeStyles[selectedElon.type].icon}
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2 pr-12">
              <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${typeStyles[selectedElon.type].badge}`}>
                {selectedElon.type}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs font-bold ${muted}`}>
                <Clock3 size={13} />
                {selectedElon.date}
              </span>
            </div>
            <h2 className={`text-2xl font-black leading-tight sm:text-4xl ${strong}`}>{selectedElon.title}</h2>
            <p className={`mt-5 text-base font-medium leading-8 sm:text-lg ${muted}`}>{selectedElon.text}</p>
            <button
              type="button"
              onClick={() => setSelectedElon(null)}
              className="mt-7 w-full rounded-2xl bg-sky-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700"
            >
              Tushunarli
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
