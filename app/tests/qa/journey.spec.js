// The whole customer journey with real input: type a number → answer → scan another → unknown →
// camera refused. Every button is hit-tested at its centre before it is pressed.
import { test, expect } from '@playwright/test'
import {
  TARGET,
  TEXT,
  mockNumbers,
  typeNumber,
  tap,
  hitTest,
  largestFontIsRefund,
  shown,
  refundOnScreen,
  moneyOnScreen,
  visibleText,
} from './helpers.js'

test.describe('customer journey', () => {
  test('type → 5¢ answer → scan another → 10¢ → unknown → camera refused', async ({ page, browserName }) => {
    // Camera is denied by the config (permissions: []), so this run IS the camera-refused path.
    await page.goto(TARGET)
    await expect(shown(page, TEXT.start)).toBeVisible()
    await expect(shown(page, TEXT.honest)).toBeVisible()
    const numbers = await mockNumbers(page)

    // 5¢ item
    await typeNumber(page, numbers.regular)
    const refund5 = refundOnScreen(page).first()
    await expect(refund5).toHaveText('5¢')
    await expect(moneyOnScreen(page)).toBeVisible()
    const big = await largestFontIsRefund(page)
    expect(big.isRefund, `largest font on the answer is "${big.text}" (${big.size}px), not the verdict`).toBe(true)
    await page.screenshot({ path: `app/tests/qa/shots/answer-5c-${browserName}-${page.viewportSize().width}.png` })

    // Scan another → back to start
    await tap(page, page.getByRole('button', { name: TEXT.scanAnother }).filter({ visible: true }), 'Scan another')
    await expect(shown(page, TEXT.start)).toBeVisible()

    // 10¢ item
    await typeNumber(page, numbers.liquor)
    await expect(refundOnScreen(page).first()).toHaveText('10¢')
    await expect(moneyOnScreen(page)).toBeVisible()
    await tap(page, page.getByRole('button', { name: TEXT.scanAnother }).filter({ visible: true }), 'Scan another')

    // Unknown item: the honest sentence, and still the money line
    await typeNumber(page, numbers.unknown)
    await expect(shown(page, TEXT.unknown)).toBeVisible()
    await expect(moneyOnScreen(page)).toBeVisible()
    await expect(refundOnScreen(page)).toHaveCount(0) // no invented refund on an unknown
    await page.screenshot({ path: `app/tests/qa/shots/unknown-${browserName}-${page.viewportSize().width}.png` })
    await tap(page, page.getByRole('button', { name: TEXT.scanAnother }).filter({ visible: true }), 'Scan another')

    // Camera refused: no dead end. The typed field is still there and reachable.
    await expect(shown(page, TEXT.start)).toBeVisible()
    await hitTest(page, page.getByRole('textbox', { name: TEXT.typeField }), 'Type the number')
  })

  test('a malformed number never shows a refund', async ({ page }) => {
    await page.goto(TARGET)
    await mockNumbers(page)
    await typeNumber(page, '12ab')
    await expect(refundOnScreen(page)).toHaveCount(0)
    // Still a way forward: either the field is still there, or the honest unknown screen with "Scan another".
    const field = page.getByRole('textbox', { name: TEXT.typeField })
    const again = page.getByRole('button', { name: TEXT.scanAnother }).filter({ visible: true })
    await expect(field.or(again).first()).toBeVisible()
    expect(await visibleText(page)).not.toMatch(/undefined|null|NaN|error/i)
  })
})
