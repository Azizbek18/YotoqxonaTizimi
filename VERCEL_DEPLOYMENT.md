# Vercelga Yuklash Qo'llanmasi

## Tayyorlash Yakunlandi ✅

Loyihangiz Vercelga yuklashga to'liq tayyor. Quyidagi qadam-qadam ko'rsatmani bajaring:

## 1️⃣ GitHub Repositoryga Push Qiling

```bash
git add .
git commit -m "Vercel deployment preparation"
git push origin main
```

## 2️⃣ Vercelga O'tib Loyihani Ulang

1. [Vercel Dashboard](https://vercel.com/dashboard)ga o'tib login qiling
2. **"New Project"** tugmasini bosing
3. GitHub-dan loyihangizni tanlang
4. **"Import"** tugmasini bosing

## 3️⃣ Environment Variables Qo'shing

Vercel sozlamalarida quyidagi Environment Variables-larni qo'shing:

```
NEXT_PUBLIC_SUPABASE_URL=https://qgnjhkvmuywlfdnjfpqg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_pGbSRze0O9L-Oc6I9WZ6hA_j9kiIB3u
SUPABASE_SERVICE_ROLE_KEY=sb_secret_AGcl04pe2sEId2RzKP3Oig_i5BEw5S0
```

## 4️⃣ Deploy Qiling

1. **"Deploy"** tugmasini bosing
2. Deployment jarayonini kutib turing (odatda 3-5 daqiqa)
3. Tayyor! Your Site URL-ni nusxalang

## 📋 Tekshirilgan Moslamalar

✅ **Next.js Version**: 16.2.0 (Latest)  
✅ **Build Command**: `next build` (avtomatik sozlanadi)  
✅ **Start Command**: `next start` (avtomatik sozlanadi)  
✅ **Node Version**: LTS (avtomatik qidiriladi)  
✅ **TypeScript**: To'liq tekshirildi va compile-qilindi  
✅ **ESLint**: Barcha linting qoidalari bajarilib, hech error yo'q  

## 🗂️ Yaratilgan Fayllar

- **.vercelignore** - Vercelga yuborilmaydi degan fayllar ro'yxati
- **vercel.json** - Build va deployment sozlamalari
- **.env.example** - Environment variables shabloni (hol-hozir xavfsiz)

## ⚠️ Muhim Eslatmalar

- **.env.local** fayli repositoryga push qilinmaydi (.gitignore-da mavjud)
- Vercel dashboard-da Environment Variables qo'shing (hech biri .env.local-dan copy qilinmaydi)
- Production-dagi Supabase URL-i va keys-lar to'g'ri ekanligini tekshiring
- CORS masalolari bo'lsa, vercel.json-da headers sozlang

## 🔗 Foydali Havolalar

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Supabase + Next.js Integration](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

## ✨ Bonus: Autodeployment

GitHub-dagi har qanday push main branch-ga qilganda Vercel avtomatik deploy qiladi.

---

**Status**: ✅ Loyihangiz Vercelga yuklashga to'liq tayyor!
