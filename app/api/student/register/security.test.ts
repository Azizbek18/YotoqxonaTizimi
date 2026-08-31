import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')
const foreignRegistrationMigration = readFileSync(
  new URL('../../../../supabase/migrations/20260830173311_foreign_student_registration.sql', import.meta.url),
  'utf8',
)

describe('student registration security invariants', () => {
  it('never assigns a requester-supplied password before email proof', () => {
    expect(source).toContain('randomBytes(48)')
    expect(source).toContain('inaccessiblePassword')
    expect(source).not.toContain('body.password')
    expect(source).not.toContain('body.confirmPassword')
  })

  it('creates a pending profile and leaves permit consumption to activation', () => {
    expect(source).toContain("status: 'pending'")
    expect(source).not.toContain(".update({ status: 'registered'")
    expect(source).toContain('requiresEmailVerification: true')
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
