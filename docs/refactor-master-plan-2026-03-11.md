# 最優先リファクタリング計画書

作成日: 2026-03-11
対象: game / ui / src / scripts
状態: 実施中

## 0. この文書の位置づけ

- この文書は、現時点で最優先と判断した 3 つのリファクタリング対象について、実装順序と安全策を固定するための計画書です。
- 一次仕様は引き続き 01-rulebook.md です。
- この文書は挙動変更の宣言ではなく、挙動維持を前提に内部構造を整理するための作業計画です。
- 実装中に挙動や見え方が変わる場合は、対象コミットに入る前に 01-rulebook.md を更新します。

### 0.1 2026-03-12 実施済みの最小スライス

- A: applyCardUsage の事前条件判定を game/logic/cards-internal/card-usage-prechecks.js へ抽出し、worker-public 側も同期した。
- A: getSelectableTargets の pending selector 統括を game/logic/cards-internal/selector-orchestrator.js へ抽出し、browser 版 index.html / worker-public/index.html でも内部モジュールを cards.js より先に読むよう固定した。
- A: 拡張マス descriptor 読み書きと ensureExpansionCellForCard を game/logic/cards/expansion.js へ集約し、cards.js / worker-public 側は薄い委譲へ縮めた。
- A: marker 追加削除と stoneId bookkeeping を game/logic/cards/markers.js へ集約し、cards.js / worker-public 側は marker helper の fallback を薄い委譲へ縮めた。
- B: game/ai/cpu-policy-core.js と src/engine/selfplay-runner.js が shared/shared-card-heuristics.js を共有 fallback として先に参照する形へ寄せた。
- C: ui/move-executor-visuals.js と ui/network-client.js の playback 関連フラグ参照を playback-state-manager 経由に寄せ、worker-public 側も同期した。

### 0.2 2026-03-12 現在の戦術計画

- 直近の修正と継続 refactor を分けて進めるため、docs/fix-refactor-stabilization-plan-2026-03-12.md を併用する。

### 0.3 2026-03-12 P0 実施メモ

- scripts/run-selfplay-training-profile.js と scripts/run-selfplay-training-cycle.js の失敗表示を phase / iteration / step / summary / launcher.log 付きへ強化した。
- npm run serve は scripts/serve-with-fallback.js 経由に切り替え、8000 使用中でも別 port へ退避して継続確認できるようにした。

## 1. 結論

最優先の実装順は次の通りです。

1. カード論理の本体整理
2. CPU 判断と selfplay 判断の重複整理
3. UI プレイバック系の単一書き手化

この順序にした理由は次の通りです。

- カード論理は game 層の一次情報源であり、CPU と UI の両方が依存している。
- CPU と selfplay は cards.js の上に意思決定知識を積んでいるため、先に下地を安定させた方が安全。
- UI プレイバックは最も壊れやすいが、上流のイベント生成と判断経路が固まってから触った方が差分を小さく保てる。

## 2. 調査サマリ

今回の優先順位は、規模、責務密度、既知の不具合傾向、テスト負荷を合わせて決めた。

- game/logic/cards.js は約 6135 行、定義数 203。カード状態生成、手札、ドロー、対象列挙、個別効果、継続効果、拡張盤処理、presentation 連携が同居している。
- game/cpu-decision.js は約 4700 行、定義数 142。さらに game/ai/cpu-policy-core.js 約 3758 行、src/engine/selfplay-runner.js 約 3475 行に同種ロジックが再実装されている。
- ui/animation-engine.js 約 2108 行、ui/diff-renderer.js 約 1762 行、game/turn/pipeline_ui_adapter.js 約 1844 行、cards/card-interaction.js 約 1652 行で、再生ロックや presentation 消費が複数箇所に散っている。
- 代表テストとして、test/game.cards.card-used-presentation.test.js、test/cpu.decision.refactor.test.js、test/selfplay.runner.test.js、test/ui.animation-engine.guard-timer.test.js が広い専用回帰面を持っている。

## 3. 進め方の原則

- 公開入口は極力維持し、まず内部だけを分離する。
- game は ui に直接依存しない。
- ui は game の公開 API とイベントだけを使う。
- cpu は読み取り専用を守り、DOM、UI、音、タイマーを直接触らない。
- owner / player / color の正規化地点は増やさない。
- presentationEvents と playback lock は途中で意味を変えない。
- worker-public との同期が必要な箇所は、最後にまとめてではなく各フェーズ終端で検証する。
- 1 コミットで 1 種類の責務移動だけを行い、無関係な掃除を混ぜない。

## 4. 全体ロードマップ

### 4.1 フェーズ順

#### Phase 0: ベースライン固定

- 既存の代表テストを通した状態を記録する。
- cards、cpu、selfplay、ui-playback の代表ケースを固定する。
- worker-public が絡む箇所は同期方針を明文化する。

