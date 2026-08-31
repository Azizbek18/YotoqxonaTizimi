import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const gatewayGenerate = vi.fn()
vi.mock('./ai-gateway', () => ({ aiGatewayConfigured: () => true, gatewayGenerate }))
vi.mock('./groq', () => ({
  groqConfigured: () => false,
  groqGenerateText: vi.fn(),
  groqAnalyzeImages: vi.fn(),
}))
const callGemini = vi.fn()
vi.mock('./gemini', () => ({ callGemini }))
vi.mock('./telegram', () => ({ sendTelegramMessage: vi.fn() }))

const { aiChatReply, aiVisionJson } = await import('./ai')

describe('AI provider routing with Gateway', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses Gateway for vision before consuming Gemini quota', async () => {
    gatewayGenerate.mockResolvedValue('{"valid":true}')
    const result = await aiVisionJson({ contents: [] }, 'gemini-key')
    expect(result.candidates[0].content.parts[0].text).toBe('{"valid":true}')
    expect(gatewayGenerate).toHaveBeenCalledWith(expect.anything(), 'vision')
    expect(callGemini).not.toHaveBeenCalled()
  })

  it('uses Gateway for chat when Groq is unavailable', async () => {
    gatewayGenerate.mockResolvedValue('Salom!')
    const result = await aiChatReply({ contents: [{ parts: [{ text: 'Salom' }] }] }, 'gemini-key')
    expect(result.candidates[0].content.parts[0].text).toBe('Salom!')
    expect(gatewayGenerate).toHaveBeenCalledWith(expect.anything(), 'text')
    expect(callGemini).not.toHaveBeenCalled()
  })
})
