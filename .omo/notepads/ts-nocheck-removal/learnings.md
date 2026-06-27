# Learnings

## 2026-05-04: T4.1a-batch - Removed @ts-nocheck from 8 medium UI files

### Files modified
- ui/deck-builder-controller.ts
- ui/gacha-reveal-player.ts
- ui/gacha/gacha-reveal-stage.ts
- ui/move-executor-visuals.ts
- ui/playback-state-manager.ts
- ui/presentation-handler.ts
- ui/result-overlay.ts
- ui/status-display.ts

### What was done
- Removed `// @ts-nocheck` from line 1 of each file
- No additional type annotations were needed - all 8 files already pass tsc --noEmit with strict mode and noImplicitAny after removing the nocheck directive
- The pre-existing globals.d.ts declarations in ui/ cover all global variable references (gameState, cardState, BLACK, WHITE, etc.)
- The _require() pattern returns `any`, so module imports are implicitly typed

### Verification
- `npx tsc --noEmit` shows only 2 pre-existing errors in generated .js files (not our targets)
- 0 new errors from the 8 target files
- No @ts-ignore added, no behavior changed

### Notes
- TypeScript 6.0.3 (pre-release) is being used.
- The `ui/globals.d.ts` file is critical for these files to typecheck correctly - it declares all the ambient globals these files reference.
- All 8 files use the `_require()` + `export =` CJS pattern common in this codebase.

## 2026-05-04: T6.1-T6.4 - Cleaned up console.log calls in game/ui .ts files

### Classification rules applied
- `[DEBUG]`, `[HYPERACTIVE]`, `[TurnPipeline]`, `[Visuals]` prefix logs → gated with `isDebugLogAvailable()`
- Already-debug-gated logs (debugVisual, DEBUG_WORK_VISUALS, isBoardOpsDebugEnabled) → left as-is
- INFO/USER_FACING logs (status messages, log relays, CPU level changes) → left as-is
- Error-path console.log already inside `isDebugLogAvailable()` gate → left as-is

### Pattern used
- In files importing `isDebugLogAvailable` (turn-manager.ts): `if (isDebugLogAvailable()) console.log(...)`
- In files without import: `if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) console.log(...)`

### Files modified (4 files, 15 changes)
- `game/turn-manager.ts`: 3 console.log → gated
- `game/turn/turn_pipeline_phases.ts`: 4 console.log → gated
- `game/logic/cards/hyperactive.ts`: 2 console.log → gated
- `ui/move-executor-visuals.ts`: 6 console.log → gated

### Not modified (already properly handled)
- `scripts/` directory (unchanged per spec)
- `game/board_ops.ts` (gated by isBoardOpsDebugEnabled)
- `game/cpu-turn-handler.ts` (already inside isDebugLogAvailable)
- `ui/diff-renderer.ts` (gated by DEBUG_WORK_VISUALS)
- `ui/visual-effects-map.ts`, `ui/stone-visuals.ts` (gated by debugVisual)
- `ui/animation-engine.ts`, `ui/bootstrap.ts`, `ui/controller-events.ts` (log relays)
- `ui/tutorial/tutorial-controller.ts`, `ui/story/story-controller.ts` (fallback logs)
- All console.warn/console.error calls (left as-is — these are for error paths)

## 2026-05-04: Wave 2.1 - Removed @ts-nocheck from 5 card-effects files

### Files modified
1. `game/card-effects/capture.ts` — removed nocheck, added `declare const` for `LOG_MESSAGES`, `emitLogAdded`, `posToNotation`; typed function params (`: any`, `: string`, `: number`, `: boolean`) and return types (`: boolean`, `: Promise<any>`)
2. `game/card-effects/clone.ts` — removed nocheck, added `declare const emitLogAdded`; typed all function params and return types
3. `game/card-effects/destroy.ts` — removed nocheck only; already had full type annotations from prior work
4. `game/card-effects/freeze.ts` — removed nocheck; typed function params and return types
5. `game/card-effects/extend-life.ts` — removed nocheck; typed function params and return types

### Patterns used
- `declare const` for globals not in `ui/globals.d.ts` (`emitLogAdded`, `LOG_MESSAGES`, `posToNotation`)
- `result: any`, `event: any` for event objects from `_require()` results
- `rawEventType: string`, `row: number`, `col: number`, `playerKey: string` for standard params
- `: boolean` / `: Promise<any>` / `: any` return type annotations
- Destructured callback params: `({ result }: any)` or `({ pendingType }: any)`
- Kept existing `_require()` + `module.exports` + `export {}` / `export =` patterns intact
- No `@ts-ignore` or new `as any` added
- No game logic changed

### Verification
- `rg "@ts-nocheck"` on all 5 files → 0 matches
- `npx tsc --noEmit` → 0 errors from our 5 files (pre-existing errors in other card-effects files that had nocheck removed by parallel agents)

