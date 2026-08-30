// The filled Ariza + Tilxat as a real, text-based PDF (jsPDF, Times) — not
// a browser print. window.print() produced blank pages on many phones; this
// renders the same UzMU template with the applicant's data everywhere and
// only the by-hand fields (signatures, date, and the dekanat's "Ariza №" /
// room boxes) left blank.
//
// Kept in sync with components/documents/ArizaTilxatDocument.tsx (the
// on-screen preview) — same wording, same blanks.

import type { ArizaTilxatData } from '@/components/documents/ArizaTilxatDocument'

const UNIVERSITY_HEADER =
  "Mirzo Ulug'bek nomidagi O'zbekiston Milliy universiteti Birinchi prorektori — Yoshlar masalalari va ma'naviy-ma'rifiy ishlar bo'yicha prorektor T.N.Xojiyevga"

const TILXAT_RULES = [
  "Universitet Kengashining 2021-yil 20-apreldagi 8-sonli yig'ilishida tasdiqlangan O'zMU \"Ichki tartib qoidalari\", \"Odob-ahloq qoidalari\" hamda 2019 yil 2 dekabrdagi universitet rektorining 01-989-sonli buyrug'i bilan tasdiqlangan \"Talabalar turar joylari to'g'risida\"gi Nizom, \"Talabalar turar joylari Ichki tartib qoidalari\" talablariga shuningdek, universitet bilan tuzilgan turar joyi bo'yicha shartnoma qoidalariga qat'iy rioya qilish;",
  "navbatchilik jadvaliga binoan yashash xonalarida, qavatlarda, umumiy foydalanish joylari (hojatxona, yuvinish xonasi, oshxona va boshqa joylar)da navbatchilik qilish;",
  "umumiy foydalanish joylari, yashash xonalari hamda dam olish joylarida namunali tozalikni tashkil etish, undagi jihozlardan to'g'ri va unumli foydalanish;",
  "gaz, elektr jihozlaridan hamda isitish tizimidan foydalanish qoidalariga qat'iy rioya qilish va ulardan oqilona foydalanish;",
  "belgilangan vaqtlar bo'yicha Talabalar turar joyi binosiga kirib-chiqish qoidalariga amal qilish;",
  "Talabalar turar joyidan uzoq muddatga ketayotib (yozgi va qishki ta'til, dam olish, amaliyot, akademik ta'til olgan hollar), turar joyi rahbarini uch kun oldin yozma ravishda ogohlantirish;",
  "kundalik ehtiyojga ega bo'lmagan katta hajmdagi shaxsiy va qimmatbaho buyumlarni turar joy binosiga olib kirmaslik;",
  "Talabalar turar joyida yashovchilar va xonadoshlar bilan doimo samimiy, ahil munosabatda bo'lish;",
  "Talabalar turar joyi mol-mulkidan to'g'ri va unumli foydalanish va zarar yetkazmaslik;",
  "yashash xonasiga begona shaxslarni olib kirmaslik hamda tunab qolishlari uchun joy bermaslik;",
  "Talabalar turar joyi atrofida, yashash xonasida spirtli ichimliklar, tamaki mahsulotlari, giyohvand moddalarini iste'mol qilmaslik shuningdek, ularni saqlash, sotish hamda qimor, totalizator o'yinlarini o'ynamaslik;",
  "Talabalar turar joyi xonalarida diniy marosimlarga oid tadbirlar, yig'inlar o'tkazmaslik, diniy saboq bermaslik va bunday materiallarni tarqatmaslik va saqlamaslik;",
  "o'quv yili yakunida menga berilgan xonani bo'shatish va o'rnatilgan tartibda bino boshlig'iga topshirish;",
  "Talabalar turar joylari uchun universitet tomonidan belgilangan oylik ijara to'lovini o'rnatilgan tartibda to'lash kabi qoidalarga qat'iy amal qilaman.",
]

const ARIZA_NOTES = [
  "Agar talaba chin yetim yoki mehribonlik uyi tarbiyalanuvchisi bo'lsa, guvohnomalarning nusxasi;",
  "Agar talabada I va II guruh nogironligi to'g'risida ma'lumotnoma bo'lsa, ma'lumotnomadan nusxa;",
  "Agar talaba kam ta'minlangan oila farzandi bo'lsa jumladan, \"Ijtimoiy himoya yagona reestri\" avtomatlashtirilgan tizimi tomonidan shakillantirilgan hujjat, \"temir\" daftarga kiruvchi oila farzandi, onasi \"Ayollar daftari\"ga kiritilgan oila farzandi bo'lganlar talab etiladi.",
]

