import { spawn } from 'node:child_process'
import process from 'node:process'

const root = new URL('../', import.meta.url)
const isWindows = process.platform === 'win32'
const authenticated = process.argv.includes('--authenticated')
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== '--authenticated')
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL
const port = process.env.E2E_PORT ?? '3100'
const localBaseUrl = `http://127.0.0.1:${port}`

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: false,
      ...options,
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${code ?? signal ?? 'unknown status'}`))
    })
  })
}

async function waitUntilReady(url, child) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`E2E server exited before becoming ready (code ${child.exitCode})`)
    }
    try {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(2_000) })
      if (response.status < 500) return
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`E2E server did not become ready within 120s: ${url}`)
}

async function stopProcessTree(child) {
  if (!child || child.exitCode !== null) return

  if (isWindows) {
    child.kill('SIGTERM')
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ])
    if (child.exitCode !== null) return

    await new Promise((resolve) => {
      const killer = spawn('C:\\Windows\\System32\\taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      killer.once('error', resolve)
      killer.once('exit', resolve)
    })
    return
  }

  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

function assertAuthenticatedEnvironment() {
  if (!authenticated) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !serviceKey || url.includes('example.supabase.co') || serviceKey === 'test-service-role-key') {
    throw new Error(
      'Authenticated E2E requires an isolated test Supabase project in NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    )
  }
  if (process.env.E2E_ALLOW_DATABASE_WRITES !== '1') {
    throw new Error(
      'Authenticated E2E creates temporary database rows. Set E2E_ALLOW_DATABASE_WRITES=1 only for an isolated test project.',
    )
  }
}

async function runPlaywright(baseUrl) {
  const env = {
    ...process.env,
    PLAYWRIGHT_BASE_URL: baseUrl,
    ...(authenticated ? { RUN_AUTHENTICATED_RESPONSIVE_E2E: '1' } : {}),
  }
  await run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...forwardedArgs], { env })
}

let server
let stopping = false

async function cleanup() {
  if (stopping) return
  stopping = true
  await stopProcessTree(server)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    cleanup().finally(() => process.exit(130))
  })
}

try {
  if (authenticated) {
    try {
      process.loadEnvFile('.env.local')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  assertAuthenticatedEnvironment()
  if (externalBaseUrl) {
    await runPlaywright(externalBaseUrl)
  } else {
    if (process.env.E2E_SKIP_BUILD !== '1') {
      await run(process.execPath, ['node_modules/next/dist/bin/next', 'build'])
    }
    server = spawn(
      process.execPath,
      ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port],
      { cwd: root, stdio: 'inherit', shell: false },
    )
    await waitUntilReady(localBaseUrl, server)
    await runPlaywright(localBaseUrl)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await cleanup()
}
