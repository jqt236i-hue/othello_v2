# ネット対戦 playback / UI 安定化 大幅改革計画書

作成日: 2026-03-20
対象: ui / game / workers / scripts / test / docs / worker-public
状態: Draft
前提文書:
- `docs/network-single-writer-plan-2026-03-16.md`
- `docs/network-parity-hardening-plan-2026-03-17.md`

## 0. この文書の位置づけ

- この文書は、**ネット対戦モードで残っている animation / UI 不安定、重複再生、busy lock 競合を段階的に解体するための改革計画**である。
- 一次仕様は `01-rulebook.md` とし、本文書は internal contract、置換境界、phase、完了条件、検証束だけを定める。
- `network-single-writer` と `network parity hardening` により server-authoritative / command publish / playback assembly parity の土台はできている。本計画はその上で、**まだ client 側に残る混線した責務** を整理する。

## 0.1 結論

- 現状の network 再生崩れは、個別カードの patch 不足だけではなく、次の 5 境界がまだ混ざっていることが原因である。
  1. self-op の apply ingress が SSE snapshot と publish response の 2 つに分かれている
  2. deferred pending selection が「local state / local playback / command publish」を同じ flow で持っている
  3. `useSelectedCard()` / `destroySelectedHandCard()` / `cancelPendingSelection()` が skipped local execution 時でも optimistic UI を書く
  4. busy / playback lock の所有者が `selection-flow`, `network/snapshot`, `AnimationEngine`, `PlaybackStateManager`, watchdog に散っている
  5. regression coverage が happy path に偏り、race / cascade failure / mid-selection rejection を十分止めていない
- そのため、今後は「局所的に 1 箇所だけ直す」より、**Single Writer を最後まで通すための責務整理** を phase 分けして進める。

## 0.2 大幅改革を許可する理由

- 既に Single Writer 化、parity hardening、hand animation queue、sound dedupe、deferred publish 修正を入れているが、それでも network 専用の崩れは再発している。
- 再発点は毎回別のカードや別の UI 症状に見えても、根は `publish -> snapshot -> playback queue -> direct UI reaction` の責務混線に戻る。
- したがって今回は延命 patch ではなく、**再発源になっている shared boundary を順に置換する改革計画** として扱う。

## 1. 検証済みの事実

### 1.1 authoritative playback の現在地

- worker / local-match-server は snapshot 本体から transient presentation queue を strip し、`playbackEvents` を別 payload として返している。
- browser 側の本線は `ui/network-client.js` -> `ui/network/snapshot.js` -> `emitPlaybackEvents(PLAYBACK_EVENTS)` -> `ui/presentation-handler.js` -> `AnimationEngine.play()` である。
- `shared/playback-event-helpers.js` が playback assembly の単一ソースであり、worker / local-match-server / UI adapter の drift は以前より小さい。

### 1.2 まだ残っている構造的な危険

- `ui/network-client.js` には `resolveSelfSnapshotShadowPlaybackEvents()` や `markTrackedPublishShadowPlaybackQueued()` など、現在 runtime で使われない shadow playback scaffolding が残っている。
- `ui/network/snapshot.js` には `shadowPlaybackEvents` / `allowStaleShadowPlayback` 分岐が残るが、現行 network-client は self snapshot に空 shadow playback を渡している。
- self-op は SSE snapshot apply と publish response apply の 2 ingress をまだ持つため、version gate が壊れたときに duplicate apply の再発余地が残る。
- continue-turn 型の deferred pending selection は、local state 適用と command publish を同一 flow で扱うため、design 上の責務がまだ混ざっている。
- direct UI action は network skipped-local-execution 時でも local log / selection / render を書く経路があり、authoritative reject / mismatch 時の rollback 余地を残している。
- busy / playback lock の書き手が複数あるため、1 箇所だけ直しても別 path で stale lock が残りやすい。

### 1.3 既存の regression baseline

- `network-regression-audit` では 13 suites / 87 tests が pass した。
- `npm run test:network:parity` では 15 suites / 119 tests が pass した。
- coverage は publish base version、reconnect、result sync、trap defer、movement defer、worker sanitize、playback assembly parity では強い。
- 一方で、race condition、mid-selection rejection、queue corruption across turns、cascade retry failure は coverage gap として残っている。

### 1.4 今回すでに入れた即修正

- `game/card-effects/selection-flow.js` で、**network continue-turn deferred selection は local playback を emit せず、即 publish する** 形へ寄せた。
- これにより、`TEMPT_WILL` / `GUARD_WILL` 系の「local playback 後に authoritative playback が戻る」二重再生経路を 1 段削った。
- 追加した回帰:
  - `test/game.pending-selection-flow.test.js`
  - `test/ui.network-client.sacrifice-deferred-publish.test.js`
  - `test/ui.network-client.guard-tempt-deferred-publish.test.js`

## 2. 目的

