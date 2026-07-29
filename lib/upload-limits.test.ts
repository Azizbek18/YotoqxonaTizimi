import { describe, expect, it } from 'vitest'
import { MAX_MULTIPART_REQUEST_BYTES, readMultipartForm } from './upload-limits'

describe('readMultipartForm', () => {
  it('rejects a non-multipart request with 415', async () => {
    const request = new Request('https://example.test/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })

    await expect(readMultipartForm(request)).rejects.toMatchObject({ status: 415 })
  })

  it('rejects an oversized request before parsing the body', async () => {
    const request = new Request('https://example.test/upload', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=test',
        'content-length': String(MAX_MULTIPART_REQUEST_BYTES + 1),
      },
      body: '--test--\r\n',
    })

    await expect(readMultipartForm(request)).rejects.toMatchObject({ status: 413 })
  })

  it('parses a valid multipart form', async () => {
    const source = new FormData()
    source.set('name', 'student')
    const request = new Request('https://example.test/upload', {
      method: 'POST',
      body: source,
    })

    const parsed = await readMultipartForm(request)
    expect(parsed.get('name')).toBe('student')
  })
})
