import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../server/http/api-error'
import { parseStudentApplication } from './validation'

describe('parseStudentApplication', () => {
  it('forces chat messages to submitted and trims fields', () => {
    expect(parseStudentApplication({
      type: 'chat', title: ' talaba ', reason: ' salom ', text: ' salom ', status: 'draft',
    })).toMatchObject({
      type: 'chat', title: 'talaba', reason: 'salom', text: 'salom', status: 'submitted', level: 'info',
    })
  })

  it('rejects unknown types', () => {
    expect(() => parseStudentApplication({ type: 'admin', title: 'x', text: 'x' }))
      .toThrow(ApiError)
  })

  it('rejects missing required text', () => {
    expect(() => parseStudentApplication({ type: 'ariza', title: 'x', text: '   ' }))
      .toThrow('Majburiy maydonlar')
  })
})
