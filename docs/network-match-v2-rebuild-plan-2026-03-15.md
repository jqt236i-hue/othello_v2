# 公開ネット対戦 v2 再構築 設計・計画書

作成日: 2026-03-15
対象: ui / game / shared / workers / scripts / test / docs / worker-public
状態: Draft

## 0. この文書の位置づけ

- この文書は、公開 URL のネット対戦を「現行 v1 の延命修理」ではなく「同期中核の v2 再構築」として復旧するための master plan である。
- 一次仕様は 01-rulebook.md とし、この文書は実装方針、段階移行、非目標、完了条件を固定する。
- 関連する事実棚卸しは docs/network-authority-phase0-contract-inventory-2026-03-15.md を正本とし、公開 network の個別不具合 runbook は docs/public-network-card-fix-runbook-2026-03-14.md を参照する。
- この文書は「次に動く人が、そのまま phase を切って実装できる粒度」まで落とすことを目的とし、無限に TODO を増やすメモにはしない。

## 0.1 この計画の結論

- 現行ネット対戦 v1 は、局所修理を続ける対象ではなく、同期中核を置き換える対象として扱う。
- 残すのは UI の殻、部屋 UI、部屋番号、席管理、プレイヤー名、黒白別持ち込み deck 契約である。
- 捨てるのは、client-authored snapshot publish、client-authored playbackEvents publish、publish 応答と local optimistic state の複雑な整合、worker と local server の並行進化である。
- v2 は公開 worker を正本とした server-authoritative command 方式とし、client は「次状態」ではなく「操作」を送る。

## 0.2 v1 を延命しない理由

- デバッグモードや CPU 対局では、UI、アニメーション、効果音、基本進行は正常である。
- 公開 URL のネット対戦だけで stale click、busy lock 残留、操作不能、巻き戻り、同期崩れが出るなら、主因はゲーム本体ではなく network 専用同期層である。
- 現行 contract は command publish ではなく next snapshot publish であり、client と server の両方が局面の正しさを持とうとしている。
- 公開 worker では state/stream の viewer projection、heartbeat、turn timer、seatToken 必須、idempotency が入るため、ローカルや CPU 戦では見えない race が顕在化する。
- 既存履歴では、force sync による presentation queue 崩れ、publish 応答の stale rollback、UI unlock と publish 完了のズレが別々に再発しており、構造的な問題が確認されている。

## 1. 目的

- 公開 URL のネット対戦を「通常操作で壊れない」状態へ、有限の工程で戻す。
- 01-rulebook.md に定義されたネット対戦の外側仕様を維持しつつ、内部同期方式だけを再構築する。
- v1 と v2 を同時に長期保守しない。段階移行で切り替え、最後に v1 を削除する。
- ローカル検証と公開検証の差を減らし、以後の network デバッグが「公開でしか再現しない」状態へ戻らないようにする。

## 2. 非目標

- ネット対戦 UI の全面リデザイン
- カードバランス調整
- CPU や selfplay の全面改修
- worker-public を root と独立した正本として再設計すること
- v1 のすべての内部実装を互換維持しながら残すこと
- 既存の不安定な optimistic apply を細かく延命すること

## 3. 検証済みの前提

### 3.1 一次仕様から残すべきもの

- ネット対戦では各プレイヤーが自分の deck を room に持ち込み、黒白で別内容の deck を使ってよい。
- ネット対戦の部屋番号は英数字大文字 3 文字で統一する。
- 作成側は黒、参加側は白を基本席割当とする。
- `/api/match/*` を同一オリジンの通信口とし、再接続、heartbeat、turn timer、chat、rematch を持つ。
- 盤面反映は確定済みの局面受信を正とし、画面側で推測補完しない。

### 3.2 現行実装から確定している事実

- 入口 UI は ui/handlers/match-mode.js に寄っており、create/join/leave の殻は比較的薄い。
- 席情報と roomDeck 正規化は ui/network/session-seat.js に寄っているため、UI 殻は再利用しやすい。
- 現行 publish は ui/network-client.js で snapshot と playbackEvents を含む payload を送っている。
- 公開 worker は workers/match-worker.mjs が正本であり、viewer projection、heartbeat、turnTimer、seatToken 必須、idempotency を持つ。
- worker-public は root 正本を npm run worker:prepare で mirror する運用であり、直編集を前提にしない。

