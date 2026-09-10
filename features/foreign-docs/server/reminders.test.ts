import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runForeignDocReminders } from './reminders'
import type { ForeignDocsRepository, ReminderDocRow } from './repository'

const TODAY = '2026-05-01'

function doc(overrides: Partial<ReminderDocRow> = {}): ReminderDocRow {
  return {
    id: overrides.id ?? 'd1',
    student_id: overrides.student_id ?? 's1',
    doc_type: overrides.doc_type ?? 'visa',
    number: overrides.number ?? 'E1',
    expires_on: overrides.expires_on ?? '2026-05-04', // 3 kun qoldi
    users: overrides.users ?? { full_name: 'Aálem Qadyr', faculty: 'amit' },
  }
}

function makeRepo(docs: ReminderDocRow[], ledger: { document_id: string; milestone: number }[] = []) {
  const inserted: { document_id: string; milestone: number }[] = []
  const repo = {
    listActiveForReminders: vi.fn(async () => docs),
    listRemindersFor: vi.fn(async () => ledger),
    insertReminders: vi.fn(async (rows: { document_id: string; milestone: number }[]) => {
      inserted.push(...rows)
    }),
  } as unknown as ForeignDocsRepository
  return { repo, inserted }
}

function makeDeps() {
  return {
    sendStudentTelegram: vi.fn(async () => true),
    sendPush: vi.fn(async () => {}),
    sendEmail: vi.fn(async () => {}),
    sendDekanTelegram: vi.fn(async () => true),
    resolveStudentEmail: vi.fn(async () => 'a@b.uz'),
    today: TODAY,
  }
}

describe('runForeignDocReminders', () => {
  let deps: ReturnType<typeof makeDeps>
  beforeEach(() => {
    deps = makeDeps()
  })

  it('notifies the student on all three channels and records every crossed milestone', async () => {
    const { repo, inserted } = makeRepo([doc()])
    const result = await runForeignDocReminders(repo, deps)

    expect(deps.sendStudentTelegram).toHaveBeenCalledOnce()
    expect(deps.sendPush).toHaveBeenCalledOnce()
    expect(deps.sendEmail).toHaveBeenCalledOnce()
    // 3 kun qoldi → 30/15/10/5/3 hammasi belgilanadi
    expect(new Set(inserted.map((r) => r.milestone))).toEqual(new Set([30, 15, 10, 5, 3]))
    expect(result.studentsNotified).toBe(1)
    expect(result.milestonesRecorded).toBe(5)
  })

  it('sends one dekan digest per faculty for docs within 3 days', async () => {
    const { repo } = makeRepo([
      doc({ id: 'd1', student_id: 's1', users: { full_name: 'A', faculty: 'amit' } }),
      doc({ id: 'd2', student_id: 's2', users: { full_name: 'B', faculty: 'amit' } }),
      doc({ id: 'd3', student_id: 's3', expires_on: '2026-06-01', users: { full_name: 'C', faculty: 'biologiya' } }),
    ])
    const result = await runForeignDocReminders(repo, deps)
    // amit ichida 2 ta yaqin hujjat → 1 digest; biologiya hujjati 31 kun uzoq → digestга tushmaydi
    expect(deps.sendDekanTelegram).toHaveBeenCalledOnce()
    expect(deps.sendDekanTelegram).toHaveBeenCalledWith('amit', expect.stringContaining('bugungi eslatma'))
    expect(result.dekanDigestsSent).toBe(1)
  })

  it('does not notify again for a milestone already in the ledger', async () => {
    const { repo, inserted } = makeRepo(
      [doc({ expires_on: '2026-05-13' })], // 12 kun qoldi → due [30,15]
      [
        { document_id: 'd1', milestone: 30 },
        { document_id: 'd1', milestone: 15 },
      ],
    )
    const result = await runForeignDocReminders(repo, deps)
    expect(deps.sendStudentTelegram).not.toHaveBeenCalled()
    expect(inserted).toEqual([])
    expect(result.studentsNotified).toBe(0)
  })

  it('sends a post-expiry reminder inside the grace window', async () => {
    const { repo, inserted } = makeRepo([doc({ expires_on: '2026-04-28' })]) // 3 kun oldin tugagan
    await runForeignDocReminders(repo, deps)
    expect(deps.sendStudentTelegram).toHaveBeenCalledOnce()
    expect(inserted).toEqual([{ document_id: 'd1', milestone: -3 }])
    expect(deps.sendEmail).toHaveBeenCalledWith('a@b.uz', expect.any(String), expect.objectContaining({ daysLeft: -3 }))
  })

  it('stops post-expiry reminders after 7 days', async () => {
    const { repo } = makeRepo([doc({ expires_on: '2026-04-20' })]) // 11 kun oldin
    const result = await runForeignDocReminders(repo, deps)
    expect(deps.sendStudentTelegram).not.toHaveBeenCalled()
    expect(result.studentsNotified).toBe(0)
  })
})
