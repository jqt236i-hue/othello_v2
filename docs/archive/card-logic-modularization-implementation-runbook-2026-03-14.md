# カードロジック分割 実装設計・計画・実行手順書

作成日: 2026-03-14
対象: game / cards / ui / shared / src / worker-public / docs
状態: 完了（有限完了スコープ達成。Phase 0 / 1 / 固定 Phase 2 / Phase 5 完了）

## 0. この文書の位置づけ

- この文書は、カードロジック分割を実装に着手できる粒度へ落とした設計書兼 runbook である。
- 一次仕様は引き続き 01-rulebook.md とし、挙動や見え方が変わる実装に入る前に 01-rulebook.md を更新する。
- この文書は、既存のリファクタ計画群のうち、カードロジック分割に関係する部分を実装順へ再編した補助計画である。
- 目的は「理想論の整理」ではなく、「安全に着手し、途中で止まらず、検証と同期まで完了できる具体手順」を固定することにある。

## 0.1 進捗メモ

- 2026-03-14: Phase 1-A として pending-state-manager を追加し、cards.js / worker-public cards.js の pending 初期化と cancel 処理を委譲済み。
- 2026-03-14: Phase 1-B として charge-ledger を追加し、setChargeValue / addChargeValue / addChargeWithTotal を委譲済み。
- 2026-03-14: Phase 2 の先行 1 スライスとして TIME_BOMB の applyTimeBombWill を既存の cards/time_bomb.js へ委譲済み。
- 2026-03-14: Phase 2 の追加スライスとして EXTEND_LIFE_WILL / CORROSION_WILL の duration 操作を既存の cards/markers.js へ委譲済み。
- 2026-03-14: Phase 2 の固定スコープとして STRONG_WIND_WILL / SUPER_BUOYANCY_WILL / SUPER_GRAVITY_WILL を cards/movement.js へ委譲済み。
- 2026-03-14: Phase 2 の固定スコープとして TELEPORT_WILL / CELL_TELEPORT_WILL を cards/teleport.js へ委譲済み。
- 2026-03-14: Phase 2 の固定スコープとして CLONE_WILL / SPLIT_WILL を cards/clone.js へ委譲済み。
- 2026-03-14: Phase 2 の固定スコープとして METEOR_WILL を cards/meteor.js へ委譲済み。
- 2026-03-14: root 正本から npm run worker:prepare を実行し、mirror-verified を確認済み。
- 2026-03-14: 完遂条件の代表回帰として index / pending / CPU / selfplay / presentation の Jest を再実行し、通過済み。
- 2026-03-14: ここまでの変更は内部整理のみであり、01-rulebook.md の仕様更新は不要。

## 0.2 この runbook の終了点

- この runbook は「カードロジック分割の第一段階」を有限個の作業で終えるための計画書とする。
- 完了対象は Phase 0、Phase 1、Phase 2 の固定スコープ、Phase 5 の最終同期までとする。
- Phase 3 の cards/ 層境界整理と Phase 4 の presentation 発火整理は、この runbook の完了条件に含めない。
- つまり、この runbook は cards.js の横断責務整理と、低リスクな個別効果 bridge の完了で終了してよい。
- この runbook 完了後に残る高難度整理は、別計画へ切り出して扱う。

## 0.3 無限化防止ルール

- 「次に進めるなら」を無制限に足さない。この runbook で扱う個別効果は Phase 2 の固定リストまでに限定する。
- 固定リスト以外のカード効果、cards/card-interaction.js 境界整理、presentation 経路整理は、今回の完了判定から外す。
- 固定リストを完了し、Phase 5 の同期と最終回帰が終わった時点で、この計画は完了として閉じる。

## 1. 目的

- game/logic/cards.js を即座に消すのではなく、公開入口を保ったまま内部責務を分離する。
- cards/ の責務を UI と表示カタログへ寄せ、効果ロジックは game/ 側へ集約する。
- pending target、CPU 判断、presentation、worker-public 同期を壊さずに、段階的に cards.js の肥大を減らす。
- 分割のたびに browser と headless と worker-public の差異が広がらない状態を維持する。

## 2. 非目標

- 新カード仕様の追加
- カード効果の見た目変更
- CPU バランス調整そのもの
- 完全な 1 カード 1 ファイル化
- worker-public の構造再設計
- cards/ を完全独立パッケージにする作業

## 3. 現状認識

### 3.1 現状の構造

