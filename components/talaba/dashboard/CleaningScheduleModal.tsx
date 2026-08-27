'use client';

import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { DragEvent } from 'react';
import CustomSelect from '@/components/ui/CustomSelect';
import { useMounted } from './useMounted';
import type { CleaningScheduleMap, Resident } from './types';

type Props = {
  open: boolean;
  isLight: boolean;
  roomNumber: string | null | undefined;
  weekdays: string[];
  residents: Resident[];
  draftSchedule: CleaningScheduleMap;
  activeDragOverDay: string | null;
  selectedResidentId: string | null;
  isSaving: boolean;
  onClose: () => void;
  onDayClick: (day: string) => void;
  onDragStart: (e: DragEvent, residentId: string) => void;
  onDragOver: (e: DragEvent) => void;
  onDragEnter: (e: DragEvent, day: string) => void;
  onDragLeave: (e: DragEvent, day: string) => void;
  onDrop: (e: DragEvent, day: string) => void;
  onResidentClick: (residentId: string) => void;
  onSetSlot: (day: string, residentId: string) => void;
  onReset: () => void;
  onSave: () => void;
};

/** Weekly cleaning-duty editor: assign a roommate to each day by drag, click, or select. */
export default function CleaningScheduleModal({
  open,
  isLight,
  roomNumber,
  weekdays,
  residents,
  draftSchedule,
  activeDragOverDay,
  selectedResidentId,
  isSaving,
  onClose,
  onDayClick,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onResidentClick,
  onSetSlot,
  onReset,
  onSave,
}: Props) {
  const mounted = useMounted();
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop with Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#02040a]/60 backdrop-blur-md"
          />

          {/* 3D Premium Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateX: -8, y: 20 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, rotateX: 8, y: -20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
            className={`relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl sm:rounded-[32px] border shadow-[0_0_50px_rgba(30,58,138,0.4)] ${
              isLight
                ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-200/50'
                : 'bg-[#0f172a]/90 border-white/10 text-white shadow-indigo-950/50'
            }`}
          >
            {/* Premium Background Glows */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full blur-[100px] bg-blue-600/10 pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full blur-[100px] bg-purple-600/10 pointer-events-none" />

            {/* Modal Header */}
            <div className={`relative z-10 shrink-0 flex justify-between items-center gap-3 border-b px-4 sm:px-8 pt-4 sm:pt-8 pb-4 ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight flex items-center gap-2">
                  🧹 Tozalik Navbatchiligi
                </h2>
                <p className={`text-xs mt-1 truncate ${textMuted}`}>
                  Xona {roomNumber || '—'} uchun hafta kunlariga navbatchilarni biriktiring.
                </p>
              </div>
              <button
                onClick={onClose}
                className={`shrink-0 p-2 rounded-full border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 sm:px-8 py-4 sm:py-6 space-y-8">
              {/* Top Section: Weekdays List */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-blue-500 mb-4">
                  📅 Hafta Kunlari (Navbatchilik Slotlari)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  {weekdays.map((day) => {
                    const assigned = draftSchedule[day];
                    const isDragOver = activeDragOverDay === day;
                    return (
                      <div
                        key={day}
                        onClick={() => onDayClick(day)}
                        onDragOver={(e) => onDragOver(e)}
                        onDragEnter={(e) => onDragEnter(e, day)}
                        onDragLeave={(e) => onDragLeave(e, day)}
                        onDrop={(e) => onDrop(e, day)}
                        className={`group relative min-w-0 flex flex-col justify-between p-3.5 min-h-[105px] rounded-2xl border transition-all duration-300 cursor-pointer select-none ${
                          isDragOver
                            ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(34,211,238,0.25)] scale-[1.02]'
                            : assigned
                              ? isLight
                                ? 'border-blue-200 bg-blue-50/70 hover:border-blue-300'
                                : 'border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50'
                              : isLight
                                ? 'border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-100/50 hover:border-slate-400'
                                : 'border-dashed border-white/10 bg-slate-950/20 hover:bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <span className={`text-[10px] font-black uppercase tracking-wider mb-2 truncate ${
                          assigned
                            ? isLight ? 'text-blue-600' : 'text-cyan-400'
                            : textMuted
                        }`}>
                          {day}
                        </span>

                        <div className="flex-grow flex items-end min-w-0" onClick={(e) => e.stopPropagation()}>
                          <CustomSelect
                            value={assigned ? assigned.id : ''}
                            onChange={(val) => onSetSlot(day, val)}
                            placeholder="— Bo'sh —"
                            options={[
                              { value: '', label: "— Bo'sh —" },
                              ...residents.map((r) => ({ value: r.id, label: r.name.replace(' (Siz)', '') })),
                            ]}
                            className={`min-w-0 text-xs font-bold py-1.5 px-2 rounded-xl border focus:outline-hidden transition-all cursor-pointer ${
                              isLight
                                ? 'bg-white border-slate-200 text-slate-800 focus:border-blue-400 shadow-xs'
                                : 'bg-slate-900 border-white/5 text-white focus:border-cyan-400 shadow-md shadow-black/20'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Section: Roommates (Draggable Cards) */}
              <div>
                <div className="flex justify-between items-center gap-2 mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500 truncate">
                    👥 Xonadoshlar (Ushlab torting yoki Tanlang)
                  </h3>
                  <span className={`shrink-0 text-[10px] font-semibold ${textMuted}`}>
                    {selectedResidentId ? '💡 Kunni bosing' : '💡 Torting yoki bosing'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {residents.map((resident) => {
                    const isSelected = selectedResidentId === resident.id;
                    const isSelf = resident.isSelf;
                    return (
                      <div
                        key={resident.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, resident.id)}
                        onClick={() => onResidentClick(resident.id)}
                        className={`group relative min-w-0 flex flex-col justify-between p-4 rounded-2xl cursor-grab active:cursor-grabbing select-none transition-all duration-300 transform preserve-3d ${
                          isSelected
                            ? 'border-2 border-yellow-500 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.25)] scale-[1.03] -translate-y-1'
                            : isLight
                              ? 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
                              : 'bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 hover:-translate-y-0.5 shadow-lg'
                        }`}
                        style={{
                          boxShadow: isSelected
                            ? '0 10px 20px rgba(234,179,8,0.15)'
                            : isLight
                              ? '0 4px 6px rgba(0,0,0,0.02), 0 10px 15px -3px rgba(0,0,0,0.03)'
                              : '0 4px 6px rgba(0,0,0,0.1), 0 10px 15px -3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
                        }}
                      >
                        {/* Draggable Icon indicator */}
                        <div className="flex justify-between items-center mb-3">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            isSelf
                              ? 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20'
                              : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-slate-400'
                          }`}>
                            {isSelf ? 'Siz' : 'Xonadosh'}
                          </span>
                          <div className="flex flex-col gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                            <span className="w-2.5 h-0.5 bg-current rounded-full" />
                            <span className="w-2.5 h-0.5 bg-current rounded-full" />
                            <span className="w-2.5 h-0.5 bg-current rounded-full" />
                          </div>
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-black tracking-tight leading-tight mb-1 truncate">
                            {resident.name.replace(' (Siz)', '')}
                          </p>
                          <p className={`text-[10px] ${textMuted} font-semibold truncate`}>
                            Tanlang yoki torting
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div className={`relative z-10 shrink-0 flex flex-wrap justify-between items-center border-t px-4 sm:px-8 pb-4 sm:pb-8 pt-4 gap-3 ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
              <button
                onClick={onReset}
                className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:bg-white/10'
                }`}
              >
                🔄 Asliga Qaytarish
              </button>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className={`px-5 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      : 'bg-white/0 border-white/5 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  Bekor Qilish
                </button>
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white active:scale-95 transition-all duration-300 disabled:opacity-50 cursor-pointer ${
                    isLight
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Saqlanmoqda...
                    </>
                  ) : (
                    'Saqlash'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
