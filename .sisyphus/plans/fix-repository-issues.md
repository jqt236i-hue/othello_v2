# リポジトリ品質改善計画

## TL;DR

> **目標**: カードオセロリポジトリの3大品質問題（TypeScript無効化・テスト崩壊・エラー隠蔽）を段階的に修正
> 
> ** deliverables**:
> - 236ファイルの`@ts-nocheck`完全除去
> - テストインフラ修復＋新規テスト追加（TDD）
> - 約152空catchブロックの適切なエラーハンドリング（Wave 0で正確な数を測定）
> - 424 console.logの整理（デバッグフラグ制御）
> - worker-publicミラーの同期保証
> 
> **予想工数**: Large（4-6週間）
> **並列実行**: Wave 2とWave 3を並列化可能
> **クリティカルパス**: Wave 0（ベースライン）→ Wave 1（テスト基盤）→ Wave 2/3（型安全）→ Wave 5/6（品質）→ Final Verification

---

## Context

### Original Request
> 「このリポジトリ、ゲームの最大の問題は何ですか？」→ 3大問題特定 → 「完全に修正するための計画書を作成して」

### 特定された3大問題

#### 🔴 #1: TypeScriptが機能していない（236ファイルが`@ts-nocheck`）
- **236個の`.ts`ファイル**（全体の28%）が`// @ts-nocheck`でTypeScriptチェックを無効化
- **約2,287箇所**の`as any`型キャスト（Wave 0で正確な数を測定）
- 核心ファイル全てが対象：game loop, UI bootstrap, card effects, AI, animation engine
- `tsconfig.json`は`strict: true`だが、実質的に無意味

#### 🔴 #2: テストインフラが崩壊
- `ts-jest`が非推奨API（`globals.ts-jest`）を使用
- `diagnostics: false`で型エラーをテストでも無視
- 多くのテストが`SyntaxError: Cannot use import statement outside a module`で失敗
- `TurnPipeline is not available`でクラッシュ
- テスト失敗のベースライン未測定

#### 🔴 #3: 無条件デバッグログ＋エラー隠蔽
- `game/turn-manager.ts`の`onTurnStart()`が**毎ターン無条件でconsole.log**
- **424箇所**の`console.log`（本番環境でも出力）
- **200箇所以上**の空`catch (e) { /* ignore */ }`
- エラーが静かに消え、デバッグが極端に困難

### Interview Summary

**ユーザー選択**:
- ✅ **段階的修正**（Wave-by-wave）
- ✅ **テスト修復＋新規追加（TDD推奨）**
- ✅ **ケースバイケースのエラーハンドリング**

### Metis Review（ギャップ分析）

**重要な発見**:
1. **実際の`@ts-nocheck`ファイルは236**（当初の145より多い）
2. **2,848ファイルの未コミット変更**がある—ベースライン測定が必須
3. **Wave順序の再考が必要**—葉モジュール（card-effects, ai）から先に型付けすべき
4. **`diagnostics: false`は後のWaveまで維持**—早期に有効化すると数千の型エラーでテストが全滅
5. **`_require`パターン**は構造的課題—型付けと別途対応が必要
6. **console.logの内訳**: `scripts/`（ツール）と`game/`/`ui/`（本番）で対応を分ける必要あり

**適用されたガードレール**:
- `@ts-ignore`や`as any`での回避を禁止
- 1つのコミットで1つの関心事のみ
- 各Wave後に`npm run worker:prepare`を実行
- 空catchは個別評価（意図的なものはコメント、過失なものはログ出力）
- テスト失敗数はWave 1ベースラインを下回ってはならない

---

## Work Objectives

### Core Objective
カードオセロリポジトリの型安全性、テスト信頼性、ランタイム品質を根本的に改善し、持続可能な開発基盤を確立する。

### Concrete Deliverables
- [ ] `@ts-nocheck`ファイル数: 236 → 0
- [ ] テストインフラ: 非推奨設定 → 現代的設定
- [ ] テスト失敗: ベースライン維持または改善
- [ ] 空catchブロック: 152 → 0（全て適切に処理）
- [ ] 本番console.log: 424 → 0（デバッグフラグ制御または削除）
- [ ] worker-publicミラー: 常に同期
- [ ] 新規テスト: 核心ゲームロジックをカバー

### Definition of Done
- [ ] `npm test`がベースライン以上のパス率を維持
- [ ] `npx tsc --noEmit`が0エラー（`@ts-nocheck`なしで）
- [ ] `npm run build:ts`が成功
- [ ] `npm run worker:prepare`が成功
- [ ] `npm run serve`でゲームが正常に起動・プレイ可能
- [ ] Playwrightスモークテストが通過

### Must Have
- [ ] 段階的アプローチで各Waveを独立して検証
- [ ] テストベースラインをWave 0で測定・記録
- [ ] 各Wave後にworker-publicミラーを同期
- [ ] エージェント実行可能なQAシナリオを全タスクに含める

### Must NOT Have（Guardrails）
- [ ] `@ts-ignore`や`as any`を新規追加しない
- [ ] 型修正と動作修正を同じコミットに混ぜない
- [ ] スクリプト（`scripts/`）の`@ts-nocheck`除去は優先度を下げる
- [ ] 意図的な空catch（制御フローとして機能するもの）に無闇にログを追加しない
- [ ] `_require`パターンのESM移行は別計画とする（スコープ外）
- [ ] カードの挙動やAIの意思決定ロジックを変更しない

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES（jest + ts-jest）
- **Automated tests**: YES（TDD推奨—Wave 1でインフラ修復後、新規テスト追加）
- **Framework**: ts-jest（現代的設定に移行）
- **Diagnostics**: Wave 1-5は`false`維持、Wave 6で`true`に移行

### QA Policy
全タスクにエージェント実行可能なQAシナリオを含める。証拠は`.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`に保存。

- **Frontend/UI**: Playwright（ブラウザ起動、ゲームプレイ、スクリーンショット）
- **TUI/CLI**: Bash（tmux）— コマンド実行、出力検証
- **API/Backend**: Bash（curl）— リクエスト送信、レスポンス検証
- **Library/Module**: Bash（bun/node REPL）— 関数呼び出し、出力比較
- **Type Check**: Bash（`npx tsc --noEmit`）— 型エラー数のカウント

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (BASELINE — 計測・記録):
├── T0.1: 全テスト実行 → パス/失敗数を記録
├── T0.2: @ts-nocheck除去プローブ（capture.ts）→ エラー数見積もり
├── T0.3: console.log・空catchの分類インベントリ
├── T0.4: 現在のtscエラー数確認
└── T0.5: 未コミット変更の状態確認

Wave 1 (TEST INFRA — 基盤修復):
├── T1.1: ts-jest設定を現代的フォーマットに移行
├── T1.2: テストベースライン検証スクリプト追加
├── T1.3: tsconfig.test.jsonの修正
├── T1.4: 既存テスト失敗の文書化
└── T1.5: 新規テスト用ヘルパー・モック整備

Wave 2 (LEAF MODULES — 型安全化①):
├── T2.1: game/card-effects/ (22ファイル)
├── T2.2: game/ai/ (13ファイル)
├── T2.3: game/special-effects/ (5ファイル)
├── T2.4: game/schema/ (1ファイル)
└── T2.5: worker-publicミラー同期

