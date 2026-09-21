import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Dev account email').fill('bob@upenn.edu')
  await page.getByLabel('Dev account password').fill('password123')
  await page.getByRole('button', { name: 'Sign in with dev account' }).click()
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

// Opening a lin or a person pushes a history entry, so Back has to undo exactly
// that step. The lin the page picks on arrival replaces its entry instead, so
// Back from the first profile lands on the lin rather than back at sign-in.
test('Back undoes opening a profile, then undoes switching lins', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'the lin list sits behind a toggle on a phone')

  const profile = page.getByRole('complementary', { name: 'Person profile' })
  const wang = page.getByRole('tab', { name: /^Wang Lin/ })
  const wu = page.getByRole('tab', { name: /^Wu Lin/ })

  await expect(wang).toHaveAttribute('aria-selected', 'true')
  const linUrl = page.url()

  await page.getByRole('button', { name: 'Find me' }).click()
  await expect(profile).toBeVisible()
  await expect(page).toHaveURL(/person=/)

  await page.goBack()
  await expect(profile).toHaveCount(0)
  await expect(page).toHaveURL(linUrl)
  await expect(wang).toHaveAttribute('aria-selected', 'true')

  await wu.click()
  await expect(wu).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Wu Lin' })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(linUrl)
  await expect(wang).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Wang Lin' })).toBeVisible()
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