// jsPDF's built-in Times covers a narrow character set — fold the Uzbek
// okina, smart quotes, dashes and the numero sign to ASCII so every glyph
// renders (a missing glyph shows as a black box / "?").
export function normalizePdfText(input: unknown): string {
  return String(input ?? '')
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/№/g, 'No')
    .replace(/ /g, ' ')
}

export function arizaTilxatFileName(fullName: string): string {
  const slug = normalizePdfText(fullName).replace(/[^A-Za-z]+/g, '_').replace(/^_|_$/g, '') || 'talaba'
  return `Ariza-Tilxat_${slug}.pdf`
}

type Doc = import('jspdf').jsPDF

const LINE_FACTOR = 1.3
// Line advance in mm for a given point size (72pt = 1in = 25.4mm).
const mmLineHeight = (pt: number) => (pt * LINE_FACTOR * 25.4) / 72

function makeCursor(doc: Doc, margin: number) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  return {
    doc,
    left: margin,
    right: pageW - margin,
    width: pageW - margin * 2,
    pageH,
    y: margin,
  }
}
type Cursor = ReturnType<typeof makeCursor>

function textBlock(
  c: Cursor,
  text: string,
  opts: { size?: number; style?: 'normal' | 'bold' | 'italic'; align?: 'left' | 'justify' | 'right'; indent?: number; gap?: number } = {},
) {
  const size = opts.size ?? 12
  const style = opts.style ?? 'normal'
  const align = opts.align ?? 'left'
  const indent = opts.indent ?? 0
  c.doc.setFont('times', style)
  c.doc.setFontSize(size)
  const body = (indent ? '      ' : '') + normalizePdfText(text)
  const lines = c.doc.splitTextToSize(body, c.width) as string[]
  const x = align === 'right' ? c.right : c.left
  c.doc.text(lines, x, c.y, { align, maxWidth: c.width, lineHeightFactor: LINE_FACTOR })
  c.y += lines.length * mmLineHeight(size) + (opts.gap ?? 1.5)
}

function bulletList(c: Cursor, items: string[], size = 10.5) {
  const lf = 1.18
  c.doc.setFont('times', 'normal')
  c.doc.setFontSize(size)
  const bx = 4.5
  for (const item of items) {
    const lines = c.doc.splitTextToSize(normalizePdfText(item), c.width - bx) as string[]
    c.doc.text('-', c.left, c.y)
    c.doc.text(lines, c.left + bx, c.y, { align: 'justify', maxWidth: c.width - bx, lineHeightFactor: lf })
    c.y += lines.length * ((size * lf * 25.4) / 72) + 1.1
  }
}

function centerTitle(c: Cursor, title: string) {
  c.y += 3
  c.doc.setFont('times', 'bold')
  c.doc.setFontSize(15)
  c.doc.text(title, (c.left + c.right) / 2, c.y, { align: 'center', charSpace: 2 })
  c.y += 9
}

function signatureRow(c: Cursor) {
  c.y += 8
  c.doc.setFont('times', 'normal')
  c.doc.setFontSize(12)
  c.doc.text('______________________', c.left, c.y)
  c.doc.text('______________________', c.right, c.y, { align: 'right' })
  c.y += 4.5
  c.doc.setFontSize(9)
  c.doc.text('(imzo)', c.left + 14, c.y)
  c.doc.text('(F.I.Sh.)', c.right - 14, c.y, { align: 'right' })
  c.y += 7
}

function header(c: Cursor, faculty: string, course: string, name: string) {
  textBlock(c, UNIVERSITY_HEADER, { size: 10.5, align: 'right', gap: 1 })
  textBlock(c, `${faculty} fakulteti`, { size: 10.5, align: 'right', gap: 0.5 })
  textBlock(c, `Bakalavriat kunduzgi ta'lim yo'nalishi ${course}-kurs talabasi ${name}`, { size: 10.5, align: 'right', gap: 2 })
}

