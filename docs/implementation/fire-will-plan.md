# 火の意志 実装計画

設計: `docs/implementation/fire-will-design.md`

## Step 1: プレイヤー向け仕様を正本化する

- 成果: 火の意志、灼熱マス、居座り、特殊マス排他、毒との共存表示が明文化される。
- 対象: `01-rulebook.md`、`正本/カード仕様正本.md`、`正本/共通ルール正本.md`、`正本/ターン進行正本.md`、`正本/演出正本.md`
- 依存: なし
- 検証: 対応節・用語・ターン順・表示位置の相互参照、`git diff --check`
- Done: 実装判断がコード固有語なしで一意になり、既存毒仕様と矛盾しない。

## Step 2: カードidentity・表示・asset契約を追加する

- 成果: `fire_will_01` / `FIRE_WILL`、コスト21、殲滅分類、短文・詳細・タグ、カード背景、火石画像が解決する。
- 対象: `cards/catalog.json`、`src/types/card.ts`、`cards/card-interaction-effects.ts`、`cards/card-last-used-panel-copy.ts`、`cards/card-renderer.ts`、`scripts/generate-card-art-map.ts`、`cards/card-art-map.generated.ts`、`shared/special-stone-registry.ts`、`game/visual-effects-map.ts`
- 依存: Step 1
- 検証: catalog/art/detail/registry focused Jest、`npm run generate:catalog`、`npm run generate:card-art-map`
- Done: catalogとCardTypeが1対1で、すべての表示asset pathが存在し、既存カードart解決が変わらない。

## Step 3: canonical 火石・灼熱 lifecycle を実装する

- 成果: shape-aware random cell、排他上書き、10/3手番、移動解除・反転継続、通常破壊、6ターン通常石化がheadlessで成立する。
- 対象: `game/logic/cards/fire-will.ts`、`game/logic/card-resolution/status-cells.ts`、`game/logic/cards/selectors.ts`、`game/cards/target-resolver.ts`、`game/logic/cards.ts`、`game/logic/cards-internal/effect-timing.ts`、`game/logic/card-resolution/special-stone-marker-factory.ts`、`game/turn/*`
- 依存: Step 2
- 検証: 新規fire focused Jest、既存poison/lightning/marker/board parity focused Jest、`npm run check:board-kernel-boundary`
- Done: canonical APIとturn pipelineが全要件を決定的に再現し、既存毒回帰がない。

## Step 4: CPU・AUTO・Worker authorityへ統合する

- 成果: 人間、CPU、authority AUTO、local server、Workerが同じカード使用・配置・PRNG結果を使う。
- 対象: `game/ai/*`、`game/cpu-decision-plan-pressure.ts`、`game/ai/commentary-data.ts`、`workers/match-worker-runtime-preload.ts`、必要なpreload/registry tests
- 依存: Step 3
- 検証: all-card taxonomy/profile、CPU core/planner、Worker preload、authority/card pattern、network parity
- Done: CPU専用結果やclient乱数がなく、Worker/local/headlessのmarker・PRNGが一致する。

## Step 5: Single Visual Writerの両backendへ表示を追加する

- 成果: Pixi通常経路とDOM互換経路で赤い灼熱マス、左上10カウント、石中央3カウント、毒とのdual offsetが見える。
- 対象: `ui/board-visual/model*.ts`、`ui/pixi/cell-view.ts`、`ui/pixi/stone-view.ts`、`ui/pixi/effects/status.ts`、`ui/board-dom-compat/*`、`styles-board-dom-compat.css`、`ui/animation-status-events.ts`、`ui/board-visual/effect-branch-inventory.ts`
- 依存: Step 3
- 検証: render projection、Pixi scene、DOM marker/patch、status playback、effect inventory focused Jest
- Done: 1つのactive backendだけが描画し、両カウントが重ならず、poison-only表示を維持する。

## Step 6: 生成・配布面を同期して全体検証する

- 成果: browser startup registry、dist、asset manifest、Worker mirror、Worker bundleがroot sourceと一致する。
- 対象: 既存generator/buildが所有する生成物のみ
- 依存: Step 2〜5
- 検証: `npm run typecheck`、`npm run build:ts`、`npm run check:window`、focused suites、`npm run build:browser`、`npm run test:network:parity`、`npm run worker:prepare`、`npm run check:worker-mirror`、`npm run worker:bundle:smoke`、必要なPixi browser check
- Done: 全コマンドが成功し、初回失敗があれば原因と再実行結果を記録する。

## Step 7: 最終監査とコミット

- 成果: 仕様、コード、テスト、生成物、mirrorが一致し、タスク所有差分だけがcommitされる。
- 対象: 全タスク所有ファイル
- 依存: Step 6
- 検証: card/network inventory再実行、`git diff --check`、relevant diff、`git status --short`
- Done: unexplained hit・unreadable canonical candidate・未検証差分がなく、coherent commitが作成される。

## 完了チェックリスト

- [ ] 火の意志の全プレイヤー向け仕様が一次情報と正本にある。
- [ ] catalog、CardType、詳細、タグ、カード背景、火石画像が整合する。
- [ ] 配置時・所有者ターン開始時のauthority抽選が決定的である。
- [ ] 火石6、灼熱マス10、居座り3の各タイミングが成立する。
- [ ] 特殊マス排他と毒状態＋灼熱状態の共存が成立する。
- [ ] 通常破壊・反転保護・移動・反転・不可侵の境界がテストされる。
- [ ] CPU/AUTO/local/Worker/headlessが一致する。
- [ ] Pixi/DOM互換表示とdual counter位置が確認される。
- [ ] browser/Worker生成物とasset manifestが同期する。
- [ ] focused/type/window/browser/network/mirror/bundle検証が通る。
- [ ] 最終inventory/diff/statusを監査し、タスク所有変更だけをcommitする。

## 独立レビュー反映

- Step 2へoptional `card_face_art_path` の後方互換、path妥当性、catalog version据え置き確認を追加した。
- Step 3へsame-cell refresh、各status直前の再同期、破壊・回避後とcell expiry直後の同期、board marker固定性を追加した。
- Step 4へclassic loader、startup registry、Worker preload、capture/living-will/network handoffを追加した。
- Step 5へ毒＋灼熱のdual counterだけでなく、単独時中央位置とtop-left cell timerの固定slot検証を追加した。
- 完了条件の「全デッキ」を有効catalog・全カードpool・custom deckへ限定し、固定deck profileへ自動混入させない。

## Self-review

正本変更を最初に置き、catalog generatorをruntimeより前、root sourceを生成物より前に処理する順へ統一した。初稿で不足していた既存毒回帰、拡張盤面、CPU all-card gate、Worker preload、dual counterの両backend検証を各stepへ追加した。各Done条件は実ファイルまたは実行結果で判定できる。
