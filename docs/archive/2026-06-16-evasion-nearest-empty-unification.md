# Evasion Nearest Empty Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `反転回避` と `破壊回避` を、周囲1マスに空きがなくても盤面上の最短空きマスへ移動して成立する共通仕様に変更する。

**Architecture:** Keep the rule in the headless game layer. Add one deterministic destination-selection helper, then make both flip evasion and destroy evasion call it so they share distance, tie-breaking, forbidden-cell, and blocked-cell semantics. UI only consumes resulting `MOVE`/presentation metadata and does not choose destinations.

**Tech Stack:** TypeScript/CommonJS game modules, Jest, browser module registry, Cloudflare Worker mirror via existing npm scripts.

---

## Document Role

This is an implementation plan, not the gameplay source of truth. The gameplay source of truth must be updated first in `01-rulebook.md`, then `正本/共通ルール正本.md` and `正本/カード仕様正本.md`. Generated and mirror files such as `public/module-registry.js`, `dist/`, and `worker-public/` must be produced by scripts, not hand-edited first.

## Current Investigation Summary

- `破壊回避` currently uses `game/logic/board_ops.ts` and already scans the board for a distant empty cell, but tie-breaking is fixed by sort order instead of random.
- `反転回避` currently uses `game/logic/cards/hyperactive.ts` and only checks neighboring empty cells.
- `増殖の意志` already uses the desired model: Chebyshev distance, nearest candidates, deterministic PRNG tie-break. This plan reuses that model for evasion.
- Network authority requires canonical randomness in headless/authority execution. Do not select the destination in UI code.

## Desired Behavior

- `反転回避` and `破壊回避` select from valid empty board-shape cells.
- Distance is Chebyshev distance from the original stone cell: `max(abs(delta row), abs(delta col))`.
- The original cell is never a destination.
- Blocked, hole, frozen-as-blocking, or otherwise non-enterable cells are not destinations through the existing blocked-cell checks.
- If several valid empty cells have the same minimum distance, choose one with the injected deterministic PRNG.
- If no valid empty cell exists, evasion is not established.
- Failed `反転回避`: normal flip continues and the evasion counter is not consumed.
- Failed `破壊回避`: normal destroy continues and the evasion counter is not consumed.
- Existing forbidden target behavior remains:
  - Flip evasion cannot move onto another cell in the same flip target set.
  - Destroy evasion respects `meta.forbiddenEvadeCells`.

## File Structure

- Create `game/logic/cards-internal/evasion-destination.ts`
  - Pure helper for nearest-empty destination selection from an already collected candidate list.
  - Owns distance calculation, stable candidate normalization, forbidden-cell filtering, and deterministic random tie-break.
- Modify `game/logic/board_ops.ts`
  - Require the helper.
  - Replace `_findDestroyEvadeDestination()` tie-breaking with the shared helper.
  - Optionally route `_findProliferationDestination()` through the helper to keep identical nearest-empty semantics in one place.
- Modify `game/logic/cards/hyperactive.ts`
  - Require the helper.
  - Replace flip-evasion neighbor-only destination selection with all-board nearest-empty selection.
  - Preserve `ESCAPE_HYPERACTIVE` turn-start movement behavior; only flip evasion changes.
- Modify `workers/match-worker.ts` and `workers/match-worker-runtime-preload.ts`
  - Add the new helper to worker preload/module resolution if the runtime require path needs explicit registration.
- Modify `01-rulebook.md`
  - Update common and per-card wording for `反転回避` and `破壊回避`.
- Modify `正本/共通ルール正本.md` and `正本/カード仕様正本.md`
  - Align shared desired behavior and card table wording.
- Modify `cards/card-interaction-effects.ts`
  - Update visible detail text for affected cards.
- Modify `ui/handlers/rules-help.ts`
  - Update glossary/help wording for `反転回避` and `破壊回避`.
- Modify tests:
  - `test/game.evasion-destination.test.ts`
  - `test/game.afterimage-will.test.ts`
  - `test/game.will-hunter-king.test.ts`
  - `test/game.extreme-hyperactive-will.test.ts`
  - `test/game.escape-will.test.ts`
  - `test/game.ultimate-hyperactive-god.test.ts`
  - `test/cards.afterimage-will-surfaces.test.ts`
  - `test/cards.escape-will-surfaces.test.ts`
  - `test/ui.rules-help-panel.test.ts`
- Generated or mirrored outputs to refresh by script:
  - `dist/**`
  - `public/module-registry.js`
  - `worker-public/**`

## Task 0: Worktree Safety Gate

**Files:**
- Inspect only.

- [ ] **Step 1: Check current working tree**

Run:

```powershell
git status --short
```

Expected: If unrelated dirty files exist, classify them before editing. In the current checkout, many unrelated dirty files already exist. Do not stage, revert, or overwrite them.

- [ ] **Step 2: Confirm implementation can be isolated**

Run:

```powershell
git diff --name-only
git diff --cached --name-only
```

Expected: If any file that must be edited for this plan already has unrelated changes, inspect it before editing:

```powershell
git diff -- 01-rulebook.md cards/card-interaction-effects.ts ui/handlers/rules-help.ts game/logic/board_ops.ts game/logic/cards/hyperactive.ts
git diff --cached -- 01-rulebook.md cards/card-interaction-effects.ts ui/handlers/rules-help.ts game/logic/board_ops.ts game/logic/cards/hyperactive.ts
```

