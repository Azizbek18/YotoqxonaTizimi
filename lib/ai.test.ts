import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiChatReply, aiVisionJson, describeAiFailure } from './ai'

const GEMINI_OK = () =>
  Response.json({ candidates: [{ content: { parts: [{ text: 'natija' }] } }] })
const GROQ_OK = (text: string) =>
  Response.json({ choices: [{ message: { content: text } }] })

function isGroq(url: unknown) {
  return String(url).includes('api.groq.com')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('describeAiFailure', () => {
  it('names a depleted-credits outage as a billing problem', () => {
    expect(describeAiFailure('Gemini API error (429): {"status":"RESOURCE_EXHAUSTED"}')).toMatch(/billing|kredit/i)
  })
  it('names an invalid key', () => {
    expect(describeAiFailure('Groq API error (401): PERMISSION_DENIED')).toMatch(/kalit/i)
  })
  it('passes an unknown error through, trimmed', () => {
    expect(describeAiFailure('weird thing')).toBe('weird thing')
  })
})

describe('aiVisionJson — Gemini primary, Groq fallback', () => {
  it('uses Gemini when it succeeds and never calls Groq', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g')
    const fetchMock = vi.fn(async (url: unknown) => (isGroq(url) ? GROQ_OK('x') : GEMINI_OK()))
    vi.stubGlobal('fetch', fetchMock)

    const res = await aiVisionJson(
      { contents: [{ parts: [{ text: 'check' }, { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }] }] },
      'gemini-key',
    )
    expect(res.candidates[0].content.parts[0].text).toBe('natija')
    expect(fetchMock.mock.calls.every((c) => !isGroq(c[0]))).toBe(true)
  })

  it('falls back to Groq (and strips code fences) when Gemini fails', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g')
    const fetchMock = vi.fn(async (url: unknown) =>
      isGroq(url) ? GROQ_OK('```json\n{"ok":true}\n```') : new Response('boom', { status: 500 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await aiVisionJson(
      { contents: [{ parts: [{ text: 'check' }, { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }] }] },
      'gemini-key',
    )
    expect(res.candidates[0].content.parts[0].text).toBe('{"ok":true}')
  })

  it('does not fall back to Groq for a PDF (image models cannot read it)', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g')
    const fetchMock = vi.fn(async (url: unknown) => (isGroq(url) ? GROQ_OK('x') : new Response('boom', { status: 500 })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      aiVisionJson(
        { contents: [{ parts: [{ text: 'x' }, { inlineData: { mimeType: 'application/pdf', data: 'JVBER' } }] }] },
        'gemini-key',
      ),
    ).rejects.toThrow()
    expect(fetchMock.mock.calls.every((c) => !isGroq(c[0]))).toBe(true)
  })
})

describe('aiChatReply — Groq primary, Gemini fallback', () => {
  it('uses Groq when configured', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g')
    const fetchMock = vi.fn(async (url: unknown) =>
      isGroq(url) ? GROQ_OK('salom') : GEMINI_OK(),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await aiChatReply(
      { contents: [{ role: 'user', parts: [{ text: 'hi' }] }], systemInstruction: { parts: [{ text: 'sys' }] } },
      'gemini-key',
    )
    expect(res.candidates[0].content.parts[0].text).toBe('salom')
    expect(isGroq(fetchMock.mock.calls[0][0])).toBe(true)
  })

  it('falls back to Gemini when Groq is not configured', async () => {
    const fetchMock = vi.fn(async (url: unknown) => (isGroq(url) ? GROQ_OK('x') : GEMINI_OK()))
    vi.stubGlobal('fetch', fetchMock)

    const res = await aiChatReply(
      { contents: [{ role: 'user', parts: [{ text: 'hi' }] }], systemInstruction: { parts: [{ text: 'sys' }] } },
      'gemini-key',
    )
    expect(res.candidates[0].content.parts[0].text).toBe('natija')
    expect(fetchMock.mock.calls.every((c) => !isGroq(c[0]))).toBe(true)
  })
})
