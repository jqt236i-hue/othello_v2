# tests/ AGENTS.md

Jest setup and visual-regression tooling. This is different from `test/`, which holds the main Jest suite.

## Layout

| Path | Purpose |
| --- | --- |
| `jest.setup.js` | Jest setup hook; sets test environment state. |
| `jest.afterenv.js` | After-env hooks for Jest. |
| `visual-regression/run-visual-check.js` | Playwright + pixelmatch visual regression runner. |
| `visual-regression/capture-board*.js` | Baseline/fallback screenshot capture helpers. |
| `visual-regression/baseline/` | Baseline images. Treat updates as visual changes. |

## Rules

- Do not put ordinary unit tests here; use `test/` and its prefix conventions.
- Visual checks are browser tests, not normal Jest.
- Baseline image changes must be intentional and reported as user-visible visual changes.
- Keep local server / Playwright helpers deterministic; use explicit debug/no-animation flags when needed.

## Commands

```powershell
npm run test:visual
npx jest --runInBand --runTestsByPath <focused test path>
```

## Verification

- UI appearance changes: run `npm run test:visual` when the changed surface is covered.
- Jest setup changes: run at least one focused Jest test that depends on setup, then broaden if failures indicate shared impact.
- Do not commit `.only`, `.skip`, or incidental screenshots/artifacts.
