# ネット対戦 parity hardening 実装計画書

作成日: 2026-03-17
対象: ui / game / shared / workers / scripts / utils / test / docs / worker-public
状態: Draft
前提文書: docs/network-single-writer-plan-2026-03-16.md

## 0. この文書の位置づけ

- この文書は、**ネット対戦でだけ生まれる不具合を再発しにくくするための hardening 計画**である。
- 一次仕様は `01-rulebook.md` とし、本文書は runtime guard、診断、検証束、運用 gate を定める。
- `docs/network-single-writer-plan-2026-03-16.md` で server-authoritative / Single Writer / Playback SSOT の基礎は整備済みである。本計画はその上で、**network 固有の境界だけに残る崩れやすさ** を段階的に詰める。

## 0.1 結論

- 最優先で詰めるべきなのは timeout 値そのものではなく、次の 4 境界である。
  1. `baseVersion` と `stateVersion` の扱い
  2. `operationId` と idempotent replay の扱い
  3. `applySnapshot()` 前後の integrity / queue / busy 契約
  4. local / worker / local-match-server / browser の parity を止める検証 gate
- `networkDebugEnabled` は引き続き明示 opt-in のままにし、通常プレイへ常時ノイズを入れない。
- 再発防止の主軸は「debug を常時強化すること」ではなく、**test / debug では即検知し、本番では静かに壊れにくい構造へ寄せること** である。

## 0.2 構造変更を選ぶ理由

- network 固有バグは、同じ visible behavior が `publish -> worker authority -> snapshot apply -> playback queue -> local immediate UI` の複数境界にまたがるため、責務境界内の修正だけでは再発しやすい。
- local 対戦では通るのに network だけ壊れる不具合は、SSE、reconnect、retry、idempotent replay、snapshot force apply の境界でしか出ない。
- そのため今回は「一箇所だけの修理」ではなく、**guard と検証束を段階的に増やす hardening 計画**として扱う。

## 1. 検証済みの前提

### 1.1 client 側の既存 guard

- `ui/network-client.js`
  - `baseVersion` を publish payload へ常に載せ、サーバー authoritative state と楽観的競合を検出している。
  - `publishChain` と publish tracker により、連続操作の送信順と self-SSE 重複適用の抑止を管理している。
  - heartbeat でより新しい `stateVersion` を受けた時だけ `syncLatestStateWithRetry()` を走らせる。
- `ui/network/snapshot.js`
  - stale snapshot は `force !== true` なら reject する。
  - incoming playback が無い force sync では local presentation queue を preserve し、incoming playback がある時だけ queue を空にする。
  - shadow playback は suppress 経路として残るが、Single Writer 後は利用面が狭くなっている。
- `ui/network/session-seat.js`
  - `networkDebugEnabled` は `value === true` だけを有効とする明示 opt-in であり、通常時に自動有効化されない。

### 1.2 server / local server 側の既存 guard

- `workers/match-worker.mjs` と `scripts/local-match-server.js`
  - client-authored snapshot publish を受けず、command payload 必須で authoritative turn 適用する。
  - `seatKey`, `seatToken`, `expectedPlayerKey`, `baseVersion` を検証して out-of-turn / version mismatch を reject する。
  - `lastAcceptedOperationBySeat` により、同一 `operationId` の再送を idempotent replay として処理する。
  - `networkDebugEnabled` は room 単位で保持するが、debug action は room debug 有効時だけ許可する。
- `utils/match-authority.js`
  - 相手手札 hidden token の妥当性確認、publish 前 rehydrate、transient presentation state の strip を共通化している。

### 1.3 playback / UI 側の既存 guard

- `shared/playback-event-helpers.js`
  - final playback 組み立ての shared SSOT と phase-safe append helper を持ち、worker / local server / adapter の drift を減らしている。
- `ui/animation-utils.js`
  - 共有 `handLayer` / `handWrapper` を queue 化し、network で起きやすい hand animation の重なりを防いでいる。
- `ui/animation-engine.js`
  - local immediate sound と authoritative playback sound の二重再生を防ぐ `__skipNextPlaybackSoundUntilByKey` registry を読む。
- `ui/handlers/init.js` と `cards/card-interaction.js`
  - sell / condemn のような local 即時音がある経路は、次の matching playback sound を 1 回だけ skip する。

### 1.4 既存の検証束

- `test/ui.network-client.publish-base-version.test.js`
  - 最新版番号での再送、同一 version self-SSE の重複適用抑止、先行応答での巻き戻り防止を固定している。
