# Number Cell Distribution Risk Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change initial number-cell distribution to the approved 40-cell mix and make printed values 8, 9, and 10 prefer X/C corner-risk squares across supported board sizes.

**Architecture:** Keep `01-rulebook.md` as the player-visible source of truth, `shared-constants.ts` as the distribution source, and `game/logic/cards/expansion.ts` as the canonical number-cell generator used by browser, headless, and Worker paths. The generator should still scale the distribution by existing custom-board candidate count, then assign values 8+ to X/C candidates before placing remaining values. UI rendering, charge award, consumption, and theory-incarnation progress remain unchanged.

**Tech Stack:** TypeScript, CommonJS-style module interop, Jest, existing `worker:prepare` mirror workflow.

---

## Scope And File Structure

- Modify `01-rulebook.md`: update the standard `8x8` number-cell distribution and document the 8+ X/C placement rule plus fallback behavior for boards with too few X/C candidates.
- Modify `shared-constants.ts`: update `INITIAL_BOARD_BONUS_DISTRIBUTION` to the approved 40-cell mix.
- Modify `game/logic/cards/expansion.ts`: keep all number-cell generation inside the existing card expansion module; add small local helpers for X/C candidate calculation and preferred-cell assignment.
- Modify `test/game.board-bonus.test.ts`: update distribution expectations and add focused tests for 8+ placement on X/C cells.
- Check `test/game.custom-board-config.test.ts`: run it as a regression check because it covers custom board size scaling.
- Generate, do not hand-edit, `worker-public/*` through `npm run worker:prepare` after source changes.

Execution notes:

- Start implementation with `git status --short`.
- This repository may have unrelated dirty files. Stage only files named in the task being committed.
- Do not use `git add -A`.
- Do not edit `worker-public/` directly.

---

### Task 1: Update The Player-Visible Rulebook

**Files:**
- Modify: `01-rulebook.md:94-101`

- [ ] **Step 1: Replace the number-cell distribution text**

In `01-rulebook.md`, replace the current number-cell block at lines 94-101 with this text:

```md
- 数字マス:
  - 標準 `8x8` では、初期空き60マスのうち40マスへ「数字マス」をランダム配置する
  - 標準 `8x8` の内訳は `1` を7マス、`2` を7マス、`3` を5マス、`4` を4マス、`5` を5マス、`6` を4マス、`7` を3マス、`8` を2マス、`9` を2マス、`10` を1マス
  - `8` 以上の数字マスは、角の斜め内側にあたるXマス、または角の縦横隣にあたるCマスへ優先配置する
  - カスタム盤面では、初期配置石の配置マスとその上下左右隣接1マスを除いたベース盤面の使用可能マス数に対し、標準 `8x8` の比率を基準に総数と値配分を増減させる
  - カスタム盤面で `8` 以上の数字マス数が配置可能なX/C候補数を超える場合、置ける分だけX/Cへ優先配置し、残りは通常の数字マス候補へ配置する
  - 初期配置石の配置マスと、その隣接する上下左右1マスは数字マスの抽選対象から除外する
  - 縦横とも `8` 以上の盤面では、初期配置石まわりの中央 `4x4` 範囲に `6` 以上の数字マスを配置しない
  - 数字マスは対局開始時に1回だけ確定し、対局中に再抽選しない
- 数字マスは「そのマスに石を置いた時点」で消費済みになり、以後は復活しない（破壊で空きに戻っても復活しない）
```

- [ ] **Step 2: Inspect the rulebook diff**

Run:

```powershell
git diff -- 01-rulebook.md
```

Expected:

- Only the number-cell distribution/risk-placement wording changes for this task.
- Existing unrelated `01-rulebook.md` dirty changes, if present before implementation, are not overwritten.

- [ ] **Step 3: Commit the rulebook update**

Run:

```powershell
git add 01-rulebook.md
git commit -m "docs: update number cell distribution spec"
```

Expected: one documentation commit. If `01-rulebook.md` already had unrelated dirty changes before this task, do not commit; report the conflicting existing diff instead.

---

### Task 2: Add Focused Failing Tests For Distribution And Risk Placement

**Files:**
- Modify: `test/game.board-bonus.test.ts:29-160`

- [ ] **Step 1: Add an X/C helper beside existing test constants**

After the existing `centralOpeningZoneKeys` declaration, insert:

