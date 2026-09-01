'use client'

import type { ArizaReceipt } from '@/features/applications/client/api'

// A small proof-of-signature receipt ("elektron tilxat"). Helvetica / Latin
// only — the content is names + codes + dates, no long Uzbek prose, so the
// built-in font is enough and we avoid bundling a webfont here.
export async function downloadArizaReceiptPdf(
  receipt: ArizaReceipt,
  student: { studentName: string; faculty?: string | null; course?: string | number | null },
) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const when = new Date(receipt.signedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
  const kind = receipt.type === 'tushuntirish' ? 'Tushuntirish' : 'Ariza'

  let y = 24
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(16)
  doc.text('ELEKTRON TILXAT', 20, y)
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(10)
  doc.text('Ariza elektron imzosi haqida', 20, y + 6)
  y += 18

  const row = (label: string, value: string) => {
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(10)
    doc.text(label, 20, y)
    doc.setFont('Helvetica', 'normal')
    doc.text(doc.splitTextToSize(value || '-', 120), 65, y)
    y += 9
  }

  row('Talaba:', student.studentName)
  if (student.faculty) row('Fakultet:', String(student.faculty))
  if (student.course) row('Kurs:', String(student.course))
  row('Hujjat:', `${receipt.title ?? ''} (${kind.toLowerCase()})`)
  row('Imzolangan:', `${when} (Toshkent)`)
  row('Hujjat hash:', `${receipt.hashShort}...`)

  y += 4
  doc.setDrawColor(180); doc.line(20, y, 190, y); y += 12

  doc.setFont('Helvetica', 'bold'); doc.setFontSize(11)
  doc.text('Tekshiruv kodi', 20, y); y += 8
  doc.setFontSize(22)
  doc.text(receipt.verifyCode, 20, y); y += 12

  doc.setFont('Helvetica', 'normal'); doc.setFontSize(9)
  doc.text(
    doc.splitTextToSize(
      `Ushbu ariza ${student.studentName} tomonidan yuqorida ko'rsatilgan vaqtda elektron tarzda ` +
      `tasdiqlangan. Imzoni istalgan vaqtda quyidagi manzilda tekshirish mumkin:`,
      170,
    ),
    20, y,
  )
  y += 12
  doc.setFont('Helvetica', 'bold')
  doc.text('meningyotoqxonam.uz/ariza-tekshirish', 20, y)

  doc.save(`tilxat-${receipt.verifyCode}.pdf`)
}
