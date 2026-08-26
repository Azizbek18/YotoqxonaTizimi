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

  // Havola shu deploy'ning o'z origin'iga qaytadi, shuning uchun localda
  // localhost, productionda vercel domeni ishlaydi. Begona origin xavf
  // tug'dirmaydi: Supabase uni Redirect URLs ro'yxatiga solishtirib rad etadi.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${new URL(request.url).origin}/auth/confirm`,
  })

  // Hisob mavjudligini oshkor qilmaymiz — javob har doim bir xil.
  if (error) {
    console.error('Recovery mail request failed:', error.message)
  }
  return NextResponse.json({ ok: true })
}
