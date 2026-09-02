'use client'

import {
  applicantLine,
  arizaHeadingText,
  composeArizaBody,
  recipientLine,
  type ArizaComposeInput,
} from '@/lib/student-ariza-template'
import { registerTinos } from '@/lib/fonts/tinos'
import { normalizePdfText } from '@/lib/ariza-tilxat-pdf'

const FONT = 'Tinos'
const MARGIN = { left: 30, right: 15, top: 22, bottom: 20 }
const LINE = 1.2
const lh = (pt: number) => (pt * LINE * 25.4) / 72

export type StudentArizaPdfData = ArizaComposeInput & {
  signatureImage?: string | null
  signedAt?: string | null
  verifyCode?: string | null
}

export async function generateStudentArizaPdf(data: StudentArizaPdfData) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  registerTinos(doc)

  const pageW = doc.internal.pageSize.getWidth()
  const contentW = pageW - MARGIN.left - MARGIN.right
  let y = MARGIN.top

  const para = (
    text: string,
    opts: { size?: number; style?: 'normal' | 'bold'; align?: 'left' | 'center' | 'right' | 'justify'; indent?: number; x?: number; w?: number; gap?: number } = {},
  ) => {
    const size = opts.size ?? 12
    const style = opts.style ?? 'normal'
    const align = opts.align ?? 'left'
    const w = opts.w ?? contentW
    const x = opts.x ?? (align === 'right' ? pageW - MARGIN.right : align === 'center' ? pageW / 2 : MARGIN.left)
    doc.setFont(FONT, style)
    doc.setFontSize(size)
    const body = normalizePdfText(text)
    if (opts.indent && align !== 'center' && align !== 'right') {
      const first = (doc.splitTextToSize(body, w - opts.indent) as string[])[0] ?? ''
      const rest = body.slice(first.length).replace(/^\s+/, '')
      const restLines = rest ? (doc.splitTextToSize(rest, w) as string[]) : []
      doc.text(first, x + opts.indent, y)
      if (restLines.length) doc.text(restLines, x, y + lh(size), { align, maxWidth: w, lineHeightFactor: LINE })
      y += (1 + restLines.length) * lh(size) + (opts.gap ?? 2)
      return
    }
    const lines = doc.splitTextToSize(body, w) as string[]
    doc.text(lines, x, y, { align, maxWidth: w, lineHeightFactor: LINE })
    y += lines.length * lh(size) + (opts.gap ?? 2)
  }

  // Recipient + applicant block, right-aligned column
  const colX = MARGIN.left + contentW * 0.42
  const colW = pageW - MARGIN.right - colX
  para(recipientLine(data.recipient, { facultyLabel: data.facultyLabel, dekanName: data.dekanName }), { size: 11, style: 'bold', align: 'justify', x: colX, w: colW, gap: 1.5 })
  para(applicantLine(data), { size: 11, style: 'bold', align: 'justify', x: colX, w: colW, gap: 4 })

  y += 2
  para(arizaHeadingText(data.kind), { size: 15, style: 'bold', align: 'center', gap: 8 })

  for (const p of composeArizaBody(data).split('\n\n')) {
    para(p, { size: 11.5, align: 'justify', indent: 10, gap: 3 })
  }

  // Signature row
  y += 8
  const dateStr = data.signedAt
    ? new Date(data.signedAt).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' })
    : '____.____.20____'
  doc.setFont(FONT, 'normal'); doc.setFontSize(11)
  doc.text(normalizePdfText(`Sana: ${dateStr}`), MARGIN.left, y)

  const sigRight = pageW - MARGIN.right
  if (data.signatureImage?.startsWith('data:image/')) {
    try {
      const props = doc.getImageProperties(data.signatureImage)
      const maxW = 46, maxH = 18
      const scale = Math.min(maxW / props.width, maxH / props.height)
      const w = props.width * scale
      const h = props.height * scale
      doc.addImage(data.signatureImage, 'PNG', sigRight - w, y - h - 1, w, h)
    } catch { /* ignore a bad image */ }
  }
  doc.setLineWidth(0.3)
  doc.line(sigRight - 48, y + 2, sigRight, y + 2)
  doc.setFontSize(9)
  doc.text(normalizePdfText(data.fullName || '(imzo / F.I.Sh.)'), sigRight, y + 6, { align: 'right' })

  // Verification footer
  if (data.verifyCode) {
    y += 18
    doc.setDrawColor(150)
    doc.line(MARGIN.left, y, pageW - MARGIN.right, y)
    y += 6
    doc.setFont(FONT, 'normal'); doc.setFontSize(9)
    para(`Elektron imzolangan hujjat. Tekshiruv kodi: ${data.verifyCode}`, { size: 9, gap: 1.5 })
    para('Haqiqiyligini tekshirish: meningyotoqxonam.uz/ariza-tekshirish', { size: 9 })
  }

  const slug = normalizePdfText(data.fullName).replace(/[^A-Za-z]+/g, '_').replace(/^_|_$/g, '') || 'talaba'
  doc.save(`${data.kind === 'tushuntirish' ? 'Tushuntirish' : 'Ariza'}_${slug}.pdf`)
}