#### Phase 1: カード論理の分割

- 対象: game/logic/cards.js 周辺
- 目的: 一次情報源を薄くし、下流が読む内部 API を安定させる。

#### Phase 2: CPU / selfplay 判断の統合

- 対象: game/cpu-decision.js、game/ai/cpu-policy-core.js、src/engine/selfplay-runner.js
- 目的: 同じ判断知識の再実装を減らし、runtime adapter と pure logic を分ける。

#### Phase 3: UI プレイバック系の単一書き手化

- 対象: ui/animation-engine.js、ui/diff-renderer.js、ui/playback-engine.js、game/turn/pipeline_ui_adapter.js、cards/card-interaction.js
- 目的: playback state、event emission、再生中ガードを 1 経路へ寄せる。

### 4.2 マイルストーン

#### M0: ベースライン完了

- 代表テストのグリーンを確認済み
- 各ワークストリームの非目標を固定済み

#### M1: カード論理の基礎分離完了

- cards.js から拡張盤補助、hand 管理、selector 統括、marker 管理の責務が抜け始めている
- 公開 API の互換性が維持されている

#### M2: 判断ロジックの共有化完了

- selfplay と browser CPU が同じ pure helper 群を使う
- ONNX、policy-table、heuristic の adapter 層が分離されている

#### M3: UI 再生統制完了

- playback lock の単一ソースが決まっている
- diff-renderer と animation-engine の役割競合が解消している

## 5. ワークストリーム A: カード論理の本体整理

### 5.1 目標

- game/logic/cards.js を一次情報の公開面に寄せる。
- 手札、selector、拡張盤、marker、継続効果を内部モジュールへ分離する。
- expansion cell と worker-public の事故を減らす。

### 5.2 目標構成

候補構成は次の通り。

- game/logic/cards.js
  - createCardState
  - copyCardState
  - initGame
  - applyCardUsage
  - applyPlacementEffects
  - onTurnStart
  - flushPresentationEvents など公開入口
- game/logic/cards-internal/hand-manager.js
  - commitDraw
  - destroyHandCard
  - getUsableCardIds / hasUsableCard
  - 売却、破壊、手札上限の整合管理
- game/logic/cards-internal/selector-orchestrator.js
  - getSelectableTargets の統一ルータ
  - 各 selector の入口チェック
- game/logic/cards-internal/expansion-cell-ops.js
  - getCellValueForCard
  - setCellValueForCard
  - ensureExpansionCellForCard
  - expansion cells の legacy sync
- game/logic/cards-internal/markers-and-stones.js
  - addMarker
  - removeMarkerById
  - stoneId 管理
- game/logic/cards-internal/effect-timing.js
  - turn start と placement 後の継続効果ハンドラ

### 5.3 小コミット計画

#### A1: 定数と小さなユーティリティを外へ出す

- effect duration 系、card type 判定のうち cards.js 内に閉じている小物を外出しする。
- cards.js の公開名は変えない。

#### A2: expansion cell 操作を分離する

- expansion descriptor 読み書き、getCellValue、setCellValue、stoneId の拡張盤対応を専用 helper にまとめる。
- main 盤前提の前処理を残さない。
- 2026-03-12: game/logic/cards/expansion.js に descriptor 読み書きと ensureExpansionCellForCard を寄せ、cards.js / worker-public の重複 fallback を削減した。

#### A3: selector 統括を分離する

- getTrapTargets などの入口を selector-orchestrator へ寄せる。
- selector 単体と apply-time validation を混ぜない。

#### A4: marker / stone 管理を分離する

- marker 追加削除、stoneId bookkeeping、presentation 補助メタをまとめる。
- 2026-03-12: game/logic/cards/markers.js を追加し、addMarker / removeMarkerById / stoneId bookkeeping / swapCellCoordinates を cards.js / worker-public から委譲させた。

#### A5: 継続効果処理を分離する

- onTurnStart と placement 後の process* 系を timing 単位に再配置する。
- 2026-03-12: game/logic/cards-internal/effect-timing.js を追加し、cards.js / worker-public の onTurnStart と applyPlacementEffects を thin wrapper 化した。browser では effect-timing.js を cards.js より前に読む前提にそろえた。
- 2026-03-12: game/logic/cards-internal/hand-manager.js を追加し、cards.js / worker-public の commitDraw / destroyHandCard / getUsableCardIds / hasUsableCard など手札系 API を thin wrapper 化した。browser では hand-manager.js も cards.js より前に読む前提にそろえた。

#### A6: worker-public 同期検証を明文化する

- cards.js 系の変更後に worker-public ミラーがずれないことを確認する。

### 5.4 主要リスク

