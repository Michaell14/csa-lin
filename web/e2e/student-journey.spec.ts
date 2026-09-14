import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('email').fill('bob@upenn.edu')
  await page.getByPlaceholder('password').fill('password123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Wang Lin' })).toBeVisible()
})

test('a student can find themselves and inspect their profile', async ({ page }) => {
  await page.getByRole('button', { name: 'Find me' }).click()
  await expect(page.getByRole('complementary', { name: 'Person profile' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bob Chen' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible()
})

test('a student can browse a lin as a class-year list', async ({ page }) => {
  await page.getByRole('button', { name: 'List', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Class of 2022' })).toBeVisible()
  await page.getByRole('button', { name: /^DZ Derek Zhang/ }).click()
  await expect(page.getByRole('heading', { name: 'Derek Zhang' })).toBeVisible()
})

test('a student can search across people', async ({ page }) => {
  const search = page.getByRole('combobox', { name: 'Find a person' })
  await search.fill('Cathy')
  await page.getByRole('option', { name: /Cathy Liu/ }).click()
  await expect(page.getByRole('heading', { name: 'Cathy Liu' })).toBeVisible()
})
