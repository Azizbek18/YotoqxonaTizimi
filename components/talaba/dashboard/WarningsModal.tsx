'use client';

import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { FileText, X, CheckCircle2 } from 'lucide-react';
import { useMounted } from './useMounted';
import type { Ariza } from './types';

type Props = {
  open: boolean;
  onClose: () => void;
  items: Ariza[];
  onSelect: (ariza: Ariza) => void;
};

/** List of the student's disciplinary write-ups; row click opens the detail. */
export default function WarningsModal({ open, onClose, items, onSelect }: Props) {
  const mounted = useMounted();
  if (!mounted || typeof document === 'undefined' || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-[#0b0f19] border border-white/5 p-4 sm:p-7 rounded-2xl sm:rounded-[40px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h4 className="text-xl font-black italic flex items-center gap-2 uppercase tracking-tighter text-indigo-400">
            <FileText /> Arizalar &amp; Ogohlantirishlar
          </h4>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-all text-gray-400 cursor-pointer"><X /></button>
        </div>

        <div className="space-y-3 mb-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
          {items.map((ariza) => {
            const borderGlow = ariza.daraja === 'danger' ? 'border-red-500/30 hover:border-red-500' :
                               ariza.daraja === 'warning' ? 'border-amber-500/30 hover:border-amber-500' :
                               'border-blue-500/20 hover:border-blue-500';
            return (
              <div
                key={ariza.id}
                onClick={() => onSelect(ariza)}
                className={`p-4 rounded-2xl border bg-white/5 cursor-pointer transition-all duration-200 hover:translate-x-1 ${borderGlow}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{ariza.sana}</span>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${
                    ariza.daraja === 'danger' ? 'bg-red-500/10 text-red-400' :
                    ariza.daraja === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {ariza.daraja}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-white line-clamp-2">{ariza.matn}</p>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="text-center py-10 flex flex-col items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 mb-4"
              >
                <CheckCircle2 size={32} />
              </motion.div>
              <p className="text-sm font-black text-white uppercase tracking-wider mb-1">
                Ogohlantirishlar mavjud emas
              </p>
              <p className="text-xs text-gray-400 max-w-[280px] leading-relaxed">
                Siz intizom qoidalariga to&apos;liq rioya etyapsiz. Rahmat! 🌟
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
