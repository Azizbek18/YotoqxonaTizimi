import 'server-only'

// Resend REST API — SDK o'rniga to'g'ridan-to'g'ri fetch ishlatiladi, chunki
// bizga faqat bitta endpoint kerak. lib/telegram.ts bilan bir xil qoida:
// sozlanmagan bo'lsa jimgina to'xtaydi, xatolik esa asosiy amalni buzmaydi —
// xat ketmagani uchun xona biriktirish yoki yo'llanma tasdiqlash bekor
// bo'lib qolmasligi kerak.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// meningyotoqxonam.uz Resend'da tasdiqlangan — production'da MAIL_FROM env
// shu manzilga sozlangan. Bu fallback env yo'q joyda (masalan lokal ishga
// tushirishda RESEND_API_KEY ham bo'lmaydi, ya'ni sendMail jimgina to'xtaydi).
const DEFAULT_FROM = 'Yotoqxona tizimi <noreply@meningyotoqxonam.uz>'

interface MailInput {
  to: string
  subject: string
  heading: string
  /** Har bir element alohida paragraf. HTML emas — oddiy matn. */
  paragraphs: string[]
  cta?: { label: string; url: string }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderHtml({ heading, paragraphs, cta }: Omit<MailInput, 'to' | 'subject'>) {
  const body = paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155">${escapeHtml(text)}</p>`,
    )
    .join('')

  const button = cta
    ? `<a href="${escapeHtml(cta.url)}" style="display:inline-block;margin-top:8px;padding:12px 24px;border-radius:12px;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">${escapeHtml(cta.label)}</a>`
    : ''

  return `<!doctype html>
<html lang="uz"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;padding:32px">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:19px;line-height:1.35;color:#0f172a">${escapeHtml(heading)}</h1>
        ${body}
        ${button}
        <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
          Bu xat Yotoqxona boshqaruv tizimi tomonidan avtomatik yuborildi. Javob yozish shart emas.
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

function renderText({ heading, paragraphs, cta }: Omit<MailInput, 'to' | 'subject'>) {
  const parts = [heading, '', ...paragraphs]
  if (cta) parts.push('', `${cta.label}: ${cta.url}`)
  return parts.join('\n')
}

export async function sendMail({ to, subject, heading, paragraphs, cta }: MailInput) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !to) return

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || DEFAULT_FROM,
        to: [to],
        subject,
        html: renderHtml({ heading, paragraphs, cta }),
        text: renderText({ heading, paragraphs, cta }),
      }),
    })
    if (!response.ok) {
      console.error('Resend sendMail error:', response.status, await response.text())
    }
  } catch (error) {
    console.error('Resend sendMail failed:', error)
  }
}

function appUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  return base ? `${base}${path}` : path
}

/** Dekan yo'llanmani tasdiqlagach — talaba endi ro'yxatdan o'ta oladi. */
export async function sendPermitApprovedEmail(to: string, fullName: string, applicationType?: string) {
  // Imtiyozli/xorijiy arizachilar JShSHIR'siz — ular /register orqali
  // ro'yxatdan o'ta olmaydi (o'sha oqim JShSHIR talab qiladi). Ularga
  // "ro'yxatdan o'ting" havolasi noto'g'ri bo'lardi, shuning uchun matn ham
  // boshqacha: keyingi qadamlarni dekanat yuritadi.
  if (applicationType === 'imtiyozli') {
    await sendMail({
      to,
      subject: 'Yotoqxona arizangiz tasdiqlandi',
      heading: `${fullName}, arizangiz tasdiqlandi!`,
      paragraphs: [
        'Fakultet dekani yotoqxonaga joylashish arizangizni tasdiqladi.',
        "Xona biriktirilgach, bu haqda alohida xat yuboriladi. Qo'shimcha hujjat yoki ma'lumot kerak bo'lsa, fakultet dekanati siz bilan bog'lanadi.",
      ],
    })
    return
  }
  await sendMail({
    to,
    subject: "Yo'llanmangiz tasdiqlandi — ro'yxatdan o'tishingiz mumkin",
    heading: `${fullName}, yo'llanmangiz tasdiqlandi!`,
    paragraphs: [
      "Fakultet dekani yotoqxona yo'llanmangizni tasdiqladi. Endi tizimda ro'yxatdan o'tib, shaxsiy kabinetingizni yaratishingiz mumkin.",
      "Ro'yxatdan o'tishda yo'llanmangizdagi pasport seriyasi, JShSHIR va shu email manzilini kiriting.",
      "Xona ro'yxatdan o'tganingizdan so'ng biriktiriladi — bu haqda alohida xat yuboriladi.",
    ],
    cta: { label: "Ro'yxatdan o'tish", url: appUrl('/register') },
  })
}

