import 'server-only'
import { ApiError } from '@/server/http/api-error'

// Vercel Functions reject request bodies above 4.5 MB before Route Handlers
// run. A 4 MiB file leaves space for multipart boundaries and text fields.
export const MAX_UPLOAD_SIZE_MB = 4
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
export const MAX_MULTIPART_REQUEST_BYTES = 4_400_000

export async function readMultipartForm(request: Request) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('multipart/form-data;')) {
    throw new ApiError(415, 'multipart/form-data so‘rovi talab qilinadi')
  }

  const rawLength = request.headers.get('content-length')
  if (rawLength) {
    const contentLength = Number(rawLength)
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new ApiError(400, 'Content-Length noto‘g‘ri')
    }
    if (contentLength > MAX_MULTIPART_REQUEST_BYTES) {
      throw new ApiError(413, `So‘rov hajmi ${MAX_UPLOAD_SIZE_MB} MB chegarasidan oshdi`)
    }
  }

  try {
    return await request.formData()
  } catch {
    throw new ApiError(400, 'Multipart so‘rovini o‘qib bo‘lmadi')
  }
}
