// Shared helpers for the QA specs. Everything here drives the page the way a customer would:
// real keyboard and pointer events, and hit-testing with elementFromPoint, never rectangles.
import { expect } from '@playwright/test';

// The page under test. Default: c2's app on the mock. Override to point at a throwaway page
// (negative control) or a deployed copy.
export const TARGET = process.env.QA_TARGET || '/app/index.html?mock=1';

// Every screen shows one of these as the state; the specs identify a screen by its text.
export const TEXT = {
  start: /Point the camera at the barcode/i,
  typeField: /Type the number/i,
  honest: /If we don't know an item, we say so\./i,
  money: /the counter's count is the one that pays/i,
  unknown: /We don't know this one yet\. Show it at the counter and we'll add it\./i,
  scanAnother: /Scan another/i,
  refund: /^(5¢|10¢|No refund)( at APCO)?$/,
  verdict: /^(Yes, we take this|No, we don't take this|Ask at the counter)$/,
};

// SYNTHETIC barcodes. Env wins; otherwise the mock page must expose window.RR_MOCK
// ({ regular, liquor, unknown }). No silent default: a wrong number would make the wrong screen
// look like a bug in the app.
export async function mockNumbers(page) {
  const env = { regular: process.env.QA_UPC_5, liquor: process.env.QA_UPC_10, unknown: process.env.QA_UPC_UNKNOWN };
  if (env.regular && env.liquor && env.unknown) return env;
  const fromPage = await page.evaluate(() => globalThis.RR_MOCK || null);
  if (fromPage?.regular && fromPage?.liquor && fromPage?.unknown) return { ...fromPage, ...stripUndef(env) };
  throw new Error(
    'No SYNTHETIC barcodes: set QA_UPC_5, QA_UPC_10 and QA_UPC_UNKNOWN, or have the mock page expose window.RR_MOCK = { regular, liquor, unknown }. See docs/QA.md.'
  );
}
const stripUndef = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));

// Type a number into the "Type the number" field with real keystrokes and press Enter.
export async function typeNumber(page, upc) {
  const field = page.getByRole('textbox', { name: TEXT.typeField });
  await expect(field).toBeVisible();
  await hitTest(page, field);
  await field.click();
  await field.fill('');
  await page.keyboard.type(String(upc), { delay: 20 });
  await page.keyboard.press('Enter');
}

// What a user actually hits at the element's centre must be the element (or inside it).
export async function hitTest(page, locator, label) {
  await expect(locator).toBeVisible();
  const ok = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
  expect(ok, `${label || 'element'} is covered at its centre (elementFromPoint hit something else)`).toBe(true);
}

// Locators that only see what is on screen (the app keeps hidden screens in the DOM).
export const shown = (page, re) => page.getByText(re).filter({ visible: true });
export const refundOnScreen = (page) => shown(page, TEXT.refund);
export const moneyOnScreen = (page) => shown(page, TEXT.money);

// Click through a real pointer at the centre, after hit-testing.
export async function tap(page, locator, label) {
  await hitTest(page, locator, label);
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

// All visible text on the page, one string.
export async function visibleText(page) {
  return page.evaluate(() => {
    const out = [];
    const walk = (n) => {
      if (n.nodeType === Node.TEXT_NODE) { const t = n.textContent.trim(); if (t) out.push(t); return; }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(n.tagName)) return;
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || n.hidden) return;
      for (const c of n.childNodes) walk(c);
      if (n.tagName === 'INPUT' && n.placeholder) out.push(n.placeholder);
    };
    walk(document.body);
    return out.join(' ');
  });
}

// The verdict (Yes / No / Ask at the counter) must be the largest font on the screen; the cents line sits under it.
export async function largestFontIsRefund(page) {
  return page.evaluate((re) => {
    const rx = new RegExp(re.source, re.flags);
    let best = { size: 0, text: '' };
    for (const el of document.body.querySelectorAll('*')) {
      if (el.getClientRects().length === 0) continue; // off-screen or inside a hidden screen
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (!own) continue;
      const size = parseFloat(cs.fontSize);
      if (size > best.size) best = { size, text: own };
    }
    return { ...best, isRefund: rx.test(best.text) };
  }, { source: TEXT.verdict.source, flags: TEXT.verdict.flags });
}

// Every screen must be plain English: no developer words leaking through.
export const BANNED_DEV = [
  /\bundefined\b/i, /\bnull\b/, /\bNaN\b/, /\[object Object\]/, /\b(4\d\d|5\d\d)\b(?=[^¢])/, /\bTypeError\b/, /\bReferenceError\b/,
  /\bexception\b/i, /\bstack trace\b/i, /\bJSON\b/, /\bAPI\b/, /\bfetch\b/i, /\blocalhost\b/i, /\bTODO\b/, /\blorem\b/i,
  /\bUPC\b/, /\bEAN\b/, /\bgetUserMedia\b/, /\bNotAllowedError\b/, /\bBarcodeDetector\b/, /\bZXing\b/i, /\bmock\b/i,
];
// Money words: the refund line is never a promise.
export const BANNED_MONEY = [/\bguaranteed\b/i, /\byou will get\b/i, /\bpayout\b/i];
