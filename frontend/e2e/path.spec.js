// Phase 2 golden path: assessment -> learning path is generated from the
// score gaps -> open a module -> complete an item -> XP moves. (What the
// dashboard shows or withholds along the way lives in dashboard.spec.js.)
import { expect, test } from '@playwright/test'

import { answerAllQuestions, registerFreshUser } from './support'

async function completeVocabAssessment(page) {
  await registerFreshUser(page, { name: 'Path Student' })

  await page.goto('/assess/vocab')
  await answerAllQuestions(page)
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })
}

test('learning path is generated and a module can be opened and progressed', async ({ page }) => {
  await completeVocabAssessment(page)

  await page.goto('/path')
  await expect(page.getByText('Built from your weakest dimensions.')).toBeVisible()

  // The path is ordered weakest-first and the top module must be actionable.
  const firstModule = page.locator('a[href^="/path/module/"]').first()
  await expect(firstModule).toBeVisible()
  await firstModule.click()

  await expect(page).toHaveURL(/\/path\/module\//)
  await expect(page.getByRole('button', { name: 'Mark complete' }).first()).toBeVisible()

  // Completing content is necessary but not sufficient — mastery is gated.
  await page.getByRole('button', { name: 'Mark complete' }).first().click()
  await expect(page.getByText('Done').first()).toBeVisible()
})

test('mastery gate refuses completion until the score threshold is met', async ({ page }) => {
  await completeVocabAssessment(page)
  await page.goto('/path')

  await page.locator('a[href^="/path/module/"]').first().click()
  await expect(page).toHaveURL(/\/path\/module\//)

  // Finish every item in the module. Wait for the items to render first —
  // counting too early finds none and silently skips the loop.
  const completeButtons = page.getByRole('button', { name: 'Mark complete' })
  await expect(completeButtons.first()).toBeVisible()

  for (let i = await completeButtons.count(); i > 0; i = await completeButtons.count()) {
    await completeButtons.first().click()
    await expect(completeButtons).toHaveCount(i - 1)
  }

  await page.getByRole('button', { name: 'Mark mastered' }).click()
  // Content done, but the dimension score hasn't cleared the threshold.
  await expect(page.getByText(/reach \d+ to master|Take an assessment that measures/)).toBeVisible()
})
