# Card Reversi Zero-Stone Endgame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Card Reversi from ending immediately only because one color has zero board discs while empty cells, cards, or pass resolution can still decide the game.

**Architecture:** Keep `gameState.board` as the canonical occupancy source for stones, and keep `cardState.markers` as metadata for special behavior and visuals. Remove the mono-color instant end from the core endgame predicate so game end flows through full board or pass/no-action resolution instead of short-circuiting card-mode comeback paths.

**Tech Stack:** TypeScript/CommonJS game modules, Jest with ts-jest, existing `01-rulebook.md` rule source, existing root-to-worker shared `game/logic/core.ts`.

---

## File Structure

- Modify: `01-rulebook.md`
  - Update the player-visible end condition: one side reaching 0 stones is not an immediate end in Card Reversi when empty cells remain.
  - Clarify that a side with 0 stones has no normal legal move until a card or special effect creates an owned stone, so the pass/card flow decides continuation.
- Modify: `game/logic/core.ts`
  - Remove `black === 0 || white === 0` from `isGameOver`.
  - Preserve `consecutivePasses >= 2` and `emptyCount === 0`.
  - Keep `countDiscs` unchanged as a board/expansion count helper.
- Create: `test/game.end-conditions.test.ts`
  - Lock the new core endgame behavior with focused tests.
- Modify: `test/game.regen.consume-visual.test.ts`
  - Add a small invariant regression that active `REGEN` recovery writes the owner color back to `gameState.board`.
- Optional only if `rg` finds stale text: `正本/*.md`
  - Update only the specific line that contradicts the new player-visible end condition.
- Generated/mirror files:
  - Do not edit `worker-public/` by hand.
  - This task should not require `npm run worker:prepare` unless a later implementation touches worker-public mirrored assets or built Worker output.

## Task 1: Update The Rulebook First

**Files:**
- Modify: `01-rulebook.md:323-338`

- [ ] **Step 1: Replace the mono-color end-condition text**

Change the end condition section from:

```md
- 次のいずれかで終局する
  - 両者連続パス
  - 盤面上の石が黒または白の単色になる（片側 0 枚、空きマスが残っていても終局）
  - 盤面が埋まる
```

to:

```md
- 次のいずれかで終局する
  - 両者連続パス
  - 盤面が埋まる
- 片側の石数が 0 になっただけでは、空きマスが残っている限り即時終局しない
- 自石 0 のプレイヤーは通常の挟み終端に使う自石が無いため通常合法手を持てないが、カード使用や特殊効果で自石を作れる場合はその手番を継続できる
- 自石 0 かつ通常合法手 0 でカード使用もできない場合は、通常のパス処理に従い、両者連続パスで終局する
```

- [ ] **Step 2: Check for conflicting canonical notes**

Run:

```powershell
rg -n "片側 0|単色|全滅|黒または白の単色|空きマスが残っていても終局" 01-rulebook.md 正本 docs -g "*.md"
```

Expected:
- `01-rulebook.md` no longer says mono-color with empty cells is terminal.
- If `正本/*.md` contains the old rule, update the exact line to match the new rule.
- If only archived or implementation-plan docs contain the old rule, leave them unchanged.

- [ ] **Step 3: Commit the spec-only change**

Stage only the rule/spec files changed in this task:

```powershell
git add 01-rulebook.md
git status --short
git commit -m "Update zero-stone endgame rule"
```

Expected:
- Commit contains only `01-rulebook.md`, plus a `正本/*.md` file only if Step 2 found an active contradiction.

## Task 2: Add Failing Core Endgame Tests

**Files:**
- Create: `test/game.end-conditions.test.ts`

- [ ] **Step 1: Create the failing test file**

Add:

