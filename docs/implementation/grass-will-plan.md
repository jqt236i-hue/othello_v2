# 草の意志 実装計画

設計: `docs/implementation/grass-will-design.md`

## Step 1: プレイヤー向け仕様を正本化する

- 成果: 草の意志、草石、播種順、5回目発芽、10回目通常石化が一意に読める。
- 対象: `01-rulebook.md`、`正本/カード仕様正本.md`、必要なカード仕様一覧
- 依存: なし
- 検証: 対応節・用語・数値・turn timingの相互参照、`git diff --check`
- Done: 種まきの意志の現行canonical挙動との不一致も解消され、実装固有語なしで境界例を判断できる。

## Step 2: カードidentity・表示・asset契約を追加する

- 成果: `grass_will_01` / `GRASS_WILL`、コスト20、繁栄分類、短文・詳細・タグ、カード背景、草石画像が解決する。
- 対象: `cards/catalog.json`、`src/types/card.ts`、`cards/card-interaction-effects.ts`、`cards/card-last-used-panel-copy.ts`、`shared/special-stone-registry.ts`、`game/visual-effects-map.ts`
- 依存: Step 1
- 検証: catalog/art/detail/registry/visual-map focused Jest、`npm run generate:catalog`、`npm run generate:card-art-map`
- Done: catalog、CardType、表示、asset path、特殊石registryが1対1で対応する。

## Step 3: canonical草石・播種lifecycleを実装する

- 成果: 配置時と所有者ターン開始時の決定的播種、10回目通常石化、共有SEED発芽がheadlessで成立する。
- 対象: `game/logic/cards/grass-will.ts`、`game/logic/card-resolution/status-cells.ts`、`game/logic/cards.ts`、`game/logic/cards-internal/effect-timing.ts`、`game/logic/card-resolution/special-stone-marker-factory.ts`、`game/logic/cards-internal/capture-source.ts`、`game/logic/cards/living_will.ts`
- 依存: Step 2
- 検証: 新規grass focused Jest、既存seed/special-stone/duration/capture focused Jest
- Done: 候補0時の非PRNG消費、複数anchor順、種由来causeを含めcanonical結果が決定的である。

## Step 4: turn pipeline・network authorityへ統合する

- 成果: placement immediate、turn-start marker phase、game-over defer、local/Worker authorityが同じ草石処理を使う。
- 対象: `game/turn/*`、`game/network-turn-handoff.ts`、`workers/match-worker-runtime-preload.ts`、browser/runtime module registryの生成元
- 依存: Step 3
- 検証: turn-start order、immediate dispatch、handoff、Worker preload、match/network parity
- Done: 新actionやclient乱数なしで、black/white/spectator/reconnectへcanonical markerとpresentationが反映される。

## Step 5: CPU・AUTO・表示へ統合する

- 成果: CPUが草の意志を長期アンカー型として使用し、両board backendが共有visual mappingで草石を描画する。
- 対象: `game/ai/*`、`game/cpu-decision-plan-pressure.ts`、`game/ai/commentary-data.ts`、`cards/*`、`ui/debug-card-search.ts`
- 依存: Step 2〜4
- 検証: all-card profile/taxonomy、CPU core/planner、card copy、visual mapping、debug search focused Jest
- Done: 全カードgateを通り、UI専用canonical分岐や第2のboard writerがない。

## Step 6: 生成・配布面を同期して検証する

- 成果: catalog、card-art map、browser bundle、asset manifest、Worker mirror、Worker bundleがroot sourceと一致する。
- 対象: 既存generator/buildが所有する生成物のみ
- 依存: Step 2〜5
- 検証: `npm run typecheck`、`npm run check:window`、focused Jest、`npm run build:browser`、`npm run test:network:parity`、`npm run worker:prepare`、`npm run check:worker-mirror`、`npm run worker:bundle:smoke`
- Done: 全コマンドが成功し、初回失敗があれば原因と再実行結果が記録される。

## Step 7: 最終監査とコミット

- 成果: 仕様、コード、テスト、生成物、mirrorが一致し、タスク所有差分だけがcommitされる。
- 対象: 全タスク所有ファイル
- 依存: Step 6
- 検証: card/network inventory再実行、`git diff --check`、relevant diff、`git status --short`
- Done: unexplained hit、未検証差分、既存の火の意志作業の混入がなく、coherent commitが作成される。

## 完了チェックリスト

- [x] 草の意志の仕様が一次情報と正本にある。
- [x] catalog、CardType、説明、タグ、カード背景、草石画像が整合する。
- [x] 配置時と所有者ターン開始時のauthority抽選が決定的である。
- [x] 10回目も播種してから草石が通常石へ戻る。
- [x] 種は5回目に発芽し、既存の通常反転を行う。
- [x] 候補0、複数anchor、草石喪失、種の配置消滅が検証される。
- [x] 反転無効・通常破壊・延命・腐食・捕獲・喪失が共有規則どおりである。
- [x] CPU/AUTO/local/Worker/headless/reconnectが一致する。
- [x] Pixi/DOM互換で草石画像と共有status表示が解決する。
- [x] browser/Worker生成物とasset manifestが同期する。
- [x] focused/type/window/browser/network/mirror/bundle検証が通る。
- [ ] 最終inventory/diff/statusを監査し、タスク所有変更だけをcommitする。

## 実施結果

- `npm run generate:catalog`、`npm run generate:card-art-map`、`npm run generate:asset-manifest`: 成功
- `npm run typecheck`: 初回は`living_will.ts`のcontext型へ`grassTurns`を追加し忘れて失敗。型契約を修正した再実行は成功
- focused Jest: 初回はgenerated catalogのfield名とSPAWN causeのassert位置が誤っていた2件だけ失敗。assertをcanonical shapeへ直した再実行と追加境界テストは成功
- card/turn/CPU/UI横断Jest: 成功
- `npm run check:window`: 成功
- `npm run build:browser`: 成功
- `npm run test:network:parity`: 35 suites / 562 tests成功
- `npm run worker:prepare`、`npm run check:worker-mirror`、`npm run worker:bundle:smoke`: 成功。mirror 937 files一致、bundleのAUTO/DOUBLE_PLACE/create/join/state/leave smoke成功
- card/network inventory: catalog issue 0、network missing anchor 0。盤面shape契約は変更せず、既存shape-aware seed target helperを再利用
- commit: 実装開始前から存在した火の意志変更とbrowser/Worker生成物が同一bundleへ混在するため、タスク外差分を含めずに生成物まで分離commitできる状態になるまで保留

## Self-review

実装順を、正本→identity→canonical lifecycle→turn/network→CPU/UI→生成物に統一した。初稿で不足していた候補0時のPRNG非消費、複数anchorの再計算順、10回目の播種先行、既存種仕様の整合、理論の化身経由の配置時処理、Worker preloadを各stepとDone条件へ追加した。
