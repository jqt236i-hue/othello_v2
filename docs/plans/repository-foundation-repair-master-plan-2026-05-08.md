# リポジトリ基盤全面修復マスタープラン

**作成日**: 2026-05-08  
**対象**: `tsconfig*.json`, `game/`, `ui/`, `workers/`, `shared/`, `scripts/`, `test/`, `dist/`, `worker-public/`, `docs/`  
**状態**: Reviewed Draft  
**関連資料**: `docs/plans/typescript-migration-completion-plan-2026-05-07.md`, `docs/plans/typescript-migration-residual-fix-plan-2026-05-07.md`, `BACKEND_ARCHITECTURE_AUDIT.md`

## レビュー反映

- 2026-05-08: 検証コマンドを実在する script / test path に寄せ、説明語だけの `browser boot smoke` / `wrapper inventory script` を明確化した。
- 2026-05-08: `npm run match:server` のような常駐プロセスを自動検証束から外し、起動確認は `npm run match:check` または明示的な手動確認に寄せた。
- 2026-05-08: Phase 1 の `rg` 検証は PowerShell でも実行しやすい quoting に直した。

## 0. この文書の位置づけ

- この文書は、2026-05-08 の精密調査で確認した「build 正本崩れ」「Jest / DI 崩れ」「network authority 契約不整合」をまとめて完全修復するための umbrella master plan である。
- 一次仕様は `01-rulebook.md`、内部契約は `docs/architecture-contracts.md`、進め方は `AGENTS.md` に従う。
- 今回の主眼は仕様追加ではなく、root 正本・生成物・mirror・テスト基盤・authority 契約を再整備し、repo を clean に再現可能な状態へ戻すことにある。
- `dist/` は生成物、`worker-public/` は mirror であり、どちらも正本として扱わない。修復は必ず root から行う。
- 既存の TypeScript 移行 plan と backend audit は、この計画の入力資料として扱う。完了条件や実行順の正本はこの文書に置く。

## 1. 一次情報

- `01-rulebook.md`: カード挙動、見え方、タイミングの正本
- `docs/architecture-contracts.md`: `game/` / `ui/` / Worker / `shared/` の境界、authority、DI、state 契約
- `package.json`: build / test / check / worker sync の現行実行契約
- `tsconfig.json`, `tsconfig.test.json`: compile / typecheck 契約
- `BACKEND_ARCHITECTURE_AUDIT.md`: network authority の根本問題の棚卸し
- `docs/plans/typescript-migration-completion-plan-2026-05-07.md`: TypeScript 正本化の既存方針
- `docs/plans/typescript-migration-residual-fix-plan-2026-05-07.md`: 既知の残課題と focused test 情報

## 2. 非目標

- カード仕様やルールの追加・変更
- `dist/` や `worker-public/` の直編集による場当たり修正
- 外部依存の追加を前提にした解決
- legacy JS の一括削除だけを先に進めること
- network authority の修正を UI の一時 fallback だけで隠すこと

## 3. 調査ベースライン

2026-05-08 に root で次を確認した。

| コマンド | 結果 | 補足 |
| --- | --- | --- |
| `npm run typecheck` | PASS | `tsc --noEmit` は通る |
| `npm run checkall` | PASS | `dist-wrapper: 348`, `legacy-implementation: 22`, `unknown: 52` を許容したまま green |
| `npm run worker:prepare` | PASS | 既存 `dist/` 前提で通る |
| `npm run build:ts` | FAIL | `TS5055`。`dist/**/*.d.ts` を入力として拾い、出力先と衝突 |
| `npx tsc --noEmit --explainFiles` | FAIL原因を確認 | `game/logic/random-source.js` と `workers/match-worker.mjs` 経由で `dist/*.d.ts` が input 化 |
| `npx jest --runInBand --listTests` | 933 tests | full suite は大規模 |
| `npx jest --runInBand --silent` | FAIL | build / runtime / DI / authority の複合崩れを再現 |

