// Plain English on every screen: no developer words, no money promises, and the counter line on
// every answer (known or unknown).
import { test, expect } from '@playwright/test'
import { TARGET, TEXT, BANNED_DEV, BANNED_MONEY, mockNumbers, typeNumber, tap, visibleText, shown, refundOnScreen } from './helpers.js'

const sweep = (text, patterns, kind) => {
  const hits = patterns.filter((p) => p.test(text)).map(String)
  expect(hits, `${kind} words on screen: ${hits.join(', ')}\n--- screen text ---\n${text}`).toEqual([])
}

test.describe('plain English', () => {
  test('every screen is clean and every answer carries the counter line', async ({ page }) => {
    await page.goto(TARGET)
    const numbers = await mockNumbers(page)
    const screens = []

    screens.push(['start', await visibleText(page)])

    await typeNumber(page, numbers.regular)
    await expect(refundOnScreen(page).first()).toBeVisible()
    screens.push(['answer 5¢', await visibleText(page)])
    await tap(page, page.getByRole('button', { name: TEXT.scanAnother }).filter({ visible: true }))

    await typeNumber(page, numbers.liquor)
    await expect(refundOnScreen(page).first()).toBeVisible()
    screens.push(['answer 10¢', await visibleText(page)])
    await tap(page, page.getByRole('button', { name: TEXT.scanAnother }).filter({ visible: true }))

    await typeNumber(page, numbers.unknown)
    await expect(shown(page, TEXT.unknown)).toBeVisible()
    screens.push(['unknown', await visibleText(page)])

    for (const [name, text] of screens) {
      await test.step(name, async () => {
        sweep(text, BANNED_DEV, 'developer')
        sweep(text, BANNED_MONEY, 'money-promise')
        if (name !== 'start') expect(text, `"${name}" screen is missing the counter line`).toMatch(TEXT.money)
      })
    }
  })
})