Wave 3 (PIPELINE MODULES — 型安全化②):
├── T3.1: game/turn/ (4ファイル)
├── T3.2: game/logic/cards.ts, game/logic/regen.ts
├── T3.3: game/cards/selectors.ts, game/cards/target-resolver.ts
├── T3.4: game/*.ts (ルートレベル11ファイル)
└── T3.5: worker-publicミラー同期

Wave 4 (UI MODULES — 型安全化③):
├── T4.1: ui/ @ts-nocheckファイル (24ファイル)
├── T4.2: ルートレベル: ui.ts, sound-engine.ts, is-env-capable.ts
└── T4.3: worker-publicミラー同期

Wave 5 (ERROR HANDLING — 空catch修正):
├── T5.1: 空catchの分類（意図的 vs 過失）
├── T5.2: 過失catchの修正（console.warn追加）
├── T5.3: 意図的catchにコメント追加
└── T5.4: 動作変更なしの検証

Wave 6 (LOGGING CLEANUP — console.log整理):
├── T6.1: console.log分類（debug/error/user-feedback）
├── T6.2: 本番コードのdebug logをisDebugLogAvailable()で制御
├── T6.3: scripts/の意図的ログを保持
└── T6.4: worker-publicミラー同期

Wave FINAL (VERIFICATION — 最終検証):
├── F1: 計画適合監査（oracle）
├── F2: コード品質レビュー（unspecified-high）
├── F3: 実動作QA（unspecified-high + playwright）
├── F4: スコープ適合チェック（deep）
└── F5: 最終承認待ち（ユーザー）
```

### Dependency Matrix

| Wave | Tasks | Depends On | Blocks |
|------|-------|-----------|--------|
| 0 | T0.1-T0.5 | — | Wave 1-6 |
| 1 | T1.1-T1.5 | Wave 0 | Wave 2-6 |
| 2 | T2.1-T2.5 | Wave 1 | Wave 3, 5, 6 |
| 3 | T3.1-T3.5 | Wave 1 | Wave 4, 5, 6 |
| 4 | T4.1-T4.3 | Wave 3 | Wave 5, 6 |
| 5 | T5.1-T5.4 | Wave 2-4 | Wave 6 |
| 6 | T6.1-T6.4 | Wave 5 | Final |
| Final | F1-F5 | Wave 6 | — |

**並列化可能**:
- Wave 2（Leaf）とWave 3（Pipeline）は独立して並列実行可能
- Wave 5（Error）とWave 6（Logging）は技術的には独立だが、同ファイルへの変更競合を避けるため順次実行

---

## TODOs

- [x] T0.1. **ベースライン測定—全テスト実行**

  **What to do**:
  - `npm test`または`npm run test:jest -- --runInBand`を実行
  - パス数、失敗数、スキップ数を正確に記録
  - 失敗テストの一覧とエラーメッセージを保存
  - 出力を`.sisyphus/evidence/wave-0-baseline.txt`に保存

  **Must NOT do**:
  - テストコードを修正しない
  - 設定を変更しない
  - 失敗テストを無視しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: コマンド実行と出力記録のみ
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0（T0.1-T0.5並列）
  - **Blocks**: Wave 1-6
  - **Blocked By**: None

  **References**:
  - `package.json:scripts.test` — テスト実行コマンド
  - `package.json:jest` — Jest設定（非推奨`globals.ts-jest`）
  - `tsconfig.json` — TypeScript設定（`strict: true`）

  **Acceptance Criteria**:
  - [ ] テスト実行完了
  - [ ] パス/失敗/スキップ数が記録されている
  - [ ] `.sisyphus/evidence/wave-0-baseline.txt`が存在

  **QA Scenarios**:

  ```
  Scenario: テストベースラインの記録
    Tool: Bash
    Preconditions: クリーンなワークツリー
    Steps:
      1. `npm test 2>&1 | tee .sisyphus/evidence/wave-0-baseline.txt`
      2. 出力から "Test Suites: X passed, Y failed" を抽出
      3. 失敗テスト名をリストアップ
    Expected Result: ベースライン数値が記録され、後続Waveで比較可能
    Evidence: .sisyphus/evidence/wave-0-baseline.txt
  ```

  **Commit**: NO（計測のみ）

- [x] T0.2. **@ts-nocheck除去プローブ—工数見積もり**

  **What to do**:
  - `game/card-effects/capture.ts`（48行、葉モジュール）から`@ts-nocheck`を一時的に除去
  - `npx tsc --noEmit`を実行し、エラー数をカウント
  - エラーの種類（noImplicitAny, strictNullChecks等）を分類
  - 見積もり結果を`.sisyphus/evidence/wave-0-probe.md`に記録
  - プローブ後、`@ts-nocheck`を復元（またはコミットしない）

  **Must NOT do**:
  - プローブファイルをコミットしない
  - エラーを修正しない（このタスクは計測のみ）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 一時的な変更とコマンド実行
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0（T0.1-T0.5並列）
  - **Blocks**: Wave 2-4（見積もりに基づく工数調整）
  - **Blocked By**: None

  **References**:
  - `game/card-effects/capture.ts` — プローブ対象（48行、代表パターン）
  - `tsconfig.json` — strict設定の確認

  **Acceptance Criteria**:
  - [ ] プローブファイルから`@ts-nocheck`を一時除去
  - [ ] `npx tsc --noEmit`実行後のエラー数を記録
  - [ ] `.sisyphus/evidence/wave-0-probe.md`に見積もりを記載
  - [ ] プローブファイルを元に戻す

  **QA Scenarios**:

  ```
  Scenario: @ts-nocheck除去の影響計測
    Tool: Bash
    Preconditions: クリーンな状態
    Steps:
      1. `sed -i '1d' game/card-effects/capture.ts`（1行目の@ts-nocheckを削除）
      2. `npx tsc --noEmit 2>&1 | tee /tmp/tsc-errors.txt`
      3. `wc -l /tmp/tsc-errors.txt`でエラー行数をカウント
      4. `git checkout game/card-effects/capture.ts`で復元
    Expected Result: エラー数が数値として記録され、236ファイル分の見積もりが算出可能
    Evidence: .sisyphus/evidence/wave-0-probe.md
  ```

  **Commit**: NO（計測のみ）

- [x] T0.3. **console.log・空catchの分類インベントリ**

  **What to do**:
  - 全`.ts`ファイルの`console.log`を検索・分類
  - 空catchブロックを検索・分類
  - 分類：
    - `scripts/` — ツール用（意図的ログ）
    - `game/`/`ui/`/`workers/` — 本番コード（デバッグ/エラー/ユーザー向け）
  - 結果を`.sisyphus/evidence/wave-0-logging-inventory.md`に保存

  **Must NOT do**:
  - ログを削除しない
  - catchブロックを修正しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: grepと分類作業
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0（T0.1-T0.5並列）
  - **Blocks**: Wave 5, 6
  - **Blocked By**: None

  **References**:
  - `rg "console\.log\(" -g "*.ts" -n` — console.log検索
  - `rg "catch\s*\([^)]*\)\s*\{\s*\}" -g "*.ts" -n` — 空catch検索

  **Acceptance Criteria**:
  - [ ] console.logの一覧（ファイルパス、行数、内容）
  - [ ] 空catchの一覧（ファイルパス、行数）
  - [ ] 分類結果（scripts vs 本番）
  - [ ] `.sisyphus/evidence/wave-0-logging-inventory.md`が存在

  **QA Scenarios**:

  ```
  Scenario: ログ・catchのインベントリ作成
    Tool: Bash
    Preconditions: リポジトリルート
    Steps:
      1. `rg "console\.log\(" -g "*.ts" -n | sort > /tmp/console-log.txt`
      2. `rg "catch\s*\([^)]*\)\s*\{\s*\}" -g "*.ts" -n | sort > /tmp/empty-catch.txt`
      3. 各ファイルパスからscripts/か本番かを分類
    Expected Result: 完全な一覧と分類が記録される
    Evidence: .sisyphus/evidence/wave-0-logging-inventory.md
  ```

  **Commit**: NO（計測のみ）

- [x] T0.4. **未コミット変更の状態確認**

  **What to do**:
  - `git status`で未コミット変更の概要を確認
  - `git diff --stat`で変更ファイル数と規模を確認
  - 変更の性質（削除・追加・修正）を分類
  - 結果を`.sisyphus/evidence/wave-0-git-status.md`に保存

  **Must NOT do**:
  - 変更をコミットしない
  - 変更を破棄しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: gitコマンド実行のみ
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0（T0.1-T0.5並列）
  - **Blocks**: Wave 1-6（未コミット変更との競合管理）
  - **Blocked By**: None

  **References**:
  - `git status` / `git diff --stat`

  **Acceptance Criteria**:
  - [ ] 未コミットファイル数が記録されている
  - [ ] 変更の種別（追加/削除/修正）が分類されている

  **QA Scenarios**:

  ```
  Scenario: 未コミット変更の確認
    Tool: Bash
    Preconditions: リポジトリルート
    Steps:
      1. `git status --short | wc -l`で変更ファイル数をカウント
      2. `git diff --stat | tail -1`で変更行数を確認
    Expected Result: 変更規模が数値化され、計画に反映可能
    Evidence: .sisyphus/evidence/wave-0-git-status.md
  ```

  **Commit**: NO（計測のみ）

- [x] T1.1. **ts-jest設定を現代的フォーマットに移行**

  **What to do**:
  - `package.json`の`jest`セクションを修正
  - 非推奨`globals.ts-jest`を`transform`形式に移行
  - `moduleNameMapper`を見直し、`.js`拡張子の解決を適切に設定
  - `testPathIgnorePatterns`を確認・修正
  - 設定変更後、`npm test`が以前と同じ結果になることを確認

  **Must NOT do**:
  - `diagnostics: false`はこのWaveでは維持（Wave 6で有効化）
  - テストコード自体は修正しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 設定ファイルの編集のみ
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1（順次）
  - **Blocks**: Wave 2-6
  - **Blocked By**: Wave 0

  **References**:
  - `package.json:jest` — 現在の非推奨設定
  - ts-jest公式ドキュメント — 現代的な`transform`設定
  - `tsconfig.json` — TypeScript設定との整合性

  **Acceptance Criteria**:
  - [ ] `globals.ts-jest`が削除され、`transform`形式に移行
  - [ ] `npm test`がWave 0ベースラインと同じパス/失敗数
  - [ ] Jestの非推奨警告が減少または消滅

  **QA Scenarios**:

  ```
  Scenario: ts-jest設定移行後のテスト実行
    Tool: Bash
    Preconditions: Wave 0ベースラインが記録済み
    Steps:
      1. `package.json`のjest設定を編集（transform形式に）
      2. `npm test 2>&1 | tee .sisyphus/evidence/task-T1.1-test-result.txt`
      3. Wave 0ベースラインと比較
    Expected Result: パス/失敗数がベースラインと同一
    Failure Indicators: 失敗数が増加、新しいエラータイプが出現
    Evidence: .sisyphus/evidence/task-T1.1-test-result.txt
  ```

  **Commit**: YES
  - Message: `chore(test): migrate ts-jest to modern transform config`
  - Files: `package.json`

- [x] T1.2. **テストベースライン検証スクリプト追加**

  **What to do**:
  - ベースラインと現在のテスト結果を比較するスクリプトを作成
  - `scripts/compare-test-baseline.ts`（または`.js`）を作成
  - パス/失敗/スキップ数を抽出して比較
  - 回帰があれば警告を出力

  **Must NOT do**:
  - テストロジック自体は変更しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 小さなユーティリティスクリプト
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T1.1と並列可能）
  - **Parallel Group**: Wave 1
  - **Blocks**: Wave 2-6（回帰検出用）
  - **Blocked By**: Wave 0

  **References**:
  - `package.json:scripts` — スクリプト追加先

  **Acceptance Criteria**:
  - [ ] ベースライン比較スクリプトが作成される
  - [ ] `npm run test:baseline`（または類似）で実行可能
  - [ ] 回帰時に非ゼロexitコードを返す

  **QA Scenarios**:

  ```
  Scenario: ベースライン比較スクリプトの動作確認
    Tool: Bash
    Preconditions: Wave 0ベースラインが存在
    Steps:
      1. `npm run test:baseline`を実行
      2. 出力に "PASS: No regression" または "FAIL: X new failures" が含まれる
    Expected Result: ベースラインと一致する場合は成功
    Evidence: .sisyphus/evidence/task-T1.2-baseline-script.txt
  ```

  **Commit**: YES
  - Message: `chore(test): add test baseline comparison script`
  - Files: `scripts/compare-test-baseline.ts`, `package.json`

- [x] T1.3. **tsconfig.test.jsonの修正**

  **What to do**:
  - テスト用のtsconfig（存在する場合）を確認・修正
  - `include`にテストディレクトリが含まれているか確認
  - `exclude`に`node_modules`と`dist`が含まれているか確認
  - テストファイルからの型解決が正しく行われることを確認

  **Must NOT do**:
  - `strict`設定を緩和しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 設定ファイルの確認と修正
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T1.1, T1.2と並列）
  - **Parallel Group**: Wave 1
  - **Blocks**: Wave 2-6
  - **Blocked By**: Wave 0

  **References**:
  - `tsconfig.json` — 基本設定
  - `tsconfig.test.json` — テスト用設定（存在する場合）

  **Acceptance Criteria**:
  - [ ] テストファイルがTypeScriptコンパイルに含まれる
  - [ ] `npx tsc --noEmit`がテストファイルもチェック

  **QA Scenarios**:

  ```
  Scenario: tsconfig.test.jsonの検証
    Tool: Bash
    Preconditions: tsconfig.test.jsonが存在または作成済み
    Steps:
      1. `npx tsc --project tsconfig.test.json --noEmit 2>&1 | head -20`
      2. テストファイルの型エラーが出力されるか確認
    Expected Result: テストファイルも型チェック対象
    Evidence: .sisyphus/evidence/task-T1.3-tsconfig-test.txt
  ```

  **Commit**: YES
  - Message: `chore(test): fix tsconfig.test.json include paths`
  - Files: `tsconfig.test.json`（または`tsconfig.json`）

- [x] T1.4. **既存テスト失敗の文書化**

  **What to do**:
  - Wave 0で記録した失敗テストを詳細に文書化
  - 各失敗の原因を分類：
    - インポートエラー（ES module問題）
    - DI/モジュール登録エラー（TurnPipeline等）
    - ロジックエラー（期待値不一致）
    - タイムアウト（E2Eテスト）
  - `.sisyphus/evidence/wave-1-known-failures.md`に記録
  - 各失敗に優先度と推定修正工数を付与

  **Must NOT do**:
  - テストコードを修正しない（文書化のみ）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 失敗分析にコードの深い理解が必要
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T1.1-T1.3と並列）
  - **Parallel Group**: Wave 1
  - **Blocks**: Wave 2-6（優先度付けに基づく修正順）
  - **Blocked By**: Wave 0

  **References**:
  - `.sisyphus/evidence/wave-0-baseline.txt` — 失敗テスト一覧
  - 各失敗テストファイル

  **Acceptance Criteria**:
  - [ ] 全失敗テストが分類されている
  - [ ] 優先度（P0-P3）が付与されている
  - [ ] `.sisyphus/evidence/wave-1-known-failures.md`が存在

  **QA Scenarios**:

  ```
  Scenario: 失敗テストの文書化品質確認
    Tool: Bash
    Preconditions: Wave 0ベースラインが存在
    Steps:
      1. `.sisyphus/evidence/wave-1-known-failures.md`を読む
      2. 各失敗に「原因」「優先度」「推定工数」が記載されているか確認
    Expected Result: 全失敗テストが文書化され、修正計画に利用可能
    Evidence: .sisyphus/evidence/wave-1-known-failures.md
  ```

  **Commit**: NO（文書化のみ）

- [x] T1.5. **新規テスト用ヘルパー・モック整備**

  **What to do**:
  - テストで共通して使用されるモック・ヘルパーを整備
  - `test/helpers/`ディレクトリを作成（存在しない場合）
  - ゲーム状態のモック生成ヘルパー
  - DIコンテナのモック設定ヘルパー
  - カード効果テスト用の共通セットアップ

  **Must NOT do**:
  - 本番コードを変更しない
  - 既存テストを壊さない

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: テストヘルパー設計にドメイン知識が必要
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T1.1-T1.4と並列）
  - **Parallel Group**: Wave 1
  - **Blocks**: Wave 2-6（新規テスト作成時に使用）
  - **Blocked By**: Wave 0

  **References**:
  - `test/` — 既存テストパターン
  - `game/` — モック対象の本番コード

  **Acceptance Criteria**:
  - [ ] テストヘルパーファイルが作成される
  - [ ] 既存テストがヘルパーを使用しても動作する
  - [ ] 新規テスト作成時に再利用可能

  **QA Scenarios**:

  ```
  Scenario: テストヘルパーの動作確認
    Tool: Bash
    Preconditions: ヘルパーファイル作成済み
    Steps:
      1. 既存テスト1件をヘルパーを使って書き換え
      2. `npm test -- 書き換えたテストファイル`を実行
    Expected Result: テストがパス
    Evidence: .sisyphus/evidence/task-T1.5-helper-test.txt
  ```

  **Commit**: YES
  - Message: `test(helpers): add test helpers and mocks for game state`
  - Files: `test/helpers/*.ts`

- [x] T2.1. **game/card-effects/ の@ts-nocheck除去（22ファイル）**

  **What to do**:
  - `game/card-effects/`以下の22ファイルから`@ts-nocheck`を除去
  - 各ファイルの型エラーを修正：
    - `_require()`パターンの型付け（モジュール宣言の追加）
    - 関数パラメータの型注釈
    - 戻り値の型注釈
    - `any`の適切な型への置換
  - 各ファイル修正後、`npx tsc --noEmit`でエラー確認
  - ファイル間の依存関係を考慮して順序付け

  **Must NOT do**:
  - `@ts-ignore`や`as any`を新規追加しない
  - カード効果の動作ロジックを変更しない
  - `_require`をESM importに置換しない（別Waveで対応）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 型注釈追加にドメイン知識が必要
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（ファイル単位で並列化可能）
  - **Parallel Group**: Wave 2
  - **Blocks**: Wave 3（game/turn/等がcard-effectsをimport）
  - **Blocked By**: Wave 1

  **References**:
  - `game/card-effects/*.ts` — 修正対象22ファイル
  - `game/logic/cards.ts` — カード型定義（import先）
  - `shared-constants.js` — 定数参照

  **Acceptance Criteria**:
  - [ ] 22ファイル全てから`@ts-nocheck`が除去
  - [ ] `npx tsc --noEmit`で新規エラーが0
  - [ ] `npm test`で回帰なし

  **QA Scenarios**:

  ```
  Scenario: card-effects型安全性確認
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. `rg "@ts-nocheck" game/card-effects/ -l | wc -l` → 0を確認
      2. `npx tsc --noEmit 2>&1 | grep "game/card-effects" | wc -l` → 0を確認
      3. `npm test 2>&1 | grep -E "(PASS|FAIL)" | tail -5`
    Expected Result: @ts-nocheckファイル数0、tscエラー0、テスト回帰なし
    Evidence: .sisyphus/evidence/task-T2.1-card-effects.txt
  ```

  **Commit**: YES（ファイルグループ単位）
  - Message: `types(card-effects): remove @ts-nocheck and add types`
  - Files: `game/card-effects/*.ts`

- [x] T2.2. **game/ai/ の@ts-nocheck除去（13ファイル）**

  **What to do**:
  - `game/ai/`以下の13ファイルから`@ts-nocheck`を除去
  - AIモジュールの型付け
  - 評価関数、戦略、行動選択の型注釈
  - `GameState`, `PlayerKey`, `Move`等の型を適切に使用

  **Must NOT do**:
  - AIの意思決定ロジックを変更しない
  - 評価関数のスコアリングを変更しない

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: AIロジックの型付けにドメイン知識が必要
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T2.1と並列可能）
  - **Parallel Group**: Wave 2
  - **Blocks**: Wave 3
  - **Blocked By**: Wave 1

  **References**:
  - `game/ai/*.ts` — 修正対象13ファイル
  - `game/logic/core.ts` — ゲーム核心型定義（存在する場合）または各ファイルで必要な型を定義

  **Acceptance Criteria**:
  - [ ] 13ファイル全てから`@ts-nocheck`が除去
  - [ ] `npx tsc --noEmit`で新規エラーが0
  - [ ] `npm test`で回帰なし

  **QA Scenarios**:

  ```
  Scenario: AIモジュール型安全性確認
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. `rg "@ts-nocheck" game/ai/ -l | wc -l` → 0を確認
      2. `npx tsc --noEmit 2>&1 | grep "game/ai" | wc -l` → 0を確認
    Expected Result: @ts-nocheckファイル数0、tscエラー0
    Evidence: .sisyphus/evidence/task-T2.2-ai.txt
  ```

  **Commit**: YES
  - Message: `types(ai): remove @ts-nocheck and add types`
  - Files: `game/ai/*.ts`

- [x] T2.3. **game/special-effects/ の@ts-nocheck除去（5ファイル）**

  **What to do**:
  - `game/special-effects/`以下の5ファイルから`@ts-nocheck`を除去
  - 特殊効果（ボム、ブリーディング等）の型付け

  **Must NOT do**:
  - 特殊効果の動作を変更しない

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 特殊効果の型付け
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T2.1, T2.2と並列）
  - **Parallel Group**: Wave 2
  - **Blocks**: Wave 3
  - **Blocked By**: Wave 1

  **References**:
  - `game/special-effects/*.ts`

  **Acceptance Criteria**:
  - [ ] 5ファイル全てから`@ts-nocheck`が除去
  - [ ] `npx tsc --noEmit`で新規エラーが0

  **QA Scenarios**:

  ```
  Scenario: special-effects型安全性確認
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. `rg "@ts-nocheck" game/special-effects/ -l | wc -l` → 0
      2. `npx tsc --noEmit 2>&1 | grep "game/special-effects" | wc -l` → 0
    Expected Result: @ts-nocheckファイル数0、tscエラー0
    Evidence: .sisyphus/evidence/task-T2.3-special-effects.txt
  ```

  **Commit**: YES
  - Message: `types(special-effects): remove @ts-nocheck and add types`
  - Files: `game/special-effects/*.ts`

- [x] T2.4. **game/schema/ の@ts-nocheck除去（1ファイル）**

  **What to do**:
  - `game/schema/`以下の1ファイルから`@ts-nocheck`を除去
  - スキーマ定義の型付け

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 1ファイルのみ
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T2.1-T2.3と並列）
  - **Parallel Group**: Wave 2
  - **Blocks**: Wave 3
  - **Blocked By**: Wave 1

  **Acceptance Criteria**:
  - [ ] 1ファイルから`@ts-nocheck`が除去
  - [ ] `npx tsc --noEmit`で新規エラーが0

  **QA Scenarios**:

  ```
  Scenario: schema型安全性確認
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. `rg "@ts-nocheck" game/schema/ -l | wc -l` → 0
    Expected Result: @ts-nocheckファイル数0
    Evidence: .sisyphus/evidence/task-T2.4-schema.txt
  ```

  **Commit**: YES
  - Message: `types(schema): remove @ts-nocheck and add types`
  - Files: `game/schema/*.ts`

- [x] T2.5. **worker-publicミラー同期**

  **What to do**:
  - `npm run worker:prepare`を実行
  - `worker-public/`の対応ファイルに同じ型修正を適用
  - ミラーが正しく同期されていることを確認

  **Must NOT do**:
  - ミラーファイルに新たな`@ts-nocheck`を追加しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: スクリプト実行と確認
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（T2.1-T2.4完了後）
  - **Parallel Group**: Wave 2
  - **Blocks**: Wave 3
  - **Blocked By**: T2.1-T2.4

  **References**:
  - `scripts/prepare-worker-assets.ts` — worker準備スクリプト
  - `worker-public/game/` — ミラー先

  **Acceptance Criteria**:
  - [ ] `npm run worker:prepare`が成功
  - [ ] `worker-public/`に`@ts-nocheck`が再導入されていない

  **QA Scenarios**:

  ```
  Scenario: worker-public同期確認
    Tool: Bash
    Preconditions: T2.1-T2.4完了
    Steps:
      1. `npm run worker:prepare`
      2. `rg "@ts-nocheck" worker-public/game/ -l | wc -l` → 0
    Expected Result: ミラーも@ts-nocheckなし
    Evidence: .sisyphus/evidence/task-T2.5-worker-sync.txt
  ```

  **Commit**: YES
  - Message: `chore(worker): sync type fixes to worker-public mirror`
  - Files: `worker-public/game/**/*`

- [x] T3.1. **game/turn/ の@ts-nocheck除去（4ファイル）**

  **What to do**:
  - `game/turn/`以下の4ファイルから`@ts-nocheck`を除去
  - ターン管理、フェーズ遷移、ターンパイプラインの型付け
  - `TurnPipeline`, `TurnState`, `Phase`等の型を適切に使用

  **Must NOT do**:
  - ターン遷移ロジックを変更しない
  - ゲーム進行の順序を変更しない

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: ターン管理はゲームの核心、型付けに深い理解が必要
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（Wave 2と並列可能）
  - **Parallel Group**: Wave 3
  - **Blocks**: Wave 4（UIがturnをimport）
  - **Blocked By**: Wave 1

  **References**:
  - `game/turn/*.ts` — 修正対象4ファイル
  - `game/turn-manager.ts` — ターン管理の型定義

  **Acceptance Criteria**:
  - [ ] 4ファイル全てから`@ts-nocheck`が除去
  - [ ] `npx tsc --noEmit`で新規エラーが0
  - [ ] `npm test`で回帰なし

  **QA Scenarios**:

  ```
  Scenario: turnモジュール型安全性確認
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. `rg "@ts-nocheck" game/turn/ -l | wc -l` → 0
      2. `npx tsc --noEmit 2>&1 | grep "game/turn" | wc -l` → 0
      3. `npm test -- --testPathPattern="turn" 2>&1 | tail -10`
    Expected Result: @ts-nocheckファイル数0、tscエラー0、テスト回帰なし
    Evidence: .sisyphus/evidence/task-T3.1-turn.txt
  ```

  **Commit**: YES
  - Message: `types(turn): remove @ts-nocheck and add types`
  - Files: `game/turn/*.ts`

- [x] T3.2. **game/logic/cards.ts と game/logic/regen.ts の@ts-nocheck除去**

  **What to do**:
  - `game/logic/cards.ts`（5,310行、核心モジュール）から`@ts-nocheck`を除去
  - `game/logic/regen.ts`から`@ts-nocheck`を除去
  - カードロジック、レジストリ、効果解決の型付け
  - 多くのファイルからimportされているため、影響範囲が大きい

  **Must NOT do**:
  - カード効果の解決順序を変更しない
  - レジストリの登録ロジックを変更しない

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 核心モジュール、広範な影響
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T3.1と並列）
  - **Parallel Group**: Wave 3
  - **Blocks**: Wave 4
  - **Blocked By**: Wave 1

  **References**:
  - `game/logic/cards.ts` — 核心カードロジック
  - `game/logic/regen.ts` — リジェネレーションロジック
  - `game/logic/core.ts` — ゲーム核心型定義（存在する場合）または各ファイルで必要な型を定義

  **Acceptance Criteria**:
  - [ ] 2ファイルから`@ts-nocheck`が除去
  - [ ] `npx tsc --noEmit`で新規エラーが0
  - [ ] `npm test`で回帰なし

  **QA Scenarios**:

  ```
  Scenario: logic/cards型安全性確認
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. `rg "@ts-nocheck" game/logic/cards.ts game/logic/regen.ts -l | wc -l` → 0
      2. `npx tsc --noEmit 2>&1 | grep "game/logic/cards" | wc -l` → 0
    Expected Result: @ts-nocheckファイル数0、tscエラー0
    Evidence: .sisyphus/evidence/task-T3.2-logic.txt
  ```

  **Commit**: YES
  - Message: `types(logic): remove @ts-nocheck from cards.ts and regen.ts`
  - Files: `game/logic/cards.ts`, `game/logic/regen.ts`

- [x] T3.3. **game/cards/selectors.ts と game/cards/target-resolver.ts の@ts-nocheck除去**

  **What to do**:
  - `game/cards/selectors.ts`から`@ts-nocheck`を除去
  - `game/cards/target-resolver.ts`から`@ts-nocheck`を除去
  - カード選択、ターゲット解決の型付け

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: カード選択ロジックの型付け
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T3.1, T3.2と並列）
  - **Parallel Group**: Wave 3
  - **Blocks**: Wave 4
  - **Blocked By**: Wave 1

  **References**:
  - `game/cards/selectors.ts`
  - `game/cards/target-resolver.ts`

  **Acceptance Criteria**:
  - [ ] 2ファイルから`@ts-nocheck`が除去
  - [ ] `npx tsc --noEmit`で新規エラーが0

  **QA Scenarios**:

  ```
  Scenario: cards selectors型安全性確認
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. `rg "@ts-nocheck" game/cards/selectors.ts game/cards/target-resolver.ts -l | wc -l` → 0
    Expected Result: @ts-nocheckファイル数0
    Evidence: .sisyphus/evidence/task-T3.3-cards-selectors.txt
  ```

  **Commit**: YES
  - Message: `types(cards): remove @ts-nocheck from selectors and target-resolver`
  - Files: `game/cards/selectors.ts`, `game/cards/target-resolver.ts`

- [x] T3.4. **game/ ルートレベルの@ts-nocheck除去（11ファイル）**

  **What to do**:
  - `game/`ルートレベルの`.ts`ファイル（11ファイル）から`@ts-nocheck`を除去
  - `game/turn-manager.ts`, `game/move-executor.js`, `game/pass-handler.js`等
  - ゲームループ、ムーブ実行、パス処理の型付け

  **Must NOT do**:
  - ゲームループの動作を変更しない
  - `.js`ファイルを`.ts`に変換しない（このWaveでは）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: ゲームループは最も核心部分
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T3.1-T3.3と並列）
  - **Parallel Group**: Wave 3
  - **Blocks**: Wave 4
  - **Blocked By**: Wave 1

  **References**:
  - `game/*.ts` — ルートレベルファイル
  - `game/turn-manager.ts` — ゲームループ

  **Acceptance Criteria**:
  - [ ] 11ファイルから`@ts-nocheck`が除去
  - [ ] `npx tsc --noEmit`で新規エラーが0
  - [ ] `npm test`で回帰なし

  **QA Scenarios**:

  ```
  Scenario: gameルート型安全性確認
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. `rg "@ts-nocheck" game/*.ts -l | wc -l` → 0
      2. `npx tsc --noEmit 2>&1 | grep "^game/[^/]*\.ts" | wc -l` → 0
    Expected Result: @ts-nocheckファイル数0、tscエラー0
    Evidence: .sisyphus/evidence/task-T3.4-game-root.txt
  ```

  **Commit**: YES
  - Message: `types(game): remove @ts-nocheck from root-level files`
  - Files: `game/*.ts`

- [x] T3.5. **worker-publicミラー同期**

  **What to do**:
  - `npm run worker:prepare`を実行
  - Wave 3の修正をミラーに反映

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: スクリプト実行
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（T3.1-T3.4完了後）
  - **Parallel Group**: Wave 3
  - **Blocks**: Wave 4
  - **Blocked By**: T3.1-T3.4

  **Acceptance Criteria**:
  - [ ] `npm run worker:prepare`が成功
  - [ ] `worker-public/`に`@ts-nocheck`が再導入されていない

  **QA Scenarios**:

  ```
  Scenario: worker-public同期確認
    Tool: Bash
    Preconditions: T3.1-T3.4完了
    Steps:
      1. `npm run worker:prepare`
      2. `rg "@ts-nocheck" worker-public/game/ -l | wc -l` → 0
    Expected Result: ミラーも@ts-nocheckなし
    Evidence: .sisyphus/evidence/task-T3.5-worker-sync.txt
  ```

  **Commit**: YES
  - Message: `chore(worker): sync Wave 3 type fixes to worker-public mirror`
  - Files: `worker-public/game/**/*`

- [x] T4.1. **ui/ の@ts-nocheck除去（24ファイル）**

  **What to do**:
  - `ui/`以下の24ファイルから`@ts-nocheck`を除去
  - UIコンポーネント、イベントハンドラ、アニメーションの型付け
  - DOM操作、イベントリスナーの型注釈
  - `HTMLElement`, `Event`, `MouseEvent`等の適切な使用

  **Must NOT do**:
  - UIの見た目や動作を変更しない
  - DOM構造を変更しない

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UIコンポーネントの型付け
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（Wave 3と並列可能）
  - **Parallel Group**: Wave 4
  - **Blocks**: Wave 5, 6
  - **Blocked By**: Wave 1

  **References**:
  - `ui/*.ts` — 修正対象24ファイル
  - `ui/bootstrap.ts` — DI配線
  - `ui/animation-engine.ts` — アニメーションエンジン

  **Acceptance Criteria**:
  - [ ] 24ファイルから`@ts-nocheck`が除去
  - [ ] `npx tsc --noEmit`で新規エラーが0
  - [ ] `npm test`で回帰なし

  **QA Scenarios**:

  ```
  Scenario: UIモジュール型安全性確認
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. `rg "@ts-nocheck" ui/ -l | wc -l` → 0
      2. `npx tsc --noEmit 2>&1 | grep "^ui/" | wc -l` → 0
    Expected Result: @ts-nocheckファイル数0、tscエラー0
    Evidence: .sisyphus/evidence/task-T4.1-ui.txt
  ```

  **Commit**: YES
  - Message: `types(ui): remove @ts-nocheck and add types`
  - Files: `ui/*.ts`

- [x] T4.2. **ルートレベルファイルの@ts-nocheck除去**

  **What to do**:
  - ルートレベルの`ui.ts`, `sound-engine.ts`, `is-env-capable.ts`等から`@ts-nocheck`を除去
  - サウンドエンジン、環境判定の型付け

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 少数ファイル
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T4.1と並列）
  - **Parallel Group**: Wave 4
  - **Blocks**: Wave 5, 6
  - **Blocked By**: Wave 1

  **References**:
  - `ui.ts`, `sound-engine.ts`, `is-env-capable.ts`

  **Acceptance Criteria**:
  - [ ] ルートレベルファイルから`@ts-nocheck`が除去
  - [ ] `npx tsc --noEmit`で新規エラーが0

  **QA Scenarios**:

  ```
  Scenario: ルートレベル型安全性確認
    Tool: Bash
    Preconditions: Wave 1完了
    Steps:
      1. `rg "@ts-nocheck" ui.ts sound-engine.ts is-env-capable.ts -l | wc -l` → 0
    Expected Result: @ts-nocheckファイル数0
    Evidence: .sisyphus/evidence/task-T4.2-root-files.txt
  ```

  **Commit**: YES
  - Message: `types(root): remove @ts-nocheck from root-level files`
  - Files: `ui.ts`, `sound-engine.ts`, `is-env-capable.ts`

- [x] T4.3. **worker-publicミラー同期**

  **What to do**:
  - `npm run worker:prepare`を実行
  - Wave 4の修正をミラーに反映

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（T4.1-T4.2完了後）
  - **Parallel Group**: Wave 4
  - **Blocks**: Wave 5, 6
  - **Blocked By**: T4.1-T4.2

  **Acceptance Criteria**:
  - [ ] `npm run worker:prepare`が成功
  - [ ] `worker-public/ui/`に`@ts-nocheck`が再導入されていない

  **QA Scenarios**:

  ```
  Scenario: worker-public同期確認
    Tool: Bash
    Preconditions: T4.1-T4.2完了
    Steps:
      1. `npm run worker:prepare`
      2. `rg "@ts-nocheck" worker-public/ui/ -l | wc -l` → 0
    Expected Result: ミラーも@ts-nocheckなし
    Evidence: .sisyphus/evidence/task-T4.3-worker-sync.txt
  ```

  **Commit**: YES
  - Message: `chore(worker): sync Wave 4 type fixes to worker-public mirror`
  - Files: `worker-public/ui/**/*`

- [x] T5.1. **空catchブロックの分類（意図的 vs 過失）**

  **What to do**:
  - Wave 0で作成した空catchインベントリを使用
  - 各空catchブロックを個別に評価：
    - **意図的**: 制御フローとして機能（フォールバック、オプション機能）
    - **過失**: エラーを無視している（バグ隠蔽の可能性）
  - 分類結果を`.sisyphus/evidence/wave-5-catch-classification.md`に記録
  - 意図的なものには「なぜ空であるか」のコメントを追加

  **Must NOT do**:
  - 過失と判断したもの以外は修正しない
  - 制御フローとして機能するcatchに無闇にログを追加しない

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 各catchの文脈を理解して分類する必要がある
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（順次評価が必要）
  - **Parallel Group**: Wave 5
  - **Blocks**: T5.2, T5.3
  - **Blocked By**: Wave 2-4

  **References**:
  - `.sisyphus/evidence/wave-0-logging-inventory.md` — 空catch一覧
  - 各catchブロックの周辺コード（文脈理解のため）

  **Acceptance Criteria**:
  - [ ] 全空catchブロックが分類されている
  - [ ] 意図的/過失の比率が記録されている
  - [ ] `.sisyphus/evidence/wave-5-catch-classification.md`が存在

  **QA Scenarios**:

  ```
  Scenario: 空catch分類の品質確認
    Tool: Bash
    Preconditions: Wave 0インベントリが存在
    Steps:
      1. `.sisyphus/evidence/wave-5-catch-classification.md`を読む
      2. 各エントリに「ファイルパス」「行数」「分類」「理由」が記載されているか確認
    Expected Result: 全空catchが分類され、理由が記述されている
    Evidence: .sisyphus/evidence/wave-5-catch-classification.md
  ```

  **Commit**: NO（文書化のみ）

- [x] T5.2. **過失catchブロックの修正（console.warn追加）**

  **What to do**:
  - T5.1で「過失」と分類されたcatchブロックを修正
  - 各catchブロックに`console.warn`または`console.error`を追加
  - エラーメッセージにはコンテキスト（関数名、モジュール名）を含める
  - 例：`catch (e) { console.warn('[CardEffects] Failed to apply effect:', e); }`

  **Must NOT do**:
  - エラーを再throwしない（動作変更を最小化）
  - 制御フローとして機能するcatchは修正しない

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 多数ファイルにわたる修正
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（ファイル単位）
  - **Parallel Group**: Wave 5
  - **Blocks**: T5.4
  - **Blocked By**: T5.1

  **References**:
  - `.sisyphus/evidence/wave-5-catch-classification.md` — 過失リスト

  **Acceptance Criteria**:
  - [ ] 過失catch全てにログ出力が追加
  - [ ] `npm test`で回帰なし
  - [ ] `npx tsc --noEmit`で新規エラーが0

  **QA Scenarios**:

  ```
  Scenario: 過失catch修正確認
    Tool: Bash
    Preconditions: T5.1完了
    Steps:
      1. `rg "catch\s*\([^)]*\)\s*\{\s*\}" -g "*.ts" -n | wc -l` → 大幅減少
      2. `rg "catch\s*\([^)]*\)\s*\{[^}]*console\.(warn|error)" -g "*.ts" -n | wc -l` → 増加
    Expected Result: 空catchが減少、ログ付きcatchが増加
    Evidence: .sisyphus/evidence/task-T5.2-fixed-catches.txt
  ```

  **Commit**: YES
  - Message: `fix(error-handling): add logging to negligent empty catch blocks`
  - Files: 修正対象各ファイル

- [x] T5.3. **意図的catchブロックにコメント追加**

  **What to do**:
  - T5.1で「意図的」と分類されたcatchブロックにコメントを追加
  - 「なぜ空であるか」「何を期待しているか」を説明
  - 例：
    ```typescript
    catch (e) {
      // Intentionally empty: localStorage may be disabled in private mode
    }
    ```

  **Must NOT do**:
  - ログを追加しない
  - 動作を変更しない

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 多数ファイルにわたる修正
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T5.2と並列）
  - **Parallel Group**: Wave 5
  - **Blocks**: T5.4
  - **Blocked By**: T5.1

  **References**:
  - `.sisyphus/evidence/wave-5-catch-classification.md` — 意図的リスト

  **Acceptance Criteria**:
  - [ ] 意図的catch全てにコメントが追加
  - [ ] `npm test`で回帰なし

  **QA Scenarios**:

  ```
  Scenario: 意図的catchコメント確認
    Tool: Bash
    Preconditions: T5.1完了
    Steps:
      1. `rg "catch\s*\([^)]*\)\s*\{\s*//" -g "*.ts" -n | wc -l` → 増加
      2. サンプルファイルを読んでコメントの品質を確認
    Expected Result: 空catchに説明コメントが追加されている
    Evidence: .sisyphus/evidence/task-T5.3-commented-catches.txt
  ```

  **Commit**: YES
  - Message: `docs(error-handling): document intentional empty catch blocks`
  - Files: 修正対象各ファイル

- [x] T5.4. **動作変更なしの検証**

  **What to do**:
  - Wave 5の修正後、テストを実行して回帰がないことを確認
  - ベースラインと比較
  - 新規console.warnが意図的に出力されることを確認（テスト時には出ないようにモック化）

  **Must NOT do**:
  - テストコードを修正しない（このタスクでは）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: テスト実行と比較
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（T5.2-T5.3完了後）
  - **Parallel Group**: Wave 5
  - **Blocks**: Wave 6
  - **Blocked By**: T5.2-T5.3

  **Acceptance Criteria**:
  - [ ] `npm test`でベースラインと同じパス/失敗数
  - [ ] 新規console.warnがテスト実行時に出力されない（または出力されても問題ない）

  **QA Scenarios**:

  ```
  Scenario: Wave 5回帰テスト
    Tool: Bash
    Preconditions: T5.2-T5.3完了
    Steps:
      1. `npm test 2>&1 | tee .sisyphus/evidence/task-T5.4-test-result.txt`
      2. Wave 0ベースラインと比較
    Expected Result: パス/失敗数がベースラインと同一
    Evidence: .sisyphus/evidence/task-T5.4-test-result.txt
  ```

  **Commit**: NO（検証のみ）

- [x] T6.1. **console.logの分類（debug/error/user-feedback）**

  **What to do**:
  - Wave 0で作成したconsole.logインベントリを使用
  - 各console.logを分類：
    - **debug**: 開発時のみ必要（`[DEBUG]`プレフィックス等）
    - **error**: エラーパスでの出力
    - **user-feedback**: ユーザー向けメッセージ（scripts/の進捗表示等）
    - **removable**: 明らかに不要
  - 分類結果を`.sisyphus/evidence/wave-6-log-classification.md`に記録

  **Must NOT do**:
  - ログを削除しない（このタスクでは分類のみ）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 多数のログを個別に評価
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（順次評価）
  - **Parallel Group**: Wave 6
  - **Blocks**: T6.2-T6.4
  - **Blocked By**: Wave 5

  **References**:
  - `.sisyphus/evidence/wave-0-logging-inventory.md` — console.log一覧

  **Acceptance Criteria**:
  - [ ] 全console.logが分類されている
  - [ ] 各カテゴリの数が記録されている
  - [ ] `.sisyphus/evidence/wave-6-log-classification.md`が存在

  **QA Scenarios**:

  ```
  Scenario: console.log分類品質確認
    Tool: Bash
    Preconditions: Wave 0インベントリが存在
    Steps:
      1. `.sisyphus/evidence/wave-6-log-classification.md`を読む
      2. 各エントリに「ファイルパス」「行数」「分類」「理由」が記載されているか確認
    Expected Result: 全console.logが分類されている
    Evidence: .sisyphus/evidence/wave-6-log-classification.md
  ```

  **Commit**: NO（文書化のみ）

- [x] T6.2. **本番コードのdebug logをisDebugLogAvailable()で制御**

  **What to do**:
  - T6.1で「debug」と分類された本番コード（`game/`, `ui/`, `workers/`）のconsole.logを修正
  - `isDebugLogAvailable()`または`isDebugSessionEnabled()`で囲む
  - 例：
    ```typescript
    if (isDebugLogAvailable()) {
      console.log('[DEBUG] Card drawn:', card.name);
    }
    ```
  - `game/cpu-turn-handler.ts`内の`isDebugLogAvailable()`パターンを参考に（行236, 1354, 1466, 1601, 1662付近）

  **Must NOT do**:
  - `scripts/`のログは修正しない（ツール用なので）
  - エラーパスのログは修正しない

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 多数ファイルにわたる修正
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（ファイル単位）
  - **Parallel Group**: Wave 6
  - **Blocks**: T6.4
  - **Blocked By**: T6.1

  **References**:
  - `.sisyphus/evidence/wave-6-log-classification.md` — debugリスト
  - `game/cpu-turn-handler.ts` — 既存のデバッグフラグパターン（行236, 1354, 1466, 1601, 1662付近）

  **Acceptance Criteria**:
  - [ ] 本番コードのdebug log全てがフラグ制御下
  - [ ] `npm test`で回帰なし
  - [ ] `npx tsc --noEmit`で新規エラーが0

  **QA Scenarios**:

  ```
  Scenario: debug log制御確認
    Tool: Bash
    Preconditions: T6.1完了
    Steps:
      1. `rg "console\.log\(" game/ ui/ workers/ -g "*.ts" -n | wc -l` → 大幅減少
      2. `rg "isDebugLogAvailable\(\)" game/ ui/ workers/ -g "*.ts" -n | wc -l` → 増加
    Expected Result: 無条件console.logが減少、フラグ制御が増加
    Evidence: .sisyphus/evidence/task-T6.2-debug-gated.txt
  ```

  **Commit**: YES
  - Message: `refactor(logging): gate debug logs behind isDebugLogAvailable()`
  - Files: `game/**/*.ts`, `ui/**/*.ts`, `workers/**/*.ts`

- [x] T6.3. **scripts/の意図的ログを保持・整理**

  **What to do**:
  - `scripts/`のconsole.logを確認
  - 進捗表示・ユーザー向けフィードバックは保持
  - 明らかに不要なデバッグログは削除またはフラグ制御
  - CLIツールの使い勝手を損なわない

  **Must NOT do**:
  - ユーザー向け進捗表示を削除しない
  - スクリプトの動作を変更しない

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: scripts/は比較的少ない
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（T6.2と並列）
  - **Parallel Group**: Wave 6
  - **Blocks**: T6.4
  - **Blocked By**: T6.1

  **References**:
  - `.sisyphus/evidence/wave-6-log-classification.md` — scriptsリスト

  **Acceptance Criteria**:
  - [ ] scripts/のログが整理されている
  - [ ] CLIツールが正常に動作

  **QA Scenarios**:

  ```
  Scenario: scriptsログ整理確認
    Tool: Bash
    Preconditions: T6.1完了
    Steps:
      1. `node scripts/preview-file.ts`等を実行
      2. 進捗表示が正常に出力されることを確認
    Expected Result: CLIツールの出力が整理され、使い勝手が損なわれない
    Evidence: .sisyphus/evidence/task-T6.3-scripts-log.txt
  ```

  **Commit**: YES
  - Message: `refactor(scripts): clean up debug logging in CLI tools`
  - Files: `scripts/*.ts`

- [x] T6.4. **worker-publicミラー同期**

  **What to do**:
  - `npm run worker:prepare`を実行
  - Wave 6の修正をミラーに反映

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO（T6.2-T6.3完了後）
  - **Parallel Group**: Wave 6
  - **Blocks**: Final Verification
  - **Blocked By**: T6.2-T6.3

  **Acceptance Criteria**:
  - [ ] `npm run worker:prepare`が成功
  - [ ] `worker-public/`にconsole.logが残っていない（またはフラグ制御下）

  **QA Scenarios**:

  ```
  Scenario: worker-public同期確認
    Tool: Bash
    Preconditions: T6.2-T6.3完了
    Steps:
      1. `npm run worker:prepare`
      2. `rg "console\.log\(" worker-public/ -g "*.ts" -n | wc -l` → 0またはフラグ制御下
    Expected Result: ミラーもログ整理済み
    Evidence: .sisyphus/evidence/task-T6.4-worker-sync.txt
  ```

  **Commit**: YES
  - Message: `chore(worker): sync Wave 6 logging fixes to worker-public mirror`
  - Files: `worker-public/**/*`

---

## Final Verification Wave

> **4つのレビューエージェントを並列実行。全てが承認する必要あり。**
> 結果をユーザーに提示し、明示的な「OK」を得てから完了とする。

- [ ] F1. **計画適合監査** — `oracle`

  **What to do**:
  - 計画を end-to-end で読み込む
  - 各「Must Have」に対して実装が存在するか検証（ファイル読み込み、エンドポイントcurl、コマンド実行）
  - 各「Must NOT Have」に対して禁止パターンが存在しないか検索
  - `.sisyphus/evidence/`に証拠ファイルが存在するか確認
  - 成果物を計画と比較

  **Acceptance Criteria**:
  - [ ] `@ts-nocheck`ファイル数: 236 → 0
  - [ ] 空catchブロック: 200+ → 0（全てログまたはコメント付き）
  - [ ] 本番console.log: 424 → 0（デバッグフラグ制御または削除）
  - [ ] worker-publicミラー: 同期済み

  **Output**: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

  **Evidence**: `.sisyphus/evidence/final-audit-oracle.md`

- [ ] F2. **コード品質レビュー** — `unspecified-high`

  **What to do**:
  - `tsc --noEmit` + linter + `npm test`を実行
  - 変更ファイルをレビュー：`as any`/`@ts-ignore`、空catch、console.log、コメントアウトコード、未使用import
  - AIスロップチェック：過剰コメント、過度抽象化、ジェネリック名（data/result/item/temp）

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` → 0エラー
  - [ ] `npm test` → ベースライン以上のパス率
  - [ ] `npm run build:ts` → 成功
  - [ ] 新規`as any`/`@ts-ignore`が0

  **Output**: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

  **Evidence**: `.sisyphus/evidence/final-quality-review.md`

