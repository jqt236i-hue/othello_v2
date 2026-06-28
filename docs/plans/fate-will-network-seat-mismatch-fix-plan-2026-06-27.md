# ネット対戦 × 運命の意志 × 対象選択カード SEAT_MISMATCH 修正計画

**作成日**: 2026-06-27
**対象**: `ui/network/`, `game/card-effects/`, `game/turn/`, `test/`, `worker-public/`
**状態**: 実装前
**起票理由**: ネット対戦モードで、`01-rulebook.md` の `運命の意志` 仕様に基づいて次の相手ターンを操作している最中、相手所有の「対象選択カード(超引力 / 超重力 / 重力 / 強風の意志 / 浮力 / 超浮力 / テレポート / 捕食 / 誘惑 / 罠 / 守護 / 反転意志 / タイムボム / 盤面拡張神 / 盤面縮小神 / 凍結 / 種 / 隕石 / 因果再生 / 自由配置 / 終盤 / 寿命延長等)」を発動して対象マスをクリックすると、`SEAT_MISMATCH` で publish が reject され、UI 上「クリックしても何も起きない」バグを修正する。

---

## 0. この文書の位置づけ

- この文書は、`SEAT_MISMATCH` で発生するネット対戦特有の操作不能バグに対する修正 implementation plan である。
- 一次仕様は `01-rulebook.md` および `正本/カード仕様正本.md` の `運命の意志`、内部契約は `docs/architecture-contracts.md`、作業導線は `AGENTS.md` に従う。
- 今回の主眼は、UI が組み立てる publish action の `actor` フィールドを「HTTP 送信元 (操作者)」と一致させ、サーバの `applyTurnSafe` 側の正規化と整合させること。
- 正本仕様 (`石置・反転・カード使用・終端消費・手札消費は相手側の行動として処理`) には変更を加えない。
- `worker-public/` は mirror。root 正本を直した上で `npm run worker:prepare` で同期する。

## 1. 対象仕様

### 確定仕様 (`正本/カード仕様正本.md` L103 抜粋)

- カード名: `運命の意志`
- コスト: `50`
- 分類: 禁戒 / 通常
- 効果: **次の相手ターンを丸ごと操作する。** ターン所有者は相手のままで、石置・反転・カード使用・終端消費・手札消費は**相手側の行動として処理**する。効果中は双方に操作中であることを表示し、被操作側の入力を無効にする。

### 派生仕様 (本計画の対象)

- サーバ権威ロジック (`game/turn/turn_pipeline_factory.ts:184-197`) は `actionPlayerKey !== currentPlayerKey` でも、FATE_WILL controller なら `effectivePipelinePlayerKey = currentPlayerKey` (所有者) に正規化して `applyTurn` を呼ぶ。
- このため、UI から publish する action の `actor` フィールド (= 内部の `effectivePipelinePlayerKey` 解決で使われないが、サーバの `processNetworkCommand` の `SEAT_MISMATCH` チェックで送信元 seat と比較される) は、**HTTP seat (操作者 = `localSeatKey`) と一致している必要がある**。

## 2. 一次情報と根拠

### 仕様正本

- `01-rulebook.md` (カードリバーシ全体仕様)
- `正本/カード仕様正本.md` (`運命の意志` の効果文)
- `正本/ターン進行正本.md` (対象選択カード使用後の手番継続条件)

### 実装根拠 (調査で特定した該当箇所)

