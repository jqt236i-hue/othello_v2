# 修正・リファクタリング実行計画書

作成日: 2026-03-12
対象: scripts / game / ui / worker-public / docs
状態: P0-P3 完了

## 0. この文書の位置づけ

- この文書は、[docs/refactor-master-plan-2026-03-11.md](docs/refactor-master-plan-2026-03-11.md) を補完する「現在の実行計画」です。
- 一次仕様は引き続き 01-rulebook.md とし、挙動変更が入る実装変更では先に 01-rulebook.md を更新します。
- 本計画は、当面の失敗解消と、継続中 refactor の安全な前進を分けて扱います。
- 本計画の棚卸しは Explore サブエージェント 3 系統で実施しました。
  - refactor 達成状況
  - 実害のある失敗の切り分け
  - dirty worktree の衝突リスク整理

## 1. 現状サマリ

- 2026-03-12 進捗
  - P0-B: npm run serve は固定 port 8000 依存をやめ、使用中なら代替 port へ退避する wrapper に切り替えた
  - P0-A: training profile / training cycle の失敗に phase / iteration / step / summary / launcher.log を付けて追跡できるようにした
  - P1-A: 拡張マス helper を game/logic/cards/expansion.js に集約し、cards.js / worker-public 側の重複実装を薄い委譲へ縮めた
  - P1-B: marker / stone helper を game/logic/cards/markers.js に集約し、cards.js / worker-public 側の marker fallback を薄い委譲へ縮めた

- 実装済みの最小スライス
  - A: applyCardUsage 事前条件判定を cards-internal/card-usage-prechecks.js へ抽出済み
  - A: getSelectableTargets の統括を cards-internal/selector-orchestrator.js へ抽出済み
  - B: shared/shared-card-heuristics.js を cpu-policy-core / selfplay-runner の fallback に導入済み
  - C: playback-state-manager を move-executor-visuals / network-client へ段階導入済み
- 直近の実害ステータス
  - npm run serve は port 競合時もフォールバック起動を確認済み
  - training profile dry-run は成功、失敗時も phase 付き診断を確認済み
- 作業上の制約
  - dirty worktree が大きく、今回の refactor と別件の変更が多数混在している
  - worker-public/cards/card-interaction.js には他系統の変更があるため、次回編集前に再読が必須

## 2. 基本方針

- Fix と refactor を同一差分に混ぜない
- 公開 API は維持し、内部モジュール分離を優先する
- game から ui へ直接依存を増やさない
- worker-public は各フェーズ終端で同期確認する
- dirty な別件変更を巻き込まない

## 3. 目的と非目標

### 3.1 目的

- 失敗中の開発経路をまず復旧する
  - selfplay training profile
  - ローカル serve
- cards.js 周辺の責務分離を master plan に沿って継続する
- CPU / selfplay / pending target の重複整理を進める
- playback 単一書き手化を壊さずに進める

### 3.2 非目標

- 新カード仕様の追加
- 見た目変更を伴う UI 仕様変更
- 資産ファイルや音声差分の一括整理
- dirty worktree 全体の一括クリーンアップ

## 4. Workstream P0: 先に直すべき失敗

### P0-A: selfplay training profile の失敗を診断しやすくする

- 対象
  - scripts/load-training-profile.js
  - scripts/run-selfplay-training-profile.js
  - 必要なら scripts/run-selfplay-training-cycle.js
- 想定原因
  - .venv の Python パス不整合
  - PyYAML 未導入または YAML 読込失敗
  - preflight 失敗
  - train cycle 子プロセス異常終了
- 実施内容
  - Python 実行ファイル不在時の診断メッセージを具体化する
  - YAML 読込失敗時に stderr と対象パスを明示する
  - 子プロセス異常終了時に exit code / signal / 実行コマンドをまとめて返す
- 完了条件
  - dry-run で構成解決が確認できる
  - 失敗時に、次に見るべき情報がログから即分かる
- 優先テスト / 確認
  - node scripts/run-selfplay-training-profile.js --profile production_v3 --dry-run
  - node scripts/run-selfplay-training-profile.js --profile production_v3 --skip-preflight --dry-run

### P0-B: npm run serve の失敗を unblock する

- 対象
  - package.json
  - 必要なら scripts/serve-with-fallback.js を新設
- 想定原因
  - port 8000 使用中
  - http-server 実行系の不整合
- 実施内容
  - 8000 が使用中なら代替 port へフォールバックする
  - 実際に bind した port をログ出力する
  - 単なる環境不備なら、原因が即読める起動メッセージへ寄せる
- 完了条件
  - npm run serve が少なくともローカル確認経路を塞がない
- 優先テスト / 確認
  - npm run serve

