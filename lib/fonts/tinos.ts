import { TINOS_BOLD, TINOS_ITALIC, TINOS_NORMAL } from './tinos-data'

type Doc = import('jspdf').jsPDF

/**
 * Register the subset Tinos family on a jsPDF document. Call once right
 * after `new jsPDF(...)`, then `doc.setFont('Tinos', 'normal' | 'bold' |
 * 'italic')`. Tinos is Times-metric-compatible, so a layout tuned for the
 * built-in "times" needs no changes, and it covers the Uzbek okina (ʻ),
 * the numero sign and en/em dashes — no more ASCII folding.
 */
export function registerTinos(doc: Doc): void {
  doc.addFileToVFS('Tinos-normal.ttf', TINOS_NORMAL)
  doc.addFont('Tinos-normal.ttf', 'Tinos', 'normal')
  doc.addFileToVFS('Tinos-bold.ttf', TINOS_BOLD)
  doc.addFont('Tinos-bold.ttf', 'Tinos', 'bold')
  doc.addFileToVFS('Tinos-italic.ttf', TINOS_ITALIC)
  doc.addFont('Tinos-italic.ttf', 'Tinos', 'italic')
}