```ts
function addRiskKey(out, row, col, rows, cols) {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return;
  out.add(`${row},${col}`);
}

function createCornerRiskKeySet(rows, cols) {
  const out = new Set();
  const maxRow = rows - 1;
  const maxCol = cols - 1;

  if (rows >= 3 && cols >= 3) {
    addRiskKey(out, 1, 1, rows, cols);
    addRiskKey(out, 1, maxCol - 1, rows, cols);
    addRiskKey(out, maxRow - 1, 1, rows, cols);
    addRiskKey(out, maxRow - 1, maxCol - 1, rows, cols);
  }

  if (rows >= 2 && cols >= 2) {
    addRiskKey(out, 0, 1, rows, cols);
    addRiskKey(out, 1, 0, rows, cols);
    addRiskKey(out, 0, maxCol - 1, rows, cols);
    addRiskKey(out, 1, maxCol, rows, cols);
    addRiskKey(out, maxRow - 1, 0, rows, cols);
    addRiskKey(out, maxRow, 1, rows, cols);
    addRiskKey(out, maxRow - 1, maxCol, rows, cols);
    addRiskKey(out, maxRow, maxCol - 1, rows, cols);
  }

  return out;
}
```

- [ ] **Step 2: Update the standard `8x8` distribution expectations**

In the test named `初期配置で40マスが所定内訳で割り当てられる`, replace the old count expectations with:

```ts
    expect(counts[1]).toBe(7);
    expect(counts[2]).toBe(7);
    expect(counts[3]).toBe(5);
    expect(counts[4]).toBe(4);
    expect(counts[5]).toBe(5);
    expect(counts[6]).toBe(4);
    expect(counts[7]).toBe(3);
    expect(counts[8]).toBe(2);
    expect(counts[9]).toBe(2);
    expect(counts[10]).toBe(1);
```

- [ ] **Step 3: Add a test proving 8+ values use X/C squares on `8x8`**

Add this test after the distribution test:

```ts
  test('8以上の数字マスは8x8でXマスまたはCマスにだけ配置される', () => {
    const cardState = CardLogic.createCardState(createDeterministicPrng());
    const bonus = cardState.boardBonusByCell || {};
    const riskKeys = createCornerRiskKeySet(8, 8);
    const highEntries = Object.entries(bonus).filter(([, value]) => Number(value) >= 8);

    expect(highEntries).toHaveLength(5);
    for (const [key, value] of highEntries) {
      expect(Number(value)).toBeGreaterThanOrEqual(8);
      expect(riskKeys.has(key)).toBe(true);
    }
  });
```

- [ ] **Step 4: Add a supported-size regression test for custom boards**

Add this test after the `片側が8未満の盤面では中央4x4の高数字制限を適用しない` test:

```ts
  test('対応盤面サイズの8以上数字マスはX/C候補に優先配置される', () => {
    for (let rows = 4; rows <= 10; rows += 1) {
      for (let cols = 4; cols <= 10; cols += 1) {
        const bonus = CardExpansion.buildInitialBoardBonusMap(createHighBonusPressurePrng(), { rows, cols });
        const riskKeys = createCornerRiskKeySet(rows, cols);
        const highEntries = Object.entries(bonus).filter(([, value]) => Number(value) >= 8);

        for (const [key, value] of highEntries) {
          expect(Number(value)).toBeGreaterThanOrEqual(8);
          expect(riskKeys.has(key)).toBe(true);
        }
      }
    }
  });
```

- [ ] **Step 5: Run the focused test and confirm it fails before implementation**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.board-bonus.test.ts --runInBand
```

Expected before implementation:

- FAIL on the updated distribution expectations because `shared-constants.ts` still has the old `9/8/6/5/4/3/2/1/1/1` distribution.
- FAIL on the X/C placement test because current generation does not reserve X/C cells for values 8+.

- [ ] **Step 6: Commit the failing tests**

Run:

```powershell
git add test/game.board-bonus.test.ts
git commit -m "test: cover number cell risk placement"
```

Expected: one test-only commit. Do not include unrelated dirty files.

---

### Task 3: Update Distribution Constants And Generator Logic

**Files:**
- Modify: `shared-constants.ts:53-64`
- Modify: `game/logic/cards/expansion.ts:220-234`
- Modify: `game/logic/cards/expansion.ts:214-613`

- [ ] **Step 1: Update the shared distribution constant**

In `shared-constants.ts`, replace `INITIAL_BOARD_BONUS_DISTRIBUTION` with:

```ts
export const INITIAL_BOARD_BONUS_DISTRIBUTION = [
    { value: 1, count: 7 },
    { value: 2, count: 7 },
    { value: 3, count: 5 },
    { value: 4, count: 4 },
    { value: 5, count: 5 },
    { value: 6, count: 4 },
    { value: 7, count: 3 },
    { value: 8, count: 2 },
    { value: 9, count: 2 },
    { value: 10, count: 1 }
] as const;
```

- [ ] **Step 2: Update the fallback distribution in `expansion.ts`**

In `game/logic/cards/expansion.ts`, inside `getNormalizedInitialBonusDistribution()`, replace the fallback array with:

```ts
        : [
            { value: 1, count: 7 },
            { value: 2, count: 7 },
            { value: 3, count: 5 },
            { value: 4, count: 4 },
            { value: 5, count: 5 },
            { value: 6, count: 4 },
            { value: 7, count: 3 },
            { value: 8, count: 2 },
            { value: 9, count: 2 },
            { value: 10, count: 1 }
        ];