### 3.3 直近の調査から確定している事実

- force sync without incoming playback を安全に扱うための回帰テストが存在する。つまり reconnect / heartbeat / force sync は既に壊れやすい層である。
- 先行 publish 成功応答で後続 local state を巻き戻さないための回帰テストが存在する。つまり publish 応答順序の race は既知である。
- 公開 network では「UI 側はもう入力可能だが network 側の publish はまだ進行中」というズレが主因候補として確定している。
- root と worker-public の mirror 漏れは、副因になりうるが、直近事案では第一原因ではない。

## 4. 残す契約

### 4.1 UI 殻

- `CPU` と `ネット対戦` のモード切替
- 中央のネット対戦設定パネル
- `部屋作成` / `参加` / `退出` の入口
- 右下の `MATCH` 行と状態表示
- リザルト、ログ、チャットの見た目上の配置

### 4.2 部屋・席契約

- roomId は 3 文字大文字英数字
- playerName は 1〜7 文字
- create 側黒、join 側白
- seatToken による席復帰
- seatNames と席視点での表示

### 4.3 deck 契約

- 黒白別の deckCodeByPlayer / deckSizeByPlayer を room に保持する
- room の deck が local 保存 deck より優先される
- URL deck と room deckCode の再現性を維持する

### 4.4 見た目と演出の原則

- 盤面反映は確定局面を正とする
- UI は playback events を順番どおりに再生する
- 演出中は stale click や二重操作を起こさない
- Single Visual Writer と既存 playback engine の原則は崩さない

## 5. 廃止または置換する契約

- client-authored canonical snapshot publish
- client-authored playbackEvents publish
- actionType を任意文字列ラベルとして延命すること
- publish 応答到着順に client が強制 snapshot apply して辻褄を合わせる設計
- ローカル server と公開 worker を別物として進化させること
- 公開 network での強い optimistic board apply を初期段階から前提にすること

## 6. 目標アーキテクチャ

### 6.1 基本原則

- authority は server に寄せる
- client は command sender と snapshot applier に徹する
- canonical snapshot、playbackEvents、stateVersion、turnTimer、viewer projection は server-owned output とする
- client は room UI、入力管理、自席視点 UI、再接続、SSE 購読、busy lock 制御だけを持つ

### 6.2 v2 の責務分離

- ui/handlers/match-mode.js
  - 入口 UI、表示更新、ボタン配線だけを持つ
- ui/network/session-seat.js
  - seat、roomDeck、roomState の UI 向け正規化を持つ
- ui/network-client-v2.js または ui/network-client.js 内の v2 実装
  - create/join/leave/state/stream/command の薄い client
  - local canonical state を生成しない
- workers/match-worker.mjs
  - v2 command の受理、検証、局面確定、viewer projection、turn timer、chat、stream を持つ唯一の authority
- game/ 側の共通 helper
  - command を server で適用するための pure な state transition を再利用する

### 6.3 ローカル開発の正本

- 今後の network デバッグは `npm run worker:dev` を第一経路にする。
- scripts/local-match-server.js は、v2 では正本プロトコル設計の中心に置かない。
- local server を残す場合でも、worker と別契約で進化させない。可能な限り同じ authority helper を共有する。

### 6.4 worker-public の扱い

- root を正本にする
- worker-public は phase 終端で `npm run worker:prepare` により同期する
- mirror は副因検出のため必ず verify するが、設計の正本にはしない

## 7. 段階計画

## Phase 0: 凍結と境界固定

### 目的

- v1 延命を止め、v2 で残す契約と捨てる契約を固定する。

### 作業

1. 現行 v1 を「修理対象」ではなく「置換対象」と明文化する。
2. UI 殻、room、seat、deck 契約の回帰テストを抽出する。
3. v2 計画書と contract inventory を後続実装の正本として固定する。
4. 必要なら公開 UI にメンテナンス表示または feature gate を入れ、v1 の新規不具合を増やさない。

### 主対象

