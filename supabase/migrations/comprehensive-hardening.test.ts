import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const activationSql = readFileSync(
  new URL('./202607290001_student_email_activation.sql', import.meta.url),
  'utf8',
)
const storageSql = readFileSync(
  new URL('./202607290002_storage_and_upload_hardening.sql', import.meta.url),
  'utf8',
)

describe('student email activation migration', () => {
  it('binds activation to user id, email, approved permit and pending profile', () => {
    expect(activationSql).toContain('id = p_user_id')
    expect(activationSql).toContain("status = 'pending'")
    expect(activationSql).toContain("status = 'approved'")
    expect(activationSql).toContain('lower(trim(email)) = lower(trim(p_email))')
  })

  it('allows only the service role to activate profiles', () => {
    expect(activationSql).toContain('FROM PUBLIC, anon, authenticated')
    expect(activationSql).toContain('TO service_role')
  })
})

describe('storage hardening migration', () => {
  it('keeps only the real avatar bucket public and caps uploads at 4 MiB', () => {
    expect(storageSql).toContain("WHERE id = 'avatar'")
    expect(storageSql).toContain("WHERE id = 'avatars'")
    expect(storageSql).toContain('file_size_limit = 4194304')
    expect(storageSql).toContain("USING (bucket_id = 'avatar')")
  })

  it('keeps permit and receipt documents private', () => {
    expect(storageSql).toContain("WHERE id IN ('permits', 'receipts', 'cheklar')")
    expect(storageSql).toContain('SET public = false')
  })
})
