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
  /** Resend biriktirmalari — `content` base64 kodlangan fayl. */
  attachments?: { filename: string; content: string }[]
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

interface RenderedMail {
  to: string
  subject: string
  html: string
  text: string
  attachments?: { filename: string; content: string }[]
}

// Resend bepul rejasi kuniga 100 ta xat. Limit tugagach (429) har bir xat
// uchun Resend'ni qayta urib vaqt yo'qotmaslik uchun shu instansiyada bir
// muddat chetlab o'tamiz — xat darhol zaxira SMTP'ga ketadi.
const RESEND_QUOTA_BACKOFF_MS = 30 * 60_000
let resendBlockedUntil = 0

async function sendViaResend(mail: RenderedMail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || Date.now() < resendBlockedUntil) return false

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || DEFAULT_FROM,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.attachments?.length ? { attachments: mail.attachments } : {}),
      }),
    })
    if (!response.ok) {
      const detail = await response.text()
      if (response.status === 429 && detail.includes('quota')) {
        resendBlockedUntil = Date.now() + RESEND_QUOTA_BACKOFF_MS
      }
      console.error('Resend sendMail error:', response.status, detail)
      return false
    }
    return true
  } catch (error) {
    console.error('Resend sendMail failed:', error)
    return false
  }
}

// Zaxira kanallar — bepul SMTP hisoblar (masalan Gmail ilova paroli bilan,
// kuniga ~500 ta; yoki Brevo SMTP, kuniga 300 ta). Ketma-ket sinaladi:
// SMTP_HOST/PORT/USER/PASS/FROM, keyin SMTP_2_*, SMTP_3_*.
interface SmtpAccount {
  label: string
  host: string
  port: number
  user: string
  pass: string
  from: string
}

function smtpAccounts(): SmtpAccount[] {
  const accounts: SmtpAccount[] = []
  for (const prefix of ['SMTP', 'SMTP_2', 'SMTP_3']) {
    const host = process.env[`${prefix}_HOST`]?.trim()
    const user = process.env[`${prefix}_USER`]?.trim()
    // Gmail ilova paroli bo'shliqlar bilan ko'rsatiladi — ularni olib tashlaymiz.
    const pass = process.env[`${prefix}_PASS`]?.replace(/\s+/g, '')
    if (!host || !user || !pass) continue
    accounts.push({
      label: prefix,
      host,
      port: Number(process.env[`${prefix}_PORT`]) || 465,
      user,
      pass,
      from: process.env[`${prefix}_FROM`]?.trim() || `Yotoqxona tizimi <${user}>`,
    })
  }
  return accounts
}

async function sendViaSmtp(account: SmtpAccount, mail: RenderedMail): Promise<boolean> {
  try {
    const { createTransport } = await import('nodemailer')
    const transport = createTransport({
      host: account.host,
      port: account.port,
      secure: account.port === 465,
      auth: { user: account.user, pass: account.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
    await transport.sendMail({
      from: account.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        encoding: 'base64',
      })),
    })
    return true
  } catch (error) {
    console.error(`SMTP sendMail failed (${account.label}):`, error instanceof Error ? error.message : error)
    return false
  }
}

// Returns whether any provider accepted the message. Existing callers ignore
// the value (fire-and-forget); the permit-document delivery and the email
// code route use it. `ok: false` also covers "not configured" so an
// unconfigured environment falls through to the other channel.
export async function sendMail({
  to, subject, heading, paragraphs, cta, attachments,
}: MailInput): Promise<{ ok: boolean }> {
  if (!to) return { ok: false }
  const mail: RenderedMail = {
    to,
    subject,
    html: renderHtml({ heading, paragraphs, cta }),
    text: renderText({ heading, paragraphs, cta }),
    attachments,
  }

  if (await sendViaResend(mail)) return { ok: true }
  for (const account of smtpAccounts()) {
    if (await sendViaSmtp(account, mail)) return { ok: true }
  }
  return { ok: false }
}

function appUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  return base ? `${base}${path}` : path
}

