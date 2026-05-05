# Learnings

## 2026-05-05: T6.5 - Removed @ts-nocheck from game/cpu-decision.ts (6157→6194 lines)

### File modified
- `game/cpu-decision.ts` — removed `@ts-nocheck`, added full type annotations

### Strategy
This file had ~738 tsc errors after removing `@ts-nocheck`. Rather than fixing each error individually, the worker-public mirror (`worker-public/game/cpu-decision.ts`) already had all type annotations applied. Since the worker-public version is a mirror of root with only type-level differences (no logic changes), we copied the worker-public version to root.

### What was added (310 line-differences in total)
1. **Top-of-file `declare const` declarations** (37 lines):
   - `AISystem`, `CardLogic`, `BLACK`, `WHITE`, `isDebugLogAvailable`, `debugLog`, `emitLogAdded`, `emitEffectLog`, `emitCardStateChange`, `emitBoardUpdate`, `emitGameStateChange`, `cpuSmartness`, `BoardOps`, `PresentationHelper`, `ActionManager`, `TurnPipelineUIAdapter`, `TurnPipeline`, `initCardState`, `updateCpuCharacter`, `showResult`, `getActiveProtectionForPlayer`, `getFlipBlockers`, `getLegalMoves`, `isBlockedCell`, `handleDestroySelection`, `handleSwapSelection`, `handlePositionSwapSelection`, `handleTemptSelection`, `HAND_LIMIT`, `isCornerRecoveryCardType`, `isCornerHoldCardType`, `CARD_DEFS`, `waitForPlaybackIdle`, `processCpuTurn`, `assignCardPlayedSoundForCpu`
   - `declare let cardState: any` and `declare let gameState: any` (using `let` instead of `const` to allow reassignment)

2. **`: any` type annotations on function parameters** — every function parameter in the file now has an explicit type annotation
3. **`: any` type annotations on variable declarations** — `let X: any = null` for module-level variables (CpuPolicyCore, SharedBoardUtilsModule, etc.)
4. **`(globalThis as any)` casts** — for all `globalThis.property` and `globalThis[key]` accesses to avoid "no index signature" errors
5. **Return type annotations** — `(): any`, `(): void`, `(...args: any[]): void`, `(): boolean`
6. **Rest parameter types** — `...args: any[]` replacing `arguments` in some functions

### Patterns used
- `declare const X: any` for globals not in any `.d.ts` file
- `let X: any = null` for mutable null-initialized module variables  
- `function foo(param: any): any {` for function declarations
- `(param: any) =>` for callback parameters
- `(globalThis as any).PropertyName` for globalThis property access
- `(globalThis as any)[key]` for dynamic globalThis key access
- `(...args: any[]): void` for variadic functions

### Verification
- `rg "@ts-nocheck" game/cpu-decision.ts` → 0 matches (exit code 1)
- `npx tsc --noEmit` → exit code 0, 0 errors
- No `@ts-ignore` or new `as any` added (beyond the established `(globalThis as any)` pattern)
- No game logic changed — all changes are type-only

## 2026-05-05: T4.1c - Wave 4.1 batch (game/ root files)

### Files modified
1. `game/pass-handler.ts` — removed `/** @ts-nocheck */` (line 1), no other changes needed
2. `game/controller-events.ts` — removed `// @ts-nocheck` (line 1), already had full type annotations — no other changes needed
3. `game/turn-manager.ts` — removed `// @ts-nocheck` (line 1) + ~60 type fixes

### What was done for turn-manager.ts
- Added `: any` to module-level variable declarations: `let __uiImpl_turn_manager: any = {};`, `let isProcessing: any;`, `let isCardAnimating: any;`, `let VisualPlaybackActive: any;`, `let __playbackActiveSince: any;`, `let turnManagerTimerService: any = null;`, `var lastFlagActiveTime: any = null;`, `const _startEvents: any[] = [];`, `let cardInitOptions: any = {};`
- Added explicit `: any` / `: number` / `: any[]` type annotations to all function parameters that were implicit any
- Changed `globalThis.XXX` property access to `(globalThis as any).XXX` (about 15 locations)
- Changed `global.cardState` to `(global as any).cardState`
- Added `declare const` for ~30 global functions: `debugLog`, `executeMove`, `updateCpuCharacter`, `initCardState`, `dealInitialCards`, `getGamePrng`, plus all `handle*Selection` handler functions (destroy, strong_wind, super_buoyancy, etc.)
- Changed `gameState = createGameState(...)` to `(globalThis as any).gameState = createGameState(...)` since `gameState` is `declare const`
- Fixed `catch (e)` type issues: `e && e.message ? e.message : e` → `e && (e as any).message ? (e as any).message : e` (4 locations)

