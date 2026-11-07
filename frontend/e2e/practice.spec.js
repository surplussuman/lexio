// Phase 4: the live practice loop over a real WebSocket.
//
// Chromium exposes SpeechRecognition but can't actually transcribe in a
// headless test, so most of these disable it to drive the typing fallback —
// which is a genuine user path anyway (Firefox and Safari have no
// SpeechRecognition). One test keeps it enabled to check the captions UI.
import { expect, test } from '@playwright/test'

import { registerFreshUser } from './support'

async function disableSpeechRecognition(page) {
  await page.addInitScript(() => {
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })
}

async function register(page) {
  await registerFreshUser(page, { name: 'Practice Student' })
}

test('practice launcher lists every session type', async ({ page }) => {
  await register(page)
  await page.goto('/practice')

  for (const title of ['Mock Interview', 'Impromptu Speaking', 'Debate / Group Discussion', 'Presentation', 'Writing Drill']) {
    await expect(page.getByText(title, { exact: true })).toBeVisible()
  }
})

test('an impromptu session connects, scores and shows a summary', async ({ page }) => {
  await disableSpeechRecognition(page)
  await register(page)
  await page.goto('/practice')

  await page.getByLabel(/Topic \(optional/).fill("A time I changed someone's mind")
  await page.getByText('Impromptu Speaking', { exact: true }).click()

  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]{36}$/)
  // The socket handshake has to succeed for the session to report Live.
  await expect(page.getByText('◉ Live')).toBeVisible()

  await page.getByLabel('Your response').fill(
    'So during my final year project my teammate wanted a machine learning model that was far too heavy ' +
      'for the scope. I set up a call, shared two benchmarks, and walked through the trade-offs. ' +
      'By the end we had agreed on a simpler baseline and he led that part of the work.'
  )

  await page.getByRole('button', { name: /End & score/ }).click()
  await expect(page.getByText('Scoring your session…')).toBeVisible()

  await expect(page).toHaveURL(/\/summary$/, { timeout: 90_000 })
  await expect(page.getByText('Session score')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Annotated transcript' })).toBeVisible()
  await expect(page.getByText(/\+80 XP/)).toBeVisible()
})

test('a mock interview asks a follow-up question over the socket', async ({ page }) => {
  await disableSpeechRecognition(page)
  await register(page)
  await page.goto('/practice')
  await page.getByText('Mock Interview', { exact: true }).click()

  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]{36}$/)
  await expect(page.getByText('◉ Live')).toBeVisible()
  // A live session must not also be showing a connection error — StrictMode's
  // double-mount closes the first socket and once left this on screen.
  await expect(page.getByText(/Lost the connection/)).toHaveCount(0)

  // Echo opens with a question.
  const echoTurns = page.locator('main [class*="bg-paper"][class*="text-ink-2"]')
  await expect(echoTurns).toHaveCount(1)

  await page.getByLabel('Your response').fill('I led the migration and cut our handover time in half.')
  await page.getByRole('button', { name: 'Next question' }).click()

  // The follow-up arrives back over the socket.
  await expect(echoTurns).toHaveCount(2, { timeout: 30_000 })
})

test('live captions are used when the browser supports speech recognition', async ({ page }) => {
  await register(page)
  await page.goto('/practice')
  await page.getByText('Impromptu Speaking', { exact: true }).click()

  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Your response · live captions')).toBeVisible()
  await expect(page.getByRole('button', { name: /Start speaking/ })).toBeVisible()
  // No typing fallback when captions are available.
  await expect(page.getByLabel('Your response')).toHaveCount(0)
})