full Jest で確認した代表失敗:

- `test/workers.match-stream-sse.test.js`: `worker.fetch is not a function`
- `test/ui.network-work-will-followup-placement.test.js`: `globalThis.CARD_DEFS` 前提崩れ
- `test/ui.bootstrap.cpu-early-registration.test.js`: `require is not a function`
- `test/ui.bootstrap.lazy-install.test.js`: DI install 未実行
- `test/ui.animation-utils.hand-fallback.test.js`: hand fade state の seat 解決不整合
- `test/presentation.board-updated.serial.test.js`: playback drain / CPU scheduling 不整合
- `test/game.proliferation-will.test.js`: `BoardOps requires an injected deterministic PRNG`
- `test/cpu.turn-handler.onnx-hold.test.js`: `TurnPipeline is not available - cannot process pass`

構造証拠:

- `game/logic/random-source.js` は `../../dist/game/logic/cards-internal/random-source` を読む wrapper である
- `workers/match-worker.mjs` は `../dist/workers/match-worker.js` を export する
- `scripts/run-all-checks.js` と `scripts/prepare-worker-assets.js` も `dist/scripts/*` へ forward している
- `BACKEND_ARCHITECTURE_AUDIT.md` では `stateVersion` conflation、hidden-hand rehydration、turn-start reconciliation、SSE resume、seat token race を structural issue として列挙している

## 4. 根本問題マップ

### 4.1 正本崩れ

- root source と生成物 `dist/` の境界が壊れている
- compile graph に root wrapper JS が入り、`dist/` が生成先でありながら入力にもなっている
- `exclude: dist` でも、wrapper 経由で `dist/*.d.ts` が引き込まれる

### 4.2 検証 green の偽陽性

- `typecheck` が通っても `build:ts` は失敗する
- `checkall` は既存 debt を allow した inventory gate で green になる
- clean checkout や empty `dist/` を前提にした再現可能性を保証していない

### 4.3 runtime / test harness の契約欠落

- `game/` や周辺 runtime が `globalThis.CARD_DEFS`, ambient `require`, `TurnPipeline`, `worker.fetch` に依存している
- deterministic PRNG, playback queue, classic-script bridge の注入経路が暗黙で、テスト順や実行形態に弱い

### 4.4 authority 契約の破綻

- publish version lock と sequence を `stateVersion` 1本で兼用している
- hidden hand の canonical / projection が双方向 rehydrate 前提で壊れやすい
- turn-start reconciliation が server 内で暗黙に起き、client に authority marker が返らない
- SSE resume と reconnect contract が不完全

### 4.5 mirror / browser boot の不透明化

- `worker-public/` と browser entry が stale `dist/` で成立しても検出しにくい
- root 正本、compat shim、generated asset、mirror の責務境界が repo で明文化されていない

## 5. 最終到達状態

この計画の完了は、次を満たした時だけ成立する。

1. fresh clone または一時 worktree で、事前生成済み `dist/` なしに `npm run build:ts` が通る
2. canonical source, compat shim, generated asset, mirror の境界が明示され、source から `dist/` を input として読まない
3. `npm run checkall`, `npm run worker:prepare`, `node scripts/browser-boot-smoke.js`, `npx jest --runInBand --silent`, `npm run test:network:parity`, `npm run match:check` が green になる
4. `game/` / `ui/` / Worker / test harness の DI が ambient global 依存ではなく契約化される
5. network authority が explicit snapshot / publish / resume contract を持ち、server-authoritative の意味が再現可能になる
6. `worker-public/` は root から正規再生成され、直編集前提が消える
7. 安定した契約は `docs/architecture-contracts.md` に昇格し、古い完了扱い plan と現実のずれが解消される

## 6. 実行原則

