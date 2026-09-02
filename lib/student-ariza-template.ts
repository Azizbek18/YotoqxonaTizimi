// Composes a registered student's formal ariza / tushuntirish text from a
// few fields, in the UzMU document style. Isomorphic — the on-screen
// preview and the server-side authoritative version share this so what the
// student signs is exactly what they saw.

export type ArizaRecipient = 'rektor' | 'prorektor' | 'dekan'
export type ArizaKind = 'ariza' | 'tushuntirish'

export const RECIPIENT_OPTIONS: { value: ArizaRecipient; label: string }[] = [
  { value: 'prorektor', label: 'Birinchi prorektor' },
  { value: 'rektor', label: 'Rektor' },
  { value: 'dekan', label: 'Fakultet dekani' },
]

const PROREKTOR_LINE =
  "Mirzo Ulug'bek nomidagi O'zbekiston Milliy universiteti Birinchi prorektori — Yoshlar masalalari va ma'naviy-ma'rifiy ishlar bo'yicha prorektor T.N.Xojiyevga"

export function isArizaRecipient(v: unknown): v is ArizaRecipient {
  return v === 'rektor' || v === 'prorektor' || v === 'dekan'
}

export function recipientLine(
  recipient: ArizaRecipient,
  opts: { facultyLabel: string; dekanName?: string | null },
): string {
  if (recipient === 'prorektor') return PROREKTOR_LINE
  if (recipient === 'rektor') {
    return "Mirzo Ulug'bek nomidagi O'zbekiston Milliy universiteti rektoriga"
  }
  const who = opts.dekanName?.trim() ? `dekani ${opts.dekanName.trim()}ga` : 'dekaniga'
  return `Mirzo Ulug'bek nomidagi O'zbekiston Milliy universiteti ${opts.facultyLabel || '____'} fakulteti ${who}`
}

export function arizaHeadingText(kind: ArizaKind): string {
  return kind === 'tushuntirish' ? 'T U S H U N T I R I S H' : 'A R I Z A'
}

export type ArizaComposeInput = {
  kind: ArizaKind
  recipient: ArizaRecipient
  fullName: string
  facultyLabel: string
  course: string | number
  ttjNumber: string
  room: string
  /** What the student typed about the incident / request. */
  incidentText: string
  dekanName?: string | null
}

/** The "kimdan" (applicant) block under the recipient line. */
export function applicantLine(input: Pick<ArizaComposeInput, 'facultyLabel' | 'course' | 'fullName'>): string {
  return `${input.facultyLabel || '____'} fakulteti bakalavriat kunduzgi ta'lim yo'nalishi ${String(input.course || '__')}-kurs talabasi ${input.fullName || '____________'}dan`
}

/** The body paragraphs, joined by blank lines. */
export function composeArizaBody(input: ArizaComposeInput): string {
  const ttj = input.ttjNumber.trim() || '__'
  const room = input.room.trim() || '__'
  const course = String(input.course || '__')

  const intro =
    `Men, ${input.fullName || '____________'}, Mirzo Ulug'bek nomidagi O'zbekiston Milliy universiteti ` +
    `${input.facultyLabel || '____'} fakulteti bakalavriat kunduzgi ta'lim yo'nalishi ${course}-kurs talabasi, ` +
    `${ttj}-sonli talabalar turar joyining ${room}-xonasida istiqomat qilaman.`

  const closing = input.kind === 'tushuntirish'
    ? "Sodir bo'lgan holat yuzasidan uzr so'rayman. Bundan buyon \"Talabalar turar joyi to'g'risida\"gi Nizom " +
      "hamda Ichki tartib-qoidalarga qat'iy amal qilishga, bunday holatning takrorlanmasligiga va'da beraman. " +
      "Agar men tomonimdan qoidabuzarlik yana takrorlansa, Nizomda belgilangan tartibda menga nisbatan " +
      "intizomiy chora ko'rilishiga roziman."
    : "Iltimosimni ijobiy hal qilishingizni so'rayman. Ushbu arizada ko'rsatilgan barcha ma'lumotlarning " +
      "haqiqiyligiga shaxsan o'zim javobgarman."

  return [intro, input.incidentText.trim(), closing].filter(Boolean).join('\n\n')
}

/** The whole document as plain text — what gets stored in arizalar.text and
 *  frozen into the signature snapshot. */
export function composeArizaFullText(input: ArizaComposeInput): string {
  return [
    recipientLine(input.recipient, { facultyLabel: input.facultyLabel, dekanName: input.dekanName }),
    applicantLine(input),
    '',
    arizaHeadingText(input.kind),
    '',
    composeArizaBody(input),
  ].join('\n')
}