- expansion cells は gameState.board に載っていないため、selector だけ直しても apply-time で壊れる。
- swap 系と sacrifice 系は target selector、apply-time validation、stone-id bookkeeping の 3 箇所を同時に見る必要がある。
- worker-public ミラーの同期漏れで browser と headless がずれる。

### 5.5 受け入れ基準

- cards.js の公開 API は維持される。
- expansion cell を含む既存テストが同じ期待値で通る。
- hand / selector / marker / expansion の責務が別ファイルに分かれている。
- worker-public 側の同等テストが落ちない。

### 5.6 優先テスト

- npx jest test/game.cards.card-used-presentation.test.js --runInBand
- expansion 系の既存テスト群
- selector 系の既存テスト群
- 必要に応じて npm run test:jest:changed

## 6. ワークストリーム B: CPU 判断と selfplay 判断の重複整理

### 6.1 目標

- 同じ判断知識を 3 箇所で持たない。
- pure logic と runtime adapter を分ける。
- selfplay の決定性を落とさずに browser CPU と共通化する。

### 6.2 目標構成

- shared/shared-board-utils.js
  - isCorner
  - isEdge
  - isXSquare
  - isCSquare
  - getFlipsBasic
  - getLegalMovesBasic
  - 盤面評価の基礎 helper
- shared/shared-card-heuristics.js
  - isRecoveryCardType
  - isHoldCardType
  - charge / corner / edge 系の共有分類
- game/ai/cpu-policy-core.js
  - pure な scoring / ranking 中心
- game/turn-handlers/pending-target-selector.js
  - pending target の pure selector
  - async ONNX wrapper
- game/cpu-decision.js
  - UI / runtime adapter
  - pipeline 実行
  - presentation 発行
- game/cpu-decision-sync.js
  - selfplay 用の同期 adapter
- src/engine/selfplay-runner.js
  - adapter 呼び出しと state machine に専念

### 6.3 小コミット計画

#### B1: 盤面 helper の共有化

- corner 判定、legal move 計算、基本的な board transform を shared 化する。
- cpu-policy-core と selfplay-runner の重複を減らす。

#### B2: card type と plan pressure の共有化

- recovery、hold、charge ramp、plan pressure の分類定数を shared 化する。
- scoreCardUseDecision と selfplay の判断条件を寄せる。

#### B3: pending target selector を独立させる

- choosePendingTargetWithPolicy とその async wrapper を専用モジュールへ移す。
- ONNX fallback と latency gate は adapter 側に閉じ込める。

#### B4: selfplay 用同期 adapter を作る

- selfplay-runner 内の独自判断実装を cpu-decision-sync 経由へ寄せる。
- ONNX 非依存の同期経路を明示する。

#### B5: cpu-decision.js を実行オーケストレータへ縮める

- applyCardChoice、runCpuPendingSelectionViaPipeline、presentation 発行など副作用の責務に集中させる。

### 6.4 主要リスク

- selfplay は deterministic である必要があり、browser CPU の async / ONNX 経路をそのまま持ち込めない。
- pending target の質は cpuSelect* の薄い wrapper ではなく scorePendingTargetByType 側にあるため、分解単位を間違えると性能劣化する。
- target / value ONNX の capability 判定を adapter 外へ漏らすと silent ignore が起きる。

### 6.5 受け入れ基準

- shared helper を cpu-policy-core と selfplay-runner が共通利用している。
- browser CPU と selfplay が同一 seed / 同一状態で期待した一致を保つ。
- ONNX unavailable / timeout 時に fallback が維持される。
- cpu-decision.js の公開面は変えず、内部の pure logic が減っている。

### 6.6 優先テスト

- npx jest test/cpu.decision.refactor.test.js --runInBand
- npx jest test/selfplay.runner.test.js --runInBand
- pending-target / ONNX runtime 系の既存テスト群
- 必要に応じて npm run test:jest:changed

### 6.7 scripts への波及方針

- scripts/benchmark-policy-onnx-gate.js は現時点では大きいが、最優先の分割対象ではない。
- 先に shared decision core と pending-target selector を整理し、その後に benchmark-policy-onnx-gate.js、benchmark-policy-adoption.js、run-selfplay-training-cycle.js の内部重複を薄くする。
- つまり benchmark 系スクリプトは B3 以降の downstream slice として扱う。

## 7. ワークストリーム C: UI プレイバック系の単一書き手化

### 7.1 目標

- 再生中の状態判定を 1 箇所へ集約する。
- presentation event の消費入口を減らす。
- diff-renderer は再生中 fallback を抑えるだけにし、書き手になりすぎない。

### 7.2 目標構成

- ui/playback-state-manager.js
  - PLAYING / IDLE などの状態
  - suppressNextDiffFlip の管理
  - stale lock 解放の単一窓口
- ui/playback-engine.js
  - event consumption の入口
- ui/animation-engine.js
  - 実際の single visual writer
