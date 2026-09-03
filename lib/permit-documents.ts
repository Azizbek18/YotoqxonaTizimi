import 'server-only'

import { getServiceSupabase } from '@/lib/server-supabase'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { normalizeFaculty, permitFacultyLabel } from '@/lib/faculties'
import { extractFloor } from '@/lib/floor'
import { sendTelegramDocument } from '@/lib/telegram'
import { sendPermitDocumentsEmail } from '@/lib/email'
import { renderArizaTilxatPdfBytes, arizaTilxatFileName } from '@/lib/ariza-tilxat-pdf'

// Automatic Ariza + Tilxat: the applicant draws one signature when they
// submit the permit (saveStudentSignature). Once the dekan has approved the
// permit AND assigned a room, deliverPermitDocuments() renders the fully
// signed PDF server-side and sends it — Telegram if the applicant linked the
// bot, otherwise email, with an email->Telegram fallback. `delivered_at` is
// written exactly once, so re-running the room assignment is a no-op.

const MAX_SIGNATURE_BYTES = 260_000
const DATA_URL_PNG = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/

export type DeliveryOutcome =
  | 'delivered'
  | 'deferred_no_dekan_signature'
  | 'deferred_no_channel'
  | 'skipped_not_ready'
  | 'skipped_already'
  | 'skipped_no_document'

export function isValidSignatureDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = value.match(DATA_URL_PNG)
  if (!match) return false
  // base64 length * 3/4 ≈ decoded bytes
  return Math.floor((match[1].length * 3) / 4) <= MAX_SIGNATURE_BYTES
}

type Supabase = ReturnType<typeof getServiceSupabase>

export type DeliveryDeps = {
  supabase: Supabase
  renderPdf: typeof renderArizaTilxatPdfBytes
  sendTelegram: typeof sendTelegramDocument
  sendEmail: typeof sendPermitDocumentsEmail
  getSettings: (faculty?: string) => Promise<{ ttjName: string }>
}

function defaultDeps(): DeliveryDeps {
  return {
    supabase: getServiceSupabase(),
    renderPdf: renderArizaTilxatPdfBytes,
    sendTelegram: sendTelegramDocument,
    sendEmail: sendPermitDocumentsEmail,
    getSettings: (faculty) => createAppSettingsService().get(faculty),
  }
}

/**
 * Persist the applicant's hand-drawn signature at submit time. Re-signing
 * (an edit / resubmission) replaces the row and drops any prior dekan /
 * delivery state so the document is regenerated cleanly.
 */
export async function saveStudentSignature(input: {
  permitRequestId: string
  signatureDataUrl: string
  ip?: string | null
  userAgent?: string | null
}): Promise<void> {
  if (!isValidSignatureDataUrl(input.signatureDataUrl)) {
    throw new Error('Imzo tasviri noto‘g‘ri')
  }
  const supabase = getServiceSupabase()
  const now = new Date().toISOString()
  const { error } = await supabase.from('permit_documents').upsert(
    {
      permit_request_id: input.permitRequestId,
      student_signature: input.signatureDataUrl,
      student_signed_at: now,
      student_ip: input.ip ?? null,
      student_user_agent: (input.userAgent ?? null)?.slice(0, 400) ?? null,
      dekan_staff_id: null,
      dekan_name: null,
      dekan_signature: null,
      ariza_no: null,
      assigned_floor: null,
      assigned_room: null,
      pdf_path: null,
      delivered_at: null,
      delivery_channel: null,
      delivery_error: null,
      updated_at: now,
    },
    { onConflict: 'permit_request_id' },
  )
  if (error) throw error
}

async function resolveFloor(supabase: Supabase, roomNumber: string): Promise<number | null> {
  const { data } = await supabase
    .from('floor_room_layout')
    .select('floor_number')
    .eq('room_number', roomNumber)
    .limit(1)
    .maybeSingle()
  return data?.floor_number ?? extractFloor(roomNumber)
}