- [ ] F3. **実動作QA** — `unspecified-high`（+ `playwright` skill）

  **What to do**:
  - クリーンな状態から開始
  - 全WaveのQAシナリオを実行（正確な手順で）
  - クロスWave統合テスト（機能同士の連携）
  - エッジケース：空状態、無効入力、高速アクション
  - Playwrightでブラウザスモークテスト：
    1. `npm run serve`でサーバー起動
    2. ブラウザでゲームにアクセス
    3. タイトル画面が表示される
    4. ゲーム開始が可能
    5. カードが引ける
    6. 石が置ける
  - 証拠を`.sisyphus/evidence/final-qa/`に保存

  **Acceptance Criteria**:
  - [ ] ブラウザでゲームが正常に起動
  - [ ] タイトル画面が表示
  - [ ] ゲーム開始可能
  - [ ] カード効果が発動
  - [ ] 勝敗判定が正常

  **Output**: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

  **Evidence**: `.sisyphus/evidence/final-qa/`（スクリーンショット等）

- [ ] F4. **スコープ適合チェック** — `deep`

  **What to do**:
  - 各タスクについて「What to do」を読み、実際のdiff（git log/diff）を確認
  - 1:1で適合しているか検証：
    - 仕様に書いたものが全て実装されている（不足なし）
    - 仕様にないものが実装されていない（スコープクリープなし）
  - 「Must NOT do」遵守確認
  - クロスタスク汚染検出：Task NがTask Mのファイルを触っていないか
  - 未説明の変更を検出

  **Acceptance Criteria**:
  - [ ] 全タスクが仕様通りに実装
  - [ ] スコープクリープが0
  - [ ] 未説明の変更が0

  **Output**: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

  **Evidence**: `.sisyphus/evidence/final-scope-check.md`