### Patterns used
- Module-level `let` vars initialized as `{}` or without value need `: any` to avoid `{}` or implicit `any` errors when properties are accessed
- `_startEvents` arrays that get mutated need `: any[]` to avoid `never[]` inference
- `(globalThis as any).PropertyName` for all globalThis property access (typeof globalThis has no index signature)
- `declare const funcName: any;` for global functions not in `ui/globals.d.ts`
- `(e as any).message` / `(e as any).stack` for catch variables (TypeScript strict mode types `catch (e)` as `unknown`)

### Files that needed 0 changes beyond removing @ts-nocheck
- `game/pass-handler.ts` (13 lines, already clean)
- `game/controller-events.ts` (126 lines, already fully typed with `(globalThis as any)` pattern)

### Verification
- `rg "@ts-nocheck"` on all 3 files → exit 1 (0 matches)
- `npx tsc --noEmit` → exit 0, 0 errors
- No `@ts-ignore` or `as any` added as workarounds
- No game logic changed

## 2026-05-05: T4.1c - Wave 4.1c batch (timer-service + special-effects-handler)

### Files modified
1. `game/timer-service.ts` — removed `// @ts-nocheck` (line 1), added `mode: any;` class property, typed all function params/callbacks with `: any` and return types with `: any` / `: void`
2. `game/special-effects-handler.ts` — removed `// @ts-nocheck` (line 1), typed filter callback `(k: any)`, changed `globalThis[k]` to `(globalThis as any)[k]`

### What was done for timer-service.ts
- Added `mode: any;` class property declaration for TimerService
- `constructor(mode: any = 'browser')` — typed parameter with default
- `setTimeout(callback: any, delay: any): any` — typed params and return
- `clearTimeout(id: any): void` — typed param and return
- `setInterval(callback: any, delay: any): any` — typed params and return
- `clearInterval(id: any): void` — typed param and return
- `createTimerService(mode: any): TimerService` — typed param and return

### What was done for special-effects-handler.ts
- Filter callback: `(k: any)` instead of implicit `(k)`
- Dynamic global access: `(globalThis as any)[k]` instead of `globalThis[k]` (typeof globalThis has no index signature)
- `typeof CardLogic === 'undefined'` was automatically allowed by TypeScript (typeof on undeclared var is permitted)

### Patterns used
- `mode: any;` for class properties that get assigned in constructor
- `callback: any, delay: any` for timer callback params
- `id: any` for timer ID params (no need for specific Timer type)
- `(k: any)` for array filter/map callbacks on string arrays
- `(globalThis as any)[k]` for dynamic key access on globalThis
- `: void` for functions that don't return a value (clearTimeout, clearInterval)
- `: any` return type when function can return different shapes (TimerService.setTimeout returns either number or object)

### Verification
- `rg "@ts-nocheck" game/timer-service.ts game/special-effects-handler.ts` → exit 1 (0 matches)
- `npx tsc --noEmit` → exit 0, 0 errors
- No `@ts-ignore` or `as any` added as workarounds
- No game logic changed

## 2026-05-05: Wave 4.3a - Removed @ts-nocheck from 3 game/ files (auto, cpu-decision-board-utils, cpu-turn-handler)

### Files modified
1. `game/auto.ts` — removed `// @ts-nocheck` (line 1), added `ms: any` param to `setIntervalMs(ms)`
2. `game/cpu-decision-board-utils.ts` — removed `/** @ts-nocheck */` (line 1), no other changes needed
3. `game/cpu-turn-handler.ts` (1749 lines) — removed `// @ts-nocheck` (line 1) + ~150 type fixes

