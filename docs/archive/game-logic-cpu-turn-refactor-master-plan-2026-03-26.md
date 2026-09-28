# game/logic/cards.js・game/cpu-decision.js・game/turn/turn_pipeline_phases.js 段階的リファクタ master plan

作成日: 2026-03-26
対象: game/logic/cards.js, game/cpu-decision.js, game/turn/turn_pipeline_phases.js（および連鎖する周辺モジュール）
状態: Draft（2026-03-26 再評価反映）

---

## 0. この文書の位置づけ

この文書は、カードリバーシ repo における **3 大巨大ファイル**のリファクタを、挙動を保ったまま段階的に進めるための master plan である。

- 一次仕様は `01-rulebook.md` とする。挙動・見た目・イベント順が変わる変更は `01-rulebook.md` を先に更新してから着手する。
- playback 中の Single Visual Writer invariant は維持する。`game/` は順序付き `events[]` を生成するだけに留め、`game/turn/pipeline_ui_adapter.js` が canonicalize し、既存の playback / presentation 経路だけが board DOM / state write を適用する。
- この文書は「置換境界」「phase 定義」「完了条件」「検証束」を固定することだけを目的とする。
- 実装の詳細手順は phase ごとに別 runbook を起こしてよいが、その際も本文書の完了条件・ロールバック境界を上書きしない。
- 既存の `docs/card-logic-modularization-implementation-runbook-2026-03-14.md` は Phase 0〜2 の一部が完了済みの補助情報として扱い、本文書が全体 execution order を束ねる上位文書になる。

---

## 0.1 対象 / 非目標 / 一次情報

### 対象ファイル

| ファイル | 行数 | サイズ | 状態 |
|---|---|---|---|
| `game/logic/cards.js` | 約 7,098 行 | 約 320 KB | 44 + 関数をエクスポートする UMD facade; 効果解決・pending 管理・presentation 発火・マーカー管理が混在。ランダム盤面 spawn helper と inherited-hyperactive state shaping は一部整理済み |
| `game/cpu-decision.js` | 約 5,818 行 | 約 252 KB | 40 + 関数をエクスポート; 環境検出・ONNX gate・カード政策・手政策・pending target 政策・action builder が混在 |
| `game/turn/turn_pipeline_phases.js` | 約 2,772 行 | 約 148.0 KB | 3 エクスポート（applyTurnStartPhase / applyCardUsagePhase / applyActionPhase）; フェーズ間で per-card インライン分岐が散在 |

### 影響を受ける周辺ファイル（書き換え不要だが整合確認が必要）

- `game/turn/turn_pipeline.js` — phases を呼び出す orchestrator
- `game/turn/turn_pipeline_phase_helpers.js` — phase helpers
- `game/turn/pipeline_ui_adapter.js` — events[] → UI adapter
- `game/logic/cards-internal/` 6 ファイル（既分離済）
- `game/logic/cards/` 23 ファイル（既分離済）
- `game/card-effects/` 20 ファイル（既分離済）
- `game/ai/` 7 ファイル（既分離済）
- `game/logic/presentation.js`
- `game/turn-handlers/pending-target-selector.js`
- `cards/card-interaction.js`
- `src/engine/selfplay-runner.js`
- `scripts/local-match-server.js`, `workers/match-worker.mjs`, `ui/network-client.js` — publish / playback / projection parity の確認対象
- `worker-public/` — root の mirror; `npm run worker:prepare` で同期

### 非目標

- カード効果の仕様変更・バランス調整
- 新カードの追加
- UI の見た目変更
- CPU のプレイレベル変更
- `worker-public/` の構造再設計（mirror 同期のみ）
- `cards/catalog.json` / catalog 生成経路の変更
- `01-rulebook.md` の仕様変更（この plan 自体は挙動維持リファクタを前提にするため更新不要。ただし挙動を変える phase を入れる場合は、その phase 着手前に `01-rulebook.md` を先行更新すること）
- 外部依存の追加

### 一次情報

- `01-rulebook.md` — ゲーム仕様・イベント順・Spec B フリップ演出・Single Visual Writer 要件
- `docs/card-logic-modularization-implementation-runbook-2026-03-14.md` — Phase 0〜2 完了済みスライスの記録

---

## 1. 現状の確定事実

### 1.1 game/logic/cards.js の現状

- UMD パターンで公開される facade だが、内部では約 44 関数が約 7,098 行に渡って定義されており、facade と言えない密度になっている。
- 責務が **少なくとも 8 種類**混在している:
  1. カード効果解決（applyCardUsage, applyPlacementEffects, applyFlips, applyDestroyEffect …）
  2. カタログ参照（カード定義の inline 参照が残存）
  3. pending state 管理（`cards-internal/pending-state-manager.js` へ委譲済みの部分と、まだ残留している部分が混在）
  4. charge 会計（`cards-internal/charge-ledger.js` へ委譲済みの部分と残留）
  5. マーカー管理（duration, bomb, special-stone）
  6. presentation event 発火（`placement_effects`, `regen_triggered` 等を直接組み立てて返す）
  7. ボード操作補助（flip 検出, 配置バリデーション）
  8. Hyperactive 分岐（instant / extreme / ultimate / gluttonous の大量 if 分岐）
- `docs/card-logic-modularization-implementation-runbook-2026-03-14.md` に記録された Phase 0〜2 のスライスは完了済み。
- その後の進捗として、`collectRandomBoardSpawnablePositions()` / `resolveRandomBoardSpawnEffectUsage()` により Equality / Salvation 系のランダム盤面 spawn は共有 helper 化されている。また `applyHyperactiveInheritWill` の marker payload には `remainingOwnerTurns`, `flipEvadeRemaining`, `destroyEvadeRemaining`, `hyperactiveSeq` が揃って入り、継承躍動の状態 shape は整理が進んでいる。
- ただし `applyHyperactiveInheritWill` 自体や主要 entrypoint は依然として cards.js 本体に残っており、Phase 1 の「委譲完了」は未達である。shared helper の存在は Phase 1 の着手点が前進したことを意味するが、完了扱いにはしない。

### 1.2 game/cpu-decision.js の現状

- 5,316 行（再計測 5,818）のファイルに 40 + 関数が同居しており、下記の責務が分離されていない:
  1. 環境検出: `isAISystemAvailable()`, テスト環境判定, querystring debug フラグ
  2. ONNX gate: `CpuPolicyOnnxRuntime` 呼び出し, `selectMoveFromOnnxPolicyAsync`, `selectCardFromOnnxPolicyAsync`, `shouldDegradeForLatency()`
  3. カード政策: カード選択スコアリング, コスト確認, risk-based fallback, high-confidence threshold
  4. 手政策: 合法手からの move 選択, 盤面位置スコアリング（角・辺・石数優位）
  5. pending target 政策: per-effect selector（trap, guard, heaven blessing, condemn, swap, 等 20 + 種類）
  6. action builder: `cpuSelect*WithPolicy` 群（30 + 関数）
  7. 副作用: RNG injection, `emitCpuSelectionStateChange()` 呼び出し
  8. レベルシステム橋渡し: `AISystem` へのレベル別挙動差分

### 1.3 game/turn/turn_pipeline_phases.js の現状

