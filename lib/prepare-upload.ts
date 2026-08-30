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
    return { ok: true, file: input, changed: false }
  }

  // Already a valid raster image, small enough — leave it exactly as picked.
  if (kind && input.size <= MAX_BYTES) {
    return { ok: true, file: input, changed: false }
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
