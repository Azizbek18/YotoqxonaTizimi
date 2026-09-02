import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { sendTelegramAdminMessage } from '@/lib/telegram'
import { sendStudentTelegram } from '@/lib/student-telegram'
import { sendArizaSignedEmail } from '@/lib/email'
import { cyrillicToLatin } from '@/lib/transliterate'
import { permitFacultyLabel } from '@/lib/faculties'
import { composeArizaFullText } from '@/lib/student-ariza-template'
import {
  buildArizaSnapshot,
  canonicalJson,
  makeVerifyCode,
  normalizeVerifyCode,
  sha256Hex,
  signAriza,
  verifyArizaRecord,
} from '@/lib/ariza-signature'
import type { ApplicationListKind } from '../types'
import {
  parseFormalAriza,
  parseSignatureInput,
  parseStudentApplication,
  type SignatureInput,
} from '../domain/validation'
import { createApplicationRepository, type ApplicationRepository } from './repository'

const allowedKinds = new Set<ApplicationListKind>(['documents', 'warnings', 'chat', 'notifications'])

// Only formal paperwork the student is accountable for needs a signature.
// 'chat' messages and 'taklif' (feedback to the developer) do not.
const SIGNED_TYPES = new Set(['ariza', 'tushuntirish'])

export type SignatureEvidence = { ip: string | null; userAgent: string | null }

function text(value: unknown, max: number, required = false) {
  const normalized = typeof value === 'string' ? value.trim().slice(0, max) : ''
  if (required && !normalized) throw new ApiError(400, 'Majburiy maydonlar to\'ldirilmagan')
  return normalized
}

// Loose match: script, case, spacing and apostrophes don't matter, but the
// student must actually type their own name — an empty box or "asdf" fails.
function nameKey(value: unknown): string {
  return cyrillicToLatin(String(value ?? '')).toUpperCase().replace(/[^A-ZА-Я]/g, '')
}

type ArizaRowLite = {
  id: string
  student_id: string | null
  student_name: string | null
  faculty: string | null
  direction: string | null
  course: number | null
  title: string | null
  type: string | null
  reason: string | null
  text: string
}