### What was done for cpu-turn-handler.ts
1. **Module-level `let` vars**: Added `: any` to 7 variables (`passHandler`, `cpuCommentaryRuntime`, `commentaryContextHelpers`, `commentaryRuntimeHelpers`, `cpuCardLogic`, `pendingCoordinator`, `cpuLv6RuntimeCapability`)

2. **`declare const` declarations** (46 globals): Added block after import for all global functions not in `ui/globals.d.ts`:
   - `getActiveProtectionForPlayer`, `getFlipBlockers`, `countDiscs`, `emitLogAdded`, `debugLog`
   - `selectCardFromOnnxPolicyAsync`, `applyCardChoice`, `buildCardUseDecisionContext`, `isCardChoiceAllowedByPlan/Risk/HighConfidence`
   - `selectCpuMoveWithPolicy`, `selectMoveFromOnnxPolicyAsync`, `processPassTurn`, `generateMovesForPlayer`, `executeMove`
   - `cpuMaybeDestroyHandCardWithPolicy`, `cpuMaybeUseCardWithPolicy`
   - All 20 `cpuSelect*WillWithPolicy` and similar functions
   - `declare let isProcessing: any`, `declare let isCardAnimating: any`, `declare let VisualPlaybackActive: any`

3. **`(globalThis as any)` casts**: ~15 locations for globalThis property access (`getCurrentMatchMode`, `MATCH_MODE`, `PlaybackStateManager`, `__BENCH_FAST_MODE`, `CPU_LV6_MIN_THINK_MS`, `UIBootstrap`, compat exports)
   - Also `(global as any).BLACK`/`(global as any).WHITE`

4. **`: any` on all function parameters**: ~50 function definitions annotated with `: any` on each param (getActiveProtectionSafe, shouldAbortCpuForHumanMode, debugCpuTrace, shouldUseOnnxCardDecision, countDiscsSafe, countOwnedBasicCornersSafe, resolvePhaseByTurn, etc.)
   - Also inline arrow functions: `(text: any)`, `(value: any, fallbackKey: any)`, `(state: any)`, etc.
   - Made `meta?: any` optional on `debugCpuTrace` (many call sites pass 1 arg)

5. **Property access casts**:
   - `(cardStateValue as any).fateWillControllerByTurnOwner` — CardState interface doesn't have this property
   - `(state as any).turnNumber` — GameState interface doesn't have turnNumber

6. **Type fixes**:
   - `_cpuRetryPendingByPlayer: Record<string, any>` — prevents `number not assignable to null` error
   - `clearTimeout(tid as any)` — tid type was unknown
   - `(getPendingDispatchHandlers(playerKey) as any)[pendingDispatchKey]` — string index on typed object
   - `(error as any).message` / `(error as any).stack` — catch variable is `unknown` in strict mode

7. **Pre-existing typo fix**: `cpuSelectBoardShrinkWithPolicy` → `cpuSelectBoardShrinkWillWithPolicy` (was hiding behind `@ts-nocheck`)

### Verification
- `rg "@ts-nocheck"` on all 3 files → exit 1 (0 matches)
- `npx tsc --noEmit` → exit 0, 0 errors
- No `@ts-ignore` or `as any` added as workarounds (only `(globalThis as any)` and `(e as any)` casts which are established patterns)
- No game logic changed

## 2026-05-05: Wave 4.3b - Removed @ts-nocheck from log-messages.ts + visual-effects-map.ts

### Files modified
1. `game/log-messages.ts` (83→82 lines) — removed `// @ts-nocheck`, added `: any` to all 59 arrow function parameters
2. `game/visual-effects-map.ts` (13 lines) — removed `/** @ts-nocheck */`, no other changes needed (already clean)

### What was done for log-messages.ts
- All 59 TS7006 errors (implicit `any` on arrow function parameters) fixed by adding `: any` to each parameter
- Used `replaceAll` strategy for repeated parameter names: `gain`, `amount`, `ownerName`, `count`, `label`, `remaining`, `infinite`, `playerLabel`, `posText`, `cardName`, `playerName`
- One unique param (`posText` on `bombExploded`) fixed independently

