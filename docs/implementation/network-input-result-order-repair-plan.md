# ネット対戦の入力再開・終局表示順 根本修正計画

- Status: complete / deployed
- Date: 2026-07-25
- Design: `docs/implementation/network-input-result-order-repair-design.md`

## Task 1: strict terminal result gate

- [x] intake が strict frame の末尾 `visualSeq` を snapshot controller へ内部 marker として渡す。
- [x] terminal result は exact `visualSeq` success、同一room、同一session epoch、同一snapshot version の全条件成立後だけ表示する。
- [x] timeout/reset/missing tracker と旧session callback が結果を表示しない回帰テストを追加する。
- Done: canonical state は即時更新され、最終演出中のリザルト表示が0回で、settlement後に1回だけ表示される。

## Task 2: pending exact settlement

- [x] pending publish の既定1,500ms success timeoutを廃止し、accepted `visualSeq` を期限なしで待つ。
- [x] `{ok:false}`/reject をsuccessへ変換せず、playback flagsを外部から強制解除しない。
- [x] server-authored click replay と selection-flow をexact `visualSeq` success後へ統一する。
- Done: 3秒以上の演出、late start、timeout/resetで次操作が先行せず、正常settlement後だけbusy/bufferが進む。

## Task 3: session single-flight and pinned server URL

- [x] create/join/spectate/保存済みsession復帰で共通のentry tokenをactivation完了まで保持する。
- [x] identity、HTTP、retry、timeline dispose後にsession epoch/roomを再検証する。
- [x] active room中のserver URL変更をAPI/lifecycle/UIで拒否する。
- Done: 二重entry、stale activation、SSE/HTTP splitが起こらない。

## Task 4: room-list response ordering

- [x] refresh request generationを追加し、最新応答だけを描画する。
- [x] active roomの一覧更新はpinned URLだけを使用する。
- Done: 逆順完了で古い一覧やエラー表示に戻らない。

## Task 5: focused verification

- [x] intake/snapshot/result sync
- [x] visual settlement/playback state/presentation timeline
- [x] pending network/card selection/click replay
- [x] session lifecycle/lobby/list ordering
- [x] legacy result-order testsをplayer-visible正本へ合わせる

## Task 6: integration verification

- [x] `npm run typecheck`（`build:browser` / `build:vite` 内を含む）
- [x] `npm run check:window`
- [x] `npm run test:network:parity`（35 suites、557 tests）
- [x] `npm run build:browser`
- [x] Pixi strict playback check（12構成、208シナリオ）
- [x] Chrome/Edge two-client smoke（create/join/place/next-turn、console/page error 0件）
- [x] network endgame smoke（5試合、各version 64、60手＋3パス）

## Task 7: completion

- [x] design/planを最終実装へ同期し、Statusとverification recordを更新する。
- [x] task-owned diffと既存`worker-public/`差分を分離して確認する。
- [x] task-owned filesだけをstageし、検証済みcommitを作成する。
- [x] ユーザーの明示承認に基づき、品質ゲート通過後にdeployして本番疎通を確認する。

## Deployment record

- URL: `https://card.reversi-0.workers.dev`
- Version ID: `2f76061d-b2a1-4be5-9ea5-a1197a8d0333`
- production API: create/join/rejoin/SSE/publish/leave/room cleanup 成功
- production Chrome/Edge: UI着手で stateVersion 1→2→3、次の黒手番、両クライアント playback/selection idle、console/page error 0件
- production endgame: version 64、60手＋3パス、最終 `visualSeq=63`

## Self-review

- canonical source、client intake、pending settlement、session lifecycle、UI、tests、browser生成の順に並べた。
- timeoutとsession replacementの失敗条件をdone conditionへ含め、success-shaped fallbackを禁止した。
- Worker/local authority変更は不要なため、client修正に対するnetwork parityと二client smokeを完了条件にした。