```ts
import * as Core from '../game/logic/core.js';

function makeBoard(rows = 8, cols = 8, fill = Core.EMPTY) {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

function makeState(board: number[][], overrides: Record<string, unknown> = {}) {
  return {
    board,
    currentPlayer: Core.WHITE,
    consecutivePasses: 0,
    turnNumber: 12,
    roundNumber: 1,
    roundCompletionByPlayer: { black: false, white: false },
    pendingRoundBonus: null,
    boardExpansion: { active: false, side: null, row: null, owner: Core.EMPTY, usedByPlayer: { black: false, white: false }, cells: [] },
    ...overrides
  };
}

describe('Core end conditions', () => {
  test('does not end only because white has zero stones while empty cells remain', () => {
    const board = makeBoard();
    board[0][0] = Core.BLACK;
    board[0][1] = Core.BLACK;
    const state = makeState(board);

    expect(Core.countDiscs(state)).toEqual({ black: 2, white: 0 });
    expect(Core.isGameOver(state)).toBe(false);
  });

  test('still ends after two consecutive passes even when empty cells remain', () => {
    const board = makeBoard();
    board[0][0] = Core.BLACK;
    const state = makeState(board, { consecutivePasses: 2 });

    expect(Core.isGameOver(state)).toBe(true);
  });

  test('still ends when the board is full', () => {
    const board = makeBoard(8, 8, Core.BLACK);
    const state = makeState(board);

    expect(Core.countDiscs(state)).toEqual({ black: 64, white: 0 });
    expect(Core.isGameOver(state)).toBe(true);
  });

  test('counts occupied expansion cells but does not use mono-color count as an instant end', () => {
    const board = makeBoard();
    board[0][0] = Core.BLACK;
    const state = makeState(board, {
      boardExpansion: {
        active: true,
        side: 'right',
        row: 0,
        col: 8,
        owner: Core.BLACK,
        usedByPlayer: { black: true, white: false },
        cells: [{ side: 'right', row: 0, col: 8, owner: Core.BLACK }]
      }
    });

    expect(Core.countDiscs(state)).toEqual({ black: 2, white: 0 });
    expect(Core.isGameOver(state)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the intended failure**

Run:

```powershell
npm run test:jest -- test/game.end-conditions.test.ts
```

Expected before implementation:
- The first test fails because current `isGameOver` returns `true` when `white === 0`.
- The fourth test also fails for the same reason.
- The consecutive-pass and full-board tests pass or would pass once the file compiles.

## Task 3: Remove Mono-Color Instant End From Core

**Files:**
- Modify: `game/logic/core.ts:565-580`
- Existing generated/runtime pair: `game/logic/core.js`

- [ ] **Step 1: Update `isGameOver` in the TypeScript source**

Change:

```ts
function isGameOver(state: any): boolean {
    if (state.consecutivePasses >= 2) return true;

    const discs = countDiscs(state);
    const totalDiscs = (discs.black || 0) + (discs.white || 0);
    if (totalDiscs > 0 && (discs.black === 0 || discs.white === 0)) return true;

    let emptyCount = 0;
    forEachMainBoardCell(state, (row, col, value) => {
        if (value === EMPTY) emptyCount += 1;
    });
    const expansionCells = getExpansionCells(state);
    for (const expansion of expansionCells) {
        if (expansion && expansion.owner === EMPTY) emptyCount++;
    }
    return emptyCount === 0;
}
```

to:

```ts
function isGameOver(state: any): boolean {
    if (state.consecutivePasses >= 2) return true;

    let emptyCount = 0;
    forEachMainBoardCell(state, (row, col, value) => {
        if (value === EMPTY) emptyCount += 1;
    });
    const expansionCells = getExpansionCells(state);
    for (const expansion of expansionCells) {
        if (expansion && expansion.owner === EMPTY) emptyCount++;
    }
    return emptyCount === 0;
}
```

- [ ] **Step 2: Build the runtime wrapper/output expected by tests**

Run:

```powershell
npm run build:ts
```

Expected:
- `dist/game/logic/core.js` updates through the TypeScript build path.
- If `game/logic/core.js` is a checked-in wrapper and remains unchanged, do not hand-edit it.
- If the build script updates a checked-in runtime pair, inspect and stage only the generated pair required by this repository's TypeScript migration contract.

- [ ] **Step 3: Re-run the focused core test**

Run:

```powershell
npm run test:jest -- test/game.end-conditions.test.ts
```

Expected:
- All tests in `test/game.end-conditions.test.ts` pass.

- [ ] **Step 4: Commit the core behavior change**

Stage only the core source, required generated runtime output, and the new test:

```powershell
git add game/logic/core.ts test/game.end-conditions.test.ts
git status --short
git commit -m "Do not end on zero stones before passes"
```

Expected:
- Commit does not include unrelated dirty files in `assets/` or `worker-public/`.

## Task 4: Lock The REGEN Board-Ownership Invariant

**Files:**
- Modify: `test/game.regen.consume-visual.test.ts`

- [ ] **Step 1: Add a regression for white REGEN restoring board ownership**

Append this test inside the existing `describe('regen consume visual event', () => { ... })` block:

```ts
  test('white regen recovery writes white ownership back to the board', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[4][4] = Core.BLACK;

    const cardState = {
      markers: [
        { kind: 'specialStone', row: 4, col: 4, owner: 'white', data: { type: 'REGEN', regenRemaining: 2 } }
      ],
      presentationEvents: []
    };
    const gameState = { board };

    const res = CardRegen.applyRegenAfterFlips(
      cardState,
      gameState,
      [{ row: 4, col: 4 }],
      'black',
      false,
      {
        BoardOps,
        removeMarkersAt: (cs, r, c, criteria) => {
          cs.markers = (cs.markers || []).filter(m => !(
            m &&
            m.kind === criteria.kind &&
            m.row === r &&
            m.col === c &&
            m.data &&
            m.data.type === criteria.type
          ));
        },
        getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], blockedCells: [] }),
        clearBombAt: () => {}
      }
    );

    expect(res.regened).toEqual([{ row: 4, col: 4 }]);
    expect(gameState.board[4][4]).toBe(Core.WHITE);
    expect(cardState.markers[0].owner).toBe('white');
    expect(cardState.markers[0].data.regenRemaining).toBe(1);
  });
