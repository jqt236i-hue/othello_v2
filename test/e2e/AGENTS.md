# test/e2e/ AGENTS.md

Playwright-backed browser integration tests running under Jest. Read `../AGENTS.md` first.

## WHERE TO LOOK

| Task | Start here | Notes |
| --- | --- | --- |
| Local static server helper | `e2e-runtime-helpers.js` | Serves repo root files directly; owns startup/teardown helpers. |
| CPU browser probes | `cpu*.e2e.test.ts` | Browser globals and CPU integration checks. |
| Card / effect flows | `card_effects.e2e.test.ts`, `special_effects.e2e.test.ts`, `destroy-card-will-hunter-king.e2e.test.ts` | Use when behavior needs real browser/runtime wiring. |
| Turn / reset flows | `multi_turn_progression.e2e.test.ts`, `reset_click.e2e.test.ts` | End-to-end turn progression and UI-reset behavior. |

## CONVENTIONS

- These tests boot a local static server from repo root, then drive Chromium directly.
- Prefer `?debug=1` only when the test truly needs debug-gated globals.
- Keep each test responsible for its own page lifecycle and teardown through `e2e-runtime-helpers.js`.
- This directory is for integration behavior, not visual baseline checks; `tests/visual-regression/` owns screenshots/pixel diffs.

## ANTI-PATTERNS

- Adding unit-style assertions here when a focused Jest test under `test/` is enough.
- Re-implementing ad-hoc server or teardown logic instead of reusing `e2e-runtime-helpers.js`.
- Depending on external network, fixed ports, or long sleeps when a deterministic wait condition exists.
- Leaving browser/context/page resources open across tests.

## VERIFICATION

- Run the focused path with `npx jest --runInBand --runTestsByPath test/e2e/<file>.e2e.test.ts`.
- Browser/runtime changes may still need adjacent focused Jest, `npm run test:visual`, or `npm run test:network:parity` depending on surface.
