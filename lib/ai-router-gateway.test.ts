import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const gatewayGenerate = vi.fn()
vi.mock('./ai-gateway', () => ({ aiGatewayConfigured: () => true, gatewayGenerate }))
const groqConfigured = vi.fn(() => false)
const groqAnalyzeImages = vi.fn()
vi.mock('./groq', () => ({
  groqConfigured,
  groqGenerateText: vi.fn(),
  groqAnalyzeImages,
}))
const callGemini = vi.fn()
vi.mock('./gemini', () => ({ callGemini }))
vi.mock('./telegram', () => ({ sendTelegramAdminMessage: vi.fn() }))

const { aiChatReply, aiVisionJson } = await import('./ai')

describe('AI provider routing with Gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    groqConfigured.mockReturnValue(false)
  })

  it('uses Groq first for raster vision before Gateway and Gemini', async () => {
    groqConfigured.mockReturnValue(true)
    groqAnalyzeImages.mockResolvedValue('{"valid":true}')
    const result = await aiVisionJson({
      contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }] }],
    }, 'gemini-key')
    expect(result.candidates[0].content.parts[0].text).toBe('{"valid":true}')
    expect(groqAnalyzeImages).toHaveBeenCalled()
    expect(gatewayGenerate).not.toHaveBeenCalled()
    expect(callGemini).not.toHaveBeenCalled()
  })

  it('prefers Gemini over Gateway for chat when Groq is unavailable', async () => {
    callGemini.mockResolvedValue({ candidates: [{ content: { parts: [{ text: 'Salom!' }] } }] })
    gatewayGenerate.mockResolvedValue('gateway javob')
    const result = await aiChatReply({ contents: [{ parts: [{ text: 'Salom' }] }] }, 'gemini-key')
    expect(result.candidates[0].content.parts[0].text).toBe('Salom!')
    expect(callGemini).toHaveBeenCalled()
    expect(gatewayGenerate).not.toHaveBeenCalled()
  })

  it('falls to Gateway for chat only after Groq and Gemini both fail', async () => {
    callGemini.mockRejectedValue(new Error('Gemini down'))
    gatewayGenerate.mockResolvedValue('Salom!')
    const result = await aiChatReply({ contents: [{ parts: [{ text: 'Salom' }] }] }, 'gemini-key')
    expect(result.candidates[0].content.parts[0].text).toBe('Salom!')
    expect(gatewayGenerate).toHaveBeenCalledWith(expect.anything(), 'text')
  })
})
