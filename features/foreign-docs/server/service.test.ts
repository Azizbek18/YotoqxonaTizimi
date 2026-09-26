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
