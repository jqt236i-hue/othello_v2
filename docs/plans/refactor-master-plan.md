# カードリバーシ 大規模リファクタリング計画書

**作成日**: 2026-04-26  
**ブランチ**: `refactor/architecture-cleanup`  
**想定期間**: 4〜6ヶ月（エージェント並列実行）  
**最終更新**: 2026-04-26

---

## 1. 概要

本計画は、カードリバーシのコードベースにおける**構造的技術的負債**を解消するための、全8フェーズからなるリファクタリングのマスタープランです。

対象となる負債は以下の4カテゴリです：

1. **アーキテクチャ契約違反**: `game/` が `ui/` に直接依存している箇所
2. **巨大ファイル・関数**: `game/logic/cards.js` (6,010行) などの多責務ファイル
3. **重複コード・命名揺れ**: `normalizePlayerKey`/`countDiscs`/`getFlipsBasic` の5〜6箇所での再実装
4. **型安全性の欠如**: JavaScriptのみで動作し、複雑な `gameState`/`cardState` の構造が型で縛られていない

---

## 2. 背景・問題定義

### 2.1 調査結果の要約

2026-04-26に実施したコードベース調査で、以下の構造問題が確認されました：

| 問題カテゴリ | 深刻度 | 影響範囲 | 具体例 |
|-------------|--------|---------|--------|
| game/ → ui/ 直接依存 | **最高** | テスト・AI学習・Worker実行 | `game/turn-manager.js:336` で `SoundEngine.init()` を直接呼び出し |
| 巨大ファイル | **最高** | 保守性・拡張性 | `game/logic/cards.js` (6,010行) にカード定義・効果・状態管理が混在 |
| 重複コード | **高** | 修正漏れ・一貫性 | `normalizePlayerKey` が5〜6箇所で再実装 |
| 命名揺れ | **高** | バグの温床 | `owner`/`player`/`black`/`white`/`1`/`-1` が混在 |
| 循環依存 | **中** | テスト困難・ESM移行阻害 | `cards/utils.js` ↔ `board_ops.js` ↔ `cards/markers.js` |
| 型安全性欠如 | **中** | 開発速度・品質 | 全コードベースがJavaScriptのみ |

### 2.2 なぜ今リファクタリングが必要か

- **ヘッドレス実行が不可能**: `game/` が `SoundEngine` や `playHandAnimation` を直接呼ぶため、Node.js/Worker環境で `game/` 単体をテスト・実行できない
- **カード追加のコスト増大**: 6,010行ファイルにカードを追加するたびに、影響範囲が予測不可能に広がる
- **修正漏れの常態化**: `countDiscs` のバグ修正を6箇所で手動で行う必要があり、修正漏れが必ず発生する構造
- **ESM/TypeScript移行の障壁**: 循環依存と `globalThis` への依存が、モダンなモジュールシステムへの移行を阻害

---

## 3. 目標

### 3.1 最終目標（6ヶ月後）

- `game/` が完全にヘッドレス化され、UI非依存で動作する
- `game/logic/cards.js` (6,010行) がカード別モジュールに分割される
- 全共通処理が `shared/` に集約され、重複コードがゼロになる
- 内部表現が `1`/`-1`（数値）に統一され、表示変換が単一ポイントに集約される
- テストカバレッジが `game/card-effects/` 以下の未カバー21ファイルを含め、80%以上になる
- TypeScript移行の布石として、JSDoc型注釈が全公開APIに付与される

### 3.2 非目標（今回のスコープ外）

- ゲームルールの変更（`01-rulebook.md` に記載の挙動は維持）
- UIデザイン・見た目の変更（Single Visual Writer契約を維持）
- ネットワークプロトコルの変更（authority/versioning契約を維持）
- カード効果の追加・削除・変更
- 完全なTypeScript移行（Phase 8で一部を見極め、継続判断）

---

## 4. ブランチ戦略

### 4.1 基本方針

- **メインブランチ**: `refactor/architecture-cleanup`
- **派生ブランチ**: `refactor/phase-N-xxx`（各Phaseごとに必要に応じて作成）
- **マージ**: 全フェーズ完了後、`refactor/architecture-cleanup` を `main` へマージ

### 4.2 コミット規約

```
[Phase-N] カテゴリ: 変更内容

- 変更の詳細
- なぜこの変更が必要か
- 影響ファイル
```

