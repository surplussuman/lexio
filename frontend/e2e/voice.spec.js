// Verifies the recorder wiring for voice modes: permission -> record -> stop
// -> blob captured -> submit -> analysed. Chrome's fake media device supplies
// the audio (see playwright.config.js), so this exercises MediaRecorder for
// real; the transcript comes from the backend's fake STT provider. Run the
// backend with fake providers:
//   AI_PROVIDER_PRIMARY=fake AI_PROVIDER_FALLBACK=fake \
//   STT_PROVIDER_PRIMARY=fake STT_PROVIDER_FALLBACK=fake python manage.py runserver 8000
//
// The time target is the thing worth guarding here: a three-minute brief
// answered in three seconds used to sail through with a high score and no
// mention of it (see apps/analysis/rubrics.time_adherence).
import { expect, test } from '@playwright/test'

import { registerFreshUser } from './support'

test('speaking mode shows the time target and records a take', async ({ page }) => {
  await registerFreshUser(page, { name: 'Voice Student' })

  await page.goto('/assess/speak')
  await expect(page.getByText("Echo's tips")).toBeVisible()

  // The clock is stated up front, not sprung at scoring time.
  await expect(page.getByText('Speak for 03:00')).toBeVisible()
  await expect(page.getByText(/0% of the time used/)).toBeVisible()

  const submit = page.getByRole('button', { name: /Submit response/i })
  await expect(submit).toBeDisabled() // nothing recorded yet

  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.getByText(/Recording — tap to stop/i)).toBeVisible()
  // Captions stream while you speak rather than arriving with the score.
  await expect(page.getByText('Live transcript')).toBeVisible()

  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: 'Stop recording' }).click()

  await expect(page.getByText(/Recorded — tap to record again/i)).toBeVisible()
  await expect(submit).toBeEnabled()
})

test('stopping well short of the target asks before it accepts the take', async ({ page }) => {
  await registerFreshUser(page, { name: 'Short Answer Student' })
  await page.goto('/assess/speak')

  await page.getByRole('button', { name: 'Start recording' }).click()
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: 'Stop recording' }).click()

  await page.getByRole('button', { name: /Submit response/i }).click()

  // Not submitted yet — it explains what a short answer costs first.
  await expect(page).toHaveURL(/\/assess\/speak/)
  await expect(page.getByText(/of the time you were given/i)).toBeVisible()
  await expect(page.getByText(/scores lower on structure and fluency/i)).toBeVisible()

  await page.getByRole('button', { name: /Submit it anyway/i }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })
  await expect(page.getByText('1 of 8 complete')).toBeVisible()
})