If existing changes are unrelated and cannot be separated safely, stop and ask the user how to proceed. Do not create a branch or worktree unless the user explicitly asks.

## Task 1: Update Gameplay Specification Text

**Files:**
- Modify: `01-rulebook.md`
- Modify: `正本/共通ルール正本.md`
- Modify: `正本/カード仕様正本.md`

- [ ] **Step 1: Update common rulebook wording**

In `01-rulebook.md`, add or update the common `反転回避` / `破壊回避` wording so the rule is explicit:

```markdown
- `反転回避` と `破壊回避` の移動先は、元位置から最も近い有効な空きマスから選ぶ。近さは8方向距離で判定し、同距離候補が複数ある場合はランダムに1つ決定する
- 周囲1マスに空きマスがなくても、盤面上に有効な空きマスが1つでもあれば回避は成立する
- 盤面上に有効な空きマスが1つも無い場合だけ回避不成立となる。反転回避は通常どおり反転され、破壊回避は通常どおり破壊される。回避不成立時は残回数を消費しない
```

- [ ] **Step 2: Update affected card-specific rulebook lines**

Update the affected card sections in `01-rulebook.md`:

```markdown
### 10.5.1 AFTERIMAGE_WILL（避ける意志）

- `反転回避` / `破壊回避` は、それぞれ回避に成功した時だけ対応する残回数を1消費する
- 反転または破壊の対象になったとき、盤面上の最も近い有効な空きマスへ移動して回避する。近さは8方向距離で判定し、同距離候補が複数ある場合はランダムに1つ決定する
- 盤面上に有効な空きマスが1つも無い場合だけ回避不成立となる。`反転回避` は通常どおり反転され、`破壊回避` は通常どおり破壊される。回避不成立時は残回数を消費しない
```

Update the hyperactive-family sections with this wording pattern:

```markdown
- 反転対象になったときは、盤面上の最も近い有効な空きマスへ移動して回避する（回数上限まで）。近さは8方向距離で判定し、同距離候補が複数ある場合はランダムに1つ決定する
- 盤面上に有効な空きマスが1つも無い場合だけ回避不成立となり、通常どおり反転される。回避不成立時は残回数を消費しない
```

For cards with `破壊回避`, add:

```markdown
- 破壊対象になったときも、盤面上の最も近い有効な空きマスへ移動して回避する。近さは8方向距離で判定し、同距離候補が複数ある場合はランダムに1つ決定する
- 盤面上に有効な空きマスが1つも無い場合だけ破壊回避は不成立となり、そのまま破壊される。回避不成立時は残回数を消費しない
```

- [ ] **Step 3: Resolve escape wording contradiction**

For `ESCAPE_WILL（逃げる意志）`, keep turn-start no-move explosion only for turn-start movement. Use this wording:

```markdown
- ターン開始時の逃亡移動で移動先が無い場合は周囲8マスを爆破して自身も消滅する
- 反転回避で盤面上に有効な空きマスが1つも無い場合は爆発せず、回避不成立となり通常どおり反転される。回避不成立時は残回数を消費しない
```

- [ ] **Step 4: Update 正本 common rules**

In `正本/共通ルール正本.md`, replace the current evasion destination paragraphs with:

```markdown
反転回避と破壊回避の移動先は、元位置から最も近い有効な空きマスから選びます。近さは8方向距離で判定します。同距離の候補が複数ある場合は、同じ対局結果として全員の画面で一致するようにランダムで1つだけ決定します。

周囲1マスに空きマスがなくても、盤面上に有効な空きマスが1つでもあれば回避は成立します。盤面上に有効な空きマスが1つも無い場合だけ回避不成立となり、反転回避では通常どおり反転され、破壊回避では通常どおり破壊されます。回避不成立時は残回数を消費しません。
```

- [ ] **Step 5: Update card specification master table**

In `正本/カード仕様正本.md`, update affected rows to avoid card-local duplicate rules. Use this pattern:

```markdown
回避の移動先と不成立条件は共通ルールに従う。
```

For `避ける意志`, the row should include:

```markdown
反転回避と破壊回避の移動先と不成立条件は共通ルールに従う。
```

- [ ] **Step 6: Verify docs references**

Run:

```powershell
rg -n "反転回避.*1マス移動で回避|反転回避.*移動先が無い|破壊回避.*空きマスが無い|周囲1マス.*回避" 01-rulebook.md 正本 docs cards ui test -S
```

Expected: Remaining hits are either updated wording, turn-start-only movement wording, or tests intentionally updated in later tasks.

- [ ] **Step 7: Commit spec update if isolated**

Only if these files have no unrelated staged or unstaged changes:

```powershell
git add 01-rulebook.md 正本/共通ルール正本.md 正本/カード仕様正本.md
git commit -m "Update evasion destination spec"
```

If unrelated edits exist in the same files, do not commit. Record the conflict and ask the user.

## Task 2: Add Shared Evasion Destination Helper

**Files:**
- Create: `game/logic/cards-internal/evasion-destination.ts`
- Test: `test/game.evasion-destination.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `test/game.evasion-destination.test.ts`:

```typescript
import EvasionDestination = require('../game/logic/cards-internal/evasion-destination');

