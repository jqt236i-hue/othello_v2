# TypeScript移行完了宣言・残存JSファイル許容リスト

> **Status**: 完了（2026-05-15）
> **基準コミット**: `efff49c`
> **対象リポジトリ**: カードリバーシ（card-reversi）

## 1. 目的

本ドキュメントは、JavaScriptからTypeScriptへの移行を「完了」と宣言し、残存する`.js`ファイルを正式に許容リスト化するものである。

**完了の定義**: 「すべての`.js`が消える」ではなく、「production sourceのTS正本性が確保され、残存する`.js`は互換性・生成物・ツール用途として正当化されている」状態とする。

## 2. 移行完了の証明

### 2.1 主要課題（R1-R4）の解消

| 課題ID | 内容 | 状態 | 証拠 |
|--------|------|------|------|
| R1 | `game.guard-will` のdeterministic PRNG注入型エラー | ✅ 解消 | 11/11 PASS |
| R2 | `game.position-swap-will` の `permaProtectedStones` 期待値不一致 | ✅ 解消 | 6/6 PASS |
| R3 | `ui/` 下のsource-sibling `.js` import 27件 | ✅ 解消 | 0件に減少 |
| R4 | Jestが`.ts`を優先解決しglobal mock注入が効かない | ✅ 解消 | テスト安定化 |

### 2.2 検証結果

```bash
npm run typecheck    # PASS ✅
npm run build:ts     # PASS ✅
npm run checkall     # PASS ✅（JS inventory gate含む）
npm run worker:prepare # PASS ✅
```

## 3. 残存JSファイルの分類

### 3.1 全体サマリ

| カテゴリ | 件数 | 性質 | 対応要否 |
|----------|------|------|----------|
| **dist-wrapper** | 366件 | TS正本への互換forwarding層 | 不要。消すと互換性破壊 |
| **generated** | 4件 | ビルド・生成ツールの出力 | 不要。generatorで管理 |
| **legacy-implementation** | 30件 | Node.jsツール・デバッグ・検証スクリプト | 不要。実行環境が異なる |
| **test-or-tooling** | 3件 | テストファイル | 不要。テスト基盤として正当化 |
| **合計** | **400件** | - | - |

※ `dist-wrapper`は348件→366件に増加（unknownからの再分類18件を含む）

### 3.2 dist-wrapper（366件）

**定義**: 対応する`.ts`ファイルがあり、`module.exports = require("../dist/...")` または同等のforwardingを行う互換性層。

**代表例**:
- `game/move-executor.js` → `dist/game/move-executor.js`
- `ui/bootstrap.js` → `dist/ui/bootstrap.js`
- `shared/deck-codec.js` → `dist/shared/deck-codec.js`

**残存理由**:
- ブラウザ起動時の`entry-browser.js`が`.js`を直接読み込む
- Node.jsスクリプトが`require("./game/foo.js")`で読み込む
- Jestが`moduleFileExtensions`で`.js`を解決する
- Worker（`worker-public/`）が`.js`を必要とする

**今後の方針**: 維持。削除は互換性破壊を伴う。

### 3.3 generated（4件）

**定義**: ビルド・生成ツールによって自動生成される`.js`ファイル。

| ファイル | 行数 | 生成元 | 残存理由 |
|----------|------|--------|----------|
| `cards/catalog.js` | 835 | `cards/catalog.json` | ブラウザ向けカタログデータ。`scripts/generate-catalog.js`で生成 |
| `cards/catalog.generated.js` | 671 | `cards/catalog.json` | 同上（別フォーマット） |
| `shared/gacha-hand-catalog.generated.js` | 134 | `scripts/generate-gacha-hand-catalog.js` | ガチャハンドカタログデータ |
| `shared/observation-gacha-catalog.generated.js` | 255 | `scripts/generate-observation-gacha-catalog.js` | 観測ガチャカタログデータ |

**今後の方針**: 維持。生成元の`.json`/`.ts`を正本とし、`.js`は生成物として管理。

