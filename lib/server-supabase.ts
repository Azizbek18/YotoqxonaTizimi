import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.generated'

export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL yoki SUPABASE_SERVICE_ROLE_KEY topilmadi')
  }
  return createClient<Database>(url, key)
}
