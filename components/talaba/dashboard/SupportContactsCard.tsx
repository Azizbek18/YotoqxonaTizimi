'use client';

import { Phone } from 'lucide-react';
import { dashboardTheme } from './theme';
import type { SupportContacts } from './types';

type Props = {
  isLight: boolean;
  contacts: SupportContacts | null;
  settingsStatus: 'loading' | 'ready' | 'error';
  onRetry: () => void;
};

function ContactRow({
  isLight,
  title,
  name,
  phone,
  divider,
}: {
  isLight: boolean;
  title: string;
  name: string | null | undefined;
  phone: string | null | undefined;
  divider?: boolean;
}) {
  const t = dashboardTheme(isLight);
  return (
    <div className={`flex justify-between items-center gap-2 ${divider ? 'pt-2.5 border-t border-white/5' : ''}`}>
      <div className="min-w-0">
        <p className={`text-xs font-bold ${t.textStrong}`}>{title}</p>
        <p className={`text-[9px] ${t.textMuted}`}>{name}</p>
      </div>
      {phone ? (
        <a
          href={`tel:${phone}`}
          className={`shrink-0 flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[10px] font-black ${
            isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/5 text-gray-300 hover:bg-white/5'
          }`}
        >
          <Phone size={10} /> Call
        </a>
      ) : (
        <span className={`text-[10px] ${t.textMuted}`}>Raqam kiritilmagan</span>
      )}
    </div>
  );
}

/**
 * Quick-dial card for dorm support staff.
 */
export default function SupportContactsCard({ isLight, contacts, settingsStatus, onRetry }: Props) {
  const t = dashboardTheme(isLight);
  return (
    <div className={`backdrop-blur-xl border rounded-3xl sm:rounded-[32px] p-4 sm:p-6 ${t.surfaceBg}`}>
      <h3 className={`text-[10px] font-black tracking-[0.14em] sm:tracking-[0.2em] leading-relaxed mb-4 uppercase ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
        Yordam &amp; Aloqa (Qo&apos;llab-quvvatlash)
      </h3>

      {contacts ? (
        <div className="space-y-3">
          <ContactRow isLight={isLight} title="Tarbiyachi (Navbatchi)" name={contacts.tarbiyachiName} phone={contacts.tarbiyachiPhone} />
          <ContactRow isLight={isLight} title="Komedant" name={contacts.komendantName} phone={contacts.komendantPhone} divider />
          <ContactRow isLight={isLight} title="Tibbiy yordam xonasi" name={`${contacts.doctorName} (Shifokor)`} phone={contacts.doctorPhone} divider />
          {contacts.talabaKengashiRaisiOgilPhone && (
            <ContactRow isLight={isLight} title="Talaba kengashi raisi (o'g'il)" name={contacts.talabaKengashiRaisiOgilName} phone={contacts.talabaKengashiRaisiOgilPhone} divider />
          )}
          {contacts.talabaKengashiRaisiQizPhone && (
            <ContactRow isLight={isLight} title="Talaba kengashi raisi (qiz)" name={contacts.talabaKengashiRaisiQizName} phone={contacts.talabaKengashiRaisiQizPhone} divider />
          )}
        </div>
      ) : (
        <div className={`rounded-2xl border p-4 text-center text-xs ${
          isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'
        }`}>
          <p>{settingsStatus === 'loading' ? 'Aloqa ma’lumotlari yuklanmoqda...' : 'Aloqa ma’lumotlarini yuklab bo‘lmadi.'}</p>
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
  );
}
