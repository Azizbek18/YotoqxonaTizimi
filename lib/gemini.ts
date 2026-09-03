import 'server-only'

const REQUEST_TIMEOUT_MS = 15_000

// `gemini-flash-latest` is Google's rolling alias for the current Flash model,
// so the app follows model upgrades without a redeploy; the second entry is a
// pinned fallback for when the alias ever resolves to something unavailable.
// `gemini-2.5-flash` was retired by Google ("no longer available to new users",
// 404 with a pointer to gemini-3.6-flash) — 2026-09-03.
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash']

export async function callGemini(payload: unknown, apiKey: string) {
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
