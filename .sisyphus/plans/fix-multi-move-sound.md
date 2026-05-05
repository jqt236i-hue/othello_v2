# Fix: 多動系カードの移動効果音が再生されない不具合

## TL;DR

> **Quick Summary**: ロボット掃除機などの多動系カードがマス移動するときに効果音が再生されない3つの不具合を修正する。`_isHyperactiveMoveTarget()` に `ROBOT_VACUUM` を追加、`WILL_HUNTER_KING` を正しいカテゴリに移動、サウンドファイル名の不一致を修正。
>
> **Deliverables**:
> - ロボット掃除機が移動するときに `多動系の石が移動したタイミング.mp3` が再生される
> - 意志狩りの王が移動するときに `究極反転龍・究極破壊神・意志狩りの王が移動したタイミング.mp3` が再生される  
> - 究極反転龍・究極破壊神が移動するときに上記ファイルが正しく再生される（今まではファイル名不一致で無音だった）
>
> **Estimated Effort**: Quick
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 2 → Task 4 → Task 5

---

## Context

### Original Request
ロボット掃除機がマス移動するときに移動の効果音が再生されない不具合の報告。マス移動するカードは全て多動系カードが移動するときの効果音を再生するべき。ただし究極反転龍・究極破壊神・意志狩りの王は専用効果音を再生するべき。

### Interview Summary
**Key Discussions**:
- 3つの不具合を確認: (1)ROBOT_VACUUM未登録 (2)WILL_HUNTER_KINGの誤分類 (3)ファイル名不一致
- テスト戦略: Tests-after（既存テストフレームワークに追記）
- Worker mirror同步: `npm run worker:prepare` を実行

### Metis Review
**Identified Gaps** (addressed):
- フォールバックパスへの robot_vacuum/will_hunter_king 追加（推奨。プライマリパスが常に機能するため必須ではないが一貫性のために含める）
- reason チェックの一貫性維持（既存パターンに合わせて cause + reason の両方をチェック）

---

## Work Objectives

### Core Objective
多動系カード（ロボット掃除機を含む全て）がマス移動するときに正しい効果音が再生されるようにする。

### Concrete Deliverables
- `sound-engine.ts` の `ultimate_anchor_move` ファイル名修正
- `pipeline_ui_adapter.ts` の `_isHyperactiveMoveTarget()` に `ROBOT_VACUUM` 追加
- `pipeline_ui_adapter.ts` の `_isHyperactiveMoveTarget()` から `WILL_HUNTER_KING` 削除
- `pipeline_ui_adapter.ts` の `_isUltimateAnchorMoveTarget()` に `WILL_HUNTER_KING` 追加
- コンパイル (tsc) + worker mirror同期
- テストケース追加

### Definition of Done
- [ ] `bun test game.pipeline-ui-adapter.sound-cue.test.ts` が全テストパス
- [ ] `npx tsc --noEmit` がエラーなし
- [ ] `npm run worker:prepare` が正常完了
- [ ] ロボット掃除機の移動で `hyperactive_move` 効果音が再生される
- [ ] 意志狩りの王の移動で `ultimate_anchor_move` 効果音が再生される（hyperactive_moveではない）
- [ ] 究極反転龍・究極破壊神の移動で `ultimate_anchor_move` 効果音が正しく再生される

### Must Have
- ROBOT_VACUUM の移動 → `hyperactive_move` 効果音
- WILL_HUNTER_KING の移動 → `ultimate_anchor_move` 効果音
- 究極反転龍・究極破壊神の移動 → `ultimate_anchor_move` 効果音（ファイル名修正後）
- 既存の destroy_evade_move テスト（line 1691）は引き続き `hyperactive_move` を返す

### Must NOT Have (Guardrails)
- 新しい効果音キーや音声ファイルの追加
- ROBOT_VACUUM の `suck` ロジックの変更
- サウンドファイル名の変更（マッピングのみ修正）
- pipeline_ui_adapter.ts の無関係な部分の変更
- 原因リストの定数化リファクタリング

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (bun test, vitest)
- **Automated tests**: Tests-after (既存 sound-cue.test.ts に追記)
- **Framework**: bun test

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Test verification**: Bash (bun test) - Run specific test file, collect results
- **Compilation check**: Bash (npx tsc --noEmit) - Verify no compilation errors
- **File content check**: Read specific lines to verify correct changes

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - foundation):
├── Task 1: Fix sound-engine.ts filename [quick]
└── Task 2: Fix pipeline_ui_adapter.ts classifications [quick]

