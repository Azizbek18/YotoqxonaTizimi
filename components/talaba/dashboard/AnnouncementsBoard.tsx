'use client';

import { Megaphone, Clock, User, MapPin, ArrowRight } from 'lucide-react';
import { dashboardTheme } from './theme';
import type { Elon } from './types';

const CATEGORIES = ['Barchasi', 'Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish'];

function typeStyles(type: Elon['type']) {
  switch (type) {
    case 'Muhim':
      return { border: 'border-l-rose-500', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    case 'Tadbir':
      return { border: 'border-l-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'Ogohlantirish':
      return { border: 'border-l-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    default:
      return { border: 'border-l-cyan-500', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' };
  }
}

type Props = {
  isLight: boolean;
  items: Elon[];
  category: string;
  onCategoryChange: (category: string) => void;
  onSelect: (elon: Elon) => void;
};

/** The notice board: category filter chips + a list of announcement cards. */
export default function AnnouncementsBoard({ isLight, items, category, onCategoryChange, onSelect }: Props) {
  const t = dashboardTheme(isLight);
  return (
    <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${t.surfaceBg}`}>
      <div className="flex flex-col gap-3.5 mb-6">
        <div>
          <h3 className={`text-base font-black uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`}>
            <Megaphone size={18} /> E&apos;lonlar va Xabarnomalar
          </h3>
          <p className={`text-[10px] mt-1 ${t.textMuted}`}>Yotoqxona ma&apos;muriyati tomonidan chop etilgan so&apos;nggi yangiliklar.</p>
        </div>

        <div className="flex overflow-x-auto no-scrollbar gap-1.5 max-w-full pb-1 flex-nowrap shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-200 shrink-0 ${
                category === cat
                  ? 'bg-blue-600 text-white'
                  : isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-gray-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {items.map((elon) => {
          const styles = typeStyles(elon.type);
          return (
            <div
              key={elon.id}
              onClick={() => onSelect(elon)}
              className={`relative overflow-hidden rounded-2xl border-l-[6px] border border-y-transparent border-r-transparent p-5 cursor-pointer transition-all duration-200 hover:translate-x-1 group flex flex-col md:flex-row md:items-center justify-between gap-4 ${styles.border} ${
                isLight ? 'bg-white hover:bg-slate-50/50 border-slate-200 shadow-sm' : 'bg-white/5 hover:bg-white/10 border-white/5'
              }`}
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${styles.badge}`}>
                    {elon.type}
                  </span>
                  {elon.is_from_captain && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-400">
                      🌟 Qavat Sardori
                    </span>
                  )}
                  <div className={`flex items-center gap-1 text-[10px] ${t.textMuted}`}>
                    <Clock size={11} />
                    <span>{elon.time}</span>
                  </div>
                </div>

                <h4 className={`text-base font-extrabold tracking-tight group-hover:text-blue-500 transition-colors ${t.textStrong}`}>
                  {elon.title}
                </h4>
                <p className={`text-xs leading-relaxed line-clamp-2 ${t.textMuted}`}>{elon.desc}</p>
              </div>

              <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-white/5 pt-3 md:pt-0 gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <User size={12} className={isLight ? 'text-slate-400' : 'text-gray-500'} />
                  <span className={`text-[10px] font-bold ${t.textStrong}`}>{elon.teacher}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className={isLight ? 'text-slate-400' : 'text-gray-500'} />
                  <span className={`text-[10px] font-bold ${t.textMuted}`}>{elon.room}</span>
                </div>
                <div className={`hidden md:flex items-center gap-0.5 text-xs font-black uppercase tracking-wider ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
                  <span>Batafsil</span>
                  <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className={`text-center py-12 border border-dashed rounded-2xl ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
            <Megaphone className={`size-8 mx-auto mb-2 opacity-30 ${t.textMuted}`} />
            <p className={`text-xs ${t.textMuted} italic`}>Ushbu toifaga tegishli e&apos;lonlar topilmadi.</p>
          </div>
        )}
      </div>
    </div>
  );
}
