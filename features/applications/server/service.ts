import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { ApplicationListKind } from '../types'
import { parseStudentApplication } from '../domain/validation'
import { createApplicationRepository, type ApplicationRepository } from './repository'

const allowedKinds = new Set<ApplicationListKind>(['documents', 'warnings', 'chat', 'notifications'])
function text(value: unknown, max: number, required = false) {
  const normalized = typeof value === 'string' ? value.trim().slice(0, max) : ''
  if (required && !normalized) throw new ApiError(400, 'Majburiy maydonlar to\'ldirilmagan')
  return normalized
}

export function createApplicationService(repository: ApplicationRepository = createApplicationRepository()) {
  return {
    async list(studentId: string, kindValue: string | null, limitValue: string | null) {
      const kind = allowedKinds.has(kindValue as ApplicationListKind)
        ? kindValue as ApplicationListKind
        : 'documents'
      const limit = Math.min(Math.max(Number(limitValue) || 100, 1), 100)
      return { success: true as const, applications: await repository.list(studentId, kind, limit) }
    },

    async create(studentId: string, value: unknown) {
      const input = parseStudentApplication(value)
      const profile = await repository.getStudentDetails(studentId)
      if (!profile) throw new ApiError(404, 'Talaba profili topilmadi')
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
        status: input.status,
        ai_generated: Boolean(input.aiGenerated),
        date: new Date().toISOString(),
      })
      return { success: true as const, application: created }
    },

    async submit(studentId: string, idValue: unknown) {
      const id = text(idValue, 80, true)
      const application = await repository.updateOwned(studentId, id, { status: 'pending' })
      if (!application) throw new ApiError(404, 'Ariza topilmadi')
      return { success: true as const, application }
    },

    async remove(studentId: string, idValue: string | null) {
      const id = text(idValue, 80, true)
      const deleted = await repository.deleteOwned(studentId, id)
      if (!deleted) throw new ApiError(404, 'Ariza topilmadi')
      return { success: true as const }
    },
  }
}
