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
    expect(describeAiFailure('Groq API error (401): bad Authorization')).toMatch(/kalit/i)
  })
  it('names a billing / dunning suspension', () => {
    expect(describeAiFailure('Gemini API error (403): Lightning dunning decision is deny for project'))
      .toMatch(/to'lov|billing/i)
  })
  it('names a dead model', () => {
    expect(describeAiFailure('Groq API error (404): the model does not exist')).toMatch(/model/i)
  })
  it('passes an unknown error through, trimmed', () => {
    expect(describeAiFailure('weird thing')).toBe('weird thing')
  })
})

describe('aiVisionJson — Groq image primary, direct Gemini fallback', () => {
  it('uses Groq vision when an image is provided', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g')
    const fetchMock = vi.fn(async (url: unknown) => (isGroq(url) ? GROQ_OK('{"valid":true}') : GEMINI_OK()))
    vi.stubGlobal('fetch', fetchMock)

    const res = await aiVisionJson(
      { contents: [{ parts: [{ text: 'check' }, { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }] }] },
      'gemini-key',
    )
    expect(res.candidates[0].content.parts[0].text).toBe('{"valid":true}')
    expect(isGroq(fetchMock.mock.calls[0][0])).toBe(true)
    const firstCall = fetchMock.mock.calls[0] as unknown as [unknown, RequestInit]
    const body = JSON.parse(String(firstCall[1]?.body))
    expect(body.model).toBe('qwen/qwen3.6-27b')
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,AAAA')
  })

  it('skips Groq for PDF and uses Gemini when Gateway is unavailable', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g')
    const fetchMock = vi.fn(async (url: unknown) => (isGroq(url) ? GROQ_OK('x') : GEMINI_OK()))
    vi.stubGlobal('fetch', fetchMock)

    const res = await aiVisionJson(
      { contents: [{ parts: [{ text: 'check' }, { inlineData: { mimeType: 'application/pdf', data: 'AAAA' } }] }] },
      'gemini-key',
    )
    expect(res.candidates[0].content.parts[0].text).toBe('natija')
    expect(fetchMock.mock.calls.every((c) => !isGroq(c[0]))).toBe(true)
  })

  it('throws (no silent success) when Gemini fails', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      aiVisionJson(
        { contents: [{ parts: [{ text: 'x' }, { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }] }] },
        'gemini-key',
      ),
    ).rejects.toThrow()
  })

  it('throws immediately when no Gemini key is set', async () => {
    await expect(aiVisionJson({ contents: [] }, undefined)).rejects.toThrow(/provider/i)
  })
})

describe('aiChatReply — Groq primary, Gemini fallback', () => {
  it('uses Groq when configured', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g')
    const fetchMock = vi.fn(async (url: unknown) => (isGroq(url) ? GROQ_OK('salom') : GEMINI_OK()))
    vi.stubGlobal('fetch', fetchMock)

    const res = await aiChatReply(
      { contents: [{ role: 'user', parts: [{ text: 'hi' }] }], systemInstruction: { parts: [{ text: 'sys' }] } },
      'gemini-key',
    )
    expect(res.candidates[0].content.parts[0].text).toBe('salom')
    expect(isGroq(fetchMock.mock.calls[0][0])).toBe(true)
  })

  it('falls back to Gemini when Groq fails', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g')
    const fetchMock = vi.fn(async (url: unknown) =>
      isGroq(url) ? new Response('down', { status: 503 }) : GEMINI_OK(),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await aiChatReply(
      { contents: [{ role: 'user', parts: [{ text: 'hi' }] }], systemInstruction: { parts: [{ text: 'sys' }] } },
      'gemini-key',
    )
    expect(res.candidates[0].content.parts[0].text).toBe('natija')
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
