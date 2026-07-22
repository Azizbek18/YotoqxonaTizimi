export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getApiError(error: unknown, fallback = 'Server xatoligi') {
  if (error instanceof ApiError) {
    return { status: error.status, body: { error: error.message, code: error.code } }
  }
  return { status: 500, body: { error: fallback } }
}
