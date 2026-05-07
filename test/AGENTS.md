# test/ AGENTS.md

Main Jest test directory. `tests/` is different: setup files and visual-regression scripts live there.

## Layout

| Area | Purpose |
| --- | --- |
| `*.test.ts` / `*.test.js` | Main Jest tests, mostly flat by prefix: `game.*`, `ui.*`, `workers.*`, `selfplay.*`, `shared.*`, `scripts.*`, `utils.*`. |
| `helpers/` | Shared state builders for game/card/chain tests. |
| `e2e/` | Playwright-backed browser tests with local static server helpers. |

## Naming and pairing

- Prefer `domain.feature.test.ts` naming matching existing prefixes.
- Many tests have both `.ts` and `.js` variants; preserve nearby pairing convention unless the touched area has clearly moved to TS-only.
- Do not add `.only` / `.skip` as committed state.

## Focused commands

```powershell
npx jest --runInBand --runTestsByPath test/game.some-feature.test.ts
npx jest --runInBand --testPathPattern "ui\.animation"
npm run test:jest:changed
npm run test:jest:noanim
npm run test:network:parity
```

## Special suites

- Animation timing tests often need `NOANIM=1` / `npm run test:jest:noanim`.
- `test/e2e/` starts browser/server resources; use only when integration behavior needs it.
- `npm run test:visual` is not ordinary Jest; it runs `tests/visual-regression/run-visual-check.js` with Playwright + pixelmatch.
- Network behavior should use the package script `npm run test:network:parity` or a focused subset from its explicit file list.

## Verification

- For source changes, run the closest focused test first, then broaden only if needed.
- Remember `npm test` runs `pretest` → `npm run checkall` before Jest.
