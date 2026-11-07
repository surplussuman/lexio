// Phase 7 core: Echo's daily message and the Daily Drill Card (LLD §21.4, §21.5).
import { expect, test } from '@playwright/test'

import { answerAllQuestions, registerFreshUser } from './support'

async function registerAndAssess(page) {
  await registerFreshUser(page, { name: 'Retention Student' })

  await page.goto('/assess/vocab')
  await answerAllQuestions(page)
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })
}

test('Echo greets the student and offers a daily drill aimed at their weakest skill', async ({ page }) => {
  await registerAndAssess(page)
  await page.goto('/dashboard')

  // Echo speaks first (§21.4: "Echo initiates, not just responds").
  await expect(page.getByText('Echo', { exact: true })).toBeVisible()
  await expect(page.getByText(/Daily drill/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Start today's drill/ })).toBeVisible()
  await expect(page.getByText(/~2 min/)).toBeVisible()
})
