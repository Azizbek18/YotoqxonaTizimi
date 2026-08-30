import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { findRoleByUserId, type AppRole } from '@/lib/auth-tables'
import type { Database } from '@/types/database.generated'

const ROLE_HOME: Record<Exclude<AppRole, null>, string> = {
  // The standalone /admin shell is retired, but the role is the active
  // superadmin identity. Its home is global oversight, never the legacy
  // AMIT-scoped faculty dashboard.
  admin: '/dekan/dekanlar',
  tarbiyachi: '/tarbiyachi/dashboard',
  dekan: '/dekan/dashboard',
  talaba: '/talaba/dashboard',
}

// Every retired /admin/* path -> its /dekan/* home. Anything not listed
// falls back to the dekan dashboard.
const ADMIN_ROUTE_REDIRECTS: Record<string, string> = {
  '/admin/login': '/login',
  '/admin/foydalanuvchilar': '/dekan/talabalar',
  '/admin/xodimlar': '/dekan/xodimlar',
  '/admin/arizalar': '/dekan/murojaatlar',
  '/admin/elonlar': '/dekan/elonlar',
  '/admin/reports': '/dekan/hisobotlar',
  '/admin/dekanlar': '/dekan/dekanlar',
}

// Where to send a signed-in user whose role doesn't match the route they're
// guarding. `fallback` covers both "no role record found" (null) and roles
// with no home of their own (e.g. sardor is a talaba, not a distinct role).
function homeFor(role: AppRole, fallback: string): string {
  return role ? ROLE_HOME[role] : fallback
}

export function publicEntryRedirectTarget(
  hasSession: boolean,
  role: AppRole,
  path: string,
): string | null {
  if (!hasSession) return null
  if (role && (path === '/login' || path === '/register' || path === '/')) {
    return homeFor(role, '/login')
  }
  if (!role && (path === '/register' || path === '/')) return '/login'
  return null
}

export function superadminDashboardRedirectTarget(
  role: AppRole,
  path: string,
  scope: string | null,
): string | null {
  return path === '/dekan/dashboard' && role === 'admin' && scope !== 'amit'
    ? '/dekan/dekanlar'
    : null
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
    requiredRole: Exclude<AppRole, null> | Exclude<AppRole, null>[],
    loginTarget: string,
    unknownRoleFallback = '/talaba/dashboard',
  ) => {
    if (!path.startsWith(prefix)) return null
    if (!session) return redirect(loginTarget)
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!userRole || !allowed.includes(userRole)) return redirect(homeFor(userRole, unknownRoleFallback))
    return null
  }

  // ========================
  // ADMIN ROUTES — retired
  // ========================
  // The standalone /admin/* panel has been folded into the dekan
  // (faculty-admin) panel. Every /admin/* path redirects to its /dekan/*
  // equivalent; the /dekan guard below then applies its own auth. The
  // `admin` role itself is untouched (DB/RLS, /api/admin/*, tarbiyachi
  // guards) — only the panel and its entry points are gone.
  if (path === '/admin' || path.startsWith('/admin/')) {
    return redirect(ADMIN_ROUTE_REDIRECTS[path] ?? '/dekan/dekanlar')
  }

  // Existing superadmin tabs and old bookmarks may still point at the
  // legacy AMIT dashboard. Move those to global oversight. AMIT remains
  // intentionally reachable only through its explicitly labelled menu URL.
  const globalDashboardRedirect = superadminDashboardRedirectTarget(
    userRole,
    path,
    request.nextUrl.searchParams.get('scope'),
  )
  if (globalDashboardRedirect) return redirect(globalDashboardRedirect)

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
  // DEKAN ROUTES HIMOYASI
  // ========================
  // Cross-faculty oversight pages are superadmin-only. Hiding their menu
  // entries is just presentation; this route guard prevents a dekan from
  // opening the page directly, while the APIs repeat the same role check.
  const superadminGuard = guardRole('/dekan/dekanlar', ['admin'], '/dekan/dashboard')
    ?? guardRole('/dekan/yotoqxonalar', ['admin'], '/dekan/dashboard')
    ?? guardRole('/dekan/fakultet-tolovlari', ['admin'], '/dekan/dashboard')
    ?? guardRole('/dekan/audit', ['admin'], '/dekan/dashboard')
    ?? guardRole('/dekan/tekshiruv', ['admin'], '/dekan/dashboard')
  if (superadminGuard) return superadminGuard

  // `admin` is accepted here too: the standalone /admin panel is retired,
  // so `ROLE_HOME.admin` points at /dekan/dashboard — the guard must let
  // that role in or an admin session loops forever. Faza 2 migrates the
  // row to `dekan` and this extra role can go.
  const dekanGuard = guardRole('/dekan', ['dekan', 'admin'], '/login')
  if (dekanGuard) return dekanGuard

  // ========================
  // SARDOR ROUTES HIMOYASI
  // ========================
  // Sardor alohida rol emas — talaba roli bilan boshqa UI ko'rsatiladi.
  const sardorGuard = guardRole('/sardor', 'talaba', '/login', '/login')
  if (sardorGuard) return sardorGuard

  // ========================
  // LOGIN VA REGISTER SAHIFALARI
  // ========================
  // Faqat faol rol topilgan sessiyani dashboardga yo'naltiramiz. Auth'da
  // mavjud, ammo pending/rejected/orphan profilga ega foydalanuvchini
  // /login -> /talaba/dashboard -> /login sikliga tushirmaymiz.
  const publicEntryRedirect = publicEntryRedirectTarget(Boolean(session), userRole, path)
  if (publicEntryRedirect) return redirect(publicEntryRedirect)

  return allow()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|sw.js|icons/|logo.png|apple-touch-icon.png|opengraph-image|twitter-image).*)',
  ],
}
