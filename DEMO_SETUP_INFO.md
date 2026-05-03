# Demo Login System - Toʻliq Qoʻllanma 🎬

## 📊 Qilgan Ishlarimiz

Sizning talab bo'yicha admin loginiga **demo account** imkonyati qo'shildi. Endi ro'yxatdan o'tmasdan to'g'ridan-to'g'ri kirishlash mumkin.

## 🎯 3 Tarzda Kirish Mumkin

### 1️⃣ Direct Demo Login (Admin Login Sahifasida)
**Eng Tez Usul ⚡**

- `/admin/login` sahifasiga kiring
- **🎬 Demo Rejimi** bo'limini ko'rasiz
- **Credentials**:
  - Email: `admin@demo.com`
  - Password: `demo123456`
- **"Demo" tugmasini** bosing
- Avtomatik to'ldiriladi va kiradi

### 2️⃣ Demo Setup Page Orqali
**Interaktiv Usul 🖱️**

- `/admin/setup-demo` sahifasiga o'ting
- **"Demo Account Yaratish"** tugmasini bosing
- Database-da account yaratiladi
- Credentials nusxalang va loginiga o'ting

### 3️⃣ Manual API Chaqiruv Orqali
**Developer Usul 💻**

Browser Console-da:
```javascript
fetch('/api/admin/setup-demo', { method: 'POST' })
  .then(res => res.json())
  .then(data => console.log(data))
```

## 📋 Yaratilgan Fayllar

### 1. Admin Login Page - Enhanced
**Fayl**: `app/admin/login/page.tsx`
- ✅ Demo Rejimi bo'limi qo'shildi
- ✅ Demo login tugmasi qo'shildi
- ✅ Demo Setup linkidan o'tish
- ✅ handleDemoLogin() funksiyasi

### 2. Demo Setup Page
**Fayl**: `app/admin/setup-demo/page.tsx`
- ✅ Professional UI
- ✅ Demo account yaratish
- ✅ Credentials nusxalash
- ✅ Status ko'rsatish

### 3. Demo Setup API Route
**Fayl**: `app/api/admin/setup-demo/route.ts`
- ✅ POST endpoint - account yaratish
- ✅ GET endpoint - ma'lumot olish
- ✅ Error handling
- ✅ Response formatting

### 4. Demo Account Logic
**Fayl**: `lib/demo-account.ts`
- ✅ Supabase integration
- ✅ Auth user creation
- ✅ Database user insertion
- ✅ Error handling

### 5. Qo'llanma va Setup Files
- ✅ `DEMO_LOGIN_GUIDE.md` - To'liq qo'llanma
- ✅ `DEMO_ACCOUNT_SETUP.sql` - SQL script
- ✅ `DEMO_SETUP_INFO.md` - Bu fayl

## 🔑 Demo Credentials

```
Email:    admin@demo.com
Password: demo123456
Role:     admin (full access)
```

⚠️ **Oʻxshashlikka e'tibor**: Har safar bir xil credentiallar

## 🚀 Ishlashni Tekshirish

### Step 1: Demo Account Yaratish
```bash
# Terminal-da
curl -X POST http://localhost:3000/api/admin/setup-demo

# Yoki admin login sahifasida
# "🎬 Demo Setup" linkni bosing
```

### Step 2: Login Qilish
```
URL: http://localhost:3000/admin/login
Email: admin@demo.com
Password: demo123456
Demo tugmasini bosing →
```

### Step 3: Dashboard Ko'rish
```
Admin panel yuklanishi kerak
Dashboard → Users → Reports, etc.
```

## ✨ Features

| Feature | Status | Notes |
|---------|--------|-------|
| Demo Login Button | ✅ | Auto-fill credentials |
| Demo Setup Page | ✅ | Interactive UI |
| API Endpoint | ✅ | POST /api/admin/setup-demo |
| Credentials Display | ✅ | Copy to clipboard |
| Error Handling | ✅ | User-friendly messages |
| Mobile Responsive | ✅ | Works on all devices |

## 🔒 Security Notes

- Demo account faqat **development/testing** uchun
- Production-da **ishlatmang**
- Real admin accounts o'rnatib, demoni o'chirib tashlang
- Credentials **secure** vosita orqali ulashing
- Regular backups oling

## 🆘 Muammolar

### "Demo account mavjud emas" xatosi
**Yechimi**:
1. `/admin/setup-demo` sahifasiga kiring
2. "Demo Account Yaratish" tugmasini bosing
3. Qayta login qiling

### Demo tugmasi ko'rinmadi
**Yechimi**:
1. Sayt refresh (F5)
2. Browser cache o'chiring
3. Dev console xatolarini tekshiring

### Password xato
**Yechimi**:
1. Password: `demo123456` (o'z harflari!)
2. Email: `admin@demo.com` (to'liq)
3. Copy-Paste dan foydalaning

## 📞 Support

Muammo bo'lsa:
1. DEMO_LOGIN_GUIDE.md o'qing
2. Console xatolarini tekshiring
3. Supabase Dashboard ko'ring
4. SQL errorlarni aniqlang

## 📝 Qo'shimcha Savollar

**Q: Demo account o'chirib tashlash mumkinmi?**
A: Ha, Supabase Dashboard → Authentication → admin@demo.com o'chiring

**Q: Password o'zgartirish mumkinmi?**
A: Ha, lekin /lib/demo-account.ts-da ham o'zgarting

**Q: Bir nechta demo account oʻrnatish?**
A: Ha, handleDemoLogin() funksiyasini copy qilib modified versiyani yarating

## 🎉 Tayyor!

Endi **ro'yxatsiz to'g'ridan-to'g'ri** admin panelga kirish mumkin!

```
🎬 Demo Rejimi
📧 admin@demo.com
🔐 demo123456
✅ Ready to Use
```

---

**Version**: 1.0.0
**Last Updated**: April 30, 2026
**Status**: Production Ready ✅