- 3 フェーズ関数（applyTurnStartPhase / applyCardUsagePhase / applyActionPhase）に約 2,772 行が集中している。
- 各フェーズ内で per-card のインライン分岐（dragon, breeding, UDG, sniper, lightning, will_hunter_king, observer 等）が直接展開されており、既存 helper と二重に処理が書かれている箇所がある。ただし `index.html` では `game/turn/turn_pipeline_phases.js` が `game/special-effects/*` より先に読み込まれ、`game/special-effects/dragons.js` 側には turn pipeline / UI wrapper への逆参照もあるため、`game/special-effects/*` は phases.js の一次抽出先にはしない。一次抽出先は `game/turn/` 配下の headless helper と `game/logic/cards/*` の pure module を優先する。
- event emitter パターンは `pipeline_ui_adapter.js` が担っているが、phases.js 内で直接 events[] を組み立てる部分が残留している。
- `game/turn/turn_pipeline_phase_helpers.js` がサブ処理を一部切り出しているが、phases.js 本体はまだ重い。

### 1.4 既に分離済みのモジュール（資産）

次のモジュールは利用可能な状態で存在しており、phases.js / cards.js / cpu-decision.js の整理で活用できる。特に classic script load order を壊さない一次委譲先は `game/logic/cards-internal/`, `game/logic/cards/`, `game/turn/turn_pipeline_phase_helpers.js` と、その隣接に追加する headless helper である。`game/card-effects/` / `game/special-effects/` は既存 contract の参照先・browser consumer としては重要だが、`index.html` / `worker-public/index.html` の script 順変更を明示的に入れない限り cards.js / phases.js の主抽出先にはしない。

```
game/logic/cards-internal/
  card-usage-prechecks.js
  charge-ledger.js
  effect-timing.js
  hand-manager.js
  pending-state-manager.js
  selector-orchestrator.js

game/logic/cards/
  breeding.js, chain.js, clone.js, costs.js, defs.js,
  destroy_dragon.js, expansion.js, flips.js, hyperactive.js,
  lightning.js, markers.js, meteor.js, movement.js, regen.js,
  selectors.js, sniper.js, targets.js, teleport.js, time_bomb.js,
  udg.js, utils.js, will_hunter_king.js, work_will.js

game/logic/effects/
  dragon.js
  destroy_one_stone.js
  swap_with_enemy.js

game/logic/ (other existing helpers):
  board_ops.js
  context.js
  markers_adapter.js
  position-weights.js

game/turn/
  turn_pipeline_phase_helpers.js

game/ai/
  cpu-commentary-runtime.js, cpu-lv6-lookahead-profile.js,
  cpu-policy-core.js, fixed-commentary-engine.js,
  level-system.js, policy-onnx-runtime.js, policy-table-runtime.js

game/turn-handlers/pending-target-selector.js
game/logic/presentation.js
game/cpu-decision-board-utils.js
```

### 1.5 2026-03-26 再評価で確認した追加進捗

- classic script load order 前提は引き続き有効である。`index.html` / `worker-public/index.html` の script 順と、`test/index.card-module-scripts.test.js` / `test/index.local-script-paths.test.js` は引き続き phase gate に置く。
- `game/turn/pipeline_ui_adapter.js` には `CARD_EFFECT_SPAWN_PROFILES` と関連 helper による card-effect spawn の data-driven 経路が追加されており、Equality / Salvation の逐次 spawn phase と disappear timing はこの経路で扱われている。Phase 3 / 4 ではこの adapter 側進捗を前提にし、再び per-effect の直書き分岐へ戻さない。
- inherited hyperactive と UI 側表示については、`test/game.hyperactive-inherit-will.test.js`, `test/ui.animation-engine.inherited-hyperactive-timer.test.js`, `test/ui.animation-engine.guard-timer.test.js`, `test/ui.long-press-info.test.js`, `test/ui.card-detail-effect-tags.test.js`, `test/ui.network-snapshot.hyperactive-source-empty.test.js` が追加されている。Phase 1 / 3 / 4 の検証束はこれらを落とさない前提で更新する。
- モジュール責務の整理では、`game/logic/effects/dragon.js`, `game/logic/cards/breeding.js`, `game/logic/cards/udg.js`, `game/logic/cards/sniper.js`, `game/logic/cards/lightning.js`, `game/logic/cards/will_hunter_king.js`, `game/logic/effects/destroy_one_stone.js`, `game/logic/effects/swap_with_enemy.js` が既に存在し、anchor-effect および destroy/swap 系の委譲は一部実装されている。Phase 1 Step 3 での anchor-effects 委譲は、既存 delegation module を活用する前提で残作業を定義する。`processObserverWillEffectsAtTurnStartAnchor` は依然として不明瞭なため、引き続き対象に含める。
- 再評価時に追加発見されたテストカバレッジ: `test/game.cards.markers-duration-module.test.js`, `test/game.cards.effect-timing-module.test.js`, `test/game.cards.hand-manager-module.test.js`, `test/game.cards.reshuffle-cycle.test.js`, `test/index.destroy-outcome-contract-load.test.js`, `test/index.sniper-module-load.test.js` を含め、検証束の精度を高める。
- `01-rulebook.md` には、継承躍動 (`HYPERACTIVE_INHERIT_WILL`) の反転回避 / 破壊回避を含む現行の効果タイミングが既に明記されている。本 master plan は挙動維持リファクタが前提であり、この再評価のための追加 rulebook 更新は不要である。将来的に効果タイミング仕様の変更を含む phase を追加する場合は、その phase 着手前に `01-rulebook.md` を更新する。

---

## 2. なぜ段階的大規模リファクタが必要か

### 2.1 局所修理では解消できない根本問題

3 ファイルはそれぞれ 2,772〜7,098 行を超えており、局所修正を重ねると次の問題が構造的に再発する:

1. **責務横断バグの再発**: cards.js 内で presentation 発火と状態変化が同じ関数に混在しているため、カード追加 / 変更のたびに presentation が二重発火したり、pending state が不正に進行したりするバグが繰り返し出ている。
2. **CPU pending target の散在**: pending target の chooser / action builder が cpu-decision.js の 5,818 行の中に埋め込まれており、カード追加のたびに「どこに書けばよいか」が不明瞭で、既存 helper を無視したコピペ分岐が増殖している。
3. **turn pipeline の per-card インライン分岐**: turn_pipeline_phases.js に各カードの特殊処理がインラインで展開されているため、カード効果の変更が「phases.js を直す」と「special-effects/ を直す」の両方を要求し、回帰リスクが常に高い。
4. **テスト可能単位の不在**: 7,098 行 / 5,818 行の巨大 UMD は、外部から関数単位をモックして単体テストすることが困難であり、現状の `test/` カバレッジは「既存挙動をそのまま通す」形の e2e / integration テストが中心になっている。単一責務モジュールへの分割でなければ、regression テストが書けない。

### 2.2 段階的大規模リファクタを選ぶ条件

`.github/copilot-instructions.md` の共通ルール上でも、差分規模ではなく根本原因、責務境界、契約の整合を優先すべき案件に該当する。

具体的な判定根拠:
- **構造問題**: 1 ファイルに 8 種類の責務が混在している（cards.js）
- **契約不整合**: pending state、presentation 発火、CPU pending target が複数ファイルに散在して不統一な contract になっている
- **再発不具合**: カード追加のたびに presentation 二重発火, pending state 不整合, CPU action builder コピペが再発している

### 2.3 局所修理と比較した場合の優位性

