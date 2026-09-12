'use client';

import Link from 'next/link';
import { Search, ChevronRight } from 'lucide-react';
import { dashboardTheme } from './theme';

type Props = {
  isLight: boolean;
  faculty: string;
  group: string | number;
  fullName: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
};

/** Page header: faculty/group chips, the student's name, and the announcement search box. */
export default function DashboardHeader({ isLight, faculty, group, fullName, searchQuery, onSearchChange }: Props) {
  const t = dashboardTheme(isLight);
  const groupText = String(group ?? '').trim();
  const hasGroup = groupText.length > 0 && groupText !== '—' && groupText !== '-';
  return (
    <header className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-5 sm:gap-6 pb-5 sm:pb-6 border-b ${t.cardBorder}`}>
      <div className="space-y-2 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full ${
            isLight ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-indigo-500/12 text-indigo-300 border border-indigo-400/20'
          }`}>
            {faculty}
          </span>
          {/* An unset group used to render as a lone "—" pill — visual noise
              that told the student nothing. */}
          {hasGroup && (
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full ${
              isLight ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-white/8 text-slate-300 border border-white/10'
            }`}>
              {group}
            </span>
          )}
        </div>
        {/* Title case, not italic caps: this is a person's name, and
            "SHUNQOR TEST TALABA" in black italic reads as a banner, not a
            greeting. The chevron replaces a hover-only sparkle that gave
            touch users no hint the name was a link at all. */}
        <Link href="/talaba/profil" className="group flex items-center gap-1.5 -mx-1 px-1 rounded-lg">
          <h1 className={`text-[26px] leading-tight sm:text-4xl font-extrabold tracking-tight truncate transition-colors ${t.textStrong} group-hover:text-indigo-600`}>
            {fullName}
          </h1>
          <ChevronRight className={`size-5 shrink-0 transition-transform group-hover:translate-x-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
        </Link>
        <p className={`text-xs sm:text-sm ${t.textMuted}`}>Yotoqxona boshqaruv tizimidagi shaxsiy panelingiz.</p>
      </div>

      <div className="relative w-full md:w-80">
        <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 ${isLight ? 'text-slate-400' : 'text-gray-600'}`} />
        <input
          type="text"
          placeholder="E'lonlarni qidirish..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`w-full border rounded-2xl py-3.5 pl-11 pr-4 outline-none text-xs sm:text-sm transition-all ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm'
              : 'bg-white/5 border-white/5 text-white placeholder:text-gray-500 focus:border-blue-500/30'
          }`}
        />
      </div>
    </header>
  );
}