Wave 2 (After Wave 1 - compilation + mirrors):
├── Task 3: TypeScript compilation [quick]
├── Task 4: Sync worker-public mirrors [quick]
├── Task 5: Add new test cases + run [quick]
└── Task 6: Run full test suite [quick]

Critical Path: Task 2 → Task 3 → Task 4 → Task 5 → Task 6
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 2 (Wave 1)
```

---

## TODOs

- [x] 1. Fix `sound-engine.ts` - `ultimate_anchor_move` filename

  **What to do**:
  - Open `sound-engine.ts`
  - Find line 96: `ultimate_anchor_move: '究極反転龍・究極破壊神が移動したタイミング.mp3'`
  - Change the filename to match the actual file: `'究極反転龍・究極破壊神・意志狩りの王が移動したタイミング.mp3'`
  - Verify the file `assets/audio/sound-effect/究極反転龍・究極破壊神・意志狩りの王が移動したタイミング.mp3` exists (it does)

  **Must NOT do**:
  - Rename the actual audio file on disk
  - Change any other sound key mappings

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-line string change in config-like mapping
  - **Skills**: `[]` (no special skills needed)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3, Task 4
  - **Blocked By**: None

  **References**:
  - `sound-engine.ts:96` - The exact line to change
  - `assets/audio/sound-effect/` - Directory containing the actual audio file to verify target name

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify sound-engine.ts filename mapping
    Tool: Bash (grep)
    Preconditions: File exists
    Steps:
      1. Run: grep -n "ultimate_anchor_move" sound-engine.ts
      2. Verify output contains "究極反転龍・究極破壊神・意志狩りの王が移動したタイミング.mp3"
    Expected Result: The filename in the mapping matches the actual file on disk
    Evidence: .sisyphus/evidence/task-1-filename-mapping.txt

  Scenario: Verify actual audio file exists
    Tool: Bash (ls)
    Preconditions: None
    Steps:
      1. Run: ls "assets/audio/sound-effect/究極反転龍・究極破壊神・意志狩りの王が移動したタイミング.mp3"
    Expected Result: File exists and is readable
    Evidence: .sisyphus/evidence/task-1-file-exists.txt
  ```

  **Evidence to Capture:**
  - [ ] task-1-filename-mapping.txt - grep output showing correct filename
  - [ ] task-1-file-exists.txt - ls output confirming file exists

  **Commit**: YES (groups with Task 2)
  - Message: `fix(sound): correct ultimate_anchor_move filename to match actual file`
  - Files: `sound-engine.ts`

---