function prng(values: number[]) {
  let index = 0;
  return {
    random: () => {
      const value = values[index] ?? values[values.length - 1] ?? 0;
      index += 1;
      return value;
    }
  };
}

describe('evasion destination helper', () => {
  test('selects nearest empty candidate by Chebyshev distance', () => {
    const destination = EvasionDestination.selectNearestEmptyEvasionDestination(
      { row: 4, col: 4 },
      [
        { row: 0, col: 0 },
        { row: 4, col: 7 },
        { row: 6, col: 6 }
      ],
      prng([0])
    );

    expect(destination).toEqual({ row: 6, col: 6 });
  });

  test('uses deterministic random selection for equal Chebyshev distance', () => {
    const candidates = [
      { row: 2, col: 2 },
      { row: 2, col: 4 },
      { row: 4, col: 2 },
      { row: 4, col: 4 }
    ];

    const first = EvasionDestination.selectNearestEmptyEvasionDestination(
      { row: 3, col: 3 },
      candidates,
      prng([0])
    );
    const last = EvasionDestination.selectNearestEmptyEvasionDestination(
      { row: 3, col: 3 },
      candidates,
      prng([0.999])
    );

    expect(first).toEqual({ row: 2, col: 2 });
    expect(last).toEqual({ row: 4, col: 4 });
  });

  test('excludes origin, duplicate, and forbidden cells before scoring', () => {
    const destination = EvasionDestination.selectNearestEmptyEvasionDestination(
      { row: 3, col: 3 },
      [
        { row: 3, col: 3 },
        { row: 2, col: 2 },
        { row: 2, col: 2 },
        { row: 1, col: 1 }
      ],
      prng([0]),
      { forbiddenCells: [{ row: 2, col: 2 }] }
    );

    expect(destination).toEqual({ row: 1, col: 1 });
  });

  test('returns null when no candidate remains', () => {
    const destination = EvasionDestination.selectNearestEmptyEvasionDestination(
      { row: 3, col: 3 },
      [{ row: 3, col: 3 }],
      prng([0])
    );

    expect(destination).toBeNull();
  });
});
```

- [ ] **Step 2: Run helper test and verify it fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.evasion-destination.test.ts
```

Expected: FAIL because `game/logic/cards-internal/evasion-destination` does not exist.

- [ ] **Step 3: Implement helper**

Create `game/logic/cards-internal/evasion-destination.ts`:

```typescript
interface Position {
    row: number;
    col: number;
}

interface RandomSource {
    random(): number;
}

interface SelectOptions {
    forbiddenCells?: Position[];
}

function normalizePosition(value: unknown): Position | null {
    if (!value || typeof value !== 'object') return null;
    const row = Number((value as Position).row);
    const col = Number((value as Position).col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
}

function getChebyshevDistance(from: Position, to: Position): number {
    return Math.max(Math.abs(from.row - to.row), Math.abs(from.col - to.col));
}

function resolveRandomIndex(randomSource: RandomSource, length: number): number {
    if (!Number.isInteger(length) || length <= 0) return 0;
    const raw = Math.floor(Number(randomSource.random()) * length);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(length - 1, raw));
}

function buildForbiddenSet(cells: unknown): Set<string> {
    const out = new Set<string>();
    if (!Array.isArray(cells)) return out;
    for (const cell of cells) {
        const pos = normalizePosition(cell);
        if (!pos) continue;
        out.add(`${pos.row},${pos.col}`);
    }
    return out;
}

function selectNearestEmptyEvasionDestination(
    originInput: unknown,
    candidateInput: unknown,
    randomSource: RandomSource,
    options: SelectOptions = {}
): Position | null {
    const origin = normalizePosition(originInput);
    if (!origin) return null;
    if (!randomSource || typeof randomSource.random !== 'function') {
        throw new Error('EvasionDestination requires an injected deterministic PRNG.');
    }

    const forbidden = buildForbiddenSet(options.forbiddenCells);
    const seen = new Set<string>();
    const candidates: Position[] = [];

    for (const rawCandidate of Array.isArray(candidateInput) ? candidateInput : []) {
        const candidate = normalizePosition(rawCandidate);
        if (!candidate) continue;
        const key = `${candidate.row},${candidate.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (candidate.row === origin.row && candidate.col === origin.col) continue;
        if (forbidden.has(key)) continue;
        candidates.push(candidate);
    }

    if (!candidates.length) return null;

    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearest: Position[] = [];
    for (const candidate of candidates) {
        const distance = getChebyshevDistance(origin, candidate);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = [candidate];
            continue;
        }
        if (distance === nearestDistance) nearest.push(candidate);
    }

    nearest.sort((a, b) => (a.row - b.row) || (a.col - b.col));
    return nearest[resolveRandomIndex(randomSource, nearest.length)] || nearest[0] || null;
}

