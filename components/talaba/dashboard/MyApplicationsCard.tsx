'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ClipboardList, Plus, FileText, Clock, CheckCircle2, AlertTriangle, type LucideIcon } from 'lucide-react';
import { StaggerList, StaggerItem } from '@/components/motion/StaggerList';
import { dashboardTheme } from './theme';
import { formatElonDate } from './helpers';
import type { MyApplication } from './types';

function statusInfo(status: string, isLight: boolean): { label: string; badgeClass: string; icon: LucideIcon } {
  switch (status) {
    case 'draft':
      return {
        label: 'Qoralama (Draft)',
        badgeClass: isLight ? 'text-slate-600 bg-slate-100 border-slate-200' : 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        icon: FileText,
      };
    case 'submitted':
    case 'pending':
      return {
        label: "Ko'rib chiqilmoqda",
        badgeClass: isLight ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        icon: Clock,
      };
    case 'approved':
      return {
        label: 'Qabul qilindi',
        badgeClass: isLight ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        icon: CheckCircle2,
      };
    case 'rejected':
      return {
        label: 'Rad etildi',
        badgeClass: isLight ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        icon: AlertTriangle,
      };
    default:
      return {
        label: status,
        badgeClass: isLight ? 'text-slate-600 bg-slate-100 border-slate-200' : 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        icon: FileText,
      };
  }
}

type Props = {
  isLight: boolean;
  items: MyApplication[];
};

/** Status cards for the student's own applications / explanatory notes. */
export default function MyApplicationsCard({ isLight, items }: Props) {
  const t = dashboardTheme(isLight);
  return (
    <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${t.surfaceBg}`}>
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <ClipboardList className={isLight ? 'text-blue-600' : 'text-indigo-400'} size={18} />
          <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${t.textStrong}`}>
            Murojaat va Arizalarim Statusi
          </h3>
        </div>
        <Link href="/talaba/arizalar" className={`text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl border transition-all ${
          isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/5 text-gray-300 hover:bg-white/5'
        }`}>
          Yangi Ariza Yozish
        </Link>
      </div>

      <StaggerList className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((app) => {
          const typeLabel = app.type === 'tushuntirish' ? 'Tushuntirish' : 'Ariza';
          const info = statusInfo(app.status, isLight);
          const StatusIcon = info.icon;
          return (
            <StaggerItem key={app.id}>
              <div className={`p-4 rounded-2xl border ${t.cardBorder} ${t.cardInnerBg} flex flex-col justify-between gap-3`}>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black uppercase text-indigo-400">{typeLabel}</span>
                    <span className="text-[9px] font-bold text-gray-500">{formatElonDate(app.createdDate)}</span>
                  </div>
                  <h4 className={`text-xs font-bold line-clamp-2 ${t.textStrong}`}>{app.title}</h4>
                </div>
                <div className={`flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg self-start border ${info.badgeClass}`}>
                  <StatusIcon size={10} />
                  <span>{info.label}</span>
                </div>
              </div>
            </StaggerItem>
          );
        })}
        {items.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`col-span-1 sm:col-span-3 flex flex-col items-center justify-center py-10 px-6 border border-dashed rounded-3xl transition-all duration-300 relative overflow-hidden group ${
              isLight ? 'border-slate-200 bg-white/50 hover:border-blue-400' : 'border-white/10 bg-slate-950/20 hover:border-indigo-500/40'
            }`}
          >
            <div className="absolute -inset-10 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className={`p-4 rounded-2xl mb-4 relative ${isLight ? 'bg-blue-50 text-blue-600' : 'bg-indigo-500/10 text-indigo-400'}`}
            >
              <ClipboardList className="size-8 relative z-10" />
              <span className="absolute inset-0 rounded-2xl bg-current opacity-10 blur-sm animate-pulse" />
            </motion.div>

            <h4 className={`text-sm font-black mb-1 text-center tracking-wide uppercase ${t.textStrong}`}>
              Murojaatlar mavjud emas
            </h4>
            <p className={`text-xs text-center max-w-[280px] mb-5 leading-relaxed ${t.textMuted}`}>
              Sizda hali hech qanday ariza yoki tushuntirish xati yo&apos;q. Hozir yangi ariza yuborishingiz mumkin!
            </p>

            <Link
              href="/talaba/arizalar"
              className={`relative overflow-hidden px-5 py-2.5 rounded-xl border border-white/10 font-bold text-xs uppercase tracking-wider transition-all duration-300 transform active:scale-95 shadow-lg ${
                isLight
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20 hover:shadow-blue-500/30'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-indigo-500/20 hover:shadow-indigo-500/30'
              }`}
            >
              <span className="absolute inset-0 bg-white/10 translate-y-full hover:translate-y-0 transition-transform duration-300" />
              <span className="relative flex items-center gap-1.5">
                <Plus size={14} className="animate-spin-slow" />
                <span>Ariza Yozish</span>
              </span>
            </Link>
          </motion.div>
        )}
      </StaggerList>
    </div>
  );
}
