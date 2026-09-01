import { expect, test } from '@playwright/test'
import { jsPDF } from 'jspdf'

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

test('yo‘llanma PDF’i AI tekshiruvi uchun JPEG ga aylantiriladi', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await page.goto('/ruxsatnoma-yuborish')
  const warningButton = page.getByRole('button', { name: 'Tushundim, davom etaman' })
  await warningButton.click()
  await expect(warningButton).toBeHidden()
  await page.getByPlaceholder('Familiya Ism Sharif').fill('TESTOV TALABA SINOV OGLI')
  await page.getByPlaceholder('misol@gmail.com').fill('test@example.com')
  await page.getByPlaceholder('901234567').fill('901234567')
  await page.getByRole('button', { name: 'Erkak' }).click()
  await page.getByRole('button', { name: /Keyingi/i }).click()

  await page.getByRole('button', { name: "Yo'nalishni tanlang" }).click()
  await page.getByRole('button', { name: 'Mexanika va matematik modellashtirish' }).click()
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
