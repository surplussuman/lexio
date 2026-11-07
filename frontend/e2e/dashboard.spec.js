// The dashboard's score, dimension bars and session list are withheld until
// the baseline is complete — the same rule the per-assessment feedback page
// and the overview report follow (apps/analysis/overview.py). This is what
// stops a single completed mode from filling in a "result" the dashboard
// used to show immediately.
import { expect, test } from '@playwright/test'

import { answerAllQuestions, registerFreshUser } from './support'

test('one assessment leaves the dashboard quiet, but still tracks progress', async ({ page }) => {
  await registerFreshUser(page, { name: 'Dashboard Student' })

  await page.goto('/assess/vocab')
  await answerAllQuestions(page)
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })

  await page.goto('/dashboard')
  await expect(page.getByText('1 of 8 done.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Continue your assessments/ })).toBeVisible()

  // Nothing derived from that one score is shown.
  await expect(page.getByText('Communication score')).toBeHidden()
  await expect(page.getByText('Dimensions', { exact: true })).toBeHidden()
  await expect(page.getByText('Recent sessions')).toBeHidden()

  // Echo's daily drill is a standing habit-loop nudge, not a result — it's
  // meant to run through the baseline rather than wait for it.
  await expect(page.getByText('Echo', { exact: true })).toBeVisible()
})

test('the full dashboard opens once every mode is scored', async ({ page }) => {
  test.slow() // eight assessments end to end
  await registerFreshUser(page, { name: 'Complete Dashboard Student' })

  for (const mode of ['speak', 'present', 'write', 'vocab', 'grammar', 'read', 'listen', 'gd']) {
    await page.goto(`/assess/${mode}`)
    if (mode === 'write') {
      await page.getByLabel('Your response').fill('A clear, structured answer with one example and a close.')
      await page.getByRole('button', { name: /Submit response/i }).click()
    } else if (mode === 'present') {
      await page.getByRole('button', { name: /start presenting/i }).click()
      await page.waitForTimeout(1000)
      await page.getByRole('button', { name: /^End early$/ }).click()
      await page.getByRole('button', { name: /Submit presentation/i }).click()
    } else if (mode === 'gd') {
      await page.getByRole('button', { name: /Enter room/i }).click()
      await page.getByRole('button', { name: /Raise your hand/i }).click()
      await page.waitForTimeout(2000)
      await page.getByRole('button', { name: /Lower hand/i }).click()
      await page.getByRole('button', { name: /Finish discussion/i }).click()
      await page.getByRole('button', { name: /Submit contribution/i }).click()
    } else if (mode === 'speak') {
      await page.getByRole('button', { name: 'Start recording' }).click()
      await page.waitForTimeout(2000)
      await page.getByRole('button', { name: 'Stop recording' }).click()
      await page.getByRole('button', { name: /Submit response/i }).click()
      const anyway = page.getByRole('button', { name: /Submit it anyway/i })
      if (await anyway.isVisible().catch(() => false)) await anyway.click()
    } else {
      if (mode === 'listen') await page.getByRole('button', { name: /Play/i }).first().click()
      await answerAllQuestions(page)
    }
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })
  }

  await page.goto('/dashboard')
  await expect(page.getByText('Communication score')).toBeVisible()
  await expect(page.getByText('Dimensions', { exact: true })).toBeVisible()
  await expect(page.getByText('Recent sessions')).toBeVisible()
  await expect(page.getByRole('link', { name: /Open report/ })).toBeVisible()
})