```

- [ ] **Step 3: Add local helper functions for X/C candidate assignment**

In `game/logic/cards/expansion.ts`, after `getOpeningHighBonusRestrictedCellKeys()`, insert:

```ts
function cellKeyOfBoardBonusCell(row: number, col: number): string {
    return `${row},${col}`;
}

function buildBoardBonusCellKeySet(cells: Array<{ row: number; col: number }>): Set<string> {
    const out = new Set<string>();
    for (const cell of cells) {
        if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) continue;
        out.add(cellKeyOfBoardBonusCell(cell.row, cell.col));
    }
    return out;
}

function addCornerRiskBoardBonusCandidate(
    out: Array<{ row: number; col: number }>,
    seen: Set<string>,
    config: BoardConfig,
    allowedKeys: Set<string> | null,
    row: number,
    col: number
): void {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;
    if (!isMainBoardCellForCard(row, col, config)) return;
    const key = cellKeyOfBoardBonusCell(row, col);
    if (allowedKeys && !allowedKeys.has(key)) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ row, col });
}

function collectCornerRiskBoardBonusCandidates(
    boardOrConfig: any,
    allowedKeys?: Set<string>
): Array<{ row: number; col: number }> {
    const config = resolveCardBoardConfig(boardOrConfig);
    const out: Array<{ row: number; col: number }> = [];
    const seen = new Set<string>();
    const allowed = allowedKeys instanceof Set ? allowedKeys : null;
    const maxRow = config.baseBounds.maxRow;
    const maxCol = config.baseBounds.maxCol;

    if (config.rows >= 3 && config.cols >= 3) {
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 1, 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 1, maxCol - 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow - 1, 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow - 1, maxCol - 1);
    }

    if (config.rows >= 2 && config.cols >= 2) {
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 0, 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 1, 0);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 0, maxCol - 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, 1, maxCol);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow - 1, 0);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow, 1);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow - 1, maxCol);
        addCornerRiskBoardBonusCandidate(out, seen, config, allowed, maxRow, maxCol - 1);
    }

    return out;
}

function findBoardBonusCellIndexByKey(
    cells: Array<{ row: number; col: number }>,
    preferredKeys: Set<string>,
    blockedKeys?: Set<string> | null
): number | null {
    for (let index = 0; index < cells.length; index += 1) {
        const cell = cells[index];
        if (!cell) continue;
        const key = cellKeyOfBoardBonusCell(cell.row, cell.col);
        if (!preferredKeys.has(key)) continue;
        if (blockedKeys && blockedKeys.has(key)) continue;
        return index;
    }
    return null;
}
```

- [ ] **Step 4: Replace the value/cell assignment block**

In `buildInitialBoardBonusMap()`, replace the current block from `const cells = candidates.slice();` through the end of the assignment loop with:

```ts
    const cells = candidates.slice();
    const highNumberValues = bonusValues.filter((value) => value >= 8);
    const regularValues = bonusValues.filter((value) => value < 8);
    if (prng && typeof prng.shuffle === 'function') {
        prng.shuffle(cells);
        prng.shuffle(highNumberValues);
        prng.shuffle(regularValues);
    }
    const values = highNumberValues.concat(regularValues);

    const out: Record<string, number> = {};
    const assignCount = Math.min(cells.length, values.length);
    const highBonusRestrictedCellKeys = getOpeningHighBonusRestrictedCellKeys(boardOrConfig);
    const useHighBonusRestriction = highBonusRestrictedCellKeys.size > 0;
    const candidateCellKeys = buildBoardBonusCellKeySet(candidates);
    const highNumberPreferredCellKeys = buildBoardBonusCellKeySet(
        collectCornerRiskBoardBonusCandidates(boardOrConfig, candidateCellKeys)
    );

    for (let i = 0; i < assignCount; i++) {
        const value = values[i];
        const avoidOpeningHighBonusZone = useHighBonusRestriction && value >= 6;
        let cellIndex: number | null = null;

        if (value >= 8 && highNumberPreferredCellKeys.size > 0) {
            cellIndex = findBoardBonusCellIndexByKey(
                cells,
                highNumberPreferredCellKeys,
                avoidOpeningHighBonusZone ? highBonusRestrictedCellKeys : null
            );
        }

        if (cellIndex === null && avoidOpeningHighBonusZone) {
            const unrestrictedIndex = cells.findIndex((cell) => {
                if (!cell) return false;
                return !highBonusRestrictedCellKeys.has(cellKeyOfBoardBonusCell(cell.row, cell.col));
            });
            if (unrestrictedIndex >= 0) cellIndex = unrestrictedIndex;
        }

        const cell = cells.splice(cellIndex === null ? 0 : cellIndex, 1)[0];
        out[cellKeyOfBoardBonusCell(cell.row, cell.col)] = value;
    }
