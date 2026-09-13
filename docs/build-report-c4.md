# Build report — c4 · QA harness, whole-suite runner, live round-trip

Branch `rig/c4`. Task taken from PLAN.md § c4 (the generated BRIEF said "none stated", PLAN.md is the
contract and does state it). Nothing from c1, c2 or c3 had landed on any branch when this was built,
so every check was proved against labelled stand-ins inside my slice; grading the real app and Worker
is the next step and is listed under "Undone".

## Built — DONE
- `package.json` (root, `@playwright/test ^1.63`), scripts `test`, `test:qa`, `test:phone`, `test:red`, `live`.
- `playwright.config.js`: every `*.spec.js` in the repo, chromium + webkit × 390x844 (touch, @2x) and 1280x800,
  static server `app/tests/qa/serve.mjs` on 5909 serving the repo root, camera denied for every test.
- `app/tests/qa/journey.spec.js`: type → 5¢ → Scan another → 10¢ → unknown → camera refused, real keystrokes
  and pointer clicks, `elementFromPoint` hit-test on every button and the field; refund is the largest
  computed font; no refund on unknown; malformed number never shows a refund.
- `app/tests/qa/plain-english.spec.js`: visible text of start, 5¢, 10¢ and unknown screens swept for
  developer words and for "guaranteed" / "you will get" / "payout"; the counter line required on every answer.
- `app/tests/qa/helpers.js`: visible-only locators (hidden screens may stay in the DOM), hit-test, sweep lists.
- `tests/live-roundtrip.mjs`: health, seeded item (class, cents, why, counter line), unknown 404 + honest
  sentence + no refund, malformed 400 + plain sentence, stats; `check()` with a negative control per
  assertion, VOID when the control also passes, exit 1 red / 2 no API.
- `docs/QA.md`: how to run, what the specs need from c2, what makes each check red.
- Stand-ins, clearly labelled, SYNTHETIC barcodes: `app/tests/qa/fixture/stand-in.html`, `mock-api.mjs`.

## Verified — and how each was made red
All numbers from this worktree's stand-in pages (no shared tree was graded; the app does not exist yet).
- Full suite on the stand-in: **12 passed** (2 specs × 4 projects, 3 tests each side).
- `?plant=1` ("You will get 10¢" on the answer): plain-english **RED** `money-promise words on screen: /\byou will get\b/i`. Restored.
- `?cover=1` (transparent sheet over "Scan another"): journey **RED** `Scan another is covered at its centre`. Restored.
- `?small=1` (refund shrunk): journey **RED** `largest font on the answer is "Scan another" (18px), not the refund`.
  This control caught a real bug in my own helper: the first version counted text on hidden screens
  (it reported the hidden Start heading as largest). Fixed to skip elements with no client rects.
- `QA_TARGET=/PLAN.md` (no SYNTHETIC numbers): **RED** with the plain instruction to set them.
- Live script vs mock API: **all green, exit 0**; mock with `LIE=cents` (10¢ for the 5¢ item): **RED, exit 1**;
  `LIVE_SELFTEST=1`: the deliberate cannot-fail check prints **VOID** and counts red; no `API`: exit 2.
- Screenshots (pwshot + spec) in `app/tests/qa/shots/`, chromium and webkit, both viewports.

## Undone / needs another slice
- **c2**: the mock page must expose `window.RR_MOCK = { regular, liquor, unknown }` with its three SYNTHETIC
  barcodes (or main passes `QA_UPC_5/10/UNKNOWN`), the typed field's accessible name must contain
  "Type the number" and Enter must submit, "Scan another" must be a button. All in docs/QA.md. If c2's own
  specs assume port 5901 or a base path other than `/app/`, they will need `baseURL`-relative paths to run
  under the root config; c2's specs will also be run with the camera denied.
- **Main**: once c2 and c1 land, run `rig qa --ref <sha> --port 5909 --run "npm test"` and
  `API=<worker> npm run live -- --upc <seeded> --class <class> --cents <n>`; report the sha.
- Not done: the suite has not yet graded the real app or the real Worker (they do not exist on any branch).
- `rig qa --help` created `.worktrees/qa` pinned to 0041fa3; harmless, ignored by git.