export = {
    getChebyshevDistance,
    selectNearestEmptyEvasionDestination
};
```

- [ ] **Step 4: Run helper test and verify it passes**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.evasion-destination.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper if isolated**

```powershell
git add game/logic/cards-internal/evasion-destination.ts test/game.evasion-destination.test.ts
git commit -m "Add shared evasion destination helper"
```

Do not commit if unrelated dirty files overlap these paths.

## Task 3: Use Helper for Destroy Evasion

**Files:**
- Modify: `game/logic/board_ops.ts`
- Test: `test/game.afterimage-will.test.ts`
- Test: `test/game.will-hunter-king.test.ts`
- Test: `test/game.extreme-hyperactive-will.test.ts`
- Test: `test/game.ultimate-hyperactive-god.test.ts`

- [ ] **Step 1: Add failing destroy-evasion tie test**

In `test/game.afterimage-will.test.ts`, add:

```typescript
test('破壊回避は最短空きが複数ある時にランダムで移動先を選ぶ', () => {
  const first = createState(0);

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      first.gameState.board[row][col] = Shared.BLACK;
    }
  }
  first.gameState.board[4][4] = Shared.BLACK;
  first.gameState.board[3][3] = Shared.EMPTY;
  first.gameState.board[3][5] = Shared.EMPTY;
  first.cardState.markers.push({
    id: 9601,
    kind: 'specialStone',
    row: 4,
    col: 4,
    owner: 'black',
    data: { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 3, destroyEvadeRemaining: 3 }
  });

  const firstOut = BoardOps.destroyAt(first.cardState, first.gameState, 4, 4, 'SYSTEM', 'destroy_evade_tie', {
    randomSource: first.prng
  });
  expect(firstOut.to).toEqual({ row: 3, col: 3 });

  const second = createState(0.999);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      second.gameState.board[row][col] = Shared.BLACK;
    }
  }
  second.gameState.board[4][4] = Shared.BLACK;
  second.gameState.board[3][3] = Shared.EMPTY;
  second.gameState.board[3][5] = Shared.EMPTY;
  second.cardState.markers.push({
    id: 9602,
    kind: 'specialStone',
    row: 4,
    col: 4,
    owner: 'black',
    data: { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 3, destroyEvadeRemaining: 3 }
  });

  const secondOut = BoardOps.destroyAt(second.cardState, second.gameState, 4, 4, 'SYSTEM', 'destroy_evade_tie', {
    randomSource: second.prng
  });
  expect(secondOut.to).toEqual({ row: 3, col: 5 });
});
```

- [ ] **Step 2: Run destroy-evasion tests and verify the new test fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.afterimage-will.test.ts test/game.will-hunter-king.test.ts test/game.extreme-hyperactive-will.test.ts test/game.ultimate-hyperactive-god.test.ts
```

Expected: FAIL on the new same-distance random expectation, because destroy evasion currently sorts deterministically.

- [ ] **Step 3: Require helper in board_ops**

In `game/logic/board_ops.ts`, add near other module constants:

```typescript
const EvasionDestination = safeRequire('./cards-internal/evasion-destination') || getRuntimeGlobalValue('CardEvasionDestination');
```

- [ ] **Step 4: Replace destroy destination selector**

Replace `_findDestroyEvadeDestination()` with:

```typescript
function _findDestroyEvadeDestination(cardState: any, gameState: any, row: number, col: number, meta: any): { row: number; col: number } | null {
    const candidates = _collectBoardShapeEmptyCells(cardState, gameState);
    if (!candidates.length) return null;
    const randomSource = _resolveBoardOpsRandomSource(cardState, meta);
    if (!EvasionDestination || typeof EvasionDestination.selectNearestEmptyEvasionDestination !== 'function') {
        throw new Error('CardEvasionDestination.selectNearestEmptyEvasionDestination is unavailable');
    }
    return EvasionDestination.selectNearestEmptyEvasionDestination(
        { row, col },
        candidates,
        randomSource,
        { forbiddenCells: meta && Array.isArray(meta.forbiddenEvadeCells) ? meta.forbiddenEvadeCells : [] }
    );
}
```

- [ ] **Step 5: Remove obsolete local helpers if unused**

After replacing `_findDestroyEvadeDestination`, run:

```powershell
rg -n "_collectAllBoardCoordinates|_getForbiddenDestroyEvadeCellSet|_getManhattanDistance" game/logic/board_ops.ts
```

If the only hits are the function declarations, delete these functions:

```typescript
function _collectAllBoardCoordinates(gameState: any): Array<{ row: number; col: number }> { ... }
function _getManhattanDistance(fromRow: number, fromCol: number, toRow: number, toCol: number): number { ... }
function _getForbiddenDestroyEvadeCellSet(meta: any): Set<string> { ... }
```

Keep `_getChebyshevDistance` if `_findProliferationDestination()` still uses it.

- [ ] **Step 6: Run destroy-evasion tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.afterimage-will.test.ts test/game.will-hunter-king.test.ts test/game.extreme-hyperactive-will.test.ts test/game.ultimate-hyperactive-god.test.ts
```

Expected: PASS or only failures caused by changed nearest tie behavior in existing tests.

- [ ] **Step 7: Update existing fixed-destination expectations**

If a test expected `{ row: 3, col: 4 }` from an empty board around `{ row: 4, col: 4 }`, update it to Chebyshev tie behavior. With sorted candidate pool and `random: () => 0`, the expected destination is:

```typescript
to: { row: 3, col: 3 }
```

Then rerun:

```powershell
npx jest --runInBand --runTestsByPath test/game.extreme-hyperactive-will.test.ts test/game.ultimate-hyperactive-god.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit destroy-evasion change if isolated**