- cards/catalog.json がカード定義の一次情報であり、cards/catalog.js と cards/catalog.generated.js が表示・実行時の補助を担う。
- cards/ 配下は本来 UI とカタログ責務だが、cards/card-interaction.js には game 側内部参照がまだ残っている。
- game/logic/cards.js は公開入口として広く参照されている一方、内部では cards/ と cards-internal/ の補助モジュールへ一部委譲済みである。
- pending target は cards.js 単独ではなく、game/logic/cards.js、game/turn-handlers/pending-target-selector.js、game/cpu-decision.js、src/engine/selfplay-runner.js に分担されている。
- presentation は game/logic/presentation.js が helper として存在するが、turn pipeline、cpu、個別 effect からの発火経路も残っている。
- worker-public は root 正本を prepare でミラーする運用であり、設計の正本は root 側に置く。

### 3.2 既に分離済みの領域

- cards-internal/card-usage-prechecks.js
- cards-internal/selector-orchestrator.js
- cards-internal/hand-manager.js
- cards-internal/effect-timing.js
- cards/expansion.js
- cards/markers.js
- cards/sniper.js
- cards/chain.js
- cards/time_bomb.js
- cards/breeding.js

### 3.3 まだ重い領域

- applyCardUsage 周辺
- pending state の段階管理
- charge 会計と副次的メタ更新
- presentation 発火の経路散在
- cards/card-interaction.js の game 内部参照

## 4. 設計原則

1. 公開入口は極力維持し、まず内部だけを分離する。
2. game/ から ui/ へ直接依存を増やさない。
3. cards/ に効果ロジックを持ち込まない。
4. cpu/ は読み取り専用を守り、DOM、UI、音、タイマーを直接触らない。
5. generic な pending target の chooser/action builder と、async ONNX / rerank を同じ場所に混ぜない。
6. presentation helper は共通化を進めるが、現状の複数発火経路を前提にした移行手順にする。
7. root を正本、worker-public を mirror として扱う。
8. browser の script load order と CommonJS require 経路を混同しない。
9. 1 スライスで 1 種類の責務移動に絞る。
10. 挙動が変わる場合のみ 01-rulebook.md を先に更新する。

## 5. 目標構成

### 5.1 到達したい構成

- game/logic/cards.js
  - 公開 API の維持
  - createCardState
  - initGame
  - applyCardUsage
  - onTurnStart
  - applyPlacementEffects
  - flushPresentationEvents
  - emitPresentationEvent
  - 内部モジュールへの委譲
- game/logic/cards-internal/
  - card-usage-prechecks.js
  - selector-orchestrator.js
  - hand-manager.js
  - effect-timing.js
  - pending-state-manager.js 新設候補
  - charge-ledger.js 新設候補
- game/logic/cards/
  - expansion.js
  - markers.js
  - sniper.js
  - chain.js
  - time_bomb.js
  - breeding.js
  - 今後切り出せる純粋効果モジュール
- game/turn-handlers/pending-target-selector.js
  - generic な target chooser
  - generic な action builder
  - CPU / selfplay 両用の pure 入口
- game/cpu-decision.js
  - async ONNX、latency budget、rerank
  - selector module の wrapper
- game/logic/presentation.js
  - 共通 helper
  - persist / flush の補助
- ui/presentation-handler.js
  - flush と playback の消費
- ui/playback-engine.js
  - UI 側再生

### 5.2 重要な境界

- cards/ は UI / catalog 寄り、effect logic は game/
- pending selector の pure 部分は turn-handlers、runtime adapter は cpu-decision
- presentation helper は game 側、再生は ui 側
- worker-public は root の mirror

## 6. 実装フェーズ

## Phase 0: 事前固定

### 目的

- 分割前の安全網を固定する。
- 既知の境界違反を洗い出し、今回触らない部分を明示する。

### 作業

1. 代表テストをグリーンに固定する。
2. browser load order を再確認する。
3. worker-public の prepare 経路を確認する。
4. cards/card-interaction.js の内部参照箇所をメモする。

### チェックリスト

- [x] test/index.card-module-scripts.test.js が通る
- [x] test/game.pending-target-selector.test.js が通る
- [x] test/game.cards.effect-timing-module.test.js が通る
- [x] test/cpu.decision.refactor.test.js が通る
- [x] test/selfplay.runner.test.js が通る
- [x] test/game.cards.card-used-presentation.test.js が通る
- [x] index.html と worker-public/index.html の cards-internal 読込順を確認した
- [x] worker-public の prepare 手順を確認した
- [x] 今回は 01-rulebook.md 更新が不要な理由を明示した