- docs/network-match-v2-rebuild-plan-2026-03-15.md
- docs/network-authority-phase0-contract-inventory-2026-03-15.md
- ui/handlers/match-mode.js
- ui/network/session-seat.js
- test/ui.match-mode.network-button.test.js
- test/workers.match-room-deck.test.js

### 完了条件

- 残す契約と廃止契約が文書化されている
- v1 に対する新規 hotfix を止める判断ができる
- room / seat / deck の shell テストが今後も基準として使える

## Phase 1: v2 通信契約の最小実装

### 目的

- snapshot publish ではなく command publish の土台を作る。

### 作業

1. v2 command schema を定義する
   - `place`
   - `pass`
   - `reset_game`
   - `use_card` は後続 phase で追加
2. create/join/leave/state/stream のレスポンス契約を worker 基準で固定する。
3. client は canonical snapshot を送らず、`roomId` / `seatToken` / `operationId` / `baseVersion` / command params のみ送る。
4. server は command を検証し、確定 snapshot と playbackEvents を生成して返す。

### 主対象

- workers/match-worker.mjs
- ui/network-client.js または ui/network-client-v2.js
- ui/network/snapshot.js
- test/workers.match-publish-idempotency.test.js
- test/workers.match-stream-sse.test.js
- test/workers.match-turn-timer.test.js

### 完了条件

- client-authored snapshot publish を v2 経路で使っていない
- worker が canonical snapshot の唯一の供給元になっている
- state/stream/publish の seatToken と operationId 契約が一貫している

## Phase 2: 最小プレイアブル縦切り

### 目的

- カード未対応でも、公開 network で 1 試合最後まで進められる核を先に成立させる。

### 作業

1. `place` を v2 command として通す。
2. `pass` を通す。
3. `reset_game` を server 側初期化で通す。
4. network mode では、初期段階の optimistic board apply を抑え、server 確定を優先する。
5. stale click を防ぐため、入力解除は server response と playback settle を見てから行う。

### 主対象

- workers/match-worker.mjs
- ui/network-client.js または ui/network-client-v2.js
- ui/network/snapshot.js
- game 側の pure transition helper
- test/ui.network-client.publish-base-version.test.js
- test/ui.network-client.result-sync.test.js

### 完了条件

- カード未使用で最後まで対局が成立する
- `VERSION_MISMATCH` と stale rollback が通常操作で出ない
- busy lock 残留や操作不能が通常対局で再現しない

## Phase 3: 再接続・heartbeat・timer・chat の復旧

### 目的

- 公開 worker 固有の非同期経路を v2 で閉じる。

### 作業

1. reconnect と heartbeat を v2 契約で整理する。
2. force sync は local queue を壊さず、server snapshot を上書き正本として扱う。
3. turn timer を worker-owned output として復旧する。
4. chat を room state と同じ契約で復旧する。

### 主対象

- workers/match-worker.mjs
- ui/network-client.js または ui/network-client-v2.js
- ui/network/snapshot.js
- test/ui.network-client.reconnect-sync.test.js
- test/ui.network-client.result-sync.test.js
- test/workers.match-heartbeat-stateversion.test.js
- test/workers.match-turn-timer.test.js

### 完了条件

- heartbeat と reconnect が通常通信で盤面を壊さない
- timer と chat が公開 URL で再現性を持って動く
- reconnect 後の force sync で stale queue / stale click が起きない

## Phase 4: カード command の段階移行

### 目的

- 一番壊れやすい card flow を snapshot publish から command publish へ切り替える。

### 作業

1. no-target card を先に移行する。
2. single-target card を次に移行する。
3. multi-stage selection を最後に移行する。
4. 対象選択は `handIndex` / `cell` / `target descriptor` を明示 command にし、client 推測で確定しない。
5. card family ごとに bounded runbook を切り、まとめて全面移行しない。

### 主対象

- cards/
- game/card-effects/
- ui/network-client.js または ui/network-client-v2.js
- workers/match-worker.mjs
- test/ui.network-client.multi-stage-selection.test.js
- test/ui.network-client.trap-deferred-publish.test.js
- test/ui.network-client.swap-deferred-publish.test.js
- test/ui.network-client.sacrifice-deferred-publish.test.js