- network mode の self-op を **最終的に 1 ingress / 1 playback writer** へ寄せる。
- pending selection を「local pending UI」と「server-authoritative effect playback」に分離する。
- direct UI action の optimistic mutation を publish ack / authoritative snapshot と整合する形へ縮める。
- busy / playback lock の ownership を `PlaybackStateManager` 中心へ集約する。
- race / cascade / rejection を止める regression bundle を常設する。

## 3. 非目標

- ゲームルール、カード仕様、visible effect 契約の変更
- 新しい network protocol や外部依存の追加
- production 常時 debug 化
- local CPU / story / tutorial の挙動変更
- 単なる timeout 調整だけで問題を解決したことにすること

## 4. 維持する契約

- server-authoritative / command-only publish
- `shared/playback-event-helpers.js` を playback assembly 正本とする契約
- worker と local-match-server の parity
- `worker-public/` は mirror とし、root を正本にする運用
- visible rule / animation 仕様は `01-rulebook.md` を正本とすること
- debug は明示 opt-in のみ

---

## 5. 段階計画

## Phase 0: 即修正の固定と regression gap の見える化

### 目的

- 今回入れた immediate containment を baseline に固定し、再発点を test 上で見える状態にする。

### 作業

1. continue-turn deferred selection の local playback suppress を regression test で固定する。
2. direct UI skipped-local-execution の optimistic mutation 経路を test で再現できるようにする。
3. race / rejection / cascade failure の coverage gap を一覧化し、後続 phase の test target を先に決める。

### 主対象

- `game/card-effects/selection-flow.js`
- `test/game.pending-selection-flow.test.js`
- `test/ui.network-client.sacrifice-deferred-publish.test.js`
- `test/ui.network-client.guard-tempt-deferred-publish.test.js`
- `test/ui.card-use-source-element.test.js`
- `test/ui.card-destroy-hand.test.js`

### 完了条件

- continue-turn deferred selection の duplicate playback 再発を test で止められる。
- direct UI optimistic mutation の未修正経路が test 名で追える。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\game.pending-selection-flow.test.js test\ui.network-client.sacrifice-deferred-publish.test.js test\ui.network-client.guard-tempt-deferred-publish.test.js test\ui.network-client.action-bridge-next-snapshot.test.js test\ui.network-client.publish-base-version.test.js test\ui.network-client.result-sync.test.js test\ui.network-client.reconnect-sync.test.js test\ui.network-client.trap-deferred-publish.test.js test\ui.network-client.movement-deferred-publish.test.js
```

---

## Phase 1: self-op apply ingress を 1 本化する

### 目的

- self-op の state / playback apply を SSE snapshot 側へ寄せ、publish response は ack / rejection / recovery 専用に縮める。

### 作業

1. `ui/network-client.js`
   - self publish success response での snapshot apply を helper 化し、SSE と役割が重なる path を棚卸しする。
   - 最終形では「SSE snapshot が来る通常ケース」と「SSE が遅延 / 欠落した recovery ケース」を分け、常用 path を 1 本にする。
2. `ui/network/snapshot.js`
   - self snapshot apply 前提で不要になった shadow playback / stale shadow 分岐を縮退する。
3. `test/ui.network-client.result-sync.test.js` と `test/ui.network-client.reconnect-sync.test.js`
   - self publish response と self SSE が両方来る時の重複 apply を固定する。

### 主対象

- `ui/network-client.js`
- `ui/network/snapshot.js`
- `test/ui.network-client.result-sync.test.js`
- `test/ui.network-client.reconnect-sync.test.js`

### 完了条件

- self-op の通常成功ケースで playback writer が 1 つだけになる。
- publish response と SSE が両方来ても duplicate animation / duplicate SE が起きない。
- stale rejection recovery は壊れない。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\ui.network-client.result-sync.test.js test\ui.network-client.reconnect-sync.test.js test\ui.network-client.publish-base-version.test.js test\ui.network-snapshot.single-writer-baseline.test.js test\ui.network-snapshot.move-source-empty.test.js
```

---

## Phase 2: deferred selection を local pending UI と authoritative playback に分離する

### 目的

- pending selection の local 実行を「pending state 投影」へ縮め、effect resolve と playback は server-authoritative に一本化する。

### 作業

1. `game/card-effects/selection-flow.js`
   - continue-turn / multi-stage を含む deferred selection contract を整理し、local 側では pending UI に必要な最小 state だけ扱う。
2. `ui/network-client.js`
   - pending selection publish meta と tracked publish の責務を local playback 前提から切り離す。
3. カード別 handler
   - `TEMPT_WILL`, `GUARD_WILL`, `POSITION_SWAP_WILL`, `BOARD_EXPANSION_GOD` など multi-stage / continue-turn の代表カードから順に移行する。

### 主対象

- `game/card-effects/selection-flow.js`
- `game/card-effects/sacrifice.js`
- `game/card-effects/tempt.js`
- `game/card-effects/guard.js`
- `game/card-effects/position-swap.js`
- `game/card-effects/board-expansion.js`
- `ui/network-client.js`

### 完了条件

