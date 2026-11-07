// Phase 0 golden path (build plan): register -> land on dashboard empty state.
// Requires both dev servers running: `npm run dev` (frontend, :5173) and
// the Django backend (:8000) — see CLAUDE.md "Commands".
import { expect, test } from '@playwright/test'

import { registerFreshUser } from './support'

test('register creates an account and lands on the dashboard empty state', async ({ page }) => {
  await registerFreshUser(page, { name: 'Playwright Student' })
  await expect(page.getByText(/let's find your baseline/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start baseline assessment' })).toBeVisible()
})

test('unauthenticated visitor is redirected away from the dashboard', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})