- 先に build graph と正本境界を直す。full suite の個別失敗潰しはその後に行う。
- root 正本を先に直し、compat shim と generated / mirror は後で揃える。
- JS wrapper を一括削除しない。まず「どれが compat shim で、どれが実装なのか」を固定する。
- authority 修正は worker 単体で閉じず、client snapshot / publish / reconnect 契約まで同じ phase で閉じる。
- 仕様差分が出る場合だけ `01-rulebook.md` を更新する。build / DI / authority metadata だけなら原則不要。

## 7. フェーズ計画

### Phase 0: ベースライン固定

**目的**: 修復作業の前提と検証束を固定し、途中で「何が直ったか」を追えるようにする。

**タスク**:

- 現在の fail bundle をカテゴリ別に確定する
- clean-room 検証手順を決める。既存 workspace を壊さない temporary worktree または clone を使う
- 既存 plan のうち、この計画に吸収されるものを列挙する
- focused Jest bundle を phase 別に整理する

**完了条件**:

- Phase 1 以降で使う検証コマンド一覧が固定されている
- failing test の担当領域が `build`, `runtime`, `presentation`, `authority` に分かれている
- clean-room 検証に destructive command を使わず再現できる

**検証**:

- docs-only。ファイル参照とコマンド一覧の existence を確認する

### Phase 1: build graph と canonical source の分離

**目的**: `dist/` が input 化する現在の compile graph を解消し、root source だけで build を成立させる。

**タスク**:

- `tsconfig` を canonical build 用、production typecheck 用、test typecheck 用などに役割分離する
- canonical build の compile graph から compat `.js` / `.mjs` shim を外す
- source directory から `../dist` / `./dist` を読む import / require を禁止する static check を追加する
- `workers/match-worker.mjs`, `scripts/*.js`, root wrapper `.js` を runtime compat 層として整理する
- legacy 実装 JS は allowlist で明示し、wrapper と同列に扱わない

**完了条件**:

- temporary worktree で `dist/` が存在しない状態から `npm run build:ts` が通る
- `npx tsc --noEmit --explainFiles` で `dist/*.d.ts` が source wrapper 経由で input にならない
- canonical source と compat shim の境界がファイル種別または config で説明できる

**検証**:

- `npm run typecheck`
- `npm run build:ts`
- `npx tsc --noEmit --explainFiles`
- `rg '\\.\\.?/dist' game ui shared workers scripts cards src constants -n`

### Phase 2: compat shim / generated / mirror 契約の固定

**目的**: wrapper が残る理由を固定し、stale `dist/` 依存で green になる経路を塞ぐ。

**タスク**:

- JS を `compat-shim`, `legacy-implementation`, `generated`, `test/tooling` に分類する
- compat shim の形式を統一する
- `scripts/run-all-checks.js`, `scripts/prepare-worker-assets.js`, `workers/match-worker.mjs` の build 前提を明示する
- `entry-browser*.js`, `public/module-registry.js`, `worker-public/` の生成順を固定する
- `checkall` と `scripts/browser-boot-smoke.js` が stale build に依存して通っていないか検証し、必要なら build freshness check を追加する

**完了条件**:

- どの `.js` が shim で、どれが実装か一貫して判別できる
- operational command が「たまたま前回の `dist/` が残っていた」だけでは通らない
- `worker-public/` の再生成順が root -> `dist/` -> `worker-public/` に固定される

**検証**:

- `npm run checkall`
- `npm run worker:prepare`
- `node scripts/browser-boot-smoke.js`
- `node dist/scripts/inventory-js-legacy.js`

### Phase 3: runtime DI と test harness の正常化

**目的**: ambient global と暗黙 require に依存した runtime / test harness を、明示 DI 契約へ寄せる。

**タスク**:

- `globalThis.CARD_DEFS` 前提を bootstrap / test helper 側で解消する
- classic-script 用の `require` / global bridge を source 直参照ではなく adapter に閉じ込める
- `worker.fetch` を返す worker test factory 契約を固定する
- `TurnPipeline`, deterministic PRNG, card catalog, DOM / jsdom setup の共通 helper を `test/helpers/` に集約する
- `game/` の headless path が browser-only global を直接読まないよう整理する

