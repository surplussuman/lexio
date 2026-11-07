// Shared setup for every spec.
//
// Registration now lands on two things before the app proper: the topic
// picker (assessment prompts can't be written without it) and the integrity
// pledge. Every spec has to get past both, so it lives here once rather than
// being copied ten times.
import { expect } from '@playwright/test'

export function freshEmail(prefix = 'e2e') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@lexio.test`
}

/** Pick a topic and save. Which one doesn't matter — the e2e backend runs the
 *  fake AI provider, so every generated prompt is canned regardless. */
export async function chooseTopics(page) {
  // Wait for the save button, not the dialog: the dialog renders immediately
  // and the catalog loads into it a moment later, so waiting on the dialog
  // alone races the picker's own fetch.
  const save = page.getByRole('button', { name: /Start my assessments/i })
  await save.waitFor({ state: 'visible' })

  // Each topic button's accessible name is its label plus its blurb, so match
  // on the leading label rather than the whole string.
  await page.getByRole('dialog').getByRole('button', { name: /^Technology/ }).click()
  await save.click()
  await expect(save).toBeHidden()
}

export async function acceptPledge(page) {
  const accept = page.getByRole('button', { name: /I'm doing this for me/i })
  await accept.waitFor({ state: 'visible' })
  await accept.click()
  await expect(accept).toBeHidden()
}

export async function registerFreshUser(page, { name = 'Playwright Student', prefix = 'e2e', college } = {}) {
  const email = freshEmail(prefix)
  await page.goto('/register')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('StrongPass123')
  if (college) await page.getByLabel('College (optional)').fill(college)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  await chooseTopics(page)
  await acceptPledge(page)
  return email
}

/** Answer every question on an objective assessment and submit. */
export async function answerAllQuestions(page) {
  const firstOptions = page.locator('fieldset button:first-of-type')
  await expect(firstOptions.first()).toBeVisible()
  const count = await firstOptions.count()
  for (let index = 0; index < count; index += 1) {
    await firstOptions.nth(index).click()
  }
  await page.getByRole('button', { name: /Submit answers/i }).click()
  return count
}
