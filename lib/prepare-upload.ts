'use client'

/**
 * Client-side pre-flight for every user file upload — the passport photo in
 * the imtiyozli flow, the yo'llanma document, and the profile avatar.
 *
 * Two jobs:
 *
 *  1. HEIC/HEIF → JPEG. Modern iPhones and "high efficiency" Android
 *     cameras store photos as HEIC. A real Safari/Chrome form submit
 *     transcodes it to JPEG, but the in-app browsers most students use
 *     (Telegram, Instagram) upload the raw HEIC — sometimes mislabelled as
 *     `image/jpeg` — and the server's magic-byte check (lib/permit-validation)
 *     rejects it with "Fayl tarkibi e'lon qilingan formatga mos emas". The
 *     libheif decoder (heic2any, ~1.5 MB WASM) is imported on demand, only
 *     when a HEIC file is actually picked, so a normal visitor never pays
 *     for it.
 *
 *  2. Normalise everything else through a canvas re-encode, but only when
 *     the file would otherwise be rejected — a PNG screenshot renamed
 *     ".jpg", a WebP the browser labelled "image/jpeg", an 8 MP camera
 *     JPEG over the 4 MB limit. A file that is already a valid,
 *     small-enough JPEG / PNG / WebP (or any PDF) is passed straight
 *     through untouched.
 *
 * The server still does its own signature check — this only shrinks how
 * often a real, honest upload trips it.
 */

// Keep in sync with MAX_UPLOAD_SIZE_BYTES in lib/upload-limits.ts.
const MAX_BYTES = 4 * 1024 * 1024
const SNIFF_BYTES = 16

const PDF_SIG = [0x25, 0x50, 0x44, 0x46] as const // %PDF
const JPEG_SIG = [0xff, 0xd8, 0xff] as const
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47] as const
const RIFF_SIG = [0x52, 0x49, 0x46, 0x46] as const // RIFF (WebP container)

// ISO-BMFF "ftyp" brands that mean a HEIF-family still image. A real MP4
// video also starts with an `ftyp` box, so the brand — not just the tag —
// is what tells them apart.
const HEIF_BRANDS = new Set([
  'heic', 'heix', 'heim', 'heis',
  'hevc', 'hevx',
  'mif1', 'msf1', 'mif2',
])

function startsWith(bytes: Uint8Array, sig: readonly number[]) {
  return sig.every((b, i) => bytes[i] === b)
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  let out = ''
  for (let i = start; i < end && i < bytes.length; i++) out += String.fromCharCode(bytes[i])
  return out
}

/** True when the first bytes look like a HEIF-family still image. */
export function sniffHeif(head: Uint8Array): boolean {
  if (head.length < 12) return false
  if (ascii(head, 4, 8) !== 'ftyp') return false
  return HEIF_BRANDS.has(ascii(head, 8, 12).toLowerCase())
}

/** Which server-allowed format the bytes actually are, or null. */
export function sniffAllowed(head: Uint8Array): 'pdf' | 'jpeg' | 'png' | 'webp' | null {
  if (startsWith(head, PDF_SIG)) return 'pdf'
  if (startsWith(head, JPEG_SIG)) return 'jpeg'
  if (startsWith(head, PNG_SIG)) return 'png'
  if (startsWith(head, RIFF_SIG) && ascii(head, 8, 12) === 'WEBP') return 'webp'
  return null
}

export type PreparedUpload =
  | { ok: true; file: File; changed: boolean }
  | { ok: false; message: string }

export interface PrepareOptions {
  /** Whether a PDF is a valid choice here (yo'llanma / passport scan). Avatars pass `false`. */
  allowPdf?: boolean
  /** Longest edge, in px, of a re-encoded image. */
  maxDimension?: number
}

/**
 * Builds the canonical file sent to vision providers and later stored with
 * the application. Groq's vision API accepts raster images but not PDFs, so
 * rendering the first (officially single-page) referral page here keeps it
 * available as an independent fallback when the paid Gateway/Gemini paths
 * are unavailable. Using the same returned bytes for analysis and storage is
 * security-critical: the signed AI claim is bound to their SHA-256 hash.
 *
 * pdfjs is loaded only after a PDF is selected; normal photo uploads do not
 * download the renderer or its worker.
 */
export async function prepareAiAnalysisFile(input: File, maxDimension = 2200): Promise<File> {
  if (input.type !== 'application/pdf') return input

  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await input.arrayBuffer()),
  })

  let document: Awaited<typeof loadingTask.promise> | null = null
  try {
    document = await loadingTask.promise
    if (document.numPages < 1) throw new Error('PDF sahifasi topilmadi')

    const page = await document.getPage(1)
    const natural = page.getViewport({ scale: 1 })
    const scale = Math.min(3, maxDimension / Math.max(natural.width, natural.height))
    const viewport = page.getViewport({ scale: Math.max(1, scale) })
    const canvas = window.document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)

    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('PDF uchun canvas yaratilmadi')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: context, viewport }).promise

    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!jpeg) throw new Error('PDF sahifasini JPEG ga aylantirib bo‘lmadi')
    if (jpeg.size > MAX_BYTES) throw new Error('PDF sahifasi AI tekshiruvi uchun juda katta')

    const stem = input.name.replace(/\.[^.]+$/, '').trim() || 'yollanma'
    return new File([jpeg], `${stem}.jpg`, { type: 'image/jpeg' })
  } finally {
    await loadingTask.destroy()
  }
}

