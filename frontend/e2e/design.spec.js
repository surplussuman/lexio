// Guards against CSS-cascade regressions that are invisible to unit tests but
// obvious to a user. The active nav link once rendered navy-on-navy because an
// unlayered `a { color: inherit }` reset outranked Tailwind's layered
// utilities — text was present, styled, and completely unreadable.
import { expect, test } from '@playwright/test'

import { registerFreshUser } from './support'

function parseRgb(value) {
  const [r, g, b] = value.match(/\d+/g).map(Number)
  return { r, g, b }
}

/** WCAG relative luminance, for a real contrast check rather than an
 *  equality check that a near-miss colour pair would slip past. */
function luminance({ r, g, b }) {
  const channel = (raw) => {
    const c = raw / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

test('active nav link is readable against its own background', async ({ page }) => {
  await registerFreshUser(page, { name: 'Design Check' })

  const activeLink = page.getByRole('link', { name: 'Dashboard' })
  await expect(activeLink).toHaveText('Dashboard')

  const { color, background } = await activeLink.evaluate((el) => {
    const style = getComputedStyle(el)
    return { color: style.color, background: style.backgroundColor }
  })

  expect(contrastRatio(parseRgb(color), parseRgb(background))).toBeGreaterThan(4.5)
})
