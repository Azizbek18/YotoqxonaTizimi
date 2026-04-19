// 1. Ma'lumot turlarini (Types) e'lon qilamiz
export type NavbatTuri = 'kunlik' | 'haftalik' | 'oylik';

export interface NavbatEntry {
  id: string;
  user_id: string;
  sana: string;
  tur: NavbatTuri;
  etaj: number;
  holat: 'kutilmoqda' | 'bajarildi' | 'bajarilmadi';
  gender: string;
  users?: {
    first_name: string;
    last_name: string;
    room_number: string;
    gender: string;
  };
}

// 2. Bugungi sanani olish (YYYY-MM-DD formatida)
export const bugunSana = () => {
  const date = new Date();
  const yil = date.getFullYear();
  const oy = String(date.getMonth() + 1).padStart(2, '0');
  const kun = String(date.getDate()).padStart(2, '0');
  return `${yil}-${oy}-${kun}`;
};

// 3. Navbat holatiga qarab Tailwind ranglarini qaytarish
export const holatRangi = (holat: string) => {
  switch (holat) {
    case 'bajarildi':
      return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    case 'bajarilmadi':
      return 'text-rose-400 border-rose-500/20 bg-rose-500/10';
    default: // kutilmoqda
      return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
  }
};

// 4. Tab nomlarini o'zbekchada chiroyli ko'rsatish
export const turLabel = (tur: NavbatTuri) => {
  const labels = {
    kunlik: 'Kunlik',
    haftalik: 'Haftalik',
    oylik: 'Oylik'
  };
  return labels[tur] || tur;
};