# TypeScript移行完了宣言・残存JSファイル許容リスト

> **Status**: 完了（再監査済み: 2026-05-23）
> **基準コミット**: `bb4905044`
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

2026-05-23 の再監査では、TypeScript移行後のruntime adapter回帰を修正したうえで、以下を確認した。

```bash
npm run build:ts                         # PASS ✅
npm run typecheck -- --pretty false      # PASS ✅
npm run checkall                         # PASS ✅
npm run test:network:parity              # PASS ✅（24 suites / 275 tests）
npm run test:jest                        # PASS ✅（399 suites / 2818 tests）
git diff --check                         # PASS ✅
```

この時点で `checkall` は、未許可 `@ts-nocheck` 0、unknown / legacy-implementation JS 0、source-of-truth `game/` 内の禁止 `globalThis` / `window` runtime coupling 0 を確認している。

## 3. 残存JSファイルの分類

### 3.1 全体サマリ

| カテゴリ | 件数 | 性質 | 対応要否 |
|----------|------|------|----------|
| **dist-wrapper** | 321件 | TS正本への互換forwarding層 | 不要。消すと互換性破壊 |
| **generated** | 5件 | ビルド・生成ツールの出力 | 不要。generatorで管理 |
| **node-cli-adapter** | 64件 | Node CLIから`dist/scripts/*`へ委譲する薄いadapter | 不要。CLI互換性維持 |
| **runtime-projection** | 25件 | classic browser/runtime互換投影 | 不要。実行面の互換性維持 |
| **legacy-implementation** | 0件 | JSだけが正本の残存実装 | 追加禁止 |
| **test-fixture** | 10件 | テスト・fixture・visual tooling | 不要。テスト基盤として正当化 |
| **合計** | **425件** | - | - |

※ 件数は `npm run checkall` 内の `inventory-js-legacy` による現行分類。

### 3.2 dist-wrapper（321件）

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

### 3.3 generated（5件）

**定義**: ビルド・生成ツールによって自動生成される`.js`ファイル。

| ファイル | 行数 | 生成元 | 残存理由 |
|----------|------|--------|----------|
| `cards/catalog.js` | 875 | `cards/catalog.json` | ブラウザ向けカタログデータ。`scripts/generate-catalog.js`で生成 |
| `cards/catalog.generated.js` | 703 | `cards/catalog.json` | 同上（別フォーマット） |
| `public/module-registry.js` | 1326 | `scripts/build-module-registry.ts` | browser bootstrapで使う自動生成モジュールレジストリ |
| `shared/gacha-hand-catalog.generated.js` | 133 | `scripts/generate-gacha-hand-catalog.js` | ガチャハンドカタログデータ |
| `shared/observation-gacha-catalog.generated.js` | 254 | `scripts/generate-observation-gacha-catalog.js` | 観測ガチャカタログデータ |

**今後の方針**: 維持。生成元の`.json`/`.ts`を正本とし、`.js`は生成物として管理。

### 3.4 legacy-implementation（0件）

**定義**: Node.js環境で実行されるツール・デバッグ・検証スクリプト。ブラウザゲームの実行経路には含まれない。

**内訳**:

#### ブート・検証スクリプト（0件）
なし

**残存理由**: 対象なし。

#### ツール・ユーティリティスクリプト（0件）
なし

**残存理由**: 対象なし。

**今後の方針**: 現状維持。新規のlegacy-implementationを`scripts/`下に追加する場合は、許可制とする。

### 3.5 test-fixture（10件）

**定義**: Jestテスト、テストhelper、visual-regression tooling。

| ファイル | 内容 |
|----------|------|
| `test/helpers/*.js` | 既存テストhelper。利用箇所が限定されるため段階的にTS化する |
| `test/e2e/e2e-runtime-helpers.js` | E2E runtime helper |
| `tests/jest.*.js`, `tests/visual-regression/*.js` | Jest setup / visual regression tooling |