| 観点 | 局所修理 | 本 master plan |
|---|---|---|
| カード追加コスト | 毎回同じ場所を 3 ファイル横断で修正 | 追加先が単一モジュールに収まる |
| regression リスク | 毎回 7,098 行 / 5,818 行を経由する | 差分が局所モジュールに閉じる |
| テスト可能性 | 巨大ファイル全体を通さないとテスト不能 | 単一責務モジュール単位でモック可能 |
| presentation 二重発火 | 個別に当て続ける | 発火経路を 1 本に束ねた段階で解消 |
| CPU pending target 散在 | 新カードのたびに cpu-decision.js に追記 | pending-target-selector.js に一元化 |

---

## 3. 目標アーキテクチャ

### 3.1 cards.js の目標形: 薄い facade

```
game/logic/cards.js  ← 薄い re-export facade（100〜200 行程度が目標）
  ↓ require / classic-script global
  game/logic/cards-internal/card-usage-prechecks.js
  game/logic/cards-internal/charge-ledger.js
  game/logic/cards-internal/effect-timing.js
  game/logic/cards-internal/hand-manager.js
  game/logic/cards-internal/pending-state-manager.js
  game/logic/cards-internal/selector-orchestrator.js
  game/logic/cards/{breeding,clone,hyperactive,markers,...}.js
  game/logic/effects/{dragon,destroy_one_stone,swap_with_enemy}.js
```

- `applyCardUsage` は公開入口として維持し、内部で各サブモジュールへ委譲する。
- presentation event の組み立ては `game/logic/presentation.js` 経由に一本化する。
- per-card 大型関数（applyHyperactiveInheritWill, processDragonEffectsAtAnchor 等）は対応する `game/logic/cards/`, `game/logic/cards-internal/`, `game/logic/effects/` の既存 headless-safe module へ委譲する。browser load order 変更を先行しない限り、`game/card-effects/*` は cards.js の一次移動先にしない。

### 3.2 cpu-decision.js の目標形: 政策ハブ

```
game/cpu-decision.js  ← 軽量ハブ（公開 API 維持、内部は委譲のみ）
  ↓ require
  game/ai/level-system.js       ← 環境検出・レベル判定（既存）
  game/ai/policy-onnx-runtime.js ← ONNX gate（既存）
  game/ai/cpu-policy-core.js    ← move scoring / card scoring（既存）
  game/turn-handlers/pending-target-selector.js  ← pending target 政策（既存、拡充）
  [new] game/ai/cpu-card-policy.js               ← カード政策 (cost, risk, confidence)
  [new] game/ai/cpu-action-builder.js            ← cpuSelect*WithPolicy 群
```

- `computeCpuAction` / `cpuMaybeUseCardWithPolicy` 等の公開 API は **シグネチャを変えずに維持**する。
- 副作用（`emitCpuSelectionStateChange`）は cpu-decision.js に残し、政策判断ロジックだけを新モジュールへ移す。
- `setCpuRng` も公開 API として維持する。

### 3.3 turn_pipeline_phases.js の目標形: 軽量オーケストレータ

```
game/turn/turn_pipeline_phases.js  ← 3 フェーズの呼び出し順を決めるだけ（500 行程度が目標）
  ↓ require / classic-script global
  game/turn/turn_pipeline_phase_helpers.js  ← 既存 helper（拡充、events 整理受け入れ）
  game/logic/cards/{sniper,lightning,will_hunter_king,work_will,udg,destroy_dragon,breeding,markers,time_bomb,...}.js
  game/logic/effects/{dragon,destroy_one_stone,swap_with_enemy}.js
```

- per-card インライン分岐は `game/turn/turn_pipeline_phase_helpers.js` 拡充と `game/logic/cards/*`, `game/logic/effects/*` の既存 pure helper へ委譲する。`game/special-effects/*` / `game/card-effects/*` は既存 browser consumer と contract 参照として扱い、load order を明示的に変えない限り一次移動先にしない。
- events[] の組み立ては `turn_pipeline_phase_helpers.js` へ寄せ、`pipeline_ui_adapter.js` の data-driven 契約パターンと整合させる。phases.js 内の直接組み立てを減らす。
- Single Visual Writer invariant を保つため、Phase 3 が触ってよいのは headless な events 組み立てまでとする。board DOM / state write を新規 helper や phases.js 直下へ増やさず、`pipeline_ui_adapter.js` → playback / presentation 経路だけを適用点として維持する。
- 3 エクスポート（applyTurnStartPhase / applyCardUsagePhase / applyActionPhase）はシグネチャを維持する。

---

## 4. Phase 定義

### Phase 0: 基準確立と検証束整備

**目的:** リファクタ前の挙動を記録し、各 phase の回帰検出ベースラインを確立する。

**作業:**

1. `npm test` を実行し、現時点での全テスト pass/fail を記録する。
    - `npm test` は `pretest -> checkall` を含むため、Phase 0 / Phase 5 のみ full-suite / full-check ベースラインとして扱う。
2. 3 ファイルに対応する既存テスト群（下記）の対象と pass 数だけでなく、**pass / fail の具体的なテスト名一覧**を `npx jest --runInBand --runTestsByPath ...` による slice 単位で記録する。
3. 3 ファイルそれぞれの公開 API（`module.exports`）を列挙し、シグネチャを文書化する（この phase の成果物は phase 移行ごとに参照する「API 台帳」）。
4. 軽量 pre-flight として、各 phase で新規 module を追加する場合に備え、export signature diff の比較手順と classic-script dependency / load-order 確認手順（`index.html`, `worker-public/index.html`, load-order test）を API 台帳に添える。
5. `worker-public/` の対応ファイルが root と一致していることを `npm run worker:prepare` で確認する。

**主対象:**
- `test/` 配下の既存テスト — `test/game.cards.*`, `test/cpu.decision.*`, `test/cpu.turn-handler.*`, `test/game.turn-pipeline*.test.js`, `test/game.pipeline-ui-adapter.*`, `test/index.card-module-scripts.test.js`, `test/index.local-script-paths.test.js`, `test/game.cards.markers-duration-module.test.js`, `test/game.cards.effect-timing-module.test.js`, `test/game.cards.hand-manager-module.test.js`, `test/game.cards.reshuffle-cycle.test.js`, `test/index.destroy-outcome-contract-load.test.js`, `test/index.sniper-module-load.test.js`
- `test/e2e/` 配下の E2E/統合系 — `test/e2e/card_effects.e2e.test.js`, `test/e2e/cpu.e2e.test.js`, `test/e2e/cpu_auto_response.e2e.test.js`, `test/e2e/cpu_level_diff.e2e.test.js`, `test/e2e/destroy-card-will-hunter-king.e2e.test.js`, `test/e2e/multi_turn_progression.e2e.test.js`, `test/e2e/reset_click.e2e.test.js`, `test/e2e/special_effects.e2e.test.js`
- parity / mirror 系 — `test/local-match-server.publish-contract.test.js`, `test/scripts.prepare-worker-assets.test.js`, `test/ui.owner-helpers-classic-script-load.test.js`, `npm run test:network:parity`, `npm run match:check`

**完了条件:**
- `npm test` が phase 0 開始時点と同じ結果（pass 数・fail 数に加えて、失敗しているテスト名の集合が同一）で終わる。
- API 台帳（3 ファイルの export 一覧）が存在する。
- `worker-public/` sync が確認済みである。
- slice-level gate に使う targeted Jest コマンドが `npm test` と切り分けて記録されている。

