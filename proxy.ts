import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { findRoleByUserId, type AppRole } from '@/lib/auth-tables'
import type { Database } from '@/types/database.generated'

const ROLE_HOME: Record<Exclude<AppRole, null>, string> = {
  admin: '/admin/dashboard',
  tarbiyachi: '/tarbiyachi/dashboard',
  zamdekan: '/zamdekan/dashboard',
  talaba: '/talaba/dashboard',
}

// Where to send a signed-in user whose role doesn't match the route they're
// guarding. `fallback` covers both "no role record found" (null) and roles
// with no home of their own (e.g. sardor is a talaba, not a distinct role).
function homeFor(role: AppRole, fallback: string): string {
  return role ? ROLE_HOME[role] : fallback
}

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

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Cookies must land on the *request* too so the values this
          // Supabase client (and anything reading `request.cookies` later
          // in this function) sees are already up to date, then the
          // response is rebuilt from that request so the Set-Cookie
          // headers actually reach the browser.
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
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

  // Guards a route prefix that requires `requiredRole`: redirects signed-out
  // visitors to `loginTarget`, and signed-in visitors with the wrong role to
  // their own home (or `unknownRoleFallback` when they have no role at all).
  // Returns null when the route isn't guarded here or access is allowed, so
  // the caller falls through to the next check.
  const guardRole = (
    prefix: string,
    requiredRole: Exclude<AppRole, null>,
    loginTarget: string,
    unknownRoleFallback = '/talaba/dashboard',
  ) => {
    if (!path.startsWith(prefix)) return null
    if (!session) return redirect(loginTarget)
    if (userRole !== requiredRole) return redirect(homeFor(userRole, unknownRoleFallback))
    return null
  }

  // ========================
  // ADMIN ROUTES HIMOYASI
  // ========================
  // Admin loginiga kirish alohida holat: faqat tizimga admin sifatida
  // kirgan foydalanuvchi undan uzoqlashtiriladi, boshqa hamma uni ko'ra oladi.
  if (path === '/admin/login') {
    if (session && userRole === 'admin') return redirect('/admin/dashboard')
    return allow()
  }
  const adminGuard = guardRole('/admin', 'admin', '/admin/login')
  if (adminGuard) return adminGuard

  // ========================
  // TALABA ROUTES HIMOYASI
  // ========================
  const talabaGuard = guardRole('/talaba', 'talaba', '/login', '/login')
  if (talabaGuard) return talabaGuard

  // ========================
  // TARBIYACHI ROUTES HIMOYASI
  // ========================
  const tarbiyachiGuard = guardRole('/tarbiyachi', 'tarbiyachi', '/login')
  if (tarbiyachiGuard) return tarbiyachiGuard

  // ========================
  // ZAMDEKAN ROUTES HIMOYASI
  // ========================
  const zamdekanGuard = guardRole('/zamdekan', 'zamdekan', '/login')
  if (zamdekanGuard) return zamdekanGuard

  // ========================
  // SARDOR ROUTES HIMOYASI
  // ========================
  // Sardor alohida rol emas — talaba roli bilan boshqa UI ko'rsatiladi.
  const sardorGuard = guardRole('/sardor', 'talaba', '/login', '/login')
  if (sardorGuard) return sardorGuard

  // ========================
  // LOGIN VA REGISTER SAHIFALARI
  // ========================
  // Login qilgan bo'lsa, o'ziga mos dashboardga yo'naltirish
  if (session && (path === '/login' || path === '/register' || path === '/')) {
    return redirect(homeFor(userRole, '/talaba/dashboard'))
  }

  return allow()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|sw.js|icons/|logo.png|apple-touch-icon.png|rasm.png).*)',
  ],
}
