import { describe, expect, it, vi } from 'vitest'

process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-secret-key-for-applications-service'

vi.mock('@/lib/telegram', () => ({ sendTelegramAdminMessage: vi.fn(async () => {}) }))
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
      ttjNumber: '', room: '', incidentText: 'matn matn matn',
      signature: { attested: true, image: PNG },
    })).rejects.toThrow(/F\.I\.Sh/i)
  })

  it('createFormalAriza: needs a drawn signature', async () => {
    const { repo } = fakeRepo()
    await expect(createApplicationService(repo).createFormalAriza('stu-1', {
      kind: 'ariza', recipient: 'rektor', title: 'X', fullName: PROFILE.full_name,
      ttjNumber: '', room: '', incidentText: 'matn matn matn',
      signature: { attested: true },
    })).rejects.toThrow(/[Ii]mzo/)
  })

  it('staffSignature: unsigned vs signed', async () => {
    const { repo, store } = fakeRepo()
    store.ariza = { id: 'ariza-1', status: 'pending', title: 'A', type: 'ariza' }
    expect(await createApplicationService(repo).staffSignature('ariza-1')).toMatchObject({ signed: false })

    await createApplicationService(repo).create('stu-1', {
      type: 'ariza', title: 'A', text: 'm', status: 'pending', signature: sig(),
    })
    const s = await createApplicationService(repo).staffSignature('ariza-1')
    expect(s).toMatchObject({ signed: true })
    expect((s as { signature: { valid: boolean } }).signature.valid).toBe(true)
  })
})
