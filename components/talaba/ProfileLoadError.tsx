'use client'

import { AlertTriangle } from 'lucide-react'

export default function ProfileLoadError({ isLight }: { isLight: boolean }) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#02040a]'}`}>
      <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isLight ? 'bg-rose-50 text-rose-500' : 'bg-rose-500/10 text-rose-400'}`}>
          <AlertTriangle size={26} />
        </div>
        <div>
          <p className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>Profil ma&apos;lumotlarini yuklab bo&apos;lmadi</p>
          <p className={`text-xs mt-1.5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Internet aloqasini tekshiring yoki sahifani qayta yuklang. Muammo davom etsa, ma&apos;muriyatga murojaat qiling.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition-colors"
        >
          Qayta yuklash
        </button>
      </div>
    </div>
  )
}