- `test/ui.network-client.reconnect-sync.test.js`
  - reconnect、heartbeat resync、pending publish 中 force sync の巻き戻り抑止を固定している。
- `test/ui.network-client.result-sync.test.js`
  - snapshot apply 時の queue preserve / clear、busy lock、force sync board update context を固定している。
- `test/ui.network-client.action-bridge-next-snapshot.test.js`
  - command publish 契約、deferred pending publish、network payload へ local shadow source を漏らさない契約を固定している。
- `test/ui.network-client.trap-deferred-publish.test.js`
  - deferred combined publish の 1 回性を固定している。
- `test/workers.match-publish-sanitize.test.js`
  - legacy snapshot publish reject、authoritative publish sanitize、network debug command gate を固定している。
- `test/network.playback-event-assembly.contract.test.js`
  - UI adapter / worker / local-match-server の playback assembly 契約を固定している。
- `npm run match:check -- --base <url>`
  - local match server に対する create / join / rejoin / stream / publish / leave smoke を持つ。

## 2. 目的

- network だけで発生する duplicated apply、stale rollback、queue 汚染、sound 二重化、hand layer 競合を **境界契約で止める**。
- runtime default は静かなまま維持しつつ、test / debug / manual verification では崩れをすぐ検知できる状態にする。
- worker と local-match-server を同じ contract のまま進化させ、local 検証と本番 worker の挙動差を減らす。

## 3. 非目標

- 新しい protocol version の導入
- visible rule / effect / animation timing の仕様変更
- `networkDebugEnabled` の常時 on 化
- version mismatch 時の常時 full resync / 常時 force apply
- 単純な timeout 短縮だけで問題を解決したことにすること
- 新しい外部サービスや新規 test tool の導入

## 4. 残す契約

- server-authoritative / command-only publish
- `baseVersion` による競合検知
- `operationId` による再送と idempotent replay
- pending selection の deferred publish 契約
- `shared/playback-event-helpers.js` を正本にする playback assembly 契約
- `networkDebugEnabled` は明示 opt-in のみ
- root を正本とし、`worker-public/` は最後に `npm run worker:prepare` で同期する

## 5. 詰めるべき設定 / 契約

### 5.1 最優先

1. **version mismatch の扱いを明文化して tighten する**
   - `VERSION_MISMATCH` を受けた時に、何を stateVersion だけ更新し、何を force apply し、何を skip するかを 1 箇所に固定する。
   - 「pending の newer local op があるのに古い rejection snapshot を blind force apply する」系の巻き戻り余地を潰す。

2. **operationId と idempotent replay の parity を固定する**
   - worker / local-match-server の両方で、同一 `operationId` replay の戻り payload を同じ shape に揃える。
   - client 側 publish tracker と server 側 replay の組み合わせが崩れた時に test で止まるようにする。

3. **snapshot apply の integrity gate を入れる**
   - `applySnapshot()` 前に最低限の shape / version / transient queue 契約を検査する。
   - server 側 sanitize で空にしたはずの `presentationEvents` / `_presentationEventsPersist` が client 側へ残っていないことを check する。

4. **network parity の検証束を merge 前 gate として定義する**
   - local unit test だけでなく、network Jest 束 + local match smoke + headed self-match の 3 面を明文化する。

### 5.2 高優先

5. **playback diagnostics の昇格条件を統一する**
   - test では fail、debug では詳細可視化、通常時は silent success にしない程度の軽い観測へ揃える。

6. **shared hand-layer / sound dedupe の bypass を禁止する**
   - 新しい hand carry は `ui/animation-utils.js` の queue 経由、新しい local 即時音は skip registry 経由というルールを文書化し、関連 test を必須にする。

7. **force sync と board update context の扱いを tighten する**
   - `force: true` を使う path を棚卸しし、board update suppress / queue preserve 条件を file 単位で明示する。

### 5.3 中優先

8. **network telemetry を debug 条件で観測可能にする**
   - stale snapshot reject 回数、version mismatch 回数、idempotent replay 回数、playback diagnostics warnings を room debug 条件で観測できるようにする。

9. **manual self-match を定型化する**
   - 2 ブラウザ同室の headed self-match を「気が向いた時にやる確認」ではなく、network-only bug 修正時の標準検証にする。

## 6. 既定にしない設定

- `networkDebugEnabled` の常時有効化
- production での diagnostics 例外 throw
- heartbeat / stale timeout の短絡的な全体短縮
- every mismatch 時の無条件 full resync
- shared helper を通さない local patch を暫定常設にすること