```

- [ ] **Step 2: Run the REGEN focused test**

Run:

```powershell
npm run test:jest -- test/game.regen.consume-visual.test.ts
```

Expected:
- Existing REGEN tests still pass.
- The new test proves the marker owner and board owner remain aligned after recovery.

- [ ] **Step 3: Commit the invariant regression**

Stage only the REGEN test:

```powershell
git add test/game.regen.consume-visual.test.ts
git status --short
git commit -m "Cover regen board ownership invariant"
```

Expected:
- Commit contains only `test/game.regen.consume-visual.test.ts`.

## Task 5: Verify Pass And Worker Impact

**Files:**
- No source changes expected.

- [ ] **Step 1: Run focused pass/endgame suites**

Run:

```powershell
npm run test:jest -- test/game.end-conditions.test.ts test/game.regen.consume-visual.test.ts test/ui.pass-stale-busy.test.ts test/workers.match-worker-timeout-controller.test.ts
```

Expected:
- Core end conditions pass.
- REGEN ownership tests pass.
- Pass UI tests still pass.
- Worker timeout/pass controller tests still pass with the shared `Core.isGameOver` change.

- [ ] **Step 2: Run architecture boundary check**

Run:

```powershell
npm run check:window
```

Expected:
- Passes.
- No new `window` / DOM dependencies were introduced into `game/`.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected:
- Passes.

- [ ] **Step 4: Inspect final diff**

Run:

```powershell
git status --short
git diff -- 01-rulebook.md game/logic/core.ts test/game.end-conditions.test.ts test/game.regen.consume-visual.test.ts
```

Expected:
- Diff contains only the planned files.
- Existing unrelated dirty files remain unstaged.

## Task 6: Manual Browser Verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Start the local server if one is not already running**

Run:

```powershell
npm run build:ts
node scripts/local-static-server.js --host 127.0.0.1 --port 8010
```

Expected:
- The game is available at `http://127.0.0.1:8010/`.
- If port `8010` is busy, use the existing server or choose an unused port and record it in the final report.

- [ ] **Step 2: Reproduce the zero-stone path with a debug setup or console fixture**

Use a browser console/debug fixture to create a state with:

```js
gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
gameState.board[0][0] = BLACK;
gameState.board[0][1] = BLACK;
gameState.currentPlayer = WHITE;
gameState.consecutivePasses = 0;
gameState.turnNumber = 40;
```

Then run:

```js
CoreLogic.isGameOver(gameState)
```

Expected:
- Returns `false`.

- [ ] **Step 3: Confirm pass/pass still ends**

Run:

```js
gameState.consecutivePasses = 2;
CoreLogic.isGameOver(gameState)
```

Expected:
- Returns `true`.

- [ ] **Step 4: Confirm full board still ends**

Run:

```js
gameState.board = Array.from({ length: 8 }, () => Array(8).fill(BLACK));
gameState.consecutivePasses = 0;
CoreLogic.isGameOver(gameState)
```

Expected:
- Returns `true`.

## Task 7: Final Verification And Reporting

**Files:**
- No source changes expected.

- [ ] **Step 1: Run final focused verification**

Run:

```powershell
npm run test:jest -- test/game.end-conditions.test.ts test/game.regen.consume-visual.test.ts
npm run check:window
npm run typecheck
```

Expected:
- All commands pass.

- [ ] **Step 2: Final status check**

Run:

```powershell
git status --short
```

Expected:
- Only unrelated pre-existing dirty files remain, or the working tree is clean.
- If generated files changed from `npm run build:ts`, inspect them and stage only files required by the task.

- [ ] **Step 3: Final report**

Report:

```text
変更内容:
- 片側0石だけでは終局しないように終了条件を変更
- 復活石の board 所有色復帰をテストで固定
- ルールブックの終局条件を更新

検証:
- npm run test:jest -- test/game.end-conditions.test.ts test/game.regen.consume-visual.test.ts
- npm run check:window
- npm run typecheck

未処理:
- 既存の unrelated dirty files: <git status の該当ファイル>
```

## Self-Review

- Spec coverage: The plan covers the requested design: no mono-color instant end, board remains occupancy source, REGEN ownership invariant gets a regression, and player-visible rules are updated first.
- Placeholder scan: No `TBD`, `TODO`, or open-ended implementation instructions remain.
- Type consistency: The plan uses existing `Core.BLACK`, `Core.WHITE`, `Core.EMPTY`, `CardRegen.applyRegenAfterFlips`, and `BoardOps` names already present in the repository tests.
