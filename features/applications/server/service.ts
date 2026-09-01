import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { sendTelegramAdminMessage } from '@/lib/telegram'
import { sendArizaSignedEmail } from '@/lib/email'
import { cyrillicToLatin } from '@/lib/transliterate'
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
import { parseSignatureInput, parseStudentApplication, type SignatureInput } from '../domain/validation'
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
  ) {
    const profileName = signer.name
    if (!signatureInput || !signatureInput.attested) {
      throw new ApiError(400, 'Arizani yuborishdan oldin imzolang: F.I.Sh.ingizni kiriting va tasdiqlang.')
    }
    if (!nameKey(signatureInput.typedName) || nameKey(signatureInput.typedName) !== nameKey(profileName)) {
      throw new ApiError(400, 'Imzo uchun F.I.Sh.ingizni to\'liq va to\'g\'ri kiriting (profilingizdagidek).')
    }

    const signedAt = new Date().toISOString()
    const snapshot = buildArizaSnapshot({
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
    })
    const contentHash = sha256Hex(canonicalJson(snapshot))
    const verifyCode = makeVerifyCode()
    const signature = signAriza({ contentHash, studentId: ariza.student_id ?? '', signedAt, verifyCode })

    try {
      await repository.insertSignature({
        ariza_id: ariza.id,
        student_id: ariza.student_id ?? '',
        content_hash: contentHash,
        content_snapshot: snapshot,
        typed_name: signatureInput.typedName,
        signed_at: signedAt,
        client_ip: evidence.ip,
        user_agent: evidence.userAgent ? evidence.userAgent.slice(0, 400) : null,
        verify_code: verifyCode,
        signature,
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

    if (signer.email) {
      await sendArizaSignedEmail(signer.email, profileName, {
        title: ariza.title ?? '',
        type: ariza.type ?? 'ariza',
        verifyCode,
        signedAt,
      }).catch(() => { /* email is best-effort — the signature already stands */ })
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
