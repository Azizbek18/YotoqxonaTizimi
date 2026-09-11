// Kim "Hujjatlarim" (viza/propiska) moduliga ega bo'lishini hal qiladi.
// Ikki xil auditoriya bor:
//   'foreign'      — chet el fuqarosi (users.country bor). Viza HAM,
//                     propiska HAM kerak.
//   'registration' — O'zbekiston fuqarosi, lekin doimiy ro'yxatga olingan
//                     viloyati (users.region) yotoqxona joylashgan
//                     "mahalliy" viloyat(lar)dan farq qiladi. Faqat
//                     propiska kerak — viza tushunchasi umuman qo'llanmaydi.
// Sof funksiya — client (dashboard/hujjatlarim) va server (service.ts,
// dekan/talaba API route'lari) bir xil qoidadan foydalanadi.

export type DocsMode = 'foreign' | 'registration' | null

const normalize = (value: string) => value.trim().toLowerCase()

/**
 * `homeRegions` bo'sh bo'lsa (dekan hali sozlamagan) kengaytma o'chiq —
 * hech qanday domestik talaba propiska moduli olmaydi, faqat chet elliklar.
 */
export function resolveDocsMode(
  student: { country?: string | null; region?: string | null },
  homeRegions: readonly string[],
): DocsMode {
  if (student.country) return 'foreign'
  if (!student.region || homeRegions.length === 0) return null
  const isHome = homeRegions.some((r) => normalize(r) === normalize(student.region!))
  return isHome ? null : 'registration'
}
