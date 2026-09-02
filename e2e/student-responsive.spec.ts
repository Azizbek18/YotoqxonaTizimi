import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

test.describe('student mobile responsiveness', () => {
  test.skip(process.env.RUN_AUTHENTICATED_RESPONSIVE_E2E !== '1', 'Requires an isolated temporary Supabase student')
  test.describe.configure({ mode: 'serial' })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`
  const email = `tmp-responsive-${stamp}@example.com`
  const password = `Tmp-${randomBytes(16).toString('base64url')}!9a`
  const passport = `RF${randomBytes(4).toString('hex').toUpperCase()}`
  const jshshir = `8${randomBytes(8).readBigUInt64BE().toString().padStart(20, '0').slice(0, 13)}`
  let userId: string | null = null
  let permitId: string | null = null

  test.beforeAll(async () => {
    if (!url || !serviceKey) throw new Error('Supabase test environment is missing')
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error) throw created.error
    userId = created.data.user.id

    const permit = await service.from('permit_requests').insert({
      passport_series: passport,
      jshshir,
      full_name: 'TEMP RESPONSIVE STUDENT',
      email,
      phone: '+998000000000',
      gender: 'male',
      faculty: 'amit',
      direction: 'Axborot tizimlari va texnologiyalari',
      course: 1,
      permit_url: 'e2e/responsive',
      status: 'approved',
    }).select('id').single()
    if (permit.error) throw permit.error
    permitId = permit.data.id

    const profile = await service.from('users').insert({
      id: userId,
      email,
      full_name: 'TEMP RESPONSIVE STUDENT',
      role: 'talaba',
      status: 'active',
      faculty: 'amit',
      gender: 'male',
      avatar_url: '/logo.png',
      passport_series: passport,
      jshshir,
    })
    if (profile.error) throw profile.error
  })

  test.afterAll(async () => {
    if (!url || !serviceKey) return
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    if (userId) await service.from('users').delete().eq('id', userId)
    if (permitId) await service.from('permit_requests').delete().eq('id', permitId)
    if (userId) await service.auth.admin.deleteUser(userId)
  })

  test('dashboard and payment page fit down to 320px', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/login')
    await page.getByPlaceholder('misol@gmail.com').fill(email)
    await page.getByPlaceholder('••••••••').fill(password)
    await page.getByRole('button', { name: 'Tizimga kirish' }).click()
    await page.waitForURL('**/talaba/dashboard', { timeout: 30_000 })

    const sizes = [
      { width: 320, height: 568 },
      { width: 360, height: 640 },
      { width: 390, height: 844 },
    ]
    const routes = ['/talaba/dashboard', '/talaba/tolova']

    for (const size of sizes) {
      await page.setViewportSize(size)
      for (const route of routes) {
        await page.goto(route)
        await page.waitForLoadState('networkidle')
        await expect(page.locator('main')).toBeVisible()

        const metrics = await page.evaluate(() => {
          const nav = document.querySelector('nav')?.getBoundingClientRect()
          const header = document.querySelector('header')?.getBoundingClientRect()
          return {
            viewportWidth: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            navLeft: nav?.left ?? -1,
            navRight: nav?.right ?? window.innerWidth + 1,
            headerLeft: header?.left ?? -1,
            headerRight: header?.right ?? window.innerWidth + 1,
          }
        })

        expect(metrics.documentWidth, `${route} overflows at ${size.width}px`).toBeLessThanOrEqual(metrics.viewportWidth + 1)
        expect(metrics.navLeft).toBeGreaterThanOrEqual(0)
        expect(metrics.navRight).toBeLessThanOrEqual(metrics.viewportWidth)
        expect(metrics.headerLeft).toBeGreaterThanOrEqual(0)
        expect(metrics.headerRight).toBeLessThanOrEqual(metrics.viewportWidth)

        if (route === '/talaba/dashboard') {
          const roomCard = page
            .getByText('Yotgan joyi', { exact: false })
            .locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " rounded-3xl ")][1]')
          await expect(roomCard).toBeVisible()
          await roomCard.screenshot({ path: testInfo.outputPath(`room-card-${size.width}.png`) })
        }

        await page.screenshot({
          path: testInfo.outputPath(`${route.split('/').pop()}-${size.width}x${size.height}.png`),
          fullPage: true,
        })
      }
    }
  })
})
