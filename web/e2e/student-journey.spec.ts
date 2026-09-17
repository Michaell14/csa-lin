import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('email').fill('bob@upenn.edu')
  await page.getByPlaceholder('password').fill('password123')
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Wang Lin' })).toBeVisible()
})

test('a student can find themselves and inspect their profile', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chrome') {
    await expect(page.getByRole('button', { name: 'Graph', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('complementary', { name: 'Person profile' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('button', { name: 'My profile' }).click()
  } else {
    await page.getByRole('button', { name: 'Find me' }).click()
  }
  await expect(page.getByRole('complementary', { name: 'Person profile' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bob Chen' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible()
})

test('a student can browse a lin as a class-year list', async ({ page }) => {
  await page.getByRole('button', { name: 'List', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Class of 2022' })).toBeVisible()
  const profile = page.getByRole('complementary', { name: 'Person profile' })
  if (await profile.isVisible()) await profile.getByRole('button', { name: 'Close panel' }).click()
  await page.getByRole('button', { name: /^DZ Derek Zhang/ }).click()
  await expect(page.getByRole('heading', { name: 'Derek Zhang' })).toBeVisible()
})

test('a student can search across people', async ({ page }) => {
  const search = page.getByRole('combobox', { name: 'Find a person' })
  await search.fill('Cathy')
  await page.getByRole('option', { name: /Cathy Liu/ }).click()
  await expect(page.getByRole('heading', { name: 'Cathy Liu' })).toBeVisible()
})

test.describe('mid-size screen', () => {
  test.use({ viewport: { width: 700, height: 900 } })

  test('opens the graph without a profile sheet, even with a saved list view', async ({ page }) => {
    await page.evaluate(() => window.localStorage.setItem('lins.view', 'list'))
    await page.reload()
    await expect(page.getByRole('button', { name: 'Graph', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('complementary', { name: 'Person profile' })).toHaveCount(0)
  })
})
