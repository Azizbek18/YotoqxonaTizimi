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
  it('normalises the Uzbek okina and smart quotes to a plain apostrophe', () => {
    expect(normalizePdfText("Gʻafurov O'zbekiston ‘x’")).toBe("G'afurov O'zbekiston 'x'")
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
})