**完了条件**:

- 代表 failing suite が ambient global ではなく helper / DI 契約で動く
- `BoardOps requires an injected deterministic PRNG.` のような implicit failure がなくなる
- test setup / teardown が実行順に依存しない

**検証**:

- `npx jest --runInBand --runTestsByPath test/workers.match-stream-sse.test.js`
- `npx jest --runInBand --runTestsByPath test/ui.bootstrap.cpu-early-registration.test.js`
- `npx jest --runInBand --runTestsByPath test/ui.bootstrap.lazy-install.test.js`
- `npx jest --runInBand --runTestsByPath test/ui.network-work-will-followup-placement.test.js`
- `npx jest --runInBand --runTestsByPath test/game.proliferation-will.test.js test/cpu.turn-handler.onnx-hold.test.js`

### Phase 4: presentation / turn pipeline / animation の整合回復

**目的**: Single Visual Writer を保ったまま、playback queue と CPU scheduling の不整合を解消する。

**タスク**:

- `presentation-handler`, `playback-engine`, `animation-engine`, `turn-manager`, `pass-handler` の queue / drain / CPU follow-up 順序を固定する
- hand fade state を seat / owner 正規化で管理し、座席 swap 時の残留 state を消す
- `WORK_WILL` follow-up placement の early click / replay 抑制を authoritative path に合わせる
- raw presentation batch の normalization を source of truth 1箇所に寄せる

**完了条件**:

- boardUpdated drain と queued CPU turn が順序どおりに実行される
- animation state が座席 swap や authoritative snapshot 適用後に残留しない
- network follow-up placement が client-side speculative replay に依存しない

**検証**:

- `npx jest --runInBand --runTestsByPath test/presentation.board-updated.serial.test.js`
- `npx jest --runInBand --runTestsByPath test/ui.animation-utils.hand-fallback.test.js`
- `npx jest --runInBand --runTestsByPath test/ui.network-work-will-followup-placement.test.js`
- `npx jest --runInBand --runTestsByPath test/ui.animation-engine.test.js test/ui.playback-engine.dispatch.test.js`

### Phase 5: network authority 契約の再設計

**目的**: server-authoritative を実装とテストの両方で説明できる publish / snapshot / reconnect 契約へ組み直す。

**タスク**:

- `stateVersion` の役割を分離し、sequence / optimistic lock / idempotency を1本で兼用しない
- hidden hand を server 内 canonical state と public projection に分離し、publish 時の fragile rehydration をやめる
- turn-start reconciliation の発生を snapshot / response metadata に明示する
- authority marker, snapshot origin, pending effect binding を public contract に追加する
- SSE reconnect を `Last-Event-ID` または明示 full-resync contract で設計し直す
- seat token rejoin race と second-seat initialization race を潰す
- client 側 `ui/network-client.ts`, `ui/network/snapshot*.ts`, `ui/network/action-bridge.ts`, `ui/network/apply-coordinator.ts` を同じ契約へ合わせる

**完了条件**:

- VERSION_MISMATCH が「単なる対戦相手の進行」で過剰発火しない
- hidden hand の canonical write path が client-projected hand に依存しない
- reconnect 後に stale local state と authoritative snapshot を取り違えない
- worker / local server / client の publish contract が同一意味で通る

**検証**:

- `npm run test:network:parity`
- `npx jest --runInBand --runTestsByPath test/workers.match-stream-sse.test.js`
- `npx jest --runInBand --runTestsByPath test/workers.match-publish-idempotency.test.js`
- `npx jest --runInBand --runTestsByPath test/workers.match-heartbeat-stateversion.test.js`
- `npx jest --runInBand --runTestsByPath test/workers.match-leave-token-revocation.test.js`
- `npx jest --runInBand --runTestsByPath test/ui.network-client.reconnect-sync.test.js test/ui.network-snapshot.single-writer-baseline.test.js`
- `npm run match:check`

