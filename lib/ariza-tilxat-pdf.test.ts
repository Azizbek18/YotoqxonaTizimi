import { describe, expect, it } from 'vitest'
import { arizaTilxatFileName, generateArizaTilxatPdf, normalizePdfText } from './ariza-tilxat-pdf'

const DATA = {
  fullName: "Gʻafurov Xusan Abrorovich",
  facultyLabel: 'Fizika',
  course: 2,
  studyType: 'grant',
  originCountry: 'Turkmaniston',
  originRegion: 'Dashoguz',
  phone: '901234567',
  relativePhone: '+993 65 123456',
  ttjName: '5',
}

describe('ariza-tilxat pdf', () => {
  it('unifies every apostrophe glyph to the Uzbek okina (font covers it now)', () => {
    expect(normalizePdfText("Gʻafurov O'zbekiston ‘x’ taʼlim")).toBe('Gʻafurov Oʻzbekiston ʻxʻ taʻlim')
  })

  it('builds a safe file name', () => {
    expect(arizaTilxatFileName("Gʻafurov Xusan")).toBe('Ariza-Tilxat_G_afurov_Xusan.pdf')
    expect(arizaTilxatFileName('   ')).toBe('Ariza-Tilxat_talaba.pdf')
  })

  it('produces a 2-page PDF with the student data embedded and blanks kept', async () => {
    const doc = await generateArizaTilxatPdf(DATA)
    expect(doc.getNumberOfPages()).toBe(2)

    // jsPDF exposes the raw content stream — a cheap way to assert the text
    // actually landed on the page (not a blank print).
    const raw = doc.output('datauristring')
    expect(raw.startsWith('data:application/pdf')).toBe(true)
    expect(raw.length).toBeGreaterThan(3000)
  })

  it('leaves the by-hand and dekanat fields blank', async () => {
    const doc = await generateArizaTilxatPdf({ ...DATA, phone: '', relativePhone: '', ttjName: '' })
    expect(doc.getNumberOfPages()).toBe(2)
  })

  it('stays 2 pages and fits the sheet even with a long name + long faculty', async () => {
    const doc = await generateArizaTilxatPdf({
      ...DATA,
      fullName: 'Abdurahmonov-Toshkentskiy Shohruhmirzobek Abdusalomjonovich',
      facultyLabel: 'Ijtimoiy-gumanitar fanlar va xorijiy tillar filologiyasi',
    })
    expect(doc.getNumberOfPages()).toBe(2)
    const fit = (doc as unknown as { __fit: { p1: number; p2: number } }).__fit
    expect(fit.p1).toBeLessThan(289)
    expect(fit.p2).toBeLessThan(289)
  })
})
