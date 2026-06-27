# TypeScript移行完了宣言・残存JS許容リスト化計画

## TL;DR

> **Quick Summary**: TypeScript移行の主要課題（R1-R4）はすべて解消済み。本計画では「TS移行完了」を宣言し、残存する425件の.jsファイルを許容リストとして正式に文書化する。unknown分類のファイルを調査・再分類し、今後の新規legacy-implementation増殖を防ぐゲートを維持する。
>
> **Deliverables**:
> - 残存JSファイルの正式許容リストドキュメント
> - unknown 52件の調査・再分類結果
> - 既存計画書の完了ステータス更新
>
> **Estimated Effort**: Short（1-2時間）
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Final Verification

---

## Context

### Original Request
過去に実施したJS→TS移行計画の残課題を確認し、最適な今後の進め方を決定する。

### Interview Summary
**Key Discussions**:
- 既存計画書 `typescript-migration-completion-plan-2026-05-07.md` と `typescript-migration-residual-fix-plan-2026-05-07.md` を確認
- ユーザーは「凍結・監視モード（A）」を選択：TS移行完了を宣言し、残存JSを許容リスト化してゲートを維持

**Research Findings**:
- R1-R4すべて解消済み（テストPASS、型検査PASS、checkall PASS）
- 残存JS 425件の内訳：dist-wrapper 348, generated 3, legacy-implementation 22, unknown 52
- `checkall` のJS inventory gateは現在も機能している

---

## Work Objectives

### Core Objective
TypeScript移行を「完了」と宣言し、残存する.jsファイルを正式な許容リストとして文書化する。

### Concrete Deliverables
- `docs/typescript-migration-js-allowlist.md`（新規）：残存JSファイルの正式許容リスト
- `docs/plans/typescript-migration-completion-plan-2026-05-07.md`（更新）：完了ステータスの反映
- unknownファイルの再分類結果

### Definition of Done
- [ ] すべての残存JSファイルが4つのカテゴリ（dist-wrapper/generated/legacy-implementation/allowlisted）のいずれかに分類されている
- [ ] `npm run checkall` がPASSする
- [ ] `npm run typecheck` がPASSする
- [ ] `npm run build:ts` がPASSする

### Must Have
- unknown 52件の調査と再分類
- 許容リストドキュメントの作成
- 既存計画書のステータス更新

### Must NOT Have (Guardrails)
- 新たなJS→TS移行作業（凍結が前提）
- dist-wrapperの削除（互換性維持が必要）
- generatedファイルの手動修正
- ゲーム仕様や挙動の変更

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: None（文書化作業が中心）
- **Agent-Executed QA**: 各タスクのacceptance criteriaで検証

### QA Policy
毎タスクのacceptance criteriaに `npm run checkall` と `npm run typecheck` のPASSを含める。

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1（即座に開始 - 調査と文書化）:
├── Task 1: unknownファイルの調査と再分類
├── Task 2: 許容リストドキュメントの作成
└── Task 3: 既存計画書の完了ステータス更新

