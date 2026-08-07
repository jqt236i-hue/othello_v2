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

## Step 5: マーカー意味契約と単一のpresentation producerを実装する

- 成果: stone body、stone status、cell marker、topologyの意味、owner policy、duration clock、排他groupが共有registryで一意になり、status-cell成立1回につき意味の完全なeventを1本だけ生成する。
- 対象: `game/logic/cards/markers.ts`、`game/cards/state-manager.ts`、`game/cards/effects/markers.ts`、`game/logic/card-resolution/status-cells.ts`、`shared/special-stone-registry.ts`、`src/types/card.ts`、`shared/playback-event-contract.ts`、`ui/board-visual/playback-types.ts`、`game/turn/pipeline_ui_adapter.ts`、`game/turn/pipeline-ui/*`
- 依存: Step 3
- 検証: canonical marker owner/timer、owner付きlegacy hazard、typed playback target、network replay validator、event重複なしのfocused Jest
- Done: 新規hazard cellはownerなし、legacy ownerはsource attributionだけに限定され、status-cell helperだけが`subjectKind: cell_marker`と`stoneMutation: preserve`を持つ適用eventを1回発行する。

## Step 5A: Single Visual Writerの両backendと危険な石推測を整理する

- 成果: Pixi通常経路とDOM互換経路で赤い灼熱マス、左上10カウント、石中央3カウント、毒とのdual offsetが見え、火石から対象へ炎ビームが飛んだ後にvisual frameが成立する。ownerや同居markerだけから物理石を生成しない。
- 対象: `shared/stone-status-snapshot.ts`、`shared/playback-event-helpers.ts`、`shared/presentation-effect-profiles.ts`、`game/logic/cards/hyperactive.ts`、`game/logic/board_ops.ts`、`ui/board-visual/model*.ts`、`ui/board-visual/source-trajectory.ts`、`ui/pixi/board-backend.ts`、`ui/pixi/cell-view.ts`、`ui/pixi/stone-view.ts`、`ui/pixi/effects/status.ts`、`ui/pixi/effects/source-trajectory.ts`、`ui/board-dom-compat/*`、`styles-board-dom-compat.css`、`ui/animation-status-events.ts`、`ui/board-visual/effect-branch-inventory.ts`
- 依存: Step 5
- 検証: registry traits、stone status snapshot、move playback helper、render compatibility projection、source trajectory contract、Pixi scene/playback、DOM marker/trajectory/patch、status playback、NOANIM、effect inventory focused Jest、`npm run typecheck`
- Done: canonical state/snapshotの受理を遅らせず、1つのactive backendだけが描画し、空マス・通常石・火石・別特殊石の石投影を変更せずに炎ビーム着弾後のcommitted visual frameで赤マスへ切り替わる。board markerが石本体specialまたは移動対象specialとして選ばれず、両カウントが重ならない。

## Step 6: 効果音assetと成立キューを追加する

- 成果: 指定MP3が用途名へリネームされてroot assetへ移動し、成立した灼熱マス1個につき着弾phaseで1回鳴る。
- 対象: `assets/audio/sound-effect/火の意志で灼熱マスを生成するタイミング.mp3`、`sound-engine.ts`、`game/turn/pipeline-ui/selection-sound-cues.ts`、asset manifest
- 依存: Step 3、Step 5
- 検証: source fileの移動確認、hash/size確認、sound map、成立時/不成立時のsound cue focused Jest、`npm run generate:asset-manifest`
- Done: 配置時・所有者ターン開始時の成立で音が1回鳴り、不成立・カウント減少・致死では鳴らない。

## Step 7: 生成・配布面を同期して全体検証する

- 成果: browser startup registry、dist、asset manifest、Worker mirror、Worker bundleがroot sourceと一致する。
- 対象: 既存generator/buildが所有する生成物のみ
- 依存: Step 2〜6
- 検証: `npm run typecheck`、`npm run build:ts`、`npm run check:window`、focused suites、`npm run build:browser`、`npm run test:network:parity`、`npm run worker:prepare`、`npm run check:worker-mirror`、`npm run worker:bundle:smoke`、`npm run match:pixijs-board-playback-check`、`npm run match:pixi-runtime-fallback-check`、reduced-motion focused test、毒＋灼熱dual counterの実表示確認
- Done: 全コマンドが成功し、初回失敗があれば原因と再実行結果を記録する。

