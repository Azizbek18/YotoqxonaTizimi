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
