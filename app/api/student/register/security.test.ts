import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')
const foreignRegistrationMigration = readFileSync(
  new URL('../../../../supabase/migrations/20260830173311_foreign_student_registration.sql', import.meta.url),
  'utf8',
)
const countryMigration = readFileSync(
  new URL('../../../../supabase/migrations/202609280000_users_country.sql', import.meta.url),
  'utf8',
)

describe('student registration security invariants', () => {
  it('uses the requester-supplied password and enforces the password policy', () => {
    // The wizard now collects a password directly (no email-link step) — the
    // approved-permit match is what authorizes the account.
    expect(source).toContain('body.password')
    expect(source).toContain('getPasswordPolicyError(password)')
    expect(source).toMatch(/createAuthUserSafely\(\s*email,\s*password,/)
    expect(source).not.toContain('randomBytes(48)')
    expect(source).not.toContain('inaccessiblePassword')
  })

  it('creates a pending profile and leaves permit consumption to activation', () => {
    expect(source).toContain("status: 'pending'")
    // The users INSERT must not flip the permit itself — activate_pending_student
    // does that on first login.
    expect(source).not.toContain(".update({ status: 'registered'")
    expect(source).not.toContain("status: 'active'")
  })

  it('carries permit origin into the users row for imtiyozli, skips UZ address', () => {
    expect(source).toContain('permit.origin_country')
    expect(source).toContain('permit.origin_region')
    expect(source).toContain('country: isForeign')
    expect(source).toContain('district: isForeign ? null')
    expect(countryMigration).toContain('ADD COLUMN IF NOT EXISTS country')
  })

  it('allows JSHSHIR-less registration only for imtiyozli permits', () => {
    expect(source).toContain("applicationType === 'imtiyozli'")
    expect(source).toContain("permitQuery.is('jshshir', null)")
    expect(source).toContain("jshshir: applicationType === 'imtiyozli' ? null : jshshir")
    expect(foreignRegistrationMigration).toContain("NEW.jshshir IS NULL AND jshshir IS NULL AND application_type = 'imtiyozli'")
    expect(foreignRegistrationMigration).toContain("NEW.jshshir IS NOT NULL AND jshshir = NEW.jshshir AND application_type = 'yollanma'")
  })

  it('persists and honors the foreign no-patronymic choice at final submit', () => {
    expect(source).toContain("body.noMiddleName === true")
    expect(source).toContain("const middleName = noMiddleName ? ''")
    expect(source).toContain("applicationType === 'imtiyozli' && (noMiddleName || !middleName)")
  })
})
