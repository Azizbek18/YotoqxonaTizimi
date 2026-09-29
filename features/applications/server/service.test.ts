import { describe, expect, it, vi } from 'vitest'

process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-secret-key-for-applications-service'

const tg = vi.hoisted(() => ({
  sendTelegramChatMessage: vi.fn(async () => true),
  sendStudentTelegram: vi.fn(async () => true),
  getStaffTelegramChatId: vi.fn(async () => '111'),
  dekanChatIdsForFaculty: vi.fn(async () => ['900', '901']),
  notifyDormStaffNewAriza: vi.fn(async () => {}),
  writeAuditLog: vi.fn(async () => {}),
}))
vi.mock('@/lib/telegram', () => ({
  sendTelegramAdminMessage: vi.fn(async () => {}),
  sendTelegramChatMessage: tg.sendTelegramChatMessage,
}))
vi.mock('@/lib/student-telegram', () => ({ sendStudentTelegram: tg.sendStudentTelegram }))
vi.mock('@/lib/staff-telegram', () => ({
  getStaffTelegramChatId: tg.getStaffTelegramChatId,
  dekanChatIdsForFaculty: tg.dekanChatIdsForFaculty,
  notifyDormStaffNewAriza: tg.notifyDormStaffNewAriza,
}))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: tg.writeAuditLog }))
vi.mock('@/lib/email', () => ({ sendArizaSignedEmail: vi.fn(async () => {}) }))

const { createApplicationService } = await import('./service')
const { verifyArizaRecord } = await import('@/lib/ariza-signature')
import type { ApplicationRepository } from './repository'

const PROFILE = {
  id: 'stu-1', full_name: 'Aliyev Vali Akmal oʻgʻli', email: 'aliyev@example.com',
  faculty: 'amit', direction: 'amaliy-matematika', course: 3, room_number: '305',
}
const PNG = 'data:image/png;base64,' + Buffer.from('fake-signature-bytes').toString('base64')

function fakeRepo(over: Partial<ApplicationRepository> = {}) {
  const store: { ariza: Record<string, unknown> | null; signature: Record<string, unknown> | null } = {
    ariza: null, signature: null,
  }
  const base = {
    getStudentDetails: vi.fn(async () => PROFILE),
    create: vi.fn(async (row: Record<string, unknown>) => {
      store.ariza = { id: 'ariza-1', ...row }
      return store.ariza
    }),
    getOwnedDraft: vi.fn(async () => (store.ariza && store.ariza.status === 'draft' ? store.ariza : null)),
    getOwned: vi.fn(async () => store.ariza),
    submitOwnedDraft: vi.fn(async () => {
      if (!store.ariza || store.ariza.status !== 'draft') return null
      store.ariza = { ...store.ariza, status: 'pending' }
      return store.ariza
    }),
    insertSignature: vi.fn(async (row: Record<string, unknown>) => {
      if (store.signature) { const e = new Error('duplicate'); throw e }
      store.signature = { id: 'sig-1', created_at: 'now', ...row }
      return store.signature
    }),
    deleteSignatureByAriza: vi.fn(async () => { store.signature = null }),
    signatureByAriza: vi.fn(async () => store.signature),
    signatureByCode: vi.fn(async (code: string) =>
      store.signature && store.signature.verify_code === code ? store.signature : null),
    arizaById: vi.fn(async () => store.ariza),
    deleteOwned: vi.fn(async () => null),
    list: vi.fn(async () => []),
    updateOwned: vi.fn(async () => null),
    dekanNameForFaculty: vi.fn(async () => 'Karimov B.'),
    ttjNumberForFaculty: vi.fn(async () => '12'),
  }
  return { store, repo: { ...base, ...over } as unknown as ApplicationRepository }
}

const sig = (typedName = PROFILE.full_name) => ({ typedName, attested: true })