### 実行コマンド

```powershell
npx jest test/index.card-module-scripts.test.js test/game.pending-target-selector.test.js test/game.cards.effect-timing-module.test.js --runInBand
npx jest test/cpu.decision.refactor.test.js test/selfplay.runner.test.js test/game.cards.card-used-presentation.test.js --runInBand
```

## Phase 1: cards.js の共通責務をさらに分離する

### 目的

- カード個別効果ではなく、カード横断の共通責務から先に薄くする。
- applyCardUsage の前後で使われる共通状態管理を cards.js の外へ逃がす。

### 対象候補

- game/logic/cards.js
- game/logic/cards-internal/pending-state-manager.js 新設候補
- game/logic/cards-internal/charge-ledger.js 新設候補
- worker-public mirror

### スライス 1-A: pending state 管理抽出

#### 移したい責務

- pendingEffectByPlayer の stage 管理
- multi-select の選択回数管理
- cancel / complete / continue の分岐

#### 残す責務

- 公開 API と外部呼び出しシグネチャ
- カード種別ごとの最終ディスパッチ

#### チェックリスト

- [x] pending state の schema を変更していない
- [x] cancel 時の refund/reset 契約を変えていない
- [x] multi-select 系の stage 名を変えていない
- [x] expansion cell 前提のカードで apply-time validation が落ちていない
- [x] worker-public mirror を同期した

#### 優先テスト

```powershell
npx jest test/game.pending-target-selector.test.js test/cpu.turn-handler.pending.test.js test/selfplay.runner.test.js --runInBand
```

### スライス 1-B: charge 会計抽出

#### 移したい責務

- setChargeValue
- addChargeValue
- chargeGainedTotal 更新
- cost 消費と gain の共通 bookkeeping

#### チェックリスト

- [x] charge の上限処理を変えていない
- [x] chargeGainedTotal の集計を変えていない
- [x] cost 消費順を変えていない
- [x] RIBO 系の返済や不足時処理に副作用が出ていない
- [x] cards.js の公開 API は維持した

#### 優先テスト

```powershell
npx jest test/game.charge-delta-events.test.js test/game.ribo-will.test.js test/game.cards.card-used-presentation.test.js --runInBand
```

## Phase 2: 純粋効果を cards/ モジュールへ段階抽出する

### 目的

- 共通責務ではなく、単機能で閉じやすい効果だけを切り出す。
- cards.js の switch/case の中で、独立性の高い処理を helper 化する。

### この runbook で扱う固定スコープ

- [x] TIME_BOMB の apply bridge を既存の cards/time_bomb.js へ委譲する
- [x] EXTEND_LIFE_WILL / CORROSION_WILL の duration 操作を既存の cards/markers.js へ委譲する
- [x] STRONG_WIND_WILL / SUPER_BUOYANCY_WILL / SUPER_GRAVITY_WILL を 1 スライスとして bridge 化する
- [x] TELEPORT_WILL / CELL_TELEPORT_WILL を 1 スライスとして bridge 化する
- [x] CLONE_WILL / SPLIT_WILL を 1 スライスとして bridge 化する
- [x] METEOR_WILL を 1 スライスとして bridge 化する

### この runbook で扱わないもの

- POSITION_SWAP_WILL
- DESTROY_ONE_STONE 系
- GUARD / TRAP のように selector / apply-time / presentation / turn handoff が密結合なもの
- cards/card-interaction.js の game 内部参照整理
- presentation 発火経路の全面整理

### 優先順位

1. 軌道系や移動系で、pending state を深く持たないもの
2. 盤面 mutation が局所的なもの
3. presentation や marker の副作用が単純なもの
4. 最後に multi-select 系

### 推奨候補

- strong_wind
- super_buoyancy / super_gravity
- teleport
- meteor
- clone / split

### 後回し候補

- position swap
- sacrifice
- destroy 系
- guard / trap のように selector / apply-time / presentation が密結合なもの

### チェックリスト

- [x] cards/ 配下ではなく game/logic/cards/ 配下に置いた
- [x] switch/case の公開契約は維持した
- [x] effect 単体テストが追加または既存流用できる
- [x] 同効果の worker-public mirror を同期した
- [x] browser load order が必要なら HTML とテストを更新した

### 優先テスト

