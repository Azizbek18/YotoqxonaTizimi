// The formal on-screen preview of a registered student's ariza / tushuntirish.
// Same wording the server composes (lib/student-ariza-template) and the same
// the PDF renders (lib/student-ariza-pdf) — so what the student signs is what
// they saw. Times/serif, white sheet, blanks left as underscores.

import {
  applicantLine,
  arizaHeadingText,
  composeArizaBody,
  recipientLine,
  type ArizaComposeInput,
} from '@/lib/student-ariza-template'

export type StudentArizaDocData = ArizaComposeInput & {
  /** Trimmed PNG data URL of the hand-drawn signature, once captured. */
  signatureImage?: string | null
  signedAt?: string | null
  verifyCode?: string | null
}

export default function StudentArizaDocument({ data }: { data: StudentArizaDocData }) {
  const body = composeArizaBody(data)
  const dateStr = data.signedAt
    ? new Date(data.signedAt).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' })
    : '____.____.20____'

  return (
    <div
      className="mx-auto max-w-[820px] rounded-2xl border border-slate-300 bg-white p-6 text-black shadow-xl sm:p-10"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      <div className="ml-auto max-w-[78%] space-y-1 text-right text-[11px] leading-snug sm:text-sm">
        <p>{recipientLine(data.recipient, { facultyLabel: data.facultyLabel, dekanName: data.dekanName })}</p>
        <p>{applicantLine(data)}</p>
      </div>

      <h2 className="my-6 text-center text-sm font-bold tracking-[0.35em] sm:text-lg">
        {arizaHeadingText(data.kind)}
      </h2>

      <div className="space-y-3 text-justify text-[11px] leading-relaxed sm:text-sm">
        {body.split('\n\n').map((para, i) => (
          <p key={i} className="indent-8">{para}</p>
        ))}
      </div>

      {/* Signature row */}
      <div className="mt-10 flex items-end justify-between text-[11px] sm:text-sm">
        <div>
          <p>Sana: {dateStr}</p>
        </div>
        <div className="text-center">
          {data.signatureImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.signatureImage} alt="imzo" className="mx-auto mb-1 h-12 object-contain" />
          ) : (
            <div className="mb-1 h-12" />
          )}
          <div className="w-44 border-t border-black" />
          <p className="mt-1 text-[9px] sm:text-xs">{data.fullName || '(imzo / F.I.Sh.)'}</p>
        </div>
      </div>

      {data.verifyCode && (
        <div className="mt-8 border-t border-dashed border-slate-400 pt-3 text-[9px] leading-relaxed text-slate-600 sm:text-[11px]">
          <p>
            Elektron imzolangan hujjat. Tekshiruv kodi: <span className="font-bold">{data.verifyCode}</span>
          </p>
          <p>Haqiqiyligini tekshirish: meningyotoqxonam.uz/ariza-tekshirish</p>
        </div>
      )}
    </div>
  )
}
