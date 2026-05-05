# グローバル依存リファクタリング計画 (Global Dependency Refactor)

## TL;DR

> **Quick Summary**: `game/` 層から `globalThis` 経由の暗黙依存を排除し、明示的な import / DI (`setUIImpl()` パターン) に置き換える。`ui/bootstrap.ts` を browser-specific wiring の正本とする。
>
> **Deliverables**:
> - `game/` 内の全 `globalThis` WRITE (~96件, 24ファイル) を DI / export に置き換え
> - `game/` 内の全 `globalThis` READ (~349件) を import に置き換え
> - `scripts/check-window-usage.ts` に `globalThis` チェックを追加
> - 既存テストの更新と動作維持
>
> **Estimated Effort**: **Large** (~24 files, ~6 waves)
> **Parallel Execution**: YES — 4-6 waves
> **Critical Path**: Phase A (boundary check) → Wave 1 (turn-manager) → Wave 2-3 (依存ファイル) → Wave 4 (残り) → Wave F (互換クリーンアップ)

---

## Context

### Original Request
ゲームの挙動は変えずに、`game/` 層と `ui/bootstrap` 層の責務境界を整理。`globalThis` / `window` 依存、暗黙のグローバル変数、free variable fallback を排除。game 層は DOM/window/browser-only timing に直接依存しない。

### Interview Summary
**Key Decisions**:
- スコープ: **`game/` 全体**（24+ファイル）を一度に片付ける
- 正本エントリーファイル: **`entry-browser.js`**（3種あるうちの1つ）
- ビルド: `tsc` → `dist/` に出力。`.ts` を修正し `npm run build:ts`
- 既存の DI パターン: `setUIImpl()` / `game/timers.ts` の `setTimerImpl()` を踏襲
- 互換レイヤー: 一時的に残し、最終 Wave で削除

### Research Findings
- `game/` 内: **445件** の `globalThis` 参照 / **62ファイル** / うち **24ファイル** が WRITE (~96件)
- `turn-manager.ts` が最悪: ~80件の `globalThis` + ~60件の free variable 参照
- 既存境界テスト: `test/game.ui-boundary.test.ts` は `window.`/`document.` のみチェック — `globalThis` 未対応
- 既存チェック: `scripts/check-window-usage.ts` も同様に `globalThis` 未対応
- テスト: Jest v29 + ts-jest。game/ 層に177テストファイル。境界テスト2ファイル

### Metis Review
**Identified Gaps** (addressed):
- ✅ エントリーファイル → `entry-browser.js` が正本と確認
- ✅ ビルドパイプライン → `tsc` → `dist/`
- ✅ 3種の `entry-browser-*.js` → 他の2種は未使用（手を付けない）
- ✅ `.ts` / `.js` 二重管理 → `.ts` を修正し `build:ts` で `.js` 生成
- ✅ CPU層 → **本計画では対象外**（別計画とする）
- ✅ テスト修正 → Phase A でテストを事前修正し、各Wave後に検証

---

## Work Objectives

### Core Objective
`game/` 層から `globalThis` 経由の暗黙依存を排除し、`setUIImpl()` パターンによる明示的 DI に統一する。

### Concrete Deliverables
- [ ] `game/turn-manager.ts`: 全 globalThis 参照を import / DI に置き換え（~140件）
- [ ] `game/cpu-turn-handler.ts`: 全 globalThis 参照を import / DI に置き換え
- [ ] `game/cpu-decision.ts`: 全 globalThis 参照を import に置き換え
- [ ] `game/move-executor.js`: globalThis WRITE を DI に置き換え
- [ ] 全 `game/card-effects/*.ts`: PendingSelectionFlow fallback 削除
- [ ] `game/special-effects/bombs.ts`: (globalThis as any).XXX を import に
- [ ] 他 15+ファイル: globalThis → import
- [ ] `scripts/check-window-usage.ts`: globalThis チェック追加
- [ ] `test/game.ui-boundary.test.ts`: globalThis チェック追加
- [ ] 既存テスト：全件パス

### Must Have
- ✅ ゲーム挙動・カード効果・ターン順・ネット対戦 authority は維持
- ✅ game 層からの `globalThis` WRITE をゼロに
- ✅ game 層の `globalThis` READ をゼロに（import で代替）
- ✅ `scripts/check-window-usage.ts` の拡張（globalThis 検出）
- ✅ 全既存テストの継続的パス

### Must NOT Have (Guardrails)
- ❌ UI層 (`ui/`) のファイルは触らない（bootstrap.ts の globalThis は設計上正常）
- ❌ CPU層 (`cpu/`) は触らない（別計画）
- ❌ entry-browser.js の `Object.assign(window, _modN)` パターンは変更しない（bootstrap層の責務）
- ❌ 新しい `globalThis` 代入を追加しない
- ❌ 関数シグニチャを不必要に変更しない
- ❌ ターンマネージャーの分割や新抽象層の導入はしない
- ❌ 新旧 `entry-browser-classic/augmented` は触らない

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Infrastructure
- **Framework**: Jest v29 + ts-jest
- **Test commands**: `npm run test:jest` (jest --runInBand), `npm run test:jest:coverage` (with --coverage)
- **Pre-test check**: `npm run checkall` (check-window-usage + shim-forwarding)
- **Build step**: `npm run build:ts` (tsc)

