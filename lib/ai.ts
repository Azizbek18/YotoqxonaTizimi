import 'server-only'
import { callGemini } from './gemini'
import { groqAnalyzeImages, groqConfigured, groqGenerateText } from './groq'
import { sendTelegramAdminMessage } from './telegram'
import { aiGatewayConfigured, gatewayGenerate } from './ai-gateway'

// Provider routing for the AI features, cheapest-reliable first:
//   1. Groq — free (chat: production models; vision: preview Qwen, low daily
//      token cap, images only)
//   2. Gemini — paid prepaid credit, reliable OCR
//   3. AI Gateway — only when AI_GATEWAY_API_KEY is set (i.e. it has credit)
// Both helpers take the Gemini-shaped request the routes already build and
// return a Gemini-shaped response, so callers only swap the function name.

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } }
type GeminiContent = { role?: string; parts?: GeminiPart[] }
type GeminiPayload = {
  contents?: GeminiContent[]
  systemInstruction?: { parts?: { text?: string }[] }
  generationConfig?: { responseMimeType?: string }
}
type GeminiResponse = { candidates: [{ content: { parts: [{ text: string }] } }] }

function shaped(text: string): GeminiResponse {
  return { candidates: [{ content: { parts: [{ text }] } }] }
}

function textOf(res: unknown): string {
  const r = res as GeminiResponse
  return r?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ---- outage alert (throttled, once per warm instance per window) ----

const ALERT_COOLDOWN_MS = 30 * 60_000
let lastAlertAt = 0

export function describeAiFailure(message: string): string {
  if (/RESOURCE_EXHAUSTED|credits are depleted|quota|Payment Required|\(402\)/i.test(message)) {
    return "AI krediti/kvotasi tugagan — Vercel AI Gateway yoki Google AI Studio balansini tekshiring."
  }
  if (/rate limit|too many requests|tokens per minute|requests per minute|\(429\)/i.test(message)) {
    return "AI provayderining vaqtinchalik so‘rov limiti tugagan. Birozdan keyin qayta uriniladi."
  }
  if (/dunning|billing account|account.*(suspend|disabled)|payment/i.test(message)) {
    return "Gemini loyihasining to'lovi muammoli (Google Cloud billing) — hisobni to'lang / to'lov usulini tekshiring."
  }
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|\(40[13]\)/i.test(message)) {
    return 'AI API kaliti yaroqsiz yoki cheklangan (Vercel: GEMINI_API_KEY / GROQ_API_KEY).'
  }
  if (/is not found|not supported|does not exist|\(404\)/i.test(message)) {
    return "AI modeli topilmadi — model nomi eskirgan bo'lishi mumkin (lib/gemini.ts / lib/groq.ts)."
  }
  return "AI provayderida vaqtinchalik texnik xatolik yuz berdi. Tafsilotlar server jurnalida saqlandi."
}

export function aiVisionConfigured() {
  return groqConfigured() || aiGatewayConfigured() || Boolean(process.env.GEMINI_API_KEY)
}

export function aiChatConfigured() {
  return groqConfigured() || aiGatewayConfigured() || Boolean(process.env.GEMINI_API_KEY)
}

async function alertOutage(where: string, error: unknown): Promise<void> {
  const now = Date.now()
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) return
  lastAlertAt = now
  const message = error instanceof Error ? error.message : String(error)
  await sendTelegramAdminMessage(
    `⚠️ Sun'iy intellekt ishlamayapti (${where})\n\n${describeAiFailure(message)}\n\n` +
      "Talaba arizalari/cheklari to'xtatilmayapti — ular \"AI tekshirmagan\" belgisi bilan qo'lda ko'rib chiqishga o'tkazilmoqda. Provayder tiklangach belgisiz davom etadi.",
  )
}

// ---- vision / OCR: Groq (images) → Gemini → AI Gateway ----

export async function aiVisionJson(payload: GeminiPayload, geminiApiKey: string | undefined): Promise<GeminiResponse> {
  const system = payload.systemInstruction?.parts?.map((p) => p.text).filter(Boolean).join('\n\n') ?? ''
  const prompt = (payload.contents ?? [])
    .flatMap((content) => content.parts ?? [])
    .map((part) => part.text)
    .filter((text): text is string => Boolean(text))
    .join('\n\n')
  const files = (payload.contents ?? [])
    .flatMap((content) => content.parts ?? [])
    .map((part) => part.inlineData)
    .filter((file): file is NonNullable<GeminiPart['inlineData']> => Boolean(file))
  const images = files.filter((file) => file.mimeType.startsWith('image/'))
  const onlyImages = images.length > 0 && images.length === files.length
  const wantsJson = payload.generationConfig?.responseMimeType === 'application/json'

  let providerError: unknown = null

  // 1. Groq — free, images only. Most student referrals reach this function
  // as raster images (PDFs are rendered client-side). Preview Qwen models
  // with a low daily token cap, so falling through here is routine.
  if (groqConfigured() && onlyImages) {
    try {
      return shaped(await groqAnalyzeImages(system, prompt, images, wantsJson))
    } catch (error) {
      providerError = error
      console.error('Groq vision call failed, trying Gemini:', error)
    }
  }

  // 2. Gemini — paid prepaid credit, reliable OCR.
  if (geminiApiKey) {
    try {
      return shaped(textOf(await callGemini(payload, geminiApiKey)))
    } catch (error) {
      providerError = providerError ?? error
      console.error('Gemini vision fallback failed, trying AI Gateway:', error)
    }
  }

  // 3. AI Gateway — only reached when it actually has credit.
  if (aiGatewayConfigured()) {
    try {
      return shaped(await gatewayGenerate(payload, 'vision'))
    } catch (error) {
      providerError = providerError ?? error
      console.error('AI Gateway vision fallback failed:', error)
    }
  }

  const finalError = providerError ?? new Error('Rasm tahlili uchun AI provider sozlanmagan')
  await alertOutage('rasm tekshiruvi', finalError)
  throw finalError
}

// ---- chat / free text: Groq → Gemini → AI Gateway ----

export async function aiChatReply(payload: GeminiPayload, geminiApiKey: string | undefined): Promise<GeminiResponse> {
  const system = payload.systemInstruction?.parts?.map((p) => p.text).filter(Boolean).join('\n\n') ?? ''
  const prompt = (payload.contents ?? [])
    .map((c) => {
      const speaker = c.role === 'model' ? 'Yordamchi' : 'Talaba'
      const text = (c.parts ?? []).map((p) => p.text).filter(Boolean).join(' ')
      return `${speaker}: ${text}`
    })
    .join('\n')

  let providerError: unknown = null

  if (groqConfigured()) {
    try {
      return shaped(await groqGenerateText(system, prompt, false))
    } catch (error) {
      providerError = error
      console.error('Groq chat call failed, trying Gemini:', error)
    }
  }

  if (geminiApiKey) {
    try {
      return shaped(textOf(await callGemini(payload, geminiApiKey)))
    } catch (error) {
      providerError = providerError ?? error
      console.error('Gemini chat fallback failed, trying AI Gateway:', error)
    }
  }

  if (aiGatewayConfigured()) {
    try {
      return shaped(await gatewayGenerate(payload, 'text'))
    } catch (error) {
      providerError = providerError ?? error
      console.error('AI Gateway chat fallback failed:', error)
    }
  }

  const finalError = providerError ?? new Error('AI chat sozlanmagan')
  await alertOutage('chat', finalError)
  throw finalError
}
