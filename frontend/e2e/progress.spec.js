// Phase 6: the per-dimension progress timeline (LLD §22.3). Its dashboard
// dimension-bar links only appear once the baseline is complete (see
// dashboard.spec.js), so this hits the page directly rather than paying for
// eight assessments just to click through to it.
import { expect, test } from '@playwright/test'

import { answerAllQuestions, registerFreshUser } from './support'

test('the timeline page renders a completed dimension, with the honesty caveat', async ({ page }) => {
  await registerFreshUser(page, { name: 'Progress Student' })

  // A vocabulary assessment gives the vocabulary dimension a score and a
  // session_scored progress event.
  await page.goto('/assess/vocab')
  await answerAllQuestions(page)
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })

  await page.goto('/progress/vocabulary')
  await expect(page.getByText('How this skill has moved.')).toBeVisible()
  await expect(page.getByText('Assessed')).toBeVisible()
})