**検証束:**
```
npm test
npx jest --runInBand --runTestsByPath test\game.cards.markers-duration-module.test.js test\game.cards.effect-timing-module.test.js test\game.cards.hand-manager-module.test.js test\game.cards.reshuffle-cycle.test.js test\cpu.decision.refactor.test.js test\cpu.compute.test.js test\cpu.turn-handler.commentary.test.js test\game.turn-pipeline.destroy-hand-card.test.js test\game.turn-pipeline.out-of-turn.test.js test\game.pipeline-ui-adapter.spawn.test.js test\index.card-module-scripts.test.js test\index.local-script-paths.test.js test\ui.owner-helpers-classic-script-load.test.js test\e2e\card_effects.e2e.test.js test\e2e\cpu.e2e.test.js test\e2e\multi_turn_progression.e2e.test.js
npx jest --runInBand --runTestsByPath test\scripts.prepare-worker-assets.test.js
npm run test:network:parity
npm run match:check
npm run worker:prepare
```

**ロールバック境界:** phase 0 は読み取りのみ。コード変更なし。

---

### Phase 1: cards.js — hyperactive / work_will / anchor 処理の委譲完了

**目的:** cards.js に残っている per-card 大型関数を `game/logic/cards/` の対応モジュールへ移動し、cards.js 内の行数を減らす。

**再評価メモ:** `cards.js` では random-board spawn helper と inherited-hyperactive marker shape の整理がすでに進んでいる。そのため本 phase の残作業は「効果 semantics の再設計」ではなく、「既存 helper / shape を保ったまま entrypoint を委譲し、shim 化を完了すること」である。

**作業:**

1. `applyHyperactiveInheritWill` を `game/logic/cards/hyperactive.js` へ移動（または既存実装との統合）。
2. `applyStrongWill`, `applyHeavenBlessingChoice`, `applyCondemnWill`, `applyTemptWill`, `applyExtendLifeGod`, `applyCorrosionWill`, `applyGuardWill`, `applyTimeBombWill`（未委譲分）を各対応モジュールへ委譲する。
3. **[一部完了済み]** 既存の `game/logic/effects/dragon.js`, `game/logic/cards/breeding.js`, `game/logic/cards/udg.js`, `game/logic/cards/sniper.js`, `game/logic/cards/lightning.js`, `game/logic/cards/will_hunter_king.js`, `game/logic/effects/destroy_one_stone.js`, `game/logic/effects/swap_with_enemy.js` により、`processDragonEffectsAtAnchor`, `processBreedingEffectsAtAnchor`, `processUltimateDestroyGodEffectsAtAnchor`, `processSniperWillEffectsAtAnchor`, `processLightningWillEffectsAtAnchor`, `processWillHunterKingEffectsAtTurnStartAnchor`, `processDestroyDragonEffectsAtAnchor` の委譲は部分的に完了している。cards.js 側が既存モジュールへ適切に委譲しているかを確認し、不足分を補完する。`processObserverWillEffectsAtTurnStartAnchor` については依然として不明瞭なため、整理または委譲の必要性を検証する。`index.html` では `game/logic/cards.js` が `game/card-effects/*` より先に読み込まれるため、script reorder を明示的に入れない限り `game/card-effects/*` を一次委譲先にしない。
4. cards.js の各委譲元関数は `return SubModule.funcName(...)` 形式の 1 行 shim として残し、外部 API を壊さない。
5. 新規 classic-script helper を追加した場合は `index.html` と `worker-public/index.html` に `game/logic/cards.js` より前で script を追加し、`test/index.card-module-scripts.test.js` / `test/index.local-script-paths.test.js` を phase gate に含める。
6. 各スライス完了後に検証束を実行し、pass が維持されていることを確認してから次スライスへ進む。
7. 新規 helper の追加先は `game/logic/cards/*`, `game/logic/cards-internal/*`, `game/logic/effects/*` を優先し、browser load order を変えない限り `game/card-effects/*` への一次移動は行わない。
8. 移動対象 effect に専用の既存 test がある場合は、その effect 固有 test を同じ slice の検証束へ必ず追加する。専用 test が無い effect は before/after fixture diff または event diff を残す。

**主対象:**
- `game/logic/cards.js`（委譲元 shim 化）
- `game/logic/cards/hyperactive.js`, `work_will.js`, `markers.js`, `sniper.js`, `lightning.js`, `will_hunter_king.js`, `breeding.js`, `udg.js`, `destroy_dragon.js` 等（既存委譲先の整合確認・補完）
- `game/logic/effects/dragon.js`, `destroy_one_stone.js`, `swap_with_enemy.js`（既存委譲先の活用確認）
- `index.html`, `worker-public/index.html`（新規 helper を classic script として読む場合のみ script 順確認）

**完了条件:**
- cards.js から移動した全関数が、移動先モジュールから正しくエクスポートされている。
- cards.js の各関数は移動先モジュールへの 1 行 shim になっている。
- Phase 1 検証束の targeted Jest / mirror 確認が通っており、Phase 0 で記録した対象スライスの期待結果（pass / fail 名一覧を含む）を維持している。
- 新規 helper を browser 読み込みに追加した場合は `test/index.card-module-scripts.test.js` と `test/index.local-script-paths.test.js` が pass している。
- `worker-public/` に影響するファイルがある場合は `npm run worker:prepare` を実行済みである。
- helper / script 追加がある場合は `test/ui.owner-helpers-classic-script-load.test.js` と `test/scripts.prepare-worker-assets.test.js` も pass している。

**検証束:**
```
npx jest --runInBand --runTestsByPath test\game.cards.charge-ledger-module.test.js test\game.cards.pending-state-manager-module.test.js test\game.cards.markers-duration-module.test.js test\game.cards.effect-timing-module.test.js test\game.cards.hand-manager-module.test.js test\game.cards.reshuffle-cycle.test.js test\game.hyperactive-inherit-will.test.js test\index.destroy-outcome-contract-load.test.js test\index.sniper-module-load.test.js test\index.card-module-scripts.test.js test\index.local-script-paths.test.js test\ui.owner-helpers-classic-script-load.test.js
npx jest --runInBand --runTestsByPath test\ui.animation-engine.inherited-hyperactive-timer.test.js test\ui.animation-engine.guard-timer.test.js test\ui.long-press-info.test.js test\ui.card-detail-effect-tags.test.js test\ui.network-snapshot.hyperactive-source-empty.test.js test\e2e\card_effects.e2e.test.js test\e2e\multi_turn_progression.e2e.test.js
npm run worker:prepare  # cards.js または script include が worker-public に含まれる場合
npx jest --runInBand --runTestsByPath test\scripts.prepare-worker-assets.test.js  # worker-public mirror に影響がある場合
```

**ロールバック境界:**
- 各スライスは独立した git commit にする。
- 問題が出た場合は該当スライスの commit だけ revert する。
- cards.js の shim が残っている限り、外部 require は壊れない。

---

### Phase 2: cpu-decision.js — カード政策と action builder の分離

**目的:** cpu-decision.js の 5,818 行から「カード政策スコアリング」と「cpuSelect*WithPolicy action builder 群」を新モジュールへ切り出し、cpu-decision.js をハブに縮小する。

**作業:**

