import { describe, expect, it, vi } from 'vitest'

vi.mock('./repository', () => ({ createForeignDocsRepository: () => ({}) }))

const { createForeignDocsService } = await import('./service')

const DOC = { id: 'doc1', student_id: 'student1', file_path: 'foreign-docs/student1/doc1/x.jpg' }

function service(studentFaculty: string | null) {
  const repository = {
    getById: vi.fn().mockResolvedValue(DOC),
    findStudentContext: vi.fn().mockResolvedValue(studentFaculty === null ? null : { faculty: studentFaculty }),
  }
  return createForeignDocsService(repository as never)
}

describe('getForFileAccess', () => {
  it('lets the owner open their own file', async () => {
    await expect(service('amit').getForFileAccess('doc1', { userId: 'student1' }))
      .resolves.toEqual({ filePath: DOC.file_path, studentId: 'student1' })
  })

  it('refuses another student', async () => {
    await expect(service('amit').getForFileAccess('doc1', { userId: 'student2' }))
      .rejects.toMatchObject({ status: 403 })
  })

  it('lets a dekan of the same faculty open it', async () => {
    await expect(service('amit').getForFileAccess('doc1', { userId: 'dekan1', staffFaculty: 'amit' }))
      .resolves.toMatchObject({ filePath: DOC.file_path })
  })

  it('refuses a dekan of another faculty (passport/visa scans must not cross faculties)', async () => {
    await expect(service('iqtisodiyot').getForFileAccess('doc1', { userId: 'dekan1', staffFaculty: 'amit' }))
      .rejects.toMatchObject({ status: 403 })
  })

  it('refuses staff when the owning student no longer exists', async () => {
    await expect(service(null).getForFileAccess('doc1', { userId: 'dekan1', staffFaculty: 'amit' }))
      .rejects.toMatchObject({ status: 403 })
  })
})

describe('lease documents', () => {
  function leaseService(context: Record<string, unknown>) {
    const insert = vi.fn(async (_id: string, fields: Record<string, unknown>) => ({
      id: 'new', student_id: 'student1', created_by_role: 'talaba', file_path: null,
      verified_at: null, created_at: '', updated_at: '', ...fields,
    }))
    const repository = { findStudentContext: vi.fn().mockResolvedValue(context), insert }
    return { svc: createForeignDocsService(repository as never), insert }
  }
  const input = {
    docType: 'lease' as const, expiresOn: '2030-01-01', address: 'Chilonzor 7', landlordName: 'Karim aka', landlordPhone: '+998901234567',
  }

  it('lets an off-campus student save a lease with landlord details', async () => {
    const { svc, insert } = leaseService({ faculty: 'amit', is_off_campus: true })
    const doc = await svc.saveForStudent('student1', input)
    expect(insert).toHaveBeenCalledWith('student1', expect.objectContaining({
      doc_type: 'lease', landlord_name: 'Karim aka', landlord_phone: '+998901234567', registration_basis: null,
    }), 'talaba')
    expect(doc.landlordName).toBe('Karim aka')
  })

  it('refuses a lease for a dorm student', async () => {
    const { svc } = leaseService({ faculty: 'amit', is_off_campus: false })
    await expect(svc.saveForStudent('student1', input)).rejects.toMatchObject({ status: 403 })
  })
})