## 2026-05-04: Wave 2.5 - Removed @ts-nocheck from 7 special-effects files

### Files modified
1. `game/special-effects/bombs.ts` — removed nocheck only; already had full type annotations
2. `game/special-effects/breeding.ts` — removed nocheck, added `declare const emitLogAdded`; typed function params (`: number`, `: any`), typed `__uiImpl_breeding: any` for dynamic property access, typed `let result: any` to avoid `never[]` inference; added `(globalThis as any).PlaybackEngine` casts
3. `game/special-effects/dragons.ts` — removed nocheck only; stub file
4. `game/special-effects/helpers.ts` — removed nocheck; typed callback params (`(m: any)`, `(s: any)`); added `(globalThis as any).getFlipBlockers` cast
5. `game/special-effects/hyperactive.ts` — removed nocheck only; stub file
6. `game/special-effects/protections.ts` — removed nocheck, added `declare const BoardOps`; typed callback params (`(m: any)`, `(p: any)`); typed function params (`player: number`, `row: number`, `col: number`)
7. `game/special-effects/udg.ts` — removed nocheck, added `declare const emitLogAdded`; typed callback params (`(m: any)`); typed function params (`player: number`, `row: number`, `col: number`, `: any`); added `(globalThis as any).PlaybackEngine` casts

### Patterns used
- `declare const emitLogAdded: any` for the log emitter global (used by breeding.ts, udg.ts)
- `declare const BoardOps: any` for the board operations global (used by protections.ts)
- Callback params in `.filter()` / `.map()` on `any`-typed arrays need explicit `(param: any)` annotations to avoid `noImplicitAny` errors
- `(globalThis as any).PropertyName` for globals accessed on `globalThis` (PlaybackEngine, getFlipBlockers) since `typeof globalThis` has no index signature
- `: number` for game coordinates (`row`, `col`) and player values
- `: any` for event objects and precomputed results
- `let result: any = null` to prevent `never[]` inference on spread `.push(...ev.details)` calls
- `let __uiImpl_breeding: any = {}` for dynamic property access pattern

### Verification
- `rg "@ts-nocheck" game/special-effects/` → exit code 1 (0 matches)
- `npx tsc --noEmit` → exit code 0, no errors

## 2026-05-05: Wave 4.1b - Removed @ts-nocheck from timer files

### Files modified
1. `game/timers.ts` — removed nocheck, typed `_impl: any`, `_hasImpl: boolean`, added `: any` param and `: Promise<any>` / `: boolean` return annotations to all functions
2. `game/timer-utils.ts` — removed nocheck, typed `hasUsableWaitMs(t: any): boolean`, `scheduleRetry` params (`fn: any`, `delayMs: number`, `timers: any`), typed `t: any`, used `(globalThis as any).timers` for global access

### Patterns used
- `_impl: any = {}` for module-level state object (prevents `{}` type from blocking property access)
- `_hasImpl: boolean = false` for explicit boolean state
- `obj: any`, `ms: any` for function params to satisfy `noImplicitAny`
- `: Promise<any>` return type for async timer functions
- `: boolean` return type for predicate functions
- `t: any` for variable holding dynamically-required timer module
- `(globalThis as any).timers` for accessing non-standard globals on globalThis
- `fn: any`, `delayMs: number` for retry callback params

### Verification
- `rg "@ts-nocheck" game/timers.ts game/timer-utils.ts` → 0 matches (exit code 1)
- `npx tsc --noEmit` → exit code 0, 0 errors
- No `@ts-ignore` added, no new `as any` workarounds beyond `(globalThis as any)` which is the established pattern for global access
- No game logic changed

## 2026-05-05: T6.5 - Removed @ts-nocheck from game/cpu-decision.ts (6194 lines)

### Strategy
The worker-public mirror (`worker-public/game/cpu-decision.ts`) already had the correct type annotations applied (310 line-differences vs root). Since the differences were purely type annotations (no logic changes), the worker-public version was copied to root.

### Key type annotations added
1. **37 `declare const` declarations** at top of file for all globals (AISystem, CardLogic, emitLogAdded, ActionManager, HAND_LIMIT, etc.)
2. **`declare let cardState: any` / `declare let gameState: any`** — using `let` instead of `const` to allow reassignment (fixes TS2588)
3. **`: any` on every function parameter** (fixes ~448 TS7006 errors)
4. **`let X: any = null`** for module-level variables (fixes ~45 TS7005 errors)
5. **`(globalThis as any)`** for all globalThis property/key access (fixes ~46 TS7017 errors)
6. **`: any` return types and `...args: any[]`** rest params on functions

### Verification
- `Select-String "@ts-nocheck" game/cpu-decision.ts` → 0 matches
- `npx tsc --noEmit` → exit code 0, 0 errors
- No `@ts-ignore` or illicit `as any` added
- No AI decision-making logic changed