```

- [ ] **Step 5: Run the focused test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.board-bonus.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit the generator update**

Run:

```powershell
git add shared-constants.ts game/logic/cards/expansion.ts test/game.board-bonus.test.ts
git commit -m "feat: rebalance number cell placement"
```

Expected: one source-and-test commit.

---

### Task 4: Verify Custom Board Scaling And Worker Mirror

**Files:**
- Check: `test/game.custom-board-config.test.ts`
- Generated after command: `worker-public/*`

- [ ] **Step 1: Run the focused custom-board regression**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.custom-board-config.test.ts --runInBand
```

Expected: PASS. The change should not alter the existing custom-board target count formula, only the distribution values and preferred placement of values 8+.

- [ ] **Step 2: Run type/build verification through Worker prepare**

Run:

```powershell
npm run worker:prepare
```

Expected:

- PASS for the embedded `npm run build:ts`.
- `worker-public/` mirror updates only for generated output that reflects the source changes.

- [ ] **Step 3: Inspect generated mirror diff**

Run:

```powershell
git status --short
git diff -- worker-public shared-constants.ts game/logic/cards/expansion.ts test/game.board-bonus.test.ts
```

Expected:

- Source files from Task 3 are already committed.
- Any `worker-public/` changes are generated by `npm run worker:prepare`.
- No unrelated dirty files are staged.

- [ ] **Step 4: Commit generated mirror changes**

Run:

```powershell
git add worker-public
git commit -m "chore: sync worker mirror for number cells"
```

Expected: one generated-output commit. If `worker-public/` already had unrelated dirty files before implementation, do not commit mirror changes; report the existing dirty mirror files and ask for separation.

---

### Task 5: Final Verification And Handoff

**Files:**
- Check: `01-rulebook.md`
- Check: `shared-constants.ts`
- Check: `game/logic/cards/expansion.ts`
- Check: `test/game.board-bonus.test.ts`
- Check: `worker-public/*`

- [ ] **Step 1: Run the combined focused verification**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.board-bonus.test.ts test/game.custom-board-config.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run whitespace diff check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors in the files changed by this implementation.

- [ ] **Step 3: Confirm repository status**

Run:

```powershell
git status --short
```

Expected:

- No uncommitted changes from this number-cell task remain.
- Unrelated pre-existing dirty files may still appear and must be listed in the final report.

- [ ] **Step 4: Final report**

Report these items to the user:

```text
Implemented:
- Updated 8x8 number-cell distribution to 7/7/5/4/5/4/3/2/2/1.
- Values 8+ now prefer X/C corner-risk cells across supported board sizes.
- Kept number-cell consumption, charge gain, CRYSTAL_STONE, and THEORY_INCARNATION progress behavior unchanged.

Verified:
- npm run test:jest -- --runTestsByPath test/game.board-bonus.test.ts test/game.custom-board-config.test.ts --runInBand
- npm run worker:prepare
- git diff --check

Notes:
- worker-public was synced through npm run worker:prepare, not hand-edited.
```

---

## Self-Review

- Spec coverage: the plan covers the new 40-cell distribution, 8+ X/C priority placement, custom-board scaling, X/C shortage fallback, central 4x4 high-number restriction, tests, and Worker mirror sync.
- Placeholder scan: no unspecified implementation steps remain; every code change step includes concrete code.
- Type consistency: helper names are consistent across insertion and call sites: `cellKeyOfBoardBonusCell`, `buildBoardBonusCellKeySet`, `collectCornerRiskBoardBonusCandidates`, and `findBoardBonusCellIndexByKey`.