/** Foydalanuvchi "barcha boshqa qurilmalardan chiqish"ni bosgach. */
export async function sendSessionsRevokedEmail(to: string, fullName: string, count: number) {
  await sendMail({
    to,
    subject: 'Xavfsizlik: boshqa qurilmalar chiqarildi',
    heading: `${fullName || 'Hurmatli foydalanuvchi'}, hisobingiz himoyalandi`,
    paragraphs: [
      `Hisobingizdan ${count} ta boshqa qurilma tizimdan chiqarildi. Endi faqat joriy qurilmangiz kirgan holatda.`,
      'Agar bu amalni siz bajarmagan bo‘lsangiz yoki hisobingiz xavf ostida deb hisoblasangiz, parolingizni darhol o‘zgartiring.',
    ],
    cta: { label: 'Parolni o‘zgartirish', url: appUrl('/talaba/profil') },
  })
}

/**
 * Talaba arizani elektron imzolagach — vaqti belgilangan tashqi nusxa.
 * Bu xat "men yozmaganman" bahsida dalil bo'ladi.
 */
export async function sendArizaSignedEmail(
  to: string,
  fullName: string,
  info: { title: string; type: string; verifyCode: string; signedAt: string },
) {
  const when = new Date(info.signedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
  const kind = info.type === 'tushuntirish' ? 'Tushuntirish' : 'Ariza'
  await sendMail({
    to,
    subject: `${kind} imzolandi — ${info.verifyCode}`,
    heading: `${fullName}, arizangiz elektron imzolandi`,
    paragraphs: [
      `«${info.title}» nomli ${kind.toLowerCase()} ${when} (Toshkent) da siz tomoningizdan elektron tasdiqlandi va dekanatga yuborildi.`,
      `Tekshiruv kodi: ${info.verifyCode}`,
      'Agar bu arizani siz imzolamagan bo\'lsangiz, darhol fakultet dekanatiga xabar bering.',
    ],
    cta: { label: 'Imzoni tekshirish', url: appUrl(`/ariza-tekshirish?code=${encodeURIComponent(info.verifyCode)}`) },
  })
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
 * Ariza ikki marta rad etilib bloklangandan keyin, blokdagi odam yana
 * yuborishga uringanda — yakuniy javob. Rasmiy ohang: "universitet ishchi
 * guruhi" degan formula foydalanuvchi so'roviga ko'ra.
 */
export async function sendPermitBlockedEmail(to: string, fullName: string) {
  await sendMail({
    to,
    subject: "Yotoqxona arizangiz bo'yicha yakuniy javob",
    heading: `${fullName || 'Hurmatli abituriyent'}, arizangiz bo'yicha yakuniy qaror`,
    paragraphs: [
      "Universitet ishchi guruhi sizning yotoqxona arizangizni ko'rib chiqib, rad etish xulosasini berdi.",
      "Ariza qayta ko'rib chiqilmaydi. Bir xil pasport seriyasi va JShSHIR bilan yangi ariza yuborib bo'lmaydi.",
      "Qaror bo'yicha savol yoki e'tirozingiz bo'lsa, fakultet dekanatiga bevosita murojaat qiling.",
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

/**
 * Dekan talabani yotoqxonadan chetlatganda yoki chetlatishni bekor
 * qilganda. Chetlatishda xona ham bo'shatiladi — matn shuni aytadi.
 */
export async function sendStudentBlacklistEmail(
  to: string,
  fullName: string,
  blacklisted: boolean,
  reason?: string,
) {
  if (blacklisted) {
    await sendMail({
      to,
      subject: 'Yotoqxona: yotoqxonadan chetlatildingiz',
      heading: `${fullName}, siz yotoqxonadan chetlatildingiz`,
      paragraphs: [
        'Fakultet dekani qaroriga ko\'ra siz yotoqxonadan chetlatildingiz. Sizga biriktirilgan xona bekor qilindi.',
        reason ? `Sabab: ${reason}` : 'Sabab dekanat tomonidan alohida ma\'lum qilinadi.',
        'Qaror bo\'yicha e\'tirozingiz bo\'lsa yoki masalani hal qilmoqchi bo\'lsangiz, zudlik bilan fakultet dekanatiga murojaat qiling.',
      ],
      cta: { label: 'Shaxsiy kabinet', url: appUrl('/talaba/qoidalar') },
    })
    return
  }
  await sendMail({
    to,
    subject: 'Yotoqxona: chetlatish bekor qilindi',
    heading: `${fullName}, chetlatish qarori bekor qilindi`,
    paragraphs: [
      'Fakultet dekani sizni yotoqxonadan chetlatish qarorini bekor qildi.',
      'Xona avtomatik qaytarilmaydi — joylashish uchun fakultet dekanatiga murojaat qiling.',
    ],
    cta: { label: 'Shaxsiy kabinet', url: appUrl('/talaba/dashboard') },
  })
}

/**
 * Xona biriktirilgach — imzolangan Ariza va Tilxat PDF biriktirma sifatida.
 * Telegram ulanmagan arizachilar uchun birlamchi kanal. Resend qabul
 * qildimi — shu qiymatni qaytaradi (qabul qilmasa, chaqiruvchi Telegramga
 * o'tadi).
 */
export async function sendPermitDocumentsEmail(
  to: string,
  fullName: string,
  pdfBase64: string,
  filename: string,
): Promise<{ ok: boolean }> {
  return sendMail({
    to,
    subject: 'Imzolangan Ariza va Tilxat',
    heading: `${fullName}, imzolangan hujjatlaringiz tayyor`,
    paragraphs: [
      'Fakultet dekani yotoqxona arizangizni tasdiqladi va sizga xona biriktirdi.',
      'Imzolangan Ariza va Tilxat (dekan va sizning elektron imzolaringiz bilan) ushbu xatga biriktirilgan. Uni saqlab qo‘ying — yotoqxonaga ko‘chib o‘tishda kerak bo‘ladi.',
    ],
    attachments: [{ filename, content: pdfBase64 }],
  })
}

/**
 * Xorijiy talabaga viza yoki propiska muddati tugash eslatmasi. Kunlik cron
 * chaqiradi — 30/15/10/5/3/0 kun qolganda, keyin muddat o'tgach 7 kun.
 */
export async function sendForeignDocReminderEmail(
  to: string,
  fullName: string,
  info: { docLabel: string; expiresOn: string; daysLeft: number },
) {
  const when = new Date(info.expiresOn).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const expired = info.daysLeft < 0
  const lead = expired
    ? `${info.docLabel} muddati ${Math.abs(info.daysLeft)} kun oldin — ${when} da tugagan.`
    : info.daysLeft === 0
      ? `${info.docLabel} muddati bugun (${when}) tugaydi.`
      : `${info.docLabel} muddati tugashiga ${info.daysLeft} kun qoldi (${when}).`
  await sendMail({
    to,
    subject: expired
      ? `${info.docLabel} muddati o'tgan — zudlik bilan harakat qiling`
      : `${info.docLabel} muddati tugayapti — ${info.daysLeft} kun qoldi`,
    heading: `${fullName || 'Hurmatli talaba'}, ${info.docLabel.toLowerCase()} muddatiga e'tibor bering`,
    paragraphs: [
      lead,
      expired
        ? "Muddati o'tgan hujjat jarima va O'zbekistondan chiqarib yuborilish (deportatsiya) xavfini keltiradi. Zudlik bilan universitet xalqaro bo'limi yoki fakultet dekanatiga murojaat qiling."
        : "Vizani yangilash yoki qaytadan ro'yxatga qo'yish uchun universitet xalqaro bo'limiga oldindan murojaat qiling — jarayon bir necha kun oladi.",
      "Yangilangач, yangi muddatni shaxsiy kabinetingizdagi «Hujjatlarim» bo'limiga kiriting.",
    ],
    cta: { label: 'Hujjatlarim', url: appUrl('/talaba/hujjatlarim') },
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

/** Email egaligini tasdiqlash kodi (lib/email-proof.ts). */
export async function sendEmailVerificationCode(to: string, code: string) {
  return sendMail({
    to,
    subject: `Tasdiqlash kodi: ${code}`,
    heading: 'Emailingizni tasdiqlang',
    paragraphs: [
      `Tasdiqlash kodingiz: ${code}`,
      'Kod 10 daqiqa amal qiladi. Uni saytdagi oynaga kiriting.',
      'Agar bu kodni siz so‘ramagan bo‘lsangiz, xatni e’tiborsiz qoldiring — kodni hech kimga bermang.',
    ],
  })
}