## Step 8: 最終監査とコミット

- 成果: 仕様、コード、テスト、生成物、mirrorが一致し、タスク所有差分だけがcommitされる。
- 対象: 全タスク所有ファイル
- 依存: Step 7
- 検証: card/network inventory再実行、`git diff --check`、relevant diff、`git status --short`
- Done: unexplained hit・unreadable canonical candidate・未検証差分がなく、coherent commitが作成される。

## 完了チェックリスト

- [ ] 火の意志の全プレイヤー向け仕様が一次情報と正本にある。
- [ ] catalog、CardType、詳細、タグ、カード背景、火石画像が整合する。
- [ ] 配置時・所有者ターン開始時のauthority抽選が決定的である。
- [ ] 火石6、灼熱マス10、居座り3の各タイミングが成立する。
- [ ] 特殊マス排他と毒状態＋灼熱状態の共存が成立する。
- [ ] 通常破壊・反転無効・移動・反転・不可侵の境界がテストされる。
- [ ] CPU/AUTO/local/Worker/headlessが一致する。
- [ ] Pixi/DOM互換表示とdual counter位置が確認される。
- [ ] 火石から対象への炎ビームが先行し、着弾後に灼熱マスが表示される。
- [ ] 毒・灼熱マスはownerなしで、source playerと`remainingTurns` timerが分離される。
- [ ] status targetの`subjectKind` / `stoneMutation`をnetwork validatorと両backendが同じ意味で扱う。
- [ ] status-cell成立1回につき適用eventが1本だけで、source trajectoryなしの汎用eventが先行しない。
- [ ] 空マス・通常石・火石・別特殊石・発射元同一の各ケースで、一時的な通常石や別specialが投影されない。
- [ ] board markerをstone statusや移動石specialとして選ぶ既知のfirst-marker経路が除去される。
- [ ] 指定音源が用途名へ移動され、成立1マスにつき1回だけ鳴る。
- [ ] browser/Worker生成物とasset manifestが同期する。
- [ ] focused/type/window/browser/network/mirror/bundle検証が通る。
- [ ] 最終inventory/diff/statusを監査し、タスク所有変更だけをcommitする。

## 独立レビュー反映

- Step 2へoptional `card_face_art_path` の後方互換、path妥当性、catalog version据え置き確認を追加した。
- Step 3へsame-cell refresh、各status直前の再同期、破壊・回避後とcell expiry直後の同期、board marker固定性を追加した。
- Step 4へclassic loader、startup registry、Worker preload、capture/living-will/network handoffを追加した。
- Step 5へ毒＋灼熱のdual counterだけでなく、単独時中央位置とtop-left cell timerの固定slot検証を追加した。
- Step 5へmarker意味分類、ownerなしhazard、typed subject、stone preserve、単一producerを置き、Step 5Aをその契約だけを消費する両backendと危険なfirst-marker/owner fallback除去へ並べ替えた。
- 完了条件の「全デッキ」を有効catalog・全カードpool・custom deckへ限定し、固定deck profileへ自動混入させない。

## Self-review

正本変更を最初に置き、catalog generatorをruntimeより前、root sourceを生成物より前に処理する順へ統一した。初稿で不足していた既存毒回帰、拡張盤面、CPU all-card gate、Worker preload、dual counterの両backend検証を各stepへ追加した。各Done条件は実ファイルまたは実行結果で判定できる。

追加監査後の再レビューでは、単なる空マスowner guardでは火石上の灼熱成立時に通常石投影が残るため、Done条件を「cell markerはstone writerを呼ばない」へ強化した。さらにmarker primitiveとstatus-cell helperが適用eventを二重発行していたため、保存primitiveの既定互換を保つ明示抑止optionと、status-cell helperによる単一の意味eventを追加した。独立レビューでStep 5/5Aの循環を解消し、semantic contract・producer・validatorを先、両backend consumerを後に並べ替えた。canonical state/snapshotは即時受理し、遅延対象はvisual projection/committed frameだけである。marker kindの一括migrationは既存snapshot互換と比較して過大なため保存形を維持し、実経路テストは手書き済みplayback fixtureだけでなくcanonical event→adapter→backendを通す。