describe('listInternationalOverview (international office, read-only)', () => {
  const baseDoc = {
    created_by_role: 'talaba', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    issued_on: null, registration_basis: null, address: null, number: null, verified_at: null,
    verified_by: null, landlord_name: null, landlord_phone: null, note: null, file_path: null,
  }
  const student = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id, full_name: name, faculty: 'amit', country: 'Turkmaniston', course: 1, phone_number: '+99361000000', ...extra,
  })

  function build(students: unknown[], docs: unknown[]) {
    const repository = {
      listForeignStudents: vi.fn().mockResolvedValue(students),
      listVisaAndRegistrationDocs: vi.fn().mockResolvedValue(docs),
    }
    return createForeignDocsService(repository as never)
  }

  it('returns one row per foreign student with the current visa and propiska, null when absent', async () => {
    const svc = build(
      [student('s1', 'Bekov A'), student('s2', 'Alov B')],
      [
        { ...baseDoc, id: 'v-old', student_id: 's1', doc_type: 'visa', status: 'active', expires_on: '2026-01-01' },
        { ...baseDoc, id: 'v-new', student_id: 's1', doc_type: 'visa', status: 'active', expires_on: '2099-01-01' },
        { ...baseDoc, id: 'r1', student_id: 's1', doc_type: 'registration', status: 'active', expires_on: '2099-06-01', registration_basis: 'ttj' },
      ],
    )
    const rows = await svc.listInternationalOverview()
    expect(rows.map((r) => r.fullName)).toEqual(['Alov B', 'Bekov A']) // sorted by name
    const [alov, bekov] = rows
    expect(alov.visa).toBeNull()
    expect(alov.registration).toBeNull()
    expect(bekov.visa?.id).toBe('v-new')
    expect(bekov.registration?.registrationBasis).toBe('ttj')
  })

  it('never exposes the document scan, landlord details or staff notes', async () => {
    const svc = build(
      [student('s1', 'Bekov A')],
      [{
        ...baseDoc, id: 'r1', student_id: 's1', doc_type: 'registration', status: 'active', expires_on: '2099-06-01',
        file_path: 'foreign-docs/s1/r1/scan.jpg', landlord_name: 'Karim aka', landlord_phone: '+998901234567',
        note: 'internal staff note', created_by_role: 'dekan',
      }],
    )
    const [row] = await svc.listInternationalOverview()
    const serialized = JSON.stringify(row)
    for (const secret of ['scan.jpg', 'Karim aka', '+998901234567', 'internal staff note', 'landlord', 'file']) {
      expect(serialized).not.toContain(secret)
    }
    expect(Object.keys(row.registration ?? {}).sort()).toEqual([
      'address', 'bucket', 'daysLeft', 'expiresOn', 'hasFile', 'id', 'issuedOn', 'number', 'registrationBasis', 'status', 'verified',
    ])
  })

  it('ignores lease contracts and any other doc type', async () => {
    const svc = build(
      [student('s1', 'Bekov A')],
      [{ ...baseDoc, id: 'l1', student_id: 's1', doc_type: 'lease', status: 'active', expires_on: '2099-01-01' }],
    )
    const [row] = await svc.listInternationalOverview()
    expect(row.visa).toBeNull()
    expect(row.registration).toBeNull()
  })
})

describe('getForInternationalFileAccess (international office)', () => {
  function build(doc: Record<string, unknown> | null, context: Record<string, unknown> | null) {
    const repository = {
      getById: vi.fn().mockResolvedValue(doc),
      findStudentContext: vi.fn().mockResolvedValue(context),
    }
    return createForeignDocsService(repository as never)
  }
  const FILE = 'foreign-docs/s1/d1/scan.jpg'

  it('opens a foreign student’s visa or propiska scan from any faculty', async () => {
    for (const doc_type of ['visa', 'registration']) {
      const svc = build({ id: 'd1', student_id: 's1', doc_type, file_path: FILE }, { faculty: 'iqtisodiyot', country: 'Turkmaniston' })
      await expect(svc.getForInternationalFileAccess('d1')).resolves.toEqual({ filePath: FILE, studentId: 's1' })
    }
  })

  it('refuses a lease contract (it carries landlord details)', async () => {
    const svc = build({ id: 'd1', student_id: 's1', doc_type: 'lease', file_path: FILE }, { faculty: 'amit', country: 'Turkmaniston' })
    await expect(svc.getForInternationalFileAccess('d1')).rejects.toMatchObject({ status: 403 })
  })

  it('refuses a student who is not foreign (no country)', async () => {
    const svc = build({ id: 'd1', student_id: 's1', doc_type: 'registration', file_path: FILE }, { faculty: 'amit', country: null })
    await expect(svc.getForInternationalFileAccess('d1')).rejects.toMatchObject({ status: 403 })
  })

  it('404s a missing document or one with no file; refuses when the student is gone', async () => {
    await expect(build(null, null).getForInternationalFileAccess('d1')).rejects.toMatchObject({ status: 404 })
    await expect(build({ id: 'd1', student_id: 's1', doc_type: 'visa', file_path: null }, { country: 'X' }).getForInternationalFileAccess('d1'))
      .rejects.toMatchObject({ status: 404 })
    await expect(build({ id: 'd1', student_id: 's1', doc_type: 'visa', file_path: FILE }, null).getForInternationalFileAccess('d1'))
      .rejects.toMatchObject({ status: 403 })
  })
})
