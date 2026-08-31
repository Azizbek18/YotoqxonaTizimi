import 'server-only'
import { callGemini } from './gemini'
import { groqAnalyzeImage, groqConfigured, groqGenerateText } from './groq'
import { sendTelegramMessage } from './telegram'

// Provider routing for every AI feature:
//   - chat assistant + free-text checks  -> Groq (free) first, Gemini fallback
//   - image / document checks (OCR)      -> Gemini first (best OCR), Groq fallback
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

// Markdown code fences slip past `response_format: json_object` on some open
// models — strip them so the caller's JSON.parse still works.
function unfence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

function splitPayload(payload: GeminiPayload) {
  const system = payload.systemInstruction?.parts?.map((p) => p.text).filter(Boolean).join('\n\n') ?? ''
  const parts = (payload.contents ?? []).flatMap((c) => c.parts ?? [])
  const image = parts.find((p) => p.inlineData)?.inlineData ?? null
  const texts = parts.filter((p) => typeof p.text === 'string').map((p) => p.text as string)
  const wantsJson = String(payload.generationConfig?.responseMimeType ?? '').includes('json')
  return { system, image, texts, wantsJson }
}

// ---- outage alert (throttled, once per warm instance per window) ----

const ALERT_COOLDOWN_MS = 30 * 60_000
let lastAlertAt = 0

export function describeAiFailure(message: string): string {
  if (/RESOURCE_EXHAUSTED|credits are depleted|quota/i.test(message)) {
    return "Gemini krediti/kvotasi tugagan — AI Studio'da (ai.studio/projects) billing to'ldirilishi kerak."
  }
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|\(40[13]\)/i.test(message)) {
    return 'AI API kaliti yaroqsiz yoki cheklangan (Vercel: GEMINI_API_KEY / GROQ_API_KEY).'
  }
  if (/is not found|not supported|\(404\)/i.test(message)) {
    return "AI modeli topilmadi — model nomi eskirgan bo'lishi mumkin (lib/gemini.ts / lib/groq.ts)."
  }
  return message.slice(0, 300)
}

async function alertOutage(where: string, error: unknown): Promise<void> {
  const now = Date.now()
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) return
  lastAlertAt = now
  const message = error instanceof Error ? error.message : String(error)
  await sendTelegramMessage(
    `⚠️ Sun'iy intellekt ishlamayapti (${where})\n\n${describeAiFailure(message)}\n\n` +
      "Talabalar hozircha AI javob o'rniga zaxira javob / qo'lda tekshiruv olishmoqda.",
  )
}

// ---- vision / OCR: Gemini primary, Groq fallback ----

export async function aiVisionJson(payload: GeminiPayload, geminiApiKey: string | undefined): Promise<GeminiResponse> {
  let geminiError: unknown = null
  if (geminiApiKey) {
    try {
      return shaped(textOf(await callGemini(payload, geminiApiKey)))
    } catch (error) {
      geminiError = error
      console.error('Gemini vision call failed, trying Groq:', error)
    }
  }

  const { system, image, texts, wantsJson } = splitPayload(payload)
  // Groq's vision models take images only — a PDF can't fall back to them.
  if (groqConfigured() && image && image.mimeType.startsWith('image/')) {
    try {
      const prompt = texts.join('\n\n') || 'Analyze the attached image.'
      const raw = await groqAnalyzeImage(system || prompt, prompt, { mimeType: image.mimeType, base64: image.data }, wantsJson)
      return shaped(unfence(raw))
    } catch (groqError) {
      console.error('Groq vision fallback failed:', groqError)
      await alertOutage('rasm tekshiruvi', geminiError ?? groqError)
      throw groqError
    }
  }

  const finalError = geminiError ?? new Error('AI rasm tekshiruvi sozlanmagan')
  await alertOutage('rasm tekshiruvi', finalError)
  throw finalError
}

// ---- chat / free text: Groq primary, Gemini fallback ----

export async function aiChatReply(payload: GeminiPayload, geminiApiKey: string | undefined): Promise<GeminiResponse> {
  const { system } = splitPayload(payload)
  const turns = (payload.contents ?? []).map((c) => {
    const speaker = c.role === 'model' ? 'Yordamchi' : 'Talaba'
    const text = (c.parts ?? []).map((p) => p.text).filter(Boolean).join(' ')
    return `${speaker}: ${text}`
  })
  const prompt = turns.join('\n')

  let groqError: unknown = null
  if (groqConfigured()) {
    try {
      return shaped(await groqGenerateText(system, prompt, false))
    } catch (error) {
      groqError = error
      console.error('Groq chat call failed, trying Gemini:', error)
    }
  }

  if (geminiApiKey) {
    try {
      return shaped(textOf(await callGemini(payload, geminiApiKey)))
    } catch (geminiError) {
      console.error('Gemini chat fallback failed:', geminiError)
      await alertOutage('chat', groqError ?? geminiError)
      throw geminiError
    }
  }

  const finalError = groqError ?? new Error('AI chat sozlanmagan')
  await alertOutage('chat', finalError)
  throw finalError
}