### Boundary Tests
- `test/game.ui-boundary.test.ts` — static scan for `window.`/`document.` → Phase A で `globalThis` も追加
- `scripts/check-window-usage.ts` — CI check → Phase A で `globalThis` 検出も追加

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **CLI/Terminal**: Use `interactive_bash` (tmux) — run build + test commands, validate output
- **Module verification**: Use Bash — `require()` the module, check exports exist, verify DI works

---

## Execution Strategy

### Parallel Execution Waves

```
Phase A (Pre-phase — foundation & safety):
├── Task A1: [globalThis検出] check-window-usage.ts 拡張
├── Task A2: [テスト拡充] boundary test に globalThis チェック追加
├── Task A3: [テスト修正] turn-manager.retry.test.ts の事前調整

Wave 1 (Core — turn-manager.ts):
├── Task 1: turn-manager → globalThis WRITE → DI setUIImpl()
├── Task 2: turn-manager → free variable → import
├── Task 3: turn-manager → globalThis module fallback → require() only
└── Task 4: turn-manager → compatibility export の明示化

Wave 2 (Secondary — CPU handlers + move executor):
├── Task 5: cpu-turn-handler → globalThis → import/DI
├── Task 6: move-executor.js → globalThis → DI
├── Task 7: move-generator.js → globalThis → import
├── Task 8: pass-handler.js → globalThis → DI

Wave 3 (Card effects — pending selection flows):
├── Task 9: card-effects/helpers.ts + placement.ts → globalThis → import
├── Task 10: card-effects/destroy.ts → (globalThis as any) → import
├── Task 11: 全 card-effects/*.ts PendingSelectionFlow fallback 削除 (~15 files)
├── Task 12: special-effects/bombs.ts → (globalThis as any) → import（最重要）
└── Task 13: special-effects/breeding.ts + udg.ts → globalThis → import

Wave 4 (Remaining game/ files):
├── Task 14: timers.ts → globalThis.GameTimers export 削除
├── Task 15: auto.ts → globalThis 書込削除
├── Task 16: controller-events.ts → globalThis.GameEvents → export
├── Task 17: game/logic/* → globalThis → import
├── Task 18: game/ai/* → globalThis → import
├── Task 19: game/presentation.ts → globalThis → import
└── Task 20: game/special-effects/*(残り) → globalThis → import

Wave FINAL (Cleanup & verification):
├── Task F1: 互換レイヤー確認・最終削除準備
├── Task F2: check-window-usage.ts の最終拡張完了
├── Task F3: 全テスト通過確認
└── Task F4: worker-public 同期確認（npm run worker:prepare）
```

### Agent Dispatch Summary
- **Phase A**: 3 quick tasks (parallel)
- **Wave 1**: 4 tasks (sequential — same file, must be ordered)
- **Wave 2**: 4 tasks (semi-parallel — independent files)
- **Wave 3**: 5 tasks (partially parallel)
- **Wave 4**: 7 tasks (mostly parallel)
- **Wave FINAL**: 4 tasks (parallel)

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + QA Scenarios.

---

## Phase A — Pre-phase (Foundation & Safety)

- [x] A1. `scripts/check-window-usage.ts` に `globalThis` 検出を追加

  **What to do**:
  - `scripts/check-window-usage.ts` を読み、`window.` / `document.` パターンに加えて `globalThis.` (property access) の検出ロジックを追加
  - 検出対象は `game/` ディレクトリのみ（`ui/` は許可）
  - `globalThis.$NAME` パターンと `(globalThis as any).$NAME` パターンの両方を検出
  - 既存の関数 `shouldCheck()` はそのまま流用（すでに `game/`, `cpu/` を対象にしている）
  - `globalThis` 検出は違反ではないが、後続の Waves で段階的に減少することを確認するために使う
  - この段階では `npm run checkall` が PASS すること（既存の globalThis は許容）

  **Must NOT do**:
  - `ui/` のファイルをチェック対象に含めない
  - 既存の `window.` / `document.` チェックを壊さない

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 単一ファイルへの明確なパターン追加。低リスク
  - **Skills**: `[]` (no skills needed)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Phase A (with A2, A3)
  - **Blocks**: Tasks 1-20
  - **Blocked By**: None

  **References**:
  - `scripts/check-window-usage.ts` — 既存のチェックスクリプト。ここに globalThis 検出を追加
  - `test/game.ui-boundary.test.ts` — 同様の境界チェックの参考

  **Acceptance Criteria**:
  - [ ] `npm run check:window` が PASS（既存の globalThis 参照は許容されること）

  **QA Scenarios**:

  ```
  Scenario: Script runs without errors
    Tool: Bash
    Preconditions: Script file exists
    Steps:
      1. Run: npm run check:window
    Expected Result: Exit code 0 (PASS). Existing globalThis refs in game/ are known and tolerated at this phase.
    Evidence: .sisyphus/evidence/task-A1-check-window-pass.txt

  Scenario: globalThis detection works in violation scenario
    Tool: Bash
    Preconditions: Script file exists
    Steps:
      1. Run: node -e "require('./scripts/check-window-usage')" (run directly)
    Expected Result: Script completes without error
    Evidence: .sisyphus/evidence/task-A1-script-loads.txt
  ```

  **Commit**: YES
  - Message: `chore(scripts): add globalThis detection to check-window-usage`
  - Files: `scripts/check-window-usage.ts`
  - Pre-commit: `npm run check:window`