1. **カード政策モジュールの作成（`game/ai/cpu-card-policy.js`）**
   - `isCardChoiceAllowedByRisk`, `isCardChoiceAllowedByHighConfidence`, `hasPlanPressureProfileForCardType`, `buildCardUseDecisionContext` を移動する。
   - カードコスト確認 helper を移動する。

2. **action builder モジュールの作成（`game/ai/cpu-action-builder.js`）**
   - `cpuSelectDestroyWithPolicy`, `cpuSelectHeavenBlessingWithPolicy`, `cpuSelectCondemnWillWithPolicy`, `cpuSelectSwapWithEnemyWithPolicy`, `cpuSelectPositionSwapWillWithPolicy`, `cpuSelectTrapWillWithPolicy`, `cpuSelectGuardWillWithPolicy`, `cpuSelectHyperactiveInheritWillWithPolicy`, `cpuSelectExtendLifeWillWithPolicy`, `cpuSelectCorrosionWillWithPolicy`, `cpuSelectSuperBuoyancyWillWithPolicy`, `cpuSelectSuperGravityWillWithPolicy`, `cpuSelectTeleportWillWithPolicy`, `cpuSelectCellTeleportWillWithPolicy`, `cpuSelectTimeBombWithPolicy`, `cpuSelectBoardExpansionWillWithPolicy`, `cpuSelectBlockadeWillWithPolicy`, `cpuSelectMeteorWillWithPolicy`, `cpuSelectFreezeWillWithPolicy`, `cpuSelectCloneWillWithPolicy`, `cpuSelectSplitWillWithPolicy`, `cpuSelectTemptWillWithPolicy` を移動する。
   - `game/turn-handlers/pending-target-selector.js` への委譲パターンを確認・統一する。

3. **移動元 cpu-decision.js での shim 化**
   - module.exports に列挙されている全関数は shim として維持する（シグネチャを変えない）。
   - `computeCpuAction`, `cpuMaybeDestroyHandCardWithPolicy`, `cpuMaybeUseCardWithPolicy`, `selectCardToUse`, `applyCardChoice`, `selectCpuMoveWithPolicy`, `selectHandCardToDestroy`, `applyHandCardDestroy`, `setCpuRng` は cpu-decision.js に直接実装を残すか、ハブとして `require` に切り替える。

4. **環境検出・ONNX gate の整理（オプション）**
    - ONNX gate は既存 `game/ai/policy-onnx-runtime.js` と `selectMoveFromOnnxPolicyAsync` 間の経路を確認し、不要な重複があれば統合する。ただし policy-onnx-runtime.js の API は変えない。
5. **browser / classic-script / worker-public gate の固定**
   - `game/ai/cpu-card-policy.js` と `game/ai/cpu-action-builder.js` は Phase 2 の成果物として新規作成する前提なので、classic-script / UMD で必要なら `index.html` と `worker-public/index.html` の include・順序を明示的に更新する。
   - root 正本更新後は `npm run worker:prepare` を必ず実行し、`test/index.card-module-scripts.test.js`, `test/index.local-script-paths.test.js`, `test/ui.owner-helpers-classic-script-load.test.js`, `test/scripts.prepare-worker-assets.test.js` を phase gate に含める。

**主対象:**
- `game/cpu-decision.js`（委譲元、ハブに縮小）
- `game/ai/cpu-card-policy.js`（新規作成）
- `game/ai/cpu-action-builder.js`（新規作成）
- `game/turn-handlers/pending-target-selector.js`（拡充・整合確認）
- `game/cpu-decision-board-utils.js`（既存 helper 依存の再利用・注入確認）
- `index.html`, `worker-public/index.html`（Phase 2 の新規 CPU module を classic-script で読む場合の include / 順序更新）

**完了条件:**
- `cpu-decision.js` の全公開 API シグネチャが変わっていない。
- 移動した全関数が新モジュールから正しくエクスポートされ、cpu-decision.js の shim が通る。
- Phase 2 検証束の targeted Jest が通っており、Phase 0 で記録した対象スライスの期待結果（pass / fail 名一覧を含む）を維持している。
- `game/cpu-turn-handler.js` と `test/selfplay.runner.test.js` を含む CPU entrypoint / headless validation が変更なしで動作する。
- `index.html` / `worker-public/index.html` の include・順序確認が済み、`test/index.card-module-scripts.test.js`, `test/index.local-script-paths.test.js`, `test/ui.owner-helpers-classic-script-load.test.js`, `test/scripts.prepare-worker-assets.test.js` が pass している。
- CPU core / table runtime / selfplay parity / pending target selector の追加検証面が維持されている。
- `npm run worker:prepare` を実行済みで、worker-public mirror が新規 CPU module を含めて同期されている。

**検証束:**
```
npx jest --runInBand --runTestsByPath test\cpu.decision.pending-selection-continue-turn.test.js test\cpu.decision.refactor.test.js test\cpu.decision.selection-only-movement.test.js test\cpu.compute.test.js test\cpu.commentary-runtime.test.js test\cpu.aisystem.helper.test.js test\cpu.turn-handler.commentary.test.js test\game.cpu-policy-core.test.js test\game.cpu-policy-onnx-runtime.test.js test\game.cpu-policy-table-runtime.test.js test\game.pending-target-selector.test.js test\selfplay.runner.test.js test\selfplay.runtime-parity.test.js test\selfplay.policy-onnx-gate.test.js
npx jest --runInBand --runTestsByPath test\index.card-module-scripts.test.js test\index.local-script-paths.test.js test\ui.owner-helpers-classic-script-load.test.js test\scripts.prepare-worker-assets.test.js test\e2e\cpu.e2e.test.js test\e2e\multi_turn_progression.e2e.test.js
npm run worker:prepare
```

**ロールバック境界:**
- `cpu-card-policy.js` 作成と `cpu-action-builder.js` 作成は別 commit にする。
- 各 commit は cpu-decision.js の shim が残る状態を維持する。

---

### Phase 3: turn_pipeline_phases.js — per-card インライン分岐の委譲

**目的:** turn_pipeline_phases.js 内の per-card インライン分岐（dragon / breeding / UDG / sniper / lightning / will_hunter_king / observer）を、classic script load order と headless 境界を壊さない `game/turn/turn_pipeline_phase_helpers.js`, `game/logic/cards/*`, `game/logic/effects/*` へ委譲し、phases.js をオーケストレータに縮小する。

**再評価メモ:** `pipeline_ui_adapter.js` 側では card-effect spawn の phase 制御が `CARD_EFFECT_SPAWN_PROFILES` ベースの data-driven 経路へ進んでいる。Phase 3 の events 整理はこの adapter 契約を温存する前提で進め、Equality / Salvation spawn を再び個別 if 群へ戻さない。

**作業:**

1. **applyTurnStartPhase の整理（スライス 1）**
    - **[一部完了済み]** 既存の `game/logic/effects/dragon.js`, `game/logic/cards/breeding.js`, `game/logic/cards/udg.js`, `game/logic/cards/sniper.js`, `game/logic/cards/lightning.js`, `game/logic/cards/will_hunter_king.js`, `game/logic/cards/destroy_dragon.js` により、dragon / breeding / UDG / sniper / lightning / will_hunter_king / destroy-dragon の turn-start anchor 処理の委譲は部分的に完了している。phases.js 側が適切に委譲しているかを確認し、不足分は `game/turn/turn_pipeline_phase_helpers.js`, `game/logic/cards/*`, `game/logic/effects/*` の headless-safe helper に限って補完する。observer turn-start 処理は依然として不明瞭なため、Phase 3 内で委譲先を確定できない場合は follow-up runbook を切って明示除外し、曖昧なまま持ち越さない。load order を明示的に変更しない限り、新規 helper の一次移動先を「どこでもよい」にしない。
   - Ribo Will repayment / shortage → `game/logic/cards/work_will.js` へ委譲（既存 if ある場合）

