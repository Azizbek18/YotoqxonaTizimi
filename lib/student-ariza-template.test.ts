import { describe, expect, it } from 'vitest'
import {
  applicantLine,
  composeArizaBody,
  composeArizaFullText,
  isArizaRecipient,
  recipientLine,
} from './student-ariza-template'

const base = {
  kind: 'tushuntirish' as const,
  recipient: 'prorektor' as const,
  fullName: 'Aliyev Vali Akmal oʻgʻli',
  facultyLabel: 'Fizika',
  course: 3,
  ttjNumber: '12',
  room: '305',
  incidentText: 'Bugun kech qaytdim.',
  dekanName: null,
}

describe('recipientLine', () => {
  it('prorektor is the fixed UzMU line', () => {
    expect(recipientLine('prorektor', { facultyLabel: 'Fizika' })).toContain('Birinchi prorektori')
  })
  it('rektor', () => {
    expect(recipientLine('rektor', { facultyLabel: 'Fizika' })).toMatch(/rektoriga$/)
  })
  it('dekan uses the name when known, a title otherwise', () => {
    expect(recipientLine('dekan', { facultyLabel: 'Fizika', dekanName: 'Karimov B.' }))
      .toBe("Mirzo Ulug'bek nomidagi O'zbekiston Milliy universiteti Fizika fakulteti dekani Karimov B.ga")
    expect(recipientLine('dekan', { facultyLabel: 'Fizika' })).toMatch(/dekaniga$/)
  })
})

describe('isArizaRecipient', () => {
  it('guards', () => {
    expect(isArizaRecipient('dekan')).toBe(true)
    expect(isArizaRecipient('mudir')).toBe(false)
  })
})

describe('composeArizaBody', () => {
  it('tushuntirish wraps the incident with intro + apology + consent', () => {
    const body = composeArizaBody(base)
    expect(body).toContain('12-sonli talabalar turar joyining 305-xonasida istiqomat qilaman')
    expect(body).toContain('Bugun kech qaytdim.')
    expect(body).toContain('intizomiy chora ko\'rilishiga roziman')
  })
  it('ariza uses the request closing', () => {
    const body = composeArizaBody({ ...base, kind: 'ariza', incidentText: 'Xona almashtirishni so\'rayman.' })
    expect(body).toContain('Iltimosimni ijobiy hal qilishingizni so\'rayman')
    expect(body).not.toContain('intizomiy chora')
  })
  it('blank ttj / room fall back to underscores', () => {
    expect(composeArizaBody({ ...base, ttjNumber: '', room: '' })).toContain('__-sonli talabalar turar joyining __-xonasida')
  })
})

describe('composeArizaFullText', () => {
  it('assembles recipient + applicant + heading + body', () => {
    const text = composeArizaFullText(base)
    expect(text).toContain('T U S H U N T I R I S H')
    expect(text.startsWith('Mirzo Ulug')).toBe(true)
    expect(text).toContain(applicantLine(base))
  })
})
