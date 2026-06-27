# 緊急修正計画：ビルド失敗とヘッドレス実行クラッシュ

## TL;DR

> **Quick Summary**: `npm run build:ts` が TS5055 エラーで失敗し、`game/special-effects/` 以下の BLACK/WHITE 未定義参照によりヘッドレス環境（Node.js/Jest）で特定カード効果がクラッシュする問題を修正する。
>
> **Deliverables**:
> - 修正済み `tsconfig.json`（ビルド成功）
> - 修正済み `game/special-effects/*.ts`（BLACK/WHITE を SharedConstants 経由に変更）
> - 修正済み `game/game-controller-slim.ts`（CARD_DEFS を遅延評価化）
> - 全テスト通過の確認証拠
>
> **Estimated Effort**: Medium（2-3時間）
> **Parallel Execution**: YES - 3 Waves
> **Critical Path**: Task 1 → Task 2-5 → Task 6-7 → Task 8

---

## Context

### Original Request
リポジトリを調査して、今すぐに絶対修正するべき箇所があるか分析調査し、計画書を作成する。

### Interview Summary
**Key Discussions**:
- build:ts が TS5055 で失敗（dist/ 内の .d.ts が入力扱い）
- hyperactive.ts / dragons.ts で BLACK/WHITE が未定義 → ReferenceError
- game-controller-slim.ts で module top-level で globalThis.CARD_DEFS にアクセス → TypeError
- globalThis 依存が game/ 内に150件以上蔓延（既知の技術債務）

