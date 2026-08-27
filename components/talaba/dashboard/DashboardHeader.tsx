'use client';

import Link from 'next/link';
import { Search, Sparkles } from 'lucide-react';
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
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-white/5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-black uppercase tracking-[0.24em] px-2.5 py-1 rounded-full ${
            isLight ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-blue-500/10 text-cyan-400 border border-blue-500/20'
          }`}>
            {faculty}
          </span>
          <span className={`text-[9px] font-black uppercase tracking-[0.24em] px-2.5 py-1 rounded-full ${
            isLight ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {group}
          </span>
        </div>
        <Link href="/talaba/profil" className="group flex items-center gap-2">
          <h1 className={`text-2xl sm:text-4xl font-black italic tracking-tight uppercase group-hover:text-blue-500 transition-colors ${t.textStrong}`}>
            {fullName}
          </h1>
          <Sparkles className="size-5 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
        <p className={`text-xs ${t.textMuted}`}>Yotoqxona boshqaruv tizimidagi shaxsiy boshqaruv panelingiz.</p>
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
