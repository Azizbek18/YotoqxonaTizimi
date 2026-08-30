import { describe, expect, it, vi } from 'vitest'
import { createAuditLogService, parseAuditLogQuery } from './service'
import type { AuditLogRepository } from './repository'

describe('parseAuditLogQuery', () => {
  it('clamps limit, floors offset, and whitelists status', () => {
    const q = parseAuditLogQuery(new URLSearchParams('limit=9999&offset=-5&status=bogus'))
    expect(q.limit).toBe(100)
    expect(q.offset).toBe(0)
    expect(q.status).toBeUndefined()
  })

  it('keeps a valid status and normalises since to an ISO instant', () => {
    const q = parseAuditLogQuery(new URLSearchParams('status=denied&since=2026-08-01'))
    expect(q.status).toBe('denied')
    expect(q.since).toBe(new Date('2026-08-01').toISOString())
  })

  it('defaults limit to 40 and drops an unparseable since', () => {
    const q = parseAuditLogQuery(new URLSearchParams('since=notadate'))
    expect(q.limit).toBe(40)
    expect(q.since).toBeUndefined()
  })
})

function fakeRepository(overrides: Partial<AuditLogRepository> = {}) {
  return {
    list: vi.fn(async () => ({
      rows: [
        {
          id: 'a1', event_type: 'permit.approve', status: 'success', ip_address: null,
          actor_user_id: 'staff-1', target_role: 'talaba', details: { permitId: 'p1', faculty: 'amit' },
          created_at: '2026-08-30T10:00:00Z',
        },
      ],
      total: 1,
    })),
    distinctEventTypes: vi.fn(async () => ['permit.approve', 'student.blacklist']),
    resolveActors: vi.fn(async () => new Map([['staff-1', { name: 'Dekan Aliyev', role: 'dekan' }]])),
    ...overrides,
  } as unknown as AuditLogRepository
}

describe('createAuditLogService', () => {
  it('joins the actor name/role and passes details through', async () => {
    const page = await createAuditLogService(fakeRepository()).getPage({ limit: 40, offset: 0 })
    expect(page.total).toBe(1)
    expect(page.eventTypes).toContain('student.blacklist')
    expect(page.entries[0]).toMatchObject({
      eventType: 'permit.approve',
      actorName: 'Dekan Aliyev',
      actorRole: 'dekan',
      details: { permitId: 'p1', faculty: 'amit' },
    })
  })

  it('only resolves the distinct non-null actor ids', async () => {
    const repo = fakeRepository({
      list: vi.fn(async () => ({
        rows: [
          { id: 'a1', event_type: 'x', status: 'success', ip_address: null, actor_user_id: 'u1', target_role: null, details: null, created_at: 'x' },
          { id: 'a2', event_type: 'x', status: 'success', ip_address: null, actor_user_id: 'u1', target_role: null, details: null, created_at: 'x' },
          { id: 'a3', event_type: 'x', status: 'success', ip_address: null, actor_user_id: null, target_role: null, details: null, created_at: 'x' },
        ],
        total: 3,
      })),
    })
    await createAuditLogService(repo).getPage({ limit: 40, offset: 0 })
    expect(repo.resolveActors).toHaveBeenCalledWith(['u1'])
  })
})
