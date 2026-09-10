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
const sendTelegramAdminMessage = vi.fn()
vi.mock('./telegram', () => ({ sendTelegramAdminMessage }))

// In-memory stand-in for the security_audit_logs throttle row.
let outageAlertRows: unknown[] = []
vi.mock('./server-supabase', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({ limit: async () => ({ data: outageAlertRows, error: null }) }),
        }),
      }),
      insert: async (row: unknown) => { outageAlertRows.push(row); return { error: null } },
    }),
  }),
}))

const { aiChatReply, aiVisionJson } = await import('./ai')

describe('AI provider routing with Gateway', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    groqConfigured.mockReturnValue(false)
    outageAlertRows = []
  })

  it('uses the funded Gateway before Groq and Gemini for vision', async () => {
    groqConfigured.mockReturnValue(true)
    gatewayGenerate.mockResolvedValue('{"valid":true}')
    const result = await aiVisionJson({
      contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }] }],
    }, 'gemini-key')
    expect(result.candidates[0].content.parts[0].text).toBe('{"valid":true}')
    expect(groqAnalyzeImages).not.toHaveBeenCalled()
    expect(gatewayGenerate).toHaveBeenCalledWith(expect.anything(), 'vision')
    expect(callGemini).not.toHaveBeenCalled()
  })

  it('uses Groq once Gateway fails, without calling Gateway again', async () => {
    groqConfigured.mockReturnValue(true)
    gatewayGenerate.mockRejectedValue(new Error('Delay was aborted'))
    groqAnalyzeImages.mockResolvedValue('{"valid":true}')
    const result = await aiVisionJson({ contents: [{ parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] }] }, 'k')
    expect(result.candidates[0].content.parts[0].text).toBe('{"valid":true}')
    expect(gatewayGenerate).toHaveBeenCalledTimes(1)
    expect(callGemini).not.toHaveBeenCalled()
  })

  it('separates Gateway cancellation from depleted Gemini credits in alerts', async () => {
    gatewayGenerate.mockRejectedValue(new Error('Delay was aborted'))
    callGemini.mockRejectedValue(new Error('Your prepayment credits are depleted'))
    await expect(aiVisionJson({ contents: [] }, 'k')).rejects.toThrow()
    const alert = sendTelegramAdminMessage.mock.calls[0][0] as string
    expect(alert).toMatch(/AI Gateway: So‘rov vaqt/)
    expect(alert).toMatch(/Gemini: Ushbu provayder krediti tugagan/)
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

  it('reports every attempted provider when all chat providers fail', async () => {
    callGemini.mockRejectedValue(new Error('Gemini quota'))
    gatewayGenerate.mockRejectedValue(new Error('Gateway billing'))

    await expect(
      aiChatReply({ contents: [{ parts: [{ text: 'Salom' }] }] }, 'gemini-key'),
    ).rejects.toThrow(/Gemini: Gemini quota.*AI Gateway: Gateway billing/)
  })

  it('a full outage records a throttle row and does not re-alert while it is fresh', async () => {
    callGemini.mockRejectedValue(new Error('Gemini quota'))
    gatewayGenerate.mockRejectedValue(new Error('Gateway billing'))

    // Pre-seed the shared throttle row: another instance already alerted.
    outageAlertRows = [{ event_type: 'ai.outage_alert' }]
    await expect(
      aiVisionJson({ contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }] }] }, 'k'),
    ).rejects.toThrow()
    expect(sendTelegramAdminMessage).not.toHaveBeenCalled()
  })
})
