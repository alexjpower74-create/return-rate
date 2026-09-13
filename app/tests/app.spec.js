// Customer app against the mock (?mock=1), with real typing through the keyboard.
// Every number below is SYNTHETIC (see api.mock.js).
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const SHOTS = path.join(__dirname, 'shots');
const MONEY = "The counter's count is the one that pays.";
const UNKNOWN = "We don't know this one yet.";

// Type a number for real (keyboard events, not fill) and submit.
async function typeNumber(page, digits) {
  const box = page.getByLabel('Type the number');
  await box.click();
  await page.keyboard.type(digits, { delay: 20 });
  await page.keyboard.press('Enter');
}

// The biggest font on the page must be the refund element.
async function largestFontIs(page, selector) {
  return page.evaluate((sel) => {
    const target = document.querySelector(sel);
    let max = 0, maxEl = null;
    for (const el of document.querySelectorAll('body *')) {
      if (el.hidden || el.closest('[hidden]')) continue;
      if (!el.textContent.trim()) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size > max) { max = size; maxEl = el; }
    }
    return { ok: maxEl === target, max, target: parseFloat(getComputedStyle(target).fontSize) };
  }, selector);
}

// Hit-test: what a user actually touches at the element's centre is the element (or inside it).
async function hitTest(page, locator) {
  const box = await locator.boundingBox();
  expect(box, 'element has a box').not.toBeNull();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? (el.id || el.tagName.toLowerCase() + (el.className ? '.' + el.className : '')) : null;
  }, [x, y]);
  const inside = await locator.evaluate((el, [x, y]) => {
    const at = document.elementFromPoint(x, y);
    return !!at && (at === el || el.contains(at));
  }, [x, y]);
  expect(inside, `elementFromPoint at (${x},${y}) hit ${hit}`).toBe(true);
}

async function allVisibleButtonsHit(page) {
  const buttons = page.locator('button:visible');
  const n = await buttons.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await hitTest(page, buttons.nth(i));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?mock=1&camera=off');
  await expect(page.getByRole('heading', { name: 'Point the camera at the barcode' })).toBeVisible();
});

test('start screen: camera prompt, typed field and the never-invent sentence', async ({ page }, info) => {
  await expect(page.getByText("If we don't know an item, we say so.")).toBeVisible();
  await expect(page.getByLabel('Type the number')).toBeVisible();
  await allVisibleButtonsHit(page);
  await page.screenshot({ path: path.join(SHOTS, `start-${info.project.name}.png`) });
});

for (const c of [
  { upc: '0000000000017', refund: '5¢', verdict: 'Yes, we take this', kind: 'Pop, water, juice or beer', name: 'Test Cola' },
  { upc: '0000000000024', refund: '10¢', verdict: 'Yes, we take this', kind: 'Wine or spirits', name: 'Test Red Wine' },
  { upc: '0000000000048', refund: 'No refund', verdict: "No, we don't take this", kind: 'Milk has no deposit', name: 'Test 2% Milk' },
  { upc: '0000000000055', refund: '5¢ at APCO', kind: 'Refillable local beer bottle', name: 'refillable', verdict: 'Yes, we take this' },
]) {
  test(`answer ${c.upc} (SYNTHETIC) shows ${c.refund}`, async ({ page }, info) => {
    await typeNumber(page, c.upc);
    const refund = page.locator('#refund');
    await expect(refund).toHaveText(c.refund);
    await expect(page.locator('#verdict')).toHaveText(c.verdict);
    await expect(page.locator('#product')).toContainText(c.name);
    await expect(page.locator('#kind')).toContainText(c.kind);
    await expect(page.locator('#screen-answer .money')).toHaveText(MONEY);
    const big = await largestFontIs(page, '#verdict');
    expect(big.ok, `verdict ${big.target}px should be the largest font, largest is ${big.max}px`).toBe(true);
    const sizes = await page.evaluate(() => [parseFloat(getComputedStyle(document.querySelector('#verdict')).fontSize), parseFloat(getComputedStyle(document.querySelector('#refund')).fontSize)]);
    expect(sizes[1], 'the cents line is smaller than the verdict').toBeLessThan(sizes[0]);
    await allVisibleButtonsHit(page);
    await page.screenshot({ path: path.join(SHOTS, `answer-${c.upc.slice(-2)}-${info.project.name}.png`) });
  });
}

