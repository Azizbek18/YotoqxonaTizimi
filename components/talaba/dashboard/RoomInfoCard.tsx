'use client';

import { useEffect, useState } from 'react';
import { BedDouble, Calendar, CheckCircle, ClipboardList } from 'lucide-react';
import type { CleaningAssignee } from './types';

type Props = {
  isLight: boolean;
  roomNumberFull: string;
  floor: number | null | undefined;
  course: number;
  group: string | number;
  /** Today's weekday name (for the "Bugun (…)" label). */
  todayName: string;
  /** Whoever is on cleaning duty today, or null. */
  todayDutyPerson: CleaningAssignee | null;
  selfId: string | undefined;
  selfName: string | undefined;
  onOpenSchedule: () => void;
};

/**
 * Room summary card: room number + floor, today's cleaning-duty person, a
 * "done today" toggle (per-device, resets each day), and course/group chips.
 * A deliberately bespoke "hero" surface (not the shared dashboardTheme
 * tokens the plainer cards use) — it used to be hardcoded dark-only, which
 * broke light mode; both variants keep the same cyan/indigo accent glow.
 */
export default function RoomInfoCard({
  isLight,
  roomNumberFull,
  floor,
  course,
  group,
  todayName,
  todayDutyPerson,
  selfId,
  selfName,
  onOpenSchedule,
}: Props) {
  const [cleaningDone, setCleaningDone] = useState(false);

  // The "done today" mark is a per-device convenience that clears at midnight.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedDone = localStorage.getItem('room_cleaning_done');
    const savedDate = localStorage.getItem('room_cleaning_date');
    const todayStr = new Date().toDateString();
    if (savedDate === todayStr) {
      setCleaningDone(savedDone === 'true');
    } else {
      setCleaningDone(false);
      localStorage.setItem('room_cleaning_done', 'false');
      localStorage.setItem('room_cleaning_date', todayStr);
    }
  }, []);

  const toggleDone = () => {
    setCleaningDone((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') localStorage.setItem('room_cleaning_done', String(next));
      return next;
    });
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl sm:rounded-[32px] border p-4 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:p-6 ${
      isLight
        ? 'border-blue-100 bg-gradient-to-br from-white via-blue-50/50 to-cyan-50/40 text-slate-900 shadow-[0_24px_70px_rgba(59,130,246,0.1)]'
        : 'border-white/10 bg-gradient-to-br from-[#10182b] via-[#080d18] to-[#07111a] text-white'
    }`}>
      {/* Quiet ambient accents keep the card connected to the cyan UI without
          turning the whole surface into one saturated block. */}
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />
      <div className={`pointer-events-none absolute -right-16 -top-16 size-44 rounded-full blur-3xl ${isLight ? 'bg-blue-400/10' : 'bg-blue-500/15'}`} />
      <div className={`pointer-events-none absolute -bottom-20 -left-16 size-44 rounded-full blur-3xl ${isLight ? 'bg-cyan-400/10' : 'bg-cyan-500/10'}`} />

      <div className="relative z-10 space-y-5">
        {/* Header Room Info */}
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
              isLight ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300'
            }`}>
              <BedDouble size={20} />
            </div>
            <div className="min-w-0">
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isLight ? 'text-blue-600/80' : 'text-cyan-300/70'}`}>Yotgan joyi</span>
              <h2 className={`truncate text-2xl font-black tracking-tight sm:text-3xl ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {roomNumberFull}
              </h2>
            </div>
          </div>
          <div className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
            isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-white/10 bg-white/[0.05] text-slate-200'
          }`}>
            <Calendar size={13} className={isLight ? 'text-blue-500' : 'text-cyan-300'} />
            <span>{floor ? `${floor}-qavat` : '—'}</span>
          </div>
        </div>

        {/* Cleaning Duty Schedule */}
        <div className={`space-y-3 rounded-2xl border p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-4 ${
          isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/[0.08] bg-white/[0.035]'
        }`}>
          <div className="flex justify-between items-center gap-2 max-[359px]:flex-col max-[359px]:items-start">
            <div className="flex items-center gap-2">
              <ClipboardList size={14} className={isLight ? 'text-indigo-500' : 'text-indigo-300'} />
              <p className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tozalik navbatchiligi</p>
            </div>

            <button
              type="button"
              onClick={toggleDone}
              aria-pressed={cleaningDone}
              className={`no-shelf shrink-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[9px] font-black uppercase shadow-none transition-all ${
                cleaningDone
                  ? isLight ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-emerald-400/25 bg-[#0d211d] text-emerald-300'
                  : isLight
                    ? 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                    : 'border-slate-700 bg-[#111827] text-slate-300 hover:border-slate-600 hover:bg-[#172033]'
              }`}
            >
              {cleaningDone ? <CheckCircle size={11} /> : <div className={`size-2.5 rounded-full border ${isLight ? 'border-slate-400' : 'border-slate-400'}`} />}
              <span>{cleaningDone ? 'Tozalangan' : 'Bajarilmadi'}</span>
            </button>
          </div>

          <div className={`space-y-2 text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            <div className={`relative flex flex-col gap-1.5 overflow-hidden rounded-xl border p-3.5 pl-4 ${
              isLight ? 'border-slate-200 bg-white' : 'border-white/[0.07] bg-[#050914]/70'
            }`}>
              <div className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-gradient-to-b from-indigo-400 to-cyan-400" />
              <div className={`flex items-center justify-between text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                <span>Bugun ({todayName})</span>
                <span className="size-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              </div>
              <div className={`mt-1 text-sm font-bold leading-relaxed tracking-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                {todayDutyPerson ? (
                  <span className={todayDutyPerson.id === selfId ? (isLight ? 'text-blue-600' : 'text-cyan-300') : ''}>
                    {todayDutyPerson.id === selfId ? `${selfName} (Siz)` : todayDutyPerson.name}
                  </span>
                ) : (
                  <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Bugun hech kim biriktirilmagan — pastdagi tugma orqali tayinlang</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenSchedule}
              className={`no-shelf mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[9px] font-black uppercase tracking-wider shadow-none transition-all active:scale-98 ${
                isLight
                  ? 'border-blue-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                  : 'border-cyan-400/15 bg-[#0d1725] text-slate-200 hover:border-cyan-400/30 hover:bg-[#102033]'
              }`}
            >
              <ClipboardList size={13} className={isLight ? 'text-blue-500' : 'text-cyan-300'} />
              <span>Hamma navbatchilikni ko&apos;rish</span>
            </button>
          </div>
        </div>

        {/* Course / Group / Status indicators */}
        <div className="grid grid-cols-3 gap-1.5 text-center sm:gap-2">
          <div className={`min-w-0 rounded-xl border px-1.5 py-2.5 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/[0.06] bg-white/[0.03]'}`}>
            <p className={`mb-1 text-[8px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Kurs</p>
            <p className={`truncate text-xs font-black sm:text-sm ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{course}-kurs</p>
          </div>
          <div className={`min-w-0 rounded-xl border px-1.5 py-2.5 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/[0.06] bg-white/[0.03]'}`}>
            <p className={`mb-1 text-[8px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Guruh</p>
            <p className={`truncate text-xs font-black sm:text-sm ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{group}</p>
          </div>
          <div className={`min-w-0 rounded-xl border px-1 py-2.5 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/[0.06] bg-white/[0.03]'}`}>
            <p className={`mb-1 text-[8px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Xona statusi</p>
            <span className={`inline-block max-w-full truncate rounded-md border px-1.5 py-0.5 text-[8px] font-black ${
              isLight ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-400/15 bg-emerald-400/10 text-emerald-300'
            }`}>
              Namunali
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