export async function generateArizaTilxatPdf(data: ArizaTilxatData): Promise<Doc> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const name = normalizePdfText(data.fullName).trim() || '______________________________'
  const faculty = normalizePdfText(data.facultyLabel).trim() || '____________________________________'
  const course = String(data.course ?? '').trim() || '__'
  const country = normalizePdfText(data.originCountry).trim() || '_______________'
  const region = normalizePdfText(data.originRegion).trim() || '_______________'
  const ttj = normalizePdfText(data.ttjName ?? '').trim() || '_____'
  const phone = normalizePdfText(data.phone).trim()
  const relativePhone = normalizePdfText(data.relativePhone).trim()
  const budget = data.studyType === 'grant' ? 'X' : '__'
  const contract = data.studyType === 'kontrakt' ? 'X' : '__'
  const year = new Date().getFullYear()

  // ---------- Page 1: ARIZA ----------
  const p1 = makeCursor(doc, 18)
  header(p1, faculty, course, name)
  centerTitle(p1, 'A R I Z A')

  textBlock(p1,
    `Men ${name} hozirgi kunda Mirzo Ulug'bek nomidagi O'zbekiston Milliy universitetining ${faculty} fakulteti bakalavriat kunduzgi ta'lim yo'nalishi ${course}-kursida ( ${budget} budjet ) ( ${contract} to'lov-shartnoma ) asosida tahsil olaman.`,
    { indent: 1, align: 'justify', gap: 2 })
  textBlock(p1,
    `${year}/${year + 1} o'quv yilida an'anaviy dars-mashg'ulotlariga qatnashish uchun men ${country} davlati ${region} viloyatidan kelganligim, Toshkent shahrida turar joyim yo'qligi sababli, universitetga qarashli ${ttj}-sonli talabalar turar joyidan yashash uchun joy berishingizni va u yerga ro'yhatga olishingizni so'rayman.`,
    { indent: 1, align: 'justify', gap: 2 })
  textBlock(p1,
    `Universitet "Talabalar turar joyi to'g'risida"gi Nizom, "Ichki tartib qoidalari", "Odob-ahloq qoidalari" va "Talabalar turar joyi Ichki tartib qoidalari"ga to'liq rioya qilib, talabalar turar joylari uchun universitet tomonidan belgilangan oylik ijara to'lovini o'quv yili mobaynida o'rnatilgan tartibda to'lash, shaxsiy gigiena, sog'lom turmush tarzi talablariga qat'iy amal qilib yashashga va'da beraman.`,
    { indent: 1, align: 'justify', gap: 2 })
  textBlock(p1,
    `Pasportim va ijtimoiy mezonlarga muvofiqligimni tasdiqlovchi hujjatlar nusxalarini ilova qilmoqdaman. Ushbu ariza va unga ilova qilinayotgan hujjatlarda ko'rsatilgan barcha ma'lumotlarning haqiqiyligiga shaxsan o'zim javobgarman. Agar men tomonimdan talabalar turar joyi ichki tartib qoidalari buzilsa, u holda menga Nizomda belgilangan tartibda chora ko'rilishiga roziman.`,
    { indent: 1, align: 'justify', gap: 3 })

  signatureRow(p1)
  doc.setFont('times', 'normal'); doc.setFontSize(12)
  doc.text(normalizePdfText(`Talaba tel: ${phone ? `+998 ${phone}` : '__________________'}`), p1.left, p1.y)
  p1.y += 5.5
  doc.text(normalizePdfText(`Yaqin qarindoshi tel: ${relativePhone || '__________________'}`), p1.left, p1.y)
  doc.text('_____________', p1.right, p1.y, { align: 'right' })
  p1.y += 3.8
  doc.setFontSize(9); doc.text('Sana', p1.right - 4, p1.y, { align: 'right' })
  p1.y += 8

  textBlock(p1, 'Eslatma:', { size: 10, style: 'bold', gap: 0.5 })
  for (const note of ARIZA_NOTES) textBlock(p1, note, { size: 8.5, style: 'italic', gap: 0.8 })

  p1.y = Math.max(p1.y + 4, p1.pageH - 30)
  doc.setFont('times', 'normal'); doc.setFontSize(11)
  doc.text('Ariza No _________', p1.right - 60, p1.y)
  p1.y += 5.5
  doc.text('Berildi _____ qavat _____ xona', p1.right - 60, p1.y)

  // ---------- Page 2: TILXAT ----------
  doc.addPage()
  const p2 = makeCursor(doc, 14)
  header(p2, faculty, course, name)
  centerTitle(p2, 'T I L X A T')

  textBlock(p2,
    `Men ${name} ${faculty} fakulteti bakalavriat ta'lim yo'nalishi ${course}-kurs talabasi ${ttj}-sonli Talabalar turar joyida yashash davrimda quyidagilarga:`,
    { indent: 1, align: 'justify', size: 11, gap: 2 })

  bulletList(p2, TILXAT_RULES)

  p2.y += 1
  textBlock(p2,
    `Agar men ushbu qoidalarga amal qilmasam yoki boshqa tarzda bo'yin tovlasam Nizomda belgilangan tartibda menga chora ko'rilishi xaqida ogohlantirildim.`,
    { align: 'justify', size: 11, gap: 2 })

  signatureRow(p2)
  doc.setFontSize(12); doc.text('_____________', p2.right, p2.y, { align: 'right' })
  p2.y += 3.8
  doc.setFontSize(9); doc.text('Sana', p2.right - 4, p2.y, { align: 'right' })

  return doc
}