| 用途 | パス:行 |
| --- | --- |
| UI が `actor` を resolve する中心 | `ui/network/command-payload.ts:66` |
| UI が action を所有者 playerKey で生成 | `game/card-effects/selection-flow-execution-core.ts:152`, `selection-flow.ts:775` |
| UI dispatch 経路 (所有者 playerKey で publish) | `game/turn-manager.ts:689-708`, `ui/bootstrap.ts:2230-2274` |
| per-card adapter の代表例 | `game/card-effects/strong-wind.ts:26-128` (`handleSuperAttractionSelection` など) |
| サーバ actor ≠ seat reject | `workers/match-worker.ts:1187-1189` |
| サーバの FATE_WILL controller 正規化 | `game/turn/turn_pipeline_factory.ts:184-197` |
| サーバの pending validation | `utils/match-authority.ts:2132-2183` |
| 既存テスト (FATE_WILL controller 通行) | `test/game.fate-will.test.ts:218-238` |
| 中央入力権限制御 | `utils/owner-helpers.ts:405-467` (`resolveNetworkInputPermissions`) |
| UI レンダラのクリックゲート | `ui/board-renderer.ts:1263-1308`, `ui/diff-renderer.ts:2561-2589` |
| UI ハンドラのクリックゲート | `cards/card-interaction.ts:1671-1755` |
| ハイライト表示 (projector) | `ui/diff-renderer/projector.ts:50-67` |

### 観測結果

- 通常ターン: `actor = 'black'` (所有者 = local)、HTTP seat = `'black'` (local) → 一致して通過。
- FATE_WILL 中: `actor = 'white'` (所有者)、HTTP seat = `'black'` (操作者 = local) → **不一致で `SEAT_MISMATCH`**。
- UI クリック受理判定 (`resolveNetworkInputPermissions`) は FATE_WILL 中も `canOperateBoard = true` で通過する → クリックは UI ゲートでは弾かれない。
- サーバ投影 (`utils/match-authority.ts` `projectSnapshotForViewer`) は `pendingEffectByPlayer` を viewer にそのまま渡すため、`pendingEffectByPlayer['white']` にある対象選択 pending は操作者 (black) の画面にも見える → ハイライトは表示される。
- 結果: クライアントから見ると **「クリックは受理され、ハイライトも出ているが、publish 後の応答で何も起きない (または失敗表示)」** という `SEAT_MISMATCH` の症状になる。

## 3. 目的

- FATE_WILL 効果中に、所有者の対象選択カードを発動し、対象マスをクリックして完了する操作が、UI から publish されてサーバに受理されるようにする。
- 通常ターンのカード使用・対象選択の挙動を一切壊さない。
- FATE_WILL 中の charge / hand / end-turn / カード使用の一連の正本仕様動作 (`石置・反転・カード使用・終端消費・手札消費は相手側の行動として処理`) を維持する。

## 4. 非目標

- 正本 (`01-rulebook.md` / `正本/`) の仕様変更
- `applyTurnSafe` の FATE_WILL controller 正規化ロジック (`turn_pipeline_factory.ts:184-197`) の変更
- `chargeOwnerKey` (=所有者) で `pendingEffectByPlayer[所有者]` に書き出す現行挙動 (`game/cards/effect-resolver.ts:584,869`) の変更
- サーバ側 `SEAT_MISMATCH` チェックの緩和 (案 B)
- ローカル対戦 / CPU 対戦の挙動変更
- FATE_WILL 以外のコントローラ系カードの仕様変更
- `01-rulebook.md` の文言変更

## 5. 既存調査からの結論

### 採用する修正方針: 案 A — UI 側で `actor` を HTTP seat (操作者) に揃える

| 評価軸 | 案 A (採用) | 案 B | 案 C |
| --- | --- | --- | --- |
| 概要 | UI の publish 経路で `actor` を「HTTP 送信元 (操作者)」と一致させる | サーバ側 `SEAT_MISMATCH` を「FATE_WILL controller 許容」に拡張 | `actor` の意味を「所有者」に全面統一 |
| 影響ファイル数 | 1〜2 | 1 (サーバ) | 多数 (サーバ+UI+テスト) |
| 既存テスト影響 | 小 | 中 (FATE_WILL 関連の境界条件テスト追加) | 大 |
| セキュリティリスク | 低 (actor を HTTP seat と一致させるだけ) | 中 (FATE_WILL controller 以外の actor 許容境界を厳密にテスト) | 高 |
| 工数 | 0.5 日 | 0.5〜1 日 | 3 日〜 +α |
| 正本仕様変更 | 不要 | 不要 | 必要 |
| `01-rulebook.md` 更新 | 不要 | 不要 | 必要 |

