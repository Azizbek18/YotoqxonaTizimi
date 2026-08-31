# 🏢 Talabalar Yotoqxonasi Tizimi (YotoqxonaTizimi)

Ushbu loyiha O'zbekiston Milliy Universiteti talabalari yotoqxonasi faoliyatini raqamlashtirish, xonalar bandligini 3D formatda vizuallashtirish, to'lovlar monitoringini amalga oshirish, arizalar qabul qilish hamda admin va talabalar o'rtasida shaxsiy chat almashinuvini ta'minlash uchun mo'ljallangan zamonaviy boshqaruv tizimidir.

---

## 🛠 Texnologik Stak (Tech Stack)

Loyihaning asosi quyidagi zamonaviy texnologiyalar ustiga qurilgan:
- **Karkas**: [Next.js 16 (App Router)](https://nextjs.org/) (Turbopack bilan)
- **Frontend / UI**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/) (Dinamik Light/Dark mode va premium animatsiyalar bilan)
- **Ma'lumotlar bazasi va Auth**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security xavfsizlik qoidalari bilan)
- **3D Render**: [Three.js](https://threejs.org/) (Xonalarni interaktiv 3D formatda ko'rish uchun)
- **Tahlil va Grafika**: [Recharts](https://recharts.org/) (Hisobotlar sahifasidagi oylik dinamika, qabul va rad etishlar, rollar taqsimotini vizuallashtirish uchun)
- **Hisobotlarni Yuklash**: [XLSX (xlsx-js-style)](https://sheetjs.com/) (Excel formatiga moslashtirilgan chiroyli dizayndagi eksportlar)

---

## 🚀 Loyihaning Asosiy Imkoniyatlari (Key Features)

### 1. 🎯 Interaktiv 3D Xonalar Vizuallashuvi
- Yotoqxonaning barcha qavatlari va xonalari sxemasini interaktiv 3D makonda ko'rish.
- Har bir xonaning to'liqlik darajasi (bo'sh, qisman band, to'la band) ranglar orqali ko'rsatiladi.
- Xona ustiga bosilganda o'sha xonada yashovchi talabalar ro'yxati va ma'lumotlari ochiladi.

### 2. 👤 Talaba Profili va Avatar Yuklash
- Talabalar o'z profillarini to'ldirishlari, shaxsiy ma'lumotlari, oilasi va hujjatlarini ko'rishlari mumkin.
- Profil rasmini (avatar) serverga (Supabase Storage) yuklash va real vaqtda yangilash imkoniyati.

### 3. 💳 To'lovlar Tahlili va Monitoring
- Talabalar to'lov kvitansiyasi (cheklar) rasmini yuklaydilar.
- Gemini AI orqali to'lov cheklari avtomatik tahlil qilinadi (summa mosligi, takroriylik, soxtalik tekshiruvi).
- Admin panelda talabaning to'lov tarixi, umumiy to'langan summa va qolgan qarzdorlik dynamic progress-bar ko'rinishida ko'rsatiladi.

### 4. 💬 Shaxsiy Chat Tizimi
- Admin har bir talaba bilan o'zaro Telegram uslubidagi split-screen chat orqali yozisha oladi.
- Xabarlar faqat yuborilgan talaba va adminga ko'rinadi (RLS qoidalari orqali himoyalangan).
- Talaba o'z profilidan tezkor chat modalini ochib adminga murojaat yo'llashi va javob olishi mumkin.

### 5. 📊 Hisobotlar va Analitika
- Tizim statistikasi (jami foydalanuvchilar, arizalar soni, tasdiqlash foizi) real ma'lumotlarda ishlaydi.
- Oylar bo'yicha dinamik grafiklar (LineChart, BarChart) va rollar taqsimoti (Donut Chart) mavjud.
- Barcha talabalar ma'lumotlarini xona raqamlari bo'yicha tabiiy saralab, dizaynlangan chiroyli Excel (.xlsx) va CSV formatlarida yuklab olish.

---

## ⚙️ Mahalliy Ishga Tushirish (Local Setup)

### 1. Loyihani yuklab olish va o'rnatish
```bash
# Loyihaga kiring
cd yotoqxonatizimi

# Kutubxonalarni o'rnating
npm ci
```

### 2. Environment o'zgaruvchilarini sozlash
Loyihaning ildiz papkasida `.env.local` faylini yarating va quyidagi ma'lumotlarni kiriting:
```env
NEXT_PUBLIC_SUPABASE_URL=Sizning_Supabase_URLingiz
NEXT_PUBLIC_SUPABASE_ANON_KEY=Sizning_Supabase_Anon_Kalitingiz
SUPABASE_SERVICE_ROLE_KEY=Sizning_Supabase_Service_Role_Kalitingiz
GEMINI_API_KEY=Sizning_Gemini_AI_API_Kalitingiz
```

### 3. Tizimni ishga tushirish
```bash
npm run dev
```
Tizim avtomatik ravishda [http://localhost:3000](http://localhost:3000) manzilida ishga tushadi.

---

## 🗄 Ma'lumotlar Bazasini Sozlash (Database Setup)

Canonical migratsiyalar `supabase/migrations/` ichida versiyalangan. Supabase CLI orqali loyihani bog‘lab, migratsiyalarni ketma-ket qo‘llang:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`supabase/migrations/` — sxemaning yagona manbai. Oxirgi migratsiyani o‘tkazmasdan production deploy qilmang.

Migratsiyalar quyidagi jarayonlarni amalga oshiradi:
1. `users`, `staff`, `arizalar`, `elonlar`, `tolovlar`, `permit_requests`, `cleaning_schedule`, `floor_room_layout`, `app_settings` jadvallarini yaratadi/yangilaydi.
2. Jadvallar xavfsizligini ta'minlash uchun Row Level Security (RLS) qoidalarini o'rnatadi.
3. Rolga asoslangan middleware uchun foydalanuvchi rollarini avtomatik hal qiluvchi funksiyalarni yaratadi.

---

## 🔑 Administrator va xodimlarni yaratish

`admin` — barcha fakultetlarni kuzatadigan global superadmin roli. Dekanlar superadmin yaratgan, emailga bog‘langan taklif orqali `/register/dekan` sahifasida ro‘yxatdan o‘tadi va faqat o‘z fakultetini boshqaradi. Tarbiyachi va boshqa xodimlar `/dekan/xodimlar` bo‘limidagi takliflar orqali yaratiladi. Repository, hujjatlar yoki mijoz kodiga haqiqiy login/parol yozmang.

## ✅ Tekshiruvlar

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:e2e
```

CI Node.js 22 da unit/integration testlar, coverage chegaralari, production build, Chromium desktop/mobile E2E va production dependency auditini bajaradi.

### AI providerlar va arzon fallback

Talabalar savol-javobi avval Groq’dan, keyin Vercel AI Gateway’dagi arzon
modellardan foydalanadi. Rasm tahlili avval Groq Qwen vision orqali ishlaydi;
PDF esa Gateway’dagi multimodal modeldan boshlanadi. Provider limiti yoki
uzilishi bo‘lsa keyingi model avtomatik sinab ko‘riladi, eski Gemini oxirgi
fallback bo‘lib qoladi.

- Matn: Groq `openai/gpt-oss-20b` → `openai/gpt-oss-120b` →
  `alibaba/qwen3.7-flash` → `amazon/nova-micro` → Gemini.
- Rasm: Groq `qwen/qwen3.6-27b` → `qwen/qwen3.8-27b` → Gateway zanjiri.
- PDF/Gateway zanjiri: `alibaba/qwen3.7-flash` → `amazon/nova-lite` →
  `openai/gpt-5-nano` → `google/gemini-2.5-flash-lite` → to‘g‘ridan-to‘g‘ri Gemini.

Vercel deployda AI Gateway OIDC orqali autentifikatsiya qilinadi. Mahalliy
muhit yoki statik kalit kerak bo‘lgan joyda `AI_GATEWAY_API_KEY` qo‘ying.
Model va fallbacklar `.env.example` dagi o‘zgaruvchilar bilan kodni qayta
yozmasdan almashtiriladi.

---

## ☁️ Vercel-ga Yuklash (Deployment Guide)

Loyiha Vercel platformasida ishlashga 100% tayyorlangan. Yuklash uchun quyidagi ketma-ketlikni bajaring:

1. GitHub-da yangi repository ochib, loyihani yuklang.
2. Vercel dashboardiga kiring, loyihani bog'lang.
3. **Environment Variables** bo'limida `.env.local` ichidagi barcha o'zgaruvchilarni Vercelga kiriting. Dekanlar superadmin yaratgan taklif kodi orqali ro'yxatdan o'tsa, `DEKAN_ALLOWED_IDS=disabled` qo'ying — bu eski doimiy-ID yo'lini yopadi, takliflar esa ishlashda davom etadi.
4. **Deploy** tugmasini bosing. Vercel loyihani avtomatik tarzda build qilib ishga tushiradi.

### Telegram orqali yo‘llanma javobi

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` va kamida 32 belgili tasodifiy
`TELEGRAM_WEBHOOK_SECRET` ni Production muhitiga kiriting. Yangi versiya
deploy bo‘lgach webhookni bir marta sozlang:

```bash
npm run telegram:webhook
```

Talaba ariza yuborganda yoki ariza holatini tekshirganda berilgan Telegram
tugmasini ochib bir marta `START` bosadi. Bog‘lanishdan keyin dekan tasdiqlash,
rad etish yoki tasdiqni bekor qilish holatini o‘zgartirsa, bot talabaning
shaxsiy chatiga avtomatik xabar yuboradi. Deep linkda pasport va JShSHIR emas,
faqat 30 kunlik bir martalik tasodifiy token ishlatiladi.

Ichki AI nosozligi va talabalar taklifi kabi administrator xabarlari kerak
bo‘lsa, faqat administratorga tegishli alohida `TELEGRAM_ADMIN_CHAT_ID` ni
kiriting. Talabaning `/start` orqali olingan chat ID sini bu maydonga kiritmang.
Eski `TELEGRAM_CHAT_ID` xavfsizlik sababli ishlatilmaydi.
