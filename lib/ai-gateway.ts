import 'server-only'

import { generateText, type FilePart, type ImagePart, type ModelMessage, type TextPart } from 'ai'

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } }
type GeminiContent = { role?: string; parts?: GeminiPart[] }
export type GatewayCompatiblePayload = {
  contents?: GeminiContent[]
  systemInstruction?: { parts?: { text?: string }[] }
  generationConfig?: { responseMimeType?: string }
}

const DEFAULT_TEXT_MODEL = 'alibaba/qwen3.7-flash'
const DEFAULT_TEXT_FALLBACKS = ['amazon/nova-micro', 'openai/gpt-oss-20b']
const DEFAULT_VISION_MODEL = 'alibaba/qwen3.7-flash'
const DEFAULT_VISION_FALLBACKS = ['amazon/nova-lite', 'openai/gpt-5-nano', 'google/gemini-2.5-flash-lite']

function modelList(value: string | undefined, fallback: string[]) {
  const parsed = (value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
  return parsed.length ? parsed : fallback
}

export function aiGatewayConfigured() {
  // Requires an explicit key. Every Vercel deployment also carries
  // VERCEL_OIDC_TOKEN / VERCEL='1', so keying off those made the Gateway
  // "configured" even with a zero-credit free-tier account — each vision
  // request then burned a 25s timeout plus the AI SDK's 3 retries hitting
  // an instant 429 before falling through to the next provider. Set
  // AI_GATEWAY_API_KEY only once the Gateway actually has credit.
  return Boolean(process.env.AI_GATEWAY_API_KEY)
}

function systemText(payload: GatewayCompatiblePayload) {
  return payload.systemInstruction?.parts?.map((part) => part.text).filter(Boolean).join('\n\n') ?? ''
}

function toMessages(payload: GatewayCompatiblePayload): ModelMessage[] {
  return (payload.contents ?? []).map((content) => {
    const role = content.role === 'model' ? 'assistant' : 'user'
    const parts = content.parts ?? []
    if (role === 'assistant') {
      return { role, content: parts.map((part) => part.text ?? '').filter(Boolean).join('\n') }
    }

    const userParts: Array<TextPart | ImagePart | FilePart> = []
    for (const part of parts) {
      if (typeof part.text === 'string' && part.text) {
        userParts.push({ type: 'text', text: part.text })
        continue
      }
      if (part.inlineData) {
        const bytes = Buffer.from(part.inlineData.data, 'base64')
        if (part.inlineData.mimeType.startsWith('image/')) {
          userParts.push({ type: 'image', image: bytes, mediaType: part.inlineData.mimeType })
        } else {
          userParts.push({ type: 'file', data: bytes, mediaType: part.inlineData.mimeType })
        }
      }
    }
    return {
      role,
      content: userParts,
    }
  })
}

function unfenceJson(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

export async function gatewayGenerate(payload: GatewayCompatiblePayload, mode: 'text' | 'vision') {
  if (!aiGatewayConfigured()) throw new Error('AI Gateway sozlanmagan')

  const primary = mode === 'vision'
    ? (process.env.AI_GATEWAY_VISION_MODEL || DEFAULT_VISION_MODEL)
    : (process.env.AI_GATEWAY_TEXT_MODEL || DEFAULT_TEXT_MODEL)
  const fallbacks = mode === 'vision'
    ? modelList(process.env.AI_GATEWAY_VISION_FALLBACKS, DEFAULT_VISION_FALLBACKS)
    : modelList(process.env.AI_GATEWAY_TEXT_FALLBACKS, DEFAULT_TEXT_FALLBACKS)

  const result = await generateText({
    model: primary,
    system: systemText(payload),
    messages: toMessages(payload),
    temperature: mode === 'vision' ? 0 : 0.2,
    maxOutputTokens: mode === 'vision' ? 2048 : 1200,
    abortSignal: AbortSignal.timeout(25_000),
    providerOptions: {
      gateway: {
        models: fallbacks,
        tags: [`feature:${mode}`, 'app:yotoqxona'],
      },
    },
  })

  if (!result.text.trim()) throw new Error('AI Gateway bo‘sh javob qaytardi')
  return payload.generationConfig?.responseMimeType?.includes('json')
    ? unfenceJson(result.text)
    : result.text
}
