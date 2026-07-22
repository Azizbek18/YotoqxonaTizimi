import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mtalaba.app',
  appName: 'MTalaba',
  webDir: 'capacitor-dummy-web',
  server: {
    // Mobil ilova yuklaydigan jonli server manzili.
    // Next.js API maruzalari, Supabase Middleware va barcha server-side funksiyalarni
    // buzilmasdan ishlashini ta'minlash uchun ilovani jonli veb-saytga yo'naltiramiz.
    // Deploj qilganingizdan so'ng ushbu manzilni o'z veb-saytingiz URL manziliga o'zgartiring (masalan: https://yotoqxona.uz).
    url: process.env.CAPACITOR_SERVER_URL || 'https://yotoqxona.uz',
    cleartext: false
  }
};

export default config;