### 3.4 legacy-implementation（27件）

**定義**: Node.js環境で実行されるツール・デバッグ・検証スクリプト。ブラウザゲームの実行経路には含まれない。

**内訳**:

#### ブート・検証スクリプト（9件）
`scripts/browser-boot-smoke.js`, `scripts/clean-dist-require.js`, `scripts/compare-test-baseline.js`, `scripts/debug-single.js`, `scripts/dedup-require.js`, `scripts/find-initdom.js`, `scripts/remove-fn-require.js`, `scripts/remove-local-require.js`, `scripts/validate-single.js`

**残存理由**: 過去の移行作業で使用した一時的なデバッグ・検証スクリプト。現在は使用されていない可能性が高いが、削除は別途検討。

#### ツール・ユーティリティスクリプト（7件）
`scripts/add-module-tracking.js`, `scripts/check-registry-content.js`, `scripts/check-registry-content2.js`, `scripts/cross-ref-scripts.js`, `scripts/serve-with-fallback.js`, `scripts/test-json.js`, `scripts/validate-registry.js`

**残存理由**: Node.js環境で実行される開発・検証ツール。ゲームの実行経路には含まれない。

**今後の方針**: 現状維持。新規のlegacy-implementationを`scripts/`下に追加する場合は、許可制とする。

### 3.5 test-or-tooling（3件）

**定義**: Jestテストファイル。

| ファイル | 行数 | 内容 |
|----------|------|------|
| `game/ai/__tests__/test-endgame-solver.test.js` | 85 | EndgameSolverのユニットテスト |
| `game/ai/__tests__/test-gumbel-mcts.test.js` | 92 | GumbelMCTSのユニットテスト |
| `scripts/__tests__/test-sprt.test.js` | 59 | SPRTのユニットテスト |

**残存理由**: テスト基盤として必要。`.test.js`はJestによって実行される。

**今後の方針**: 新規テストは`.test.ts`で作成することを推奨。既存の`.test.js`は現状維持。

## 4. unknownファイルの再分類結果

2026-05-08の調査により、unknown 52件を以下のように再分類した：

| 新分類 | 件数 | ファイル例 |
|--------|------|------------|
| **generated** | 1 | `cards/catalog.js` |
| **dist-wrapper** | 18 | `game/src/types/*.js`, `src/*.js`, `game/card-effects-applier.js`, `ui/event-handlers.js` |
| **test-or-tooling** | 3 | `game/ai/__tests__/*.test.js`, `scripts/__tests__/test-sprt.test.js` |
| **legacy-implementation** | 30 | `scripts/`下のツール・デバッグスクリプト |

### 4.1 再分類の詳細

#### generated（1件）
- `cards/catalog.js` (835行) → **generated**
  - 理由: `// Auto-generated from cards/catalog.json` と明記されている

#### dist-wrapper（18件）

**型定義shim（15件）**:
- `game/src/types/card.js` (6行) → **dist-wrapper**
  - 理由: 型定義の空shim。対応TS（`game/src/types/card.ts`）が存在する
- `game/src/types/events.js` (6行) → **dist-wrapper**
- `game/src/types/game.js` (6行) → **dist-wrapper**
- `game/cards/src/types/card.js` (6行) → **dist-wrapper**
- `game/cards/src/types/events.js` (6行) → **dist-wrapper**
- `game/cards/src/types/game.js` (6行) → **dist-wrapper**
- `game/logic/src/types/card.js` (6行) → **dist-wrapper**
- `game/logic/src/types/events.js` (6行) → **dist-wrapper**
- `game/logic/src/types/game.js` (6行) → **dist-wrapper**
- `src/types/card.js` (6行) → **dist-wrapper**
- `src/types/events.js` (6行) → **dist-wrapper**
- `src/types/game.js` (6行) → **dist-wrapper**
- `src/card.js` (6行) → **dist-wrapper**
- `src/events.js` (6行) → **dist-wrapper**
- `src/game.js` (6行) → **dist-wrapper**

