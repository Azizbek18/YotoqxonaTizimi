/**
 * Cyrillic → Latin for names. Students type their name in different
 * scripts (most Latin, Russian speakers in Cyrillic), so the dekan tables
 * and exports end up with two spellings of the same person. Everything is
 * normalised to Latin on input and again on the server.
 *
 * Two source alphabets:
 *  - Uzbek Cyrillic  (ў ғ қ ҳ …) → the official Uzbek Latin alphabet
 *  - Russian Cyrillic (no ў/ғ/қ/ҳ) → ICAO-style romanisation (zh, kh, shch),
 *    which is also what a Russian/foreign passport's machine-readable zone
 *    carries, so records line up with the document.
 */

const UZBEK_MARKERS = /[ўғқҳ]/i

const UZBEK_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'gʻ', д: 'd', е: 'e', ё: 'yo', ж: 'j',
  з: 'z', и: 'i', й: 'y', к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', о: 'o',
  ў: 'oʻ', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ҳ: 'h',
  ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: 'ʼ', ы: 'i', ь: '', э: 'e',
  ю: 'yu', я: 'ya',
}

const RUSSIAN_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'iu', я: 'ia',
}

function hasCyrillic(text: string): boolean {
  return /[Ѐ-ӿ]/.test(text)
}

/**
 * Returns `text` with every Cyrillic letter replaced by its Latin form,
 * preserving case for the first letter of each converted run and leaving
 * non-Cyrillic characters (spaces, hyphens, the Uzbek apostrophe, existing
 * Latin letters) untouched. A string with no Cyrillic is returned as-is.
 */
export function cyrillicToLatin(input: unknown): string {
  const text = String(input ?? '')
  if (!hasCyrillic(text)) return text

  const map = UZBEK_MARKERS.test(text) ? UZBEK_MAP : RUSSIAN_MAP

  let out = ''
  for (const ch of text) {
    const lower = ch.toLowerCase()
    const mapped = map[lower]
    if (mapped === undefined) {
      out += ch
      continue
    }
    // Preserve capitalisation: an upper-case source letter yields a
    // capitalised replacement ("Ш" → "Sh", not "SH" or "sh").
    if (ch !== lower && mapped) {
      out += mapped.charAt(0).toUpperCase() + mapped.slice(1)
    } else {
      out += mapped
    }
  }
  return out
}

/** true when the value still holds a Cyrillic letter (post-conversion check). */
export function hasCyrillicLetters(input: unknown): boolean {
  return hasCyrillic(String(input ?? ''))
}