async function nextArizaNo(supabase: Supabase, faculty: string): Promise<string> {
  const { count } = await supabase
    .from('permit_documents')
    .select('permit_request_id, permit_requests!inner(faculty)', { count: 'exact', head: true })
    .not('delivered_at', 'is', null)
    .ilike('permit_requests.faculty', faculty)
  const seq = (count ?? 0) + 1
  return `YT-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`
}

async function telegramChatFor(
  supabase: Supabase,
  permitRequestId: string,
  registeredStudentId: string | null,
): Promise<string | null> {
  const { data: permitLink } = await supabase
    .from('permit_telegram_links')
    .select('chat_id')
    .eq('permit_request_id', permitRequestId)
    .maybeSingle()
  if (permitLink?.chat_id != null) return String(permitLink.chat_id)

  if (registeredStudentId) {
    const { data: studentLink } = await supabase
      .from('student_telegram_links')
      .select('chat_id')
      .eq('student_id', registeredStudentId)
      .maybeSingle()
    if (studentLink?.chat_id != null) return String(studentLink.chat_id)
  }
  return null
}

export function createPermitDocumentDelivery(deps: DeliveryDeps = defaultDeps()) {
  const { supabase } = deps

  async function deliver(
    permitRequestId: string,
    signer?: { id?: string | null; fullName?: string | null },
  ): Promise<DeliveryOutcome> {
    const { data: doc, error: docError } = await supabase
      .from('permit_documents')
      .select('*')
      .eq('permit_request_id', permitRequestId)
      .maybeSingle()
    if (docError) throw docError
    if (!doc) return 'skipped_no_document'
    if (doc.delivered_at) return 'skipped_already'

    const { data: permit, error: permitError } = await supabase
      .from('permit_requests')
      .select('id, full_name, email, faculty, course, study_type, origin_country, origin_region, phone, relative_phone, application_type, status, room_number, passport_series, jshshir')
      .eq('id', permitRequestId)
      .maybeSingle()
    if (permitError) throw permitError
    if (!permit || permit.status !== 'approved') return 'skipped_not_ready'

    // The room is either pre-assigned on the permit, or (student already
    // registered) on their users row — match by passport / jshshir.
    let roomNumber = permit.room_number ?? null
    let registeredStudentId: string | null = null
    {
      const orParts: string[] = []
      if (permit.passport_series) orParts.push(`passport_series.eq.${permit.passport_series}`)
      if (permit.jshshir) orParts.push(`jshshir.eq.${permit.jshshir}`)
      if (orParts.length) {
        const { data: user } = await supabase
          .from('users')
          .select('id, room_number')
          .or(orParts.join(','))
          .maybeSingle()
        if (user) {
          registeredStudentId = user.id
          if (!roomNumber && user.room_number) roomNumber = user.room_number
        }
      }
    }
    if (!roomNumber) return 'skipped_not_ready'

    // Dekan signature: the assigning staff member, or (backlog sweep) the
    // faculty's dekan on record.
    let dekanStaffId = signer?.id ?? null
    let dekanName = signer?.fullName ?? null
    let dekanSignature: string | null = null
    {
      let query = supabase.from('staff').select('id, full_name, signature_image').not('signature_image', 'is', null)
      query = dekanStaffId
        ? query.eq('id', dekanStaffId)
        : query.ilike('faculty', permit.faculty).eq('role', 'dekan')
      const { data: staff } = await query.limit(1).maybeSingle()
      if (staff?.signature_image) {
        dekanStaffId = staff.id
        dekanName = staff.full_name
        dekanSignature = staff.signature_image
      }
    }
    if (!dekanSignature || !dekanName) return 'deferred_no_dekan_signature'

    const facultyKey = normalizeFaculty(permit.faculty) ?? undefined
    const { ttjName } = await deps.getSettings(facultyKey)
    const floor = await resolveFloor(supabase, roomNumber)
    const arizaNo = await nextArizaNo(supabase, permit.faculty)

    const pdfBytes = await deps.renderPdf({
      fullName: permit.full_name,
      facultyLabel: permitFacultyLabel(permit.faculty),
      course: permit.course,
      studyType: permit.study_type ?? '',
      originCountry: permit.origin_country ?? "O'zbekiston",
      originRegion: permit.origin_region ?? '',
      phone: (permit.phone ?? '').replace(/^\+998\s*/, '').trim(),
      relativePhone: permit.relative_phone ?? '',
      ttjName,
      studentSignature: doc.student_signature,
      dekanSignature,
      dekanName,
      arizaNo,
      assignedFloor: floor ?? undefined,
      assignedRoom: roomNumber,
      signedDate: doc.student_signed_at,
    })

    const filename = arizaTilxatFileName(permit.full_name)
    const pdfPath = `documents/${permitRequestId}.pdf`
    await supabase.storage.from('permits').upload(pdfPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })

    // Telegram first when linked (most reliable for a file, no rate limits);
    // otherwise email; on an email failure with Telegram available, retry it.
    const chatId = await telegramChatFor(supabase, permitRequestId, registeredStudentId)
    let channel: 'telegram' | 'email' | null = null
    let deliveryError: string | null = null

    const caption = `📄 Imzolangan Ariza va Tilxat — ${arizaNo}. ${roomNumber}-xona biriktirildi.`

    if (chatId) {
      const ok = await deps.sendTelegram(chatId, { filename, bytes: pdfBytes, caption })
      if (ok) channel = 'telegram'
    }
    if (!channel && permit.email) {
      const base64 = Buffer.from(pdfBytes).toString('base64')
      const { ok } = await deps.sendEmail(permit.email, permit.full_name, base64, filename)
      if (ok) channel = 'email'
      else {
        deliveryError = 'email_failed'
        if (chatId) {
          const retry = await deps.sendTelegram(chatId, { filename, bytes: pdfBytes, caption })
          if (retry) { channel = 'telegram'; deliveryError = null }
        }
      }
    }

    const now = new Date().toISOString()
    if (!channel) {
      await supabase.from('permit_documents').update({
        dekan_staff_id: dekanStaffId,
        dekan_name: dekanName,
        dekan_signature: dekanSignature,
        ariza_no: arizaNo,
        assigned_floor: floor,
        assigned_room: roomNumber,
        pdf_path: pdfPath,
        delivery_error: deliveryError ?? 'no_channel',
        updated_at: now,
      }).eq('permit_request_id', permitRequestId)
      return 'deferred_no_channel'
    }

    await supabase.from('permit_documents').update({
      dekan_staff_id: dekanStaffId,
      dekan_name: dekanName,
      dekan_signature: dekanSignature,
      ariza_no: arizaNo,
      assigned_floor: floor,
      assigned_room: roomNumber,
      pdf_path: pdfPath,
      delivered_at: now,
      delivery_channel: channel,
      delivery_error: null,
      updated_at: now,
    }).eq('permit_request_id', permitRequestId)
    return 'delivered'
  }

  return {
    deliver,
    /** Deliver every not-yet-delivered document for a faculty — run after a
     *  dekan saves their signature for the first time. */
    async deliverPending(faculty: string): Promise<void> {
      const { data: rows } = await supabase
        .from('permit_documents')
        .select('permit_request_id, permit_requests!inner(faculty, status)')
        .is('delivered_at', null)
        .ilike('permit_requests.faculty', faculty)
        .eq('permit_requests.status', 'approved')
      for (const row of rows ?? []) {
        try {
          await deliver(row.permit_request_id)
        } catch (error) {
          console.error('deliverPending failed for', row.permit_request_id, error)
        }
      }
    },
  }
}

/** Best-effort delivery — never throws, so it can be awaited straight after
 *  a room assignment without risking the dekan's decision. */
export async function deliverPermitDocumentsSafely(
  permitRequestId: string,
  signer?: { id?: string | null; fullName?: string | null },
): Promise<DeliveryOutcome | 'error'> {
  try {
    return await createPermitDocumentDelivery().deliver(permitRequestId, signer)
  } catch (error) {
    console.error('Permit document delivery failed:', error)
    return 'error'
  }
}

export async function deliverPendingPermitDocumentsSafely(faculty: string): Promise<void> {
  try {
    await createPermitDocumentDelivery().deliverPending(faculty)
  } catch (error) {
    console.error('Permit document backlog delivery failed:', error)
  }
}