### Phase 6: browser boot / worker mirror / deploy path の閉路確認

**目的**: build -> browser boot -> worker mirror までを root 正本から通しで保証する。

**タスク**:

- `entry-browser.js`, `entry-browser-augmented.js`, `entry-browser-classic.js` の依存解決を canonical build 前提に固定する
- `public/module-registry.js` と `scripts/browser-boot-smoke.js` を現行構成に合わせる
- `worker-public/` を mirror として再生成し、root / `dist/` と食い違わないことを確認する
- local match server と Worker export path の整合を確認する

**完了条件**:

- browser boot が stale asset ではなく current root build で成立する
- `worker-public/` の mirror sync が再現可能に通る
- Worker / browser / local server が同じ canonical build 由来で起動する

**検証**:

- `npm run build:ts`
- `npm run worker:prepare`
- `node scripts/browser-boot-smoke.js`
- `npm run match:check`

### Phase 7: full suite closure と契約昇格

**目的**: 点検を局所 green で終わらせず、repo 全体の完了条件を閉じる。

**タスク**:

- full Jest を通す
- final verification bundle を fresh clone / temporary worktree で再実行する
- 安定した build / authority / mirror 契約を `docs/architecture-contracts.md` に昇格する
- 現実と矛盾する「完了済み」plan や allowlist の扱いを整理する
- 残留 compat debt がある場合は、範囲と理由を別文書で明示する

**完了条件**:

- repo 全体の完了条件が green
- 完了報告で「何が canonical source か」を1文で言える
- 今後の修正者が `dist/` や `worker-public/` を正本と誤認しない

**検証**:

- `npm run typecheck`
- `npm run build:ts`
- `npm run checkall`
- `npm run worker:prepare`
- `npx jest --runInBand --silent`
- `npm run test:network:parity`
- `npm run match:check`
- `node scripts/browser-boot-smoke.js`

## 8. フェーズ依存関係

| Phase | 依存 | 並列可否 |
| --- | --- | --- |
| Phase 0 | なし | 単独 |
| Phase 1 | Phase 0 | 単独。最優先 blocker |
| Phase 2 | Phase 1 | 一部並列可 |
| Phase 3 | Phase 1 | Phase 2 後半と部分並列可 |
| Phase 4 | Phase 3 | Phase 5 と部分並列可 |
| Phase 5 | Phase 1 | server 側調査は並列可、client 統合は Phase 3 後 |
| Phase 6 | Phase 1, 2, 5 | 後半で実施 |
| Phase 7 | 全Phase | 最終 |

## 9. 主要リスク

- build graph を分離すると、今まで stale `dist/` に隠れていた import 欠落が一気に顕在化する
- legacy JS の中に実質正本が残っている場合、wrapper 扱いして消すと挙動を失う
- authority 再設計は snapshot schema と client replay の両方に波及し、fixture 更新量が大きい
- browser boot / worker / local server の3 runtime を同時に触るため、phase を跨いだ partial green を完了扱いにすると再崩壊する

## 10. `01-rulebook.md` 更新基準

原則としてこの計画は仕様変更を目的にしないため、`01-rulebook.md` の更新は不要と見込む。  
ただし次のどれかが発生する場合は、関連実装より先に更新する。

- プレイヤーに見える pending 解決タイミングが変わる
- カード効果の結果や対象条件が変わる
- local / network で見える turn progression や replay の意味が変わる

## 11. 完了報告で必ず書くこと

- canonical source, compat shim, generated asset, mirror をどう切り分けたか
- `dist/` input 化をどう止めたか
- 実行した verification bundle と結果
- authority 契約で何を `docs/architecture-contracts.md` に昇格したか
- `01-rulebook.md` を更新したかどうかと理由