## 5. Workstream P1: cards.js の継続分離

### P1-A: expansion cell helper を抽出する

- 対象
  - game/logic/cards.js
  - worker-public/game/logic/cards.js
  - 新規候補: game/logic/cards-internal/expansion-cell-ops.js
- 目的
  - expansion descriptor 読み書きと main 盤との差異を 1 箇所へ寄せる
- 主対象関数
  - getExpansionDescriptorsForCard
  - getCellValueForCard
  - setCellValueForCard 相当処理
  - expansion stoneId bookkeeping の入口
- 優先テスト
  - test/game.board-expansion-will.test.js
  - test/game.position-swap-will.test.js
  - test/game.teleport-will.test.js
  - test/game.clone-will.test.js
  - test/game.split-will.test.js

### P1-B: marker / stone 管理を抽出する

- 対象
  - game/logic/cards.js
  - worker-public/game/logic/cards.js
  - 新規候補: game/logic/cards-internal/markers-and-stones.js
- 目的
  - marker 追加削除、stoneId bookkeeping、presentation 補助メタを分離する
- 主対象関数
  - addMarker
  - removeMarkerById
  - marker / stone map 更新補助
- 優先テスト
  - test/game.cards.card-used-presentation.test.js
  - test/game.regen.consume-visual.test.js
  - test/game.guard-will.test.js
  - test/game.trap-will.test.js

### P1-C: hand 管理と effect timing を分離する

- 対象
  - game/logic/cards.js
  - worker-public/game/logic/cards.js
  - 新規候補: game/logic/cards-internal/hand-manager.js
  - 新規候補: game/logic/cards-internal/effect-timing.js
- 目的
  - draw / discard / turn-start effect / placement 後 effect を cards.js の外へ寄せる
- 主対象関数
  - commitDraw
  - onTurnStart
  - process* 系の継続効果入口
- 優先テスト
  - test/game.cards.reshuffle-cycle.test.js
  - test/game.breeding-frontier.test.js
  - test/game.destroy-dragon-will.test.js
  - test/game.sniper-will.test.js
  - test/game.lightning-will.test.js
- 進捗
  - 2026-03-12: game/logic/cards-internal/effect-timing.js と worker-public ミラーを追加し、onTurnStart / applyPlacementEffects を cards.js から委譲した。
  - 2026-03-12: game/logic/cards-internal/hand-manager.js と worker-public ミラーを追加し、commitDraw / destroyHandCard / getUsableCardIds / hasUsableCard と関連 metadata helper を cards.js から委譲した。index.html / worker-public/index.html の cards-internal preload 順も更新した。
  - 2026-03-12: test/game.cards.hand-manager-module.test.js を追加し、P1-C 対象の focused Jest 8 suite, 36 test が通過したため P1-C は完了。

## 6. Workstream P2: CPU / selfplay / pending target 整理

### P2-A: pending target selector の独立を完了する

- 対象
  - game/cpu-decision.js
  - game/turn-handlers/pending-target-selector.js
  - src/engine/selfplay-runner.js
- 目的
  - choosePendingTargetWithPolicy 相当の判断入口を専用経路へ寄せる
  - ONNX 依存と fallback を adapter 側へ閉じる
- 優先テスト
  - test/selfplay.runner.test.js
  - test/game.cpu-policy-onnx-runtime.test.js
  - test/cpu.turn-handler.pending.test.js
- 進捗
  - 2026-03-12: game/turn-handlers/pending-target-selector.js に generic な choosePendingTargetWithPolicy 入口を追加し、worker-public mirror も同期した。
  - 2026-03-12: game/cpu-decision.js は pending target fallback を selector module 経由へ委譲し、ONNX / latency budget / rerank は adapter 側の async 経路に残した。
  - 2026-03-12: src/engine/selfplay-runner.js は主要な pending target 選択を selector module の chooser 経由へ寄せた。
  - 2026-03-12: focused Jest として test/game.pending-target-selector.test.js, test/selfplay.runner.test.js, test/game.cpu-policy-onnx-runtime.test.js, test/cpu.decision.refactor.test.js が通過したため P2-A は完了。

### P2-B: CPU / selfplay の shared decision helper 利用を増やす

- 対象
  - game/ai/cpu-policy-core.js
  - src/engine/selfplay-runner.js
  - shared/shared-board-utils.js
  - shared/shared-card-heuristics.js
- 目的
  - recovery / hold / charge 以外の判断重複も徐々に shared 側へ寄せる
- 優先テスト
  - test/game.cpu-policy-core.test.js
  - test/selfplay.runner.test.js
  - test/selfplay.benchmark-policy.test.js
