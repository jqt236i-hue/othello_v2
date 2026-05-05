# Learnings: fix-repository-issues

## T2.3: Remove @ts-nocheck from game/special-effects/ (5 files)

### Patterns used
- `ui/globals.d.ts` declares all browser globals (`cardState`, `gameState`, `BLACK`, `WHITE`, `emitBoardUpdate`, `emitGameStateChange`, `emitCardStateChange`, `MarkersAdapter`, `CardLogic`, `LOG_MESSAGES`, `getPlayerName`, `animateFadeOutAt`, `animateDestroyAt`, `animateProtectionExpireAt`, etc.) as `any`
- `emitLogAdded` is NOT in `ui/globals.d.ts` — must be declared locally with `declare const emitLogAdded: (...args: any[]) => void;` in files that use it bare (not via `ControllerEvents`)
- `BoardOps` is used bare in `protections.ts` — declared with `declare var BoardOps: any;`
- All imported modules via `_require()` return `any`, which is acceptable
- `globalThis` casts: `(globalThis as any).xxx` is the established pattern

### Files fixed
1. `helpers.ts` — added `(m: any)`, `(s: any)` typing for filter/map callbacks, `FlipBlocker` interface for return type
2. `bombs.ts` — added `BombTarget` interface for target objects, typed batch as `Promise<void>[]`, typed function signatures
3. `udg.ts` — added `declare const emitLogAdded`, typed function parameters
4. `breeding.ts` — added `declare const emitLogAdded`, typed `Record<string, any>` for UI impl, typed `waitMs`, typed function parameters
5. `protections.ts` — added `declare var BoardOps: any`, typed `timers`, `BoardOpsModule`, `waitMs`, function signatures, kept IIFE pattern intact

### Key conventions
- Keep `declare const __non_webpack_require__: NodeRequire | undefined;` at top
- Keep `_require` pattern for module loading
- Use `(globalThis as any)` for global access in module context
- Add local `declare const` for globals not in `ui/globals.d.ts`
- Preserve `module.exports` compat + `export {}` or `export =` patterns

## Wave 1.2: Remove @ts-nocheck from 9 type definition files (game/*/src/types/)

### Files modified (9 total)
All across 3 independent sets: `game/src/types/`, `game/cards/src/types/`, `game/logic/src/types/`

| File | Changes |
|------|---------|
| `player.ts` (3x) | Removed `@ts-nocheck`; added `: any` to `key`, `value` params |
| `board.ts` (3x) | Removed `@ts-nocheck`; no other changes (arrays infer as `number[][]`) |
| `index.ts` (3x) | Removed `@ts-nocheck`; multiple fixes (see below) |

### index.ts changes (3 files)
- `this && this.__createBinding` → `module.exports && module.exports.__createBinding` (TS 6.0 treats `this` as possibly `undefined` at module top-level)
- `this && this.__exportStar` → `module.exports && module.exports.__exportStar` (same reason)
- Removed the `Object.create ? (...)` ternary — collapsed to single function (ES2020 target always has `Object.create`)
- Added `: any` to all function params in `__createBinding` and `__exportStar`
- Made `k2` optional (`k2?: any`) since it's called with 3 args

### TS 6.0 strict-mode observations
- `typeof Object !== "undefined"` does NOT narrow the global `Object` at module scope (TS 6.0 limitation)
- `typeof this !== "undefined"` does NOT narrow `this` at module scope
- These `typeof` guards work for local variables but NOT for globals/keywords
- `module.exports` (type `any` from `@types/node`) is a safe alternative

### Verification
- `npx tsc --noEmit` exits 0 — all 9 files fully type-checked
- No `@ts-ignore`, no `as any`, no `@ts-nocheck` remain in these files
