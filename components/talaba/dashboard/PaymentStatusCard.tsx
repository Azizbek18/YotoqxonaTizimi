'use client';

import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { getPaymentStats } from '@/features/app-settings/presentation';
import { dashboardTheme } from './theme';

type PaymentStats = NonNullable<ReturnType<typeof getPaymentStats>>;

type Props = {
  isLight: boolean;
  paidAmount: number;
  stats: PaymentStats | null;
  settingsStatus: 'loading' | 'ready' | 'error';
  onRetry: () => void;
};

/** Yearly-contract progress: a ring, amounts paid/remaining, and a link to receipts. */
export default function PaymentStatusCard({ isLight, paidAmount, stats, settingsStatus, onRetry }: Props) {
  const t = dashboardTheme(isLight);
  const strokeDashoffset = stats ? Math.max(0, 213 - (213 * stats.progressPercent) / 100) : 213;

  return (
    <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${t.surfaceBg} flex flex-col justify-between`}>
      <div>
        <h4 className={`text-sm font-black mb-6 italic flex items-center gap-2 ${t.textStrong}`}>
          <CreditCard className={isLight ? 'text-blue-600' : 'text-indigo-400'} /> To&apos;lov holati
        </h4>

        {stats ? (
          <>
            <div className="flex gap-4 items-center mb-6">
              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className={isLight ? 'text-slate-100' : 'text-white/5'} />
                  <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="213" strokeDashoffset={strokeDashoffset} className={isLight ? 'text-blue-600' : 'text-indigo-500'} style={{ transition: 'all 1000ms' }} />
                </svg>
                <div className={`absolute flex flex-col items-center ${t.textStrong}`}>
                  <span className="text-sm font-black italic">{stats.progressPercent}%</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className={`text-xs font-bold ${t.textStrong}`}>{paidAmount.toLocaleString('uz-UZ')} UZS to&apos;landi</p>
                <p className={`text-[10px] ${t.textMuted}`}>Shartnoma: {stats.totalContractFee.toLocaleString('uz-UZ')} UZS</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className={`flex justify-between items-center p-3 rounded-xl border ${t.cardBorder} ${t.cardInnerBg}`}>
                <span className={`text-[9px] font-black uppercase ${t.textMuted}`}>Qolgan to&apos;lov</span>
                <span className={`text-xs font-black ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>{stats.remainingAmount.toLocaleString('uz-UZ')} UZS</span>
              </div>
              {stats.remainingAmount > 0 ? (
                <div className={`flex justify-between items-center p-3 rounded-xl border animate-pulse ${
                  isLight ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/20'
                }`}>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-red-600' : 'text-red-400'}`}>Muddati</span>
                  <span className={`text-xs font-black ${isLight ? 'text-red-600' : 'text-red-400'}`}>Kutilmoqda</span>
                </div>
              ) : (
                <div className={`flex justify-between items-center p-3 rounded-xl border ${
                  isLight ? 'bg-green-50 border-green-200 text-green-700' : 'bg-green-500/10 border-green-500/20 text-green-400'
                }`}>
                  <span className="text-[9px] font-black uppercase tracking-wider">Holat</span>
                  <span className="text-xs font-black">To&apos;liq to&apos;langan ✅</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={`rounded-2xl border p-4 text-center text-xs ${
            isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'
          }`}>
            <p>{settingsStatus === 'loading' ? 'Shartnoma summasi yuklanmoqda...' : 'Shartnoma summasini yuklab bo‘lmadi.'}</p>
            {settingsStatus === 'error' && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 font-black uppercase tracking-wider hover:bg-rose-500/20"
              >
                Qayta urinish
              </button>
            )}
          </div>
        )}
      </div>

      <Link
        href="/talaba/tolova"
        className="w-full mt-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl border border-white/10 text-center text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 transition-all"
      >
        Kvitansiya Boshqaruvi
      </Link>
    </div>
  );
}
