import { expect, test } from '@playwright/test'
import { jsPDF } from 'jspdf'

// CI runs the app against a placeholder Supabase URL, so any assertion that
// needs a real query to answer (vs. an auth guard that rejects before the DB)
// is skipped there. Matches the RUN_AUTHENTICATED_RESPONSIVE_E2E gate in
// student-responsive.spec.ts.
const hasRealSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  && !process.env.NEXT_PUBLIC_SUPABASE_URL!.includes('example.supabase.co')

test('login sahifasi ochiladi', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Tizimga kirish' })).toBeVisible()
})

test('sessiyasiz superadmin sahifasi login sahifasiga qaytaradi', async ({ page }) => {
  await page.goto('/dekan/dekanlar')
  await expect(page).toHaveURL(/\/login$/)
})

test('ariza yuborish sahifasida doimiy dasturchi yordami mavjud', async ({ page }) => {
  await page.goto('/ariza-yuborish')
  const support = page.locator('a[href="https://t.me/Azizbek_04_18"]')
  await expect(support).toBeVisible()
  await expect(support).toHaveAttribute('target', '_blank')
})

test('ariza holatini tekshirish yozuvi o‘zbekcha ko‘rsatiladi', async ({ page }) => {
  await page.goto('/ruxsatnoma-yuborish')
  await expect(page.getByText(/ariza holatini tekshirish/i)).toBeVisible()
})

test('yo‘qlama API sessiyasiz yopiq', async ({ request }) => {
  const session = await request.get('/api/attendance/session')
  expect(session.status()).toBe(401)

  const summary = await request.get('/api/attendance/summary')
  expect(summary.status()).toBe(401)

  // Cron endpoint rejects a missing / wrong bearer secret.
  const cron = await request.post('/api/attendance/cron')
  expect(cron.status()).toBe(401)
  const cronWrong = await request.post('/api/attendance/cron', {
    headers: { authorization: 'Bearer definitely-not-the-secret' },
  })
  expect(cronWrong.status()).toBe(401)
})

test('sessiyasiz sardor yo‘qlama sahifasi login sahifasiga qaytaradi', async ({ page }) => {
  await page.goto('/sardor/yoqlama')
  await expect(page).toHaveURL(/\/login$/)
})

test('ariza imzosini tekshirish sahifasi ochiladi', async ({ page }) => {
  await page.goto('/ariza-tekshirish')
  await expect(page.getByPlaceholder('YT-XXXX-XXXX')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Ariza imzosini tekshirish/i })).toBeVisible()
})

test('ariza imzo API: imzolash va staff dalili sessiyasiz yopiq', async ({ request }) => {
  // Auth guards reject before any DB query, so these hold with or without a
  // real Supabase.
  const submit = await request.patch('/api/student/applications', { data: { id: 'x' } })
  expect(submit.status()).toBe(401)
  const staff = await request.get('/api/staff/ariza-signature?arizaId=x')
  expect([401, 403]).toContain(staff.status())
})

test('ariza imzo verify: noma’lum kodni hech qachon tasdiqlamaydi', async ({ request }, testInfo) => {
  test.skip(!hasRealSupabase, 'Public verify endpoint queries ariza_signatures — needs a real Supabase')
  const testIp = testInfo.project.name === 'mobile-chrome' ? '198.51.100.202' : '198.51.100.201'
  const verify = await request.get('/api/ariza-signature/verify?code=YT-ZZZZ-ZZZZ', {
    headers: { 'x-forwarded-for': testIp },
  })
  expect(verify.status()).toBe(200)
  expect((await verify.json()).valid).toBe(false)
})