export function createApplicationService(repository: ApplicationRepository = createApplicationRepository()) {
  async function signAndFinalise(
    ariza: ArizaRowLite,
    signer: { name: string; email: string | null },
    signatureInput: SignatureInput | null,
    evidence: SignatureEvidence,
    extraSnapshot: Record<string, unknown> = {},
  ) {
    const profileName = signer.name
    if (!signatureInput || !signatureInput.attested) {
      throw new ApiError(400, 'Arizani yuborishdan oldin imzolang: F.I.Sh.ingizni kiriting va tasdiqlang.')
    }
    // A hand-drawn signature stands in for the typed name; otherwise the
    // typed name must match the profile.
    const typedName = signatureInput.typedName || profileName
    if (!signatureInput.image) {
      if (!nameKey(typedName) || nameKey(typedName) !== nameKey(profileName)) {
        throw new ApiError(400, 'Imzo uchun F.I.Sh.ingizni to\'liq va to\'g\'ri kiriting (profilingizdagidek).')
      }
    }

    const signedAt = new Date().toISOString()
    const signatureImageHash = signatureInput.image ? sha256Hex(signatureInput.image) : null
    const snapshot = {
      ...buildArizaSnapshot({
        arizaId: ariza.id,
        studentId: ariza.student_id ?? '',
        studentName: profileName,
        faculty: ariza.faculty,
        direction: ariza.direction,
        course: ariza.course,
        title: ariza.title ?? '',
        type: ariza.type ?? '',
        reason: ariza.reason ?? '',
        text: ariza.text ?? '',
        signedAt,
      }),
      signatureImageHash,
      ...extraSnapshot,
    }
    const contentHash = sha256Hex(canonicalJson(snapshot))
    const verifyCode = makeVerifyCode()
    const signature = signAriza({ contentHash, studentId: ariza.student_id ?? '', signedAt, verifyCode })

    try {
      await repository.insertSignature({
        ariza_id: ariza.id,
        student_id: ariza.student_id ?? '',
        content_hash: contentHash,
        content_snapshot: snapshot,
        typed_name: typedName,
        signed_at: signedAt,
        client_ip: evidence.ip,
        user_agent: evidence.userAgent ? evidence.userAgent.slice(0, 400) : null,
        verify_code: verifyCode,
        signature,
        signature_image: signatureInput.image ?? null,
      })
    } catch (err) {
      // e.g. UNIQUE(ariza_id) — already signed. Surface the existing record.
      const existing = await repository.signatureByAriza(ariza.id)
      if (existing) {
        const current = await repository.getOwned(ariza.student_id ?? '', ariza.id)
        return {
          application: current ?? ariza,
          receipt: receiptDto(existing.verify_code, existing.signed_at, existing.content_hash),
        }
      }
      throw err
    }

    const submitted = await repository.submitOwnedDraft(ariza.student_id ?? '', ariza.id)
    if (!submitted) {
      // The draft was decided out from under us between the fetch and now.
      await repository.deleteSignatureByAriza(ariza.id)
      throw new ApiError(409, 'Ariza allaqachon ko\'rib chiqilgan yoki yuborilgan.')
    }

    // Timestamped out-of-band copies — both channels when available.
    const notice = { title: ariza.title ?? '', type: ariza.type ?? 'ariza', verifyCode, signedAt }
    if (signer.email) {
      await sendArizaSignedEmail(signer.email, profileName, notice)
        .catch(() => { /* best-effort — the signature already stands */ })
    }
    if (ariza.student_id) {
      const kind = notice.type === 'tushuntirish' ? 'Tushuntirish' : 'Ariza'
      const when = new Date(signedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
      await sendStudentTelegram(
        ariza.student_id,
        `📄 <b>${kind} imzolandi</b>\n\n«${(ariza.title ?? '').replaceAll('<', '&lt;')}»\n${when} (Toshkent)\n\nTekshiruv kodi: <code>${verifyCode}</code>\n\nAgar bu arizani siz imzolamagan bo‘lsangiz — darhol dekanatga xabar bering.`,
        {
          parseMode: 'HTML',
          replyMarkup: { inline_keyboard: [[{ text: 'Imzoni tekshirish', url: `${process.env.NEXT_PUBLIC_APP_URL}/ariza-tekshirish?code=${encodeURIComponent(verifyCode)}` }]] },
        },
      ).catch(() => {})
    }

    return { application: submitted, receipt: receiptDto(verifyCode, signedAt, contentHash) }
  }

  return {
    async list(studentId: string, kindValue: string | null, limitValue: string | null) {
      const kind = allowedKinds.has(kindValue as ApplicationListKind)
        ? kindValue as ApplicationListKind
        : 'documents'
      const limit = Math.min(Math.max(Number(limitValue) || 100, 1), 100)
      return { success: true as const, applications: await repository.list(studentId, kind, limit) }
    },

    async create(studentId: string, value: unknown, evidence: SignatureEvidence = { ip: null, userAgent: null }) {
      const input = parseStudentApplication(value)
      const signatureInput = parseSignatureInput((value as Record<string, unknown>)?.signature)
      const profile = await repository.getStudentDetails(studentId)
      if (!profile) throw new ApiError(404, 'Talaba profili topilmadi')

      const needsSignature = SIGNED_TYPES.has(input.type) && input.status !== 'draft'

      const created = await repository.create({
        student_id: studentId,
        student_name: profile.full_name,
        faculty: profile.faculty,
        direction: profile.direction,
        course: profile.course ?? 1,
        title: input.title,
        type: input.type,
        reason: input.reason,
        text: input.text,
        level: input.level,
        // A signed type is always parked as a draft first, then flipped to
        // 'pending' only after the signature row lands.
        status: needsSignature ? 'draft' : input.status,
        ai_generated: Boolean(input.aiGenerated),
        date: new Date().toISOString(),
      })

      if (needsSignature) {
        const result = await signAndFinalise(
          created as ArizaRowLite,
          { name: profile.full_name ?? '', email: profile.email ?? null },
          signatureInput,
          evidence,
        )
        return { success: true as const, application: result.application, receipt: result.receipt }
      }

      if (input.type === 'taklif') {
        await sendTelegramAdminMessage(
          `Yangi taklif/xabar\n\nTalaba: ${profile.full_name}\nFakultet: ${profile.faculty ?? '-'}\nYo'nalish: ${profile.direction ?? '-'}\n\n${input.text}`,
        ).catch(() => {})
      }

      return { success: true as const, application: created }
    },

    /** The formal composer: server builds the UzMU-style text, then signs it
     *  with the student's hand-drawn signature in one step. */
    async createFormalAriza(
      studentId: string,
      value: unknown,
      evidence: SignatureEvidence = { ip: null, userAgent: null },
    ) {
      const input = parseFormalAriza(value)
      const profile = await repository.getStudentDetails(studentId)
      if (!profile) throw new ApiError(404, 'Talaba profili topilmadi')

      if (nameKey(input.fullName) !== nameKey(profile.full_name)) {
        throw new ApiError(400, 'F.I.Sh profilingizdagi bilan mos kelishi kerak.')
      }

      const facultyLabel = permitFacultyLabel(profile.faculty ?? '') || (profile.faculty ?? '')
      const dekanName = input.recipient === 'dekan'
        ? await repository.dekanNameForFaculty(profile.faculty ?? '')
        : null

      const compose = {
        kind: input.kind,
        recipient: input.recipient,
        fullName: input.fullName,
        facultyLabel,
        course: profile.course ?? 1,
        ttjNumber: input.ttjNumber,
        room: input.room,
        incidentText: input.incidentText,
        dekanName,
      } as const
      const fullText = composeArizaFullText(compose)

      const created = await repository.create({
        student_id: studentId,
        student_name: profile.full_name,
        faculty: profile.faculty,
        direction: profile.direction,
        course: profile.course ?? 1,
        title: input.title,
        type: input.kind,
        reason: input.incidentText.slice(0, 4000),
        text: fullText,
        level: 'info',
        status: 'draft',
        ai_generated: false,
        date: new Date().toISOString(),
      })

      const result = await signAndFinalise(
        created as ArizaRowLite,
        { name: profile.full_name ?? '', email: profile.email ?? null },
        { typedName: input.fullName, attested: true, image: input.signatureImage },
        evidence,
        { formal: compose },
      )
      return {
        success: true as const,
        application: result.application,
        receipt: result.receipt,
        compose,
      }
    },

    async submit(
      studentId: string,
      idValue: unknown,
      signatureValue: unknown,
      evidence: SignatureEvidence = { ip: null, userAgent: null },
    ) {
      const id = text(idValue, 80, true)
      const draft = await repository.getOwnedDraft(studentId, id)
      if (!draft) throw new ApiError(404, 'Ariza topilmadi yoki allaqachon ko\'rib chiqilgan')

      if (!SIGNED_TYPES.has(draft.type ?? '')) {
        const submitted = await repository.submitOwnedDraft(studentId, id)
        if (!submitted) throw new ApiError(404, 'Ariza topilmadi yoki allaqachon ko\'rib chiqilgan')
        return { success: true as const, application: submitted }
      }

      const profile = await repository.getStudentDetails(studentId)
      const result = await signAndFinalise(
        draft as ArizaRowLite,
        { name: profile?.full_name ?? draft.student_name ?? '', email: profile?.email ?? null },
        parseSignatureInput(signatureValue),
        evidence,
      )
      return { success: true as const, application: result.application, receipt: result.receipt }
    },

    async remove(studentId: string, idValue: string | null) {
      const id = text(idValue, 80, true)
      const deleted = await repository.deleteOwned(studentId, id)
      if (!deleted) throw new ApiError(404, 'Ariza topilmadi yoki o\'chirib bo\'lmaydi (imzolangan)')
      return { success: true as const }
    },

    /** The student re-opens their own signature receipt. */
    async receipt(studentId: string, arizaIdValue: string | null) {
      const arizaId = text(arizaIdValue, 80, true)
      const owned = await repository.getOwned(studentId, arizaId)
      if (!owned) throw new ApiError(404, 'Ariza topilmadi')
      const sig = await repository.signatureByAriza(arizaId)
      if (!sig) throw new ApiError(404, 'Bu ariza imzolanmagan')
      return {
        success: true as const,
        receipt: {
          ...receiptDto(sig.verify_code, sig.signed_at, sig.content_hash),
          title: owned.title,
          type: owned.type,
          studentName: owned.student_name,
        },
      }
    },

    /** Public: anyone with the code confirms who signed what, when. */
    async verifyByCode(codeValue: unknown) {
      const code = normalizeVerifyCode(codeValue)
      if (!code) return { valid: false as const }
      const sig = await repository.signatureByCode(code)
      if (!sig) return { valid: false as const }

      const check = verifyArizaRecord({
        contentSnapshot: sig.content_snapshot,
        contentHash: sig.content_hash,
        studentId: sig.student_id,
        signedAt: sig.signed_at,
        verifyCode: sig.verify_code,
        signature: sig.signature,
      })
      const snap = sig.content_snapshot as Record<string, unknown>
      return {
        valid: check.valid,
        hashOk: check.hashOk,
        signatureOk: check.signatureOk,
        signedBy: typeof snap.studentName === 'string' ? snap.studentName : sig.typed_name,
        signedAt: sig.signed_at,
        title: typeof snap.title === 'string' ? snap.title : null,
        type: typeof snap.type === 'string' ? snap.type : null,
        code: sig.verify_code,
        signatureImage: sig.signature_image ?? null,
      }
    },

    /** Prefill data for the formal composer's preview. */
    async arizaContext(studentId: string) {
      const profile = await repository.getStudentDetails(studentId)
      if (!profile) throw new ApiError(404, 'Talaba profili topilmadi')
      const [dekanName, ttjNumber] = await Promise.all([
        repository.dekanNameForFaculty(profile.faculty ?? ''),
        repository.ttjNumberForFaculty(profile.faculty ?? ''),
      ])
      return {
        fullName: profile.full_name ?? '',
        facultyLabel: permitFacultyLabel(profile.faculty ?? '') || (profile.faculty ?? ''),
        course: profile.course ?? 1,
        room: profile.room_number ?? '',
        ttjNumber: ttjNumber ?? '',
        dekanName,
      }
    },

    /** Everything needed to (re)generate the signed PDF. Student can only see
     *  their own; staff see any. */
    async documentData(arizaIdValue: string | null, opts: { studentId?: string } = {}) {
      const arizaId = text(arizaIdValue, 80, true)
      const owned = opts.studentId
        ? await repository.getOwned(opts.studentId, arizaId)
        : await repository.arizaById(arizaId)
      if (!owned) throw new ApiError(404, 'Ariza topilmadi')
      const sig = await repository.signatureByAriza(arizaId)
      if (!sig) throw new ApiError(404, 'Bu ariza imzolanmagan')
      const snap = sig.content_snapshot as Record<string, unknown>
      return {
        success: true as const,
        formal: (snap.formal as Record<string, unknown>) ?? null,
        text: typeof snap.text === 'string' ? snap.text : owned.text,
        title: typeof snap.title === 'string' ? snap.title : owned.title,
        type: typeof snap.type === 'string' ? snap.type : owned.type,
        signatureImage: sig.signature_image ?? null,
        signedAt: sig.signed_at,
        verifyCode: sig.verify_code,
      }
    },

    /** Staff panel: the full evidence bundle for one application. */
    async staffSignature(arizaIdValue: string | null) {
      const arizaId = text(arizaIdValue, 80, true)
      const ariza = await repository.arizaById(arizaId)
      if (!ariza) throw new ApiError(404, 'Ariza topilmadi')
      const sig = await repository.signatureByAriza(arizaId)
      if (!sig) {
        return { success: true as const, signed: false as const, arizaStatus: ariza.status }
      }
      const check = verifyArizaRecord({
        contentSnapshot: sig.content_snapshot,
        contentHash: sig.content_hash,
        studentId: sig.student_id,
        signedAt: sig.signed_at,
        verifyCode: sig.verify_code,
        signature: sig.signature,
      })
      return {
        success: true as const,
        signed: true as const,
        signature: {
          verifyCode: sig.verify_code,
          signedAt: sig.signed_at,
          typedName: sig.typed_name,
          contentHash: sig.content_hash,
          clientIp: sig.client_ip,
          userAgent: sig.user_agent,
          hasImage: Boolean(sig.signature_image),
          valid: check.valid,
          hashOk: check.hashOk,
          signatureOk: check.signatureOk,
        },
      }
    },
  }
}

function receiptDto(verifyCode: string, signedAt: string, contentHash: string) {
  return {
    verifyCode,
    signedAt,
    contentHash,
    hashShort: contentHash.slice(0, 16),
  }
}