describe('createApplicationService — signing', () => {
  it('chat needs no signature', async () => {
    const { repo, store } = fakeRepo()
    const r = await createApplicationService(repo).create('stu-1', { type: 'chat', title: 'x', text: 'salom' })
    expect(r.success).toBe(true)
    expect(store.signature).toBeNull()
  })

  it('an ariza submitted without a signature is rejected', async () => {
    const { repo } = fakeRepo()
    await expect(
      createApplicationService(repo).create('stu-1', { type: 'ariza', title: 'Ariza', text: 'matn', status: 'pending' }),
    ).rejects.toThrow(/imzolang/i)
  })

  it('a mismatched typed name is rejected', async () => {
    const { repo } = fakeRepo()
    await expect(
      createApplicationService(repo).create('stu-1', {
        type: 'ariza', title: 'Ariza', text: 'matn', status: 'pending', signature: sig('Boshqa Odam'),
      }),
    ).rejects.toThrow(/F\.I\.Sh/i)
  })

  it('a signed ariza: draft first, signature row, then pending + receipt', async () => {
    const { repo, store } = fakeRepo()
    const r = await createApplicationService(repo).create('stu-1', {
      type: 'ariza', title: 'Tungi ruxsat', text: 'matn', reason: 'sabab', status: 'pending', signature: sig(),
    })
    expect((store.ariza as Record<string, unknown>).status).toBe('pending')
    expect(store.signature).toBeTruthy()
    expect(r.receipt?.verifyCode).toMatch(/^YT-/)
    // name/spacing tolerant
    const check = verifyArizaRecord({
      contentSnapshot: (store.signature as Record<string, unknown>).content_snapshot as Record<string, unknown>,
      contentHash: (store.signature as Record<string, unknown>).content_hash as string,
      studentId: (store.signature as Record<string, unknown>).student_id as string,
      signedAt: (store.signature as Record<string, unknown>).signed_at as string,
      verifyCode: (store.signature as Record<string, unknown>).verify_code as string,
      signature: (store.signature as Record<string, unknown>).signature as string,
    })
    expect(check.valid).toBe(true)
  })

  it('accepts a differently-spelled name (script/case/spacing)', async () => {
    const { repo } = fakeRepo()
    const r = await createApplicationService(repo).create('stu-1', {
      type: 'tushuntirish', title: 'Tushuntirish', text: 'matn', status: 'pending',
      signature: sig('  aliyev   vali  akmal ogli '),
    })
    expect(r.receipt).toBeTruthy()
  })

  it('submit() on a signed-type draft requires and records the signature', async () => {
    const { repo, store } = fakeRepo()
    await createApplicationService(repo).create('stu-1', { type: 'ariza', title: 'A', text: 'm', status: 'draft' })
    await expect(createApplicationService(repo).submit('stu-1', 'ariza-1', undefined)).rejects.toThrow(/imzolang/i)
    const r = await createApplicationService(repo).submit('stu-1', 'ariza-1', sig())
    expect(r.receipt?.verifyCode).toMatch(/^YT-/)
    expect((store.ariza as Record<string, unknown>).status).toBe('pending')
  })

  it('verifyByCode: valid, then tamper-detected', async () => {
    const { repo, store } = fakeRepo()
    const created = await createApplicationService(repo).create('stu-1', {
      type: 'ariza', title: 'A', text: 'asl matn', status: 'pending', signature: sig(),
    })
    const code = created.receipt!.verifyCode
    const ok = await createApplicationService(repo).verifyByCode(code)
    expect(ok).toMatchObject({ valid: true, signedBy: PROFILE.full_name })
    expect(ok).not.toHaveProperty('signatureImage')

    ;(store.signature as Record<string, unknown>).content_snapshot = {
      ...((store.signature as Record<string, unknown>).content_snapshot as Record<string, unknown>),
      text: 'buzilgan matn',
    }
    const bad = await createApplicationService(repo).verifyByCode(code)
    expect(bad).toMatchObject({ valid: false, hashOk: false })
  })

  it('verifyByCode: unknown code → { valid: false }', async () => {
    const { repo } = fakeRepo()
    expect(await createApplicationService(repo).verifyByCode('YT-AAAA-BBBB')).toEqual({ valid: false })
    expect(await createApplicationService(repo).verifyByCode('junk')).toEqual({ valid: false })
  })

  it('remove() refuses a non-draft (signed) application', async () => {
    const { repo } = fakeRepo({ deleteOwned: vi.fn(async () => null) })
    await expect(createApplicationService(repo).remove('stu-1', 'ariza-1')).rejects.toThrow(/o'chirib bo'lmaydi|topilmadi/i)
  })

  it('createFormalAriza: composes the text, embeds the drawn signature, one step', async () => {
    const { repo, store } = fakeRepo()
    const res = await createApplicationService(repo).createFormalAriza('stu-1', {
      kind: 'tushuntirish',
      recipient: 'dekan',
      title: 'Kechikish',
      fullName: PROFILE.full_name,
      ttjNumber: '12',
      room: '305',
      incidentText: 'Bugun do‘stlarim bilan tug‘ilgan kunni nishonlab kech qaytdim.',
      signature: { attested: true, image: PNG },
    })
    expect(res.receipt.verifyCode).toMatch(/^YT-/)
    const ariza = store.ariza as Record<string, unknown>
    expect(ariza.status).toBe('pending')
    expect(ariza.type).toBe('tushuntirish')
    expect(String(ariza.text)).toContain('12-sonli talabalar turar joyining 305-xonasida')
    expect(String(ariza.text)).toContain('dekani Karimov B.ga')
    const sig = store.signature as Record<string, unknown>
    expect(sig.signature_image).toBe(PNG)
    expect((sig.content_snapshot as Record<string, unknown>).signatureImageHash).toBeTruthy()
    expect((sig.content_snapshot as Record<string, unknown>).formal).toBeTruthy()
  })

  it('createFormalAriza: rejects a name that is not the student', async () => {
    const { repo } = fakeRepo()
    await expect(createApplicationService(repo).createFormalAriza('stu-1', {
      kind: 'ariza', recipient: 'rektor', title: 'X', fullName: 'Boshqa Odam',
      incidentText: 'matn matn matn',
      signature: { attested: true, image: PNG },
    })).rejects.toThrow(/F\.I\.Sh/i)
  })

  it('createFormalAriza: needs a drawn signature', async () => {
    const { repo } = fakeRepo()
    await expect(createApplicationService(repo).createFormalAriza('stu-1', {
      kind: 'ariza', recipient: 'rektor', title: 'X', fullName: PROFILE.full_name,
      incidentText: 'matn matn matn',
      signature: { attested: true },
    })).rejects.toThrow(/[Ii]mzo/)
  })

  it('createFormalAriza: ignores a forged dorm/room number and uses the student\'s real one', async () => {
    const { repo, store } = fakeRepo()
    const res = await createApplicationService(repo).createFormalAriza('stu-1', {
      kind: 'tushuntirish',
      recipient: 'dekan',
      title: 'Kechikish',
      fullName: PROFILE.full_name,
      // A student-supplied dorm/room should never reach the signed letter —
      // the server must derive it from the profile (see the comment in
      // createFormalAriza). Confirms the fix for the editable-field bug.
      ttjNumber: '999',
      room: '999',
      incidentText: 'Bugun do‘stlarim bilan tug‘ilgan kunni nishonlab kech qaytdim.',
      signature: { attested: true, image: PNG },
    })

    expect(res.compose.ttjNumber).toBe('12')
    expect(res.compose.room).toBe(PROFILE.room_number)
    const ariza = store.ariza as Record<string, unknown>
    expect(String(ariza.text)).toContain('12-sonli talabalar turar joyining 305-xonasida')
    expect(String(ariza.text)).not.toContain('999')
  })

  it('staffSignature: unsigned vs signed', async () => {
    const { repo, store } = fakeRepo()
    store.ariza = { id: 'ariza-1', status: 'pending', title: 'A', type: 'ariza' }
    expect(await createApplicationService(repo).staffSignature('ariza-1', null)).toMatchObject({ signed: false })

    await createApplicationService(repo).create('stu-1', {
      type: 'ariza', title: 'A', text: 'm', status: 'pending', signature: sig(),
    })
    const s = await createApplicationService(repo).staffSignature('ariza-1', null)
    expect(s).toMatchObject({ signed: true })
    expect((s as { signature: { valid: boolean } }).signature.valid).toBe(true)
  })

  it('staffSignature / documentData: another faculty reads as not-found', async () => {
    const { repo, store } = fakeRepo()
    store.ariza = { id: 'ariza-1', status: 'pending', title: 'A', type: 'ariza', faculty: 'amit' }
    const service = createApplicationService(repo)
    await expect(service.staffSignature('ariza-1', ['iqtisodiyot'])).rejects.toMatchObject({ status: 404 })
    await expect(service.documentData('ariza-1', { staffFaculties: ['iqtisodiyot'] }))
      .rejects.toMatchObject({ status: 404 })
    await expect(service.staffSignature('ariza-1', ['amit'])).resolves.toMatchObject({ signed: false })
  })
})