```powershell
git add game/logic/board_ops.ts test/game.afterimage-will.test.ts test/game.will-hunter-king.test.ts test/game.extreme-hyperactive-will.test.ts test/game.ultimate-hyperactive-god.test.ts
git commit -m "Use shared nearest destination for destroy evasion"
```

Do not commit if unrelated dirty files overlap these paths.

## Task 4: Use Helper for Flip Evasion

**Files:**
- Modify: `game/logic/cards/hyperactive.ts`
- Test: `test/game.afterimage-will.test.ts`
- Test: `test/game.will-hunter-king.test.ts`
- Test: `test/game.escape-will.test.ts`
- Test: `test/game.extreme-hyperactive-will.test.ts`
- Test: `test/game.ultimate-hyperactive-god.test.ts`

- [ ] **Step 1: Add failing flip-evasion distant-empty test**

In `test/game.afterimage-will.test.ts`, add:

```typescript
test('反転回避は隣接空きがなくても最も近い空きマスへ移動する', () => {
  const { cardState, gameState } = createState(0);

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      gameState.board[row][col] = Shared.BLACK;
    }
  }
  gameState.board[4][4] = Shared.BLACK;
  gameState.board[1][1] = Shared.EMPTY;
  gameState.board[7][7] = Shared.EMPTY;

  cardState.markers.push({
    id: 9701,
    kind: 'specialStone',
    row: 4,
    col: 4,
    owner: 'black',
    data: { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 3, destroyEvadeRemaining: 3 }
  });

  const out = CardLogic.resolveHyperactiveFlipEvasion(
    cardState,
    gameState,
    [[4, 4]],
    'white',
    createPrng(0)
  );

  expect(out.remainingFlips).toHaveLength(0);
  expect(out.moved).toHaveLength(1);
  expect(out.moved[0]).toMatchObject({
    from: { row: 4, col: 4 },
    to: { row: 7, col: 7 },
    specialType: 'AFTERIMAGE_WILL'
  });
  expect(gameState.board[4][4]).toBe(Shared.EMPTY);
  expect(gameState.board[7][7]).toBe(Shared.BLACK);

  const marker = cardState.markers.find((m) => m && m.id === 9701);
  expect(marker).toBeTruthy();
  expect(marker.row).toBe(7);
  expect(marker.col).toBe(7);
  expect(marker.data.flipEvadeRemaining).toBe(2);
  expect(marker.data.destroyEvadeRemaining).toBe(3);
});
```

- [ ] **Step 2: Add failing flip-evasion random tie test**

In `test/game.afterimage-will.test.ts`, add:

```typescript
test('反転回避は最短空きが複数ある時にランダムで移動先を選ぶ', () => {
  const first = createState(0);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      first.gameState.board[row][col] = Shared.BLACK;
    }
  }
  first.gameState.board[4][4] = Shared.BLACK;
  first.gameState.board[3][3] = Shared.EMPTY;
  first.gameState.board[3][5] = Shared.EMPTY;
  first.cardState.markers.push({
    id: 9751,
    kind: 'specialStone',
    row: 4,
    col: 4,
    owner: 'black',
    data: { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 3, destroyEvadeRemaining: 3 }
  });

  const firstOut = CardLogic.resolveHyperactiveFlipEvasion(
    first.cardState,
    first.gameState,
    [[4, 4]],
    'white',
    first.prng
  );
  expect(firstOut.moved[0].to).toEqual({ row: 3, col: 3 });

  const second = createState(0.999);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      second.gameState.board[row][col] = Shared.BLACK;
    }
  }
  second.gameState.board[4][4] = Shared.BLACK;
  second.gameState.board[3][3] = Shared.EMPTY;
  second.gameState.board[3][5] = Shared.EMPTY;
  second.cardState.markers.push({
    id: 9752,
    kind: 'specialStone',
    row: 4,
    col: 4,
    owner: 'black',
    data: { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 3, destroyEvadeRemaining: 3 }
  });

  const secondOut = CardLogic.resolveHyperactiveFlipEvasion(
    second.cardState,
    second.gameState,
    [[4, 4]],
    'white',
    second.prng
  );
  expect(secondOut.moved[0].to).toEqual({ row: 3, col: 5 });
});
```

- [ ] **Step 3: Run flip-evasion tests and verify failure**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.afterimage-will.test.ts test/game.will-hunter-king.test.ts test/game.escape-will.test.ts test/game.extreme-hyperactive-will.test.ts test/game.ultimate-hyperactive-god.test.ts
```

Expected: FAIL on distant-empty flip evasion because current code only checks neighbors.

- [ ] **Step 4: Require helper in hyperactive module**

In `game/logic/cards/hyperactive.ts`, add the module variable next to the other module variables:

```typescript
let EvasionDestinationModule: any = null;
```

Then update `refreshHyperactiveRuntimeModules()` so runtime injection refreshes the helper together with the other modules:

```typescript
EvasionDestinationModule = resolveHyperactiveModuleOrGlobal('../cards-internal/evasion-destination', 'CardEvasionDestination') || null;
```

- [ ] **Step 5: Add all-board empty candidate collector**

Add near `getNeighborEmptyCandidates()`:

```typescript
function getBoardShapeEmptyEvasionCandidates(
    cardState: CardState,
    gameState: GameState,
    row: number,
    col: number,
    deps: { isBlockedCell?: HyperactiveDeps['isBlockedCell'] }
): Candidate[] {
    const out: Candidate[] = [];
    const isBlockedCell = deps && typeof deps.isBlockedCell === 'function'
        ? deps.isBlockedCell
        : (() => false);
    forEachBoardShapeCell(gameState, (r, c, value) => {
        if (r === row && c === col) return;
        if (value !== EMPTY) return;
        if (isBlockedCell(cardState, r, c, gameState)) return;
        out.push({ row: r, col: c, occupied: false });
    });
    return out;
}
```

- [ ] **Step 6: Replace flip-evasion destination selection**

Inside `resolveHyperactiveFlipEvasion()`, replace:

```typescript
let candidatePool = getNeighborEmptyCandidates(cardState, gameState, entry.row, entry.col, { isBlockedCell })
    .filter((candidate) => !forbiddenTargets.has(`${candidate.row},${candidate.col}`));
