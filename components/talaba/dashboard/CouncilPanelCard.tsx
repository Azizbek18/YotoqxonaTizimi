'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { dashboardTheme } from './theme';

type Props = {
  isLight: boolean;
  gender: string | undefined;
};

/** Shown only to the talaba kengashi raisi (student council chair): a link
 *  through to the kengash panel. Mirrors SardorPanelCard's entry-point
 *  pattern — without this card a raisi has no way to discover /kengash. */
export default function CouncilPanelCard({ isLight, gender }: Props) {
  const t = dashboardTheme(isLight);
  const genderLabel = gender === 'Ayol' || gender === 'female' ? 'Qizlar' : 'Yigitlar';
  return (
    <div className="relative overflow-hidden p-6 rounded-[32px] border border-indigo-500/20 bg-indigo-500/5 shadow-2xl transition-all duration-300">
      <div className="absolute right-[-10%] top-[-10%] w-[50%] h-[50%] rounded-full blur-[80px] bg-indigo-500/20" />
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
            🎓
          </div>
          <div>
            <h4 className={`text-base font-extrabold tracking-tight ${t.textStrong}`}>Kengash Faoliyati</h4>
            <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">
              Talaba kengashi raisi ({genderLabel.toLowerCase()})
            </p>
          </div>
        </div>
        <p className={`text-xs leading-relaxed ${t.textMuted}`}>
          Siz butun fakultet {genderLabel.toLowerCase()} talabalari uchun kengash raisi etib tayinlangansiz. Talabalar va sardorlarni ko&apos;rish, yangi e&apos;lon yuborish uchun boshqaruv paneliga o&apos;ting.
        </p>
        <Link
          href="/kengash/dashboard"
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-indigo-500/20 active:scale-98"
        >
          Kengash paneliga o&apos;tish
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
