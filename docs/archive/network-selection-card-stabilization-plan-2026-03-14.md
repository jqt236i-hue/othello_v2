# ネット対戦 選択系カード安定化 計画書

作成日: 2026-03-14
対象: game / ui / cards / cpu / test / worker-public / docs
状態: Draft（調査ベース）

- 実装に着手する時の bounded な実行順は [public-network-card-fix-runbook-2026-03-14.md](public-network-card-fix-runbook-2026-03-14.md) を正本にする。

## 0. この文書の位置づけ

- この文書は、公開中のネット対戦モードで起きている「カード使用後の入力不能 / 手番不整合 / snapshot publish の競合 / 演出中の stale click」を、選択系カード全体で閉じるための実行計画である。
- 一次仕様は [01-rulebook.md](..\..\01-rulebook.md) とし、今回の主眼は仕様変更ではなく、既存仕様どおりに network と playback の整合を取り戻すことに置く。
- root を正本とし、worker-public は root 側の修正完了後に同期する。
- 既に個別修正済みの `SWAP_WITH_ENEMY` / `TRAP_WILL` / `STRONG_WIND_WILL` / `SUPER_BUOYANCY_WILL` / `SUPER_GRAVITY_WILL` は、今回の完成形の先行例として扱い、個別特例のまま放置しない。

## 1. 自前調査の結論

### 1.1 いまの共通 root cause