test('unknown number (SYNTHETIC) says so honestly, with the money line', async ({ page }, info) => {
  await typeNumber(page, '0000000000031');
  await expect(page.locator('#screen-unknown')).toBeVisible();
  await expect(page.getByText(UNKNOWN)).toBeVisible();
  await expect(page.getByText("Show it at the counter and we'll add it.")).toBeVisible();
  await expect(page.locator('#screen-unknown .money')).toHaveText(MONEY);
  // No cents figure anywhere on the unknown screen.
  await expect(page.locator('#screen-unknown')).not.toContainText('¢');
  await allVisibleButtonsHit(page);
  await page.screenshot({ path: path.join(SHOTS, `unknown-${info.project.name}.png`) });
  await page.getByRole('button', { name: 'Scan another' }).click();
  await expect(page.getByRole('heading', { name: 'Point the camera at the barcode' })).toBeVisible();
  await expect(page.getByLabel('Type the number')).toHaveValue('');
});

test('spaces in a typed number are fine; a short number is refused in plain words', async ({ page }) => {
  await typeNumber(page, '0000 0000 00017');
  await expect(page.locator('#refund')).toHaveText('5¢');
  await page.getByRole('button', { name: 'Scan another' }).click();
  await typeNumber(page, '1234');
  await expect(page.locator('#type-error')).toContainText("doesn't look like a barcode number");
  await expect(page.locator('#screen-start')).toBeVisible();
});

test('offline (SYNTHETIC) is a screen with a way on, not a dead end', async ({ page }, info) => {
  await typeNumber(page, '0000000000062');
  await expect(page.locator('#screen-offline')).toBeVisible();
  await expect(page.getByText("We can't check right now.")).toBeVisible();
  await expect(page.locator('#screen-offline .money')).toHaveText(MONEY);
  await allVisibleButtonsHit(page);
  await page.screenshot({ path: path.join(SHOTS, `offline-${info.project.name}.png`) });
  await page.getByRole('button', { name: 'Scan another' }).click();
  await expect(page.locator('#screen-start')).toBeVisible();
});

test.describe('camera permission (real getUserMedia)', () => {
  test('refused: the typed fallback is offered, nothing is dead', async ({ browser, browserName }, info) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: [] });
    const page = await ctx.newPage();
    await page.goto('/?mock=1');
    const note = page.locator('#camera-note');
    await expect(note).toBeVisible({ timeout: 10000 });
    // WebKit raises a real NotAllowedError here. Headless Chromium says "Not supported"
    // whatever the permission state (probed 2026-09-13), so it only proves the fallback.
    if (browserName === 'webkit') await expect(note).toContainText('Camera is off');
    await expect(note).toContainText('Type the number below');
    await expect(page.getByLabel('Type the number')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, `camera-refused-${info.project.name}.png`) });
    await typeNumber(page, '0000000000017');
    await expect(page.locator('#refund')).toHaveText('5¢');
    await ctx.close();
  });

  test('granted: the note stays hidden (positive control for the refused check)', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'only chromium has a fake camera device');
    // Chromium's fake prompt UI accepts the camera; the project browser (no fake UI) refuses it.
    const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5901/?mock=1');
    await page.waitForTimeout(1500);
    await expect(page.locator('#camera-note')).toBeHidden();
    const live = await page.evaluate(() => !!(document.getElementById('video').srcObject));
    expect(live).toBe(true);
    await b.close();
  });
});
