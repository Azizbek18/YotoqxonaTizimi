'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { CheckCircle2, Clock, ChevronRight, X } from 'lucide-react';

type Props = {
  isLight: boolean;
  roomNumber: string | null | undefined;
  floor: number | null | undefined;
  /** The room number the student last dismissed this banner for. */
  seenRoomAssignment: string | null;
  onDismiss: () => void;
};

/**
 * Top-of-page notice: a green "room assigned" banner (dismissible, and it
 * re-appears if the room later changes) or an amber "waiting for a room" one.
 */
export default function RoomAssignmentBanner({
  isLight,
  roomNumber,
  floor,
  seenRoomAssignment,
  onDismiss,
}: Props) {
  return (
    <AnimatePresence initial={false}>
      {roomNumber ? (
        seenRoomAssignment !== roomNumber && (
          <motion.div
            key={`room-assigned-${roomNumber}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`no-shelf relative rounded-2xl border p-3.5 min-[360px]:p-4 text-left transition-all ${
              isLight
                ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/60 via-white to-white shadow-xs'
                : 'border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-slate-900/60 to-slate-900/60 shadow-xs'
            }`}
          >
            {/* Dismiss Cross */}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Xabarni yopish"
              data-student-button="plain"
              className="no-shelf absolute right-2.5 top-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition"
            >
              <X size={14} />
            </button>

            <div className="flex items-start gap-3 min-w-0 pr-6">
              {/* Academic Icon Medallion */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={18} strokeWidth={2.2} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-xs min-[360px]:text-sm font-bold text-slate-900 dark:text-white">
                    Sizga xona biriktirildi
                  </h3>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    #{roomNumber}-xona{floor ? ` (${floor}-qavat)` : ''}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Yotoqxonadan sizga rasman joy ajratildi. Ko‘chib o‘tish tartibi va ichki qoidalar bilan tanishib chiqing.
                </p>

                <div className="mt-2.5 flex items-center gap-3">
                  <Link
                    href="/talaba/qoidalar"
                    prefetch={false}
                    data-student-button="plain"
                    className="no-shelf inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <span>Yotoqxona qoidalari</span>
                    <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )
      ) : (
        <motion.div
          key="room-pending"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className={`no-shelf relative rounded-2xl border p-3.5 min-[360px]:p-4 text-left transition-all ${
            isLight
              ? 'border-amber-200/80 bg-gradient-to-r from-amber-50/60 via-white to-white shadow-xs'
              : 'border-amber-500/20 bg-gradient-to-r from-amber-950/20 via-slate-900/60 to-slate-900/60 shadow-xs'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Clock size={18} strokeWidth={2.2} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-xs min-[360px]:text-sm font-bold text-slate-900 dark:text-white">
                  Xona biriktirilishi kutilmoqda
                </h3>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Navbatda
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Fakultet dekanati sizga xona biriktirgach, bu haqda tizimda va elektron pochtangiz orqali xabar beriladi.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
