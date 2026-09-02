import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export type DeviceSession = {
  id: string
  device: string
  browser: string
  os: string
  ip: string | null
  createdAt: string
  lastActiveAt: string
  current: boolean
}

// Tiny, dependency-free UA heuristic — good enough to tell devices apart in
// the list ("Chrome · Android", "Safari · iPhone"). Not fingerprinting.
export function parseUserAgent(ua: string | null | undefined): { device: string; browser: string; os: string } {
  const s = ua ?? ''
  if (!s) return { device: 'Noma‘lum qurilma', browser: '—', os: '—' }

  const os =
    /Windows NT 10/.test(s) ? 'Windows' :
    /Windows/.test(s) ? 'Windows' :
    /iPhone|iPad|iPod/.test(s) ? 'iOS' :
    /Android/.test(s) ? 'Android' :
    /Mac OS X/.test(s) ? 'macOS' :
    /Linux/.test(s) ? 'Linux' : 'Boshqa'

  const browser =
    /Edg\//.test(s) ? 'Edge' :
    /OPR\/|Opera/.test(s) ? 'Opera' :
    /SamsungBrowser/.test(s) ? 'Samsung Internet' :
    /YaBrowser/.test(s) ? 'Yandex' :
    /Firefox\//.test(s) ? 'Firefox' :
    /Chrome\//.test(s) ? 'Chrome' :
    /Safari\//.test(s) ? 'Safari' :
    /node/.test(s) ? 'Server' :
    'Brauzer'

  const device =
    /iPad/.test(s) ? 'iPad' :
    /iPhone/.test(s) ? 'iPhone' :
    /Android/.test(s) ? (/Mobile/.test(s) ? 'Android telefon' : 'Android planshet') :
    os === 'Windows' ? 'Windows kompyuter' :
    os === 'macOS' ? 'Mac' :
    os === 'Linux' ? 'Linux kompyuter' : 'Qurilma'

  return { device, browser, os }
}

type RawSession = {
  id: string
  created_at: string
  refreshed_at: string | null
  user_agent: string | null
  ip: string | null
  not_after: string | null
}

export async function listUserSessions(userId: string, currentSessionId: string | null): Promise<DeviceSession[]> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.rpc('list_user_sessions', { p_user_id: userId })
  if (error) throw error
  return ((data ?? []) as RawSession[]).map((s) => {
    const { device, browser, os } = parseUserAgent(s.user_agent)
    return {
      id: s.id,
      device,
      browser,
      os,
      ip: s.ip,
      createdAt: s.created_at,
      lastActiveAt: s.refreshed_at ?? s.created_at,
      current: currentSessionId != null && s.id === currentSessionId,
    }
  })
}

/** Delete one session (its refresh tokens cascade). Returns whether it existed. */
export async function revokeUserSession(userId: string, sessionId: string): Promise<boolean> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.rpc('revoke_user_session', {
    p_user_id: userId,
    p_session_id: sessionId,
  })
  if (error) throw error
  return Boolean(data)
}

/** Delete every session except the caller's current one. Returns the count. */
export async function revokeOtherUserSessions(userId: string, keepSessionId: string | null): Promise<number> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.rpc('revoke_other_user_sessions', {
    p_user_id: userId,
    p_keep_session_id: keepSessionId,
  })
  if (error) throw error
  return Number(data ?? 0)
}