2. **applyActionPhase の整理（スライス 2）**
    - pending action 解決分岐 → `game/turn/turn_pipeline_phase_helpers.js`, `game/logic/cards/*`, `game/logic/effects/*` のみへ整理し、`game/card-effects/selection-flow.js` の contract と整合する shape を維持する。load order を明示的に変えない限り、追加の抽出先を `game/card-effects/*` や「新 helper anywhere」に広げない
    - special stone expiry / bomb activation → 同じく `game/turn/turn_pipeline_phase_helpers.js`, `game/logic/cards/markers.js`, `game/logic/cards/time_bomb.js` などの headless-safe helper へ委譲する。`game/special-effects/*` は browser consumer のままにする

3. **events[] 組み立ての整理（スライス 3）**
    - phases.js 内で直接組み立てている events を `turn_pipeline_phase_helpers.js` に寄せる。
    - **注意**: events[] の順序は `01-rulebook.md` の Spec B フリップ演出および Single Visual Writer 要件に従う。game logic は順序付き events を生成するだけに留め、`pipeline_ui_adapter.js` が canonicalize し、playback engine / presentation path だけが board DOM / state write を適用する。この contract を崩す順序変更や直書きは行わない。

4. **classic script 境界の確認（スライス横断）**
   - `turn_pipeline_phases.js` より前に読む必要がある新規 helper を作った場合は、`index.html` と `worker-public/index.html` の script 順を明示的に更新し、その差分を phase 完了条件と検証束に含める。

**主対象:**
- `game/turn/turn_pipeline_phases.js`（委譲元）
- `game/turn/turn_pipeline_phase_helpers.js`（拡充、events 整理受け入れ）
- `game/logic/cards/sniper.js`, `lightning.js`, `will_hunter_king.js`, `work_will.js`, `breeding.js`, `udg.js`, `destroy_dragon.js`, `markers.js`, `time_bomb.js`（既存委譲先の整合確認・補完）
- `game/logic/effects/dragon.js`, `destroy_one_stone.js`, `swap_with_enemy.js`（既存委譲先の活用確認）
- `game/card-effects/selection-flow.js`（contract 整合確認）
- `index.html`, `worker-public/index.html`（新規 helper を classic script として読む場合のみ script 順確認）

**完了条件:**
- phases.js の 3 エクスポートシグネチャが変わっていない。
- Phase 3 検証束の targeted Jest と parity 確認が通っており、Phase 0 で記録した対象スライスの期待結果（pass / fail 名一覧を含む）を維持している。
- `game.pipeline-ui-adapter.*` テスト群が全 pass を維持している。
- events[] 順序が変わっていないことを `game.pipeline-ui-adapter.chain-flip-order`, `regen-flip-order` テストが保証している。
- 新規 helper / script reorder が入った場合は `test/index.card-module-scripts.test.js` と `test/index.local-script-paths.test.js` が pass している。
- Single Visual Writer / playback contract が維持され、board DOM / state write の新規経路が追加されていない。
- `npm run worker:prepare` を実行済みで、Phase 3 による `game/turn/*` / script include 変更が worker-public mirror に反映されている。
- script 追加・順序変更や mirror 更新を伴う場合は `test/scripts.prepare-worker-assets.test.js` が pass している。

**検証束:**
```
npx jest --runInBand --runTestsByPath test\game.turn-pipeline.destroy-hand-card.test.js test\game.turn-pipeline.out-of-turn.test.js test\game.turn-pipeline-strong-will-timer.test.js test\game.double-place-pipeline.test.js test\game.gold-silver-pipeline.test.js test\game.ultimate-hyperactive.turn-start.test.js test\game.observer-will.test.js test\game.ribo-will.test.js test\game.pass-handler.test.js test\game.network-turn-handoff.test.js
npx jest --runInBand --runTestsByPath test\game.pipeline-ui-adapter.chain-flip-order.test.js test\game.pipeline-ui-adapter.regen-flip-order.test.js test\game.pipeline-ui-adapter.spawn.test.js test\game.pipeline-ui-adapter.salvation-disappear-timing.test.js test\game.pipeline-ui-adapter.salvation-sound-cue.test.js test\ui.card-use-source-element.test.js test\index.card-module-scripts.test.js test\index.local-script-paths.test.js test\ui.owner-helpers-classic-script-load.test.js test\e2e\card_effects.e2e.test.js test\e2e\cpu.e2e.test.js test\e2e\multi_turn_progression.e2e.test.js
npx jest --runInBand --runTestsByPath test\scripts.prepare-worker-assets.test.js
npx jest --runInBand --runTestsByPath test\local-match-server.publish-contract.test.js
npm run test:network:parity
npm run match:check
npm run worker:prepare
```

**ロールバック境界:**
- スライス 1 / 2 / 3 は別 commit にする。
- events[] 順序に触れるスライス 3 は最後に行い、専用の events 順テストが通ることを確認してから commit する。

---

### Phase 4: presentation 発火経路の一本化（cards.js 内残留分）

**目的:** cards.js 内で直接 events/presentation を組み立てている箇所を `game/logic/presentation.js` 経由に統一し、presentation 二重発火リスクを構造的に解消する。

**作業:**

1. `game/logic/presentation.js` の現在の公開 API と、cards.js 内で直接組み立てている presentation event を照合する。
2. cards.js 内の直接組み立てを `presentation.js` の helper 呼び出しに置き換える。
3. presentation.js に不足している helper があれば追加する（ただし挙動を変えない）。
4. cpu-decision.js / turn_pipeline_phases.js に残っている presentation 発火の重複経路を確認し、不要な重複を除去する。

**主対象:**
- `game/logic/cards.js`（presentation 直接組み立て → presentation.js 委譲）
- `game/logic/presentation.js`（helper 追加・整合）

**完了条件:**
- Phase 4 検証束の targeted Jest と parity 確認が通っており、Phase 0 で記録した対象スライスの期待結果（pass / fail 名一覧を含む）を維持している。
- cards.js 内に `{ type: 'placement_effects', ... }` 等の直接オブジェクト組み立てが残っていない（presentation.js の helper 経由になっている）。
- presentation 関連テスト（`game.cards.card-used-presentation.test.js`, `presentation.schedule.cpu.test.js`）が全 pass を維持している。
- presentation / playback serialisation と warning 抑制の追加検証面が維持されている。
- `turn_pipeline_phases.js` と隣接 caller に、presentation / board write の直書き経路が新たに残っていない。
- `npm run worker:prepare` を実行済みで、cards.js / presentation.js の変更が worker-public mirror に反映されている。
- mirror 更新を伴うため `test/scripts.prepare-worker-assets.test.js` が pass している。

