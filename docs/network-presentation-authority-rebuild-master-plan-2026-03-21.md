# ネット対戦 presentation / authority 再建 master plan

作成日: 2026-03-21
対象: ui / game / cards / shared / workers / scripts / test / docs / worker-public
状態: Draft
一次情報:
- `01-rulebook.md`
- `docs/network-playback-ui-stability-reform-plan-2026-03-20.md`
- `docs/network-single-writer-plan-2026-03-16.md`
- `docs/network-selection-card-stabilization-plan-2026-03-14.md`

## 0. この文書の位置づけ

- この文書は、ネット対戦モードに残っている UI / animation / sound / effect log / busy lock の不安定を、個別カード修理ではなく **presentation と authority の境界を再建する大規模改革** としてまとめ直した master plan である。
- 一次仕様は `01-rulebook.md` とし、本文書は internal contract、置換境界、phase、完了条件、検証束だけを定める。
- 既存の `network-single-writer` と `network-playback-ui-stability-reform` は重要な前提だが、現行コードを見る限り、まだ **state apply / playback / card materialization / sound / log / busy ownership** が別経路で混ざっている。本文書はその不足分を統合する。
- 既存 plan と衝突した場合は、**execution order と boundary 定義については本文書を優先**し、カード別の分類や先行 fix の棚卸しは既存文書を補助資料として残す。

## 0.1 結論

- network 専用バグの根本原因は、特定カード 1 枚や特定 SE 1 個ではない。
- 現状は次の 5 問題が同時に残っている。
  1. self-op の authoritative apply が SSE snapshot と publish response の 2 ingress に残っている
  2. deferred selection が local pending UI ではなく **local final-state mutation** まで抱えている
  3. card-use animation が network transport を越えられない DOM 参照に依存している
  4. gameplay sound と effect log が direct UI と playback の両方から発火している
  5. busy / playback lock の owner が複数モジュールに散っている
- よって修正単位は「カード別 patch」ではなく、次の 4 境界で切る。
  1. authoritative apply gate
  2. pending selection contract
  3. transport-safe presentation payload
  4. single side-effect bus

## 0.2 なぜ既存 plan だけでは足りないか

- `docs/network-single-writer-plan-2026-03-16.md` は state writer の整理に強いが、gray card や SE 重複のような **presentation payload / sound bus** 問題を正面から扱っていない。
- `docs/network-playback-ui-stability-reform-plan-2026-03-20.md` は busy lock と deferred publish に強いが、**sourceCardEl を transport で落としている設計**や **effect log の二重発火** までは master plan 化していない。
- `docs/network-selection-card-stabilization-plan-2026-03-14.md` はカード分類に強いが、対象選択 UI の先にある **authority / presentation の一本化** までは扱っていない。
- したがって今回は、既存文書を捨てずに、上位の execution order を 1 本に束ねる。

## 0.3 非目標

- ゲームルールやカード性能の変更
- ネット対戦 UI の全面リデザイン
- 外部依存の追加
- worker API の外向き schema 全面変更
- timeout を伸ばすだけの延命

---

## 1. 検証済みの事実

### 1.1 仕様上の前提はすでに Single Visual Writer である

