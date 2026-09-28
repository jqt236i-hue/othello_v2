# ゾンビの意志 ターン開始移動・感染間隔変更 実装計画

設計: `docs/implementation/zombie-will-turn-start-movement-design.md`

## 実装ステップ

1. 正本・表示文言を更新する。
   - `01-rulebook.md`
   - `正本/カード仕様正本.md`
   - `正本/ターン進行正本.md`
   - `正本/演出正本.md`
   - `cards/catalog.json`
   - `cards/card-interaction-effects.ts`
2. canonical headless logicを変更する。
   - `game/logic/cards/zombie_will.ts`: 感染間隔を4へ変更し、移動結果を受けた感染座標を処理できるようにする
   - `game/logic/cards/hyperactive.ts`: 躍動と同じ隣接空きマス候補・BoardOps移動を使う小さな移動helperを追加する
   - `game/logic/cards.ts`: ゾンビのターン開始入口へ移動helperを注入し、移動後に感染を実行する
   - `game/logic/board_ops.ts` と移動判定adapter: `ZOMBIE/zombie_move` を躍動相当の移動表示として分類する
3. ターン開始・表示経路を更新する。
   - `game/turn/turn-start/special-stone-phase.ts`: `zombie_moved_start` を移動成功時に出し、感染sourceを移動後へ合わせる
   - `game/turn/pipeline-ui/log-mappers.ts`
   - `game/turn/pipeline-ui/core-sound-cues.ts`
   - `game/special-effects/hyperactive.ts`、`game/log-messages.ts`
   - `ui/animation-move-events.ts`、`ui/animation-engine.ts`
4. 生成物を既存scriptで同期する。
   - `npm run generate:catalog`
   - `npm run build:ts`
   - `npm run build:browser`
   - `npm run worker:prepare`
5. focused testsを更新・追加する。
   - `test/game.zombie-will.test.ts`
   - `test/cards.zombie-will-surfaces.test.ts`
   - `test/game.turn-start-marker-order.test.ts`
   - 必要に応じて sound cue / movement classification の既存テストへ回帰ケースを追加する
6. 検証する。
   - focused Jest
   - `npm run typecheck`
   - `npm run check:window`
   - `npm run check:worker-mirror`
   - `npm run test:network:parity`
   - 必要に応じて `npm run checkall` または最小の関連check
7. 最終コードレビューを実施し、指摘があれば修正後に該当検証を再実行してコミットする。

## 検証マトリクス

| 観点 | 期待結果 | 主な検証 |
| --- | --- | --- |
| 感染間隔 | 所有者ターン開始4回目で感染、初期値・リセット値も4 | `test/game.zombie-will.test.ts` |
| 移動 | 所有者ターン開始ごとに隣接空きへ最大1マス、候補なしは非移動 | `test/game.zombie-will.test.ts` |
| 順序 | 移動後座標を感染sourceにし、MOVEがCHANGEより先 | zombie unit / turn-start order tests |
| 表示 | 躍動相当の滑らかな移動、感染時だけ既存bite演出 | presentation event inspection / sound cue test |
| 正本 | catalog、quick/detail、rulebook、card/turn/演出正本が一致 | surface test / `rg` |
| runtime | TypeScript、browser registry、Worker mirrorが一致 | typecheck/build/browser/worker checks |
| parity | Worker/local/rootのcanonical結果が一致 | `npm run test:network:parity` |

## リスクと緩和

- リスク: 移動によって感染対象が変わる。緩和: 移動後座標を使う順序テストを追加する。
- リスク: 既存の躍動用UI分類から漏れる。緩和: `moveIntent` と `ZOMBIE` causeを両方分類し、標準MOVEを検証する。
- リスク: 生成されたcatalog/browser/Worker mirrorの不一致。緩和: hand editせず既存generator/build/prepareを順に実行し、mirror checkを通す。
- リスク: 既存direct core testの戻り値形状を壊す。緩和: 移動が発生した場合だけ `moved/source` を追加し、移動なしの既存結果形状を保つ。

## 完了条件

- [x] 正本と表示文言が新仕様になっている
- [x] canonical logicとturn-start eventが実装されている
- [x] testsとfocused checksが通っている
- [x] generated/browser/Worker mirrorが同期している
- [x] 最終コードレビューと必要な修正が完了している

## Self-review

- [x] 実装順を「正本 → canonical logic → UI bridge → 生成物 → tests → review」とした
- [x] 既存躍動の候補・移動 semanticsを使う対象を明記した
- [x] no-destination時のPRNG消費なしを検証項目に含めた
- [x] commit前にroot source、generated output、mirrorの差分を分けて確認する