**検証束:**
```
npx jest --runInBand --runTestsByPath test\game.cards.card-used-presentation.test.js test\presentation.schedule.cpu.test.js test\game.move-executor.presentation.test.js test\presentation.board-updated.serial.test.js test\presentation.flush.test.js test\presentation.persist-events.test.js test\presentation.warns.once.test.js test\game.pipeline-ui-adapter.sound-cue.test.js test\game.pipeline-ui-adapter.effect-logs.anchor-expire.test.js
npx jest --runInBand --runTestsByPath test\e2e\multi_turn_progression.e2e.test.js test\e2e\card_effects.e2e.test.js
npx jest --runInBand --runTestsByPath test\scripts.prepare-worker-assets.test.js
npx jest --runInBand --runTestsByPath test\local-match-server.publish-contract.test.js
npm run test:network:parity
npm run match:check
npm run worker:prepare
```

**ロールバック境界:**
- presentation.js への helper 追加と、cards.js の切り替えは別 commit にする。

---

### Phase 5: 最終同期・全回帰・完了確認

**目的:** 全 phase 完了後の最終確認と worker-public 同期。

**作業:**

1. `npm test` を全件実行し、Phase 0 ベースラインと pass 数が一致することを確認する。
   - ここでの `npm test` は `pretest -> checkall` を含む最終 full-check として扱う。slice-level の targeted Jest はこの代替にしない。
2. `npm run worker:prepare` を実行し、worker-public mirror が root と一致していることを確認する。
3. `npm run test:network:parity` と `npm run match:check` を実行し、browser runtime / local-match-server / worker runtime の publish・projection・playback parity が維持されていることを確認する。
4. API 台帳（Phase 0 で作成）と現在の module.exports を照合し、シグネチャ変化がないことを確認する。
5. 3 ファイルの行数を記録し、本文書の「目標形」との差異を報告する（目標未達の場合は次 iteration に向けた残留タスクを記録する）。
6. `01-rulebook.md` に変更が必要かどうかを確認する（このリファクタは挙動維持が前提なので通常は更新不要。ただし phase 実行中に挙動変更が必要になった場合は、その変更より先に `01-rulebook.md` を更新する）。

**完了条件:**
- 全テストが Phase 0 ベースラインと一致している。
- `worker-public/` sync が確認済みである。
- browser runtime / local-match-server / worker runtime parity が確認済みである。
- API シグネチャ台帳との照合が完了している。
- 本文書に phase 完了状況を記録してある。

**検証束:**
```
npm test
npm run test:network:parity
npm run match:check
npx jest --runInBand --runTestsByPath test\index.card-module-scripts.test.js test\index.local-script-paths.test.js test\ui.owner-helpers-classic-script-load.test.js test\scripts.prepare-worker-assets.test.js
npm run worker:prepare
```

**ロールバック境界:** Phase 5 はコード変更なし。確認のみ。

---

## 5. 横断リスクと対策

### 5.1 UMD / CommonJS 二重経路

**リスク:** 3 ファイルはすべて UMD パターンで書かれており、browser script load と CommonJS require の両方を通る。新規モジュールが CommonJS のみで書かれた場合、browser 側で `undefined` 参照になる。

**対策:** 新規モジュール（cpu-card-policy.js, cpu-action-builder.js, turn helper 群）はすべて UMD パターンで記述する。既存の `game/ai/cpu-policy-core.js` や `game/logic/cards-internal/pending-state-manager.js` の UMD パターンをテンプレートとして使う。browser 側の参照は `index.html` / `worker-public/index.html` の script load order と照合し、`test/index.card-module-scripts.test.js` と `test/index.local-script-paths.test.js` を必ず通す。

### 5.2 pending state の整合

**リスク:** cards.js, cpu-decision.js, turn_pipeline_phases.js の三者が `pending-state-manager.js` を介して同じ pending state を操作している。委譲の途中で pending 開始 / キャンセル / 進行のどれかが二重実行されると game state が壊れる。

**対策:** Phase 1 の委譲は「既に pending-state-manager.js に委譲済みの関数を shim 化する」ことから始める。新たな pending 操作を別の場所に追加しない。各スライス後に `game.cards.pending-state-manager-module.test.js` と pending 関連 e2e テストを必ず実行する。

### 5.3 events[] 順序とフリップ演出（Spec B）

**リスク:** turn_pipeline_phases.js の整理中に events[] の組み立て順序が変わると、Spec B フリップ演出が崩れる。`pipeline_ui_adapter.js` のテストがこれを検出するが、修正が diff に紛れる可能性がある。

**対策:** Phase 3 スライス 3 は events[] 順序を変えることを禁止する。Single Visual Writer invariant として「game logic は順序付き events を生成する」「`pipeline_ui_adapter.js` が canonicalize する」「playback / presentation 経路だけが board DOM / state write を適用する」を明示契約として維持する。変更後は `game.pipeline-ui-adapter.chain-flip-order.test.js` と `game.pipeline-ui-adapter.regen-flip-order.test.js` を必ず確認する。変更前後で events[] の JSON 出力を比較するスナップショットテストがある場合はそれも実行する。

### 5.4 worker-public 同期漏れ

**リスク:** root の cards.js / cpu-decision.js を変更しても `worker-public/` の対応ファイルを更新しなければ、network 対戦ゲームが壊れる。

**対策:** Phase 1 / 2 / 3 の各 phase 完了時に `npm run worker:prepare` を実行し、sync を確認してから phase 完了とする。新規作成ファイルが worker-public に含まれる必要がある場合は `scripts/prepare-worker-assets.js` を確認して include 設定を追加する。

### 5.5 local-match / browser / worker runtime parity

**リスク:** この plan の変更は headless helper 抽出でも、publish contract・projection・playback queue には local-match-server / browser runtime / worker runtime の 3 面で波及する。`worker-public/` sync だけを見て parity 確認を後回しにすると、network 対戦だけで turn handoff や publish 応答が崩れる。

**対策:** parity は Phase 5 の「追加確認」ではなく phase 設計の一部として扱う。Phase 0 で `npm run test:network:parity`, `npm run match:check`, `test/local-match-server.publish-contract.test.js` の存在をベースライン化し、Phase 3 / 4 と Phase 5 で再実行する。必要に応じて `test/game.network-turn-handoff.test.js`, `test/game.move-executor.presentation.test.js`, `test/presentation.persist-events.test.js` を同束で確認する。

### 5.6 CPU entrypoint / selfplay 検証の取り違え

**リスク:** `src/engine/selfplay-runner.js` は `game/cpu-decision.js` を直接 consume していないため、ここを direct consumer と誤認すると検証対象を外す。実際の影響確認では browser 側 entrypoint の `game/cpu-turn-handler.js` と、headless 側の `test/selfplay.runner.test.js` / TurnPipeline 系テストを両方見る必要がある。

**対策:** Phase 2 の全 shim は module.exports のシグネチャを変えない。完了時は `test/cpu.turn-handler.*`, `test/cpu.decision.*`, `test/selfplay.runner.test.js` を実行し、必要に応じて classic script include 変更があれば `test/index.card-module-scripts.test.js` と `test/index.local-script-paths.test.js` も通す。

### 5.7 CPU コメンタリとの連鎖

**リスク:** `game/ai/cpu-commentary-runtime.js` と `game/cpu-turn-handler.js` は cpu-decision.js の内部的な判断経路（card 選択スコア、ONNX confidence）を参照している場合がある。Phase 2 で関数を移動すると commentary が壊れる可能性がある。

**対策:** Phase 2 の前に `game.cpu-turn-handler.commentary.test.js` と `cpu.commentary-runtime.test.js` を確認し、cpu-decision.js の何を参照しているかを調べる。commentary が参照している関数は Phase 2 後も cpu-decision.js の shim から参照できることを保証する。

