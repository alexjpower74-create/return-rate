# QA — how Return Rate is checked

Owner: c4. The specs live in `app/tests/qa/`, the live round-trip in `tests/live-roundtrip.mjs`. Every
number reported comes from a QA worktree pinned to a commit (`rig qa --ref <sha> --port 5909`), never
from a working tree.

## Run it

```
npm install                       # @playwright/test only; browsers are the global Playwright cache
npm test                          # every *.spec.js in the repo, chromium + webkit, 390x844 and 1280x800
npm run test:qa                   # just the c4 specs
npm run test:phone                # phone projects only
API=https://<worker> npm run live -- --upc <seeded barcode> --class regular --cents 5
```

`playwright.config.js` starts `app/tests/qa/serve.mjs` on port 5909 serving the repo root, so the app is
`http://localhost:5909/app/index.html?mock=1`. Specs use paths from the repo root. The camera is denied
for every test (`permissions: []`), so the suite never hangs on a prompt and every run exercises the
camera-refused path.

Projects: `chromium-phone`, `webkit-phone` (390x844 @2x, touch), `chromium-desktop`, `webkit-desktop` (1280x800).

## What the specs need from the app (c2)

The specs find screens by their words, exactly as PLAN.md gives them, and drive them like a customer:

| Thing | How the spec finds it |
|---|---|
| Start screen | text "Point the camera at the barcode"; "If we don't know an item, we say so." |
| Typed fallback | a textbox whose accessible name contains "Type the number"; **Enter submits** |
| Answer | an element whose own text is exactly `5¢`, `10¢` or `No refund`; the largest font on screen |
| Counter line | "The counter's count is the one that pays." visible on every answer AND on unknown |
| Unknown | "We don't know this one yet. Show it at the counter and we'll add it." |
| Scan another | a button named "Scan another" |
| SYNTHETIC barcodes | the mock page sets `window.RR_MOCK = { regular, liquor, unknown }`, or run with `QA_UPC_5`, `QA_UPC_10`, `QA_UPC_UNKNOWN` |

Hidden screens may stay in the DOM: the specs only look at what is visible.

`QA_TARGET=<path>` points the specs at another page (a deployed copy, or the stand-in below).

## The checks, and what makes each one red

| Spec | Green when | Made red by (proved once, see build-report-c4) |
|---|---|---|
| `journey.spec.js` | type → 5¢ → Scan another → 10¢ → unknown → camera refused, every button hit-tested with `elementFromPoint` | `?cover=1` lays a transparent sheet over "Scan another" |
| refund is the largest font | computed font sizes across visible text | `?small=1` shrinks the refund |
| `plain-english.spec.js` developer words | none of: undefined, null, NaN, [object Object], 4xx/5xx codes, TypeError, JSON, API, fetch, localhost, TODO, UPC, EAN, getUserMedia, NotAllowedError, BarcodeDetector, ZXing, mock | any of those on a screen |
| money words | none of "guaranteed", "you will get", "payout" | `?plant=1` plants "You will get 10¢" |
| counter line | on every answer and on unknown | remove the line |
| no numbers | clear message telling you to set the SYNTHETIC barcodes | `QA_TARGET=/PLAN.md` |
| `tools/scan-bench/bench.mjs` | new reader decodes more of 88 degraded EAN-13 photos than the old (68 vs 63–64 on 2026-09-18; far-away 8/8 vs 4/8) | comparing 13-digit expected to the reader's 12-digit UPC-A output printed NOT BETTER and exit 1 (seen once, then fixed) |
| `tools/scan-bench/live.mjs` | fake camera stream of a barcode → answer screen in under a second; blank stream → still on start | expected the 13-digit spelling: FAIL (seen once); `dx: 9999` pushes the barcode off-frame for the blank control |
| `worker/tests/off.test.mjs` (with `off-mock.mjs` on 5903 and `--var OFF_BASE:http://127.0.0.1:5903`) | pop, water without packaging data, milk, not-a-drink answer without a photo; wine without a bottle asks for the label; second lookup does not call OFF; 12↔13 digit spellings both find the row | the spelling test fails 1/1 with the `IN (?, ?)` lookup reverted (proved 2026-09-18) |

## Live round-trip (`tests/live-roundtrip.mjs`)

Against the real Worker: health, a seeded barcode returns the right class and cents and the counter line,
an unknown barcode is 404 with the honest sentence and no refund, a malformed barcode is 400 with the plain
sentence, stats counts the unknown lookup. Exit 1 on any red, 2 without `API`. Every check has a negative
control: a check whose control also passes prints VOID and counts as red (`LIVE_SELFTEST=1` demonstrates it).

## Stand-ins (not the app, not the Worker)

`app/tests/qa/fixture/stand-in.html` and `mock-api.mjs` exist only so the harness could be proved red and
green before c2's app and c1's Worker landed. They are labelled as such and never graded as the product.
`npm run test:red` runs the planted-money-words control.
