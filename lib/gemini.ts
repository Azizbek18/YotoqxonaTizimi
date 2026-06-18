import 'server-only'

export async function callGemini(payload: unknown, apiKey: string) {
  const models = ['gemini-2.5-flash', 'gemini-flash-latest']
  let lastError: unknown = null

  for (const model of models) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    
    // 2 attempts per model
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (response.ok) {
          return await response.json()
        }

        const errText = await response.text()
        lastError = new Error(`Gemini API error (${response.status}): ${errText}`)

        // Retry on transient errors (503, 429, 500)
        if (response.status === 503 || response.status === 429 || response.status === 500) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
          continue
        }

        // Fail immediately on client errors (400, etc.)
        throw lastError

      } catch (e: unknown) {
        lastError = e
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini API so'rovini bajarib bo'lmadi")
}
