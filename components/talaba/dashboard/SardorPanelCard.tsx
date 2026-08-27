'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { dashboardTheme } from './theme';

type Props = {
  isLight: boolean;
  assignedFloor: number | undefined;
};

/** Shown only to floor captains: a link through to the sardor panel. */
export default function SardorPanelCard({ isLight, assignedFloor }: Props) {
  const t = dashboardTheme(isLight);
  return (
    <div className="relative overflow-hidden p-6 rounded-[32px] border border-purple-500/20 bg-purple-500/5 shadow-2xl transition-all duration-300">
      <div className="absolute right-[-10%] top-[-10%] w-[50%] h-[50%] rounded-full blur-[80px] bg-purple-500/20" />
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
            ⭐
          </div>
          <div>
            <h4 className={`text-base font-black tracking-tight ${t.textStrong}`}>Sardorlik Faoliyati</h4>
            <p className="text-[10px] uppercase font-bold tracking-widest text-purple-400">
              {assignedFloor}-qavat sardori
            </p>
          </div>
        </div>
        <p className={`text-xs leading-relaxed ${t.textMuted}`}>
          Siz ushbu qavatning sardori etib tayinlangansiz. Talabalarni ko&apos;rish va yangi e&apos;lon yuborish uchun boshqaruv paneliga o&apos;ting.
        </p>
        <Link
          href="/sardor/dashboard"
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-white/10 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-purple-500/20 active:scale-98"
        >
          Sardor paneliga o&apos;tish
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