---

- [x] A2. `test/game.ui-boundary.test.ts` に `globalThis` 静的チェックを追加

  **What to do**:
  - `test/game.ui-boundary.test.ts` を読み、既存の DOM チェックに加えて `globalThis` の使用チェックを追加
  - `game/` ディレクトリ内の全 `.ts` / `.js` ファイルをスキャンし、以下を検出:
    - `globalThis.` (property access on globalThis)
    - `(globalThis as any).`
  - このテストは現時点では FAIL する（大量の `globalThis` 参照が残っているため） → `test.skip` または `test.todo` でマーク
  - Waves 完了後に `test.skip` を解除してパス確認する

  **Must NOT do**:
  - 既存の DOM チェックを削除・変更しない
  - `ui/` ファイルを含めない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Phase A (with A1, A3)
  - **Blocks**: Final verification
  - **Blocked By**: None

  **References**:
  - `test/game.ui-boundary.test.ts` — 既存テスト。L67-98 の `static scan` を参考に globalThis チェックを追加
  - `scripts/check-window-usage.ts` — 同様のチェックロジック

  **Acceptance Criteria**:
  - [ ] 新テストが追加され `npm run test:jest test/game.ui-boundary.test.ts` で認識される
  - [ ] テストは `test.skip` 状態（既存の globalThis があるため FAIL する）

  **QA Scenarios**:

  ```
  Scenario: Test file loads correctly
    Tool: Bash
    Preconditions: Test file exists
    Steps:
      1. Run: npm run test:jest test/game.ui-boundary.test.ts
    Expected Result: Test suite runs. The new globalThis check test shows as skipped (pending).
    Evidence: .sisyphus/evidence/task-A2-boundary-test-load.txt
  ```

  **Commit**: YES (with A1)
  - Message: `chore(test): add globalThis boundary check to ui-boundary test`
  - Files: `test/game.ui-boundary.test.ts`

---