### 完了条件

- card use が publish race を前提にしない
- selection 系が server confirm 基準で閉じる
- 既存 card 系の公開-only bug が v2 で再現しない

## Phase 5: 切替と v1 廃止

### 目的

- UI の入口を v2 へ切り替え、v1 を削除する。

### 作業

1. `NetworkMatchClient` の外向き API はできるだけ維持し、中身を v2 へ差し替える。
2. v1 専用の snapshot publish / legacy rollback / legacy action bridge を削除する。
3. worker-public を同期し、公開 URL の 2 タブ smoke を固定する。
4. 不要になった v1 テストと helper を削除または置換する。

### 主対象

- ui/network-client.js
- ui/network/snapshot.js
- workers/match-worker.mjs
- scripts/prepare-worker-assets.js
- worker-public/

### 完了条件

- 公開 URL の network mode が v2 のみで動作する
- v1 snapshot publish 経路が残っていない
- root と worker-public の同期が phase 終端で確認されている

## 8. 当面の止血策

- v2 着手後は、公開 v1 に対して症状ごとの追加 hotfix を原則止める。
- ユーザー影響が大きい場合は、公開 UI で network mode を一時メンテナンス表示にすることを許容する。
- どうしても v1 に触る場合でも、v2 へ持ち込まない局所ガードに限定し、protocol や authority の延命をしない。

## 9. リスクと open question

- card 系 command への移行は、pure transition helper の再利用範囲を先に見極めないと肥大化する。
- local server をどこまで残すかは、Phase 1 終了時に再判定する必要がある。
- v2 初期は optimistic apply を弱めるため、見た目の反応速度が少し落ちる可能性がある。
- worker 側の command schema を増やしすぎると Phase 4 が再び巨大化するため、card family ごとの bounded migration が必要である。

## 10. 完了条件

1. room 作成、参加、退出、再参加、黒白別 roomDeck が公開 URL で安定している。
2. place / pass / rematch が v2 command で成立し、最後まで対局できる。
3. reconnect / heartbeat / state resync が公開 URL で stale lock を起こさない。
4. timer と chat が公開 URL で安定している。
5. card use が snapshot publish ではなく v2 command で動いている。
6. v1 固有の snapshot publish 経路が削除されている。
7. root と worker-public の同期が verify されている。
8. 変更で visible behavior が変わった箇所は 01-rulebook.md に反映されている。

## 11. 代表検証束

Phase 0 shell:

```bash
npx jest --runInBand test/ui.match-mode.network-button.test.js test/workers.match-room-deck.test.js
```

Phase 1-3 core network:

```bash
npx jest --runInBand test/workers.match-stream-sse.test.js test/workers.match-publish-idempotency.test.js test/workers.match-turn-timer.test.js test/workers.match-heartbeat-stateversion.test.js test/ui.network-client.publish-base-version.test.js test/ui.network-client.result-sync.test.js test/ui.network-client.reconnect-sync.test.js
```

Phase 4 card migration:

```bash
npx jest --runInBand test/ui.network-client.multi-stage-selection.test.js test/ui.network-client.trap-deferred-publish.test.js test/ui.network-client.swap-deferred-publish.test.js test/ui.network-client.sacrifice-deferred-publish.test.js
```

mirror / public verification:

```bash
npm run worker:prepare
npm run worker:dev
npm run worker:deploy
```

## 12. 01-rulebook.md 方針

- この文書追加だけでは挙動変更は発生しないため、現時点で 01-rulebook.md の更新は不要。
- ただし Phase 2 以降で、network mode の visible behavior を変更する実装が入る場合は、実装前に 01-rulebook.md を更新する。
- 特に、入力解除タイミング、card selection の成立条件、reconnect 時の表示挙動、timer 表示、chat 表示の振る舞いが変わる場合は、必ず一次仕様へ反映する。

## 13. この計画の終了点

- v2 で公開 network mode が安定稼働し、v1 snapshot publish 経路が消えた時点で、この計画書は完了扱いにする。
- その後の改善項目は、別 runbook に切り出す。
- この文書に「次に直せる場所」を継ぎ足し続けて master TODO にしない。