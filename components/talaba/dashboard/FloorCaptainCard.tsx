'use client';

import { dashboardTheme } from './theme';
import type { CaptainInfo } from './types';

type Props = {
  isLight: boolean;
  captain: CaptainInfo;
  floor: number | null | undefined;
};

/** Contact card for the current student's floor captain. */
export default function FloorCaptainCard({ isLight, captain, floor }: Props) {
  const t = dashboardTheme(isLight);
  const initials = captain.full_name?.split(' ').map((n) => n[0]).join('').substring(0, 2) || 'QS';

  return (
    <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${t.surfaceBg} relative overflow-hidden`}>
      <div className="absolute right-[-10%] top-[-10%] w-[40%] h-[40%] rounded-full blur-[60px] bg-cyan-500/10" />
      <div className="relative z-10">
        <h3 className={`text-[10px] font-black tracking-[0.2em] mb-4 uppercase ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
          Qavat Sardori
        </h3>
        <div className="flex items-center gap-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isLight ? 'bg-cyan-50 text-cyan-600' : 'bg-cyan-500/10 text-cyan-400'}`}>
            {initials}
          </div>
          <div>
            <p className={`text-sm font-black tracking-tight ${t.textStrong}`}>{captain.full_name}</p>
            <p className={`text-[10px] ${t.textMuted} font-semibold mt-0.5`}>
              Sizning qavatingiz ({floor ?? ''}-qavat) sardori
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
          <div className={`p-3 rounded-2xl border ${t.cardBorder} ${t.cardInnerBg} text-center`}>
            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Telefon</p>
            <a href={`tel:${captain.phone_number || ''}`} className={`text-[10px] font-black ${t.textStrong} hover:text-cyan-400 transition-colors`}>
              {captain.phone_number || 'Kiritilmagan'}
            </a>
          </div>
          <div className={`p-3 rounded-2xl border ${t.cardBorder} ${t.cardInnerBg} text-center`}>
            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Email</p>
            <p className={`text-[10px] font-black ${t.textStrong} truncate`}>
              {captain.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
