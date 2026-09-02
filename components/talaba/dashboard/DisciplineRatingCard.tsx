'use client';

import { motion } from 'framer-motion';
import { Heart, FileText } from 'lucide-react';
import { dashboardTheme } from './theme';

const MAX_WARNINGS = 3;

type Props = {
  isLight: boolean;
  /** Active warning count (max of users.warning_count and the loaded list). */
  warningCount: number;
  onShowWarnings: () => void;
};

/** Gamified discipline meter: a health bar that drains with each warning. */
export default function DisciplineRatingCard({ isLight, warningCount, onShowWarnings }: Props) {
  const t = dashboardTheme(isLight);
  const healthPercent = Math.max(0, Math.min(100, Math.round(((MAX_WARNINGS - warningCount) / MAX_WARNINGS) * 100)));
  const healthColor =
    healthPercent >= 100 ? 'bg-emerald-500 shadow-emerald-500/30' :
    healthPercent >= 66 ? 'bg-yellow-500 shadow-yellow-500/30' :
    healthPercent >= 33 ? 'bg-orange-500 shadow-orange-500/30' :
    'bg-rose-500 shadow-rose-500/30 animate-pulse';
  const critical = warningCount >= 3;

  return (
    <div className={`backdrop-blur-xl border rounded-3xl sm:rounded-[32px] p-4 sm:p-6 transition-all duration-300 ${
      critical
        ? isLight ? 'bg-red-50 border-red-200 shadow-[0_0_30px_rgba(239,68,68,0.15)]' : 'bg-red-950/20 border-red-500/30'
        : t.surfaceBg
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className={`text-[10px] font-black tracking-[0.2em] uppercase ${
          critical ? 'text-red-500' : isLight ? 'text-blue-600' : 'text-indigo-400'
        }`}>
          Intizom Reytingi
        </h3>

        <div className="flex items-center gap-1.5">
          <Heart size={14} className={critical ? 'text-red-500 animate-pulse' : 'text-emerald-500'} />
          <span className={`text-[10px] font-black uppercase ${critical ? 'text-red-500' : 'text-emerald-500'}`}>
            Intizom darajasi: {healthPercent}%
          </span>
        </div>
      </div>

      <div className="relative w-full h-3 rounded-full bg-white/5 overflow-hidden mb-6 border border-white/5">
        <div
          className={`h-full rounded-full transition-all duration-1000 relative overflow-hidden ${healthColor}`}
          style={{ width: `${healthPercent}%` }}
        >
          {healthPercent === 100 && (
            <motion.div
              animate={{ x: ['-100%', '100%'] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className={`text-xl sm:text-2xl font-black italic ${t.textStrong}`}>{warningCount} ta faol ogohlantirish</p>
            {warningCount === 0 && (
              <motion.span
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}
                className="text-emerald-500 font-bold"
              >
                ✓
              </motion.span>
            )}
          </div>
          <p className={`text-[10px] font-bold mt-1 ${critical ? 'text-red-500 animate-pulse' : t.textMuted}`}>
            {critical ? '⚠️ DIQQAT: CHIQARILISH ARAFSIDA! 3 ta ogohlantirish berilgan.' : "Siz intizom qoidalariga to'liq rioya etyapsiz."}
          </p>
        </div>

        <button
          onClick={onShowWarnings}
          className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
            critical
              ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
              : isLight ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-blue-500' : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          <FileText size={14} />
          <span>Barcha Ogohlantirishlar ({warningCount})</span>
        </button>
      </div>
    </div>
  );
}
