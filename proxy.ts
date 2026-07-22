import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { findRoleByUserId } from '@/lib/auth-tables'
import type { Database } from '@/types/database.generated'

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://upload.wikimedia.org https://nuu.uz https://img.icons8.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const rebuildResponse = () => {
    const existingCookies = response.cookies.getAll()
    response = NextResponse.next({ request: { headers: requestHeaders } })
    existingCookies.forEach((cookie) => response.cookies.set(cookie))
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          rebuildResponse()
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          rebuildResponse()
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  let session = null
  let userRole = null
  try {
    const { data, error } = await supabase.auth.getUser()
    session = !error && data.user ? { user: data.user } : null

    // Agar sessiya bo'lsa, foydalanuvchi rolini olish (RLS infinite recursion oldini olish uchun service role orqali)
    if (session?.user?.id) {
      // Resolve through the authenticated cookie client so RLS remains active;
      // never place the service-role key or an unsigned role cache in Proxy.
      userRole = await findRoleByUserId(supabase, session.user.id, session.user.email)
    }
  } catch (err) {
    console.error('Proxy session/role error:', err)
    session = null
    userRole = null
  }

  const path = request.nextUrl.pathname
  const finalize = (target: NextResponse) => {
    target.headers.set('Content-Security-Policy', contentSecurityPolicy)
    if (target !== response) {
      response.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
    }
    return target
  }
  const redirect = (to: string) => finalize(NextResponse.redirect(new URL(to, request.url)))
  const allow = () => finalize(response)

  // ========================
  // ADMIN ROUTES HIMOYASI
  // ========================
  if (path.startsWith('/admin')) {
    // Admin loginiga kirish
    if (path === '/admin/login') {
      // Agar admin ro'li bilan tizimga kirgan bo'lsa, dashboardga yo'naltirish
      if (session && userRole === 'admin') {
        return redirect('/admin/dashboard')
      }
      return allow()
    }

    // Boshqa admin routelari (dashboard, arizalar, foydalanuvchilar)
    if (!session) {
      return redirect('/admin/login')
    }

    if (userRole !== 'admin') {
      // Admin emas bo'lsa, o'ziga mos dashboardga yo'naltirish
      if (userRole === 'tarbiyachi') {
        return redirect('/tarbiyachi/dashboard')
      }
      if (userRole === 'zamdekan') {
        return redirect('/zamdekan/dashboard')
      }
      return redirect('/talaba/dashboard')
    }
  }

  // ========================
  // TALABA ROUTES HIMOYASI
  // ========================
  if (path.startsWith('/talaba')) {
    if (!session) {
      return redirect('/login')
    }

    if (userRole !== 'talaba') {
      if (userRole === 'admin') {
        return redirect('/admin/dashboard')
      }
      if (userRole === 'tarbiyachi') {
        return redirect('/tarbiyachi/dashboard')
      }
      if (userRole === 'zamdekan') {
        return redirect('/zamdekan/dashboard')
      }
      return redirect('/login')
    }
  }

  // ========================
  // TARBIYACHI ROUTES HIMOYASI
  // ========================
  if (path.startsWith('/tarbiyachi')) {
    if (!session) {
      return redirect('/login')
    }

    if (userRole !== 'tarbiyachi') {
      if (userRole === 'admin') {
        return redirect('/admin/dashboard')
      }
      if (userRole === 'zamdekan') {
        return redirect('/zamdekan/dashboard')
      }
      return redirect('/talaba/dashboard')
    }
  }

  // ========================
  // ZAMDEKAN ROUTES HIMOYASI
  // ========================
  if (path.startsWith('/zamdekan')) {
    if (!session) {
      return redirect('/login')
    }

    if (userRole !== 'zamdekan') {
      if (userRole === 'admin') {
        return redirect('/admin/dashboard')
      }
      if (userRole === 'tarbiyachi') {
        return redirect('/tarbiyachi/dashboard')
      }
      return redirect('/talaba/dashboard')
    }
  }

  // ========================
  // SARDOR ROUTES HIMOYASI
  // ========================
  if (path.startsWith('/sardor')) {
    if (!session) {
      return redirect('/login')
    }

    if (userRole !== 'talaba') {
      if (userRole === 'admin') {
        return redirect('/admin/dashboard')
      }
      if (userRole === 'tarbiyachi') {
        return redirect('/tarbiyachi/dashboard')
      }
      if (userRole === 'zamdekan') {
        return redirect('/zamdekan/dashboard')
      }
      return redirect('/login')
    }
  }

  // ========================
  // LOGIN VA REGISTER SAHIFALARI
  // ========================
  if (session && (path === '/login' || path === '/register' || path === '/')) {
    // Login qilgan bo'lsa, o'ziga mos dashboardga yo'naltirish
    if (userRole === 'admin') {
      return redirect('/admin/dashboard')
    }
    if (userRole === 'tarbiyachi') {
      return redirect('/tarbiyachi/dashboard')
    }
    if (userRole === 'zamdekan') {
      return redirect('/zamdekan/dashboard')
    }
    return redirect('/talaba/dashboard')
  }

  return allow()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|sw.js|icons/|logo.png|rasm.png).*)',
  ],
}