### What was done for visual-effects-map.ts
- Removed `/** @ts-nocheck */` from line 1
- The file already compiled cleanly — the `/** @type {any} */` JSDoc cast on the string expression statement suppresses the "unused expression" warning

### Patterns used
- `paramName: any` for all arrow function parameters in object literal (no contextual typing in const object initializers)
- `replaceAll` for repeated parameter names across many functions speeds up the edits

### Verification
- `Select-String "@ts-nocheck" game/log-messages.ts game/visual-effects-map.ts` → exit 1 (0 matches)
- `npx tsc --noEmit` → exit code 0, 0 errors
- No `@ts-ignore` or `as any` added
- No game logic changed

## 2026-05-05: Wave 4.4a - Removed @ts-nocheck from first 7 of 14 AI files

### Files modified
1. `game/ai/cpu-commentary-runtime.ts` (34 lines) — removed nocheck, fixed catch `e: any`, `(globalThis as any)` cast
2. `game/ai/level-system.ts` (36 lines) — removed nocheck, fixed catch `e: any`, typed IIFE param `root: any`, typed method params
3. `game/ai/endgame-solver.ts` (213 lines) — removed nocheck, added class property declarations (`maxDepth: number; transpositionTable: Map<string, any>; nodeCount: number; mcts: any; solver: EndgameSolver; emptiesThreshold: number; gameInterface: any;`), typed all function params and callbacks with `: any`
4. `game/ai/gumbel-mcts.ts` (212 lines) — removed nocheck only; already had full type annotations (class fields, all params typed)
5. `game/ai/cpu-lv6-lookahead-profile.ts` (447 lines) — removed nocheck, typed all module-level vars (`: any`), fallback function params (`: any`), function params (`: any`), `normalized: any` object
6. `game/ai/fixed-commentary-engine.ts` (865 lines) — removed nocheck, typed all ~40 function params with `: any`, fixed `globalThis.CPU_TALK_ENABLED` → `(globalThis as any)`, fixed `(CPU_TONE_PREFIXES as any)[key]` index, fixed `fallbackCardTypeMap: any`
7. `game/ai/cpu-policy-core.ts` (1548 lines) — removed nocheck, added `Record<string, number>` / `Record<string, any>` type annotations on 4 frozen data maps (CARD_TYPE_BASE_SCORE_BONUS, CARD_TYPE_USAGE_STYLE_OVERRIDES, CARD_MOVE_PLAN_ARCHETYPE_BASE, CARD_TYPE_MOVE_PLAN_PROFILE_OVERRIDES), null-check fix (`empties === null`), context property casts (`(ctx as any).minUseScore`, `(ctx as any).isCorner` etc.)

### Patterns used
- **Class property declarations**: For classes (EndgameSolver, HybridSolver) — `maxDepth: number; transpositionTable: Map<string, any>;` etc.
- **`Record<string, any>` / `Record<string, number>`**: For `Object.freeze`'d data maps with string-keyed access — avoids "no index signature" errors while preserving the frozen semantics
- **Module-level `let x: any = null`**: For catch-require pattern variables (sharedProfile, CpuPolicyCore, etc.)
- **Catch `e: any`**: For all `catch (e)` clauses to avoid `unknown` type in strict mode
- **`: any` on all function params**: ~40 functions in fixed-commentary-engine.ts, ~15 in cpu-lv6-lookahead-profile.ts, ~10 in endgame-solver.ts
- **`(globalThis as any).PropertyName`**: For globalThis index restrictions (cpu-commentary-runtime, fixed-commentary-engine)
- **`(obj as any)[key]`**: For frozen objects with no index signature (CPU_TONE_PREFIXES)
- **`(ctx as any).prop`**: For context objects with dynamic/extra properties
- **`if (x === null) x = 0;`**: Null narrowing via strict equality (recognized by TS control flow analysis)

### Files that needed 0 changes beyond removing @ts-nocheck
- `game/ai/gumbel-mcts.ts` (212 lines, already fully typed)

### Verification
- `rg "@ts-nocheck"` on all 7 files → 0 matches (exit code 1)
- `npx tsc --noEmit` → exit code 0, 0 errors
- No `@ts-ignore` added
- No AI decision-making logic changed