describe('createApplicationService — tarbiyachi writes a tushuntirish xati on a student’s behalf', () => {
  const STAFF = { id: 'staff-1', fullName: 'Tarbiyachi Salimov' }
  const STUDENT = {
    id: 'stu-1', full_name: 'Aliyev Vali Akmal oʻgʻli', email: 'aliyev@example.com', faculty: 'amit',
    direction: 'amaliy-matematika', course: 3, room_number: '305', status: 'active', is_off_campus: false,
  }
  const body = (over: Record<string, unknown> = {}) => ({
    studentId: 'stu-1',
    incidentText: 'Telefonim o‘chib qolgan edi, yo‘qlamaga chiqa olmadim.',
    signature: { typedName: STUDENT.full_name, attested: true, image: PNG },
    ...over,
  })
  const repoFor = (over: Record<string, unknown> = {}) => fakeRepo({
    getStudentForStaff: vi.fn(async () => STUDENT),
    explanationCount: vi.fn(async () => 1),
    recentExplanations: vi.fn(async () => []),
    ...over,
  } as unknown as Partial<ApplicationRepository>)

  it('signs the letter with the student’s drawn signature and freezes who recorded it', async () => {
    const { repo, store } = repoFor()
    const res = await createApplicationService(repo).createExplanationOnBehalf(STAFF, ['amit'], body())
    expect(res.success).toBe(true)
    expect(res.explanationCount).toBe(1)
    expect(res.red).toBe(false)
    expect((store.ariza as Record<string, unknown>).type).toBe('tushuntirish')
    const snapshot = (store.signature as Record<string, unknown>).content_snapshot as Record<string, unknown>
    expect(snapshot.recordedBy).toMatchObject({ staffId: 'staff-1', role: 'tarbiyachi' })
    expect(res.receipt.verifyCode).toMatch(/^YT-/)
  })

  it('sends the letter by Telegram to the student and to the tarbiyachi, not to the dekan yet', async () => {
    vi.clearAllMocks()
    const { repo } = repoFor()
    const res = await createApplicationService(repo).createExplanationOnBehalf(STAFF, ['amit'], body())
    expect(tg.sendStudentTelegram).toHaveBeenCalledTimes(1)
    expect(tg.sendTelegramChatMessage).toHaveBeenCalledTimes(1) // the tarbiyachi's own copy
    expect(tg.dekanChatIdsForFaculty).not.toHaveBeenCalled()
    expect(res.telegram).toMatchObject({ student: true, staff: 'sent', dekansNotified: 0 })
    // The default per-ariza pings are suppressed: this flow sends its own.
    expect(tg.notifyDormStaffNewAriza).not.toHaveBeenCalled()
  })

  it('the 3rd signed letter turns the student red and tells the dekan(s)', async () => {
    vi.clearAllMocks()
    const { repo } = repoFor({ explanationCount: vi.fn(async () => 3) })
    const res = await createApplicationService(repo).createExplanationOnBehalf(STAFF, ['amit'], body())
    expect(res.red).toBe(true)
    expect(tg.dekanChatIdsForFaculty).toHaveBeenCalledWith('amit')
    expect(res.telegram.dekansNotified).toBe(2)
    expect(tg.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ariza.tushuntirish_on_behalf' }))
  })

  it('reports when the tarbiyachi has no Telegram chat set (the letter is still saved)', async () => {
    vi.clearAllMocks()
    tg.getStaffTelegramChatId.mockResolvedValueOnce('')
    const { repo, store } = repoFor()
    const res = await createApplicationService(repo).createExplanationOnBehalf(STAFF, ['amit'], body())
    expect(res.telegram.staff).toBe('not_set')
    expect(store.signature).toBeTruthy()
  })

  it('refuses a KV (off-campus) student', async () => {
    const { repo } = repoFor({ getStudentForStaff: vi.fn(async () => ({ ...STUDENT, is_off_campus: true })) })
    await expect(createApplicationService(repo).createExplanationOnBehalf(STAFF, ['amit'], body()))
      .rejects.toMatchObject({ status: 409 })
  })

  it('refuses a student who lives in another building', async () => {
    const { repo } = repoFor()
    await expect(createApplicationService(repo).createExplanationOnBehalf(STAFF, ['kimyo'], body()))
      .rejects.toMatchObject({ status: 403 })
  })

  it('refuses an inactive account and an unknown student', async () => {
    const inactive = repoFor({ getStudentForStaff: vi.fn(async () => ({ ...STUDENT, status: 'pending' })) })
    await expect(createApplicationService(inactive.repo).createExplanationOnBehalf(STAFF, ['amit'], body()))
      .rejects.toMatchObject({ status: 409 })
    const missing = repoFor({ getStudentForStaff: vi.fn(async () => null) })
    await expect(createApplicationService(missing.repo).createExplanationOnBehalf(STAFF, ['amit'], body()))
      .rejects.toMatchObject({ status: 404 })
  })

  it('needs the student’s drawn signature and a real reason', async () => {
    const { repo } = repoFor()
    const svc = createApplicationService(repo)
    await expect(svc.createExplanationOnBehalf(STAFF, ['amit'], body({ signature: { typedName: 'x', attested: true } })))
      .rejects.toMatchObject({ status: 400 })
    await expect(svc.createExplanationOnBehalf(STAFF, ['amit'], body({ incidentText: 'qisqa' })))
      .rejects.toMatchObject({ status: 400 })
  })

  it('explanationContext gives the picked student’s details, the letter count and the red flag', async () => {
    const { repo } = repoFor({ explanationCount: vi.fn(async () => 3) })
    const ctx = await createApplicationService(repo).explanationContext(['amit'], 'stu-1')
    expect(ctx.student).toMatchObject({ fullName: STUDENT.full_name, room: '305', course: 3 })
    expect(ctx.explanationCount).toBe(3)
    expect(ctx.red).toBe(true)
    expect(ctx.ttjNumber).toBe('12')
  })
})
