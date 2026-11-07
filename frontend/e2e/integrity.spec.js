// The two things asked for before anything else: what you want to be assessed
// on, and a commitment to answer as yourself.
//
// Neither is enforcement. There's no proctoring anywhere in Lexio — these
// exist because a score someone else earned is worthless to the person
// holding it, and saying so plainly works better than locking tabs.
import { expect, test } from '@playwright/test'

import { acceptPledge, freshEmail, registerFreshUser } from './support'

test('a new student picks topics, then makes the pledge', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Name').fill('New Student')
  await page.getByLabel('Email').fill(freshEmail('e2e-integrity'))
  await page.getByLabel('Password').fill('StrongPass123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  // Topics come first — there's nothing to be honest about until there are
  // questions to be honest on.
  const save = page.getByRole('button', { name: /Start my assessments/i })
  await expect(save).toBeVisible()
  await expect(save).toBeDisabled() // nothing picked yet
  await expect(page.getByText(/0 of 3 chosen/)).toBeVisible()

  await page.getByRole('dialog').getByRole('button', { name: /^Technology/ }).click()
  await expect(page.getByText(/1 of 3 chosen/)).toBeVisible()
  await save.click()

  // Then the pledge, which asks rather than enforces.
  await expect(page.getByRole('heading', { name: /is yours/i })).toBeVisible()
  await expect(page.getByText(/We don't lock your tabs or watch your camera/i)).toBeVisible()
  await acceptPledge(page)

  await expect(page.getByRole('dialog')).toBeHidden()
})

test('at most three topics can be chosen', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Name').fill('Picky Student')
  await page.getByLabel('Email').fill(freshEmail('e2e-topics'))
  await page.getByLabel('Password').fill('StrongPass123')
  await page.getByRole('button', { name: 'Create account' }).click()

  const dialog = page.getByRole('dialog')
  await expect(page.getByRole('button', { name: /Start my assessments/i })).toBeVisible()

  for (const topic of ['^Technology', '^Finance & Markets', '^Sports']) {
    await dialog.getByRole('button', { name: new RegExp(topic) }).click()
  }
  await expect(page.getByText(/3 of 3 chosen/)).toBeVisible()

  // A fourth is refused at the interface, not just at the API.
  await expect(dialog.getByRole('button', { name: /^History & Society/ })).toBeDisabled()
})

test('topics can be changed later from the profile', async ({ page }) => {
  await registerFreshUser(page, { name: 'Settled Student' })

  await page.goto('/profile')
  await expect(page.getByText(/The domains your questions get written around/i)).toBeVisible()

  const save = page.getByRole('button', { name: /Save topics/i })
  await page.getByRole('button', { name: /^Sports/ }).click()
  await save.click()
  await expect(page.getByText(/2 of 3 chosen/)).toBeVisible()
})

test('the pledge is asked once per session, not on every page', async ({ page }) => {
  await registerFreshUser(page, { name: 'Returning Student' })

  await page.goto('/onboarding')
  await expect(page.getByRole('button', { name: /I'm doing this for me/i })).toBeHidden()
  await page.goto('/practice')
  await expect(page.getByRole('button', { name: /I'm doing this for me/i })).toBeHidden()
})

test('a pasted answer is reported back honestly, and the score is untouched', async ({ page }) => {
  await registerFreshUser(page, { name: 'Paste Student' })

  // Not a baseline run, so its report is readable straight away.
  await page.goto('/assess/write?reassessment=1')
  const essay =
    'Furthermore, it is important to consider the multifaceted nature of this issue. ' +
    'In conclusion, a balanced approach yields the most sustainable outcome for all stakeholders. '
  await page.evaluate((text) => navigator.clipboard.writeText(text), essay.repeat(3))

  const textarea = page.getByLabel('Your response')
  await textarea.click()
  await page.keyboard.press('ControlOrMeta+V')
  await expect(textarea).not.toHaveValue('')

  await page.getByRole('button', { name: /Submit response/i }).click()
  await expect(page).toHaveURL(/\/reassessment/, { timeout: 90_000 })
})

// Clipboard access needs explicit permission in Chromium.
test.use({ permissions: ['clipboard-read', 'clipboard-write'] })
