'use client'

import { registerTinos } from './fonts/tinos'
import { normalizePdfText } from './ariza-tilxat-pdf'
import { permitFacultyLabel } from './faculties'
import { directionLabel } from './directions'
import { CERTIFICATE_PURPOSE_LABELS, type CertificateDocument } from '@/features/certificates/types'

const FONT = 'Tinos'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function certificateFileName(cert: CertificateDocument): string {
  return `Malumotnoma_${cert.number ?? 'talaba'}.pdf`
}

/**
 * Tasdiqlangan talabalik ma'lumotnomasini PDF qiladi (Tinos shrifti — o'zbek
 * apostroflari to'g'ri chiqadi). Imzo o'rnida dekanning elektron tasdig'i va
 * ma'lumotnoma raqami turadi; haqiqiyligi dekanatda raqam bo'yicha tekshiriladi.
 */
export async function downloadCertificatePdf(cert: CertificateDocument): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  registerTinos(doc)
  const t = normalizePdfText
  const left = 25
  const width = 160
  let y = 28

  doc.setFont(FONT, 'bold')
  doc.setFontSize(13)
  doc.text(doc.splitTextToSize(t("Mirzo Ulug'bek nomidagi O'zbekiston Milliy universiteti"), width), 105, y, { align: 'center' })
  y += 8
  doc.setFont(FONT, 'normal')
  doc.setFontSize(12)
  const faculty = permitFacultyLabel(cert.faculty ?? '') || cert.faculty || ''
  if (faculty) {
    doc.text(t(faculty), 105, y, { align: 'center' })
    y += 6
  }
  y += 10

  doc.setFont(FONT, 'bold')
  doc.setFontSize(20)
  doc.text(t("MA'LUMOTNOMA"), 105, y, { align: 'center' })
  y += 8
  doc.setFont(FONT, 'normal')
  doc.setFontSize(12)
  doc.text(`№ ${cert.number ?? ''}`, 105, y, { align: 'center' })
  y += 6
  doc.text(formatDate(cert.decidedAt), 105, y, { align: 'center' })
  y += 18

  const direction = directionLabel(cert.direction ?? '')
  const study = [
    faculty ? `${faculty} fakulteti` : null,
    direction || null,
    cert.course ? `${cert.course}-kurs` : null,
    cert.group ? `${cert.group}-guruh` : null,
  ].filter(Boolean).join(', ')

  const purpose = cert.purpose === 'boshqa' && cert.purposeNote
    ? cert.purposeNote
    : CERTIFICATE_PURPOSE_LABELS[cert.purpose].replace(/ uchun$/, '')

  doc.setFontSize(13)
  const paragraphs = [
    `Ushbu ma'lumotnoma ${cert.studentName} ${study ? `${study} ` : ''}talabasi ekanligi haqida berildi.`,
    `Ma'lumotnoma talab qilingan joyga taqdim etish uchun berildi (maqsad: ${purpose.toLowerCase()}).`,
  ]
  for (const paragraph of paragraphs) {
    const lines = doc.splitTextToSize(t(paragraph), width)
    doc.text(lines, left, y, { lineHeightFactor: 1.5 })
    y += lines.length * 7.5 + 5
  }

  y += 22
  doc.setFontSize(12)
  doc.text(t(`Dekan: ${cert.decidedByName ?? ''}`), left, y)
  y += 7
  doc.setFontSize(10)
  doc.setFont(FONT, 'italic')
  doc.text(
    doc.splitTextToSize(
      t(`Hujjat elektron tizimda dekan tasdig'i bilan shakllantirilgan (${formatDate(cert.decidedAt)}). Haqiqiyligi ${cert.number ?? ''} raqami bo'yicha dekanatda tekshiriladi.`),
      width,
    ),
    left,
    y,
  )

  doc.save(certificateFileName(cert))
}
