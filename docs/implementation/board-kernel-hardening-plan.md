# 拡張マスを含む単一盤面カーネルへの統合 実装計画

- Status: in progress
- Date: 2026-07-26
- Design: `docs/implementation/board-kernel-hardening-design.md`
- Deployment: 対象外。Phase 1〜8完了前の状態は非deployable

## Phase 0 — 正本・baseline・変更境界を固定

- [x] clean working treeを確認する。
- [x] `01-rulebook.md`、`正本/カード仕様正本.md`、`docs/architecture-contracts.md` を照合する。
- [x] game、CPU、selfplay、Worker、local server、UI、network、生成mirrorを横断監査する。
- [x] 実装設計を自己レビューする。
- [x] 独立レビューを1名だけ実施し、P0/P1指摘を設計へ反映する。
- [x] 現在のfocused board/expansion/network testをbaseline実行する（12 suites / 126 tests pass）。
- [x] `docs/architecture-contracts.md` 6.1.1を実装前の単一kernel契約へ更新する。

Done when: player-visible仕様を変更せず、単一wire state + 単一interpreter、非deployable移行、検証範囲が固定されている。

## Phase 1 — pure盤面カーネルと互換facade

Outcome: 完全sourceから一つのimmutable `BoardView` を構築し、拡張・穴を含む読み取り、反転、合法手、集計、検証、canonical化を一か所で行える。

Components:

- `shared/board/state-kernel.ts`（新規）
- `shared/board/shape-metadata.ts`
- `shared/board/cell-access.ts`
- `shared/board/topology.ts`
- `shared/board/legal-moves.ts`
- `shared/board/othello-primitives.ts`
- `shared/board/expansion-descriptors.ts`
- `shared/shared-board-utils.ts`
- `entry-browser.js` と生成source

Tasks:

- [x] shape-aware APIは完全な `{ gameState, cardState }` sourceを必須にし、strict/legacy inspector、canonical descriptor、digest、`BoardView` を実装する。
- [x] protected/permanent-protected/blocked constraint付きの反転・合法手を実装する。
- [x] state-aware get/set/count/add helperを実装する。
- [x] identityを`(row,col)`、sideを非authorityとし、`cells` propertyが存在する空配列を正本として扱う。
- [x] 円形envelope内voidではdescriptor ownerを優先する。
- [x] 新kernelのcacheを完全source signature付きmodule-private WeakMapで実装し、board/config/expansion/hole各変更の無効化をテストする。
- [x] 移行中だけ既存`attachBoardShape` facadeを非authority互換adapterとして維持し、hidden array propertyはWeakMapへ退避する。
- [x] `SharedBoardUtils` へstate-aware APIを追加するが、全consumer cutover完了まではboard-only APIをdense限定へ切り替えない。
- [x] dense primitiveの長方形境界を修正する。
- [x] classic loaderでpure依存が `SharedBoardUtils` より先に解決する。

Verification:

- focused shared board Jest
- property fixture（多段/負座標/円形/穴/順序/clone/JSON）
- classic `SharedBoardUtils` bootstrap test
- `npm run typecheck`

Done when: 新kernelの完全source contractと互換adapterが共存し、隠しpropertyなしでserialize前後の結果が一致する。互換adapterを含むため、この段階は非deployableである。

## Phase 2 — headless game・カード・穴transaction

Outcome: game coreとカード効果が局所geometry/fallbackを使わず、同じstate mutation契約で通常・拡張・穴を更新する。

Components:

- `game/logic/core.ts`
- `game/logic/board_ops.ts`
- `game/logic/cards/expansion.ts`
- `game/logic/cards/selectors-board-shape.ts`
- `game/logic/cards-internal/expansion-fallback.ts`
- `game/logic/card-resolution/board-expansion-apply.ts`
- `game/move-generator.ts`
- 盤面縮小・因果抹消・因果再生の呼び出し元

Tasks:

- [x] coreのget/set/flips/legal/countをstate-aware kernelへ移行する。
- [x] 現行flip contextをpure constraintへ変換し、保護/永久保護/封鎖を維持する。
- [x] board_opsのgeometry/owner処理をkernelへ委譲する。
- [x] expansion/selector/move-generatorの固定外周fallbackを削除する。
- [x] compatibility fallbackをstrict delegationだけのwrapperにする。
- [x] expansion追加をatomic helperへ移行し、canonical順とlegacy projectionを同期する。
- [x] 穴化・復元を事前検証付きtransactionへ移行する。