- [ ] F5. **ユーザー最終承認**

  **What to do**:
  - F1-F4の結果を統合してユーザーに提示
  - 各レビューのVERDICTを明記
  - 残存する既知の問題（Wave 0のベースライン失敗等）を開示
  - ユーザーから明示的な「OK」を得る

  **Must NOT do**:
  - ユーザー承認なしに完了しない

  **Acceptance Criteria**:
  - [ ] ユーザーが全レビュー結果を確認
  - [ ] ユーザーが「OK」を明示的に発言

  **Output**: `User Approval: [YES/NO with feedback]`

---

## Commit Strategy

### Wave 0
- コミットなし（計測のみ）

### Wave 1
- `chore(test): migrate ts-jest to modern transform config`
- `chore(test): add test baseline comparison script`
- `chore(test): fix tsconfig.test.json include paths`
- `test(helpers): add test helpers and mocks for game state`

### Wave 2
- `types(card-effects): remove @ts-nocheck and add types`
- `types(ai): remove @ts-nocheck and add types`
- `types(special-effects): remove @ts-nocheck and add types`
- `types(schema): remove @ts-nocheck and add types`
- `chore(worker): sync type fixes to worker-public mirror`

### Wave 3
- `types(turn): remove @ts-nocheck and add types`
- `types(logic): remove @ts-nocheck from cards.ts and regen.ts`
- `types(cards): remove @ts-nocheck from selectors and target-resolver`
- `types(game): remove @ts-nocheck from root-level files`
- `chore(worker): sync Wave 3 type fixes to worker-public mirror`

