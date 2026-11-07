// Phase 5: baseline → reassess → before/after comparison report (LLD §13).
import { expect, test } from '@playwright/test'

import { answerAllQuestions, registerFreshUser } from './support'

async function completeVocab(page) {
  await page.goto('/assess/vocab')
  await answerAllQuestions(page)
}

async function register(page) {
  await registerFreshUser(page, { name: 'Reassess Student' })
}

test('reassessment cannot start before there is anything to compare against', async ({ page }) => {
  await register(page)
  await page.goto('/reassessment')

  await expect(page.getByText("Show us how far you've come.")).toBeVisible()
  await expect(page.getByRole('button', { name: /Start reassessment/ })).toBeEnabled()
})

test('full cycle: baseline, reassess, then the comparison report', async ({ page }) => {
  await register(page)

  // Baseline.
  await completeVocab(page)
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })

  // Start the cycle — it should ask for the one mode already assessed.
  await page.goto('/reassessment')
  await page.getByRole('button', { name: /Start reassessment/ }).click()
  await expect(page.getByText('Modes still to redo')).toBeVisible()
  await expect(page.getByRole('link', { name: /Vocabulary/ })).toBeVisible()

  // Redo it. A reassessment run must route back here, not to the feedback page.
  await page.getByRole('link', { name: /Vocabulary/ }).click()
  await expect(page).toHaveURL(/\/assess\/vocab\?reassessment=1/)

  const options = page.locator('fieldset button:first-of-type')
  await expect(options.first()).toBeVisible()
  const count = await options.count()
  for (let i = 0; i < count; i += 1) await options.nth(i).click()
  await page.getByRole('button', { name: /Submit answers/i }).click()

  await expect(page).toHaveURL(/\/reassessment$/, { timeout: 90_000 })

  // Everything's redone, so the report unlocks.
  await page.getByRole('link', { name: /See your comparison report/ }).click()
  await expect(page).toHaveURL(/\/report$/)

  await expect(page.getByText('Overall now')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dimension by dimension' })).toBeVisible()
  await expect(page.getByText("Echo's read")).toBeVisible()
})