test('yo‘llanma PDF’i AI tekshiruvi uchun JPEG ga aylantiriladi', async ({ page }) => {
  test.setTimeout(90_000)
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await page.goto('/ruxsatnoma-yuborish')
  const warningButton = page.getByRole('button', { name: 'Tushundim, davom etaman' })
  await warningButton.click()
  await expect(warningButton).toBeHidden()
  await page.getByPlaceholder('Familiya Ism Sharif').fill('TESTOV TALABA SINOV OGLI')
  await page.getByPlaceholder('misol@gmail.com').fill('test@example.com')
  await page.getByPlaceholder('901234567').fill('901234567')
  await page.getByPlaceholder('911234567').fill('911234567')
  await page.getByRole('button', { name: 'Erkak' }).click()
  await page.getByRole('button', { name: /Keyingi/i }).click()

  await page.getByRole('button', { name: "Yo'nalishni tanlang" }).click()
  await page.getByRole('button', { name: 'Mexanika va matematik modellashtirish' }).click()
  await page.getByRole('button', { name: 'Davlat granti' }).click()
  await page.getByRole('button', { name: 'Viloyatni tanlang' }).click()
  await page.getByRole('button', { name: 'Andijon', exact: true }).click()
  await page.getByRole('button', { name: /Keyingi/i }).click()

  await page.getByPlaceholder('AA1234567').fill('AA1234567')
  await page.getByPlaceholder('30102030405060').fill('12345678901234')

  const pdf = new jsPDF({ format: 'a4' })
  pdf.setFontSize(24)
  pdf.text("YO'LLANMA / TEST PDF", 25, 35)
  await page.locator('input[type="file"]').setInputFiles({
    name: 'yollanma.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf.output('arraybuffer')),
  })

  await expect(page.getByText('yollanma.jpg')).toBeVisible({ timeout: 20_000 })
  expect(pageErrors).toEqual([])
})

test('yo‘llanma oqimi Ariza + Tilxatni majburiy yuklab olishni talab qiladi', async ({ page }) => {
  test.setTimeout(90_000)
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await page.goto('/ruxsatnoma-yuborish')
  await page.getByRole('button', { name: 'Tushundim, davom etaman' }).click()

  // Step 1 — shaxsiy
  await page.getByPlaceholder('Familiya Ism Sharif').fill('TESTOV TALABA SINOV OGLI')
  await page.getByPlaceholder('misol@gmail.com').fill('test@example.com')
  await page.getByPlaceholder('901234567').fill('901234567')
  await page.getByPlaceholder('911234567').fill('911234567')
  await page.getByRole('button', { name: 'Erkak' }).click()
  await page.getByRole('button', { name: /Keyingi/i }).click()

  // Step 2 — o‘qish + yangi maydonlar
  await page.getByRole('button', { name: "Yo'nalishni tanlang" }).click()
  await page.getByRole('button', { name: 'Mexanika va matematik modellashtirish' }).click()
  await page.getByRole('button', { name: 'Davlat granti' }).click()
  await page.getByRole('button', { name: 'Viloyatni tanlang' }).click()
  await page.getByRole('button', { name: 'Andijon', exact: true }).click()
  await page.getByRole('button', { name: /Keyingi/i }).click()

  // Step 3 — hujjat
  await page.getByPlaceholder('AA1234567').fill('AA1234567')
  await page.getByPlaceholder('30102030405060').fill('12345678901234')
  const pdf = new jsPDF({ format: 'a4' })
  pdf.text('YO‘LLANMA / TEST PDF', 25, 35)
  await page.locator('input[type="file"]').setInputFiles({
    name: 'yollanma.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf.output('arraybuffer')),
  })
  await expect(page.getByText('yollanma.jpg')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /Keyingi/i }).click()

  // Step 4 — tekshirish card → go to the Ariza step
  await page.getByRole('button', { name: /Ariza va Tilxat/i }).click()

  // Step 5 — the Ariza + Tilxat itself renders, with the applicant's data
  await expect(page.getByRole('heading', { name: 'A R I Z A' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'T I L X A T' })).toBeVisible()
  // The applicant's step-2 answers landed in the document text.
  await expect(page.getByText(/Andijon\s+viloyatidan kelganligim/).first()).toBeVisible()

  // Submit is gated until the PDF is downloaded.
  const submit = page.getByRole('button', { name: 'Tasdiqlayman, Yuborish' })
  await expect(submit).toBeDisabled()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Ariza va Tilxatni yuklab olish/i }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^Ariza-Tilxat_.*\.pdf$/)

  await expect(page.getByRole('button', { name: /Yuklab olindi/i })).toBeVisible()
  await expect(submit).toBeEnabled()
  expect(pageErrors).toEqual([])
})
