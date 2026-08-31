// The filled Ariza + Tilxat as a real, text-based PDF (jsPDF, Times) — not
// a browser print. window.print() produced blank pages on many phones; this
// renders the same UzMU template with the applicant's data everywhere and
// only the by-hand fields (signatures, date, and the dekanat's "Ariza №" /
// room boxes) left blank.
//
// Kept in sync with components/documents/ArizaTilxatDocument.tsx (the
// on-screen preview) — same wording, same blanks.

import type { ArizaTilxatData } from '@/components/documents/ArizaTilxatDocument'
import { registerTinos } from './fonts/tinos'

const FONT = 'Tinos'

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

// The embedded Tinos subset covers the Uzbek okina, numero sign and dashes,
// so nothing is folded to ASCII any more — we only unify the apostrophe
// glyphs (ASCII ', tutuq ʼ, smart quotes) to the okina ʻ, matching how
// the UzMU template writes o'/g'/ta'lim.
export function normalizePdfText(input: unknown): string {
  return String(input ?? '')
    .replace(/[ʼ‘’'`´]/g, 'ʻ')
    .replace(/ /g, ' ')
}

export function arizaTilxatFileName(fullName: string): string {
  const slug = normalizePdfText(fullName).replace(/[^A-Za-z]+/g, '_').replace(/^_|_$/g, '') || 'talaba'
  return `Ariza-Tilxat_${slug}.pdf`
}

type Doc = import('jspdf').jsPDF

// The .docx runs its body at line=276 (≈1.15) — match it so the wrapping and
// the page fill line up with the template the student is comparing against.
const LINE_FACTOR = 1.15
// Line advance in mm for a given point size (72pt = 1in = 25.4mm).
const mmLineHeight = (pt: number) => (pt * LINE_FACTOR * 25.4) / 72

// Margins match the UzMU .docx (pgMar): left 30, right 15, top/bottom 20 mm.
const MARGIN = { left: 30, right: 15, top: 20, bottom: 20 }
// The .docx indents every body paragraph by firstLine=567 twips ≈ 10 mm, and
// the address block by left=4111 twips ≈ 72.5 mm.
const FIRST_LINE_INDENT = 10
const HEADER_INDENT = 72.5

function makeCursor(doc: Doc, topExtra = 0) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  return {
    doc,
    left: MARGIN.left,
    right: pageW - MARGIN.right,
    width: pageW - MARGIN.left - MARGIN.right,
    pageH,
    y: MARGIN.top - topExtra,
  }
}
type Cursor = ReturnType<typeof makeCursor>

function textBlock(
  c: Cursor,
  text: string,
  opts: {
    size?: number
    style?: 'normal' | 'bold' | 'italic'
    align?: 'left' | 'justify' | 'right'
    /** First-line indent in mm (the .docx uses ≈10 mm on every body paragraph). */
    firstLineIndent?: number
    gap?: number
    width?: number
    /** Left edge override — used for the right-hand address column. */
    x?: number
  } = {},
) {
  const size = opts.size ?? 12
  const style = opts.style ?? 'normal'
  const align = opts.align ?? 'left'
  const fli = opts.firstLineIndent ?? 0
  const width = opts.width ?? c.width
  const x = opts.x ?? (align === 'right' ? c.right : c.left)
  c.doc.setFont(FONT, style)
  c.doc.setFontSize(size)
  const body = normalizePdfText(text)
  const lh = mmLineHeight(size)

  if (fli > 0 && align !== 'right') {
    // First line pushed right by `fli` mm and wrapped at the reduced width;
    // the rest of the paragraph runs at the full block width.
    const first = (c.doc.splitTextToSize(body, width - fli) as string[])[0] ?? ''
    const rest = body.slice(first.length).replace(/^\s+/, '')
    const restLines = rest ? (c.doc.splitTextToSize(rest, width) as string[]) : []
    c.doc.text(first, x + fli, c.y)
    if (restLines.length) {
      c.doc.text(restLines, x, c.y + lh, { align, maxWidth: width, lineHeightFactor: LINE_FACTOR })
    }
    c.y += (1 + restLines.length) * lh + (opts.gap ?? 1.5)
    return
  }

  const lines = c.doc.splitTextToSize(body, width) as string[]
  c.doc.text(lines, x, c.y, { align, maxWidth: width, lineHeightFactor: LINE_FACTOR })
  c.y += lines.length * lh + (opts.gap ?? 1.5)
}

// (the rules list is plain justified paragraphs now — see renderPages)

function centerTitle(c: Cursor, title: string) {
  c.y += 3
  c.doc.setFont(FONT, 'bold')
  c.doc.setFontSize(15)
  c.doc.text(title, (c.left + c.right) / 2, c.y, { align: 'center', charSpace: 2 })
  c.y += 9
}

function signatureRow(c: Cursor) {
  c.y += 8
  c.doc.setFont(FONT, 'normal')
  c.doc.setFontSize(12)
  c.doc.text('______________________', c.left, c.y)
  c.doc.text('______________________', c.right, c.y, { align: 'right' })
  c.y += 4.5
  c.doc.setFontSize(9)
  c.doc.text('(imzo)', c.left + 14, c.y)
  c.doc.text('(F.I.Sh.)', c.right - 14, c.y, { align: 'right' })
  c.y += 7
}

// The address-to block. The .docx puts it in a left-indented (≈72.5 mm),
// justified column that runs to the right margin — so we anchor it at that
// same left edge, justify it, and let long lines wrap inside the column.
// 11 pt bold matches the template's default size + <w:b/>.
function header(c: Cursor, faculty: string, course: string, name: string) {
  const x = c.left + HEADER_INDENT
  const width = c.right - x
  // The applicant line is "...talabasi <F.I.Sh.>dan" — the ablative "-dan"
  // ("kimdan") is what makes the address block read correctly. Skip it when
  // the name is still a blank underline (dekan-side preview).
  const applicant = name.startsWith('_') ? name : `${name}dan`
  textBlock(c, UNIVERSITY_HEADER, { size: 11, style: 'bold', align: 'justify', x, width, gap: 1.5 })
  textBlock(c, `${faculty} fakulteti`, { size: 11, style: 'bold', align: 'justify', x, width, gap: 0.5 })
  textBlock(c, `Bakalavriat kunduzgi ta'lim yo'nalishi ${course}-kurs talabasi ${applicant}`, { size: 11, style: 'bold', align: 'justify', x, width, gap: 2 })
}

// Draw both pages at a given vertical scale (1 = default). Returns how far
// down text reached on each page so the caller can shrink and re-run if a
// long faculty name / long full name would push a signature off the sheet.
function renderPages(doc: Doc, data: ArizaTilxatData, s: number): { p1: number; p2: number } {
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
  const g = (mm: number) => mm * s // scale a vertical gap

  // ---------- Page 1: ARIZA ----------
  const p1 = makeCursor(doc)
  header(p1, faculty, course, name)
  centerTitle(p1, 'A R I Z A')

  const bodySize = 11.5 * s
  textBlock(p1,
    `Men ${name} hozirgi kunda Mirzo Ulug'bek nomidagi O'zbekiston Milliy universitetining ${faculty} fakulteti bakalavriat kunduzgi ta'lim yo'nalishi ${course}-kursida ( ${budget} budjet ) ( ${contract} to'lov-shartnoma ) asosida tahsil olaman.`,
    { firstLineIndent: FIRST_LINE_INDENT, align: 'justify', size: bodySize, gap: g(2) })
  textBlock(p1,
    `${year}/${year + 1} o'quv yilida an'anaviy dars-mashg'ulotlariga qatnashish uchun men ${country} davlati ${region} viloyatidan kelganligim, Toshkent shahrida turar joyim yo'qligi sababli, universitetga qarashli ${ttj}-sonli talabalar turar joyidan yashash uchun joy berishingizni va u yerga ro'yhatga olishingizni so'rayman.`,
    { firstLineIndent: FIRST_LINE_INDENT, align: 'justify', size: bodySize, gap: g(2) })
  textBlock(p1,
    `Universitet "Talabalar turar joyi to'g'risida"gi Nizom, "Ichki tartib qoidalari", "Odob-ahloq qoidalari" va "Talabalar turar joyi Ichki tartib qoidalari"ga to'liq rioya qilib, talabalar turar joylari uchun universitet tomonidan belgilangan oylik ijara to'lovini o'quv yili mobaynida o'rnatilgan tartibda to'lash, shaxsiy gigiena, sog'lom turmush tarzi talablariga qat'iy amal qilib yashashga va'da beraman.`,
    { firstLineIndent: FIRST_LINE_INDENT, align: 'justify', size: bodySize, gap: g(2) })
  textBlock(p1,
    `Pasportim va ijtimoiy mezonlarga muvofiqligimni tasdiqlovchi hujjatlar nusxalarini ilova qilmoqdaman. Ushbu ariza va unga ilova qilinayotgan hujjatlarda ko'rsatilgan barcha ma'lumotlarning haqiqiyligiga shaxsan o'zim javobgarman. Agar men tomonimdan talabalar turar joyi ichki tartib qoidalari buzilsa, u holda menga Nizomda belgilangan tartibda chora ko'rilishiga roziman.`,
    { firstLineIndent: FIRST_LINE_INDENT, align: 'justify', size: bodySize, gap: g(3) })

  signatureRow(p1)
  doc.setFont(FONT, 'normal'); doc.setFontSize(11)
  doc.text(normalizePdfText(`Talaba tel: ${phone ? `+998 ${phone}` : '__________________'}`), p1.left, p1.y)
  p1.y += g(5)
  doc.text(normalizePdfText(`Yaqin qarindoshi tel: ${relativePhone || '__________________'}`), p1.left, p1.y)
  doc.text('_____________', p1.right, p1.y, { align: 'right' })
  p1.y += 3.5
  doc.setFontSize(9); doc.text('Sana', p1.right - 4, p1.y, { align: 'right' })
  p1.y += g(6)

  // The .docx runs the notes as a decimal list (1. 2. 3.), Times italic, 9 pt.
  textBlock(p1, 'Eslatma:', { size: 9, style: 'bold', gap: 0.5 })
  ARIZA_NOTES.forEach((note, i) =>
    textBlock(p1, `${i + 1}. ${note}`, { size: 9, style: 'italic', firstLineIndent: FIRST_LINE_INDENT, gap: g(0.8) }),
  )

  p1.y += g(4)
  doc.setFont(FONT, 'normal'); doc.setFontSize(10.5)
  doc.text('Ariza № _________', p1.right - 58, p1.y)
  p1.y += 5
  doc.text('Berildi _____ qavat _____ xona', p1.right - 58, p1.y)
  const p1End = p1.y

  // ---------- Page 2: TILXAT ----------
  doc.addPage()
  const p2 = makeCursor(doc)
  header(p2, faculty, course, name)
  centerTitle(p2, 'T I L X A T')

  textBlock(p2,
    `Men ${name} ${faculty} fakulteti bakalavriat ta'lim yo'nalishi ${course}-kurs talabasi ${ttj}-sonli Talabalar turar joyida yashash davrimda quyidagilarga:`,
    { firstLineIndent: FIRST_LINE_INDENT, align: 'justify', size: bodySize, gap: g(2) })

  // The .docx lists the rules as plain justified paragraphs (firstLine ≈10 mm,
  // 11.5 pt), each closed with ";" — no bullets or numbers.
  for (const rule of TILXAT_RULES) {
    textBlock(p2, rule, { firstLineIndent: FIRST_LINE_INDENT, align: 'justify', size: bodySize, gap: g(1) })
  }

  p2.y += g(1)
  textBlock(p2,
    `Agar men ushbu qoidalarga amal qilmasam yoki boshqa tarzda bo'yin tovlasam Nizomda belgilangan tartibda menga chora ko'rilishi xaqida ogohlantirildim.`,
    { firstLineIndent: FIRST_LINE_INDENT, align: 'justify', size: bodySize, gap: g(2) })

  signatureRow(p2)
  doc.setFontSize(11); doc.text('_____________', p2.right, p2.y, { align: 'right' })
  p2.y += 3.5
  doc.setFontSize(9); doc.text('Sana', p2.right - 4, p2.y, { align: 'right' })

  return { p1: p1End, p2: p2.y }
}

export async function generateArizaTilxatPdf(data: ArizaTilxatData): Promise<Doc & { __fit?: { p1: number; p2: number; scale: number } }> {
  const { jsPDF } = await import('jspdf')
  let doc = new jsPDF({ unit: 'mm', format: 'a4' }); registerTinos(doc)
  const limit = doc.internal.pageSize.getHeight() - MARGIN.bottom // keep clear of the bottom margin

  // First pass at full size; if a long name / faculty pushed either page's
  // last line past the sheet, redraw everything a little tighter (down to 82%).
  let fit = renderPages(doc, data, 1)
  let scale = 1
  const worst = Math.max(fit.p1, fit.p2)
  if (worst > limit) {
    scale = Math.max(0.82, (limit - 20) / (worst - 20))
    doc = new jsPDF({ unit: 'mm', format: 'a4' }); registerTinos(doc)
    fit = renderPages(doc, data, scale)
  }
  ;(doc as Doc & { __fit?: unknown }).__fit = { ...fit, scale }
  return doc
}
