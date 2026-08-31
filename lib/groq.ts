import 'server-only'

// Groq (OpenAI-compatible) — the free, fast lane. Used as the primary
// provider for the chat assistant and as the fallback for the vision
// checks when Gemini is unavailable. https://console.groq.com/docs
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 15_000

// Model ids can be overridden per-deploy without a release; Groq rotates its
// catalogue faster than this repo ships. The lists are tried in order.
const TEXT_MODELS = (process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-120b,llama-3.3-70b-versatile')
  .split(',').map((s) => s.trim()).filter(Boolean)
const VISION_MODELS = (process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct,meta-llama/llama-4-maverick-17b-128e-instruct')
  .split(',').map((s) => s.trim()).filter(Boolean)

export function groqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY)
}

type UserContent = string | Array<
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
>

async function callGroq(models: string[], system: string, user: UserContent, json: boolean): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  let lastError: unknown = null
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let response: Response
      try {
        response = await fetch(GROQ_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature: 0.2,
            ...(json ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch (error) {
        lastError = error
        if (attempt < 2) { await new Promise((r) => setTimeout(r, attempt * 500)); continue }
        break
      }

      if (response.ok) {
        const data = await response.json()
        const text = data?.choices?.[0]?.message?.content
        if (typeof text === 'string' && text.trim()) return text
        lastError = new Error('Groq returned an empty completion')
        break
      }

      const errText = await response.text()
      lastError = new Error(`Groq API error (${response.status}): ${errText.slice(0, 500)}`)
      if (response.status === 404 || response.status === 400) break // bad model / request — try the next model
      if (response.status === 429 || response.status >= 500) {
        if (attempt < 2) { await new Promise((r) => setTimeout(r, attempt * 1000)); continue }
        break
      }
      throw lastError
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Groq so\'rovini bajarib bo\'lmadi')
}

export function groqGenerateText(system: string, prompt: string, json = false): Promise<string> {
  return callGroq(TEXT_MODELS, system, prompt, json)
}

export function groqAnalyzeImage(
  system: string,
  prompt: string,
  image: { mimeType: string; base64: string },
  json = true,
): Promise<string> {
  return callGroq(VISION_MODELS, system, [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
  ], json)
}
