'use client';

import { createPortal } from 'react-dom';
import { X, User, MapPin } from 'lucide-react';
import { useMounted } from './useMounted';
import type { Elon } from './types';

type Props = {
  elon: Elon | null;
  onClose: () => void;
};

/** Full detail of a single announcement. */
export default function AnnouncementModal({ elon, onClose }: Props) {
  const mounted = useMounted();
  if (!mounted || typeof document === 'undefined' || !elon) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-[#0b0f19] border border-white/5 p-0 rounded-2xl sm:rounded-[40px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 sm:p-8 text-white relative">
          <div className="absolute top-4 sm:top-6 right-4 sm:right-6">
            <button onClick={onClose} className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white cursor-pointer"><X size={14} /></button>
          </div>
          <span className="text-[9px] font-black bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest mb-2 sm:mb-3 inline-block">
            {elon.type}
          </span>
          <h3 className="text-xl sm:text-3xl font-black italic tracking-tight leading-tight">{elon.title}</h3>
        </div>

        <div className="p-5 sm:p-7 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <User size={14} />
                <span className="text-[8px] font-black uppercase">Mas&apos;ul</span>
              </div>
              <p className="text-xs font-bold text-white">{elon.teacher}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <MapPin size={14} />
                <span className="text-[8px] font-black uppercase">Joy</span>
              </div>
              <p className="text-xs font-bold text-white">{elon.room}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Batafsil ma&apos;lumot</p>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5 italic">
              &quot;{elon.desc}&quot;
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all text-white cursor-pointer"
          >
            Tushunarli
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