---

## 7. 段階計画

## Phase 0: 現在の guard matrix と baseline を固定する

### 目的

- 既にある防波堤と、まだ弱い境界を file 単位で固定し、以後の phase で drift を見逃さないようにする。

### 作業

1. `ui/network-client.js`, `ui/network/snapshot.js`, `workers/match-worker.mjs`, `scripts/local-match-server.js`, `utils/match-authority.js` の guard 面を matrix 化する。
2. 次を baseline bundle として固定する。
   - publish / replay / mismatch / reconnect / result-sync / trap defer / snapshot single writer / worker sanitize / playback assembly contract
3. `match:check` を network parity の最低 smoke として plan 内へ格上げする。
4. headed self-match のチェック観点を plan 内へ先に書く。

### 主対象

- ui/network-client.js
- ui/network/snapshot.js
- workers/match-worker.mjs
- scripts/local-match-server.js
- utils/match-authority.js
- test/ui.network-client.*.test.js
- test/ui.network-snapshot.*.test.js
- test/workers.match-publish-sanitize.test.js
- test/network.playback-event-assembly.contract.test.js

### 完了条件

- どの bug がどの boundary の guard 漏れかを plan だけで説明できる。
- baseline bundle と manual self-match checklist が確定している。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\ui.network-client.publish-base-version.test.js test\ui.network-client.reconnect-sync.test.js test\ui.network-client.result-sync.test.js test\ui.network-client.action-bridge-next-snapshot.test.js test\ui.network-client.trap-deferred-publish.test.js test\ui.network-snapshot.single-writer-baseline.test.js test\ui.network-snapshot.move-source-empty.test.js test\workers.match-publish-sanitize.test.js test\network.playback-event-assembly.contract.test.js
```

---

## Phase 1: version / replay / rejection handling を tighten する

### 目的

- stale rollback と duplicated publish を、client/server の片側対策ではなく **往復契約** で止める。

### 作業

1. `ui/network-client.js`
   - rejection 応答処理を棚卸しし、`VERSION_MISMATCH` と replay / stale 応答の扱いを helper 化する。
   - newer local op が既に queue 済みの時に、older rejection snapshot を blind force apply しない条件を明文化する。
2. `workers/match-worker.mjs` と `scripts/local-match-server.js`
   - 同一 `operationId` replay 応答 shape を揃える。
   - `VERSION_MISMATCH` 応答に含める debug / meta 情報を parity させる。
3. `test/ui.network-client.publish-base-version.test.js`
   - replay、rejection、version mismatch、巻き戻り抑止の期待を追加・更新する。
4. `test/workers.match-publish-sanitize.test.js`
   - worker / local server parity を崩さない assertion を追加する。

### 主対象

- ui/network-client.js
- workers/match-worker.mjs
- scripts/local-match-server.js
- test/ui.network-client.publish-base-version.test.js
- test/workers.match-publish-sanitize.test.js

### 完了条件

- 同一 `operationId` 再送で client / worker / local server の契約差がない。
- rejection 応答で newer local state が巻き戻らない。
- `VERSION_MISMATCH` の扱いが 1 箇所で説明できる。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\ui.network-client.publish-base-version.test.js test\ui.network-client.reconnect-sync.test.js test\workers.match-publish-sanitize.test.js
```

---

## Phase 2: snapshot apply integrity と queue 契約を tighten する

### 目的

- network snapshot が local presentation queue と busy lock を壊す余地を減らす。

### 作業

1. `ui/network/snapshot.js`
   - incoming snapshot の minimum integrity check を追加する。
   - `force`, `allowStaleShadowPlayback`, `playbackEvents`, `shadowPlaybackEvents`, `preservedQueues` の責務境界を helper 化する。
2. `utils/match-authority.js`
   - server 側 sanitize 契約を再確認し、client 側 integrity check と矛盾しない shape を固定する。
3. `ui/network-client.js`
   - `force: true` を使う path を棚卸しし、board update context clear / preserve の意図を comment ではなく test で固定する。
4. 回帰テストを追加・更新する。
   - force sync without playback preserves local queues
   - stale snapshot reject
   - force snapshot clears stale board update context only when allowed
   - transient presentation state が incoming snapshot に残っていても busy / queue が壊れない

### 主対象

- ui/network/snapshot.js
- ui/network-client.js
- utils/match-authority.js
- test/ui.network-client.result-sync.test.js
- test/ui.network-snapshot.single-writer-baseline.test.js
- test/ui.network-snapshot.move-source-empty.test.js