- [x] A3. `test/turn-manager.retry.test.ts` の事前調査と対応計画

  **What to do**:
  - `test/turn-manager.retry.test.ts` を読み、現在 `global` に設定しているプロパティをすべてリストアップ
  - Wave 1 (turn-manager リファクタリング) 後にどのプロパティが不要になるか分析
  - テスト内で `jest.mock()` / `jest.spyOn()` を使った DI 対応の下書きをする（ただし実際の編集は Wave 1 後）
  - 調査結果を `.sisyphus/drafts/turn-manager-test-analysis.md` に記録

  **Must NOT do**:
  - テストファイル自体は編集しない（Wave 1 後に実施）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low` (調査のみ)
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Phase A (with A1, A2)
  - **Blocks**: Task 4 (compat export cleanup)
  - **Blocked By**: None

  **References**:
  - `test/turn-manager.retry.test.ts` — 解析対象
  - `game/turn-manager.ts` — リファクタリング対象のソース

  **Acceptance Criteria**:
  - [ ] 調査レポートが `.sisyphus/drafts/turn-manager-test-analysis.md` に作成される
  - [ ] 各 `global.XXX` が「不要になる」「DI Mock に置き換え」「維持」のいずれかに分類される

  **QA Scenarios**:

  ```
  Scenario: Analysis report created
    Tool: Bash
    Preconditions: Task completed
    Steps:
      1. Check file exists: Get-ChildItem .sisyphus/drafts/turn-manager-test-analysis.md
    Expected Result: File exists and contains analysis
    Evidence: .sisyphus/evidence/task-A3-analysis-exists.txt
  ```

  **Commit**: NO (analysis only, no code changes)

---

## Wave 1 — Core: turn-manager.ts

- [x] 1. turn-manager.ts → globalThis WRITE → DI setUIImpl() / module export に置き換え

  **What to do**:
  - `game/turn-manager.ts` を読み、以下の globalThis WRITE を特定:
    - L159-175: `isProcessing`, `isCardAnimating`, `VisualPlaybackActive`, `__playbackActiveSince` の代入
    - L289-298: `__uiImpl_turn_manager` の初期化・代入
    - L303: `cpuSmartness` の代入
    - L1108-1110: `globalThis.resetGame`, `globalThis.handleCellClick` の export
  - 以下の方針で置き換え:
    - **状態フラグ** (`isProcessing`, `isCardAnimating`, `VisualPlaybackActive`): これらは PlaybackStateManager が管理する状態。PlaybackStateManager を `setUIImpl()` 経由で注入し、game/ 側は注入されたインターフェース経由で読み取り/書き込みする。
    - **`__uiImpl_turn_manager`**: 既存の `setUIImpl()` パターンをそのまま使う。`globalThis.__uiImpl_turn_manager` を module スコープの `let __uiImpl` に変更。
    - **`cpuSmartness`**: import または引数経由に変更。
    - **`resetGame`, `handleCellClick`**: export で対応。既存の `module.exports` に追加。
  - 既存の互換 export (L1108-1110) は `@compat` コメントを付けて一時的に維持

  **Must NOT do**:
  - `setUIImpl()` のインターフェースは拡張のみ、既存プロパティは維持
  - 関数シグニチャは変更しない（export された関数の呼び出し元が壊れるため）

  **Recommended Agent Profile**:
  - **Category**: `deep` (ターンマネージャーは1139行の重要ファイル。慎重な操作が必要)
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (同一ファイルの逐次編集)
  - **Parallel Group**: N/A (sequential within Wave 1)
  - **Blocks**: Tasks 2-4
  - **Blocked By**: A1, A3

  **References**:
  - `game/turn-manager.ts` — 編集対象
  - `game/visual-effects-map.ts` — `setUIImpl()` パターンのリファレンス実装
  - `ui/bootstrap.ts` L917-999 — turn-manager への DI 注入コード

  **Acceptance Criteria**:
  - [ ] `npm run check:window` — globalThis 検出が減少していること
  - [ ] `npm run build:ts` — エラーなし
  - [ ] `npm run test:jest test/game.*.test.ts` — 既存ゲームテスト通過

  **QA Scenarios**:

  ```
  Scenario: turn-manager module loads without errors
    Tool: Bash
    Preconditions: Build completed (npm run build:ts)
    Steps:
      1. Run: node -e "const tm = require('./game/turn-manager'); console.log('loaded', typeof tm.resetGame, typeof tm.handleCellClick)"
    Expected Result: Module loads, resetGame and handleCellClick are functions
    Evidence: .sisyphus/evidence/task-1-module-load.txt

  Scenario: GlobalThis writes reduced
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run: node -e "const fs=require('fs'); const c=fs.readFileSync('dist/game/turn-manager.js','utf8'); const m=c.match(/globalThis\.\w+\s*=/g); console.log('globalThis writes:', m ? m.length : 0);"
    Expected Result: Fewer globalThis writes than before (baseline was ~17)
    Evidence: .sisyphus/evidence/task-1-globalthis-writes.txt
  ```

  **Commit**: YES
  - Message: `refactor(turn-manager): replace globalThis writes with DI/module exports`
  - Files: `game/turn-manager.ts`
  - Pre-commit: `npm run build:ts && npm run test:jest test/game.ui-boundary.test.ts`

---

- [x] 2. turn-manager.ts → free variable → import に置き換え

  **What to do**:
  - `game/turn-manager.ts` 内の以下 free variable を特定し、ES module の import / require に置き換え:
    - `gameState`, `cardState` → import または引数参照
    - `BLACK`, `WHITE` → `shared-constants` から import
    - `emitBoardUpdate`, `emitGameStateChange`, `emitCardStateChange`, `emitLogAdded` → `game/controller-events` から import
    - `isDebugLogAvailable`, `debugLog` → 該当モジュールから import
    - `getFlipBlockers` → `game/special-effects/helpers` から import
    - `getActiveProtectionForPlayer` → `game/card-effects/helpers` から import
    - `isGameOver`, `showResult` → 該当モジュールから import
    - `findMoveForCell`, `getLegalMoves`, `generateMovesForPlayer` → `game/move-generator` から import
    - `CardLogic`, `ActionManager`, `Core`, `TurnPipelinePhases` → 該当モジュールから import
  - `var` 宣言の `OwnerHelpersModule`, `MoveGeneratorModule` などを `import` / `require()` に統一
  - モジュール解決順: `require()` が優先 → フォールバック不要（globalThis を経由しない）

  **Must NOT do**:
  - `gameState` を module レベルの import にできない場合は、関数引数として渡す方式に変更（ただし関数シグニチャ変更は最小限に）
  - `var` の `BoardPresentation` の遅延初期化パターンを維持（初期化順の依存あり）

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (same file as Task 1)
  - **Parallel Group**: N/A (sequential after Task 1)
  - **Blocks**: Tasks 5-8
  - **Blocked By**: 1

  **References**:
  - `game/turn-manager.ts` — 編集対象
  - `shared/shared-constants.js` — `BLACK`, `WHITE` 定数
  - `game/controller-events.ts` — `emitBoardUpdate` 等の関数

  **Acceptance Criteria**:
  - [ ] `npm run build:ts` — エラーなし
  - [ ] `npm run test:jest` — 全テスト通過

  **QA Scenarios**:

  ```
  Scenario: Module loads with no require-time errors
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run: node -e "require('./game/turn-manager')" 2>&1
    Expected Result: No errors, module loads successfully
    Evidence: .sisyphus/evidence/task-2-module-load.txt

  Scenario: Free variables now resolved via import
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run: node -e "const fs=require('fs'); const c=fs.readFileSync('dist/game/turn-manager.js','utf8'); console.log('Uses require:', c.includes('require('));"
    Expected Result: File uses require() for dependencies
    Evidence: .sisyphus/evidence/task-2-imports.txt
  ```

  **Commit**: YES (with 1)
  - Message: `refactor(turn-manager): replace free variables with explicit imports`
  - Pre-commit: `npm run build:ts && npm run test:jest`

---

- [x] 3. turn-manager.ts → globalThis module fallback → require() に統一

  **What to do**:
  - `game/turn-manager.ts` 内の以下 globalThis fallback パターンを削除:
    - L29-31: `globalThis.PresentationHelper` fallback
    - L33-39: `globalThis.TurnPipelineUIAdapter` fallback
    - L77-79: `globalThis.OwnerHelpers` fallback
    - L83-89: `globalThis.findMoveForCell` / `getLegalMoves` / `generateMovesForPlayer` fallback
    - L93-97: `globalThis.PlaybackStateManager` fallback
    - L272-277: `globalThis.PresentationHelper` / `globalThis.BoardOps` fallback
    - L357: `globalThis.AUTO_MODE_ACTIVE` → DI 経由に
    - L386: `globalThis.findMoveForCell` fallback → すでに Task 2 で import 済み
    - L455-459: `globalThis.getCurrentMatchMode` / `globalThis.MATCH_MODE` → DI 経由に
    - L465: `globalThis` を引数として渡すパターン → import の関数を直接呼ぶ
    - L469-472: `globalThis.getCurrentMatchMode` / `globalThis.MATCH_MODE`
    - L480: `globalThis` を引数として渡すパターン
    - L484-493: `globalThis.NetworkMatchClient` / `globalThis.LOCAL_PLAYER_KEY` 等 → DI 経由に
    - L530-535: `globalThis.NetworkMatchClient.publishSnapshot` → DI 経由に
    - L584-585: `globalThis.PendingCoordinator` fallback
    - L1037-1038: `globalThis.requestCardUiSync` → 不要なら削除
    - 他、残りの globalThis READ
  - 各参照を以下に置き換え:
    - 可能なもの: `require()` で直接 import
    - 不可能なもの（UI 層が提供するもの）: `setUIImpl()` のインターフェースに追加し、DI 経由で注入

  **Must NOT do**:
  - NetworkMatchClient の DI は `setUIImpl()` に追加せず、別途 NetworkDI として分離を検討

  **Recommended Agent Profile**:
  - **Category**: `deep` (同じファイルの続き)
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (same file)
  - **Blocks**: Tasks 4-8
  - **Blocked By**: 2

  **References**:
  - `game/turn-manager.ts` — 編集対象
  - `ui/bootstrap.ts` L842-915 — NetworkDI の注入場所

  **Acceptance Criteria**:
  - [ ] `npm run build:ts` — エラーなし
  - [ ] `npm run test:jest` — 全テスト通過
  - [ ] `npm run check:window` — PASS (globalThis のみ確認)

  **QA Scenarios**:

  ```
  Scenario: No globalThis reads from turn-manager during module load
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run: node -e "
        // Verify module loads without globalThis access
        process.env.TEST_ENV = '1';
        // Clear any pre-existing globals
        delete global.isProcessing;
        delete global.VisualPlaybackActive;
        const tm = require('./game/turn-manager');
        console.log('loaded:', typeof tm.resetGame);
      "
    Expected Result: Module loads without errors (no globalThis access required)
    Evidence: .sisyphus/evidence/task-3-no-globalthis.txt
  ```

  **Commit**: YES (with 1, 2)
  - Message: `refactor(turn-manager): eliminate globalThis fallback patterns`
  - Pre-commit: `npm run build:ts && npm run test:jest`

---

- [x] 4. turn-manager.ts → 互換 compat export の明示化

  **What to do**:
  - `game/turn-manager.ts` L1108-1110 の互換 export を確認:
    - `globalThis.resetGame = resetGame`
    - `globalThis.handleCellClick = handleCellClick`
  - これらは他モジュールからの依存がある可能性が高い。削除はせず、`@compat` コメントを付加:
    - `// @compat - remove by Wave F: entry-browser.js がこの関数を window 経由で提供するようになったら削除`
  - `module.exports` に両関数が含まれていることを確認

  **Must NOT do**:
  - 互換 export を削除しない（Wave F で行う）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (same file, final step)
  - **Blocks**: Tasks 5-20
  - **Blocked By**: 3

  **References**:
  - `game/turn-manager.ts` L1108-1110
  - `ui/bootstrap.ts` — DI 注入の正本

  **Acceptance Criteria**:
  - [ ] compat export に `@compat` コメントが付いている
  - [ ] `resetGame`, `handleCellClick` が module.exports に含まれている
  - [ ] `npm run test:jest test/turn-manager.retry.test.ts` — 通過

  **QA Scenarios**:

  ```
  Scenario: Compat exports marked and module still works
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run: node -e "const tm=require('./game/turn-manager'); console.log('resetGame:', typeof tm.resetGame, 'handleCellClick:', typeof tm.handleCellClick);"
    Expected Result: Both functions exported
    Evidence: .sisyphus/evidence/task-4-compat-exports.txt
  ```

  **Commit**: YES (with 1-3)
  - Message: `docs(turn-manager): mark compat exports for future removal`
  - Pre-commit: `npm run build:ts && npm run test:jest`

