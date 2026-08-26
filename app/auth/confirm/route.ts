import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Xatdagi havola shu yerga tushadi. Brauzerdagi PKCE oqimi o'rniga
// token_hash tekshiriladi: PKCE code verifier havolani so'ragan brauzerda
// saqlanadi, shuning uchun noutbukda ro'yxatdan o'tib xatni telefonda ochgan
// talaba uni hech qachon tugata olmasdi. token_hash esa hech qanday mahalliy
// sirga tayanmaydi — istalgan qurilmada ishlaydi.
//
// Sessiya cookie'lari to'g'ridan-to'g'ri redirect javobiga yoziladi, chunki
// route handler'da cookies() orqali yozilgan qiymatlar NextResponse.redirect
// bilan birga ketishiga kafolat yo'q.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (!tokenHash || type !== 'recovery') {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    console.error('Recovery confirm is missing Supabase environment variables')
    return NextResponse.redirect(`${origin}/login?error=server`)
  }

  const response = NextResponse.redirect(`${origin}/update-password`)
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
  if (error) {
    console.error('Recovery link verification failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=link_expired`)
  }

  return response
}
