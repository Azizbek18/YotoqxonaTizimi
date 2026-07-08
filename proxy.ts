import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { findRoleByUserId } from '@/lib/auth-tables'
import { createClient } from '@supabase/supabase-js'

// Resolving a role normally costs up to 3 sequential DB round trips
// (findRoleByUserId checks staff-by-id, staff-by-email, users-by-id, then
// users-by-email). That ran on EVERY protected navigation, adding real
// latency on mobile networks. We cache the resolved role for a short TTL in
// an httpOnly cookie; this is purely a redirect-gating convenience layer —
// actual data access is still enforced independently by RLS and by each API
// route's own server-side role check (see lib/server-admin.ts), so a
// briefly-stale cached role here cannot grant unauthorized access.
const ROLE_CACHE_COOKIE = 'app_role_cache'
const ROLE_CACHE_MAX_AGE_SECONDS = 120

function withRoleCache(res: NextResponse, userId: string | undefined, role: string | null): NextResponse {
  if (!userId) return res
  res.cookies.set(ROLE_CACHE_COOKIE, `${userId}:${role ?? 'none'}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ROLE_CACHE_MAX_AGE_SECONDS,
    path: '/',
  })
  return res
}

export async function proxy(request: NextRequest) {
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

  let session = null
  let userRole = null
  try {
    const { data } = await supabase.auth.getSession()
    session = data?.session || null

    // Agar sessiya bo'lsa, foydalanuvchi rolini olish (RLS infinite recursion oldini olish uchun service role orqali)
    if (session?.user?.id) {
      const cached = request.cookies.get(ROLE_CACHE_COOKIE)?.value
      const [cachedUserId, cachedRole] = cached ? cached.split(':') : []

      if (cachedUserId === session.user.id && cachedRole) {
        userRole = cachedRole === 'none' ? null : cachedRole
      } else {
        const serviceSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        userRole = await findRoleByUserId(serviceSupabase, session.user.id, session.user.email)
      }
    }
  } catch (err) {
    console.error('Proxy session/role error:', err)
    session = null
    userRole = null
  }

  const path = request.nextUrl.pathname
  const userId = session?.user?.id
  const redirect = (to: string) => withRoleCache(NextResponse.redirect(new URL(to, request.url)), userId, userRole)
  const allow = () => withRoleCache(response, userId, userRole)

  // ========================
  // ADMIN ROUTES HIMOYASI
  // ========================
  if (path.startsWith('/admin')) {
    // Admin loginiga va registerga kirish
    if (path === '/admin/login' || path === '/admin/register') {
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
  matcher: ['/talaba/:path*', '/tarbiyachi/:path*', '/admin/:path*', '/sardor/:path*', '/zamdekan/:path*', '/login', '/register', '/'],
}
