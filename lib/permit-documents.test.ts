import { describe, expect, it, vi } from 'vitest'
import { createPermitDocumentDelivery, isValidSignatureDataUrl, type DeliveryDeps } from './permit-documents'
import { SIGNATURE_PNG as PNG } from '../test/fixtures/signature-png'

// A tiny chainable stub for the supabase query builder. Each `.from(table)`
// call pulls its canned result from `tables[table]` (an array — shift one per
// terminal call so a table can be read more than once with different rows).
function makeSupabase(config: {
  tables: Record<string, unknown[]>
  counts?: Record<string, number>
  onUpdate?: (table: string, patch: Record<string, unknown>) => void
  onUpload?: (path: string) => void
}) {
  const uploads: string[] = []
  function builder(table: string) {
    const state = { isCount: false }
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'or', 'ilike', 'is', 'not', 'order', 'limit']) {
      chain[m] = (...args: unknown[]) => {
        if (m === 'select' && args[1] && (args[1] as { head?: boolean }).head) state.isCount = true
        return chain
      }
    }
    chain.maybeSingle = async () => {
      if (state.isCount) return { count: config.counts?.[table] ?? 0, error: null }
      const row = (config.tables[table] ?? []).shift() ?? null
      return { data: row, error: null }
    }
    chain.then = (resolve: (v: unknown) => unknown) => {
      if (state.isCount) return resolve({ count: config.counts?.[table] ?? 0, error: null })
      return resolve({ data: config.tables[table] ?? [], error: null })
    }
    chain.update = (patch: Record<string, unknown>) => {
      config.onUpdate?.(table, patch)
      return { eq: async () => ({ error: null }) }
    }
    return chain
  }
  return {
    from: (table: string) => builder(table),
    storage: {
      from: () => ({
        upload: async (path: string) => {
          uploads.push(path)
          config.onUpload?.(path)
          return { data: { path }, error: null }
        },
      }),
    },
    _uploads: uploads,
  }
}

function baseDeps(over: Partial<DeliveryDeps> & { supabaseConfig?: Parameters<typeof makeSupabase>[0] } = {}): DeliveryDeps {
  const { supabaseConfig, ...rest } = over
  return {
    supabase: makeSupabase(supabaseConfig ?? { tables: {} }) as unknown as DeliveryDeps['supabase'],
    renderPdf: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])),
    sendTelegram: vi.fn(async () => true),
    sendEmail: vi.fn(async () => ({ ok: true })),
    getSettings: vi.fn(async () => ({ ttjName: '14' })),
    ...rest,
  }
}

const permitRow = (over: Record<string, unknown> = {}) => ({
  id: 'p1', full_name: 'Test Talaba', email: 't@example.com', faculty: 'amit',
  course: 2, study_type: 'grant', origin_country: "O'zbekiston", origin_region: 'Andijon',
  phone: '+998901234567', relative_phone: '+998901112233', application_type: 'yollanma',
  status: 'approved', room_number: '305', passport_series: 'AA1', jshshir: '123', ...over,
})
const docRow = (over: Record<string, unknown> = {}) => ({
  permit_request_id: 'p1', student_signature: PNG, student_signed_at: '2026-09-01T10:00:00Z',
  delivered_at: null, ...over,
})
const staffRow = { id: 's1', full_name: 'Dekan Aliyev', signature_image: PNG }

describe('isValidSignatureDataUrl', () => {
  it('accepts a real hand-drawn PNG data URL', () => expect(isValidSignatureDataUrl(PNG)).toBe(true))
  it('rejects a jpeg / plain string / oversize / blank-canvas-tiny', () => {
    expect(isValidSignatureDataUrl('data:image/jpeg;base64,abcd')).toBe(false)
    expect(isValidSignatureDataUrl('hello')).toBe(false)
    expect(isValidSignatureDataUrl(`data:image/png;base64,${'A'.repeat(400_000)}`)).toBe(false)
    // a 1×1 / empty-canvas PNG is a couple hundred bytes — not a signature
    expect(isValidSignatureDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).toBe(false)
  })
})