const DETECTED_FILE_META = {
  pdf: { type: 'application/pdf', extension: 'pdf' },
  jpeg: { type: 'image/jpeg', extension: 'jpg' },
  png: { type: 'image/png', extension: 'png' },
  webp: { type: 'image/webp', extension: 'webp' },
} as const

async function materializeCanonicalFile(input: File, kind: keyof typeof DETECTED_FILE_META): Promise<PreparedUpload> {
  const meta = DETECTED_FILE_META[kind]
  const metadataChanged = input.type.toLowerCase() !== meta.type
  const stem = input.name.replace(/\.[^.]+$/, '').trim() || 'hujjat'
  const fileName = metadataChanged ? `${stem}.${meta.extension}` : input.name

  // Read the entire content while the native file picker still owns the
  // selected URI. Some Android in-app browsers revoke their temporary
  // content-provider handle after the <input> is unmounted between wizard
  // steps. Keeping the original File then makes fetch(FormData) fail before
  // a request reaches the server. A memory-backed File is independent of
  // that temporary handle and is safe because uploads are capped at 4 MB.
  const bytes = await input.arrayBuffer()
  return {
    ok: true,
    file: new File([bytes], fileName, {
      type: meta.type,
      lastModified: input.lastModified,
    }),
    changed: metadataChanged,
  }
}

export async function prepareUploadFile(
  input: File,
  { allowPdf = true, maxDimension = 2200 }: PrepareOptions = {},
): Promise<PreparedUpload> {
  let head: Uint8Array
  try {
    head = new Uint8Array(await input.slice(0, SNIFF_BYTES).arrayBuffer())
  } catch {
    return { ok: false, message: "Faylni o'qib bo'lmadi. Boshqa rasm tanlang." }
  }

  const kind = sniffAllowed(head)
  const isHeif = kind === null && sniffHeif(head)

  if (kind === 'pdf') {
    if (!allowPdf) return { ok: false, message: 'Bu yerga faqat rasm yuklang (JPG yoki PNG).' }
    if (input.size > MAX_BYTES) {
      return { ok: false, message: "PDF hajmi 4 MB dan katta. Uni rasm (JPG) ko'rinishida yuklang." }
    }
    try {
      return await materializeCanonicalFile(input, kind)
    } catch {
      return { ok: false, message: "Faylni to'liq o'qib bo'lmadi. Uni telefon xotirasiga saqlab, qayta tanlang." }
    }
  }

  // Already a valid raster image, small enough — preserve its bytes, but
  // detach them from the Android file picker's temporary content URI.
  if (kind && input.size <= MAX_BYTES) {
    try {
      return await materializeCanonicalFile(input, kind)
    } catch {
      return { ok: false, message: "Rasmni to'liq o'qib bo'lmadi. Uni telefon xotirasiga saqlab, qayta tanlang." }
    }
  }

  // Everything past here needs a fresh JPEG: HEIF, oversized, mislabelled,
  // or bytes we don't recognise at all.
  try {
    const source: Blob = isHeif ? await heifToJpegBlob(input) : input
    let jpeg = await reencodeJpeg(source, maxDimension, 0.9)
    if (jpeg.size > MAX_BYTES) jpeg = await reencodeJpeg(source, 1600, 0.82)
    if (jpeg.size > MAX_BYTES) jpeg = await reencodeJpeg(source, 1200, 0.7)
    if (jpeg.size > MAX_BYTES) {
      return { ok: false, message: 'Rasm hajmi juda katta. Kichikroq yoki pastroq sifatli rasm tanlang.' }
    }
    const stem = input.name.replace(/\.[^.]+$/, '').trim() || 'rasm'
    return { ok: true, file: new File([jpeg], `${stem}.jpg`, { type: 'image/jpeg' }), changed: true }
  } catch {
    return {
      ok: false,
      message: isHeif
        ? "iPhone rasmini (HEIC) o'girib bo'lmadi. Telefon sozlamalari → Kamera → Formatlar → “Eng mos” ni tanlab, rasmni qayta oling yoki skrinshot yuklang."
        : "Faylni o'qib bo'lmadi. Pasport rasmini JPG yoki PNG ko'rinishida tanlang.",
    }
  }
}

async function heifToJpegBlob(file: File): Promise<Blob> {
  const mod = await import('heic2any')
  const heic2any = (mod.default ?? mod) as (opts: {
    blob: Blob
    toType?: string
    quality?: number
  }) => Promise<Blob | Blob[]>
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  return Array.isArray(out) ? out[0] : out
}

async function reencodeJpeg(source: Blob, maxDimension: number, quality: number): Promise<Blob> {
  const { width, height, draw, cleanup } = await decodeImage(source)
  try {
    const scale = Math.min(1, maxDimension / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    ctx.drawImage(draw, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error('canvas.toBlob returned null')
    return blob
  } finally {
    cleanup()
  }
}

interface DecodedImage {
  width: number
  height: number
  draw: CanvasImageSource
  cleanup: () => void
}

async function decodeImage(source: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' } as ImageBitmapOptions)
      return { width: bitmap.width, height: bitmap.height, draw: bitmap, cleanup: () => bitmap.close() }
    } catch {
      try {
        const bitmap = await createImageBitmap(source)
        return { width: bitmap.width, height: bitmap.height, draw: bitmap, cleanup: () => bitmap.close() }
      } catch {
        /* fall through to the <img> path */
      }
    }
  }

  const url = URL.createObjectURL(source)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image decode failed'))
      img.src = url
    })
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: img,
      cleanup: () => URL.revokeObjectURL(url),
    }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}