- [x] 2. Fix `pipeline_ui_adapter.ts` - Update move target classifications

  **What to do**:
  In `game/turn/pipeline_ui_adapter.ts`, make three changes:

  **Change A - `_isHyperactiveMoveTarget()` (around line 1916-1937):**
  - Add `cause === 'ROBOT_VACUUM'` to the cause list (after `cause === 'ULTIMATE_HYPERACTIVE_GOD' ||` or similar position)
  - Optionally add `reason.indexOf('robot_vacuum_move') === 0` for reason-based consistency
  - **Remove** `cause === 'WILL_HUNTER_KING'` from this function

  **Change B - `_isUltimateAnchorMoveTarget()` (around line 1939-1948):**
  - Add `cause === 'WILL_HUNTER_KING'` to the cause list
  - Optionally add `reason.indexOf('will_hunter_king_slash_move') === 0` for consistency with existing patterns

  **Change C - Fallback paths (around lines 2304-2318 and 2331-2344):**
  - In the ultimate anchor fallback (line 2306-2310): add `ev.type !== 'will_hunter_king_moved_start' && ev.type !== 'will_hunter_king_moved_immediate'` to the exclusion check (and add the count to the fallback loop condition)
  - In the hyperactive fallback (line 2333-2337): add `ev.type !== 'robot_vacuum_moved_start' && ev.type !== 'robot_vacuum_moved_immediate'` to the exclusion check

  **Must NOT do**:
  - Change `_isRobotVacuumSuckDestroyTarget` (separate function for suck sound)
  - Remove `cause === 'DESTROY_EVADE'` or other unrelated causes
  - Refactor cause lists into constants

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Well-scoped changes to 2-3 functions in one file, well-understood pattern
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3, Task 4
  - **Blocked By**: None

  **References**:
  - `game/turn/pipeline_ui_adapter.ts:1916-1937` - `_isHyperactiveMoveTarget()` function
  - `game/turn/pipeline_ui_adapter.ts:1939-1948` - `_isUltimateAnchorMoveTarget()` function
  - `game/turn/pipeline_ui_adapter.ts:2294-2346` - Sound cue scheduling for ultimate anchor and hyperactive moves
  - `test/game.pipeline-ui-adapter.sound-cue.test.ts:1691-1710` - Existing destroy_evade_move test (must remain unaffected)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario A: Verify ROBOT_VACUUM is in _isHyperactiveMoveTarget
    Tool: Bash (grep)
    Preconditions: File modified
    Steps:
      1. Run: grep -A 20 "function _isHyperactiveMoveTarget" game/turn/pipeline_ui_adapter.ts
      2. Verify output contains "ROBOT_VACUUM"
    Expected Result: ROBOT_VACUUM is listed as a hyperactive move target
    Evidence: .sisyphus/evidence/task-2-robot-vacuum-in-target.txt

  Scenario B: Verify WILL_HUNTER_KING is NOT in _isHyperactiveMoveTarget
    Tool: Bash (grep)
    Preconditions: File modified
    Steps:
      1. Run: grep -A 20 "function _isHyperactiveMoveTarget" game/turn/pipeline_ui_adapter.ts
      2. Verify output does NOT contain "WILL_HUNTER_KING"
    Expected Result: WILL_HUNTER_KING removed from hyperactive target
    Evidence: .sisyphus/evidence/task-2-no-will-hunter.txt

  Scenario C: Verify WILL_HUNTER_KING IS in _isUltimateAnchorMoveTarget
    Tool: Bash (grep)
    Preconditions: File modified
    Steps:
      1. Run: grep -A 10 "function _isUltimateAnchorMoveTarget" game/turn/pipeline_ui_adapter.ts
      2. Verify output contains "WILL_HUNTER_KING"
    Expected Result: WILL_HUNTER_KING added to ultimate anchor target
    Evidence: .sisyphus/evidence/task-2-will-hunter-in-ultimate.txt
  ```

  **Evidence to Capture:**
  - [ ] task-2-robot-vacuum-in-target.txt - grep confirming ROBOT_VACUUM added
  - [ ] task-2-no-will-hunter.txt - grep confirming WILL_HUNTER_KING removed from hyperactive
  - [ ] task-2-will-hunter-in-ultimate.txt - grep confirming WILL_HUNTER_KING added to ultimate

  **Commit**: YES (groups with Task 1)
  - Message: `fix(sound): add ROBOT_VACUUM to hyperactive target, move WILL_HUNTER_KING to ultimate anchor`
  - Files: `game/turn/pipeline_ui_adapter.ts`

---

- [x] 3. TypeScript compilation

  **What to do**:
  - Run `npx tsc --noEmit` first to check for type errors
  - If successful, run `npx tsc` to compile and update dist/ files
  - If type errors occur, fix them (note: @ts-nocheck is present in both files, so type errors are unlikely)

  **Must NOT do**:
  - Change any source files (errors should come from pre-existing issues, not from our changes)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple command execution
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 4
  - **Blocked By**: Task 1, Task 2

  **References**: None

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify TypeScript compilation succeeds
    Tool: Bash
    Preconditions: Tasks 1 and 2 completed
    Steps:
      1. Run: npx tsc --noEmit
    Expected Result: Exit code 0, no type errors
    Evidence: .sisyphus/evidence/task-3-tsc-check.txt

  Scenario: Build dist output
    Tool: Bash
    Preconditions: tsc --noEmit passes
    Steps:
      1. Run: npx tsc
      2. Check dist/game/turn/pipeline_ui_adapter.js exists and has updated content
    Expected Result: Compilation succeeds, dist files updated
    Evidence: .sisyphus/evidence/task-3-tsc-build.txt
  ```

  **Evidence to Capture:**
  - [ ] task-3-tsc-check.txt - Output of tsc --noEmit
  - [ ] task-3-tsc-build.txt - Output of tsc build

  **Commit**: NO (intermediate build step)

---

