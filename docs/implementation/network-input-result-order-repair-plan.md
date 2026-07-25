# ネット対戦の入力再開・終局表示順 修正計画

- Status: completed
- Date: 2026-07-25
- Design: `docs/implementation/network-input-result-order-repair-design.md`

## Task 1: 回帰条件を固定する

- [x] `test/ui.network-client.guard-tempt-deferred-publish.test.ts` の既存失敗を再確認する。
- [x] `test/ui.network-work-will-followup-placement.test.ts` に visual settlement 前後の再投入順を固定する。
- [x] 破壊の意志について拡張座標を通す regression case を追加する。
- [x] `test/ui.network-client.result-sync.test.ts` に「最終演出Promise完了後に結果を一度だけ表示」を追加する。
- [x] exact visual rebase の既存 effect-log test を回復させる。

## Task 2: pending selection bridge を修正する

- [x] `ui/network/selection-signal-bridge.ts` に `waitForPlaybackIdle` port を追加する。
- [x] network-client の bridge install 後も selection-flow が既存 wait を呼べることを focused test で確認する。

## Task 3: server-authored card use の visual settlement を修正する

- [x] `cards/card-interaction.ts` から既存 `waitForAuthoritativeVisualPlaybackDrain` を呼ぶ wrapper を追加する。
- [x] publish 成功後の busy解除、buffer consume、UI同期、click replay を settlement 後へ移す。
- [x] publish rejection/reject promise、pending維持、通常 follow-up placement の既存 test を維持する。

## Task 4: terminal result と exact rebase を修正する

- [x] `ui/network/snapshot.ts` で terminal playback 中の result sync を deferred にする。
- [x] non-terminal/reset と playbackなしの即時経路は維持する。
- [x] `ui/network/session-lifecycle.ts` で exact visual rebase 後の journal catch-up を抑止する。

## Task 5: focused verification

- [x] deferred pending selection suite
- [x] server-authored follow-up placement suite
- [x] result sync suite
- [x] snapshot effect logs suite
- [x] expansion destroy/board expansion suite
- [x] create/list/join と room lifecycle suite

## Task 6: cross-runtime / browser verification

- [x] `npm run typecheck`
- [x] `npm run check:window`
- [x] `npm run test:network:parity`
- [x] `npm run build:browser`
- [x] 最小の Pixi/network checks
- [x] Chrome と Edge で部屋作成・入室・黒→白→黒の着手・演出後入力・終局結果順を確認する。

## Task 7: 完了処理

- [x] task-owned diff、generated browser artifacts、既存 `worker-public/` 差分を分類する。
- [x] design/plan の Status と実施結果を更新する。
- [x] task-owned files だけを stage し、検証済みの coherent commit を作成する。
- [x] deploy はこの依頼では行わず、検証結果と残存リスクを報告する。

## Verification record

- focused 8 suites: 105 tests passed
- lobby/create/list/join 5 suites: 95 tests passed
- `npm run test:network:parity`: 35 suites / 550 tests passed
- `npx jest test/e2e/network-battle-complete-smoke.test.ts --runInBand --detectOpenHandles`: passed
- `npm run match:endgame-check`: 5 games completed、各60 moves
- focused Pixi playback (`destroy,topology-expansion`): passed
- Pixi runtime fallback: passed
- cross-platform DOM/Pixi smoke: 12 probes passed
- Chrome/Edge actual channels: create、room-list join、black→white→black publish passed without reload
