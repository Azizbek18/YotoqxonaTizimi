import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-admin'
import { getServiceSupabase } from '@/lib/server-supabase'

export async function GET() {
  try {
    const authSupabase = await createServerSupabaseClient()
    const serviceSupabase = getServiceSupabase()
    const {
      data: { session },
    } = await authSupabase.auth.getSession()

    let currentFaculty: string | null = null

    if (session?.user?.id) {
      const { data: userData } = await serviceSupabase
        .from('users')
        .select('faculty')
        .eq('id', session.user.id)
        .maybeSingle()

      currentFaculty = typeof userData?.faculty === 'string' && userData.faculty.trim()
        ? userData.faculty.trim()
        : null
    }

    const { data, error } = await serviceSupabase
      .from('elonlar')
      .select('id, title, text, type, audience, faculty, is_published, created_at, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const elonlar = (data ?? []).filter((elon) => {
      if (elon.audience === 'all') return true
      return Boolean(currentFaculty && elon.audience === 'faculty' && elon.faculty === currentFaculty)
    })

    return NextResponse.json({ elonlar, currentFaculty })
  } catch (error) {
    console.error('Elonlar GET xato:', error)
    return NextResponse.json({ error: "E'lonlarni yuklashda xatolik" }, { status: 500 })
  }
}
