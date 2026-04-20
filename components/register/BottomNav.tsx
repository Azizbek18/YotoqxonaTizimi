// components/BottomNav.tsx
import Link from 'next/link';

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/70 backdrop-blur-xl border border-white/10 px-8 py-3 rounded-full flex items-center space-x-10 shadow-2xl z-50">
      <Link href="/talaba" className="flex flex-col items-center group text-blue-500">
        <span className="text-2xl">🏠</span>
        <span className="text-[10px] font-medium">Asosiy</span>
      </Link>
      <Link href="/talaba/elonlar" className="flex flex-col items-center group text-gray-400 hover:text-white transition-colors">
        <span className="text-2xl">📢</span>
        <span className="text-[10px]">E'lonlar</span>
      </Link>
      <Link href="/talaba/navbat" className="flex flex-col items-center group text-gray-400 hover:text-white transition-colors">
        <span className="text-2xl">⏳</span>
        <span className="text-[10px]">Navbat</span>
      </Link>
      <Link href="/talaba/profil" className="flex flex-col items-center group text-gray-400 hover:text-white transition-colors">
        <span className="text-2xl">👤</span>
        <span className="text-[10px]">Profil</span>
      </Link>
    </nav>
  );
};