例：
```
[Phase-1] shared: normalizePlayerKey を shared/player-encoding.js に集約

- game/logic/cards/utils.js と ui/network-client.js で再実装していた
  normalizePlayerKey を削除し、shared/player-encoding.js を正本とする
- 影響: game/move-executor.js, game/card-effects/helpers.js, ui/network/action-bridge.js
```

### 4.3 中間マイルストーン

| マイルストーン | 目標日 | 完了条件 |
|---------------|--------|---------|
| M1: 安全網構築 | +1週間 | Phase 0 完了、テスト全件パス、カバレッジ測定完了 |
| M2: 基盤層整備 | +3週間 | Phase 1 完了、`shared/` が単一ソースとして機能 |
| M3: UI依存分離 | +6週間 | Phase 2 完了、`game/` がヘッドレス化 |
| M4: カード分割 | +10週間 | Phase 3 完了、`cards.js` が分割され循環依存解消 |
| M5: 命名統一 | +12週間 | Phase 4 完了、内部表現統一 |
| M6: CPU/UI整備 | +14週間 | Phase 5〜6 完了 |
| M7: テスト整備 | +16週間 | Phase 7 完了、カバレッジ80%以上 |
| M8: TypeScript | +20週間 | Phase 8 完了（または継続判断） |

---

## 5. フェーズ詳細

### Phase 0: 安全網構築（1週間）

**目的**: リファクタリング中の回帰を検出する安全網を構築する

**タスク**:
1. `npm test` 実行（439テストの現状確認）
2. `npm run test:jest:coverage` 実行（カバレッジ測定）
3. `git checkout -b refactor/architecture-cleanup` でブランチ作成
4. `docs/plans/refactor-phase0-report.md` に現状レポート作成
5. `test/refactor-safety-net.test.js` に「リファクタリング前の構造を保証するテスト」を追加（例：`game/` から `ui/` を `require` していないこと）

**エージェント割り当て**: 1体  
**完了条件**:
- `npm test` が全件パス
- `npm run checkall` がパス
- Phase 0 レポートが作成されている

---

### Phase 1: 基盤層（`shared/`）の整備（2〜3週間）

**目的**: 最下位層を単一ソース・型注釈付きの純粋層にする

**タスク**:

#### 1-1. 定数の単一ソース化
- `ui/` 層に残る `BOARD_SIZE = 8` の重複定義を削除
- `game/ai/policy-onnx-runtime.js:22` の `MAX_HAND_SIZE = 5` を削除
- `game/ai/cpu-policy-core.js`, `game/ai/policy-table-runtime.js`, `game/cpu-decision.js` の `dirs` を削除
- `game/logic/cards/clone.js`, `game/logic/cards/living_will.js` の `BLACK`/`WHITE` 再定義を削除

#### 1-2. 共通関数の集約
以下のファイルを新規作成し、全再実装箇所を置き換え：

| 新規ファイル | 統合対象 | 現状の再実装箇所 |
|-------------|---------|----------------|
| `shared/player-encoding.js` | `normalizePlayerKey`, `getPlayerKey`, `getOwner` | `utils/owner-helpers.js`, `ui/network-client.js`, `ui/network/action-bridge.js`, `game/move-executor.js`, `game/logic/cards/utils.js`, `shared/commentary-context-helpers.js` |
| `shared/board-utils.js` | `countDiscs`, `countDiscsByPlayer`, `countDiscsFromBoard` | `game/logic/core.js`, `game/network-turn-handoff.js`, `ui/result-overlay.js`, `ui/presentation-handler.js`, `shared/commentary-context-helpers.js`, `shared/shared-board-utils.js` |
| `shared/othello-core.js` | `getFlipsBasic`, `getLegalMovesBasic`, `getLegalMovesForPlayer` | `shared/shared-board-utils.js`, `game/ai/cpu-policy-core.js`, `game/ai/policy-table-runtime.js`, `src/engine/selfplay-runner.js` |
| `shared/charge-utils.js` | `normalizeChargeValue` | `ui/network/snapshot-canonical.js`, `cards/card-renderer.js` |

#### 1-3. JSDoc型注釈導入
- `shared/` 以下の全公開関数に JSDoc を付与
- `// @ts-check` を `shared/` のエントリポイントに追加
- 型定義の種を蒔く（`PlayerKey`, `Board`, `GameState`, `CardState` など）

**エージェント割り当て**: 3体並列  
**完了条件**:
- 全再実装箇所が新規 `shared/` 関数を参照している
- `rg "const BOARD_SIZE = 8"` で残り参照がゼロ
- `rg "function normalizePlayerKey"` で `shared/player-encoding.js` 以外に存在しない
- `npm test` が全件パス

