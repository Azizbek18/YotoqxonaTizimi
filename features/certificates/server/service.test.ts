import { describe, expect, it, vi } from 'vitest'

vi.mock('./repository', () => ({ createCertificatesRepository: () => ({}) }))

const { createCertificatesService, certificateNumber } = await import('./service')

const ROW = {
  id: '1a2b3c4d-0000-4000-8000-000000000000',
  student_id: 's1',
  purpose: 'ijara',
  purpose_note: null,
  status: 'pending',
  number: null,
  decided_by: null,
  decided_by_name: null,
  decided_at: null,
  decision_note: null,
  created_at: '2026-10-13T00:00:00Z',
}

function build(overrides: Record<string, unknown> = {}) {
  const repository = {
    findStudent: vi.fn().mockResolvedValue({ id: 's1', faculty: 'amit', is_off_campus: true }),
    countPending: vi.fn().mockResolvedValue(0),
    insert: vi.fn().mockImplementation(async (_id: string, f: Record<string, unknown>) => ({ ...ROW, ...f })),
    getById: vi.fn().mockResolvedValue({ ...ROW, users: { faculty: 'amit', full_name: 'Ali', is_off_campus: true } }),
    decide: vi.fn().mockImplementation(async (_id: string, f: Record<string, unknown>) => ({ ...ROW, ...f })),
    ...overrides,
  }
  return { repository, service: createCertificatesService(repository as never) }
}

describe('certificate requests', () => {
  it('lets a KV student request a certificate', async () => {
    const { service, repository } = build()
    const created = await service.request('s1', { purpose: 'ijara' })
    expect(repository.insert).toHaveBeenCalledWith('s1', { purpose: 'ijara', purpose_note: null })
    expect(created.status).toBe('pending')
  })

  it('refuses a dorm student, a bad purpose, "boshqa" without a note, and too many pending', async () => {
    await expect(build({ findStudent: vi.fn().mockResolvedValue({ id: 's1', faculty: 'amit', is_off_campus: false }) })
      .service.request('s1', { purpose: 'ijara' })).rejects.toMatchObject({ status: 403 })
    await expect(build().service.request('s1', { purpose: 'xyz' })).rejects.toMatchObject({ status: 400 })
    await expect(build().service.request('s1', { purpose: 'boshqa' })).rejects.toMatchObject({ status: 400 })
    await expect(build({ countPending: vi.fn().mockResolvedValue(3) }).service.request('s1', { purpose: 'bank' }))
      .rejects.toMatchObject({ status: 429 })
  })
})

describe('certificate decisions', () => {
  const staff = { id: 'd1', full_name: 'Dekan Aliyev' }

  it('approves with a certificate number derived from the request id', async () => {
    const { service, repository } = build()
    const { request } = await service.decide(ROW.id, 'amit', staff, { action: 'approve' })
    expect(repository.decide).toHaveBeenCalledWith(ROW.id, expect.objectContaining({
      status: 'approved', number: certificateNumber(ROW.id, new Date().getFullYear()), decided_by: 'd1',
    }))
    expect(request.status).toBe('approved')
  })

  it('requires a reason to reject', async () => {
    await expect(build().service.decide(ROW.id, 'amit', staff, { action: 'reject' })).rejects.toMatchObject({ status: 400 })
  })

  it("refuses another faculty's student and an already-decided request", async () => {
    await expect(build().service.decide(ROW.id, 'iqtisodiyot', staff, { action: 'approve' })).rejects.toMatchObject({ status: 403 })
    const decided = build({ getById: vi.fn().mockResolvedValue({ ...ROW, status: 'approved', users: { faculty: 'amit' } }) })
    await expect(decided.service.decide(ROW.id, 'amit', staff, { action: 'approve' })).rejects.toMatchObject({ status: 409 })
  })

  it('only hands out the document to its owner once approved', async () => {
    const pending = build()
    await expect(pending.service.documentForStudent('s1', ROW.id)).rejects.toMatchObject({ status: 409 })
    const approved = build({ getById: vi.fn().mockResolvedValue({ ...ROW, status: 'approved', number: 'MA-1', users: { faculty: 'amit', full_name: 'Ali' } }) })
    await expect(approved.service.documentForStudent('someone-else', ROW.id)).rejects.toMatchObject({ status: 404 })
    await expect(approved.service.documentForStudent('s1', ROW.id)).resolves.toMatchObject({ number: 'MA-1', studentName: 'Ali' })
  })
})