```powershell
npx jest test/game.strong-wind.test.js test/game.teleport-will.test.js test/game.clone-will.test.js test/game.split-will.test.js --runInBand
```

## Phase 3: cards/ 層の境界整理（次期計画。今回の完了条件外）

### 目的

- この Phase は次期計画へ移管し、この runbook の完了条件には含めない。
- cards/ を UI / catalog 寄りへ寄せる。
- cards/card-interaction.js の game 内部直参照を減らす。

### 対象

- cards/card-interaction.js
- cards/card-renderer.js
- 必要なら game 側の公開 helper
- worker-public/cards/*

### やること

1. board_ops 直 require の削減
2. visual-effects-map 直 require の削減
3. 公開 helper または DI 経由に差し替える

### やらないこと

- cards/ を完全独立パッケージにする
- cards/ へ効果ロジックを戻す

### チェックリスト

- [ ] cards/ に新しい effect logic を持ち込んでいない
- [ ] cards/card-interaction.js の game 内部直参照を減らした
- [ ] UI 側から見た利用 API が明確になった
- [ ] worker-public/cards/* を同期した
- [ ] UI 系テストが通った

### 優先テスト

```powershell
npx jest test/ui.card-use-source-element.test.js test/ui.long-press-info.test.js test/ui.stone-rendering.test.js --runInBand
```

## Phase 4: presentation 発火経路の整理（次期計画。今回の完了条件外）

### 目的

- この Phase は次期計画へ移管し、この runbook の完了条件には含めない。
- presentation 発火を一気に単一入口へ寄せるのではなく、helper 利用へ段階収束させる。
- emit と flush のルールを明文化し、残存する直経路を縮小する。

### 現時点の前提

- game/logic/presentation.js は共通 helper として利用されている。
- ただし cards.js、turn pipeline、cpu、effect からの複数経路がまだ残る。

### 手順

1. emitPresentationEvent の既存呼び出し元を一覧化
2. helper を通っていない経路を helper 経由へ寄せる
3. flush 側の契約を変えずに persist / replay を確認する

### チェックリスト

- [ ] event shape を変えていない
- [ ] flushPresentationEvents の契約を変えていない
- [ ] BoardOps 不在時の persist 経路を壊していない
- [ ] UI 再生順を変えていない
- [ ] cards.card-used-presentation 系テストが通る

### 優先テスト

```powershell
npx jest test/game.cards.card-used-presentation.test.js test/game.turn-pipeline.destroy-hand-card.test.js test/ui.animation-engine.guard-timer.test.js --runInBand
```

## Phase 5: worker-public 同期と最終確認

### 目的

- root 正本と worker-public mirror のズレを残さない。
- browser と headless の分岐が広がっていないことを確認する。

### 実行手順

1. root 側の変更を確定する
2. npm run worker:prepare を実行する
3. mirror-verified を確認する
4. HTML script order を含むガードテストを再実行する

### チェックリスト

- [x] root 側のみを正本として編集した
- [x] npm run worker:prepare を実行した
- [x] prepare の verify が通った
- [x] index.card-module-scripts.test.js が通った
- [x] mirror 側だけの手修正を残していない

### 実行コマンド

```powershell
npm run worker:prepare
npx jest test/index.card-module-scripts.test.js --runInBand
```

## 7. 実装順の判断基準

次の条件をすべて満たすものから先に着手する。

- 公開 API を変えずに切り出せる
- browser load order への影響が小さい
- worker-public mirror の同期コストが読める
- pending target / CPU / presentation を同時に触らなくてよい
- focused Jest で安全網を張れる

次の条件に当たるものは後回しにする。

- multi-select と apply-time validation が強く絡む
- expansion cell と stoneId bookkeeping を同時に持つ
- presentation と UI lock を同時に触る
- CPU rerank と selector fallback の両方をまたぐ

## 8. 変更ごとの標準手順

各スライスで必ず次の順番を守る。

1. 対象関数の定義元と参照元を検索する
2. 公開 API と state schema の非変更条件を書く
3. root 側だけを編集する
4. focused Jest を回す
5. worker-public が必要なら prepare する
6. script order 依存があるなら index テストを回す
7. 01-rulebook.md の更新要否を判定する
8. 差分とテスト結果を記録する

### 標準チェックリスト

- [ ] 定義元と参照元を確認した
- [ ] 公開 API を変えていない
- [ ] state schema を変えていない
- [ ] focused Jest が通った
- [ ] worker-public 同期の要否を確認した
- [ ] 必要時に npm run worker:prepare を実行した
- [ ] 01-rulebook.md 更新要否を記録した

## 8.1 この runbook の完遂条件

以下をすべて満たした時だけ、この計画は完了として終了してよい。

1. Phase 0 が完了している
2. Phase 1-A と Phase 1-B が完了している
3. Phase 2 の固定スコープ 6 項目がすべて完了している
4. Phase 5 の worker-public 同期と最終確認が完了している
5. Phase 3 と Phase 4 は次期計画へ移管済みであり、この runbook の残タスクに数えない
6. 最終回帰として、cards / pending / CPU / selfplay / index load order の代表テストが通っている

### 最終回帰マトリクス

```powershell
npx jest test/index.card-module-scripts.test.js test/game.pending-target-selector.test.js test/cpu.turn-handler.pending.test.js --runInBand
npx jest test/cpu.decision.refactor.test.js test/selfplay.runner.test.js test/game.cards.card-used-presentation.test.js --runInBand
npm run worker:prepare
npx jest test/index.card-module-scripts.test.js --runInBand
```

### 完了時の扱い

- 上の条件を満たしたら、この runbook については「次に進めるなら」を付けずに終了してよい。
- 残る高難度整理は、新しい runbook を切ってから再開する。

## 9. 受け入れ基準

以下を満たしたスライスだけを完了扱いにする。

1. 対象責務が別ファイルへ移っている
2. 公開 API の互換性が維持されている
3. focused Jest が通っている
4. worker-public mirror が必要な場合は同期されている
5. browser load order が必要な場合は index テストで守られている
6. 01-rulebook.md 更新の要否が明記されている

## 10. ロールバック指針

- 不具合が pending target に出たら、selector module の pure chooser と cpu-decision wrapper のどちらで崩れたかを先に切り分ける。
- browser だけ壊れたら、script load order と worker-public mirror のズレを先に疑う。
- presentation だけ壊れたら、emit helper と flush 経路と BoardOps fallback の順に見る。
- expansion cell を含む不具合は selector だけ戻さず、apply-time validation と stoneId bookkeeping も同時に戻す。
- cards/card-interaction.js を触った変更で UI がおかしくなったら、DI 化した箇所だけでなく board_ops / visual-effects-map 直参照の退避経路も確認する。

## 11. 最初の 2 週間の実行順

### Week 1

- Phase 0 を完了する
- Phase 1-A pending state 管理抽出の設計メモを作る
- Phase 1-A を責務境界が明確になる形で実装する
- focused Jest を回す

### Week 2

- Phase 1-B charge 会計抽出を実装する
- cards.js の差分肥大がなければ Phase 2 の最初の 1 効果だけ切り出す
- worker-public prepare と index テストまで通す

### 2 週間チェックリスト

- [ ] Phase 0 完了
- [ ] Phase 1-A 完了
- [ ] Phase 1-B 完了
- [ ] 少なくとも 1 つの純粋効果を cards/ モジュールへ抽出
- [ ] worker-public prepare が通る
- [ ] cards.js の公開 API 差分なし

## 12. 実装開始前の短い確認票

- [ ] 今回は仕様変更か、挙動維持か
- [ ] 01-rulebook.md 更新が必要か
- [ ] 触るのは root か、mirror も含むか
- [ ] browser load order に影響するか
- [ ] pending target / CPU / presentation のどれに波及するか
- [ ] focused Jest は何を回すか

## 13. 完了時の報告テンプレート

### 13.1 1 スライス完了時

- 対象:
- 目的:
- 変更した責務:
- 変えていない契約:
- 実行したテスト:
- worker-public 同期:
- 01-rulebook.md 更新有無:

### 13.2 フェーズ完了時

- フェーズ:
- 完了したスライス:
- 残タスク:
- 主なリスク:
- 次に着手する対象:

## 14. まとめ

- この計画の主眼は、cards.js を一気に壊して作り直すことではなく、公開入口を維持しながら内部責務を順番に切り離すことにある。
- 先に切るべきなのはカード個別効果より、pending state と charge のような横断責務である。
- pending target と presentation はすでに複数経路で動いているため、単純化して一箇所へ押し込むより、既存の境界を保ったまま段階収束させる。
- worker-public は最後にまとめて考えるのではなく、各フェーズ終端で同期確認する。
- この runbook は cards.js の第一段階整理だけを有限に終えるためのものであり、Phase 2 の固定スコープと Phase 5 を終えた時点で完了として閉じる。

