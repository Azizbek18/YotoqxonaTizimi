import { describe, expect, it } from 'vitest'
import { publicEntryRedirectTarget, superadminDashboardRedirectTarget } from './proxy'

describe('public entry auth redirects', () => {
  it('keeps an unknown-role session on login instead of creating a redirect loop', () => {
    expect(publicEntryRedirectTarget(true, null, '/login')).toBeNull()
  })

  it('sends an unknown-role session away from registration and root', () => {
    expect(publicEntryRedirectTarget(true, null, '/register')).toBe('/login')
    expect(publicEntryRedirectTarget(true, null, '/')).toBe('/login')
  })

  it('redirects active roles to their own dashboard', () => {
    // `admin` is the global superadmin and must not land in AMIT scope.
    expect(publicEntryRedirectTarget(true, 'admin', '/login')).toBe('/dekan/dekanlar')
    expect(publicEntryRedirectTarget(true, 'dekan', '/login')).toBe('/dekan/dashboard')
    expect(publicEntryRedirectTarget(true, 'talaba', '/')).toBe('/talaba/dashboard')
  })

  it('does not redirect signed-out visitors', () => {
    expect(publicEntryRedirectTarget(false, null, '/login')).toBeNull()
  })
})

describe('superadmin dashboard redirects', () => {
  it('moves an old AMIT dashboard URL to global oversight', () => {
    expect(superadminDashboardRedirectTarget('admin', '/dekan/dashboard', null)).toBe('/dekan/dekanlar')
  })

  it('keeps the explicitly selected AMIT management URL available', () => {
    expect(superadminDashboardRedirectTarget('admin', '/dekan/dashboard', 'amit')).toBeNull()
  })

  it('never redirects a faculty dekan away from their dashboard', () => {
    expect(superadminDashboardRedirectTarget('dekan', '/dekan/dashboard', null)).toBeNull()
  })
})