---

### Phase 2: `game/` のUI依存分離（2〜3週間）

**目的**: `docs/architecture-contracts.md` §4.1 の契約を回復し、`game/` をヘッドレス化する

**タスク**:

#### 2-1. SoundEngine 分離
- `game/turn-manager.js:336` の `SoundEngine.init()` を削除
- 代わりに、`emitSoundCue` イベントを `events[]` に追加し、UI側で購読
- 影響箇所: `game/turn-manager.js`（`handleCellClick`）

#### 2-2. UIアニメーション分離
- `game/turn-manager.js:411` の `playHandAnimation()` を削除
- `game/move-executor.js:350` の `requestMoveExecutorCardUiSync()` を削除
- これらを `presentationEvents` として `events[]` に統合
- 影響箇所: `game/turn-manager.js`, `game/move-executor.js`

#### 2-3. Window/Document フラグ分離
- `game/card-effects/selection-flow.js:274` の `readLegacyBusyFlag` を削除
- busyフラグを `gameState` または `cardState` の正規プロパティとして管理
- `game/cpu-decision.js:853` の `typeof window !== 'undefined'` を削除
- 代わりに、CPU実行モードをDIで注入（`executionMode: 'browser' | 'headless'`）

#### 2-4. TimerService DI 化
- `game/turn-manager.js`, `game/cpu-turn-handler.js`, `game/cpu-decision.js`, `game/move-executor.js`, `game/pass-handler.js` の `setTimeout`/`setInterval`/`clearTimeout`/`clearInterval` を抽象化
- `shared/timer-service.js`（または `game/timer-service.js`）を作成
- ブラウザ実行時: `setTimeout` をラップ
- ヘッドレス/テスト実行時: 同期実行またはモック

**エージェント割り当て**: 4体並列  
**完了条件**:
- `rg "SoundEngine" game/` で `game/` 内に参照がゼロ
- `rg "playHandAnimation" game/` でゼロ
- `rg "typeof window" game/` でゼロ（`typeof window !== 'undefined'` のブラウザ判定のみ）
- `rg "setTimeout" game/` で `timer-service.js` 以外にゼロ
- `npm test` が全件パス
- `npm run check:window` がパス

---

### Phase 3: `game/logic/cards.js`（6,010行）の分割（3〜4週間）

**目的**: 単一責務原則に基づき、カード管理・効果解決・状態操作を分離する

**タスク**:

#### 3-1. 状態管理モジュールの抽出
```
game/logic/cards.js → 分割
├── game/cards/state-manager.js          # 手札・チャージ・マーカー管理
├── game/cards/hand-manager.js           # ドロー・手札上限・山札管理
├── game/cards/charge-manager.js         # チャージ加算・消費・ボーナス
├── game/cards/marker-manager.js         # マーカー生成・更新・削除
└── game/cards/deck-manager.js           # デッキ構築・シャッフル
```

#### 3-2. 効果解決エンジンの抽出
```
game/cards/effect-resolver.js            # 効果解決のエントリポイント
game/cards/effect-context.js             # 効果実行時のコンテキスト生成
game/cards/effect-timing.js              # ターン開始・配置時・終了時の効果タイミング
```

#### 3-3. カード別効果の分割
```
game/cards/effects/
├── treasure-box.js
├── sniper-will.js
├── protected-next-stone.js
├── swap-with-enemy.js
├── ghost-will.js
├── afterimage-will.js
├── perma-protect-next-stone.js
├── strong-wind-will.js
├── trap-will.js
├── tempt-will.js
├── capture-will.js
├── chain-will.js
├── taboo-reverse-will.js
├── regen-will.js
├── destroy-one-stone.js
├── time-bomb.js
├── time-stop-god.js
├── ultimate-reverse-dragon.js
├── breeding-will.js
├── proliferation-will.js
├── clone-will.js
├── split-will.js
├── seed-will.js
├── cross-bomb.js
├── x-bomb.js
├── hyperactive-will.js
├── instant-hyperactive-will.js
├── escape-will.js
├── robot-vacuum-will.js
├── will-hunter-king.js
├── hyperactive-inherit-will.js
├── extreme-hyperactive-will.js
├── gluttonous-will.js
├── rebuild-will.js
├── supply-will.js
├── plunder-will.js
├── work-will.js
├── ribo-will.js
├── equality-will.js
├── reinforcement-will.js
├── double-place.js
├── last-resort.js
├── heaven-blessing.js
├── condemn-will.js
├── reveal-hand-will.js
├── gold-stone.js
├── silver-stone.js
├── rainbow-stone.js
├── crystal-stone.js
├── guard-will.js
├── guardian-god.js
├── ultimate-destroy-god.js
├── destroy-dragon-will.js
└── lightning-will.js
```