```

and the `while (candidatePool.length > 0)` block with:

```typescript
const candidatePool = getBoardShapeEmptyEvasionCandidates(cardState, gameState, entry.row, entry.col, { isBlockedCell });
if (!EvasionDestinationModule || typeof EvasionDestinationModule.selectNearestEmptyEvasionDestination !== 'function') {
    throw new Error('CardEvasionDestination.selectNearestEmptyEvasionDestination is unavailable');
}
const target = EvasionDestinationModule.selectNearestEmptyEvasionDestination(
    { row: entry.row, col: entry.col },
    candidatePool,
    p,
    { forbiddenCells: parsedFlips }
);

let movedRes = false;
if (target) {
    const fromRow = entry.row;
    const fromCol = entry.col;

    let usedBoardOpsMove = false;
    if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
        const res = deps.BoardOps.moveAt(
            cardState,
            gameState,
            fromRow,
            fromCol,
            target.row,
            target.col,
            cause,
            moveReason,
            Object.assign({}, buildMovingStonePresentationMeta(cardState, fromRow, fromCol), { evade: true })
        );
        movedRes = !!(res && res.moved);
        usedBoardOpsMove = !!(res && res.markerHandled === true);
    } else {
        setBoardCell(gameState, fromRow, fromCol, EMPTY);
        setBoardCell(gameState, target.row, target.col, ownerVal);
        movedRes = true;
    }

    if (movedRes) {
        if (!usedBoardOpsMove) {
            moveCoexistingSpecialMarkers(cardState, entry, fromRow, fromCol, target.row, target.col);
        }
        entry.row = target.row;
        entry.col = target.col;
        consumeFlipEvade(entry, markerTypeUpper);
        pruneAfterimageMarkerIfDepleted(cardState, entry);
        moved.push({
            from: { row: fromRow, col: fromCol },
            to: { row: target.row, col: target.col },
            specialType: markerTypeUpper
        });
        evadedSet.add(key);
    }
}
```

Remove the `ESCAPE_HYPERACTIVE` special `pickEscapeTarget()` branch from flip evasion. Keep `pickEscapeTarget()` itself if turn-start escape movement still uses it.

- [ ] **Step 7: Update escape-will behavior tests**

In `test/game.escape-will.test.ts`, update the test named `反転回避で移動先が無い場合は爆発せず通常反転される`. The old board has distant empty cells, so under the new spec evasion succeeds. Rename it:

```typescript
test('反転回避は隣接空きが無くても遠距離の空きへ移動して爆発しない', () => {
```

Update expectations to assert the marker moved to the nearest valid empty cell and `flipEvadeRemaining` decreased to `0`. Add a separate full-board no-empty test:

```typescript
test('反転回避で盤面上に空きが無い場合は爆発せず通常反転される', () => {
  const prng = makePrng();
  const cardState = CardLogic.createCardState(prng);
  const gameState = Core.createGameState();

  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.BLACK));
  gameState.currentPlayer = Core.BLACK;
  gameState.board[3][3] = Core.WHITE;

  cardState.markers.push({
    id: 194,
    kind: 'specialStone',
    row: 3,
    col: 3,
    owner: 'white',
    data: { type: 'ESCAPE_HYPERACTIVE', remainingOwnerTurns: 5, flipEvadeRemaining: 1 }
  });

  const out = CardLogic.resolveHyperactiveFlipEvasion(
    cardState,
    gameState,
    [[3, 3]],
    'black',
    prng
  );

  expect(out.moved).toEqual([]);
  expect(out.remainingFlips).toEqual([[3, 3]]);
  const marker = (cardState.markers || []).find((m) => m && m.id === 194);
  expect(marker).toBeTruthy();
  expect(marker.row).toBe(3);
  expect(marker.col).toBe(3);
  expect(marker.data.flipEvadeRemaining).toBe(1);
});
```

- [ ] **Step 8: Run flip-evasion tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.afterimage-will.test.ts test/game.will-hunter-king.test.ts test/game.escape-will.test.ts test/game.extreme-hyperactive-will.test.ts test/game.ultimate-hyperactive-god.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit flip-evasion change if isolated**

```powershell
git add game/logic/cards/hyperactive.ts test/game.afterimage-will.test.ts test/game.will-hunter-king.test.ts test/game.escape-will.test.ts test/game.extreme-hyperactive-will.test.ts test/game.ultimate-hyperactive-god.test.ts
git commit -m "Use nearest empty destination for flip evasion"
```

Do not commit if unrelated dirty files overlap these paths.

## Task 5: Update Player-Facing Help Text

**Files:**
- Modify: `cards/card-interaction-effects.ts`
- Modify: `ui/handlers/rules-help.ts`
- Test: `test/cards.afterimage-will-surfaces.test.ts`
- Test: `test/cards.escape-will-surfaces.test.ts`
- Test: `test/ui.rules-help-panel.test.ts`

- [ ] **Step 1: Update card detail expected strings first**

In `test/cards.afterimage-will-surfaces.test.ts`, change `EXPECTED_DETAIL_TEXT` to include:

```typescript
const EXPECTED_DETAIL_TEXT = '次に置く石を残像石化する。\n残像石は反転回避3回と破壊回避3回を持つ特殊石本体。\n意志の喪失で通常石に戻る。\n回避に成功した時だけ対応する回数を1消費する。\n片方だけ0になっても、もう片方が残る間は残像石のまま継続する。\n反転回避と破壊回避は、盤面上の最も近い空きマスへ移動する。同距離候補はランダム。\n空きマスが1つも無い場合だけ回避不成立となる。\n両方0になると通常石へ戻る。';
```

In `test/cards.escape-will-surfaces.test.ts`, change `EXPECTED_DETAIL_TEXT` to:

```typescript
const EXPECTED_DETAIL_TEXT = '毎ターン1マス逃げるように移動する。\n反転対象時は1回回避する。\nターン開始時の移動で移動先が無い場合は爆発する。\n反転回避は最も近い空きマスへ移動し、空きマスが1つも無い場合だけ通常どおり反転される。';
```

- [ ] **Step 2: Update rules-help expected glossary tests**

In `test/ui.rules-help-panel.test.ts`, update glossary expectations so both terms include nearest-empty behavior:

```typescript
expect(html).toContain('反転されるとき、最も近い空きマスへ移動');
expect(html).toContain('破壊対象になったとき、最も近い空きマスへ移動');
expect(html).toContain('同距離候補はランダム');
```

- [ ] **Step 3: Run surface tests and verify failure**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/cards.afterimage-will-surfaces.test.ts test/cards.escape-will-surfaces.test.ts test/ui.rules-help-panel.test.ts
```

