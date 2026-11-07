// Presentation mode: read the deck, present it slide by slide on camera,
// then see per-slide pacing and the camera read on the report.
//
// Chrome's fake media stream supplies both the microphone and the camera (see
// playwright.config.js). It's a synthetic colour pattern, not a face, so the
// "we can't see you" state is the honest expectation here — which is itself
// worth asserting, because a student whose camera is pointed at the ceiling
// should be told so during the run, not after it.
import { expect, test } from '@playwright/test'

import { registerFreshUser } from './support'

test('the deck is readable before the clock starts', async ({ page }) => {
  await registerFreshUser(page, { name: 'Deck Reader' })
  await page.goto('/assess/present')

  await expect(page.getByText('Read it through')).toBeVisible()
  await expect(page.getByText(/These are cues, not a script/i)).toBeVisible()

  // Every slide is visible up front — that's the whole point of the prep phase.
  await expect(page.getByText(/^Slide \d+ of \d+$/).first()).toBeVisible()
  const slides = page.getByText(/^Slide \d+ of \d+$/)
  expect(await slides.count()).toBeGreaterThanOrEqual(3)

  // Nothing is recording yet.
  await expect(page.getByText('● LIVE')).toBeHidden()
})

test('presenting runs the camera panel and advances one slide at a time', async ({ page }) => {
  await registerFreshUser(page, { name: 'Presenter' })
  await page.goto('/assess/present')

  // Wait for the deck before counting it, or the count races the fetch.
  const slideLabels = page.getByText(/^Slide \d+ of \d+$/)
  await expect(slideLabels.first()).toBeVisible()
  const slideCount = await slideLabels.count()

  await page.getByRole('button', { name: /start presenting/i }).click()

  await expect(page.getByText('● LIVE')).toBeVisible()
  // The slide header and the footer counter both say this.
  await expect(page.getByText(`Slide 1 of ${slideCount}`).first()).toBeVisible()

  // The delivery read is on screen while they present, with its limits stated.
  for (const label of ['Eye contact', 'Posture', 'Framing', 'Steadiness', 'Background']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(page.getByText(/Nothing is uploaded or recorded/i)).toBeVisible()
  // A synthetic video stream has no face in it, and the student is told.
  await expect(page.getByText(/We can't see you/i)).toBeVisible()

  // The camera must actually be *measuring*, not merely switched on. The
  // background reading only moves once real frames have been sampled, and it
  // stayed at "—" for a while because the stream was never attached to the
  // video element at all — the light was on and nothing was read.
  const backgroundReading = page.locator('div').filter({ hasText: /^Background\d+$/ }).last()
  await expect(backgroundReading).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /Next slide/i }).click()
  await expect(page.getByText(`Slide 2 of ${slideCount}`).first()).toBeVisible()

  await page.getByRole('button', { name: /^End early$/ }).click()
  await expect(page.getByRole('heading', { name: /That's your run/i })).toBeVisible()
  await expect(page.getByText('Time per slide')).toBeVisible()
  await expect(page.getByText('Camera read')).toBeVisible()

  await page.getByRole('button', { name: /Submit presentation/i }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })
})
