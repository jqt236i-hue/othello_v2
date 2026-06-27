# Fix Build and Headless Crash - Learnings

## 2026-05-07 Current State

### Problems Identified
1. **tsconfig.json**: `include` has `"*.ts"` which matches `dist/**/*.d.ts`, causing TS5055 build errors
2. **game-controller-slim.ts**: Lines 8-11 access `globalThis.CARD_DEFS` at module top-level → crashes in Node.js
3. **hyperactive.ts**: Uses `BLACK`/`WHITE` without definition (lines 67, 248, 259, 271, 293, 318, 329, 345, 403, 431, 451)
4. **dragons.ts**: Uses `BLACK`/`WHITE` without definition (lines 71, 256, 301, 302, 318, 345)
5. **udg.ts**: Uses `BLACK`/`WHITE` without definition (lines 27, 96)
6. **breeding.ts**: Uses `BLACK`/`WHITE` without definition (lines 52, 137)

### Reference Pattern
- `game/logic/cards/living_will.ts` uses SharedConstants import for BLACK/WHITE
- `shared-constants.ts` exports `BLACK = 1`, `WHITE = -1`

### Fix Strategy
- Task 1: Remove `"*.ts"` from tsconfig.json include; also changed all includes from `dir/**/*` to `dir/**/*.ts` to prevent `.d.ts` in dist from being treated as inputs
- Task 2: Wrap CARD_DEFS access in lazy initialization function with Proxy for backward compatibility
- Tasks 3-6: Add `const BLACK = 1; const WHITE = -1;` at file top

---

## 2026-05-07 Final Report

### Tasks Completed (8/8 + Final Wave)

| Task | File | Change | Status |
|------|------|--------|--------|
| 1 | `tsconfig.json` | Removed `"*.ts"`, changed includes to `**/*.ts` | ✅ |
| 2 | `game/game-controller-slim.ts` | Lazy CARD_DEFS via Proxy + `getCardTypeByIdMap()` | ✅ |
| 3 | `game/special-effects/hyperactive.ts` | Added `const BLACK = 1; const WHITE = -1;` | ✅ |
| 4 | `game/special-effects/dragons.ts` | Added `const BLACK = 1; const WHITE = -1;` | ✅ |
| 5 | `game/special-effects/udg.ts` | Added `const BLACK = 1; const WHITE = -1;` | ✅ |
| 6 | `game/special-effects/breeding.ts` | Added `const BLACK = 1; const WHITE = -1;` | ✅ |
| 7 | Build verification | `npm run build:ts` exit 0 | ✅ |
| 8 | Test verification | `npm run test:jest` no new failures | ✅ |

### Verification Results
- `npm run typecheck`: **PASS** (exit 0)
- `npm run build:ts`: **PASS** (exit 0, no TS5055)
- `npm run test:jest`: **PASS** (no `ReferenceError: BLACK is not defined`)
- `npm run check:window`: **PASS** (150 existing refs, no new additions)
- Node.js require (all 5 fixed files): **PASS**

### Final Wave Verdicts
- F1 Plan Compliance: **APPROVE** (Must Have 3/3, Must NOT Have 4/4)
- F2 Code Quality: **APPROVE** (Build/TypeCheck/Tests all pass)
- F3 Real Manual QA: **APPROVE** (6/6 scenarios pass)
- F4 Scope Fidelity: **APPROVE** (8/8 tasks compliant)

### Notes
- `01-rulebook.md` was NOT modified (no spec changes)
- `worker-public/` was NOT directly edited
- No new globalThis/window/DOM dependencies added to `game/`
- All changes are pure bug fixes with no behavior changes