**互換性shim（3件）**:
- `src/shared-constants.js` (5行) → **dist-wrapper**
  - 理由: `module.exports = require('../shared-constants')` と明記されているshim
- `game/card-effects-applier.js` (9行) → **dist-wrapper**
  - 理由: `// Shim for split card effect handlers` と明記されている
- `ui/event-handlers.js` (9行) → **dist-wrapper**
  - 理由: `// Shim for split UI handlers` と明記されている

#### test-or-tooling（3件）
- `game/ai/__tests__/test-endgame-solver.test.js` (85行) → **test-or-tooling**
  - 理由: Jestテストファイル
- `game/ai/__tests__/test-gumbel-mcts.test.js` (92行) → **test-or-tooling**
  - 理由: Jestテストファイル
- `scripts/__tests__/test-sprt.test.js` (59行) → **test-or-tooling**
  - 理由: Jestテストファイル

#### legacy-implementation（整理後の現存ファイル）
`scripts/`下のツール・デバッグスクリプト：
- `scripts/add-module-tracking.js` (56行) → **legacy-implementation**
  - 理由: Playwrightを使ったモジュール追跡ツール
- `scripts/check-registry-content.js` (41行) → **legacy-implementation**
- `scripts/check-registry-content2.js` (33行) → **legacy-implementation**
- `scripts/cross-ref-scripts.js` (46行) → **legacy-implementation**
- `scripts/serve-with-fallback.js` (7行) → **legacy-implementation**
  - 理由: `dist/scripts/serve-with-fallback` を読むwrapperだが、Node.js専用
- `scripts/test-json.js` (47行) → **legacy-implementation**
- `scripts/validate-registry.js` (66行) → **legacy-implementation**

## 5. 今後の方針・ガバナンス

### 5.1 新規JSファイルの追加ポリシー

| カテゴリ | 許可 | 条件 |
|----------|------|------|
| **dist-wrapper** | ✅ 許可 | TS正本が存在し、`module.exports = require("../dist/...")` の形式 |
| **generated** | ✅ 許可 | 生成ツール（`scripts/generate-*.js`）による自動生成のみ |
| **legacy-implementation** | ⚠️ 制限 | `scripts/`下のみ。事前承認制 |
| **test-or-tooling** | ⚠️ 制限 | 新規テストは`.test.ts`を推奨 |
| **unknown** | ❌ 禁止 | 許容リストに追加する前に分類必須 |

### 5.2 監視ゲート

`npm run checkall` に統合されている `inventory-js-legacy` ゲートにより、以下を監視する：

- `game/` 下の新規unwrapped high-risk `.js` ファイルの検出
- `unknown` カテゴリのファイル増加の検出
- `legacy-implementation` の件数増加の検出

### 5.3 定期レビュー

- **頻度**: 四半期ごと（または大きなリリースのたび）
- **内容**: 
  - 許容リストの見直し
  - 未使用のlegacy-implementationの削除検討
  - dist-wrapperの削減可能性の検討（互換性維持の前提）

## 6. 関連ドキュメント

- `docs/plans/typescript-migration-completion-plan-2026-05-07.md` - 移行完了計画書
- `docs/plans/typescript-migration-residual-fix-plan-2026-05-07.md` - 残課題解消計画書
- `docs/architecture-contracts.md` - 内部アーキテクチャ契約
- `scripts/inventory-js-legacy.ts` - JSファイル分類スクリプト

## 7. 変更履歴

| 日付 | 変更内容 | 担当 |
|------|----------|------|
| 2026-05-08 | 初版作成。unknown 52件の調査・再分類を実施 | Prometheus |
| 2026-05-08 | TS移行完了を宣言。R1-R4解消を確認 | Prometheus |
| 2026-05-09 | 不要なlegacy-implementationスクリプト25件を削除し、allowlistを更新 | Prometheus |
| 2026-05-15 | 削除済みJSのallowlist記載を整理 | Codex |
