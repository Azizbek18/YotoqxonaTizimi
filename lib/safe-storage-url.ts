import 'server-only'

export function assertSafeReceiptUrl(value: unknown, studentId: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base || typeof value !== 'string') throw new Error('Chek manzili noto‘g‘ri')

  const target = new URL(value)
  const allowed = new URL(base)
  const requiredPrefix = `/storage/v1/object/public/receipts/${studentId}/`
  if (target.protocol !== 'https:' || target.origin !== allowed.origin || !target.pathname.startsWith(requiredPrefix)) {
    throw new Error('Chek manzili ruxsat etilgan storage hududiga tegishli emas')
  }
  if (target.username || target.password || target.search || target.hash) {
    throw new Error('Chek manzilida ruxsat etilmagan qismlar mavjud')
  }
  return target.toString()
}

export async function fetchReceipt(url: string) {
  const response = await fetch(url, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Chek faylini yuklab bo‘lmadi (${response.status})`)
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > 8 * 1024 * 1024) throw new Error('Chek fayli juda katta')
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > 8 * 1024 * 1024) throw new Error('Chek fayli juda katta')
  return { buffer, mimeType: response.headers.get('content-type') || 'application/octet-stream' }
}