- ui/diff-renderer.js
  - playback 中は render skip と最終同期だけを担う
- cards/card-interaction.js
  - playback state を直接何通りも読むのではなく manager を経由
- game/turn/pipeline_ui_adapter.js
  - raw events から playback/log/sound への変換に集中

### 7.3 小コミット計画

#### C1: playback state manager を導入する

- VisualPlaybackActive、isCardAnimating、suppressNextDiffFlip の読み書きを一段ラップする。

#### C2: diff-renderer の責務を薄くする

- 長押し情報パネルと board cell interaction を別ファイルへ抜く。
- renderBoardDiff は差分更新に集中させる。

#### C3: card-interaction の再生待ちロジックを一本化する

- stale recovery と interaction guard を manager 経由へ寄せる。
- hand UI delay 判定の分岐を減らす。

#### C4: presentation emission helper を減らす

- emitPresentationEventViaBoardOps の薄い複製群を集約する。
- game 側の helper と ui 側の consumer の役割を明確にする。

#### C5: playback-engine と animation-engine の境界を固定する

- playback-engine は queue 消費だけ
- animation-engine は再生だけ

### 7.4 主要リスク

- stale playback lock を外す責務が複数箇所にあり、移行途中でクリック不能や二重再生が起きやすい。
- super crush 系は同 phase の MOVE と DESTROY が競合するため、DOM 書き換え主体を増やすと再発しやすい。
- diff-renderer と animation-engine の suppress flag がずれるとフリップの二重表現が起こる。

### 7.5 受け入れ基準

- playback 中の lock state の単一ソースが決まっている。
- diff-renderer は再生中に board DOM を勝手に書き換えない。
- card-interaction から window 直読みの再生フラグ参照が減っている。
- 既知の stale lock と destination race の再発テストが維持される。

### 7.6 優先テスト

- npx jest test/ui.animation-engine.guard-timer.test.js --runInBand
- stale playback / card interaction 系の既存テスト群
- presentation / playback lock 系の既存テスト群
- 必要に応じて npm run test:jest:changed

## 8. ワークストリーム間の依存関係

### 8.1 A → B

- CPU と selfplay は cards.js の card type、selector、pending state に依存する。
- cards 側の構造が揺れている状態で shared heuristics を抜くと、判断ロジックの参照先が不安定になる。

### 8.2 A → C

- presentation event の形と flush の意味が cards 側から出るため、UI 側の消費一本化は cards 側の event semantics が安定してからの方が安全。

### 8.3 B → C

- cpu-decision.js は presentation event を emit する主要経路の一つであり、ここが adapter 化されてから UI 側の consumer を整理した方が event source を減らせる。

## 9. コミット運用ルール

- 1 コミットにつき 1 モジュール抽出、または 1 種類の共有化だけに限定する。
- rename と logic move と behavior guard 追加を同じコミットで混ぜない。
- まず wrapper を挟み、その後で呼び出し元を差し替え、最後に旧実装を削除する。
- 1 フェーズごとに rollback 可能な境界を作る。

## 10. テストゲート

### 10.1 ベースライン

- npx jest test/game.cards.card-used-presentation.test.js --runInBand
- npx jest test/cpu.decision.refactor.test.js --runInBand
- npx jest test/selfplay.runner.test.js --runInBand
- npx jest test/ui.animation-engine.guard-timer.test.js --runInBand

### 10.2 フェーズごとの最低ゲート

- A 系変更
  - cards 代表テスト
  - expansion / selector 関連既存テスト
- B 系変更
  - cpu.decision.refactor
  - selfplay.runner
  - ONNX / pending-target 関連既存テスト
- C 系変更
  - ui.animation-engine.guard-timer
  - stale playback / interaction 関連既存テスト

### 10.3 フェーズ終端の共通ゲート

- npm run test:jest:changed
- npm run checkall

## 11. 先にやらないこと

- benchmark 系スクリプトの全面分割
- 新しい外部依存の導入
- UI 演出仕様の変更
- pendingEffectByPlayer のデータ構造拡張
- browser と selfplay の挙動差を一時的に許容する近道

## 12. 完了条件

- 各ワークストリームで公開入口が維持されている。
- 代表テストと関連既存テストが通っている。
- worker-public が必要箇所で同期されている。
- 01-rulebook.md の更新要否がコミットごとに判断されている。
- 下流の benchmark / training scripts は shared core を読むだけの薄い層へ近づいている。

## 13. 実行順の最終提案

最初の着手単位は次の 5 本を推奨する。

1. cards.js から expansion cell helper を抽出する
2. cards.js から selector orchestrator を抽出する
3. shared board helpers を作って cpu-policy-core と selfplay-runner に差し込む
4. pending target selector を独立させる
5. playback-state-manager を導入する

この 5 本までは、公開挙動をほぼ変えずに進めやすく、後戻りもしやすい。
