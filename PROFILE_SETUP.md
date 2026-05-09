# 👤 Talaba Profil - Yangi Funksiyalar

## 🎯 Qo'shilgan Funksiyalar

### 1. 📸 Avatar (Profil Rasmi) Yuklash
- Talaba o'zining profilga rasm yuklay oladi
- Supabase Storage-da saqlanadi
- Automatic resize va optimization
- JPEG, PNG, WebP formatida qabul qilinadi
- Max 5MB hajm cheklangani

### 2. ✏️ Profil Ma'lumotlarini Tahrirlash
- To'liq ismini o'zgartirish
- Telefon raqamini yangilash
- Fakultetni belgilash
- Guruhni o'zgartirish
- Xona raqamini update qilish

### 3. 🎨 Improved UI/UX
- Loading animatsiyalari
- Success/Error messages
- Modal edit form
- Real-time updates
- Responsive design

---

## ⚙️ Setup va Installation

### 1. **Supabase Database Migration**

Supabase-da `SQL Editor`ga kirip quyidagi SQL-ni chjaytiring:

```sql
-- Profiles table ni yangilash
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());
```

### 2. **Supabase Storage Setup**

Supabase-da `Storage`-ga kirip:

1. **Yangi Bucket Yaratish:**
   - Name: `avatars`
   - Public: `ON`

2. **RLS Policies Qo'shish:**
   ```sql
   -- Avatar images are publicly accessible
   CREATE POLICY "Avatar images are publicly accessible"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'avatars');

   -- Anyone can upload
   CREATE POLICY "Anyone can upload an avatar"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'avatars');

   -- Users can update their own
   CREATE POLICY "Users can update their own avatar"
   ON storage.objects FOR UPDATE
   USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
   WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

   -- Users can delete their own
   CREATE POLICY "Users can delete their own avatar"
   ON storage.objects FOR DELETE
   USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
   ```

### 3. **Environment Variables**

`.env.local` fayliga quyidagini qo'shing:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

⚠️ **Oqibati:** Service Role Key-ni Supabase Settings → API → Service role key-da topasiz.

### 4. **Profiles Table RLS Policies**

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

---

## 📁 API Routes

### 1. Avatar Upload
**POST** `/api/student/profile/upload-avatar`

```javascript
const formData = new FormData()
formData.append('file', file)
formData.append('userId', userId)

const response = await fetch('/api/student/profile/upload-avatar', {
  method: 'POST',
  body: formData,
})
```

**Response:**
```json
{
  "success": true,
  "url": "https://...",
  "message": "Rasm muvaffaqiyatli yuklanildi"
}
```

### 2. Profile Update
**PATCH** `/api/student/profile/update`

```javascript
const response = await fetch('/api/student/profile/update', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: '123',
    full_name: 'Azizbek Karimov',
    phone: '+998 90 123 45 67',
    faculty: 'Dasturiy Injiniring',
    group: '412',
    room_number: '204-xona'
  })
})
```

---

## 🎨 UI Kompponentlar

### Avatar Upload Button
```tsx
<button onClick={handleAvatarClick}>
  <Camera size={13} className="text-white" />
</button>
```

### Edit Modal
- Modal form bilan profil tahrir qilish
- Real-time validation
- Error/Success messages
- Loading states

---

## 🔒 Security

✅ **JWT Authentication** - Supabase auth bilan faqat o'z profileni ko'rish/tahrirish mumkin

✅ **File Validation** - File tipi va hajmi tekshiriladi

✅ **RLS Policies** - Database level security

✅ **Service Role Key** - Faqat server-side operatsiyalari uchun

---

## 📦 Dependencies

```
"next": "^15.x"
"supabase-js": "^2.x"
"framer-motion": "^10.x"
"lucide-react": "^latest"
```

---

## ❓ FAQ

**Q: Avatar rasm ko'rinmaydi?**
A: Supabase Storage bucket `public`-ma qilganini tekshiring.

**Q: Upload xato beradi?**
A: `.env.local`-da `SUPABASE_SERVICE_ROLE_KEY` borligini tekshiring.

**Q: Tahrirlash saqlalmaydi?**
A: Profiles table RLS policies tekshiring.

---

## 🚀 Ishga Tushirish

```bash
# Dev server ni restart qiling
npm run dev

# Profil sahifasiga kirip
# Camera buttoniga bosing
# Tahrirlash buttoniga bosing
```

---

**✨ Tayyorlik bajarildi! Yangi funksiyalarni enjoy qiling!**