### Wave 4
- `types(ui): remove @ts-nocheck and add types`
- `types(root): remove @ts-nocheck from root-level files`
- `chore(worker): sync Wave 4 type fixes to worker-public mirror`

### Wave 5
- `fix(error-handling): add logging to negligent empty catch blocks`
- `docs(error-handling): document intentional empty catch blocks`

### Wave 6
- `refactor(logging): gate debug logs behind isDebugLogAvailable()`
- `refactor(scripts): clean up debug logging in CLI tools`
- `chore(worker): sync Wave 6 logging fixes to worker-public mirror`

---

## Success Criteria

### Verification Commands
```bash
# TypeScript型チェック（最終的な目標）
npx tsc --noEmit
# Expected: 0 errors, 0 warnings

# テスト実行
npm test
# Expected: パス率 >= Wave 0ベースライン

# ビルド
npm run build:ts
# Expected: 成功

# workerミラー同期
npm run worker:prepare
# Expected: 成功

# サーバー起動確認
npm run serve
# Expected: エラーなしで起動

# @ts-nocheck残存確認
rg "@ts-nocheck" -g "*.ts" -l | wc -l
# Expected: 0

# 空catch残存確認（コメント付きはOK）
rg "catch\s*\([^)]*\)\s*\{\s*\}" -g "*.ts" -n | wc -l
# Expected: 0

# 本番コードの無条件console.log確認
rg "console\.log\(" game/ ui/ workers/ -g "*.ts" -n | wc -l
# Expected: 0
```