- `01-rulebook.md` は、UI が `events[]` を順番どおりに再生し、再生中の盤面 DOM 更新は Playback Engine のみであること、さらに `selectTarget` 完了後も playback / network publish / 手番受け渡しが片付くまで入力再開しないことを要求している。
  - 根拠: [01-rulebook.md](../01-rulebook.md#L925-L930)

### 1.2 self-op の authoritative apply はまだ 1 本化されていない

- stream 側の self snapshot でも `applySnapshot(...)` が呼ばれている。
  - 根拠: [ui/network-client.js](../ui/network-client.js#L1673-L1694)
- publish response 側でも条件つきで `applySnapshot(...)` が呼ばれている。
  - 根拠: [ui/network-client.js](../ui/network-client.js#L2107-L2113)
- `ui/network/snapshot.js` 側には shadow playback / stale shadow の reconcile がまだ残っている。
  - 根拠: [ui/network/snapshot.js](../ui/network/snapshot.js#L385-L417) [ui/network/snapshot.js](../ui/network/snapshot.js#L558-L670)

### 1.3 deferred selection は local pending UI を超えて local final-state mutation までしている

- target card の `use_card` で network active 時に `CardLogic.applyCardUsage(...)` をローカル実行し、pending を立てている。
  - 根拠: [ui/network-client.js](../ui/network-client.js#L1472-L1504)
- `executePendingSelection(...)` は network continue-turn 系で local playback を suppress しても、state 自体はローカルに適用し、board / card / game の state change signal を emit している。
  - 根拠: [game/card-effects/selection-flow.js](../game/card-effects/selection-flow.js#L739-L766)
- その後で `finalizePendingSelectionFlow(...)` が publish や handoff を進めるため、DOM だけ先に final state 寄りへ進む余地がある。
  - 根拠: [game/card-effects/selection-flow.js](../game/card-effects/selection-flow.js#L356-L437) [game/card-effects/selection-flow.js](../game/card-effects/selection-flow.js#L782-L795)

### 1.4 card-use animation は network transport を越えられない DOM 参照に依存している

- local path では `useSelectedCard()` が `sourceCardEl` / `sourceCardRect` を playback event に添付している。
  - 根拠: [cards/card-interaction.js](../cards/card-interaction.js#L1562-L1581) [cards/card-interaction.js](../cards/card-interaction.js#L2175-L2210)
- 一方で publish 用 sanitize は `sourceCardEl` / `sourceCardRect` を明示的に落としている。
  - 根拠: [ui/network-client.js](../ui/network-client.js#L1415-L1427)
- playback 側は source element が無いと generic な `div.card-item visible` を生成しており、proper なカード面 renderer を通らない。
  - 根拠: [ui/animation-utils.js](../ui/animation-utils.js#L1168-L1199)
- proper な見た目は `createCardFaceElement(cardId)` が `cost-tier-*` を含めて組み立てる設計である。
  - 根拠: [cards/card-renderer.js](../cards/card-renderer.js#L193-L215)
- 既存 test も「local source element は payload へ送らない」前提までは固定しているが、network 再生用の visual descriptor はまだ持っていない。
  - 根拠: [test/ui.network-client.action-bridge-next-snapshot.test.js](../test/ui.network-client.action-bridge-next-snapshot.test.js#L362-L410)

### 1.5 gameplay sound は direct UI と playback の 2 系統が混在している

- `use` / `destroy` / `sell` ボタンは direct UI sound を即再生している。
  - 根拠: [ui/handlers/init.js](../ui/handlers/init.js#L315-L388)
- playback 側では `appendSoundEffectPlaybackEvents(...)` が gameplay sound cue を追加している。
  - 根拠: [game/turn/pipeline_ui_adapter.js](../game/turn/pipeline_ui_adapter.js#L1288-L1335)
- 実再生は `AnimationEngine.handleSoundEffect(...)` が行う。
  - 根拠: [ui/animation-engine.js](../ui/animation-engine.js#L1488-L1510)
- direct UI と playback の衝突抑止は `__skipNextPlaybackSoundUntilByKey` に依存しているが、現状は一部キーだけが対象で、構造上の一本化にはなっていない。
  - 根拠: [ui/handlers/init.js](../ui/handlers/init.js#L312-L349) [ui/animation-engine.js](../ui/animation-engine.js#L85-L103)

### 1.6 effect log も direct UI と network client の 2 系統が混在している

- `useSelectedCard()` は通常 log を直接書いた上で、network mode では `emitEffectLog(...)` も呼ぶ。
  - 根拠: [cards/card-interaction.js](../cards/card-interaction.js#L2198-L2203)
- `emitEffectLog(...)` は最終的に `addLog(...)` を呼ぶだけなので、同文言二重化の余地がある。
  - 根拠: [ui/network-client.js](../ui/network-client.js#L688-L700)

### 1.7 busy / playback ownership はまだ散っている

- `selection-flow` は独自に busy / cardAnimating を握っている。
  - 根拠: [game/card-effects/selection-flow.js](../game/card-effects/selection-flow.js#L627-L631) [game/card-effects/selection-flow.js](../game/card-effects/selection-flow.js#L782-L805)
- `snapshot.js` も queue 復元と busy の keep / release を独自判断している。
  - 根拠: [ui/network/snapshot.js](../ui/network/snapshot.js#L419-L438) [ui/network/snapshot.js](../ui/network/snapshot.js#L633-L669)
- これは rulebook の「再生中の書き手は 1 つ」に対して、owner が複数ある状態である。

---

## 2. 症状をどう再分類するか

現状の報告は「アニメーションが不安定」「SE が重複」「灰色カードになる」と見えるが、内部的には次の failure class に分けるべきである。

1. **double-apply 系**
   - same operation が 2 ingress から apply される
   - 例: SSE snapshot と publish response の競合

2. **pre-authoritative-mutation 系**
   - authoritative snapshot 前に DOM / state / log が先行する
   - 例: deferred selection の local final-state mutation

3. **transport-loss 系**
   - local DOM に依存した payload が transport 境界で落ちる
   - 例: `sourceCardEl` 喪失による gray card

4. **split-side-effect 系**
   - gameplay sound / effect log が direct UI と playback の両方から出る
   - 例: `card_use_button` 周辺、effect log 二重

5. **multi-owner-lock 系**
   - busy / playback idle 判定を複数 owner が別々に更新する
   - 例: stale click、入力再開の早すぎ / 遅すぎ

この再分類で見ると、個別 hotfix の再発理由が説明できる。

---

## 3. 目標アーキテクチャ

## 3.1 authoritative apply gate

- network mode の `gameState` / `cardState` 置換は **1 つの apply coordinator** だけを通す。
- stream snapshot と publish response は両方受けてもよいが、**最終 apply 判定は 1 箇所**で行う。
- 通常ケースの優先順位は `stream snapshot > publish response fallback` とし、operationId / stateVersion で重複 apply を止める。

## 3.2 pending selection contract

- network mode の target card は、local では **pending UI に必要な最小状態だけ** を扱う。
- 対象選択完了後の effect resolve、盤面変化、flip、sound、effect log は server-authoritative 経由だけで確定する。
- multi-stage card は intermediate stage を local pending UI として保持し、final stage 完了時だけ authoritative resolve へ入る。

## 3.3 transport-safe presentation payload

- network 越しに流す playback payload は **完全に serializable** にする。
- DOM node、Element、function、live rect 参照を transport schema に入れない。
- `card_use_animation` の見た目は `cardId` と serializable visual descriptor から再構築できるようにする。
- local mode では `sourceCardEl` を使ってもよいが、network mode はそれに依存しない。

## 3.4 single side-effect bus

- gameplay sound と effect log は **authoritative playback / authoritative commentary** からだけ出す。
- direct UI で許す音は、hover / tap のような purely local UX cue に限定する。
- gameplay sound と同じ key を button click から鳴らさない。

## 3.5 busy ownership

- busy / playback active / interaction lock の owner は `PlaybackStateManager` 中心へ集約する。
- `selection-flow` や `snapshot.js` は direct flag write をやめ、manager の API だけを叩く。

---

## 4. 置換境界と責務

### 4.1 `ui/network-client.js`

- transport、publish tracking、stream receive、apply coordinator 呼び出しだけを持つ
- local state mutation、effect log 直書き、shadow playback 再調停を持たない

### 4.2 `ui/network/snapshot.js`

- authoritative snapshot の sanitize / replace / playback emit 準備だけを持つ
- self-op 特例、shadow playback、busy の keep/release 判定を抱えない

### 4.3 `game/card-effects/selection-flow.js`

- local pending UI と action build だけを持つ
- network mode の final state apply と final playback emit を持たない

### 4.4 `game/turn/pipeline_ui_adapter.js`

- server / local 共通の gameplay playback、sound cue、effect log payload の assembly 正本
- button click のような local UX sound はここへ入れない

### 4.5 `ui/animation-utils.js`

- serializable payload から visual を materialize する
- network mode の fallback が generic gray block へ落ちないようにする

### 4.6 `cards/card-interaction.js`

- button click と selection UI の controller に限定する
- network mode の optimistic effect log、optimistic hand mutation、transport 前提 DOM payload を持たない

---

## 5. 段階計画

## Phase 0: 監査表固定と regression gap の明文化

### 目的

- 既存 plan を読むだけでは把握しにくい failure class を、実コードと test 名で追えるようにする。

### 作業

1. 症状を `double-apply / pre-authoritative-mutation / transport-loss / split-side-effect / multi-owner-lock` に分類して監査表化する。
2. 既存 test を分類し、足りないものを新規予定として先に固定する。
3. 追加予定 test:
   - `test/ui.network-client.apply-coordinator.test.js`
   - `test/ui.network-client.card-use-visual-descriptor.test.js`
   - `test/ui.network-client.sound-dedupe.test.js`
   - `test/ui.network-client.effect-log-dedupe.test.js`

### 主対象

- `docs/network-playback-ui-stability-reform-plan-2026-03-20.md`
- `docs/network-selection-card-stabilization-plan-2026-03-14.md`
- `test/ui.network-client.*`
- `test/ui.card-use-source-element.test.js`
- `test/ui.init.sell-sound.test.js`

### 完了条件

- 既存 test と新規予定 test が failure class ごとに対応付けられている。
- 「どの bug をどの phase で潰すか」が文書だけで追える。

### 検証束

```bash
npm run test:network:parity
```

---

## Phase 1: authoritative apply coordinator を導入し self-op ingress を 1 本化する

### 目的

- self-op の state / playback apply を「1 decision point」に閉じる。

### 作業

1. `ui/network-client.js` に apply coordinator を新設し、stream snapshot と publish response の両方を coordinator 経由にする。
2. coordinator は `operationId` / `stateVersion` / source(stream or response) を見て apply 可否を 1 回だけ決める。
3. `ui/network-client.js` から direct `applySnapshot(...)` 呼び出しを段階的に除去し、coordinator 経由へ寄せる。
4. `ui/network/snapshot.js` の shadow playback / stale shadow は compatibility layer に閉じ込め、常用 path から外す。

### 主対象

- `ui/network-client.js`
- `ui/network/snapshot.js`
- `test/ui.network-client.result-sync.test.js`
- `test/ui.network-client.reconnect-sync.test.js`
- `test/ui.network-snapshot.single-writer-baseline.test.js`

### 完了条件

- self-op の通常成功ケースで apply writer が 1 つだけになる。
- SSE と publish response が両方到着しても animation / SE / log の duplicate apply が起きない。
- reconnect / idempotent replay は壊れない。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\ui.network-client.result-sync.test.js test\ui.network-client.reconnect-sync.test.js test\ui.network-client.publish-base-version.test.js test\ui.network-client.action-bridge-next-snapshot.test.js test\ui.network-snapshot.single-writer-baseline.test.js test\ui.network-snapshot.move-source-empty.test.js test\utils.match-authority.publish-response.test.js
```

---

## Phase 2: pending selection を local pending UI と authoritative resolve に分離する

### 目的

- target card の network path から local final-state mutation を取り除く。

### 作業

1. `use_card` の network target-card path を「pending UI 初期化」専用に縮める。
2. `executePendingSelection(...)` の network path から local final-state apply と local state change signal を外す。
3. continue-turn / end-turn / multi-stage / hand / overlay を同じ policy table で管理する。
4. multi-stage card は intermediate stage を local pending UI に限定し、final stage だけ publish する。

### 主対象

- `game/card-effects/selection-flow.js`
- `ui/network-client.js`
- `game/card-effects/*`
- `cards/card-interaction.js`
- `game/turn-handlers/pending-target-selector.js`

### 完了条件

- network target-card は authoritative snapshot 前に final state を書かない。
- pending UI は維持される。
- multi-stage / hand / overlay selection も同じ contract で説明できる。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\game.pending-selection-flow.test.js test\ui.network-client.guard-tempt-deferred-publish.test.js test\ui.network-client.movement-deferred-publish.test.js test\ui.network-client.swap-deferred-publish.test.js test\ui.network-client.trap-deferred-publish.test.js test\ui.network-client.multi-stage-selection.test.js test\ui.card-sell-selection-deferred-publish.test.js test\ui.heaven-blessing-selection-deferred-publish.test.js test\ui.card-condemn-selection-deferred-publish.test.js test\game.movement-selection-turn-handoff.test.js test\game.swap-selection-turn-handoff.test.js test\game.trap-selection-turn-handoff.test.js
```

---

## Phase 3: transport-safe card visual descriptor を導入する

### 目的

- gray card の根本原因である「network payload が live DOM を失う」問題を解消する。

### 作業

1. `card_use_animation` target に serializable な visual descriptor schema を導入する。
2. visual descriptor は `shared` 側 helper で生成し、worker / local-match-server / browser で同じ契約を使う。
3. `playCardUseHandAnimation(...)` は `sourceCardEl` が無い場合、descriptor + `CardRenderer` 経由で proper face を組み立てる。
4. `sanitizePlaybackValueForPublish(...)` は DOM を落としつつ、descriptor は保持する。

### 主対象

- `shared/playback-event-helpers.js`
- `game/turn/pipeline_ui_adapter.js`
- `ui/network-client.js`
- `ui/animation-utils.js`
- `cards/card-renderer.js`

### 完了条件

- network mode でも card-use animation が generic gray card に落ちない。
- playback payload は serializable のまま維持される。
- local mode の source element 利用は壊さない。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\ui.card-use-source-element.test.js test\ui.animation-utils.hand-fallback.test.js test\ui.network-client.action-bridge-next-snapshot.test.js test\network.playback-event-assembly.contract.test.js test\workers.match-publish-sanitize.test.js
```

---

## Phase 4: gameplay sound と effect log を authoritative side-effect bus へ統合する

### 目的

- SE 重複と effect log 二重化を、dedupe patch ではなく発火源の一本化で止める。

### 作業

1. `game/turn/pipeline_ui_adapter.js` を gameplay sound / effect log payload の正本にする。
2. `cards/card-interaction.js` と `ui/handlers/init.js` の gameplay sound 直再生を整理する。
3. direct UI に残す音は local UX cue のみとし、gameplay sound key と分離する。
4. network mode の effect log は authoritative apply 後の 1 経路だけにする。
5. `__skipNextPlaybackSoundUntilByKey` は safety net に縮小し、正規経路の重複防止を担わせない。

### 主対象

- `game/turn/pipeline_ui_adapter.js`
- `cards/card-interaction.js`
- `ui/handlers/init.js`
- `ui/animation-engine.js`
- `ui/network-client.js`

### 完了条件

- gameplay sound が button click と playback の両方から鳴らない。
- effect log が direct UI と network client の両方から二重に出ない。
- sell / destroy / card use で local UX cue と gameplay sound の責務が分かれる。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\game.pipeline-ui-adapter.sound-cue.test.js test\ui.init.sell-sound.test.js test\ui.card-destroy-hand.test.js test\ui.animation-engine.test.js
```

---

## Phase 5: busy / playback ownership を PlaybackStateManager に集約し shadow playback を廃止する

### 目的

- stale click と入力再開タイミングのズレを、owner の多重化ごと解消する。

### 作業

1. `selection-flow` と `snapshot.js` の direct busy write を manager API 経由へ置換する。
2. `waitForPlaybackIdle`、presentation queue、suppressed playback を同じ owner で見られるようにする。
3. `shouldEmitShadowPlayback`、`allowStaleShadowPlayback`、queued shadow tracking を段階的に削除する。
4. diff renderer の board-update suppression も manager 配下の context として吸収する。

### 主対象

- `ui/playback-state-manager.js`
- `ui/network/snapshot.js`
- `game/card-effects/selection-flow.js`
- `ui/diff-renderer.js`
- `ui/animation-engine.js`

### 完了条件

- busy / playback lock の書き手が限定される。
- network mode で stale lock / premature unlock / shadow playback 特例が消える。
- board update suppression が ad-hoc flag の集合ではなくなる。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\ui.playback-state-manager.test.js test\ui.animation-engine.playback-state.test.js test\ui.flip.suppress-double.test.js test\ui.diff-renderer.flip.test.js test\ui.network-snapshot.pending-presentation-reconcile.test.js test\ui.pass-stale-busy.test.js
```

---

## Phase 6: card family migration と race hardening を完了し mirror を同期する

### 目的

- network 固有の例外分岐を片付け、運用上の「特殊カードだけ別契約」をなくす。

### 作業

1. no-target -> single-target -> end-turn selection -> multi-stage -> hidden-hand / overlay の順に移行する。
2. reject / reconnect / idempotent replay / duplicate stream の regression を増やす。
3. `worker-public/` は最後に `npm run worker:prepare` で同期する。
4. `match:check` と self-match 系 smoke を常設 gate にする。

### 主対象

- `ui/network-client.js`
- `ui/network/snapshot.js`
- `game/card-effects/*`
- `worker-public/*`
- `scripts/match-network-smoke.js`

### 完了条件

- network mode で「このカードだけ特殊」な publish / playback hotfix が残らない。
- root / worker-public parity が保たれる。
- match smoke と parity bundle が green で固定される。

### 検証束

```bash
npm run test:network:parity
npm run match:check
npm run worker:prepare
```

---

## 6. 全体の完了条件

- network mode で final `gameState` / `cardState` を authoritative snapshot 以外が書かない。
- self-op apply は 1 decision point を通る。
- `card_use_animation` が network mode で live DOM に依存しない。
- gameplay sound と effect log が authoritative side-effect bus から 1 回だけ出る。
- busy / playback owner が `PlaybackStateManager` 系へ集約される。
- `worker-public/` が root と同期され、parity bundle と smoke が green。

## 7. 検証束

最終 gate は次を最低ラインとする。

```bash
npm run test:network:parity
npx jest --runInBand --runTestsByPath test\game.pending-selection-flow.test.js test\ui.network-client.multi-stage-selection.test.js test\ui.card-use-source-element.test.js test\ui.animation-utils.hand-fallback.test.js test\game.pipeline-ui-adapter.sound-cue.test.js test\ui.playback-state-manager.test.js
npm run match:check
npm run worker:prepare
```

## 8. `01-rulebook.md` への影響

- 現時点では rulebook 更新を前提にしない。
- 理由:
  - rulebook 側の「events[] 順再生」「再生中の盤面 DOM 更新は 1 writer」「`selectTarget` 完了後も publish / playback / handoff が片付くまで入力再開しない」という契約は、今回の改革方向と整合しているため。
- ただし、network mode で local UX cue をどう扱うかなど、**見え方の意図的変更** を入れる場合は、その時点で `01-rulebook.md` を先に更新する。

## 9. 実行順の明示

- 着手順は `Phase 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6` とする。
- 特に `Phase 3` より先に gray card を個別 patch で潰さない。
- `Phase 4` より先に SE 重複を skip registry の追加だけで塞がない。
- `Phase 5` より先に stale lock を watchdog 調整だけで塞がない。

これは、再発源を残したまま見かけ上の症状だけ消す修正を避けるためである。
> Status Update (2026-03-21)
>
> この master plan に含めた Phase 1 -> 6 は root 実装・検証・`worker-public/` 同期まで完了。
> 完了内容:
> - self-op apply coordinator 導入
> - pending selection の authoritative publish 方式への全面移行
> - transport-safe card visual descriptor 導入
> - gameplay sound / effect log の authoritative bus 化
> - busy / playback owner の `PlaybackStateManager` 集約
> - race hardening / regression test 追加
> - legacy fallback cleanup (`VisualPlaybackActive` / `__suppressNextDiffFlip` / `__suppressNextBoardExpansionRevealSound` の consumer 依存除去)
>
> 実施済み検証:
> - 関連 Jest suite 一括実行: 197 tests passed
> - `npm run test:network:parity`: passed
> - `npm run match:check`: passed
> - `npm run worker:prepare`: passed
>
> 残タスク:
> - 本計画の実装スコープに関してはなし
>
> 仕様扱い:
> - `01-rulebook.md` の更新は不要。今回は仕様変更ではなく、既存の `events[]` 順再生 / Single Visual Writer / authoritative snapshot 契約へ実装を復帰・統一した作業。
