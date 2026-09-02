import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/security'

// Parol o'rnatish/tiklash xati serverdan yuboriladi va `flowType: 'implicit'`
// bilan ishlaydi — ya'ni GoTrue hech qanday code challenge saqlamaydi.
// Brauzerdagi createBrowserClient PKCE ishlatadi va verifier'ni o'sha
// brauzerda qoldiradi; xat boshqa qurilmada ochilsa havola kuyib qoladi.
// Challenge bo'lmagani uchun xatdagi token_hash /auth/confirm da istalgan
// qurilmada tekshiriladi.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const throttle = await checkRateLimit(`auth-recovery:${ip}`, 5, 15 * 60_000)
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: 'Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.' },
      { status: 429 },
    )
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 254)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email formati noto‘g‘ri.' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    console.error('Recovery mail is missing Supabase environment variables')
    return NextResponse.json({ error: 'Server sozlanmagan.' }, { status: 500 })
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' },
  })

  // Productiondagi reset havolasi preview/alias domeniga emas, Supabase'dagi
  // tasdiqlangan canonical domenimizga qaytishi kerak. Local developmentda esa
  // so'rov origin'i saqlanadi, shunda localhost oqimi buzilmaydi.
  const requestOrigin = new URL(request.url).origin
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  const redirectOrigin = configuredSiteUrl || (
    process.env.NODE_ENV === 'production'
      ? 'https://www.meningyotoqxonam.uz'
      : requestOrigin
  )

  // Begona origin xavf tug'dirmaydi: Supabase uni Redirect URLs ro'yxatiga
  // solishtirib rad etadi. `NEXT_PUBLIC_SITE_URL` esa deploy sozlamasida
  // boshqa tasdiqlangan muhit (masalan staging) uchun almashtirilishi mumkin.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${redirectOrigin}/auth/confirm`,
  })

  // Hisob mavjud-mavjudmasligini oshkor qilmaymiz: GoTrue `/recover` noma'lum
  // email uchun ham 200 qaytaradi, shuning uchun `error` faqat infratuzilma
  // nosozligida (SMTP yoki email bo'yicha cooldown) keladi — bu holatda
  // foydalanuvchiga qayta urinishni aytamiz, hisob borligini bildirmaymiz.
  if (error) {
    console.error('Recovery mail request failed:', error.message)
    return NextResponse.json(
      { error: 'Xatni yuborib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.' },
      { status: 502 },
    )
  }
  return NextResponse.json({ ok: true })
}
