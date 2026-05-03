# Demo Account Setup Guide 🎬

## Quick Start

Demo account login credentials **admin login sahifasida ko'rsatilgan**:

- **Email**: `admin@demo.com`
- **Password**: `demo123456`

## Demo Account Yaratish

### Method 1: API Endpoint orqali (RECOMMENDED)

1. Quyidagi URL-ga POST request yuboring:
```
POST /api/admin/setup-demo
```

2. Response:
```json
{
  "success": true,
  "message": "Demo account muvaffaqiyatli yaratildi!",
  "email": "admin@demo.com",
  "password": "demo123456"
}
```

3. Browser console-da yuboring:
```javascript
fetch('/api/admin/setup-demo', { method: 'POST' })
  .then(res => res.json())
  .then(data => console.log(data))
```

### Method 2: Supabase Dashboard orqali

1. Supabase Authentication → Users ga kiring
2. "Create new user" tugmasini bosing
3. Quyidagi ma'lumotlarni kiriting:
   - **Email**: `admin@demo.com`
   - **Password**: `demo123456`
   - Confirm email va other settings

4. Supabase Database → `users` jadvaliga yangi satr qo'shing:
   - `id`: Supabase Auth-dan olgan UUID
   - `email`: `admin@demo.com`
   - `role`: `admin`
   - `name`: `Demo Admin` (ixtiyoriy)

### Method 3: SQL Script orqali

1. `DEMO_ACCOUNT_SETUP.sql` faylini ochish
2. Supabase SQL Editor-ga nusxalang va yuboring
3. UUID-ni o'zingizning auth user ID-ingiz bilan almashtirib qo'ying

## Demo Login Ishlashi

1. `/admin/login` sahifasiga kiring
2. Admin Login sahifasida **"Demo" tugmasini** bosing
3. Credentials avtomatik to'ldiriladi
4. "Access Dashboard" tugmasini bosing
5. Admin panelga kiriladi!

## Demo Account Features

✅ Full admin access
✅ Dashboard ko'rish
✅ Users, Arizalar, Qoidalar boshqarish
✅ Reporting va analytics
✅ Xarakterli test uchun ideal

## Demo Account O'chirish

Agar demo accountni o'chirmoqchi bo'lsangiz:

1. Supabase Dashboard → Authentication
2. `admin@demo.com` userini toping va o'chiring
3. Database → `users` jadvalidan ham o'chiring

## Masala Hal Qilish

### Demo login tugmasi ko'rinmadi
- Sayta refresh qiling (F5)
- Browser cache o'chiring
- Console xatolarini tekshiring

### "Demo account mavjud emas" xatosi
- API endpoint-ni POST request bilan chaqiring: `/api/admin/setup-demo`
- Yoki Supabase Dashboard-dan qo'lda yarating

### Password xato deyapti
- Email: `admin@demo.com` to'g'riligini tekshiring  
- Password: `demo123456` (bosh harfga e'tibor!)
- Supabase-da auth user-ni tekshiring

## Setup Status Tekshirish

API endpoint statusini tekshirish:
```bash
curl -X GET http://localhost:3000/api/admin/setup-demo
```

Response:
```json
{
  "message": "Demo account setup endpoint. POST request yuboring.",
  "usage": "POST /api/admin/setup-demo",
  "credentials": {
    "email": "admin@demo.com",
    "password": "demo123456"
  }
}
```

## Xavfsizlik Eslatmasi ⚠️

- **Faqat development/testing uchun ishlatiladi**
- Demo credentials-ni production-da ishlatmang
- Demo accountni regular admin accounts bilan keysiz almashtiring
- Ma'lumotlarni secure vosita orqali ulashing

---

**Status**: ✅ Ready to Use  
**Last Updated**: April 30, 2026