**残存理由**: テスト基盤として必要。`.test.js`はTypeScript化済みで、残存 `.js` はhelper / setup / visual toolingに限定する。

**今後の方針**: 新規テストは`.test.ts`で作成することを推奨。既存のfixture用途 `.js` は現状維持。

## 4. unknownファイルの再分類結果（2026-05-08時点の監査ログ）

> 2026-07-11 更新: この節に記録された `game/src/types/**`、`game/cards/src/types/**`、`game/logic/src/types/**` のコピーは削除済みです。以下は当時の監査履歴であり、現行の許可リストではありません。

2026-05-08の調査により、unknown 52件を以下のように再分類した：

| 新分類 | 件数 | ファイル例 |
|--------|------|------------|
| **generated** | 1 | `cards/catalog.js` |
| **dist-wrapper** | 18 | `game/src/types/*.js`, `src/*.js`, `game/card-effects-applier.js`, `ui/event-handlers.js` |
| **test-or-tooling** | 3 | `game/ai/__tests__/*.test.js`, `scripts/__tests__/test-sprt.test.js`（当時） |
| **legacy-implementation** | 30 | `scripts/`下のツール・デバッグスクリプト（2026-05-08時点。現行は0件） |

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

#### test-or-tooling（3件、2026-05-08時点）
- `game/ai/__tests__/test-endgame-solver.test.js` (85行) → **test-or-tooling**
  - 理由: Jestテストファイル
- `game/ai/__tests__/test-gumbel-mcts.test.js` (92行) → **test-or-tooling**
  - 理由: Jestテストファイル
- `scripts/__tests__/test-sprt.test.js` (59行) → **test-or-tooling**
  - 理由: Jestテストファイル

※ 上記3件は履歴上の再分類結果であり、現行は対応する `.test.ts` へ移行済み。

#### legacy-implementation（整理後の現存ファイル）
なし

## 5. 今後の方針・ガバナンス

### 5.1 新規JSファイルの追加ポリシー

| カテゴリ | 許可 | 条件 |
|----------|------|------|
| **dist-wrapper** | ✅ 許可 | TS正本が存在し、`module.exports = require("../dist/...")` の形式 |
| **generated** | ✅ 許可 | 生成ツール（`scripts/generate-*.js`）による自動生成のみ |
| **legacy-implementation** | ❌ 禁止 | 新規追加不可。必要な場合はTS正本 + adapter分類にする |
| **test-fixture** | ⚠️ 制限 | 新規テストは`.test.ts`を推奨 |
| **unknown** | ❌ 禁止 | 許容リストに追加する前に分類必須 |

### 5.2 監視ゲート

`npm run checkall` に統合されている `inventory-js-legacy` ゲートにより、以下を監視する：

- `game/` 下の新規unwrapped high-risk `.js` ファイルの検出
- `unknown` カテゴリのファイル増加の検出
- `legacy-implementation` の件数増加の検出
- `*.runtime.js` の runtime projection について、対応する `.ts` 正本を持たないファイルの検出（`entry-browser.js` / `public/runtime.js` / `esbuild-banner.js` / `esbuild-footer.js` は root runtime 例外として除外）

`npm run typecheck:ts-only` は、production TypeScript正本だけを `allowJs: false` で検査する補助ゲートである。現行 runtime互換 `.js` を削除するものではなく、TS正本側がJavaScript入力に依存せず検査できることを確認するために使う。

### 5.3 定期レビュー

- **頻度**: 四半期ごと（または大きなリリースのたび）
- **内容**: 
  - 許容リストの見直し
  - legacy-implementationの再発防止
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
| 2026-05-23 | runtime adapter回帰を修正し、full Jest / network parity / migration gateで再監査。基準コミットを `bb4905044` に更新 | Codex |
| 2026-05-23 | 現行inventory件数へ追従し、runtime projection正本チェック、`allowJs: false` 補助ゲート、AI/SPRTテストのTS化を追加 | Codex |