---

## Wave 2 — Secondary: CPU handlers + move executor + pass handler

- [x] 5. cpu-turn-handler.ts → globalThis → import / DI に置き換え

  **What to do**:
  - `game/cpu-turn-handler.ts` の globalThis 参照を置き換え:
    - L72-73: `globalThis.ANIMATION_RETRY_DELAY_MS` → import の定数
    - L117-118: `globalThis.CardLogic` → import
    - L128-129: `globalThis.PendingCoordinator` → import
    - L197: `globalThis.DEBUG_HUMAN_VS_HUMAN` → DI 経由
    - L200-202: `globalThis.getCurrentMatchMode` / `globalThis.MATCH_MODE` → DI 経由
    - L209-210: `globalThis.PlaybackStateManager` → DI 経由
    - L222, L233-234: `globalThis.isProcessing` → DI 経由
    - L265: `globalThis.__BENCH_FAST_MODE` → DI 経由
    - L272-273, L287-288: `globalThis.CPU_LV6_SHARED_PROFILE` → import
    - L303-307: `globalThis.CpuLv6RuntimeCapability` → import
    - L327-328: `globalThis.CPU_LV6_SHARED_PROFILE` → import
    - L357-358: `globalThis.CPU_LV6_MIN_THINK_MS` → import
    - L377: `runtimeHelpers.resolveCommentaryRuntimeFromGlobal(globalThis)` → import ベースに
    - L387-388: `globalThis.CpuCommentaryRuntime` → import
    - L398-399: `globalThis.CommentaryContextHelpers` → import
    - L409-410: `globalThis.CommentaryRuntimeHelpers` → import
    - L1033-1034: `globalThis.isCardAnimating` / `globalThis.VisualPlaybackActive` → DI 経由
    - L1152-1153: `globalThis.processPassTurn` → import
    - L1161-1162: `globalThis.applyCardChoice` → import
    - L1745-1780: 互換 export ブロック → `@compat` マーク
  - 方針:
    - `require()` で import 可能なもの → 直接 import
    - DI が必要なもの → `setUIImpl()` に追加（既存パターンに準拠）

  **Must NOT do**:
  - CPU コアロジックは変更しない（`processCpuTurn` の内部処理はそのまま）

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6, 7, 8 — independent files)
  - **Parallel Group**: Wave 2 (with 6, 7, 8)
  - **Blocks**: Task 13, 20
  - **Blocked By**: 1-4 (turn-manager stable)

  **References**:
  - `game/cpu-turn-handler.ts` — 編集対象
  - `game/turn-manager.ts` — 同様のリファクタリングパターンの参考

  **Acceptance Criteria**:
  - [ ] `npm run build:ts` — エラーなし
  - [ ] `npm run test:jest` — CPU 関連テスト通過

  **QA Scenarios**:

  ```
  Scenario: cpu-turn-handler loads without globalThis dependency
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run: node -e "process.env.TEST_ENV='1'; const m=require('./game/cpu-turn-handler'); console.log('loaded:', Object.keys(m).length, 'exports');"
    Expected Result: Module loads successfully
    Evidence: .sisyphus/evidence/task-5-cpu-turn-handler-load.txt
  ```

  **Commit**: YES
  - Message: `refactor(cpu-turn-handler): replace globalThis with imports/DI`
  - Pre-commit: `npm run build:ts && npm run test:jest`