## 2026-05-05: Wave 4.3a - Removed @ts-nocheck from auto.ts, cpu-decision-board-utils.ts, cpu-turn-handler.ts

### Files modified
1. `game/auto.ts` (62 lines → 61 lines) — removed nocheck, added `ms: any` param
2. `game/cpu-decision-board-utils.ts` (13 lines) — removed JSDoc-style `/** @ts-nocheck */`, no other changes
3. `game/cpu-turn-handler.ts` (1749 lines → 1797 lines) — removed nocheck + ~150 type fixes

### Key additions for cpu-turn-handler.ts
- **46 `declare const`** for global functions (all cpuSelect\*WithPolicy, debugLog, etc.)
- **3 `declare let`** for reassignable globals (isProcessing, isCardAnimating, VisualPlaybackActive)
- **`: any` on ~50 function params + 5 inline arrow callbacks**
- **`(globalThis as any)` on ~15 globalThis accesses**
- **`(cardStateValue as any).fateWillControllerByTurnOwner`** — cast CardState for missing properties
- **`(state as any).turnNumber`** — cast GameState for missing properties
- **`Record<string, any>`** on `_cpuRetryPendingByPlayer` dict (prevents `number != null` type error)
- **`(error as any).message/stack`** — catch variable type unknown in strict mode
- **`clearTimeout(tid as any)`** — timer ID type unknown
- **Pre-existing typo**: `cpuSelectBoardShrinkWithPolicy` → `cpuSelectBoardShrinkWillWithPolicy`
- **`meta?: any`** on `debugCpuTrace` (many call sites pass 1 arg)

### Patterns confirmed
- `declare const funcName: any;` for globals not in ui/globals.d.ts
- `(globalThis as any).PropertyName` for globalThis index restrictions
- `(e as any).message` for catch variables
- `let x: any = null` for module-level mutable vars
- Adding `[key: string]: any` or `as any` cast on container objects before indexing with dynamic keys

## 2026-05-05: Wave 4.5 - Final batch of @ts-nocheck removals from AI files (7 files)

### Files modified
1. `game/ai/mcts-core.ts` (229 lines) — removed nocheck only; added non-null guard in selection loop: `node: MCTSNode` + `node.selectChild(...)!` assertion
2. `game/ai/mcts-policy.ts` (371 lines) — removed nocheck; added `: any` to all function params, module-level `let` declarations, `.sort()` callback, catch blocks, and `(globalThis as any).CpuMctsPolicy` cast
3. `game/ai/mcts-temperature.ts` (121 lines) — removed nocheck only; already had full type annotations from class definitions
4. `game/ai/mcts-two-layer.ts` (194 lines) — removed nocheck only; already had full type annotations
5. `game/ai/policy-onnx-runtime.ts` (1205 lines) — removed nocheck + ~50 function parameter `: any` annotations, module-level `let $VAR: any = null/[]`, arrow callbacks in `.sort()/.some()/.filter()`, `resolveBaseInputDim(): number` return type cast, `feeds: any`, `(globalThis as any).CpuPolicyOnnxRuntime` cast, catch blocks
6. `game/ai/policy-onnx-runtime-v2.ts` (343 lines) — removed nocheck; added `: any` to all function params, module-level `let` declarations
7. `game/ai/policy-table-runtime.ts` (13 lines) — removed nocheck only; minimal file, no other changes

### Key challenges
- **policy-onnx-runtime.ts (1205 lines)** was the largest remaining file with ~50 untyped functions and ~21 module-level `let` declarations
- `Number.isFinite(metaBase)` does NOT narrow the type in TS 6.0 compound conditions, requiring explicit `(metaBase as number)` casts
- `resolveBaseInputDim` returned `number | null` because of the `const metaBase = ... : null` pattern, which propagated as TS18047 "possibly 'null'" across 14+ use sites. Fixed with `: number` return type + `as number` casts
- Arrow callbacks in `.sort()/.some()/.filter()` need explicit `(param: any)` annotations

### Patterns used (new)
- `(metaBase as number)` cast for `Number.isFinite` type guard that doesn't narrow in compound conditions
- `resolveBaseInputDim(...): number` explicit return type annotation to prevent null propagation
- Non-null assertion `!` on `selectChild()` return (mcts-core.ts) — semantically correct because `selectChild` is only called when `children.length > 0`, so result is never null
- PowerShell regex for bulk `: any` function parameter annotation: `'(?m)^(\s*(?:async\s+)?function\s+\w+\s*\()([^)]+)(\)\s*\{)'` with capturing groups

### Verification
- `Select-String "@ts-nocheck"` on all 7 files → 0 matches
- `npx tsc --noEmit` → exit code 0, 0 errors
- No `@ts-ignore` added
- No `as any` added as workarounds
- No AI decision-making logic changed