### Final Checklist
- [ ] 全「Must Have」が実装済み
- [ ] 全「Must NOT Have」が遵守済み
- [ ] `@ts-nocheck`ファイル数: 0
- [ ] テストパス率: ベースライン以上
- [ ] `npx tsc --noEmit`: 0エラー
- [ ] `npm run build:ts`: 成功
- [ ] `npm run worker:prepare`: 成功
- [ ] Playwrightスモークテスト: 通過
- [ ] ユーザー承認: 取得済み

---

## リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| `@ts-nocheck`除去で数千の型エラーが発生 | Wave 2-4が停滞 | Wave 0でプローブを実施、工数を見積もってから調整 |
| 未コミット変更（2,848ファイル）との競合 | マージコンフリクト | Wave 0で状態を確認、必要に応じてユーザーに確認 |
| テスト失敗のベースラインが高い | 回帰検出が困難 | Wave 1で既存失敗を文書化、新規失敗のみをブロッカーとする |
| `_require`パターンの型付けが困難 | 一部ファイルが型安全化不可 | モジュール宣言ファイル（`.d.ts`）を追加して対応 |
| worker-publicミラー同期の失敗 | デプロイ障害 | 各Wave後に必ず`npm run worker:prepare`を実行 |
| 空catchの意図的/過失判断ミス | 制御フロー破壊 | 各catchを個別に評価、不明な場合はユーザー確認 |

