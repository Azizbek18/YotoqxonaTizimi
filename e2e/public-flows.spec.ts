import { expect, test } from '@playwright/test'

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
