import 'server-only'
import { sendTelegramMessage } from './telegram'

const REQUEST_TIMEOUT_MS = 15_000

// `gemini-flash-latest` is Google's rolling alias for the current Flash model,
// so the app follows model upgrades without a redeploy; `gemini-2.5-flash` is
// the pinned fallback if the alias ever resolves to something unavailable.
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash']

// Turn a raw upstream error into a short, actionable Uzbek sentence for the
// outage alert. Exported for tests.
export function describeGeminiFailure(message: string): string {
  if (/RESOURCE_EXHAUSTED|prepayment credits are depleted|credits are depleted|quota/i.test(message)) {
    return "Gemini krediti/kvotasi tugagan — AI Studio'da (ai.studio/projects) billing to'ldirilishi kerak."
  }
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|\(40[13]\)/i.test(message)) {
    return 'Gemini API kaliti yaroqsiz yoki cheklangan (Vercel: GEMINI_API_KEY).'
  }
  if (/is not found|not supported|\(404\)/i.test(message)) {
    return "Gemini modeli topilmadi — model nomi eskirgan bo'lishi mumkin (lib/gemini.ts)."
  }
  return message.slice(0, 300)
}

// A burst of failed AI calls must not flood Telegram — alert at most once per
// window. Module-level, so the throttle is per warm lambda instance; that is
// enough to keep the channel usable during an outage.
const ALERT_COOLDOWN_MS = 30 * 60_000
let lastAlertAt = 0

async function alertGeminiOutage(error: unknown): Promise<void> {
  const now = Date.now()
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) return
  lastAlertAt = now
  const message = error instanceof Error ? error.message : String(error)
  await sendTelegramMessage(
    `⚠️ Sun'iy intellekt (Gemini) ishlamayapti\n\n${describeGeminiFailure(message)}\n\n` +
      "Talabalar hozircha AI javob o'rniga zaxira javob / qo'lda tekshiruv olishmoqda.",
  )
}

async function requestGemini(payload: unknown, apiKey: string) {
  let lastError: unknown = null

  for (const model of GEMINI_MODELS) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    // 2 attempts per model
    for (let attempt = 1; attempt <= 2; attempt++) {
      let response: Response
      try {
        response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          // A hung upstream call would otherwise block the route until the
          // platform's own function timeout, with no retry/fallback ever
          // getting a chance to run.
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch (error: unknown) {
        lastError = error
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, attempt * 500))
          continue
        }
        break
      }

      if (response.ok) {
        return await response.json()
      }

      const errText = await response.text()
      lastError = new Error(`Gemini API error (${response.status}): ${errText}`)

      // A missing/deprecated model may legitimately be recovered by trying
      // the configured fallback model, but repeating the same 404 is useless.
      if (response.status === 404) break

      // Retry only transient upstream/quota errors. Other 4xx responses mean
      // the request itself is invalid and must fail immediately rather than
      // consuming quota across every model and attempt.
      if (response.status === 429 || response.status >= 500) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
          continue
        }
        break
      }

      throw lastError
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini API so'rovini bajarib bo'lmadi")
}

export async function callGemini(payload: unknown, apiKey: string) {
  try {
    return await requestGemini(payload, apiKey)
  } catch (error) {
    // Every AI feature funnels through here, so this is the one place that
    // knows the AI is down for everyone — tell an operator before students
    // silently start getting the fallback responses.
    await alertGeminiOutage(error)
    throw error
  }
}