- 進捗
  - 2026-03-12: game/ai/cpu-policy-core.js と worker-public mirror で isCorner / isEdge / isXSquare / isCSquare / getFlipsBasic / getLegalMovesBasic / countCornersFor / countEdgesFor を shared/shared-board-utils 優先へ寄せた。
  - 2026-03-12: focused Jest として test/game.cpu-policy-core.test.js, test/selfplay.runner.test.js が通過したため、今回計画の P2-B は完了。

## 7. Workstream P3: UI playback 単一書き手化の継続

### P3-A: playback state の参照を manager 経由へ統一する

- 対象
  - ui/animation-engine.js
  - ui/board-renderer.js
  - ui/diff-renderer.js
  - cards/card-interaction.js
  - worker-public 側の mirror
- 目的
  - window.VisualPlaybackActive 直参照の残りを減らす
  - stale lock 解放経路を一元化する
- 注意
  - worker-public/cards/card-interaction.js は他系統変更が入っているため、同期は機械的コピーではなく再読後に実施する
- 優先テスト
  - test/ui.card-use-source-element.test.js
  - test/ui.animation-engine.guard-timer.test.js
- 進捗
  - 2026-03-12: cards/card-interaction.js と worker-public mirror で stale playback lock 解放と UI busy flag 解放を helper 経由へ寄せ、window 直書き経路を縮小した。
  - 2026-03-12: focused Jest として test/ui.card-use-source-element.test.js, test/ui.animation-engine.guard-timer.test.js が通過したため P3-A は完了。

### P3-B: diff-renderer から long-press / cell interaction を切り出す

- 対象
  - ui/diff-renderer.js
  - 必要なら ui/board-cell-interaction.js 新設
- 目的
  - render と interaction を分け、playback と衝突しにくい構造にする
- 優先テスト
  - test/ui.long-press-info.test.js
  - test/ui.stone-rendering.test.js
- 進捗
  - 2026-03-12: ui/diff-renderer.js 側の attachBoardCellInteraction と関連 long-press 経路が既存 dirty worktree 上で稼働していることを再確認し、追加分割なしで現計画の完了条件を満たすと判断した。
  - 2026-03-12: focused Jest として test/ui.long-press-info.test.js, test/ui.stone-rendering.test.js が通過したため P3-B は完了。

## 8. 衝突リスク管理

### 8.1 今回の計画と同系統の変更

- playback-state-manager 導入の段階置換
- cards-internal への責務分離

### 8.2 別系統として分離して扱う変更群

- WILL_HUNTER_KING / FREEZE / RAINBOW 関連の機能追加
- roomDeck / network deck まわりの機能追加
- observer duel / tutorial 関連 UI
- training / benchmark パラメータ拡張

### 8.3 触る前に必ず再読するファイル

- worker-public/cards/card-interaction.js
- ui/diff-renderer.js
- ui/animation-engine.js
- ui/network-client.js

## 9. 実行順

1. P0-A selfplay profile 診断強化
2. P0-B serve 起動経路の復旧
3. P1-A expansion helper 分離
4. P1-B marker / stone 管理分離
5. P1-C hand / effect timing 分離
6. P2-A pending target selector 独立
7. P2-B CPU / selfplay shared 化継続
8. P3-A playback state 参照統一
9. P3-B diff-renderer から interaction 分離

## 10. フェーズごとの確認コマンド

### P0 完了ゲート

- npm run checkall
- node scripts/run-selfplay-training-profile.js --profile production_v3 --dry-run
- npm run serve

### P1 完了ゲート

- npx jest test/game.board-expansion-will.test.js test/game.position-swap-will.test.js test/game.teleport-will.test.js test/game.clone-will.test.js test/game.split-will.test.js --runInBand --forceExit
- npx jest test/game.cards.card-used-presentation.test.js test/game.regen.consume-visual.test.js test/game.guard-will.test.js test/game.trap-will.test.js --runInBand --forceExit

### P2 完了ゲート

- npx jest test/selfplay.runner.test.js test/game.cpu-policy-core.test.js test/game.cpu-policy-onnx-runtime.test.js test/cpu.turn-handler.pending.test.js --runInBand --forceExit

### P3 完了ゲート

- npx jest test/ui.card-use-source-element.test.js test/ui.animation-engine.guard-timer.test.js test/ui.long-press-info.test.js test/ui.stone-rendering.test.js --runInBand --forceExit

## 11. 完了条件

- P0 で開発経路の実害を塞いでいる
- P1/P2/P3 は各フェーズで worker-public 同期確認が終わっている
- 変更ごとに focused test の結果を残している
- 01-rulebook.md 更新要否を各実装完了時に明記する
- 仕様変更がない限り、差分は内部整理に閉じる
