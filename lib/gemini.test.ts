import { afterEach, describe, expect, it, vi } from 'vitest'
import { callGemini } from './gemini'

describe('Gemini retry policy', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fails immediately on a non-retryable client error', async () => {
    const fetchMock = vi.fn(async () => new Response('invalid payload', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(callGemini({ bad: true }, 'test-key')).rejects.toThrow('Gemini API error (400)')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('tries the fallback model once when the primary model is unavailable', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('model not found', { status: 404 }))
      .mockResolvedValueOnce(Response.json({ candidates: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(callGemini({}, 'test-key')).resolves.toEqual({ candidates: [] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain('gemini-flash-latest')
    expect(String(fetchMock.mock.calls[1][0])).toContain('gemini-3.6-flash')
  })
})