### 案 A の修正ポイント

1. **`ui/network/command-payload.ts:66` の `actor` 解決**
   - 現状: `actor: normalizePlayerKey(action.actor || action.playerKey || fallbackPlayerKey, 'black', ...)`
   - 修正: **`buildPublishCommandPayload` の `opts.playerKey` (= HTTP seat = 操作者)** を必ず優先する。具体的には `OMITTED_ACTION_KEYS.actor` を維持しつつ、`serializeActionForCommandPayload` の第 2 引数 `fallbackPlayerKey` を publish 経路で必ず HTTP seat にする。`action.actor` / `action.playerKey` は補助情報に降格する。
2. **publish 経路の `playerKey` 設定の整合性確認**
   - `game/card-effects/selection-flow-execution-core.ts` 経由で `selection-flow-network-handoff.ts` に渡される `opts.playerKey` (= 所有者 = `'white'`) は、最終 publish の `actor` には使わず、HTTP seat を別経路で渡せるようにする。
   - これは「publish の主体は送信元、操作対象 / 所有者は action 内の `useCardOwnerKey` などで識別する」という既存サーバ側の `applyTurnSafe` 設計と整合する。

## 6. 実装ステップ

### Step 1: `ui/network/command-payload.ts` の修正

- `serializeActionForCommandPayload` の `actor` 解決順序を、`action.actor` ではなく `fallbackPlayerKey` (= HTTP seat) を最優先に変更。
- `buildPublishCommandPayload` から `serializeActionForCommandPayload` を呼ぶ際の `fallbackPlayerKey` が確実に HTTP seat (= `localSeatKey`) になるように、呼び出し元 (`ui/network/publish-request.ts` 等) を確認・修正。
- 既存テストで `actor` 解決順序に依存しているものがあれば、最小限で追随。

### Step 2: 回帰確認

- `npm run typecheck`
- `npm run build:ts`
- `npm run check:window` (UI 境界チェック)

### Step 3: ネットワークパリティテスト追加

- `test/network.fate-will-selection.test.ts` を新設。
- 既存 `test/network.*.test.ts` の構造を踏襲し、`local-match-server.ts` または `workers/match-worker.ts` の `processNetworkCommand` を直接呼んで以下を検証:
  1. FATE_WILL が作動した状態で、`gameState.currentPlayer = 'white'`、`fateWillControllerByTurnOwner['white'] = 'black'` のスナップショットを作る。
  2. black の seat token で、超引力の対象選択 action (`{ useCardId: 'HYPER_GRAVITY', useCardOwnerKey: 'white', pendingSelectionState: { type: 'HYPER_GRAVITY', stage: 'selectTarget' } }`) を publish。
  3. 期待: `{ ok: true, ... }` で受理され、`pendingEffectByPlayer['white']` の対象 selection が更新される。
- 加えて「通常ターン (FATE_WILL なし) で同じカードを使う」テストを並置して回帰検知を担保。

### Step 4: 既存テスト全実行

- `npm run test:jest`
- `npm run test:network:parity`
- `npm run match:check`

### Step 5: Worker mirror 同期

- `npm run worker:prepare`

### Step 6: 実機検証

- `playwright-local-game-test-workflow` スキルを使い、2 ブラウザでネット対戦ローカルサーバを建てて以下を再現・確認:
  1. 黒側で `運命の意志` を発動。
  2. 白のターンで、黒が操作。白ハンドから `超引力` を発動。
  3. ハイライト表示された石マスをクリック → 選択が成立し、経路先選択モードに遷移することを確認。
  4. 経路先をクリック → 解決 (石が引き寄せられ、終端消費・手番交代) まで一連が動作することを確認。