// Dekan tasdiqni bekor qilib, arizani qayta ko'rib chiqishga qaytarganda.
// Arizachi allaqachon "tasdiqlandi" xatini olган bo'lishi mumkin, shuning
// uchun holat o'zgargani aniq aytiladi.
export async function sendPermitApprovalCancelledEmail(to: string, fullName: string) {
  await sendMail({
    to,
    subject: "Yotoqxona yo'llanmangiz qayta ko'rib chiqilmoqda",
    heading: `${fullName}, yo'llanmangiz holati o'zgardi`,
    paragraphs: [
      "Fakultet dekani yotoqxona yo'llanmangizni tasdiqdan qaytardi — ariza hozir «ko'rib chiqilmoqda» holatida.",
      "Agar siz ro'yxatdan o'tib ulgurган, ammo emailni hali tasdiqlamagan bo'lsangiz, o'sha yarim tayyor hisob bekor qilindi. Yo'llanma qayta tasdiqlangач, qaytadan ro'yxatdan o'tishingiz kerak bo'ladi.",
      "Sabablarini bilish uchun fakultet dekanatiga murojaat qiling.",
    ],
  })
}

/**
 * Dekan ogohlantirish yoki eslatma yuborganda. 'warning' talabaning
 * intizomiy hisobiga qo'shiladi, 'info' esa faqat xabar — xat matni ham
 * shunga qarab ohangini o'zgartiradi, chunki bu farq talaba uchun muhim.
 */
export async function sendStudentWarningEmail(
  to: string,
  fullName: string,
  level: 'info' | 'warning',
  message: string,
) {
  const isWarning = level === 'warning'
  await sendMail({
    to,
    subject: isWarning ? 'Yotoqxona: rasmiy ogohlantirish' : 'Yotoqxona: eslatma',
    heading: isWarning ? `${fullName}, sizga rasmiy ogohlantirish berildi` : `${fullName}, sizga eslatma bor`,
    paragraphs: [
      message,
      isWarning
        ? "Ushbu ogohlantirish intizomiy hisobingizga qo'shildi. Belgilangan chegaradan oshib ketsa, yotoqxonadan chetlatilishga sabab bo'lishi mumkin."
        : "Bu eslatma intizomiy hisobingizga ta'sir qilmaydi.",
      "Savollaringiz bo'lsa, fakultet dekaniga murojaat qiling.",
    ],
    cta: { label: 'Shaxsiy kabinet', url: appUrl('/talaba/dashboard') },
  })
}

/** Dekan xona biriktirgach — talabaga xona raqami xabar qilinadi. */
export async function sendRoomAssignedEmail(to: string, fullName: string, roomNumber: string) {
  await sendMail({
    to,
    subject: `Sizga ${roomNumber}-xona biriktirildi`,
    heading: `${fullName}, sizga xona biriktirildi!`,
    paragraphs: [
      `Yotoqxonadan sizga ${roomNumber}-xona ajratildi.`,
      "Ko'chib o'tish tartibi, to'lov va yotoqxona qoidalari bilan shaxsiy kabinetingizda tanishib chiqishingiz mumkin.",
    ],
    cta: { label: 'Shaxsiy kabinet', url: appUrl('/talaba/dashboard') },
  })
}