- [x] 4. Sync worker-public mirrors

  **What to do**:
  - Run `npm run worker:prepare` to sync worker-public/ mirror files
  - Verify key files are updated:
    - `worker-public/game/turn/pipeline_ui_adapter.ts` should have our changes
    - `worker-public/sound-engine.js` should reflect the filename change (it re-exports from dist)

  **Must NOT do**:
  - Manually edit worker-public/ files (they are generated)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single command execution with verification
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**: None

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify worker prepare succeeds
    Tool: Bash
    Preconditions: tsc completed
    Steps:
      1. Run: npm run worker:prepare
    Expected Result: Script completes without errors
    Evidence: .sisyphus/evidence/task-4-worker-prepare.txt

  Scenario: Verify worker-public mirror has changes
    Tool: Bash (grep)
    Preconditions: worker:prepare completed
    Steps:
      1. Run: grep "ROBOT_VACUUM" worker-public/game/turn/pipeline_ui_adapter.ts
      2. Verify output shows ROBOT_VACUUM in context of _isHyperactiveMoveTarget
    Expected Result: worker-public mirror reflects source changes
    Evidence: .sisyphus/evidence/task-4-mirror-verified.txt
  ```

  **Evidence to Capture:**
  - [ ] task-4-worker-prepare.txt - Output of npm run worker:prepare
  - [ ] task-4-mirror-verified.txt - grep confirming mirror has changes

  **Commit**: NO (intermediate build step)

---

- [x] 5. Add new test cases and run

  **What to do**:
  Add new test cases to `test/game.pipeline-ui-adapter.sound-cue.test.ts`:

  **Test 1: ROBOT_VACUUM move → `hyperactive_move`**
  Add after the existing `destroy_evade_move` test (around line 1710):
  ```typescript
  test('ROBOT_VACUUM の移動にも hyperactive_move を追加する', () => {
      const base = [{
          type: 'move',
          phase: 7,
          targets: [{
              from: { r: 3, col: 3 },
              to: { r: 3, col: 4 },
              cause: 'ROBOT_VACUUM',
              reason: 'robot_vacuum_move'
          }]
      }];
      const out = adapter.appendSoundEffectPlaybackEvents(base, []);
      const cue = out.find((ev) =>
          ev && ev.type === 'sound_effect' &&
          ev.targets && ev.targets[0] &&
          ev.targets[0].soundKey === 'hyperactive_move'
      );
      expect(cue).toBeTruthy();
      expect(cue.phase).toBe(7);
  });
  ```

  **Test 2: WILL_HUNTER_KING cause → `ultimate_anchor_move` (NOT `hyperactive_move`)**
  Add after the existing `ultimate_anchor_move` test group (around line 1741):
  ```typescript
  test('WILL_HUNTER_KING の移動には ultimate_anchor_move を追加し hyperactive_move は追加しない', () => {
      const base = [{
          type: 'move',
          phase: 5,
          targets: [{
              from: { r: 2, col: 2 },
              to: { r: 5, col: 5 },
              cause: 'WILL_HUNTER_KING',
              reason: 'will_hunter_king_slash_move'
          }]
      }];
      const out = adapter.appendSoundEffectPlaybackEvents(base, []);
      const anchorCue = out.find((ev) =>
          ev && ev.type === 'sound_effect' &&
          ev.targets && ev.targets[0] &&
          ev.targets[0].soundKey === 'ultimate_anchor_move'
      );
      const hyperCue = out.find((ev) =>
          ev && ev.type === 'sound_effect' &&
          ev.targets && ev.targets[0] &&
          ev.targets[0].soundKey === 'hyperactive_move'
      );
      expect(anchorCue).toBeTruthy();
      expect(anchorCue.phase).toBe(5);
      expect(hyperCue).toBeUndefined();
  });
  ```

  **Test 3: Destroy-evade with WILL_HUNTER_KING special still plays `hyperactive_move`** (regression)
  This confirms the destroy-evade path (different `cause: 'DESTROY_EVADE'`) is unaffected:
  ```typescript
  test('DESTROY_EVADE かつ meta.special=WILL_HUNTER_KING でも hyperactive_move を再生する（回帰）', () => {
      const base = [{
          type: 'move',
          phase: 8,
          targets: [{
              from: { r: 3, col: 3 },
              to: { r: 3, col: 4 },
              cause: 'DESTROY_EVADE',
              reason: 'destroy_evade_move',
              meta: { special: 'WILL_HUNTER_KING' }
          }]
      }];
      const out = adapter.appendSoundEffectPlaybackEvents(base, []);
      const hyperCue = out.find((ev) =>
          ev && ev.type === 'sound_effect' &&
          ev.targets && ev.targets[0] &&
          ev.targets[0].soundKey === 'hyperactive_move'
      );
      const anchorCue = out.find((ev) =>
          ev && ev.type === 'sound_effect' &&
          ev.targets && ev.targets[0] &&
          ev.targets[0].soundKey === 'ultimate_anchor_move'
      );
      expect(hyperCue).toBeTruthy();
      expect(hyperCue.phase).toBe(8);
      expect(anchorCue).toBeUndefined();
  });
  ```

  **Must NOT do**:
  - Modify existing test cases
  - Add tests unrelated to these sound changes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Clear pattern to follow from existing tests, well-understood assertions
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6
  - **Blocked By**: Task 2 (tests import adapter module)

  **References**:
  - `test/game.pipeline-ui-adapter.sound-cue.test.ts:1638-1710` - Existing hyperactive move tests (pattern to follow)
  - `test/game.pipeline-ui-adapter.sound-cue.test.ts:1719-1741` - Existing ultimate anchor move tests (pattern to follow)
  - `test/game.pipeline-ui-adapter.sound-cue.test.ts:1691-1710` - Existing destroy_evade_move test (must not break)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Run the specific sound-cue test file
    Tool: Bash
    Preconditions: Test code added
    Steps:
      1. Run: bun test test/game.pipeline-ui-adapter.sound-cue.test.ts
    Expected Result: All tests pass, including the 3 new test cases
    Evidence: .sisyphus/evidence/task-5-test-results.txt
  ```

  **Evidence to Capture:**
  - [ ] task-5-test-results.txt - Full test output showing all tests pass

  **Commit**: YES (groups with Task 6)
  - Message: `test(sound): add tests for ROBOT_VACUUM and WILL_HUNTER_KING move sounds`
  - Files: `test/game.pipeline-ui-adapter.sound-cue.test.ts`

