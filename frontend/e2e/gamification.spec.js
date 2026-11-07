// Phase 3: XP, badges, streak and leaderboard surface correctly after real work.
import { expect, test } from '@playwright/test'

import { answerAllQuestions, registerFreshUser } from './support'

async function registerAndAssess(page) {
  await registerFreshUser(page, { name: 'Gamification Student', college: 'Test College' })

  await page.goto('/assess/vocab')
  await answerAllQuestions(page)
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 90_000 })
}

test('completing a session awards XP, a streak and the first badge', async ({ page }) => {
  await registerAndAssess(page)

  await page.goto('/profile')
  await expect(page.getByText(/Level 1 · Newcomer/)).toBeVisible()
  // The streak chip appears in both the app header and the profile header.
  await expect(page.getByText('1 day streak').first()).toBeVisible()

  // "First Step" is earned; a streak badge is not.
  const firstStep = page.locator('div[title="Complete your first assessment."]')
  await expect(firstStep).toHaveClass(/border-accent/)
  const monthly = page.locator('div[title="Keep a 30-day streak."]')
  await expect(monthly).toHaveClass(/opacity-50/)
})

test('header XP reflects work done without needing a re-login', async ({ page }) => {
  await registerAndAssess(page)
  await page.goto('/dashboard')
  // 50 XP for the assessment — the header reads live server state, not the
  // snapshot persisted at registration.
  await expect(page.locator('header')).toContainText('50 XP')
})

test('leaderboard shows the current user in their cohort', async ({ page }) => {
  await registerAndAssess(page)

  await page.goto('/leaderboard')
  await expect(page.getByText('Your cohort.')).toBeVisible()
  // The top-10 is cached for 5 minutes, so a just-registered student may not
  // be in it yet — their own row must still be shown.
  await expect(page.getByText('· you')).toBeVisible()
})
