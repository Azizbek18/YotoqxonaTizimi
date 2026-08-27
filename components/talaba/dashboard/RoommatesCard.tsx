'use client';

import { Phone } from 'lucide-react';
import { StaggerList, StaggerItem } from '@/components/motion/StaggerList';
import { dashboardTheme } from './theme';
import type { Profile } from './types';

type Props = {
  isLight: boolean;
  roommates: Profile[];
};

/** List of the student's roommates with a quick "call" link. */
export default function RoommatesCard({ isLight, roommates }: Props) {
  const t = dashboardTheme(isLight);
  return (
    <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${t.surfaceBg}`}>
      <h3 className={`text-[10px] font-black tracking-[0.2em] mb-4 uppercase ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
        Xonadoshlar ({roommates.length} kishi)
      </h3>

      <StaggerList className="space-y-3">
        {roommates.map((roommate) => {
          const initials = roommate.full_name.split(' ').map((n) => n[0]).join('').substring(0, 2);
          return (
            <StaggerItem key={roommate.id}>
              <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-transparent'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black border bg-blue-500/10 text-cyan-400 border-blue-500/20">
                    {initials}
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${t.textStrong}`}>{roommate.full_name}</p>
                    <p className={`text-[9px] ${t.textMuted}`}>{roommate.course || 1}-kurs | {roommate.faculty || 'Talaba'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {roommate.phone_number ? (
                    <a href={`tel:${roommate.phone_number}`} aria-label={`${roommate.full_name}ga qo'ng'iroq qilish`} className={`p-1.5 rounded-lg border hover:bg-blue-500/10 ${isLight ? 'border-slate-200 text-slate-600' : 'border-white/5 text-gray-400'}`}>
                      <Phone size={12} />
                    </a>
                  ) : (
                    <span title="Telefon raqami kiritilmagan" className={`p-1.5 rounded-lg border opacity-40 ${isLight ? 'border-slate-200 text-slate-400' : 'border-white/5 text-gray-500'}`}>
                      <Phone size={12} />
                    </span>
                  )}
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                </div>
              </div>
            </StaggerItem>
          );
        })}
        {roommates.length === 0 && (
          <p className={`text-xs text-center py-4 ${t.textMuted}`}>Xonadoshlar ma&apos;lumoti topilmadi.</p>
        )}
      </StaggerList>
    </div>
  );
}
