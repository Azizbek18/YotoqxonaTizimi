import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mtalaba.app',
  appName: 'MTalaba',
  webDir: 'capacitor-dummy-web',
  server: {
    // Mobil ilova yuklaydigan jonli server manzili.
    // Next.js API maruzalari, Supabase Middleware va barcha server-side funksiyalarni
    // buzilmasdan ishlashini ta'minlash uchun ilovani jonli veb-saytga yo'naltiramiz.
    // Haqiqiy domen (masalan yotoqxona.uz) sotib olinib Vercel'ga ulangach,
    // shu yerni o'sha manzilga o'zgartiring.
    url: process.env.CAPACITOR_SERVER_URL || 'https://yotoqxona-tizimi.vercel.app',
    cleartext: false
  }
};

export default config;