Expected: FAIL because source text is not updated yet.

- [ ] **Step 4: Update card detail source text**

In `cards/card-interaction-effects.ts`, update `AFTERIMAGE_WILL` and `ESCAPE_WILL` strings to match the expected test strings from Step 1.

Use this text for shared glossary entries if the file has term definitions:

```typescript
反転回避: '反転されるとき、最も近い空きマスへ移動してその石だけ回避する。同距離候補はランダム。空きマスが1つも無い場合だけ回避不成立。',
破壊回避: '破壊対象になったとき、最も近い空きマスへ移動してその石だけ回避する。同距離候補はランダム。空きマスが1つも無い場合だけ回避不成立。'
```

- [ ] **Step 5: Update rules help source text**

In `ui/handlers/rules-help.ts`, set glossary rows to:

```typescript
Object.freeze({ label: '反転回避', description: '反転されるとき、最も近い空きマスへ移動してその石だけ回避する。同距離候補はランダム。空きマスが1つも無い場合だけ回避不成立。' }),
Object.freeze({ label: '破壊回避', description: '破壊対象になったとき、最も近い空きマスへ移動してその石だけ回避する。同距離候補はランダム。空きマスが1つも無い場合だけ回避不成立。' }),
```

- [ ] **Step 6: Run surface tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/cards.afterimage-will-surfaces.test.ts test/cards.escape-will-surfaces.test.ts test/ui.rules-help-panel.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit help text change if isolated**

```powershell
git add cards/card-interaction-effects.ts ui/handlers/rules-help.ts test/cards.afterimage-will-surfaces.test.ts test/cards.escape-will-surfaces.test.ts test/ui.rules-help-panel.test.ts
git commit -m "Update evasion help text"
```

Do not commit if unrelated dirty files overlap these paths.

## Task 6: Register Helper in Browser and Worker Runtime Paths

