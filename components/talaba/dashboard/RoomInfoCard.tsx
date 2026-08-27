'use client';

import { useEffect, useState } from 'react';
import { Calendar, CheckCircle } from 'lucide-react';
import type { CleaningAssignee } from './types';

type Props = {
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
 * The blue room card: room number + floor, today's cleaning-duty person, a
 * "done today" toggle (per-device, resets each day), and course/group chips.
 */
export default function RoomInfoCard({
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
    <div className="relative overflow-hidden p-6 rounded-[32px] bg-blue-600 text-white border border-blue-500/40 transition-all duration-300">
      {/* Background Glow */}
      <div className="absolute right-[-10%] top-[-10%] w-[50%] h-[50%] rounded-full blur-[80px] bg-cyan-400/20" />

      <div className="relative z-10 space-y-5">
        {/* Header Room Info */}
        <div className="flex justify-between items-center py-1">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Yotgan Joyi</span>
            <h2 className="text-3xl sm:text-4xl font-black italic tracking-tight text-white select-none">
              {roomNumberFull}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-xs font-black">
            <Calendar size={14} className="text-cyan-300" />
            <span>{floor ? `${floor}-qavat` : '—'}</span>
          </div>
        </div>

        {/* Cleaning Duty Schedule */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          <div className="flex justify-between items-center">
            <p className="text-[9px] font-black tracking-widest text-white/55 uppercase">Tozalik Navbatchiligi</p>

            <button
              onClick={toggleDone}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black transition-all uppercase ${
                cleaningDone ? 'bg-green-500 text-white' : 'bg-white/15 text-white/70 hover:bg-white/20'
              }`}
            >
              {cleaningDone ? <CheckCircle size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-white/40" />}
              <span>{cleaningDone ? 'Tozalangan' : 'Bajarilmadi'}</span>
            </button>
          </div>

          <div className="space-y-2 text-xs font-semibold text-white/90">
            <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex justify-between items-center text-[10px] opacity-60 font-semibold uppercase tracking-wider">
                <span>Bugun ({todayName})</span>
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </div>
              <div className="text-sm font-black tracking-tight text-white mt-1">
                {todayDutyPerson ? (
                  <span className={todayDutyPerson.id === selfId ? 'text-cyan-200' : ''}>
                    {todayDutyPerson.id === selfId ? `${selfName} (Siz)` : todayDutyPerson.name}
                  </span>
                ) : (
                  <span className="text-white/50 italic">Bugun hech kim biriktirilmagan — pastdagi tugma orqali tayinlang</span>
                )}
              </div>
            </div>

            <button
              onClick={onOpenSchedule}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/5 text-white text-[9px] font-black uppercase tracking-wider transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 mt-2"
            >
              <span>📋 Hamma navbatchilikni ko&apos;rish</span>
            </button>
          </div>
        </div>

        {/* Course / Group / Status indicators */}
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
  );
}
