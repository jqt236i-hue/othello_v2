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