---

- [x] 6. move-executor.js → globalThis WRITE → DI / export に置き換え

  **What to do**:
  - `game/move-executor.js` の globalThis WRITE を置き換え:
    - `globalThis.isProcessing` → DI 経由 (PlaybackStateManager)
    - `globalThis.cardState` → 不要なら削除（既に引数として渡されている）
    - `globalThis.executeMove` → module.exports に追加
    - その他 globalThis WRITE
  - `setUIImpl()` / `__uiImpl_move_executor` パターンは維持

  **Must NOT do**:
  - move-executor.js の内部ロジックは変更しない

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 5, 7, 8)
  - **Blocked By**: 1-4

  **Acceptance Criteria**:
  - [ ] `npm run build:ts` — エラーなし
  - [ ] `npm run test:jest test/game.move-executor*` — 通過

  **QA Scenarios**:

  ```
  Scenario: move-executor exports correct API
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run: node -e "const m=require('./game/move-executor'); console.log('exports:', typeof m.executeMove, typeof m.setUIImpl);"
    Expected Result: executeMove and setUIImpl are functions
    Evidence: .sisyphus/evidence/task-6-move-executor.txt
  ```

  **Commit**: YES (with 5)
  - Pre-commit: `npm run build:ts && npm run test:jest`

---

- [x] 7. move-generator.js → globalThis → import に置き換え

  **What to do**:
  - `game/move-generator.js` の globalThis 参照を置き換え

  **Must NOT do**:
  - move-generator の内部ロジックは変更しない

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 5, 6, 8)
  - **Blocked By**: 1-4

  **Commit**: YES (with 5-6)
  - Pre-commit: `npm run build:ts && npm run test:jest`

---

- [x] 8. pass-handler.js → globalThis → import / DI に置き換え

  **What to do**:
  - `dist/game/pass-handler.js` の globalThis 参照を置き換え

  **Must NOT do**:
  - pass-handler の内部ロジックは変更しない

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 5, 6, 7)
  - **Blocked By**: 1-4

  **Commit**: YES (with 5-7)
  - Pre-commit: `npm run build:ts && npm run test:jest`

---

## Wave 3 — Card effects + special effects

- [x] 9. card-effects/helpers.ts + placement.ts → globalThis → import

  **What to do**:
  - `game/card-effects/helpers.ts`: 5件の `globalThis` 書込（`getPlayerKey`, `getPlayerDisplayName` 等）を `module.exports` に変更。globalThis 書込は削除（または `@compat` 化）
  - `game/card-effects/placement.ts`: `globalThis.getPlayerKey`, `globalThis.cardState`, `globalThis.gameState`, `globalThis.emitLogAdded`, `globalThis.LOG_MESSAGES` → import

  **Must NOT do**: カード効果ロジックは変更しない
  **Recommended Agent Profile**: `deep`
  **Parallelization**: YES (Wave 3 with 10, 11, 12)
  **Blocked By**: 1-4
  **Commit**: YES (Pre-commit: `npm run build:ts && npm run test:jest`)

