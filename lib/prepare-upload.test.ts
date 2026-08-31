import { describe, expect, it } from 'vitest'
import { prepareUploadFile, sniffAllowed, sniffHeif } from './prepare-upload'

const bytes = (...values: number[]) => new Uint8Array(values)
const withFtyp = (brand: string) =>
  bytes(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, ...[...brand].map((c) => c.charCodeAt(0)))

describe('sniffAllowed', () => {
  it('recognises the four server-allowed formats by their magic bytes', () => {
    expect(sniffAllowed(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('pdf')
    expect(sniffAllowed(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg')
    expect(sniffAllowed(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a))).toBe('png')
    expect(
      sniffAllowed(bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50)),
    ).toBe('webp')
  })

  it('rejects a RIFF container that is not WebP (e.g. a WAV)', () => {
    expect(
      sniffAllowed(bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45)),
    ).toBeNull()
  })

  it('returns null for HEIC / unknown bytes', () => {
    expect(sniffAllowed(withFtyp('heic'))).toBeNull()
    expect(sniffAllowed(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull()
  })
})

describe('sniffHeif', () => {
  it('flags the HEIF-family still-image brands', () => {
    for (const brand of ['heic', 'heix', 'mif1', 'msf1', 'hevc']) {
      expect(sniffHeif(withFtyp(brand))).toBe(true)
    }
  })

  it('is case-insensitive on the brand', () => {
    expect(sniffHeif(withFtyp('HEIC'))).toBe(true)
  })

  it('does not flag an MP4 video (ftyp with an isom/mp4 brand)', () => {
    expect(sniffHeif(withFtyp('isom'))).toBe(false)
    expect(sniffHeif(withFtyp('mp42'))).toBe(false)
  })

  it('does not flag a plain JPEG or a short buffer', () => {
    expect(sniffHeif(bytes(0xff, 0xd8, 0xff))).toBe(false)
    expect(sniffHeif(bytes(0x00, 0x00))).toBe(false)
  })
})

describe('prepareUploadFile', () => {
  it('materializes a valid mobile image into an independent memory-backed File', async () => {
    const originalBytes = bytes(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
    const input = new File([originalBytes], 'yollanma.jpg', { type: 'image/jpeg' })

    const result = await prepareUploadFile(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.changed).toBe(false)
    expect(result.file).not.toBe(input)
    expect(new Uint8Array(await result.file.arrayBuffer())).toEqual(originalBytes)
  })

  it('repairs a valid JPEG carrying a generic mobile-browser MIME type', async () => {
    const input = new File(
      [bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)],
      'camera-upload.bin',
      { type: 'application/octet-stream' },
    )

    const result = await prepareUploadFile(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.changed).toBe(true)
    expect(result.file.type).toBe('image/jpeg')
    expect(result.file.name).toBe('camera-upload.jpg')
  })

  it('repairs a PDF whose browser omitted the MIME type', async () => {
    const input = new File(
      [bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0, 0, 0, 0, 0, 0, 0, 0)],
      'yollanma',
      { type: '' },
    )

    const result = await prepareUploadFile(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.changed).toBe(true)
    expect(result.file.type).toBe('application/pdf')
    expect(result.file.name).toBe('yollanma.pdf')
  })
})