#### 3-4. 循環依存の解消
- `game/logic/cards/utils.js` ↔ `game/logic/board_ops.js` ↔ `game/logic/cards/markers.js`
- 解消策: `game/cards/effects/` から `board_ops.js` を直接呼ばず、`EffectContext` 経由で操作
- `game/logic/cards/living_will.js` ↔ `game/logic/cards/work_will.js` ↔ `game/logic/board_ops.js`
- 解消策: 両ファイルを `game/cards/effects/` 下に統合または、共有依存を `EffectContext` に移行

**エージェント割り当て**: 5体並列  
**完了条件**:
- `game/logic/cards.js` が削除されている（または100行以下のファサードのみ残す）
- `npm test` が全件パス
- 新規 `game/cards/` 以下の全ファイルにユニットテストが存在する（または統合テストでカバーされている）
- `rg "require.*board_ops" game/cards/effects/` でゼロ（循環依存解消確認）

---

### Phase 4: 命名揺れの統一（1〜2週間）

**目的**: `owner`/`player`/`black`/`white`/`1`/`-1` の混在を解消し、内部表現を統一する

**タスク**:

#### 4-1. 内部表現の統一
- 内部表現を **数値 `1`（黒）/ `-1`（白）** に統一
- 表示用・ログ用の変換は `shared/player-encoding.js` で一元管理

#### 4-2. プロパティ名の統一
- `owner` → `player`（または全 `player` → `owner`）に統一
- `gameState.currentPlayer`（数値）と `cardState.hands['black']`（文字列）の混在を解消
- `move.player` → `move.playerKey`（または `move.owner`）に統一

#### 4-3. 型定義の整備
- JSDoc で `PlayerKey` 型を定義: `@typedef {'black' | 'white'} PlayerKey`
- JSDoc で `PlayerValue` 型を定義: `@typedef {1 | -1} PlayerValue`
- 全関数シグネチャを更新

**エージェント割り当て**: 2体並列  
**完了条件**:
- `rg "owner:" game/ ui/ | rg -v "//" | wc -l` で減少（基準値から50%以上減少）
- `rg "player:" game/ ui/ | rg -v "//" | wc -l` で減少
- `npm test` が全件パス

---

### Phase 5: CPU層のタイマー分離（1〜2週間）

**目的**: `cpu/` と `game/ai/` からタイマー・ブラウザAPIを排除する

**タスク**:

#### 5-1. TimerService 適用
- Phase 2 で作成した `TimerService` を `game/cpu-turn-handler.js` と `game/cpu-decision.js` に適用
- `setTimeout`/`clearTimeout` の直接呼び出しを全て `TimerService` 経由に変更

#### 5-2. ブラウザ判定の排除
- `game/ai/policy-onnx-runtime.js:337` の `fetch` を抽象化（Phase 2 と同様）
- `game/ai/policy-table-runtime.js:504,583` の `fetch` を抽象化

#### 5-3. CPU状態変更の見直し
- `cpu/cpu-turn.js:40` の `gameState = applyPass(gameState)` を確認
- `docs/architecture-contracts.md` §4.5 に「CPU logic is read-only」とあるが、実際には状態変更を伴う
- **判断**: CPUの意思決定結果を返す純粋関数にし、状態変更は `game/` 側で実行するように分離

**エージェント割り当て**: 2体並列  
**完了条件**:
- `rg "setTimeout" game/cpu* game/ai/` でゼロ
- `rg "fetch" game/ai/` で抽象化レイヤーのみ
- `npm test` が全件パス

---

### Phase 6: UI層の整理（2〜3週間）

**目的**: UI層の責務を明確にし、game/ への直接到達を防ぐ

**タスク**:

#### 6-1. bootstrap.js のDI整理
- `ui/bootstrap.js:952` の `installGameDI()` を分割
- `game/` モジュールの直接 `require` を整理し、公開APIのみを注入

#### 6-2. init.js の分割
- `ui/handlers/init.js:199` の `initializeUI`（443行）を分割
```
ui/handlers/init.js → 分割
├── ui/bootstrap/init-dom.js         # DOM要素取得
├── ui/bootstrap/init-events.js      # イベントリスナー登録
├── ui/bootstrap/init-game.js        # ゲーム初期化（game/ 公開APIのみ呼び出し）
└── ui/bootstrap/init-network.js     # ネットワーク初期化
```

