import { NextRequest, NextResponse } from 'next/server'
import { createStoryService } from '@/features/stories/server/service'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request, { allowBlacklisted: true })
    const stories = await createStoryService().listForStudent(student.faculty)
    return NextResponse.json({ stories })
  } catch (error) {
    console.error('Stories GET xato:', error)
    const response = getApiError(error, "Yangiliklarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