- network action bridge は、`row,col` を持つ盤面配置 action でもなく `deferNetworkPublish === true` でもない action を即 publish する。
  - 根拠: [ui/network-client.js](#L958-L977)
- 一方で、selection target を使うカードの多くは `runTurnWithAdapter(...)` 実行後に UI 更新と `ensureCurrentPlayerCanActOrPass(...)` だけで終わっており、network handoff helper を通っていない。
  - 根拠: [game/card-effects/time-bomb.js](#L14-L65) [game/card-effects/freeze.js](#L14-L65) [game/card-effects/position-swap.js](#L14-L74) [game/card-effects/board-expansion.js](#L23-L80)
- turn pipeline では多数の pending selection が「selection-only pre-placement effect」として即 return するが、明示的に turn handoff しているのは現状 `SWAP_WITH_ENEMY` と `TRAP_WILL` だけである。
  - 根拠: [game/turn/turn_pipeline_phases.js](#L1132-L1600)
- `ensureCurrentPlayerCanActOrPass(...)` は auto-pass 補助であり、network publish 後の turn start や CPU/相手側への handoff を完結させる責務は持たない。
  - 根拠: repo memory [selection-only-turn-handoff](..\..\memories\repo\selection-only-turn-handoff.md)
- CPU 側も pending type の分類を別管理しており、selection-only end-turn card と network defer の判定が人間側とずれている。
  - 根拠: [game/cpu-decision.js](#L1363-L1372) [game/cpu-decision.js](#L1549-L1582)

### 1.2 不具合は 1 種類ではない

- 直した 5 種と同じ「選択完了でそのまま手番終了するカード」の穴がある。
- それとは別に、「選択後は同一手番の通常配置へ続くカード」で busy lock が早く外れ、演出中に stale click が入る穴がある。
- さらに「2 段階選択カード」は intermediate state と final state を分けて publish / unlock しないと壊れる。
- 手札/overlay 選択カードは board click handler ではなく `cards/card-interaction.js` 側に別実装があり、ここも network/playback 契約が分離している。

### 1.3 仕様上、全カードを同じ修正に載せてはいけない

- `SWAP_WITH_ENEMY` は仕様に「石は置かず、そのままターン終了」と明記されている。
  - 根拠: [cards/catalog.json](#L40-L47)
- しかし `TIME_BOMB` / `DESTROY_ONE_STONE` / `BOARD_EXPANSION_WILL` / `FREEZE_WILL` などは、仕様上は「対象選択で解決」と書かれているだけで、明示的な turn end 文言が無い。
  - 根拠: [01-rulebook.md](#L343-L357) [01-rulebook.md](#L701-L744)
- そのため、今後の修正は「全部 handoff」ではなく、カードごとの intended turn contract を先に固定してから進める必要がある。

## 2. 修正対象の分類

### 2.1 Group A: 選択完了で手番終了する契約のカード

- 確定済み:
  - `SWAP_WITH_ENEMY`
  - `TRAP_WILL`
  - `STRONG_WIND_WILL`
  - `SUPER_BUOYANCY_WILL`
  - `SUPER_GRAVITY_WILL`
- 作業の意味:
  - 既存 fix を共通 helper 化し、以後は type list の重複管理をやめる。

### 2.2 Group B: 選択後に同一手番の通常進行へ戻る可能性が高いカード

- `DESTROY_ONE_STONE`
- `TIME_BOMB`
- `TEMPT_WILL`
- `GUARD_WILL` / `GUARDIAN_GOD`
- `HYPERACTIVE_INHERIT_WILL`
- `EXTEND_LIFE_WILL`
- `CORROSION_WILL`
- `CLONE_WILL`
- `SPLIT_WILL`
- `TELEPORT_WILL` / `CELL_TELEPORT_WILL`
- `BOARD_EXPANSION_WILL`
- `BLOCKADE_WILL`
- `METEOR_WILL`
- `FREEZE_WILL`
- 作業の意味:
  - handoff は不要な可能性があるが、selection playback 中の stale board click / stale hand click / early unlock は閉じる必要がある。

### 2.3 Group C: 多段選択カード

- `POSITION_SWAP_WILL`
- `BOARD_EXPANSION_GOD`
- 作業の意味:
  - 1 回目選択と最終確定を別契約で扱う。
  - intermediate で lock を外し過ぎない。
  - final publish と intermediate publish の条件を明示する。

### 2.4 Group D: 手札 / overlay 選択カード

- `HEAVEN_BLESSING`
- `CONDEMN_WILL`
- 作業の意味:
  - `cards/card-interaction.js` 側の独自 post-selection flow を network/playback 共通契約へ寄せる。

### 2.5 Group E: shared selector / CPU / selfplay の整合対象

- `game/cpu-decision.js`
- `game/turn-handlers/pending-target-selector.js`
- `src/engine/selfplay-runner.js`
- 作業の意味:
  - type list の重複と contract のずれを止める。

## 3. 非目標

- カード仕様の新設やリワーク。
- network protocol や Worker API schema の全面変更。
- 演出デザインの刷新。
- unrelated な network rollback 問題の全面再設計。
- `worker-public/` の直編集。

## 4. 修正方針

### 4.1 契約を shared table 化する

- pending selection card ごとに以下を 1 か所で管理する。
  - selection source: board / hand / overlay
  - turn contract: end-turn / continue-turn / multi-stage
  - publish policy: immediate / defer-until-handoff / defer-until-final-stage
  - unlock policy: immediate / playback-idle / final-stage-only
  - CPU reuse 可否
- 個別 handler、network bridge、CPU selector で別々の type set を持たない。

### 4.2 handoff は既存 helper に寄せる

- end-turn 系は [game/network-turn-handoff.js](#L1-L180) の `finalizeNetworkTurnHandoff(...)` を正本にする。
- 個別カードに `continueAfterXxxTurnHandoff(...)` を増やすのではなく、共有 helper + policy で解決する。

### 4.3 continue-turn 系は「早すぎる unlock」を止める

- same-turn card は turn handoff しない代わりに、selection playback が残っている間は stale click を入れない。
- board 側だけでなく hand 側も同じ lock 契約にそろえる。
- repo memory の既知パターンを再利用する。
  - [stale-playback-hand-click](..\..\memories\repo\stale-playback-hand-click.md)
  - [stale-board-click-presentation-queue](..\..\memories\repo\stale-board-click-presentation-queue.md)

### 4.4 intermediate stage を明示的に扱う

- `POSITION_SWAP_WILL` と `BOARD_EXPANSION_GOD` は、1 回目 selection では pending を残し、最終 selection でだけ final publish / final unlock を行う。
- intermediate state を selection 完了と誤認する共通条件を排除する。

### 4.5 root 修正後に worker-public を同期する

- mirror は `npm run worker:prepare` で同期する。
- deploy が必要になった場合も、root 側の検証完了後に限る。
  - 参照: [docs/network-worker-deploy.md](..\network-worker-deploy.md)

## 5. フェーズ計画

### Phase 0. 監査表固定

対象:

- この計画書
- 対象カード一覧
- intended turn contract 監査表

作業:

- pending selection card を Group A/B/C/D に確定分類する。
- 各カードについて、仕様根拠を `01-rulebook.md` / `cards/catalog.json` / 既存 test のどれで固定するか明記する。
- 「選択後に turn end するか」「同一手番継続か」「多段か」「hand 選択か」を 1 対 1 で結び付ける。

完了条件:

- 修正対象の pending selection card に未分類がない。
- 以降の実装フェーズで「このカードは handoff 必要か」をその場判断しなくてよい。
- 仕様曖昧カードが残る場合は、曖昧点と暫定方針が明記されている。

### Phase 1. shared policy と helper の土台化

対象:

- `game/` 側の shared pending-selection policy
- `ui/network-client.js`
- `game/network-turn-handoff.js`
- 必要に応じて `cards/card-interaction.js` から参照する薄い adapter

作業:

- pending selection の contract table を新設する。
- `ui/network-client.js` の auto publish 判定を、`row,col` と `deferNetworkPublish` の ad-hoc 判定から policy 参照へ寄せる。
- end-turn 系 / final-stage-only 系 / continue-turn 系で publish と unlock の基準を分ける。
- 既存の 5 種 fix もこの共通 table に寄せ、カード固有 if を削る準備をする。

完了条件:

- pending type の分類が 1 か所で読める。
- `game/cpu-decision.js` と `ui/network-client.js` が別々の selection-only type set を持たない。
- 既存 5 種が共通 table 経由でも現挙動を維持できる見通しが立っている。

### Phase 2. end-turn 系の共通化

対象:

- `SWAP_WITH_ENEMY`
- `TRAP_WILL`
- `STRONG_WIND_WILL`
- `SUPER_BUOYANCY_WILL`
- `SUPER_GRAVITY_WILL`
- 監査で新たに Group A へ入ったカード

作業:

- human handler の post-selection flow を shared handoff helper に統一する。
- `isProcessing` / `isCardAnimating` を publish + turn start 完了まで保持する。
- end-turn 系 action には policy に従って deferred publish を適用する。
- turn pipeline 側の handoff 条件と human handler 側の handoff 条件を一致させる。

完了条件:

- end-turn 系カードで「次の手番が始まらない」「同じ席が演出中に再入力できる」が再現しない。
- end-turn 系 handler に固有の `continueAfterXxxTurnHandoff` が増えていないか、増えても共通 helper 呼び出しだけに薄化されている。
- network-client / game / cpu の 3 層で end-turn 判定が一致している。

### Phase 3. continue-turn 系の busy lock 安定化

対象:

- Group B の board selection card 群
- stale board click / stale hand click 関連共通経路

作業:

- `runTurnWithAdapter(...)` 後に playback が残るカードで、unlock を `playback idle` 基準へ寄せる。
- `ensureCurrentPlayerCanActOrPass(...)` を「unlock 後の補助」に限定し、unlock 自体の責務を shared helper に寄せる。
- queued presentation events を interaction lock に含める。
- human board click と hand click の両方で stale playback lock recovery を共通化する。

完了条件:

- continue-turn 系カードで、selection 演出中に盤面や手札へ早押ししても stale click で壊れない。
- 盤面更新待ち中に legal hint や clickable 状態が先に戻らない。
- hand と board の unlock 条件が別実装のまま放置されていない。

### Phase 4. 多段選択カードの最終確定化

対象:

- `POSITION_SWAP_WILL`
- `BOARD_EXPANSION_GOD`

作業:

- intermediate selection と final selection を policy 上で分離する。
- 1 回目 selection では pending と UI lock を正しく維持し、最終確定時だけ final publish を行う。
- multi-stage 中の network snapshot が、相手側で selection 完了扱いにならないようにする。

完了条件:

- `POSITION_SWAP_WILL` の 1 回目選択後に pending が正しく残る。
- `BOARD_EXPANSION_GOD` の 1 回目選択後に final publish / final unlock が走らない。
- 最終 selection 後だけ snapshot / playback / lock 解放が完結する。

### Phase 5. hand / overlay 選択カードの統一

対象:

- `HEAVEN_BLESSING`
- `CONDEMN_WILL`
- `cards/card-interaction.js`

作業:

- `_executeHeavenSelection(...)` / `_executeCondemnSelection(...)` を shared selection completion helper に寄せる。
- hand remove / overlay close / board update / network publish / unlock の順序を固定する。
- overlay 選択中の stale click と二重決定を防ぐ。

完了条件:

- hand/overlay 系で、選択確定後に UI が二重反応しない。
- `CONDEMN_WILL` の hand_remove 演出中にクリック可能状態が先戻りしない。
- board selection 系と hand/overlay 系で post-selection 契約が共通化されている。

### Phase 6. CPU / selector / selfplay の整合化

対象:

- `game/cpu-decision.js`
- `game/turn-handlers/pending-target-selector.js`
- `src/engine/selfplay-runner.js`

作業:

- pending selection policy を CPU 側へも流し込み、defer / handoff / multi-stage finalization の判定を共通化する。
- `pending-target-selector` は target choice に専念させ、network/playback 契約を持たせない。
- selfplay と headless path で selection contract が変質しないことを確認する。

完了条件:

- CPU 側に root 側と別定義の selection-only end-turn set が残っていない。
- same pending type に対する action payload が human / CPU / selfplay で矛盾しない。
- policy table を変えれば human/CPU の両方に反映される構造になっている。

### Phase 7. 回帰テスト拡張

対象:

- `test/game.*`
- `test/ui.network-client.*`
- `test/cards.*`
- `test/cpu.*`
- 必要に応じて `test/e2e/*`

最低限増やす観点:

- Group A: handoff 完了まで lock を保持し、publish が 1 回で終わる
- Group B: selection playback 中に stale click が入らない
- Group C: intermediate stage では final publish しない
- Group D: hand_remove / overlay close を含む selection 完了順序が壊れない
- Group E: CPU action payload と defer 判定が shared policy と一致する

完了条件:

- 各グループに少なくとも 1 本以上の network/playback regression test が追加されている。
- 既存の `swap` / `trap` / `movement` だけに偏った coverage が解消されている。
- 新しい bug 報告に対して「どの group の test が守るか」を答えられる。

### Phase 8. worker-public 同期と公開前確認

対象:

- mirror 対象ファイル
- network deploy 前確認手順

作業:

- root 側完了後に `npm run worker:prepare` を実行する。
- script path / classic script load / mirror 差分を再確認する。
- deploy が必要ならローカル 2 タブ対戦の smoke を行ってから公開する。

完了条件:

- root と worker-public の対象ファイルが一致している。
- 公開 URL と root runtime の差異が「未同期」ではなく説明可能な差だけになっている。

### Phase 9. 最終監査

対象:

- 変更済みコード
- テスト結果
- 監査用 grep

作業:

- pending selection の type list 重複が残っていないか監査する。
- 早期 unlock / ad-hoc defer / intermediate finalization 誤判定が残っていないか確認する。
- `01-rulebook.md` 更新要否を最終確定する。

完了条件:

- 「手番終了系」「同一手番継続系」「多段選択」「手札/overlay 選択」の 4 系統すべてについて、shared policy と test が揃っている。
- 監査時に未説明のカード個別特例が残っていない。
- 最終報告で、実行テストと `01-rulebook.md` 更新有無を明記できる。

## 6. 実装順の推奨

1. Phase 0 と Phase 1 を先に終わらせ、契約と helper を固定する。
2. 既に壊れやすさが確認できている Group A を共通化する。
3. stale click 事故を減らすため、Group B の busy lock を先に締める。
4. その後で多段選択と hand/overlay を分離対応する。
5. 最後に CPU と mirror をそろえる。

## 7. 推奨検証コマンド

段階別に以下を使う。

```bash
npx jest --runInBand test/game.swap-selection-turn-handoff.test.js test/game.trap-selection-turn-handoff.test.js test/game.movement-selection-turn-handoff.test.js
npx jest --runInBand test/ui.network-client.swap-deferred-publish.test.js test/ui.network-client.trap-deferred-publish.test.js test/ui.network-client.movement-deferred-publish.test.js test/ui.network-client.publish-base-version.test.js test/ui.network-client.reconnect-sync.test.js
npx jest --runInBand test/game.position-swap-will.test.js test/game.board-expansion-will.test.js test/game.time-bomb-selection.test.js test/game.blockade-will.test.js test/game.guard-will.test.js test/game.teleport-will.test.js test/game.cell-teleport-will.test.js
npx jest --runInBand test/cpu.turn-handler.pending.test.js test/cpu.decision.refactor.test.js test/selfplay.runner.test.js
npm run worker:prepare
npx jest --runInBand test/index.card-module-scripts.test.js test/index.local-script-paths.test.js
```

必要なら最後に `npm run test:jest:changed` を追加する。

## 8. 01-rulebook.md 更新方針

- 現時点では「既存仕様どおりに network/playback 契約をそろえる」計画なので、実装着手時に仕様変更が無ければ [01-rulebook.md](..\..\01-rulebook.md) の更新は不要と見なす。
- ただし Phase 0 の監査で「turn end か continue-turn か」が仕様書だけでは決められないカードが出た場合は、そのカードに限って先に仕様を補う。

## 9. 最終完了条件

- 公開 URL のネット対戦で、選択系カード使用後に「入力不能」「同席の早押し」「多段選択の途中壊れ」「overlay 選択後の二重反応」が再現しない。
- pending selection card の network/playback 契約が shared policy に集約されている。
- human / CPU / selfplay / network-client / worker-public の 5 層で契約がずれていない。
- 実行テストと結果を最終報告に記載できる。
- 最終報告で [01-rulebook.md](..\..\01-rulebook.md) の更新有無と、その理由を明記できる。
> Status Update (2026-03-21)
>
> この selection card stabilization plan で対象にしていた network selection 系の不安定化は完了。
> 単段 selection だけでなく multi-stage / hand-overlay / authority / sound / effect log / busy owner / race hardening まで含めて、[network-presentation-authority-rebuild-master-plan-2026-03-21.md](./network-presentation-authority-rebuild-master-plan-2026-03-21.md) に統合済み。
>
> この文書の扱い:
> - 局所改善フェーズの記録として保持
> - 現在の完了状態と検証結果は master plan 側が正本