Wave FINAL（統合検証）:
├── Task F1: 最終検証（checkall, typecheck, build:ts）
```

### Dependency Matrix
- **Task 1**: - → Task 2（調査結果が文書化の前提）
- **Task 2**: Task 1 → Task 3（許容リストが計画書更新の前提）
- **Task 3**: Task 2 → F1
- **F1**: Task 3 → 完了

---

## TODOs

- [ ] 1. unknownファイルの調査と再分類

  **What to do**:
  - `scripts/inventory-js-legacy.ts` の出力にある unknown 52件を1件ずつ調査する
  - 特に大きなファイル `cards/catalog.js` (835行) は、対応TS (`cards/catalog.ts`) があるか確認する
  - `game/src/types/*.js` や `src/types/*.js` は型定義ファイルか確認する
  - `scripts/` 下のunknownファイルは、ツール/デバッグ用か確認する
  - 調査結果に基づき、各ファイルを適切なカテゴリへ再分類する：
    - dist-wrapper（対応TSがある場合）
    - legacy-implementation（Node.jsスクリプト等）
    - generated（ビルド生成物の可能性）
    - allowlisted-unknown（分類不能だが許容する場合は理由を記載）

  **Must NOT do**:
  - ファイルの内容を修正・削除しない（調査のみ）
  - JS→TSの移行作業は行わない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: なし
  - **理由**: ファイルの存在確認と簡単な内容確認が中心

  **Parallelization**:
  - **Can Run In Parallel**: NO（他のタスクの前提）
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:
  - `scripts/inventory-js-legacy.ts` - JS分類スクリプト
  - `cards/catalog.js` - 最大のunknownファイル
  - `cards/catalog.ts` - 対応TSの有無確認
  - `docs/plans/typescript-migration-completion-plan-2026-05-07.md` - 既存の分類定義

  **Acceptance Criteria**:
  - [ ] unknown 52件のそれぞれが調査済みである
  - [ ] 各ファイルの新しい分類が決定している
  - [ ] `cards/catalog.js` の対応TSの有無が確認されている
  - [ ] 調査結果がテキストで記録されている（コミットメッセージまたは別ファイル）

  **QA Scenarios**:
  ```
  Scenario: unknownファイルの棚卸し
    Tool: Bash
    Preconditions: リポジトリがクリーンな状態
    Steps:
      1. `node dist/scripts/inventory-js-legacy.js` を実行
      2. 出力の `unknown` セクションを確認
      3. `cards/catalog.js` がunknownに含まれていることを確認
    Expected Result: unknownファイルのリストが取得でき、調査対象が特定されている
    Evidence: ターミナル出力のスクリーンショットまたはテキストコピー

  Scenario: cards/catalog.jsの調査
    Tool: Bash
    Preconditions: リポジトリがクリーンな状態
    Steps:
      1. `ls cards/catalog.ts` を実行して対応TSの有無を確認
      2. `head -20 cards/catalog.js` を実行して内容を確認
    Expected Result: 対応TSの有無、ファイルの性質が判断できる
    Evidence: ターミナル出力
  ```

  **Commit**: YES
  - Message: `docs(ts-migration): investigate and reclassify unknown JS files`
  - Files: `docs/typescript-migration-js-allowlist.md`（調査結果メモ）

- [ ] 2. 許容リストドキュメントの作成

  **What to do**:
  - `docs/typescript-migration-js-allowlist.md` を新規作成する
  - 以下のセクションを含める：
    1. **目的**: なぜこれらのJSファイルが残っているか
    2. **許容カテゴリ**: dist-wrapper / generated / legacy-implementation / allowlisted-unknown
    3. **各カテゴリのファイルリスト**: `scripts/inventory-js-legacy.ts` の出力を基に
    4. **各ファイルの残存理由**: 1行程度の説明
    5. **今後の方針**: 新規legacy-implementationを許容しない、ゲートの説明
  - 特に `cards/catalog.js` については、調査結果に基づき詳細な説明を入れる

  **Must NOT do**:
  - 実装ファイルの修正は行わない
  - ゲーム仕様や挙動の変更は行わない

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: なし
  - **理由**: ドキュメント作成が中心

  **Parallelization**:
  - **Can Run In Parallel**: NO（Task 1の結果が必要）
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:
  - `scripts/inventory-js-legacy.ts` の出力結果
  - `docs/plans/typescript-migration-completion-plan-2026-05-07.md` の完了定義セクション
  - `docs/architecture-contracts.md` - 内部契約の正本

  **Acceptance Criteria**:
  - [ ] `docs/typescript-migration-js-allowlist.md` が作成されている
  - [ ] すべての残存JSファイルがカテゴリ別にリスト化されている
  - [ ] 各ファイルの残存理由が記載されている
  - [ ] ドキュメントに「新規legacy-implementationの禁止」ポリシーが明記されている

  **QA Scenarios**:
  ```
  Scenario: ドキュメントの作成確認
    Tool: Bash
    Preconditions: Task 1が完了している
    Steps:
      1. `cat docs/typescript-migration-js-allowlist.md` を実行
      2. ファイルが存在し、必要なセクションが含まれていることを確認
    Expected Result: ドキュメントが作成され、必要な情報が含まれている
    Evidence: ファイル内容のテキストコピー

  Scenario: リストの完全性確認
    Tool: Bash
    Steps:
      1. ドキュメント内のファイルリストの件数が、inventory-js-legacyの出力と一致することを確認
      2. 特にdist-wrapper 348件、generated 3件、legacy-implementation 22件が網羅されているか確認
    Expected Result: 件数が一致し、すべてのファイルがリストに含まれている
    Evidence: 件数比較結果
  ```

  **Commit**: YES
  - Message: `docs(ts-migration): add formal JS allowlist documentation`
  - Files: `docs/typescript-migration-js-allowlist.md`

- [ ] 3. 既存計画書の完了ステータス更新

  **What to do**:
  - `docs/plans/typescript-migration-completion-plan-2026-05-07.md` を更新する
  - 「10. 実行結果記録」セクションに現在のHEAD（efff49c）での検証結果を追加する
  - 残課題リストを更新し、R1-R4が解消済みであることを明記する
  - 「7. 最終完了定義」のチェックリストを更新し、現状で満たされている項目をチェックする
  - 完了宣言の日付とコミットハッシュを記載する
  - 計画書の先頭に「完了済み（2026-05-07）」の注記を追加する

  **Must NOT do**:
  - 計画書の過去の実行記録を書き換えない（追記のみ）
  - 新たなフェーズやタスクを追加しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: なし
  - **理由**: 既存ドキュメントの更新が中心

  **Parallelization**:
  - **Can Run In Parallel**: NO（Task 2の結果が必要）
  - **Blocks**: F1
  - **Blocked By**: Task 2

  **References**:
  - `docs/plans/typescript-migration-completion-plan-2026-05-07.md`
  - `docs/plans/typescript-migration-residual-fix-plan-2026-05-07.md`
  - 本計画書のContextセクション

  **Acceptance Criteria**:
  - [ ] 計画書に完了宣言が追加されている
  - [ ] 検証結果（typecheck/build:ts/checkall PASS）が記載されている
  - [ ] 残課題が更新され、R1-R4が解消済みと明記されている
  - [ ] 完了定義のチェックリストが現状を反映している

  **QA Scenarios**:
  ```
  Scenario: 計画書の更新確認
    Tool: Bash
    Preconditions: Task 2が完了している
    Steps:
      1. `grep -n "完了宣言" docs/plans/typescript-migration-completion-plan-2026-05-07.md` を実行
      2. 完了宣言の日付とコミットハッシュが含まれていることを確認
    Expected Result: 計画書に完了宣言が追加されている
    Evidence: grep結果のテキストコピー
  ```

  **Commit**: YES
  - Message: `docs(ts-migration): update completion plan with final status`
  - Files: `docs/plans/typescript-migration-completion-plan-2026-05-07.md`

---

## Final Verification Wave

- [ ] F1. **統合検証**
  以下を順番に実行し、すべてPASSすることを確認する：
  ```bash
  npm run typecheck
  npm run build:ts
  npm run checkall
  ```

  **Acceptance Criteria**:
  - [ ] `npm run typecheck` がPASSする
  - [ ] `npm run build:ts` がPASSする
  - [ ] `npm run checkall` がPASSする（JS inventory gate含む）

  **QA Scenarios**:
  ```
  Scenario: 最終検証
    Tool: Bash
    Preconditions: Task 3が完了している
    Steps:
      1. `npm run typecheck` を実行
      2. `npm run build:ts` を実行
      3. `npm run checkall` を実行
    Expected Result: すべてのコマンドが終了コード0で完了する
    Failure Indicators: いずれかのコマンドがエラー終了する
    Evidence: ターミナル出力のテキストコピー
  ```

- [ ] F1. **統合検証**
  `npm run typecheck`, `npm run build:ts`, `npm run checkall` を実行し、すべてPASSすることを確認する。

---

## Commit Strategy

- **Task 1完了後**: `docs(ts-migration): investigate and reclassify unknown JS files`
- **Task 2完了後**: `docs(ts-migration): add formal JS allowlist documentation`
- **Task 3完了後**: `docs(ts-migration): update completion plan with final status`

---

## Success Criteria

### Verification Commands
```bash
npm run typecheck    # Expected: PASS
npm run build:ts     # Expected: PASS
npm run checkall     # Expected: PASS（JS inventory gate含む）
```

### Final Checklist
- [ ] unknownファイルが0件または適切に再分類されている
- [ ] 許容リストドキュメントが作成されている
- [ ] 既存計画書が更新されている
- [ ] すべてのチェックがPASSしている