---

## 6. 実行順序の理由

### 6.1 Phase 0 が必須である理由

検証ベースラインがない状態でコードを動かすと、既存のバグと新規導入バグを区別できない。Phase 0 は「今何が通っているか」を固定するだけで、リファクタ全体の安全網になる。

### 6.2 Phase 1 → 2 → 3 の順序の理由

- **Phase 1 (cards.js)** は独立した効果関数の移動であり、pending state や CPU との連鎖が最も少ない。最初に行うことでリスクが低いうちに進められる。
- **Phase 2 (cpu-decision.js)** は cards.js の公開 API が安定した後で行う。cpu-decision.js は cards.js を呼び出すため、cards.js の shim が安定していることが前提になる。
- **Phase 3 (turn_pipeline_phases.js)** は cards.js と cpu-decision.js の両方を呼び出す最上位レイヤーである。下位が安定してから整理する。

### 6.3 Phase 4 を後回しにする理由

presentation 発火経路の一本化は挙動に近い変更であり、presentation helper の設計が安定していない状態で行うと誤った整理になる。Phase 1〜3 で cards.js / phases.js の構造が整理されてから行う方が、presentation 経路の全体像が見えやすい。

### 6.4 Phase 5 が分離している理由

最終同期は「コードを変えない確認フェーズ」であり、コード変更と混ぜると同期ミスが発生する。Phase 5 は確認のみとする。

---

## 7. 完了定義

このリファクタ全体が完了したとみなせる条件を以下に定める。

### 7.1 必須条件

- [ ] `npm test` が Phase 0 ベースラインと同じ pass 数で終わる（fail 増加なし）。
- [ ] `game/logic/cards.js` が薄い facade（目安: 1,000 行以下）になっており、各関数は委譲先モジュールへの shim になっている。
- [ ] `game/cpu-decision.js` が政策ハブ（目安: 2,000 行以下）になっており、カード政策・action builder は `game/ai/cpu-card-policy.js` / `game/ai/cpu-action-builder.js` に移動している。
- [ ] `game/turn/turn_pipeline_phases.js` がオーケストレータ（目安: 1,000 行以下）になっており、per-card インライン分岐は `game/turn/` helper / `game/logic/cards/*` pure helper へ委譲されている。
- [ ] 3 ファイルの公開 API（module.exports 列挙）が Phase 0 時点のシグネチャと一致している。
- [ ] Single Visual Writer / playback contract（game logic → `pipeline_ui_adapter.js` → playback / presentation）が維持され、board DOM / state write の新規経路が増えていない。
- [ ] classic script 依存を追加・変更した場合、`test/index.card-module-scripts.test.js` と `test/index.local-script-paths.test.js` が pass している。
- [ ] `worker-public/` が `npm run worker:prepare` で root と一致している。
- [ ] browser runtime / local-match-server / worker runtime parity が `npm run test:network:parity` と `npm run match:check` で確認されている。
- [ ] `01-rulebook.md` に変更が不要であることを確認済みである（本リファクタは挙動維持前提であり、挙動変更が必要になった phase では先行更新する）。

### 7.2 任意条件（次 iteration の指針）

- 各ファイルに対する単体テスト（モック前提の責務別テスト）が新規追加されている。
- `game/ai/cpu-action-builder.js` のテストが独立して存在する。
- presentation 発火経路テストが `game/logic/presentation.js` 単体で実行できる。

### 7.3 完了宣言の手順

1. Phase 5 検証束の全コマンドを実行し、結果を本文書の進捗メモに追記する。
2. Phase 0 ベースラインとの pass 数比較を記録する。
3. 3 ファイルの最終行数を記録する。
4. `01-rulebook.md` 更新が不要であることを確認する（挙動変更 phase を含めなかった場合に限る）。
5. 本文書の「状態: Draft」を「状態: 完了」に更新する。

---

## 付録: テストファイル対応表

| 変更ターゲット | 対応テストファイル（抜粋） |
|---|---|
| game/logic/cards.js | `game.cards.charge-ledger-module.test.js`, `game.cards.pending-state-manager-module.test.js`, `game.cards.markers-module.test.js`, `game.cards.expansion-module.test.js`, `game.cards.card-used-presentation.test.js`, `game.cards.markers-duration-module.test.js`, `game.cards.effect-timing-module.test.js`, `game.cards.hand-manager-module.test.js`, `game.cards.reshuffle-cycle.test.js`, `game.hyperactive-inherit-will.test.js`, `ui.animation-engine.inherited-hyperactive-timer.test.js`, `ui.animation-engine.guard-timer.test.js`, `ui.long-press-info.test.js`, `ui.card-detail-effect-tags.test.js`, `ui.network-snapshot.hyperactive-source-empty.test.js` |
| game/cpu-decision.js | `cpu.decision.pending-selection-continue-turn.test.js`, `cpu.decision.refactor.test.js`, `cpu.decision.selection-only-movement.test.js`, `cpu.compute.test.js`, `cpu.commentary-runtime.test.js`, `cpu.aisystem.helper.test.js`, `cpu.turn-handler.commentary.test.js`, `game.cpu-policy-core.test.js`, `game.cpu-policy-onnx-runtime.test.js`, `game.cpu-policy-table-runtime.test.js`, `game.pending-target-selector.test.js`, `selfplay.runner.test.js`, `selfplay.runtime-parity.test.js`, `selfplay.policy-onnx-gate.test.js` |
| game/turn/turn_pipeline_phases.js | `game.turn-pipeline.destroy-hand-card.test.js`, `game.turn-pipeline.out-of-turn.test.js`, `game.turn-pipeline-strong-will-timer.test.js`, `game.double-place-pipeline.test.js`, `game.ultimate-hyperactive.turn-start.test.js`, `game.observer-will.test.js`, `game.ribo-will.test.js`, `game.network-turn-handoff.test.js`, `game.pass-handler.test.js` |
| classic script load order | `index.card-module-scripts.test.js`, `index.local-script-paths.test.js`, `ui.owner-helpers-classic-script-load.test.js` |
| pipeline_ui_adapter / presentation | `game.pipeline-ui-adapter.*.test.js` 全件, 特に `game.pipeline-ui-adapter.spawn.test.js`, `game.pipeline-ui-adapter.salvation-disappear-timing.test.js`, `game.pipeline-ui-adapter.salvation-sound-cue.test.js`, `ui.card-use-source-element.test.js`, `game.move-executor.presentation.test.js`, `presentation.board-updated.serial.test.js`, `presentation.flush.test.js`, `presentation.persist-events.test.js`, `presentation.warns.once.test.js` |
| network / worker parity | `test/local-match-server.publish-contract.test.js`, `test/scripts.prepare-worker-assets.test.js`, `npm run test:network:parity`, `npm run match:check` |
| e2e | `test/e2e/card_effects.e2e.test.js`, `test/e2e/cpu.e2e.test.js`, `test/e2e/cpu_auto_response.e2e.test.js`, `test/e2e/cpu_level_diff.e2e.test.js`, `test/e2e/destroy-card-will-hunter-king.e2e.test.js`, `test/e2e/multi_turn_progression.e2e.test.js`, `test/e2e/reset_click.e2e.test.js`, `test/e2e/special_effects.e2e.test.js` |