---

## 工数見積もり

| Wave | タスク数 | 予想工数 | 並列化 |
|------|---------|---------|--------|
| Wave 0 | 5 | 1日 | 並列 |
| Wave 1 | 5 | 2日 | 並列 |
| Wave 2 | 5 | 5日 | 並列（ファイル単位） |
| Wave 3 | 5 | 5日 | Wave 2と並列 |
| Wave 4 | 3 | 4日 | Wave 3と並列 |
| Wave 5 | 4 | 3日 | 並列（ファイル単位） |
| Wave 6 | 4 | 2日 | 並列（ファイル単位） |
| Final | 5 | 1日 | 並列 |
| **合計** | **36** | **約4-6週間** | — |

**並列化効果**: Wave 2とWave 3を並列化することで、約30%の工期短縮が可能

---

## 付録: コマンドリファレンス

```bash
# @ts-nocheckファイル数確認
rg "@ts-nocheck" -g "*.ts" -l | wc -l

# 空catchブロック検索
rg "catch\s*\([^)]*\)\s*\{\s*\}" -g "*.ts" -n

# console.log検索
rg "console\.log\(" -g "*.ts" -n

# TypeScriptエラー数確認
npx tsc --noEmit 2>&1 | wc -l

# テスト実行
npm test

# ビルド
npm run build:ts

# workerミラー同期
npm run worker:prepare

# サーバー起動
npm run serve
```