describe('deliverPermitDocuments', () => {
  it('skips when there is no document row (pre-feature permit)', async () => {
    const deps = baseDeps({ supabaseConfig: { tables: { permit_documents: [] } } })
    expect(await createPermitDocumentDelivery(deps).deliver('p1')).toBe('skipped_no_document')
  })

  it('skips when already delivered', async () => {
    const deps = baseDeps({ supabaseConfig: { tables: { permit_documents: [docRow({ delivered_at: '2026-09-02T00:00:00Z' })] } } })
    expect(await createPermitDocumentDelivery(deps).deliver('p1')).toBe('skipped_already')
  })

  it('skips when the permit is not approved / has no room', async () => {
    const deps = baseDeps({ supabaseConfig: { tables: {
      permit_documents: [docRow()],
      permit_requests: [permitRow({ status: 'pending' })],
    } } })
    expect(await createPermitDocumentDelivery(deps).deliver('p1')).toBe('skipped_not_ready')
  })

  it('defers when the dekan has no saved signature', async () => {
    const deps = baseDeps({ supabaseConfig: { tables: {
      permit_documents: [docRow()],
      permit_requests: [permitRow()],
      users: [null] as unknown[],
      staff: [null] as unknown[],
    } } })
    expect(await createPermitDocumentDelivery(deps).deliver('p1', { id: 's1', fullName: 'Dekan' })).toBe('deferred_no_dekan_signature')
  })

  it('delivers via Telegram when a chat is linked', async () => {
    const updates: Record<string, unknown>[] = []
    const deps = baseDeps({
      supabaseConfig: {
        tables: {
          permit_documents: [docRow()],
          permit_requests: [permitRow()],
          users: [null] as unknown[],
          staff: [staffRow] as unknown[],
          floor_room_layout: [{ floor_number: 3 }],
          permit_telegram_links: [{ chat_id: 555 }],
        },
        counts: { permit_documents: 41 },
        onUpdate: (_t, patch) => updates.push(patch),
      },
    })
    const outcome = await createPermitDocumentDelivery(deps).deliver('p1', { id: 's1', fullName: 'Dekan Aliyev' })
    expect(outcome).toBe('delivered')
    expect(deps.sendTelegram).toHaveBeenCalledOnce()
    expect(deps.sendEmail).not.toHaveBeenCalled()
    expect(updates.at(-1)).toMatchObject({ delivery_channel: 'telegram', ariza_no: 'YT-2026-0042' })
  })

  it('falls back to email when no Telegram chat, then to Telegram if email fails', async () => {
    // no telegram link, email ok -> email
    const emailDeps = baseDeps({
      supabaseConfig: { tables: {
        permit_documents: [docRow()], permit_requests: [permitRow()],
        users: [null] as unknown[], staff: [staffRow] as unknown[],
        floor_room_layout: [{ floor_number: 3 }], permit_telegram_links: [null] as unknown[],
      } },
    })
    expect(await createPermitDocumentDelivery(emailDeps).deliver('p1')).toBe('delivered')
    expect(emailDeps.sendEmail).toHaveBeenCalledOnce()

    // email fails but a telegram chat exists -> telegram retry wins
    const retryDeps = baseDeps({
      sendEmail: vi.fn(async () => ({ ok: false })),
      supabaseConfig: { tables: {
        permit_documents: [docRow()], permit_requests: [permitRow()],
        users: [null] as unknown[], staff: [staffRow] as unknown[],
        floor_room_layout: [{ floor_number: 3 }], permit_telegram_links: [{ chat_id: 999 }],
      } },
    })
    // first telegram attempt fails, email fails, retry telegram succeeds
    ;(retryDeps.sendTelegram as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    expect(await createPermitDocumentDelivery(retryDeps).deliver('p1')).toBe('delivered')
    expect(retryDeps.sendTelegram).toHaveBeenCalledTimes(2)
  })

  it('defers when neither channel works', async () => {
    const deps = baseDeps({
      sendTelegram: vi.fn(async () => false),
      sendEmail: vi.fn(async () => ({ ok: false })),
      supabaseConfig: { tables: {
        permit_documents: [docRow()], permit_requests: [permitRow()],
        users: [null] as unknown[], staff: [staffRow] as unknown[],
        floor_room_layout: [{ floor_number: 3 }], permit_telegram_links: [null] as unknown[],
      } },
    })
    expect(await createPermitDocumentDelivery(deps).deliver('p1')).toBe('deferred_no_channel')
  })
})
