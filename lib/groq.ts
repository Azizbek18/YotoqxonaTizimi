import 'server-only'

// Groq (OpenAI-compatible) — the free, fast lane for chat and image checks.
// Current Qwen vision models accept images (including OCR), but not PDF files.
// PDF checks therefore stay on AI Gateway / Gemini.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 15_000

// Model ids can be overridden per-deploy without a release; Groq rotates its
// catalogue faster than this repo ships. Tried in order.
const TEXT_MODELS = (process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-20b,openai/gpt-oss-120b')
  .split(',').map((s) => s.trim()).filter(Boolean)
const VISION_MODELS = (process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b,qwen/qwen3.8-27b')
  .split(',').map((s) => s.trim()).filter(Boolean)

type GroqContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export function groqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY)
}

async function groqCompletion(
  models: string[],
  messages: Array<{ role: 'system'; content: string } | { role: 'user'; content: string | GroqContentPart[] }>,
  json: boolean,
): Promise<string> {
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
            messages,
            temperature: json ? 0 : 0.2,
            max_completion_tokens: 2048,
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
      // Invalid request/model: try the next configured model. Capacity errors
      // receive one short retry before falling through.
      if (response.status === 404 || response.status === 400) break
      if (response.status === 429 || response.status >= 500) {
        if (attempt < 2) { await new Promise((r) => setTimeout(r, attempt * 1000)); continue }
        break
      }
      throw lastError
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Groq so'rovini bajarib bo'lmadi")
}

export async function groqGenerateText(system: string, prompt: string, json = false): Promise<string> {
  return groqCompletion(TEXT_MODELS, [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ], json)
}

export async function groqAnalyzeImages(
  system: string,
  prompt: string,
  images: Array<{ mimeType: string; data: string }>,
  json = true,
): Promise<string> {
  if (!images.length) throw new Error('Groq vision uchun rasm berilmagan')
  if (images.some((image) => !image.mimeType.startsWith('image/'))) {
    throw new Error('Groq vision faqat rasm fayllarini qabul qiladi')
  }

  const content: GroqContentPart[] = [
    { type: 'text', text: prompt },
    ...images.map((image): GroqContentPart => ({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.data}` },
    })),
  ]
  return groqCompletion(VISION_MODELS, [
    { role: 'system', content: system },
    { role: 'user', content },
  ], json)
}
