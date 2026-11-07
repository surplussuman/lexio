// Phase 1 golden path, as the flow now works: register -> take assessments ->
// nothing is scored back until all eight are done -> then the reports open.
// Objective modes are used where possible because they need no microphone
// permission; the voice path is covered in voice.spec.js.
// Requires both dev servers running, with the backend on fake providers.
import { expect, test } from '@playwright/test'

import { answerAllQuestions, registerFreshUser } from './support'

const MODES = ['speak', 'present', 'write', 'vocab', 'grammar', 'read', 'listen', 'gd']

test('onboarding lists all eight assessment modes', async ({ page }) => {
  await registerFreshUser(page)
  await page.getByRole('link', { name: /Start baseline assessment/i }).click()

  await expect(page).toHaveURL(/\/onboarding/)
  for (const mode of ['Speaking', 'Presentation', 'Writing', 'Vocabulary', 'Grammar', 'Reading Comprehension', 'Listening', 'Group Discussion']) {
    await expect(page.getByRole('link', { name: new RegExp(mode) })).toBeVisible()
  }
})

test('an unfinished assessment is still there when you come back', async ({ page }) => {
  await registerFreshUser(page)
  await page.goto('/assess/write')

  const textarea = page.getByLabel('Your response')
  // Autosave is debounced, so wait for the save itself rather than a fixed
  // beat — under load the timer lands well after any timeout worth writing.
  const saved = page.waitForResponse(
    (response) => response.url().includes('/api/assessment/draft') && response.ok()
  )
  await textarea.fill('Half an argument, interrupted by life.')
  await saved

  await page.goto('/dashboard')
  await page.goto('/assess/write')

  await expect(page.getByText(/Picked up where you left off/i)).toBeVisible()
  await expect(textarea).toHaveValue('Half an argument, interrupted by life.')
})

test('a scored assessment returns to the hub, and its report stays locked', async ({ page }) => {
  await registerFreshUser(page)
  await page.goto('/assess/grammar')
  await answerAllQuestions(page)

  // No feedback page: the student goes back to the hub with one fewer left.
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })
  await expect(page.getByText('1 of 8 complete')).toBeVisible()
  await expect(page.getByText(/Your report opens once all eight are done/i).first()).toBeVisible()

  // And the mode can't be retaken.
  await page.goto('/assess/grammar')
  await expect(page.getByRole('heading', { name: /Grammar is already done/i })).toBeVisible()
})

test('the report is withheld until every mode is done', async ({ page }) => {
  await registerFreshUser(page)
  await page.goto('/assess/vocab')
  await answerAllQuestions(page)
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })

  await page.goto('/report')
  await expect(page.getByRole('heading', { name: /finish the set first/i })).toBeVisible()
  await expect(page.getByText(/You've done 1 of 8/)).toBeVisible()
})

test('completing all eight unlocks the overview and every per-assessment report', async ({ page }) => {
  test.slow() // eight assessments end to end, each through the analysis pipeline
  await registerFreshUser(page)

  for (const mode of MODES) {
    await page.goto(`/assess/${mode}`)
    await submitFor(page, mode)
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })
  }

  await expect(page.getByText('8 of 8 complete')).toBeVisible()
  await page.getByRole('link', { name: /Open my baseline report/i }).click()

  await expect(page).toHaveURL(/\/report/)
  await expect(page.getByRole('heading', { name: /Here's where you actually stand/i })).toBeVisible()
  await expect(page.getByText('Composite score')).toBeVisible()
  await expect(page.getByText("Echo's read on all eight")).toBeVisible()

  // Every mode is listed, and its own report is now reachable.
  const reports = page.locator('a[href^="/feedback/"]')
  await expect(reports).toHaveCount(8)
  await reports.first().click()
  await expect(page.getByText('Session score')).toBeVisible()
})

/** Submit whatever the mode needs. Voice modes use Chrome's fake device. */
async function submitFor(page, mode) {
  if (mode === 'write') {
    await page.getByLabel('Your response').fill(
      'A written answer with a clear position, one supporting example, and a close.'
    )
    await page.getByRole('button', { name: /Submit response/i }).click()
    return
  }

  if (mode === 'present') {
    await page.getByRole('button', { name: /start presenting/i }).click()
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: /^End early$/ }).click()
    await page.getByRole('button', { name: /Submit presentation/i }).click()
    return
  }

  if (mode === 'gd') {
    // The room: enter, raise a hand to skip straight past the peers'
    // openings, speak, lower the hand, then leave and submit — there's no
    // fixed turn length to wait out.
    await page.getByRole('button', { name: /Enter room/i }).click()
    await page.getByRole('button', { name: /Raise your hand/i }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: /Lower hand/i }).click()
    await page.getByRole('button', { name: /Finish discussion/i }).click()
    await page.getByRole('button', { name: /Submit contribution/i }).click()
    return
  }

  if (mode === 'speak') {
    await page.getByRole('button', { name: 'Start recording' }).click()
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: 'Stop recording' }).click()
    await page.getByRole('button', { name: /Submit response/i }).click()
    // Well under the time target, so it asks for confirmation first.
    const anyway = page.getByRole('button', { name: /Submit it anyway/i })
    if (await anyway.isVisible().catch(() => false)) await anyway.click()
    return
  }

  if (mode === 'listen') {
    await page.getByRole('button', { name: /Play/i }).first().click()
  }
  await answerAllQuestions(page)
}