### 完了条件

- `applySnapshot()` 前後の integrity / queue / busy 契約が test で固定されている。
- server sanitize と client apply の前提差が残っていない。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\ui.network-client.result-sync.test.js test\ui.network-snapshot.single-writer-baseline.test.js test\ui.network-snapshot.move-source-empty.test.js test\workers.match-publish-sanitize.test.js
```

---

## Phase 3: diagnostics / telemetry / debug gate を tighten する

### 目的

- network-only drift を、本番でうるさくしすぎずに test / debug で即観測できるようにする。

### 作業

1. `workers/match-worker.mjs` と `scripts/local-match-server.js`
   - playback diagnostics の出し方を parity させる。
   - test では fail、debug では詳細 payload、通常時は silent success にならない最小観測へ揃える。
2. `ui/network-client.js`
   - version mismatch、stale snapshot reject、heartbeat resync、idempotent replay を debug 条件で観測できる最小 telemetry を追加する。
3. `ui/network/session-seat.js` と `ui/handlers/match-mode.js`
   - `networkDebugEnabled` が explicit opt-in のまま維持されることを確認し、通常入室時に自動有効化されない契約を test で固定する。
4. `ui/animation-utils.js`, `ui/animation-engine.js`, `ui/handlers/init.js`, `cards/card-interaction.js`
   - 新規 network patch が hand queue / sound skip registry を bypass していないことを test 名で読める形に補強する。

### 主対象

- workers/match-worker.mjs
- scripts/local-match-server.js
- ui/network-client.js
- ui/network/session-seat.js
- ui/animation-utils.js
- ui/animation-engine.js
- ui/handlers/init.js
- cards/card-interaction.js

### 完了条件

- `networkDebugEnabled` を常時 on にせずに drift を追える。
- playback diagnostics と network telemetry の観測面が worker / local server / client で矛盾しない。
- shared hand-layer queue と sound skip registry の bypass が test で止まる。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\workers.match-publish-sanitize.test.js test\ui.match-mode.network-button.test.js test\ui.animation-utils.hand-fallback.test.js test\ui.animation-engine.test.js test\ui.init.sell-sound.test.js
```

---

## Phase 4: validation gate を実運用レベルまで上げる

### 目的

- 「ユニットは通るが network 実機だけ壊れる」を merge 前に止める。

### 作業

1. pre-merge の required bundle を定義する。
   - baseline network Jest 束
   - playback assembly contract
   - worker sanitize
   - `npm run match:check`
2. headed self-match の checklist を runbook 相当に落とし、network-only bug 修正時の標準確認にする。
3. local match server と worker の parity を崩す差分が入った時は、片側だけの test pass で終わらない gate を決める。
4. `worker-public/` mirror へ影響がある変更では `npm run worker:prepare` を完了条件へ含める。

### 主対象

- package.json（必要なら script alias のみ）
- test/ui.network-client.*.test.js
- test/ui.network-snapshot.*.test.js
- test/workers.match-publish-sanitize.test.js
- test/network.playback-event-assembly.contract.test.js
- scripts/match-network-smoke.js
- docs/network-worker-deploy.md（必要時）

### 完了条件

- network-only bug 修正時の最低検証束が明文化されている。
- local unit test だけでは完了扱いしない運用に切り替わっている。
- worker-public 同期要否が曖昧でない。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\ui.network-client.publish-base-version.test.js test\ui.network-client.reconnect-sync.test.js test\ui.network-client.result-sync.test.js test\ui.network-client.action-bridge-next-snapshot.test.js test\ui.network-client.trap-deferred-publish.test.js test\ui.network-snapshot.single-writer-baseline.test.js test\ui.network-snapshot.move-source-empty.test.js test\workers.match-publish-sanitize.test.js test\network.playback-event-assembly.contract.test.js
npm run match:check -- --base http://127.0.0.1:8787
```

---

## Phase 5: 最終検証と終了条件

### 目的

- hardening が「理屈上正しい」だけでなく、実際に network 実機で壊れにくくなったことを確認する。

### 作業

1. targeted network Jest を再実行する。
2. local match server で `match:check` を通す。
3. headed 2 ブラウザ self-match を行う。
   - create/join
   - 通常配石
   - pass
   - pending selection
   - reconnect
   - 終局
   - 結果表示
   - hand animation / sound / playback 順の目視確認
4. `worker-public/` へ影響がある root 変更では `npm run worker:prepare` を通す。

### 完了条件

- stale rollback、duplicated apply、sound 二重化、hand layer 競合の再現パターンが検証束で止まる。
- worker / local-match-server / browser の parity が説明可能で、片側だけ特別扱いの patch が残っていない。
- `01-rulebook.md` 更新不要のまま、visible spec を変えずに hardening が完了している。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\ui.network-client.publish-base-version.test.js test\ui.network-client.reconnect-sync.test.js test\ui.network-client.result-sync.test.js test\ui.network-client.action-bridge-next-snapshot.test.js test\ui.network-client.trap-deferred-publish.test.js test\ui.network-snapshot.single-writer-baseline.test.js test\ui.network-snapshot.move-source-empty.test.js test\workers.match-publish-sanitize.test.js test\network.playback-event-assembly.contract.test.js test\ui.animation-utils.hand-fallback.test.js test\ui.animation-engine.test.js test\ui.init.sell-sound.test.js
npm run worker:prepare
```

