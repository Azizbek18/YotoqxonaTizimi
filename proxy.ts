import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { findRoleByUserId } from '@/lib/auth-tables'
import { createClient } from '@supabase/supabase-js'

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
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      userRole = await findRoleByUserId(serviceSupabase, session.user.id, session.user.email)
    }
  } catch (err) {
    console.error('Proxy session/role error:', err)
    session = null
    userRole = null
  }

  const path = request.nextUrl.pathname

  // ========================
  // ADMIN ROUTES HIMOYASI
  // ========================
  if (path.startsWith('/admin')) {
    // Admin loginiga va registerga kirish
    if (path === '/admin/login' || path === '/admin/register') {
      // Agar admin ro'li bilan tizimga kirgan bo'lsa, dashboardga yo'naltirish
      if (session && userRole === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
      return response
    }

    // Boshqa admin routelari (dashboard, arizalar, foydalanuvchilar)
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    if (userRole !== 'admin') {
      // Admin emas bo'lsa, o'ziga mos dashboardga yo'naltirish
      if (userRole === 'tarbiyachi') {
        return NextResponse.redirect(new URL('/tarbiyachi/dashboard', request.url))
      }
      if (userRole === 'zamdekan') {
        return NextResponse.redirect(new URL('/zamdekan/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/talaba/dashboard', request.url))
    }
  }

  // ========================
  // TALABA ROUTES HIMOYASI
  // ========================
  if (path.startsWith('/talaba')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (userRole !== 'talaba') {
      if (userRole === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
      if (userRole === 'tarbiyachi') {
        return NextResponse.redirect(new URL('/tarbiyachi/dashboard', request.url))
      }
      if (userRole === 'zamdekan') {
        return NextResponse.redirect(new URL('/zamdekan/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // ========================
  // TARBIYACHI ROUTES HIMOYASI
  // ========================
  if (path.startsWith('/tarbiyachi')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (userRole !== 'tarbiyachi') {
      if (userRole === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
      if (userRole === 'zamdekan') {
        return NextResponse.redirect(new URL('/zamdekan/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/talaba/dashboard', request.url))
    }
  }

  // ========================
  // ZAMDEKAN ROUTES HIMOYASI
  // ========================
  if (path.startsWith('/zamdekan')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (userRole !== 'zamdekan') {
      if (userRole === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
      if (userRole === 'tarbiyachi') {
        return NextResponse.redirect(new URL('/tarbiyachi/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/talaba/dashboard', request.url))
    }
  }

  // ========================
  // SARDOR ROUTES HIMOYASI
  // ========================
  if (path.startsWith('/sardor')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (userRole !== 'talaba') {
      if (userRole === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
      if (userRole === 'tarbiyachi') {
        return NextResponse.redirect(new URL('/tarbiyachi/dashboard', request.url))
      }
      if (userRole === 'zamdekan') {
        return NextResponse.redirect(new URL('/zamdekan/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // ========================
  // LOGIN VA REGISTER SAHIFALARI
  // ========================
  if (session && (path === '/login' || path === '/register' || path === '/')) {
    // Login qilgan bo'lsa, o'ziga mos dashboardga yo'naltirish
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
    if (userRole === 'tarbiyachi') {
      return NextResponse.redirect(new URL('/tarbiyachi/dashboard', request.url))
    }
    if (userRole === 'zamdekan') {
      return NextResponse.redirect(new URL('/zamdekan/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/talaba/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/talaba/:path*', '/tarbiyachi/:path*', '/admin/:path*', '/sardor/:path*', '/zamdekan/:path*', '/login', '/register', '/'],
}