---

- [x] 10. card-effects/destroy.ts → (globalThis as any) → import

  **What to do**:
  - `game/card-effects/destroy.ts`: `(globalThis as any).LOG_MESSAGES`, `(globalThis as any).emitLogAdded`, `(globalThis as any).posToNotation`, `(globalThis as any).CardLogic` → import に置き換え
  - `PendingSelectionFlow` fallback 削除

  **Must NOT do**: ロジック変更しない
  **Recommended Agent Profile**: `deep`
  **Parallelization**: YES
  **Blocked By**: 1-4
  **Commit**: YES

---

- [x] 11. 全 card-effects/*.ts PendingSelectionFlow fallback 削除 (~20 files)

  **What to do**:
  - 以下全ファイルで `if (!PendingSelectionFlow && typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow)` を削除。代わりに `const PendingSelectionFlow = require('./selection-flow');`
  - 対象: trap, time-bomb, tempt, guard, teleport, freeze, swap, extend-life, strong-wind, seed, clone, position-swap, capture, board-shrink, meteor, board-expansion, living-will, blockade, hyperactive-inherit, destroy

  **Must NOT do**: 1ファイルずつ確認。一括置換でミスしない
  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: YES
  **Blocked By**: 1-4
  **Commit**: YES
  - Message: `refactor(card-effects): remove PendingSelectionFlow globalThis fallback`
  - Pre-commit: `npm run build:ts && npm run test:jest`

---

- [x] 12. special-effects/bombs.ts → (globalThis as any) → import（最重要）

  **What to do**:
  - `game/special-effects/bombs.ts`: 40+件の `(globalThis as any).XXX` → import に置き換え
  - 主な参照: `MarkersAdapter`, `cardState`, `BLACK`, `WHITE`, `getPlayerKey`, `gameState`, `TurnPipelinePhases`, `CardLogic`, `Core`, `emitGameStateChange`, `emitBoardUpdate`, `emitLogAdded`, `LOG_MESSAGES`, `posToNotation`, `AnimationEngine`, `animateFadeOutAt`, `animateDestroyAt`, `PlaybackEngine` 等

  **Must NOT do**: 爆弾処理ロジックは変更しない
  **Recommended Agent Profile**: `deep` (40+箇所、慎重な確認が必要)
  **Parallelization**: YES
  **Blocked By**: 1-4, 9
  **Commit**: YES
  - Pre-commit: `npm run build:ts && npm run test:jest test/game.special-effects*`

---

- [x] 13. special-effects/breeding.ts + udg.ts → globalThis → import

  **What to do**:
  - `breeding.ts`: `globalThis.PlaybackEngine`, `globalThis.getAnimationTiming`, `globalThis.processBreedingEffectsAtTurnStart` 書込 → export 化
  - `udg.ts`: `globalThis.PlaybackEngine` → import

  **Parallelization**: YES (Wave 3)
  **Blocked By**: 1-4
  **Commit**: YES (with 12)

---

## Wave 4 — Remaining game/ files

- [x] 14. timers.ts → globalThis.GameTimers export 削除

  **What to do**:
  - `game/timers.ts`: `globalThis.GameTimers = { setTimerImpl, waitMs, requestFrame, hasTimerImpl }` を削除
  - `module.exports` のみで対応

  **Parallelization**: YES (W4)
  **Blocked By**: 1-4
  **Commit**: YES

---

- [x] 15. auto.ts → globalThis 書込削除

  **What to do**:
  - `game/auto.ts`: `globalThis.autoSimple = {...}` を削除。module.exports で代替

  **Parallelization**: YES
  **Commit**: YES

---

- [x] 16. controller-events.ts → globalThis.GameEvents 書込 → export

  **What to do**:
  - `game/controller-events.ts`: `(globalThis as any).GameEvents` → export で代替

  **Parallelization**: YES
  **Commit**: YES

---

- [x] 17. game/logic/* files → globalThis → import

  **What to do**:
  - `game/logic/context.ts`: `globalThis.MarkersAdapter`, `globalThis.CardLogic` → import
  - `game/logic/cards.ts`: `globalThis.DEBUG_WORK_LOG`, `globalThis.CardMarkers`, `globalThis.CardHandManager` → import
  - `game/logic/presentation.ts`: `globalThis.CardLogic` → import
  - `game/logic/board_ops.ts`: `globalThis` 参照 → import / export

  **Parallelization**: YES
  **Blocked By**: 1-4
  **Commit**: YES

---

- [x] 18. game/ai/* files → globalThis → import

  **What to do**:
  - `game/ai/policy-onnx-runtime.ts`: `globalThis.SharedBoardUtils`, `globalThis.CHARGE_MAX`, `globalThis.SharedConstants`, `globalThis.ort` → import。`globalThis.CpuPolicyOnnxRuntime` 書込 → export
  - `game/ai/fixed-commentary-engine.ts`: `globalThis.CPU_TALK_ENABLED`, `globalThis.CARD_TYPE_BY_ID`, `globalThis.CardLogic` → import
  - `game/ai/mcts-policy.ts`: `globalThis.Core`, `globalThis.CoreLogic`, `globalThis.CardLogic`, `globalThis.CpuPolicyOnnxRuntime` → import。`globalThis.CpuMctsPolicy` 書込 → export
  - `game/ai/cpu-lv6-lookahead-profile.ts`: `globalThis.CPU_LV6_SHARED_PROFILE`, `globalThis.CpuLv6RuntimeCapability` → import
  - `game/ai/cpu-commentary-runtime.ts`: `globalThis.FixedCommentaryEngine` → import。`globalThis.CpuCommentaryRuntime` 書込 → export

  **Parallelization**: YES (independent files)
  **Blocked By**: 1-4
  **Commit**: YES

---

- [x] 19. game/presentation.ts → globalThis → import

  **What to do**:
  - `game/presentation.ts`: `globalThis.CardLogic` → import

  **Parallelization**: YES
  **Commit**: YES (with 17)

---

- [x] 20. game/turn/* + game/special-effects/*(残り) → globalThis → import

  **What to do**:
  - `game/turn/pipeline_ui_adapter.ts`: `const globalScope = (typeof globalThis !== 'undefined') ? globalThis` 削除 → 引数経由
  - `game/turn/pending-coordinator.ts` L476: `(typeof globalThis !== 'undefined' ? globalThis : this)` 削除
  - `game/turn/turn_pipeline_phases.ts`: `const globalScope = ...` パターン削除
  - 残り special-effects ファイル → globalThis → import

  **Parallelization**: YES
  **Blocked By**: 1-4, 9, 12
  **Commit**: YES

---

## Wave FINAL — Cleanup & Final Verification

- [x] F1. 互換レイヤーの最終確認

  **What to do**:
  - 全 `@compat` タグが付いた export を確認
  - 以下の互換 export がまだ必要か検証:
    - `turn-manager.ts`: `globalThis.resetGame`, `globalThis.handleCellClick`
    - `cpu-turn-handler.ts`: `globalThis.processCpuTurn`, `globalThis.processAutoBlackTurn`
    - `ui/bootstrap.ts`: `window.addLog`, `window.updateBgmButtons`
  - entry-browser.js の `Object.assign(window, _modN)` が提供済みなら互換 export を削除

  **Must NOT do**: entry-browser.js 自体は変更しない
  **Parallelization**: YES (with F2, F3, F4)
  **Blocked By**: 1-20
  **Commit**: YES

---

- [x] F2. check-window-usage.ts 最終拡張

  **What to do**:
  - Phase A で追加した globalThis 検出を本番有効化
  - この時点で `game/` から globalThis WRITE がゼロになったことを確認
  - `npm run check:window` を CI チェックとして確定

  **Parallelization**: YES
  **Blocked By**: 1-20
  **Commit**: YES (with F1)

---

- [x] F3. 全テスト通過確認

  **What to do**:
  - `npm run checkall` — PASS
  - `npm run test:jest` — 全456テスト通過
  - `npm run test:jest:coverage` — カバレッジ維持
  - skip していた globalThis 境界テストを有効化し PASS 確認

  **Parallelization**: YES
  **Blocked By**: 1-20, F1-F2
  **Commit**: NO (verification only)

---

- [x] F4. worker-public 同期確認

  **What to do**:
  - `npm run worker:prepare` 実行
  - `worker-public/` が正しく同期されていることを確認
  - `worker-public/index.html` が `entry-browser.js` を参照していることを確認

  **Parallelization**: YES
  **Blocked By**: F3 (tests must pass first)
  **Commit**: YES (sync commit)

---

## Commit Strategy

- **A1-A2**: `chore(scripts): add globalThis detection to check-window-usage and boundary test`
- **1-4**: `refactor(turn-manager): replace globalThis dependencies with imports/DI`
- **5-8**: `refactor(cpu,executor): replace globalThis with imports in secondary modules`
- **9-11**: `refactor(card-effects): remove globalThis PendingSelectionFlow fallbacks`
- **12-13**: `refactor(special-effects): replace globalThis with imports in bombs/breeding`
- **14-16**: `refactor(game): replace globalThis exports in timers/auto/controller-events`
- **17-20**: `refactor(game): replace globalThis in logic/ai/turn pipeline modules`
- **F1-F2**: `chore: finalize compat layer and globalThis boundary check`
- **F4**: `chore: sync worker-public after refactoring`

## Success Criteria

### Verification Commands
```bash
npm run check:window  # Must PASS — no globalThis violations in game/
npm run build:ts       # Must PASS — type check + build
npm run test:jest      # Must PASS — all 456 tests
npm run test:jest:coverage  # Must PASS — game/ coverage maintained
npm run checkall       # Must PASS — pre-test checks
npm run worker:prepare # Must PASS — worker-public sync
```

### Final Checklist
- [ ] `grep -rn "globalThis\." game/ --include="*.ts" --include="*.js" | grep "=" | wc -l` → **0** (no globalThis WRITES in game/)
- [ ] `npm run check:window` — PASS (globalThis 検出含む)
- [ ] `npm run test:jest` — 全テスト通過
- [ ] `npm run test:jest:coverage` — カバレッジ維持
- [ ] `npm run checkall` — PASS
- [ ] ゲーム挙動維持確認（UI テスト + Playwright smoke test 通過）

> **Note**: CPU層 (`cpu/`) の globalThis は本計画の対象外。別計画で対応する。