- 既存 `card-reversi-browser-live-network-check` スキルでローカルライブチェック相当のスモークを併用。

### Step 7: コミット

- 粒度: 「修正 (UI の `actor` 解決) + テスト追加」を 1 コミット。
- メッセージ案: `fix(network): align selection publish actor with HTTP seat for FATE_WILL turns`

## 7. 検証計画

### 自動

- `npm run typecheck`
- `npm run build:ts`
- `npm run check:window`
- `npm run test:jest`
- `npm run test:network:parity`
- `npm run match:check`

### 自動 (新規)

- `test/network.fate-will-selection.test.ts` を新規追加し、上記 Step 3 のケースを担保。

### 手動 / 実機

- Step 6 のシナリオをローカル 2 ブラウザで実行。
- 既存 `card-reversi-browser-live-network-check` スキルでネットワーク経路のスモーク確認 (任意)。

## 8. 影響範囲

| 影響範囲 | 詳細 |
| --- | --- |
| 直接の修正ファイル | `ui/network/command-payload.ts` (+ 必要なら `ui/network/publish-request.ts`) |
| 間接的に検証されるファイル | `workers/match-worker.ts` (既存)、`game/card-effects/selection-flow-execution-core.ts` (既存) |
| 影響を受けるランタイム | ブラウザ / ネット対戦モードのみ |
| 影響を受けないランタイム | ローカル対戦 / CPU 対戦 / 観戦モード / リプレイ |
| 影響を受けるカード | 対象選択を持つ全カード (selection dispatch 経由の全て) |
| 影響を受けないカード | 石置き / ハンド操作のみで完結するカード (FATE_WILL で発動しても元々動かない or 別の publish 経路) |

## 9. リスク

| リスク | 影響 | 対応 |
| --- | --- | --- |
| `actor` 解決順序変更で通常ターンの他の経路が壊れる | 中 | Step 4 で `test:network:parity` + `test:jest` 全実行 |
| `pendingSelectionState.player` の意味が変わる | 中 | `command-payload.ts:120-123` の `params.player` 設定を見直し、必要なら `serialized.actor` ではなく別フィールド (`inputPlayerKey`) を採用 |
| 他の UI モジュールが `command-payload.ts` の actor 解決順序に暗黙依存 | 低 | 既存 `test/ui.network*.test.*` で網羅される想定。落ちたら Step 1 で追随 |
| Worker mirror 同期忘れ | 低 | Step 5 で `npm run worker:prepare` を必ず実行 |

## 10. 正本への影響

- `01-rulebook.md`: 変更不要
- `正本/*.md`: 変更不要
- `docs/architecture-contracts.md`: 必要なら actor 解決順序の境界を明記 (Step 1 実装後に確認)

## 11. 参考: 調査中の観察

- `game/network-turn-handoff.runtime.ts` というソースは存在せず、`game/network-turn-handoff.runtime.js` が実体。AGENTS.md の「legacy `.js` ファイルが実体を持つ場合あり」パターン。今回修正は不要だが、後で整理対象。
- `test/game.fate-will.test.ts` には FATE_WILL controller の `applyTurnSafe` 通行テストはあるが、**ネットワーク publish 経由での selection テストは無い**。Step 3 で同時にカバレッジの穴を塞ぐ。
- 既存の `turn_pipeline_factory.ts:184-197` の正規化は「`actionPlayerKey` (= HTTP seat = 操作者) と `currentPlayerKey` (= 所有者) が不一致のとき、FATE_WILL controller なら `effectivePipelinePlayerKey = currentPlayerKey`」という二段構えになっており、UI が actor を HTTP seat (= `actionPlayerKey`) で揃えることでこの正規化が素直に機能する設計思想と一致する。今回の修正はむしろこの設計思想に UI 側を揃えるもの。
