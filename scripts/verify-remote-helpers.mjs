export function errorMessage(error) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    return [error.code, error.message, error.details, error.hint]
      .filter(Boolean)
      .join(' | ')
  }
  return String(error)
}

export function isPermissionDeniedError(error) {
  if (!error) return false
  const message = errorMessage(error)
  if (/invalid api key/i.test(message)) return false
  const code = error && typeof error === 'object' ? error.code : null
  return code === '42501' || /permission denied|not authorized|insufficient privilege/i.test(message)
}