---

- [x] 6. Run full test suite and verify

  **What to do**:
  - Run `bun test` (or the project's test command) to ensure no regressions
  - If any tests fail, investigate and fix
  - Specifically verify:
    - Existing destroy_evade_move test still passes (line 1691 area)
    - All existing sound-cue tests pass
    - No other tests broken by the source changes

  **Must NOT do**:
  - Skip failing tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single command test execution
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: None (final verification)
  - **Blocked By**: Task 5

  **References**: None

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full test suite passes
    Tool: Bash
    Preconditions: All previous tasks completed
    Steps:
      1. Run the project's test command
    Expected Result: All tests pass, no regressions
    Evidence: .sisyphus/evidence/task-6-full-test-results.txt
  ```

  **Evidence to Capture:**
  - [ ] task-6-full-test-results.txt - Full test output

  **Commit**: YES (groups with Task 5)
  - Message: (same as Task 5 commit)

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`

- [x] F2. **Code Quality Review** — `unspecified-high`

- [x] F3. **Real Manual QA** — `unspecified-high`

- [x] F4. **Scope Fidelity Check** — `deep` (minor scope creep noted - 3 harmless cleanup items from previous refactors)

---

## Commit Strategy

- **1 + 2**: `fix(sound): correct multi-move card sound classification and filename` - `sound-engine.ts`, `game/turn/pipeline_ui_adapter.ts`
- **3 + 4**: (intermediate build steps, no commit)
- **5 + 6**: `test(sound): add tests for ROBOT_VACUUM and WILL_HUNTER_KING move sounds` - `test/game.pipeline-ui-adapter.sound-cue.test.ts`

---

## Success Criteria

### Verification Commands
```bash
bun test test/game.pipeline-ui-adapter.sound-cue.test.ts  # Expected: All tests pass
npx tsc --noEmit                                            # Expected: No errors
npm run worker:prepare                                       # Expected: Completes without errors
```

### Final Checklist
- [ ] `_isHyperactiveMoveTarget()` includes `ROBOT_VACUUM`
- [ ] `_isHyperactiveMoveTarget()` no longer includes `WILL_HUNTER_KING`
- [ ] `_isUltimateAnchorMoveTarget()` includes `WILL_HUNTER_KING`
- [ ] `sound-engine.ts` filename matches actual file
- [ ] TypeScript compilation succeeds
- [ ] worker-public mirrors are synced
- [ ] New test cases pass
- [ ] Existing tests not broken

