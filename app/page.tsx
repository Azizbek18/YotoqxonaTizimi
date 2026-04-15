import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  const cookieStore = await cookies() // Next.js 15 uchun await qo'shildi
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Agar login qilmagan bo'lsa -> login sahifasiga
  if (!session) {
    redirect('/login')
  }

  // Agar login qilgan bo'lsa -> talaba dashboardiga
  redirect('/talaba/dashboard')
}