- deferred selection で local playback と authoritative playback が二重に走らない。
- pending UI は維持される。
- multi-stage カードの途中段階で busy / selection lock が崩れない。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\game.pending-selection-flow.test.js test\ui.network-client.sacrifice-deferred-publish.test.js test\ui.network-client.guard-tempt-deferred-publish.test.js test\ui.network-client.trap-deferred-publish.test.js test\ui.network-client.movement-deferred-publish.test.js
```

---

## Phase 3: direct UI action の optimistic mutation を ack-gated にする

### 目的

- `skippedLocalExecution === true` な action で local log / selection / render / effect log が先走らないようにする。

### 作業

1. `cards/card-interaction.js`
   - `useSelectedCard()`, `destroySelectedHandCard()`, `cancelPendingSelection()` の共通 helper を追加し、network skipped-local-execution 時の optimistic write を抑止する。
2. rejection / mismatch 時の local cleanup 契約を helper に寄せる。
3. 必要なら `ui/handlers/init.js` 側の即時音 skip clear も helper 経由に揃える。

### 主対象

- `cards/card-interaction.js`
- `ui/handlers/init.js`
- `test/ui.card-use-source-element.test.js`
- `test/ui.card-destroy-hand.test.js`
- `test/ui.init.sell-sound.test.js`

### 完了条件

- skipped-local-execution の action で local hand / selection / log が早すぎるタイミングで変わらない。
- publish reject / mismatch 後も UI rollback が自然に見える。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\ui.card-use-source-element.test.js test\ui.card-destroy-hand.test.js test\ui.init.sell-sound.test.js test\ui.network-client.action-bridge-next-snapshot.test.js test\ui.network-client.publish-base-version.test.js
```

---

## Phase 4: busy / playback lock ownership を PlaybackStateManager に集約する

### 目的

- `isProcessing`, `isCardAnimating`, `VisualPlaybackActive`, watchdog clear の責務を 1 箇所に寄せる。

### 作業

1. `game/card-effects/selection-flow.js` と `ui/network/snapshot.js` の direct flag write を `PlaybackStateManager` helper 経由へ置換する。
2. `waitForPlaybackIdle()` が queue / active playback / pending suppressed playback を同じ意味で見られるようにする。
3. stale lock clear を watchdog 任せではなく ownership contract で閉じる。

### 主対象

- `ui/playback-state-manager.js`
- `ui/network/snapshot.js`
- `game/card-effects/selection-flow.js`
- `ui/animation-engine.js`
- `ui/move-executor-visuals.js`

### 完了条件

- network path で busy lock の書き手が限定される。
- stale playback lock を局所 patch なしで追跡できる。
- hand click / board click / selection cancel が stale flag で固まらない。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\ui.network-client.result-sync.test.js test\ui.network-snapshot.single-writer-baseline.test.js test\ui.animation-engine.test.js test\ui.animation-utils.hand-fallback.test.js test\ui.card-use-source-element.test.js
```

---

## Phase 5: race / cascade / selfmatch 検証を常設化する

### 目的

- happy path だけでは止められない network-only bug を regression gate と manual runbook の両方で捕まえる。

### 作業

1. race 条件の test を追加する。
   - publish response と self SSE の前後入れ替わり
   - pending selection 中の mismatch / reject
   - rapid consecutive actions と heartbeat sync の競合
2. cascade failure test を追加する。
   - retry 後成功
   - retry exhausted
   - stale queued operation が残るケース
3. headed selfmatch runbook を更新し、network-only bug 修正時の標準検証にする。

### 主対象

- `test/ui.network-client.*.test.js`
- `test/ui.network-snapshot.*.test.js`
- `scripts/match-network-smoke.js`
- `docs/*runbook*.md`（必要時）

### 完了条件

- race / cascade 系の主要再発点に regression がある。
- local smoke と headed selfmatch の使い分けが文書化されている。

### 検証束

```bash
npm run test:network:parity
npm run match:check -- --base http://127.0.0.1:8788
```

---

## 6. 実行順の推奨

1. Phase 0 を固定する
2. Phase 1 で self-op ingress を 1 本化する
3. Phase 2 で deferred selection を contract ごと分離する
4. Phase 3 で direct UI optimistic mutation を削る
5. Phase 4 で busy / playback lock を集約する
6. Phase 5 で race / selfmatch gate を常設化する

## 7. 完了条件

- network self-op の apply / playback ingress が通常ケースで 1 本化されている
- deferred selection と direct UI action の local optimistic mutation が明示 helper へ閉じている
- busy / playback lock の ownership が `PlaybackStateManager` 中心に整理されている
- regression bundle が happy path だけでなく race / rejection / cascade を含む
- `npm run test:network:parity` と必要な targeted suites が pass する
- `worker-public/` 反映が必要な phase では `npm run worker:prepare` を実行している

## 8. 01-rulebook.md との関係

- 現時点では **不要**。
- 本計画は network internal contract と再生責務の整理であり、外に見えるルール変更を前提にしていない。
- ただし phase 実装で visible timing や操作感を intentional に変える場合は、その phase 着手前に `01-rulebook.md` を更新する。
