import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()
const checkRateLimit = vi.fn()
const create = vi.fn()
const listAuthored = vi.fn()
const remove = vi.fn()
const broadcastStory = vi.fn()
const storageRemove = vi.fn(async () => ({ error: null }))
const storageUpload = vi.fn(async () => ({ error: null }))

vi.mock('next/server', async (orig) => ({
  ...(await orig() as object),
  after: (fn: unknown) => (typeof fn === 'function' ? (fn as () => unknown)() : undefined),
}))
vi.mock('@/server/auth/guards', () => ({ requireStaffPermission: () => {}, requireActiveStaff: (...a: unknown[]) => requireActiveStaff(...a) }))
vi.mock('@/lib/security', () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }))
vi.mock('@/features/stories/server/broadcast', () => ({ broadcastStory: (...a: unknown[]) => broadcastStory(...a) }))
vi.mock('@/features/stories/server/service', () => ({
  createStoryService: () => ({ create, listAuthored, remove }),
}))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    storage: {
      from: () => ({
        upload: storageUpload,
        getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.example/x.jpg' } }),
        remove: storageRemove,
      }),
    },
  }),
}))

const { GET, POST, DELETE } = await import('./route')

const DEKAN = { id: 'dekan-1', full_name: 'Dekan', email: 'd@x.uz', role: 'dekan', status: 'active', faculty: 'amit' }
const TARBIYACHI = { ...DEKAN, id: 'trb-1', role: 'tarbiyachi' }
const AUTH = (staff: unknown) => ({ user: { id: (staff as { id: string }).id }, staff })

function jpegForm() {
  const bytes = new Uint8Array(32)
  bytes.set([0xff, 0xd8, 0xff, 0xe0])
  const form = new FormData()
  form.append('image', new File([bytes], 'x.jpg', { type: 'image/jpeg' }))
  form.append('title', 'Bugungi tadbir')
  form.append('caption', 'Soat 18:00')
  form.append('type', 'Tadbir')
  return form
}

function multipartRequest(form: FormData) {
  return new Request('http://localhost/api/dekan/stories', { method: 'POST', body: form })
}

beforeEach(() => {
  vi.clearAllMocks()
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 19 })
})

describe('auth', () => {
  it('rejects a non-staff caller', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(403, 'yoq', 'FORBIDDEN'))
    const res = await GET(new Request('http://localhost/api/dekan/stories') as never)
    expect(res.status).toBe(403)
  })

  it('allows dekan, admin and tarbiyachi', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(TARBIYACHI))
    listAuthored.mockResolvedValue([])
    const res = await GET(new Request('http://localhost/api/dekan/stories') as never)
    expect(res.status).toBe(200)
    expect(requireActiveStaff).toHaveBeenCalledWith(expect.anything(), ['dekan', 'admin', 'tarbiyachi'])
  })
})

describe('POST', () => {
  it('uploads the image, creates the story and schedules the broadcast', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(DEKAN))
    create.mockResolvedValue({ id: 's1', faculty: 'amit', image_url: 'https://cdn.example/x.jpg' })
    const res = await POST(multipartRequest(jpegForm()) as never)
    expect(res.status).toBe(201)
    expect(storageUpload).toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith(
      'dekan-1', 'Dekan', 'amit',
      expect.objectContaining({ title: 'Bugungi tadbir', type: 'Tadbir', image_url: 'https://cdn.example/x.jpg' }),
    )
    expect(broadcastStory).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }))
  })

  it('rate-limits per staff member', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(DEKAN))
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })
    const res = await POST(multipartRequest(jpegForm()) as never)
    expect(res.status).toBe(429)
    expect(storageUpload).not.toHaveBeenCalled()
  })

  it('rejects a non-image upload by signature', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(DEKAN))
    const form = new FormData()
    form.append('image', new File([new Uint8Array(32)], 'x.jpg', { type: 'image/jpeg' }))
    form.append('title', 'test')
    form.append('type', 'Yangilik')
    const res = await POST(multipartRequest(form) as never)
    expect(res.status).toBe(400)
  })

  it('removes the uploaded file if story creation fails', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(DEKAN))
    create.mockRejectedValue(new ApiError(400, "Sarlavha noto'g'ri"))
    const res = await POST(multipartRequest(jpegForm()) as never)
    expect(res.status).toBe(400)
    expect(storageRemove).toHaveBeenCalled()
    expect(broadcastStory).not.toHaveBeenCalled()
  })
})

describe('DELETE', () => {
  it('pins a tarbiyachi delete to their own author id and cleans the file', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(TARBIYACHI))
    remove.mockResolvedValue({ image_path: 'trb-1/a.jpg' })
    const res = await DELETE(new NextRequest('http://localhost/api/dekan/stories?id=s1', { method: 'DELETE' }))
    expect(res.status).toBe(200)
    expect(remove).toHaveBeenCalledWith('amit', 's1', 'trb-1')
    expect(storageRemove).toHaveBeenCalledWith(['trb-1/a.jpg'])
  })

  it('lets a dekan delete any story in their faculty (no author pin)', async () => {
    requireActiveStaff.mockResolvedValue(AUTH(DEKAN))
    remove.mockResolvedValue({ image_path: 'x/a.jpg' })
    await DELETE(new NextRequest('http://localhost/api/dekan/stories?id=s1', { method: 'DELETE' }))
    expect(remove).toHaveBeenCalledWith('amit', 's1', undefined)
  })
})