### 実機検証束（手動）

1. 同室 2 クライアントを接続する。
2. 通常配石を数回行い、相手側で hand animation が毎回順番どおり出ることを確認する。
3. sell / condemn / destroy 系で効果音が 1 回だけ鳴ることを確認する。
4. reconnect 後に局面・手札・結果表示がずれないことを確認する。
5. pending selection を使うカードを 3 種以上試し、選択完了まで同期が崩れないことを確認する。

## 8. リスク管理

| リスク | 影響 | 対策 |
|---|---|---|
| guard を増やしすぎて通常時ノイズが増える | 通常プレイのログ汚染 | debug/test と通常 runtime の境界を維持する |
| worker だけ直して local-match-server が古いまま残る | local 検証と本番 worker の差が再発 | Phase 1-4 で常に worker と local server を対で更新する |
| version mismatch 対策が強すぎて操作不能になる | recoverability 低下 | blind force apply と無条件 full resync を避け、段階的に tighten する |
| 新しい local 即時音や hand carry が shared helper を bypass する | network-only 音/視覚バグ再発 | helper 利用を test 名で読める形に固定する |
| headed self-match が後回しになる | network-only bug を unit test だけで見落とす | Phase 4 で manual gate に格上げする |

## 9. ロールバック方針

1. version / replay / snapshot / diagnostics を別 phase で進め、問題が出た phase だけ戻せるようにする。
2. worker / local-match-server parity を崩す差分は file 単位で戻し、shared helper 契約は原則戻さない。
3. 再現ケースが見つかったら、先に test へ固定してから forward する。

## 10. 受け入れ基準

1. network-only bug の主境界である `baseVersion`, `operationId`, `applySnapshot`, diagnostics, shared hand/sound helper に明示 guard が入っている。
2. worker と local-match-server の publish / replay / mismatch 契約差がない。
3. network Jest 束、playback assembly contract、worker sanitize、`match:check` が完了条件に含まれている。
4. headed self-match の manual 検証項目が plan に含まれている。
5. `networkDebugEnabled` は常時 on にせず、通常 runtime を静かに保ったまま debug/test で崩れを観測できる。
6. `01-rulebook.md` の更新なしで済む範囲に hardening が収まっている。

## 11. 01-rulebook.md 方針

- 本計画は内部 hardening であり、visible behavior の仕様変更を含まないため、現時点では `01-rulebook.md` 更新は不要。
- もし今後、network 対戦だけ意図的に別の見え方や遅延見せ方を許可する判断を行う場合は、その時点でこの plan とは別に `01-rulebook.md` を先に更新する。

## 12. 既存文書との関係

- `docs/network-single-writer-plan-2026-03-16.md`
  - server-authoritative / Single Writer / Playback SSOT の基礎整備を扱う。
  - 同文書の終了後に残る「network-only 再発防止の hardening」は別文書へ切る方針だったため、本計画はその後続として分離する。
- `docs/network-foundation-separation-implementation-plan-2026-03-15.md`
  - authority と projection の責務分離方針を前提として引き継ぐ。
- `docs/network-selection-card-stabilization-plan-2026-03-14.md`
  - pending selection 周辺の前提安定化を引き継ぎ、deferred publish 契約を残す。

## 13. この計画の終了点

- Phase 5 の検証束と manual self-match を通し、worker-public が必要時に同期された時点で本計画は完了とする。
- その後の改善（optimistic hint、詳細 telemetry UI、RTT 最適化など）は別文書に切り出す。