Verification:

- board expansion will/god、move generator、board ops、shrink/causal focused Jest
- protected/permanent-protected/blocked flips regression
- expansion hole remove/restore regression
- `npm run typecheck`

Done when: headless gameplayの全topology-sensitive操作がkernelで決まり、依存欠落を8x8成功へ変換しない。

## Phase 3 — CPU・selfplay・専用Worker

Outcome: player、CPU、selfplay、quiescence Workerが同じ座標集合・合法手・石数を使う。

Components:

- `game/ai/cpu-policy-board-primitives.ts`
- `game/ai/cpu-card-quiescence.ts`
- `game/ai/cpu-policy-lookahead-worker-runtime.ts`
- `game/cpu-decision.ts`
- `src/engine/selfplay-board-primitives.ts`
- `src/engine/selfplay-search-primitives.ts`
- `src/engine/selfplay-simple-simulation-choosers.ts`
- 関連DTO/types

Tasks:

- [x] consumer側のdense `OthelloCore` 優先を削除する。
- [x] CPU clone/searchへ完全sourceまたは明示serialized shapeを渡す。
- [x] quiescence DTOからhidden metadata復元を削除する。
- [x] Worker runtimeがpure kernelを直接組み立て、rootと同じcontractを使う。
- [x] selfplayのowner読取、角/辺、簡易評価から固定8x8を除去する。
- [x] root/CPU/selfplay/Worker parity fixtureを追加する。

Verification:

- CPU board primitive / quiescence focused Jest
- selfplay board/search/simple-simulation focused Jest
- structuredClone/JSON Worker request roundtrip
- Worker preload/bootstrap test
- training jobは起動せず軽量preflightのみ

Done when: 多段拡張・円形・穴fixtureで全headless runtimeの合法手、反転、countが一致する。

## Phase 4 — authority・snapshot・hash・rated result

Outcome: Worker/local authority、projection、保存、reconnect、client intakeがversioned board contractを共有し、拡張石を含む勝敗を確定する。

Components:

- `utils/match-authority-types.ts`
- `utils/match-authority/projection.ts`
- `utils/match-authority.ts`
- `workers/match-worker-types.ts`
- `workers/match-worker.ts`
- `scripts/local-match-server.ts`
- `ui/network/snapshot-canonical.ts`
- 必要なsnapshot storage/reconnect/journal helper

Tasks:

- [ ] `_meta.boardContractVersion = 2` を完全snapshotへ付与する。
- [ ] strict v2 inspectorとunversioned legacy readerをauthority/client両方へ適用する。
- [ ] storage復元、public/seat/spectator projection、journal、reconnectでversionを保持する。
- [ ] expansion descriptorをhash前だけcanonical順へ整列する。
- [ ]既存の意味順序付き配列は変更しない。
- [ ] Worker/local rated resultをshape-aware countへ統一する。
- [ ] `gameState: unknown` の公開型を最小のversioned board contractへ狭める。

Verification:

- snapshot canonical、authority projection、Worker/local rated focused Jest
- `cells: [] + active: true` legacy regression
- descriptor reorder hash invariance
- expansion ownerで勝者が逆転するrated fixture
- `npm run test:match:parity`
- `npm run test:network:parity`

Done when: 同じlogical boardは同じhash/resultとなり、不正v2盤面はclient/authorityの両入口で拒否される。

## Phase 5 — UI model・入力・geometry・compatibility

Outcome: 表示内容とtopologyを一つのviewから作り、古いframeや不正方向の入力、void geometryを受理しない。

Components:

- `ui/board-visual/model-builder.ts`
- `ui/board-visual/model.ts`
- `ui/board-visual/types.ts`
- `ui/board-visual/state-adapter.ts`
- `ui/board-visual/controller.ts`
- `ui/board-input-controller.ts`
- `ui/board-dom-compat/backend.ts`
- `ui/board-dom-compat/renderer.ts`

Tasks:

- [ ] model builderを一つのBoardView projectionへ変更する。
- [ ] existing cellのowner不足を空で補完せずinvariant errorにする。
- [ ] `boardDigest` と単調 `modelCommitId` をmodel/settlementへ追加する。
- [ ] inputをsettled identityとcurrent direction hintで検証する。
- [ ] controllerのpublic geometryをexisting cell限定にする。
- [ ] state adapterとDOM rendererの1周fallbackを削除する。
- [ ] DOM compatibilityは完成modelを唯一の入力とし、逆変換を残す場合もkernelでroundtrip検証して局所geometryを持たせない。
- [ ] Pixi/DOMのSingle Visual Writer、event順、settlementを維持する。
- [ ] 全consumer parity後の単一cutoverでboard-only shape登録/互換adapterを削除し、board-only APIをdense専用へ固定する。

Verification:

- model/controller/input/DOM compatibility/Pixi focused Jest
- A→B→A stale click、pending hint変更、不正direction、void rect regression
- multi-ring/circle/hole model parity
- smallest board input E2E

Done when: UIがstateの盤面意味を再計算せず、両backendが同じ完成modelだけを表示する。

## Phase 6 — 静的boundary guard

Outcome: 今後の実装でtopology迂回を追加すると、review漏れでも`checkall`が失敗する。

Components:

- `scripts/check-board-kernel-boundary.ts`（新規）
- `scripts/run-all-checks.ts`
- `package.json`
- `test/scripts.check-board-kernel-boundary.test.ts`（新規）

Tasks:

- [ ] TypeScript ASTでproduction sourceを検査する。
- [ ] hidden metadata、consumer dense-first legal move、authority dense count、UI descriptor再構築、固定外周fallbackを禁止する。
- [ ] dense初期化/encoding/tensor化だけをpurpose付きallowlistへ置く。
- [ ] allowlist件数上限とnegative fixture testを追加する。
- [ ] `checkall`へ組み込む。

Verification:

- boundary script自身のfocused Jest
- `npm run check:board-kernel-boundary`
- `npm run checkall`

Done when: 新しいraw topology interpreterを追加できず、allowlist増加は明示的なcontract変更を要する。

## Phase 7 — 生成物同期・browser/Worker実機検証

Outcome: root source、classic/Vite browser、Worker mirrorが同じkernelとcontractを配信する。

Tasks:

- [ ] focused test後に `npm run build:browser` を実行する。
- [ ] `npm run match:ui-control-smoke:classic` を実行する。
- [ ] `npm run build:vite` を実行する。
- [ ] `npm run match:cross-platform-smoke:vite` を実行する。
- [ ] `npm run match:pixijs-board-playback-check` を実行する。
- [ ] `npm run match:pixi-runtime-fallback-check` を実行する。
- [ ] `npm run worker:prepare` でmirrorを生成する。
- [ ] `npm run check:worker-mirror` と `npm run worker:bundle:smoke` を実行する。

Done when: classic/Vite/Pixi/DOM fallback/Workerのboot、表示、入力、playbackが成功し、root/mirror差分が正規生成物だけである。

## Phase 8 — 全体検証・文書・コミット

Tasks:

- [ ] `docs/architecture-contracts.md` 6.1.1と最終実装の整合を再確認する。
- [ ] `npm run typecheck` を実行する。
- [ ] `npm run check:window`、`npm run checkall` を実行する。
- [ ] `npm run test:network:parity` を再実行する。
- [ ] `npm run test:jest` を実行する。
- [ ] `git diff --check`、task-owned diff、生成/mirror差分を監査する。
- [ ] 計画・設計のStatusと検証結果を更新する。
- [ ] 検証済みのcoherent unitごとにtask-owned fileだけをcommitする。

Done when: 設計の完了条件がすべて満たされ、既知の未移行topology pathや未解決テスト失敗がなく、作業ツリーの状態を説明できる。

## Self-review

- wire shapeを変えずinterpreterを先に一本化し、runtime feature flagや二重書きを作らない。
- Core移行前にconstraint対応kernelを用意し、保護・永久保護・封鎖ルールを落とさない。
- 穴を表示上の例外にせず、拡張owner・marker・stone idを含むtransactionとして扱う。
- digestをcache/parity、commit identityを入力raceへ分離し、ABAを防ぐ。
- authority/client、Worker/local、root/CPU/selfplay、Pixi/DOMをそれぞれparity pairとして検証する。
- 生成物はroot sourceのfocused/full検証後に正規scriptだけで更新する。
- 長時間のtrainingは実行せず、今回のcorrectness変更に必要な軽量selfplay testだけを使う。
