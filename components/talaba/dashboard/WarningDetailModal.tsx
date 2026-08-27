'use client';

import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useMounted } from './useMounted';
import type { Ariza } from './types';

type Props = {
  ariza: Ariza | null;
  onClose: () => void;
};

/** Full text of a single disciplinary write-up. */
export default function WarningDetailModal({ ariza, onClose }: Props) {
  const mounted = useMounted();
  if (!mounted || typeof document === 'undefined' || !ariza) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-lg p-4" onClick={onClose}>
      <div className="bg-[#0b0f19] border border-red-500/20 p-5 sm:p-8 rounded-2xl sm:rounded-[40px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center mb-4 sm:mb-5">
          <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500"><AlertTriangle size={28} /></div>
        </div>

        <h3 className="text-center text-xl font-black italic mb-2 uppercase tracking-tight text-white">Intizomiy Ogohlantirish</h3>

        <div className="space-y-4 my-6 text-center">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <p className="text-[9px] font-black text-gray-500 uppercase mb-0.5">Sana</p>
            <p className="text-xs font-bold text-white">{ariza.sana}</p>
          </div>
          <div className="bg-white/5 p-5 rounded-xl border border-white/5 italic text-xs sm:text-sm text-gray-300 leading-relaxed text-left">
            &quot;{ariza.matn}&quot;
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-500/30 transition-all cursor-pointer"
        >
          Yopish
        </button>
      </div>
    </div>,
    document.body,
  );
}
