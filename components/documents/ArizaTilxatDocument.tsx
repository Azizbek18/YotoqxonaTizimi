// The filled Ariza + Tilxat — shared between the applicant's own preview
// (app/imtiyozli-ariza) and the dekan's read-only viewer
// (app/dekan/hujjat), so both sides see exactly the same document. Content
// is reconstructed from "++TTJ larga joylashtirish ariza va tilxat.docx"
// (UzMU's official template) with the applicant's data filling the blanks —
// the signature/date lines stay blank on purpose, never auto-filled.

const UNIVERSITY_HEADER = "Mirzo Ulug'bek nomidagi O'zbekiston Milliy universiteti Birinchi prorektori — Yoshlar masalalari va ma'naviy-ma'rifiy ishlar bo'yicha prorektor T.N.Xojiyevga"

const TILXAT_RULES = [
  "Universitet Kengashining 2021-yil 20-apreldagi 8-sonli yig'ilishida tasdiqlangan O'zMU \"Ichki tartib qoidalari\", \"Odob-ahloq qoidalari\" hamda 2019 yil 2 dekabrdagi universitet rektorining 01-989-sonli buyrug'i bilan tasdiqlangan \"Talabalar turar joylari to'g'risida\"gi Nizom, \"Talabalar turar joylari Ichki tartib qoidalari\" talablariga shuningdek, universitet bilan tuzilgan turar joyi bo'yicha shartnoma qoidalariga qat'iy rioya qilish;",
  "navbatchilik jadvaliga binoan yashash xonalarida, qavatlarda, umumiy foydalanish joylari (hojatxona, yuvinish xonasi, oshxona va boshqa joylar)da navbatchilik qilish;",
  "umumiy foydalanish joylari, yashash xonalari hamda dam olish joylarida namunali tozalikni tashkil etish, undagi jihozlardan to'g'ri va unumli foydalanish;",
  "gaz, elektr jihozlaridan hamda isitish tizimidan foydalanish qoidalariga qat'iy rioya qilish va ulardan oqilona foydalanish;",
  "belgilangan vaqtlar bo'yicha Talabalar turar joyi binosiga kirib-chiqish qoidalariga amal qilish;",
  "Talabalar turar joyidan uzoq muddatga ketayotib (yozgi va qishki ta'til, dam olish, amaliyot, akademik ta'til olgan hollar), turar joyi rahbarini uch kun oldin yozma ravishda ogohlantirish;",
  "kundalik ehtiyojga ega bo'lmagan katta hajmdagi shaxsiy va qimmatbaho buyumlarni turar joy binosiga olib kirmaslik;",
  "Talabalar turar joyida yashovchilar va xonadoshlar bilan doimo samimiy, ahil munosabatda bo'lish;",
  "Talabalar turar joyi mol-mulkidan to'g'ri va unumli foydalanish va zarar yetkazmaslik;",
  "yashash xonasiga begona shaxslarni olib kirmaslik hamda tunab qolishlari uchun joy bermaslik;",
  "Talabalar turar joyi atrofida, yashash xonasida spirtli ichimliklar, tamaki mahsulotlari, giyohvand moddalarini iste'mol qilmaslik shuningdek, ularni saqlash, sotish hamda qimor, totalizator o'yinlarini o'ynamaslik;",
  "Talabalar turar joyi xonalarida diniy marosimlarga oid tadbirlar, yig'inlar o'tkazmaslik, diniy saboq bermaslik va bunday materiallarni tarqatmaslik va saqlamaslik;",
  "o'quv yili yakunida menga berilgan xonani bo'shatish va o'rnatilgan tartibda bino boshlig'iga topshirish;",
  "Talabalar turar joylari uchun universitet tomonidan belgilangan oylik ijara to'lovini o'rnatilgan tartibda to'lash kabi qoidalarga qat'iy amal qilaman.",
]

export interface ArizaTilxatData {
  fullName: string
  facultyLabel: string
  course: string | number
  studyType: string
  originCountry: string
  originRegion: string
  phone: string
  relativePhone: string
  /** Dekan-configured official dormitory number/name (Sozlamalar). Empty
   *  until set, in which case the blank stays a literal blank line rather
   *  than silently guessing a number. */
  ttjName?: string