#### 6-3. ゲーム状態への直接アクセスの排除
- `ui/handlers/match-mode.js:1109` の `hasRenderableState()` で `gameState`/`cardState` に直接アクセスしている箇所を、公開API経由に変更
- `ui/result-overlay.js:109` の `countDiscsFromBoardState()` を `shared/board-utils.js` の関数に置き換え

**エージェント割り当て**: 3体並列  
**完了条件**:
- `ui/bootstrap.js` の `require('../game/')` が公開APIモジュールのみになる
- `ui/handlers/init.js` の `initializeUI` が100行以下になる
- `npm test` が全件パス
- `npm run check:window` がパス

---

### Phase 7: テスト整備（継続）

**目的**: リファクタリング後のコードベースに対して、十分なテストカバレッジを確保する

**タスク**:

#### 7-1. 未カバーモジュールのテスト追加
| 対象ディレクトリ | 未カバーファイル数 | 優先度 |
|-----------------|-------------------|--------|
| `game/card-effects/` | 21ファイル | **最高** |
| `ui/network/` | 5ファイル（commentary.js, publish-tracker.js, session-lifecycle.js等） | 高 |
| `game/logic/cards-internal/` | 3ファイル（state-factory.js, presentation-helpers.js, module-resolver.js） | 高 |

#### 7-2. 分割後モジュールのユニットテスト
- Phase 3 で分割した `game/cards/*` 以下の各モジュールに対し、単体テストを作成
- `game/cards/effects/*.js` 各ファイルに対し、効果の入出力をテスト

#### 7-3. カバレッジ目標
- `game/` 全体: **80%以上**
- `shared/` 全体: **90%以上**
- `ui/network/` 全体: **70%以上**

#### 7-4. 統合テストの整備
- リファクタリング前後で「同じ入力 → 同じ出力」になることを保証する統合テスト
- 全カード効果の組み合わせテスト（ smoke test ）

**エージェント割り当て**: 4体並列（継続）  
**完了条件**:
- `npm run test:jest:coverage` でカバレッジレポートが目標値を満たす
- 全テストがパス

---

### Phase 8: TypeScript移行の布石（4〜6週間）

**目的**: JSDoc型注釈を基盤に、TypeScript移行の準備を整える

**タスク**:

#### 8-1. `tsconfig.json` の作成
- `allowJs: true`, `checkJs: true` で段階的移行
- `strict: false` から始め、段階的に厳格化

#### 8-2. `shared/` の `.ts` 化
- Phase 1 で整備した `shared/` 以下を `.ts` に移行
- 型定義ファイル `shared/types.d.ts` を作成（`GameState`, `CardState`, `PlayerKey`, `PlayerValue` など）

#### 8-3. `game/` の `.ts` 化（部分）
- `game/cards/` 以下の分割後モジュールを `.ts` に移行
- ヘッドレス化が完了しているため、ブラウザ型（`HTMLElement`, `Window` など）に依存しない

#### 8-4. 判断ポイント
- Phase 8 完了時点で、`ui/` の `.ts` 化の要否を判断
- `ui/` はブラウザ型に依存するため、移行コストが高い場合は継続フェーズとして別計画化

**エージェント割り当て**: 3体並列  
**完了条件**:
- `tsc --noEmit` がエラーなく通る（`shared/` と `game/cards/` 以下）
- `npm test` が全件パス（テストは引き続きJavaScriptで実行可）

---

## 6. エージェント割り当て・実行フロー

### 6.1 並列実行戦略

各Phaseは**依存関係がないタスクを並列**で実行します。

```
Phase 0 (1体)
  ↓
Phase 1 (3体並列: 定数統一/関数集約/JSDoc)
  ↓
Phase 2 (4体並列: SoundEngine/Animation/WindowFlag/TimerService)
  ↓
Phase 3 (5体並列: StateManager/EffectResolver/Effects/CyclicDeps/Tests)
  ↓
Phase 4 (2体並列: 内部表現統一/プロパティ名統一)
  ↓
Phase 5 (2体並列: TimerService適用/ブラウザ判定排除)
  ↓
Phase 6 (3体並列: Bootstrap/Init/StateAccess)
  ↓
Phase 7 (4体並列: テスト追加/継続)
  ↓
Phase 8 (3体並列: tsconfig/shared_ts/game_ts)
```