**Research Findings**:
- tsconfig.json: include に `game/**/*`、exclude に `dist`、declaration: true
- shared-constants.ts: `export const BLACK = 1`、`export const WHITE = -1`
- 正例：game/logic/cards/living_will.ts は SharedConstants から BLACK/WHITE を取得
- 誤例：game/special-effects/*.ts は `player === BLACK` と直接参照（import/宣言なし）

### Metis Review
**Identified Gaps** (addressed):
- tsconfig.json の修正方針：include から dist/ を除外する方向で対応
- special-effects の修正範囲：4ファイル（hyperactive.ts, dragons.ts, udg.ts, breeding.ts）
- テスト戦略：修正後に `npm run build:ts` と `npm run test:jest` を実行

---

## Work Objectives

### Core Objective
`npm run build:ts` の成功と、`game/special-effects/` 以下のヘッドレス実行互換性を確保する。

### Concrete Deliverables
- `tsconfig.json`（include/exclude 調整）
- `game/special-effects/hyperactive.ts`（BLACK/WHITE 参照修正）
- `game/special-effects/dragons.ts`（BLACK/WHITE 参照修正）
- `game/special-effects/udg.ts`（BLACK/WHITE 参照修正）
- `game/special-effects/breeding.ts`（BLACK/WHITE 参照修正）
- `game/game-controller-slim.ts`（CARD_DEFS 遅延評価化）

### Definition of Done
- [ ] `npm run build:ts` がエラーなしで成功する
- [ ] `npm run typecheck` がエラーなしで成功する
- [ ] `npm run test:jest` が全テスト通過する（または既存の失敗と同じ）
- [ ] `npm run check:window` の結果が悪化していない

### Must Have
- build:ts の TS5055 エラー解消
- special-effects/ 以下の BLACK/WHITE 未定義参照解消
- game-controller-slim.ts の module top-level CARD_DEFS アクセス解消

### Must NOT Have (Guardrails)
- `game/` 層に新しい globalThis/window/DOM 依存を追加しない
- `worker-public/` を直接編集しない（root 修正後に `npm run worker:prepare` で同期）
- 既存のブラウザ動作を破壊しない
- 仕様変更は行わない（純粋なバグ修正のみ）

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES（Jest + ts-jest）
- **Automated tests**: YES（Tests after）
- **Framework**: Jest with ts-jest
- **Agent-Executed QA**: MANDATORY for all tasks

### QA Policy
Every task MUST include agent-executed QA scenarios.

- **Backend/Build**: Use Bash - Run commands, assert exit codes and output
- **Evidence saved to**: `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - foundation):
├── Task 1: Fix tsconfig.json build failure [quick]
└── Task 2: Fix game-controller-slim.ts CARD_DEFS [quick]

Wave 2 (After Wave 1 - core fixes, MAX PARALLEL):
├── Task 3: Fix hyperactive.ts BLACK/WHITE references [quick]
├── Task 4: Fix dragons.ts BLACK/WHITE references [quick]
├── Task 5: Fix udg.ts BLACK/WHITE references [quick]
└── Task 6: Fix breeding.ts BLACK/WHITE references [quick]

Wave 3 (After Wave 2 - verification):
├── Task 7: Build verification [quick]
└── Task 8: Test verification [unspecified-high]

Wave FINAL (After ALL tasks - 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Task 3-6 → Task 7-8 → F1-F4 → user okay
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 4 (Wave 2)
```

### Dependency Matrix

- **Task 1**: None → Blocks Task 7
- **Task 2**: None → Independent
- **Task 3**: None → Independent
- **Task 4**: None → Independent
- **Task 5**: None → Independent
- **Task 6**: None → Independent
- **Task 7**: Depends on Task 1 → Final verification
- **Task 8**: Depends on Task 2-6 → Final verification

### Agent Dispatch Summary

- **Wave 1**: 2 tasks → `quick` × 2
- **Wave 2**: 4 tasks → `quick` × 4
- **Wave 3**: 2 tasks → `quick` × 1, `unspecified-high` × 1
- **FINAL**: 4 tasks → `oracle`, `unspecified-high` × 2, `deep`

---

## TODOs

- [x] 1. Fix tsconfig.json to resolve TS5055 build errors

  **What to do**:
  - Read `tsconfig.json` and understand current include/exclude settings
  - Add `"dist"` to `exclude` array（すでにあるが、より厳密に）
  - または、include パターンを調整して `dist/` を含まないようにする
  - 推奨：include に `"*.ts"` があるため、これが `dist/**/*.d.ts` にマッチしている可能性
  - 修正方針：include から `"*.ts"` を削除し、明示的なディレクトリ指定に変更
  - または、rootDir を調整して dist/ が入力として扱われないようにする

  **Must NOT do**:
  - declaration: false にしない（.d.ts 生成は必要）
  - outDir を変更しない（dist/ は既定の出力先）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: 設定ファイルの単純な修正

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:
  - `tsconfig.json` - 現在の設定
  - TypeScript docs: TS5055 error explanation

  **Acceptance Criteria**:
  - [ ] `npm run build:ts` が TS5055 エラーなしで成功する
  - [ ] `npm run typecheck` が成功する

  **QA Scenarios**:

  ```
  Scenario: Build succeeds after tsconfig fix
    Tool: Bash
    Preconditions: 未修正の tsconfig.json で build:ts が失敗することを確認済み
    Steps:
      1. npm run build:ts を実行
      2. 出力に "error TS5055" が含まれていないことを確認
      3. dist/ ディレクトリに新しい .js と .d.ts ファイルが生成されていることを確認
    Expected Result: ビルドがエラーなしで完了（exit code 0）
    Failure Indicators: TS5055 エラーが残っている、または新しいエラーが発生
    Evidence: .sisyphus/evidence/task-1-build-success.log
  ```

  **Evidence to Capture**:
  - [ ] `npm run build:ts` の出力ログ
  - [ ] `npm run typecheck` の出力ログ

  **Commit**: YES
  - Message: `fix(build): resolve TS5055 by adjusting tsconfig include/exclude`
  - Files: `tsconfig.json`

---

- [x] 2. Fix game-controller-slim.ts CARD_DEFS module-level access

  **What to do**:
  - Read `game/game-controller-slim.ts`
  - 8-11行目の `const CARD_TYPE_BY_ID = (globalThis as any).CARD_DEFS.reduce(...)` を遅延評価化
  - 関数内に移動するか、安全なフォールバックを追加
  - 推奨：CARD_TYPE_BY_ID を関数 `getCardTypeById()` に変更し、初回呼び出し時に初期化
  - または、try-catch で囲み、失敗時に空オブジェクトを返す

  **Must NOT do**:
  - globalThis.CARD_DEFS をそのまま残さない（ヘッドレス環境でクラッシュ）
  - ブラウザでの動作を破壊しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: 単一ファイルの小規模修正

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `game/game-controller-slim.ts` - 修正対象
  - `shared-constants.ts` - CARD_DEFS の定義場所

  **Acceptance Criteria**:
  - [ ] `npm run typecheck` がエラーなしで成功する
  - [ ] ファイルが Node.js で require 可能（クラッシュしない）

  **QA Scenarios**:

  ```
  Scenario: game-controller-slim can be imported in Node.js
    Tool: Bash
    Preconditions: Node.js 環境で globalThis.CARD_DEFS が未定義
    Steps:
      1. node -e "require('./dist/game/game-controller-slim')" を実行
      2. ReferenceError/TypeError が発生しないことを確認
    Expected Result: 正常に require 可能（exit code 0）
    Failure Indicators: TypeError: Cannot read property 'reduce' of undefined
    Evidence: .sisyphus/evidence/task-2-node-require.log
  ```

  **Evidence to Capture**:
  - [ ] Node.js require テストの出力

  **Commit**: YES
  - Message: `fix(game): defer CARD_DEFS access in game-controller-slim to avoid headless crash`
  - Files: `game/game-controller-slim.ts`

---

- [x] 3. Fix hyperactive.ts BLACK/WHITE undefined references

  **What to do**:
  - Read `game/special-effects/hyperactive.ts`
  - ファイル先頭に SharedConstants から BLACK/WHITE を取得するコードを追加
  - 正例：`game/logic/cards/living_will.ts` のパターンを使用
  - すべての `player === BLACK`、`toColor !== BLACK`、`toColor !== WHITE` などを修正
  - 具体的な修正：
    ```typescript
    const SharedConstants = require('../../shared-constants');
    const BLACK = Number.isFinite(Number(SharedConstants && SharedConstants.BLACK))
        ? Number(SharedConstants.BLACK) : 1;
    const WHITE = Number.isFinite(Number(SharedConstants && SharedConstants.WHITE))
        ? Number(SharedConstants.WHITE) : -1;
    ```

  **Must NOT do**:
  - `declare const BLACK: any;` を追加しない（これはブラウザ依存）
  - `globalThis.BLACK` を参照しない
  - 既存のロジックを変更しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: 単一ファイルの置換作業

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `game/special-effects/hyperactive.ts` - 修正対象
  - `game/logic/cards/living_will.ts` - 正しい実装パターン
  - `shared-constants.ts` - BLACK/WHITE の定義

  **Acceptance Criteria**:
  - [ ] `npm run typecheck` がエラーなしで成功する
  - [ ] `npx jest --runInBand --runTestsByPath test/game.hyperactive.playback.test.js` がクラッシュしない

  **QA Scenarios**:

  ```
  Scenario: Hyperactive test no longer crashes on BLACK reference
    Tool: Bash
    Preconditions: 修正前は ReferenceError: BLACK is not defined でクラッシュ
    Steps:
      1. npx jest --runInBand --runTestsByPath test/game.hyperactive.playback.test.js を実行
      2. ReferenceError が発生しないことを確認
    Expected Result: テストが実行される（pass/fail は別として、クラッシュしない）
    Failure Indicators: ReferenceError: BLACK is not defined
    Evidence: .sisyphus/evidence/task-3-hyperactive-test.log
  ```

  **Evidence to Capture**:
  - [ ] Jest テスト実行ログ

  **Commit**: YES
  - Message: `fix(game/special-effects): define BLACK/WHITE from SharedConstants in hyperactive.ts`
  - Files: `game/special-effects/hyperactive.ts`

---

- [x] 4. Fix dragons.ts BLACK/WHITE undefined references

  **What to do**:
  - Read `game/special-effects/dragons.ts`
  - Task 3 と同様に SharedConstants から BLACK/WHITE を取得
  - `player === BLACK`、`ownerColor = player === BLACK ? BLACK : WHITE` などを修正

  **Must NOT do**:
  - Task 3 と同じ

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `game/special-effects/dragons.ts` - 修正対象
  - `game/logic/cards/living_will.ts` - 正しい実装パターン

  **Acceptance Criteria**:
  - [ ] `npm run typecheck` が成功する
  - [ ] ファイルが Node.js で require 可能

  **QA Scenarios**:

  ```
  Scenario: dragons.ts can be imported in Node.js
    Tool: Bash
    Preconditions: Node.js 環境
    Steps:
      1. node -e "require('./dist/game/special-effects/dragons')" を実行
      2. ReferenceError が発生しないことを確認
    Expected Result: 正常に require 可能
    Evidence: .sisyphus/evidence/task-4-dragons-require.log
  ```

  **Commit**: YES
  - Message: `fix(game/special-effects): define BLACK/WHITE from SharedConstants in dragons.ts`
  - Files: `game/special-effects/dragons.ts`

---

- [x] 5. Fix udg.ts BLACK/WHITE undefined references

  **What to do**:
  - Read `game/special-effects/udg.ts`
  - Task 3 と同様に SharedConstants から BLACK/WHITE を取得
  - `player === BLACK` の2箇所を修正

  **Must NOT do**:
  - Task 3 と同じ

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `game/special-effects/udg.ts` - 修正対象

  **Acceptance Criteria**:
  - [ ] `npm run typecheck` が成功する
  - [ ] ファイルが Node.js で require 可能

  **QA Scenarios**:

  ```
  Scenario: udg.ts can be imported in Node.js
    Tool: Bash
    Steps:
      1. node -e "require('./dist/game/special-effects/udg')" を実行
      2. ReferenceError が発生しないことを確認
    Expected Result: 正常に require 可能
    Evidence: .sisyphus/evidence/task-5-udg-require.log
  ```

  **Commit**: YES
  - Message: `fix(game/special-effects): define BLACK/WHITE from SharedConstants in udg.ts`
  - Files: `game/special-effects/udg.ts`

---

- [x] 6. Fix breeding.ts BLACK/WHITE undefined references

  **What to do**:
  - Read `game/special-effects/breeding.ts`
  - Task 3 と同様に SharedConstants から BLACK/WHITE を取得
  - `player === BLACK` の2箇所を修正

  **Must NOT do**:
  - Task 3 と同じ

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `game/special-effects/breeding.ts` - 修正対象

  **Acceptance Criteria**:
  - [ ] `npm run typecheck` が成功する
  - [ ] ファイルが Node.js で require 可能

  **QA Scenarios**:

  ```
  Scenario: breeding.ts can be imported in Node.js
    Tool: Bash
    Steps:
      1. node -e "require('./dist/game/special-effects/breeding')" を実行
      2. ReferenceError が発生しないことを確認
    Expected Result: 正常に require 可能
    Evidence: .sisyphus/evidence/task-6-breeding-require.log
  ```

  **Commit**: YES
  - Message: `fix(game/special-effects): define BLACK/WHITE from SharedConstants in breeding.ts`
  - Files: `game/special-effects/breeding.ts`

---

- [x] 7. Verify build after all fixes

  **What to do**:
  - `npm run build:ts` を実行
  - すべてのエラーが解消されていることを確認
  - `dist/` に生成物が正しく出力されていることを確認

  **Must NOT do**:
  - エラーが残っている状態で先に進まない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 8
  - **Blocked By**: Task 1-6

  **References**:
  - `tsconfig.json`
  - `dist/` ディレクトリ

  **Acceptance Criteria**:
  - [ ] `npm run build:ts` が exit code 0 で成功
  - [ ] dist/ に .js と .d.ts が生成されている

  **QA Scenarios**:

  ```
  Scenario: Full build succeeds after all fixes
    Tool: Bash
    Steps:
      1. npm run build:ts を実行
      2. echo $? で exit code を確認
      3. ls dist/game/special-effects/*.js で生成物を確認
    Expected Result: exit code 0、かつ生成物が存在
    Evidence: .sisyphus/evidence/task-7-full-build.log
  ```

  **Commit**: NO（検証のみ）

---

- [x] 8. Run test suite to verify no regressions

  **What to do**:
  - `npm run test:jest` を実行
  - 既存のテストが通ることを確認
  - 新しい失敗がないことを確認
  - 特定のテスト（hyperactive 関連）がクラッシュしないことを確認

  **Must NOT do**:
  - テスト失敗を無視しない

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - **Reason**: テスト実行と結果分析に時間がかかる可能性

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Final Verification
  - **Blocked By**: Task 7

  **References**:
  - `test/` ディレクトリ
  - `package.json` の test scripts

  **Acceptance Criteria**:
  - [ ] `npm run test:jest` が完了（クラッシュしない）
  - [ ] 新しい失敗がない（既存の失敗は許容）

  **QA Scenarios**:

  ```
  Scenario: Test suite runs without new failures
    Tool: Bash
    Steps:
      1. npm run test:jest を実行
      2. 出力に "ReferenceError: BLACK is not defined" がないことを確認
      3. テストサマリーの失敗数を記録
    Expected Result: テストが完了し、新しい失敗がない
    Evidence: .sisyphus/evidence/task-8-test-results.log
  ```

  **Commit**: NO（検証のみ）

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE.

- [x] F1. **Plan Compliance Audit** — `oracle`
  - Must Have 3/3 | Must NOT Have 4/4 | Tasks 8/8 | VERDICT: APPROVE
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  - Build [PASS] | TypeCheck [PASS] | Tests [no new failures] | VERDICT: APPROVE
  Run `npm run typecheck` + `npm run build:ts` + `npm run test:jest`. Review changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod.
  Output: `Build [PASS/FAIL] | TypeCheck [PASS/FAIL] | Tests [N pass/N fail] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  - Scenarios 6/6 pass | VERDICT: APPROVE
  Execute EVERY QA scenario from tasks. Test Node.js require for all fixed files. Verify no ReferenceError/TypeError.
  Output: `Scenarios [N/N pass] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  - Tasks 8/8 compliant | VERDICT: APPROVE
  For each task: read "What to do", read actual diff. Verify 1:1 compliance. Check no scope creep.
  Output: `Tasks [N/N compliant] | VERDICT`

---

## Commit Strategy

- **Task 1**: `fix(build): resolve TS5055 by adjusting tsconfig include/exclude`
- **Task 2**: `fix(game): defer CARD_DEFS access in game-controller-slim`
- **Task 3**: `fix(game/special-effects): define BLACK/WHITE from SharedConstants in hyperactive.ts`
- **Task 4**: `fix(game/special-effects): define BLACK/WHITE from SharedConstants in dragons.ts`
- **Task 5**: `fix(game/special-effects): define BLACK/WHITE from SharedConstants in udg.ts`
- **Task 6**: `fix(game/special-effects): define BLACK/WHITE from SharedConstants in breeding.ts`

---

## Success Criteria

### Verification Commands
```bash
# Build must succeed
npm run build:ts
# Expected: exit code 0, no TS5055 errors

# Type check must pass
npm run typecheck
# Expected: exit code 0

# Tests must complete without new failures
npm run test:jest
# Expected: completes, no ReferenceError: BLACK is not defined

# Node.js require must work for fixed files
node -e "require('./dist/game/special-effects/hyperactive')"
node -e "require('./dist/game/special-effects/dragons')"
node -e "require('./dist/game/special-effects/udg')"
node -e "require('./dist/game/special-effects/breeding')"
node -e "require('./dist/game/game-controller-slim')"
# Expected: all exit code 0
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] `npm run build:ts` passes
- [x] `npm run typecheck` passes
- [x] `npm run test:jest` completes without new failures
- [x] All fixed files can be required in Node.js
- [x] No new globalThis/window dependencies in game/
- [x] `01-rulebook.md` not needed（仕様変更なし）