  // ---- Filled in only for the final, signed copy (server-side delivery) ----
  // The on-screen preview and the submit-time draft leave all of these unset,
  // so the signature/date lines render as blank underlines exactly as before.
  /** Applicant's hand-drawn signature, PNG data URL. */
  studentSignature?: string
  /** Dekan's hand-drawn signature, PNG data URL (staff.signature_image). */
  dekanSignature?: string
  /** Dekan's full name, printed under their signature. */
  dekanName?: string
  /** Dekanat registration number, e.g. "YT-2026-0042". */
  arizaNo?: string
  /** Assigned floor / room, printed into the "Berildi ___ qavat ___ xona" box. */
  assignedFloor?: number | string
  assignedRoom?: string
  /** ISO date the applicant signed — fills the "Sana" lines. */
  signedDate?: string
}

export default function ArizaTilxatDocument({ data }: { data: ArizaTilxatData }) {
  const { fullName, facultyLabel, course, studyType, originCountry, originRegion, phone, relativePhone, ttjName } = data
  const ttjBlank = ttjName?.trim() || '_____'

  return (
    <div className="space-y-6">
      {/* ARIZA */}
      <div className="bg-white text-black rounded-2xl sm:rounded-3xl border border-slate-300 p-5 sm:p-10 shadow-xl print-page" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        <p className="text-right text-[11px] sm:text-sm leading-snug max-w-[75%] ml-auto">{UNIVERSITY_HEADER}</p>
        <p className="text-right text-[11px] sm:text-sm mt-3">{facultyLabel} fakulteti</p>
        <p className="text-right text-[11px] sm:text-sm">Bakalavriat kunduzgi ta&apos;lim yo&apos;nalishi {course}-kurs talabasi {fullName || '_______________________'}</p>

        <h2 className="text-center font-bold tracking-[0.3em] text-sm sm:text-lg mt-6 mb-6">A R I Z A</h2>

        <p className="text-[11px] sm:text-sm leading-relaxed indent-8 text-justify">
          Men {fullName || '_______________________'} hozirgi kunda Mirzo Ulug&apos;bek nomidagi O&apos;zbekiston Milliy universitetining {facultyLabel} fakulteti bakalavriat kunduzgi ta&apos;lim yo&apos;nalishi {course}-kursida
          ( {studyType === 'grant' ? 'X' : '_'} budjet ) ( {studyType === 'kontrakt' ? 'X' : '_'}{' '}
          to&apos;lov-shartnoma ) asosida tahsil olaman.
        </p>
        <p className="text-[11px] sm:text-sm leading-relaxed indent-8 text-justify mt-3">
          {new Date().getFullYear()}/{new Date().getFullYear() + 1} o&apos;quv yilida an&apos;anaviy dars-mashg&apos;ulotlariga qatnashish uchun men {originCountry || '_______________'} davlati {originRegion || '_______________'}{' '}
          viloyatidan kelganligim, Toshkent shahrida turar joyim yo&apos;qligi sababli, universitetga qarashli {ttjBlank}-sonli talabalar turar joyidan yashash uchun joy berishingizni va u yerga ro&apos;yhatga olishingizni so&apos;rayman.
        </p>
        <p className="text-[11px] sm:text-sm leading-relaxed indent-8 text-justify mt-3">
          Universitet &quot;Talabalar turar joyi to&apos;g&apos;risida&quot;gi Nizom, &quot;Ichki tartib qoidalari&quot;, &quot;Odob-ahloq qoidalari&quot; va &quot;Talabalar turar joyi Ichki tartib qoidalari&quot;ga to&apos;liq rioya qilib,
          talabalar turar joylari uchun universitet tomonidan belgilangan oylik ijara to&apos;lovini o&apos;quv yili mobaynida o&apos;rnatilgan tartibda to&apos;lash, shaxsiy gigiena, sog&apos;lom turmush tarzi talablariga qat&apos;iy amal qilib
          yashashga va&apos;da beraman.
        </p>
        <p className="text-[11px] sm:text-sm leading-relaxed indent-8 text-justify mt-3">
          Pasportim va ijtimoiy mezonlarga muvofiqligimni tasdiqlovchi hujjatlar nusxalarini ilova qilmoqdaman. Ushbu ariza va unga ilova qilinayotgan hujjatlarda ko&apos;rsatilgan barcha ma&apos;lumotlarning haqiqiyligiga
          shaxsan o&apos;zim javobgarman. Agar men tomonimdan talabalar turar joyi ichki tartib qoidalari buzilsa, u holda menga Nizomda belgilangan tartibda chora ko&apos;rilishiga roziman.
        </p>

        {/* Signature block — deliberately left blank (no auto-fill): a real
            signature/date is added by hand later, not generated here. */}
        <div className="flex justify-between items-end mt-10 text-[11px] sm:text-sm">
          <div className="text-center">
            <p>_____________________________</p>
            <p className="text-[9px] sm:text-xs mt-1">(imzo)</p>
          </div>
          <div className="text-center">
            <p>_____________________________</p>
            <p className="text-[9px] sm:text-xs mt-1">(F.I.Sh.)</p>
          </div>
        </div>
        <div className="flex justify-between items-end mt-6 text-[11px] sm:text-sm">
          <p>Talaba tel: {phone ? `+998 ${phone}` : '_____________________'}</p>
        </div>
        <div className="flex justify-between items-end mt-1 text-[11px] sm:text-sm">
          <p>Yaqin qarindoshi tel: {relativePhone || '_____________________'}</p>
          <div className="text-center">
            <p>_____________________</p>
            <p className="text-[9px] sm:text-xs mt-1">Sana</p>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-dashed border-slate-400 text-[9px] sm:text-[11px] italic leading-relaxed space-y-1">
          <p className="not-italic font-bold">Eslatma:</p>
          <p>Agar talaba chin yetim yoki mehribonlik uyi tarbiyalanuvchisi bo&apos;lsa, guvohnomalarning nusxasi;</p>
          <p>Agar talabada I va II guruh nogironligi to&apos;g&apos;risida ma&apos;lumotnoma bo&apos;lsa, ma&apos;lumotnomadan nusxa;</p>
          <p>Agar talaba kam ta&apos;minlangan oila farzandi bo&apos;lsa jumladan, &quot;Ijtimoiy himoya yagona reestri&quot; avtomatlashtirilgan tizimi tomonidan shakillantirilgan hujjat, &quot;temir&quot; daftarga kiruvchi
            oila farzandi, onasi &quot;Ayollar daftari&quot;ga kiritilgan oila farzandi bo&apos;lganlar talab etiladi.</p>
        </div>

        <div className="flex justify-end gap-8 mt-6 text-[10px] sm:text-xs">
          <p>Ariza № _________</p>
          <p>Berildi _____ qavat _____ xona</p>
        </div>
      </div>

      {/* TILXAT */}
      <div className="bg-white text-black rounded-2xl sm:rounded-3xl border border-slate-300 p-5 sm:p-10 shadow-xl print-page" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        <p className="text-right text-[11px] sm:text-sm leading-snug max-w-[75%] ml-auto">{UNIVERSITY_HEADER}</p>
        <p className="text-right text-[11px] sm:text-sm mt-3">{facultyLabel} fakulteti</p>
        <p className="text-right text-[11px] sm:text-sm">Bakalavriat kunduzgi ta&apos;lim yo&apos;nalishi {course}-kurs talabasi {fullName || '_______________________'}</p>

        <h2 className="text-center font-bold tracking-[0.3em] text-sm sm:text-lg mt-6 mb-6">T I L X A T</h2>

        <p className="text-[11px] sm:text-sm leading-relaxed indent-8 text-justify">
          Men {fullName || '_______________________'} {facultyLabel} fakulteti bakalavriat ta&apos;lim yo&apos;nalishi {course}-kurs talabasi {ttjBlank}-sonli Talabalar turar joyida yashash davrimda quyidagilarga:
        </p>

        <ol className="list-disc pl-5 text-[10px] sm:text-[13px] leading-relaxed text-justify mt-3 space-y-1.5">
          {TILXAT_RULES.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ol>

        <p className="text-[11px] sm:text-sm leading-relaxed mt-4">
          Agar men ushbu qoidalarga amal qilmasam yoki boshqa tarzda bo&apos;yin tovlasam Nizomda belgilangan tartibda menga chora ko&apos;rilishi xaqida ogohlantirildim.
        </p>

        <div className="flex justify-between items-end mt-10 text-[11px] sm:text-sm">
          <div className="text-center">
            <p>_____________________________</p>
            <p className="text-[9px] sm:text-xs mt-1">(imzo)</p>
          </div>
          <div className="text-center">
            <p>_____________________________</p>
            <p className="text-[9px] sm:text-xs mt-1">(F.I.Sh.)</p>
          </div>
        </div>
        <div className="flex justify-end mt-6 text-[11px] sm:text-sm">
          <div className="text-center">
            <p>_____________________</p>
            <p className="text-[9px] sm:text-xs mt-1">Sana</p>
          </div>
        </div>
      </div>
    </div>
  )
}
