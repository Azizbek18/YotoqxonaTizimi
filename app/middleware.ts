import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const path = request.nextUrl.pathname

  // 1. Himoya: Login qilmagan bo'lsa
  if (!session && path.startsWith('/talaba')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Login qilgan bo'lsa va login/registerga kirmoqchi bo'lsa
  if (session && (path === '/login' || path === '/register' || path === '/')) {
    return NextResponse.redirect(new URL('/talaba/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/talaba/:path*', '/login', '/register'],
}