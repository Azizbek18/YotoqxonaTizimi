import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'

// Deliberately unauthenticated: the imtiyozli-ariza applicant fills out
// their Ariza/Tilxat preview before ever logging in, and needs to see the
// same "___-sonli talabalar turar joyi" value the dekan configured — not
// a blank that then gets silently replaced server-side. Nothing else from
// app_settings is exposed here (staff phone numbers etc. stay behind the
// authenticated /api/settings).
export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const { data, error } = await supabase.from('app_settings').select('ttj_name').eq('id', 1).maybeSingle()
    if (error) throw error
    return NextResponse.json({ ttjName: data?.ttj_name ?? '' })
  } catch (error) {
    console.error('Public TTJ name fetch failed:', error)
    return NextResponse.json({ ttjName: '' })
  }
}