### 6.2 エージェント間の連携

- **進捗管理**: `docs/plans/refactor-progress.md` を更新（各エージェントが担当タスク完了時に記録）
- **衝突回避**: 同一ファイルを触る場合、エージェント1がファイルを「編集中」としてマーク（一時ファイルでロック）
- **コードレビュー**: Phase 完了時に別エージェントに検証を依頼（`test/` 実行 + コードレビュー）

### 6.3 トラブル時の対応

| 状況 | 対応 |
|------|------|
| テストが壊れる | 当該Phaseを停止し、修正エージェントを投入。Phase完了をブロック。 |
| 循環依存が解消できない | `docs/plans/refactor-blocker.md` に記録し、代替案（DI注入・イベント駆動化）を検討。 |
| 命名統一で影響範囲が広すぎる | Phase 4 を2サブフェーズに分割。内部表現統一 → プロパティ名統一。 |
| TypeScript移行で型エラーが多数発生 | `strict: false` を維持し、段階的に `strict: true` へ移行。別フェーズ化も検討。 |

---

## 7. 検証・完了条件

### 7.1 全フェーズ共通の完了条件

1. **テストパス**: `npm test` が全件パス
2. **静的チェックパス**: `npm run checkall` がパス
3. **Windowチェックパス**: `npm run check:window` がパス（game/からui/への依存がないことを確認）
4. **ドキュメント更新**: 変更が契約に影響する場合、`docs/architecture-contracts.md` を更新
5. **重複コードチェック**: `rg "function normalizePlayerKey"` などで、複数箇所に残っていないことを確認

### 7.2 最終完了条件（全フェーズ終了時）

1. `game/` ディレクトリ内で `rg "require.*ui/"` がゼロ
2. `game/` ディレクトリ内で `rg "typeof window"` がゼロ
3. `game/` ディレクトリ内で `rg "setTimeout"` が `timer-service.js` 以外でゼロ
4. `game/logic/cards.js` が削除（または100行以下）
5. `shared/` 以下に `normalizePlayerKey`, `countDiscs`, `getFlipsBasic` が集約されている
6. テストカバレッジ: `game/` 80%以上、`shared/` 90%以上
7. `docs/architecture-contracts.md` の「Known structural debts (§13)」から該当項目が削除されている

---

## 8. リスク・注意事項

### 8.1 主要リスク

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| テストが不足してリファクタリング中に回帰を検出できない | 中 | **高** | Phase 0 でテスト網羅性を確認。Phase 7 でカバレッジを上げる。 |
| cards.js (6,010行) の分割で効果が変わる | 低 | **高** | 統合テストで「前後の挙動同一性」を保証。小刻みに分割。 |
| game/ のUI依存分離で、イベント駆動化が不完全 | 中 | 中 | `events[]` の構造を事前に設計。Single Visual Writer契約を維持。 |
| 命名統一で影響範囲が予想外に広がる | 中 | 中 | `sed`/`rg` で影響範囲を事前調査。小刻みにコミット。 |
| TypeScript移行でビルドが複雑化 | 低 | 中 | `allowJs: true` で段階的移行。ビルド設定は最小限に。 |

### 8.2 絶対に避けるべきこと

- **ゲームルールの変更**: `01-rulebook.md` に記載の挙動は一切変更しない
- **UIの見た目の変更**: ユーザーが気づく変更は最小限に（リファクタリングは内部構造のみ）
- **パフォーマンスの劣化**: ベンチマークテスト（`npm run selfplay:benchmark` など）で回帰を監視
- **commit履歴の破壊**: 各Phaseごとに明確なコミットを残し、必要に応じて revert 可能にする

---

## 9. 関連ドキュメント

| ドキュメント | 役割 |
|-------------|------|
| `01-rulebook.md` | ゲームルール・挙動の一次情報。変更しない。 |
| `docs/architecture-contracts.md` | アーキテクチャ契約。変更箇所を更新する。 |
| `AGENTS.md` | 作業フロー。従う。 |
| `.github/copilot-instructions.md` | ハードルール。従う。 |
| `docs/plans/refactor-phase0-report.md` | Phase 0 の成果物。作成予定。 |
| `docs/plans/refactor-progress.md` | 進捗管理。継続更新。 |
| `docs/plans/refactor-blocker.md` | ブロッカー記録。必要に応じて作成。 |

---

## 10. 改訂履歴

| 日付 | 変更内容 | 担当 |
|------|---------|------|
| 2026-04-26 | 初版作成 | AI Agent |
