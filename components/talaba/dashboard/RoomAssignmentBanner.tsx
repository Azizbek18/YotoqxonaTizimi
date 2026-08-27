'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, X } from 'lucide-react';

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
export default function RoomAssignmentBanner({ isLight, roomNumber, floor, seenRoomAssignment, onDismiss }: Props) {
  return (
    <AnimatePresence initial={false}>
      {roomNumber ? (
        seenRoomAssignment !== roomNumber && (
          <motion.div
            key={`room-assigned-${roomNumber}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`relative flex items-start gap-3 p-4 pr-12 rounded-3xl border ${
              isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20'
            }`}
          >
            <div className="shrink-0 h-10 w-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-500">
                Sizga xona biriktirildi!
              </h3>
              <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Yotoqxonadan <b>{roomNumber}-xona</b>
                {floor ? ` (${floor}-qavat)` : ''} ajratildi. Ko&apos;chib o&apos;tish tartibi va
                qoidalar bilan tanishib chiqing.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Xabarni yopish"
              className={`absolute right-3 top-3 p-1.5 rounded-lg transition-colors ${
                isLight ? 'text-slate-400 hover:bg-emerald-100' : 'text-slate-400 hover:bg-white/10'
              }`}
            >
              <X size={14} />
            </button>
          </motion.div>
        )
      ) : (
        <motion.div
          key="room-pending"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className={`flex items-start gap-3 p-4 rounded-3xl border ${
            isLight ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/20'
          }`}
        >
          <div className="shrink-0 h-10 w-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center">
            <Clock size={20} />
          </div>
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-500">
              Xona biriktirilishi kutilmoqda
            </h3>
            <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Fakultet dekani sizga xona biriktirgach, bu haqda shu yerda va
              email orqali xabar beriladi.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
