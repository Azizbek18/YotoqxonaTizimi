import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const generateText = vi.fn(async () => ({ text: '```json\n{"ok":true}\n```' }))
vi.mock('ai', () => ({ generateText }))

const { aiGatewayConfigured, gatewayGenerate } = await import('./ai-gateway')

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('AI Gateway adapter', () => {
  it('is configured only when an explicit gateway key is set', () => {
    expect(aiGatewayConfigured()).toBe(false)
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key')
    expect(aiGatewayConfigured()).toBe(true)
  })

  it('sends image/PDF input through cheap vision models and strips JSON fences', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key')
    const text = await gatewayGenerate({
      contents: [{ parts: [
        { text: 'Tekshir' },
        { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } },
        { inlineData: { mimeType: 'application/pdf', data: 'AAAA' } },
      ] }],
      generationConfig: { responseMimeType: 'application/json' },
    }, 'vision')

    expect(text).toBe('{"ok":true}')
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      model: 'alibaba/qwen3.7-flash',
      messages: [expect.objectContaining({
        content: expect.arrayContaining([
          expect.objectContaining({ type: 'image', mediaType: 'image/jpeg' }),
          expect.objectContaining({ type: 'file', mediaType: 'application/pdf' }),
        ]),
      })],
      providerOptions: {
        gateway: expect.objectContaining({
          models: ['amazon/nova-lite', 'openai/gpt-5-nano', 'google/gemini-2.5-flash-lite'],
        }),
      },
    }))
  })
})
