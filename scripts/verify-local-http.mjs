const baseUrl = process.env.APP_TEST_BASE_URL ?? 'http://127.0.0.1:3000'

const checks = [
  { path: '/', status: 200 },
  { path: '/login', status: 200 },
  { path: '/admin/login', status: 200 },
  { path: '/register', status: 200 },
  { path: '/admin/settings', status: 307, location: '/admin/login' },
  { path: '/admin/foydalanuvchilar', status: 307, location: '/admin/login' },
  { path: '/talaba/tolova', status: 307, location: '/login' },
  { path: '/talaba/dashboard', status: 307, location: '/login' },
  { path: '/api/settings', status: 401 },
  { path: '/api/admin/settings', status: 401 },
  { path: '/api/admin/users', status: 401 },
  { path: '/api/student/payments', status: 401 },
]

let failed = 0

for (const expected of checks) {
  try {
    const response = await fetch(new URL(expected.path, baseUrl), {
      redirect: 'manual',
    })
    const location = response.headers.get('location')
    const locationMatches = !expected.location
      || (location !== null && new URL(location, baseUrl).pathname === expected.location)
    const ok = response.status === expected.status && locationMatches

    if (!ok) failed += 1
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${expected.path} `
      + `(status ${response.status}${location ? `, redirect ${new URL(location, baseUrl).pathname}` : ''})`,
    )
  } catch (error) {
    failed += 1
    console.log(`FAIL ${expected.path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failed > 0) {
  process.exitCode = 1
} else {
  console.log(`Local HTTP verification passed (${checks.length}/${checks.length}).`)
}