**Files:**
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-runtime-preload.ts`
- Generated by scripts: `public/module-registry.js`
- Generated by scripts: `worker-public/**`

- [ ] **Step 1: Run type build before runtime registration check**

Run:

```powershell
npm run build:ts
```

Expected: PASS and `dist/game/logic/cards-internal/evasion-destination.js` exists.

- [ ] **Step 2: Add worker require-map entry if needed**

In `workers/match-worker.ts`, near other `game/logic/cards-internal` entries, add:

```typescript
'../game/logic/cards-internal/evasion-destination.js': () => require('../game/logic/cards-internal/evasion-destination.js'),
```

In the preload module list, add:

```typescript
['../game/logic/cards-internal/evasion-destination.js', 'CardEvasionDestination'],
```

- [ ] **Step 3: Add runtime preload entry**

In `workers/match-worker-runtime-preload.ts`, near other `cards-internal` preloads, add:

```typescript
installRuntimeModule('CardEvasionDestination', () => require('../game/logic/cards-internal/evasion-destination.js'));
```

- [ ] **Step 4: Build browser registry**

Run:

```powershell
npm run build:browser
```

Expected: PASS and `public/module-registry.js` includes `game/logic/cards-internal/evasion-destination`.

- [ ] **Step 5: Prepare worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: PASS and `worker-public/game/logic/cards-internal/evasion-destination.js` exists.

- [ ] **Step 6: Verify runtime references**

Run:

```powershell
rg -n "CardEvasionDestination|evasion-destination" game workers public worker-public test -S
```

Expected: Hits in the new helper, `game/logic/board_ops.ts`, `game/logic/cards/hyperactive.ts`, worker preload files, `public/module-registry.js`, and worker-public mirror. No hand-edited source-only omission.

- [ ] **Step 7: Commit runtime registration and generated outputs if isolated**

```powershell
git add game/logic/cards-internal/evasion-destination.ts workers/match-worker.ts workers/match-worker-runtime-preload.ts public/module-registry.js worker-public
git commit -m "Register evasion destination helper in runtimes"
```

Do not commit if unrelated generated or mirror files are already dirty and cannot be separated.

## Task 7: Focused and Broad Verification

**Files:**
- Inspect only unless failures identify required fixes.

- [ ] **Step 1: Run focused game behavior tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.evasion-destination.test.ts test/game.afterimage-will.test.ts test/game.will-hunter-king.test.ts test/game.escape-will.test.ts test/game.extreme-hyperactive-will.test.ts test/game.ultimate-hyperactive-god.test.ts test/game.proliferation-will.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused UI/help tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/cards.afterimage-will-surfaces.test.ts test/cards.escape-will-surfaces.test.ts test/ui.rules-help-panel.test.ts test/ui.card-detail-effect-tags.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run type and boundary checks**

Run:

```powershell
npm run typecheck
npm run build:ts
npm run check:window
```

Expected: PASS. New helper must not introduce DOM/window/network dependencies into `game/` or `shared/`.

- [ ] **Step 4: Run browser build freshness check**

Run:

```powershell
npm run build:browser
```

Expected: PASS. `public/module-registry.js` is refreshed by the script.

- [ ] **Step 5: Run worker mirror preparation**

Run:

```powershell
npm run worker:prepare
```

Expected: PASS. `worker-public/` mirrors root runtime changes.

- [ ] **Step 6: Run network parity if worker/runtime files changed**

Run:

```powershell
npm run test:network:parity
```

Expected: PASS. If this is too slow for the current execution budget, run it before final commit or report it explicitly as not run.

- [ ] **Step 7: Final stale wording search**

Run:

```powershell
rg -n "反転回避.*1マス移動で回避|反転回避.*移動先が無い|破壊回避.*空きマスが無い|隣接に空きがなくても" 01-rulebook.md 正本 cards ui test docs -S
```

Expected: No stale player-facing statements that conflict with nearest-empty evasion. Hits mentioning turn-start movement, no-empty failure, or intentional tests are acceptable after inspection.

- [ ] **Step 8: Inspect final diff**

Run:

```powershell
git status --short
git diff -- 01-rulebook.md 正本/共通ルール正本.md 正本/カード仕様正本.md game/logic/cards-internal/evasion-destination.ts game/logic/board_ops.ts game/logic/cards/hyperactive.ts cards/card-interaction-effects.ts ui/handlers/rules-help.ts test/game.evasion-destination.test.ts test/game.afterimage-will.test.ts test/game.will-hunter-king.test.ts test/game.escape-will.test.ts test/game.extreme-hyperactive-will.test.ts test/game.ultimate-hyperactive-god.test.ts test/cards.afterimage-will-surfaces.test.ts test/cards.escape-will-surfaces.test.ts test/ui.rules-help-panel.test.ts
```

Expected: Diff only contains this evasion behavior change and required generated/mirror outputs.

- [ ] **Step 9: Final commit if isolated**

If previous task commits were not possible but the final diff is cleanly separable:

```powershell
git add 01-rulebook.md 正本/共通ルール正本.md 正本/カード仕様正本.md game/logic/cards-internal/evasion-destination.ts game/logic/board_ops.ts game/logic/cards/hyperactive.ts cards/card-interaction-effects.ts ui/handlers/rules-help.ts workers/match-worker.ts workers/match-worker-runtime-preload.ts test/game.evasion-destination.test.ts test/game.afterimage-will.test.ts test/game.will-hunter-king.test.ts test/game.escape-will.test.ts test/game.extreme-hyperactive-will.test.ts test/game.ultimate-hyperactive-god.test.ts test/cards.afterimage-will-surfaces.test.ts test/cards.escape-will-surfaces.test.ts test/ui.rules-help-panel.test.ts public/module-registry.js worker-public
git commit -m "Unify evasion destination selection"
```

Do not commit unrelated dirty files. If unrelated dirty generated files already existed and cannot be separated, leave the task uncommitted and report exact blockers.

## Self-Review

- Spec coverage: The plan covers `反転回避`, `破壊回避`, nearest-empty movement, same-distance random tie-break, no-empty failure, shared logic, docs, UI help, tests, browser build, and worker mirror.
- Placeholder scan: No placeholder keywords or unspecified implementation steps remain.
- Type consistency: The helper API is consistently named `selectNearestEmptyEvasionDestination(origin, candidates, randomSource, options)` and returns `{ row, col } | null`.
- Scope check: This is one coherent behavior change across shared rule logic and presentation text. It does not include unrelated card balance, CPU policy, or UI layout changes.
