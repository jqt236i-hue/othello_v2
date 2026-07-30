# 森羅万象神 実装計画

## 1. 計画の前提

- 設計正本: `docs/implementation/shinra-bansho-god-design.md`
- プレイヤー向け仕様の一次情報: `01-rulebook.md`
- 実装方針: 盤面上は同色ownerの4セル、特殊石としては1個のgroup marker、表示上は2×2の大型石1体
- 非対象: 新規カード、`CardType`、`cards/catalog.json`、カードコスト、4属性カード自体のプレイヤー向け効果変更
- rootのTypeScript実装を先に変更し、隣接JavaScript、browser registry、Worker mirrorは既存build・生成スクリプトから同期する
- 2026-07-30差分: Step 13までの完全保護実装を、後述Step 14で不可侵へ置き換える

実装は以下を上から順に行う。各工程は、記載した完了条件とfocused検証を満たしてから次へ進む。

## 2. Step 1: プレイヤー仕様とarchitecture contractを確定する

### 目的

実装より先に、多マス特殊石、融合除去、出現場所、ターン開始順の意味を正本へ固定する。

### 変更対象

- `01-rulebook.md`
- `正本/共通ルール正本.md`
- `正本/ターン進行正本.md`
- `正本/カード仕様正本.md`
- `正本/演出正本.md`
- `docs/architecture-contracts.md`

### 実装内容

1. 森羅万象神を「カードを持たない永続特殊石」として追加する。
2. 盤上位置や隣接を問わず、同色の火石・水石・草石・落雷石を各1体消費する自動融合を定義する。
3. 2×2固定、盤面石数4、特殊石個体数1、全セル不可侵、単セル操作不可を定義する。
4. 出現先を「有効2×2のうち、素材消費後の空きセル数が最大の候補群からランダム」と定義する。
5. `fusion_consume` と `summon_clear` が通常破壊履歴・復活・回避を発動しない専用除去であることを定義する。
6. 候補0では素材を残して保留し、後続のcanonical settlement後に再判定する。
7. 所有者ターン開始時の火→水→草→雷と、各sub-phaseを直列settleする順序を定義する。
8. 盤面source trajectoryは2×2のvisual centerを使い、Single Visual Writer内で描画する。

### 検証

- `git diff --check`
- 設計書の完了条件と各正本の記述を項目単位で照合する
- 既存の不可侵、セル消滅、ターン開始marker順と矛盾しないことを確認する

### 完了条件

設計書だけを読まなくても、プレイヤー挙動と内部境界を正本から一意に復元できる。

## 3. Step 2: 多マス特殊石の共通データ契約を追加する

### 目的

各consumerが独自に2×2を推測せず、marker 1個と4セルの対応を同じ純粋helperから解決できるようにする。

### 変更対象

- 新規 `shared/multi-cell-stone.ts`
- `src/types/card.ts`
- `game/logic/cards/markers.ts`
- `game/logic/markers_adapter.ts`
- 必要に応じて `shared/state-hash.ts`
- 新規または既存のfocused test
  - `test/shared.multi-cell-stone.test.ts`
  - `test/game.marker-cell-index.test.ts`
  - `test/game.marker-identity-contract.test.ts`

### 実装内容

1. `square_2x2.v1` のrow-major footprint導出、セル包含判定、marker判定、invariant検証を純粋関数として実装する。
2. `SHINRA_BANSHO_GOD` markerはanchor座標に1個だけ保存し、cell indexでは4座標すべてから同じmarkerを引けるようにする。
3. marker個体一覧では重複させず、`createdSeq`と`markerId`の既存順序を維持する。
4. 次の不正状態をfail closedにする。
   - 4セルの一部が盤面外・穴・void
   - 4セルのownerがmarker ownerと不一致
   - footprintセルの重複
   - 既存の多マス個体との重複
5. state hashがmarker順とfootprint導出順に依存して不安定にならないことを確認し、明示的な正規化が必要な場合だけ`shared/state-hash.ts`を更新する。

### 検証

- `npx jest test/shared.multi-cell-stone.test.ts test/game.marker-cell-index.test.ts test/game.marker-identity-contract.test.ts --runInBand`
- `npm run typecheck`

### 完了条件

任意のfootprintセルから同じgroup markerを取得でき、個体列挙では1回、盤面セル列挙では4回として安定して扱える。

## 4. Step 3: 特殊石レジストリと対象・保護契約を多マス対応する

### 目的

不可侵と1個体性を全4セルへ投影し、既存の単セル操作で森羅万象神が分裂しないようにする。

### 変更対象

- `shared/special-stone-registry.ts`
- `game/logic/cards-internal/protection-context.ts`
- `game/logic/cards-internal/destroy-protection-context.ts`
- `game/logic/board_ops.ts`
- 単体選択、複製、移動、交換、誘惑、捕獲、喪失、延命のtarget resolver
- `test/shared.special-stone-registry.test.ts`
- 保護・対象選択の既存focused test

### 実装内容

1. `SHINRA_BANSHO_GOD` をカード逆変換なしの特殊石として登録する。
2. `inviolable`、永続、単セル操作不可をレジストリの機械可読ルールで表現し、`flipProtected`と`destroyProtected`は森羅万象神から外す。
3. anchor座標の完全一致ではなく、共通footprint indexを通して4セルの不可侵と石情報を解決する。
4. 反転、破壊、誘惑、捕獲、意志の喪失、移動、交換、複製、延命、状態付与、セル消滅の候補列挙を監査し、4ownerセルすべてを候補外にする。
5. `BoardOps.applyCellRemovalAt`は4セルのどこでも不可侵を返し、通常カードのセル消滅から`group_dissolve`へ到達させない。
6. 盤界の執行者は使用条件の特殊石個体数では森羅万象神を1体と数えるが、絶対執行対象の収集には`isTargetableSpecialStone`を使って除外する。
7. `凍結の意志`と`意志の凍結`の候補から森羅万象神を除外し、既存互換の凍結markerが残っても4pulseを停止しない。
8. 通常の`destroyAt`へ融合専用の無制限bypass flagを追加せず、後続Step 5の限定されたtyped operationだけが専用除去を呼べる境界を準備する。

### 検証

- `npm run check:window`
- 保護、単セル/全体凍結、セル消滅batch、複製、移動、誘惑、捕獲、延命のfocused Jest
- `rg -n "marker\\.row\\s*===|marker\\.col\\s*===" game shared ui --glob "*.ts"`で未対応のanchor直比較を監査する

### 完了条件

4セルのどこを指しても同じ不可侵個体へ解決し、許可されない単セル変更、状態付与、穴化、部分残存が起きない。

## 5. Step 4: 火・水・草・雷を再利用可能な1pulse APIへ分離する

### 目的

既存の4属性効果を複製せず、元の属性石と森羅万象神が同じcanonical効果を使えるようにする。

### 変更対象

- `game/logic/cards/fire-will.ts`
- `game/logic/cards/water-will.ts`
- `game/logic/cards/grass-will.ts`
- `game/logic/cards/lightning.ts`
- `game/logic/cards.ts`
- 4属性の既存focused test

### 実装内容

1. 各モジュールを次の責務へ分ける。
   - 1回分の対象候補収集
   - 候補が複数ある時のauthority PRNG選択
   - 1回分の盤面効果とpresentation metadata
   - 元属性marker固有の寿命減算・通常石化
2. 現行の配置時・ターン開始APIは「pulse→必要なら寿命減算」の合成として残し、外部挙動を変えない。
3. 森羅万象神用には寿命へ触れないpulse入口を公開する。
4. pulseのsource metadataを単セル座標またはcomposite group sourceのどちらでも表現できるようにする。
5. 既存4属性pulseは候補0だけPRNGを消費せず、候補1以上では現行どおり1回消費する契約を維持する。

### 検証

- 火・水・草・雷の既存Jestを変更前後で比較する
- 配置時発動では寿命を減らさず、所有者ターン開始では従来どおり減算することをfocused testで固定する
- pulse単体では寿命とmarker lifecycleを変更しないtestを追加する
- 各属性で候補0・1・複数のPRNG call countを回帰テストにする

### 完了条件

既存4属性石の結果とPRNG消費を変えず、寿命処理なしで4属性効果を1回ずつ呼べる。

## 6. Step 5: 融合・場所選択・原子的召喚を実装する

### 目的

4素材がそろったcanonical settlement後に、決定的かつ途中状態なしで森羅万象神を自動召喚する。

### 変更対象

- 新規 `game/special-effects/shinra-bansho-god.ts`
- `game/logic/board_ops.ts`
- `game/logic/cards.ts`
- 必要なruntime preload/export
- 新規 `test/game.shinra-bansho-god-fusion.test.ts`

### 実装内容

1. ownerごとに `FIRE`、`WATER`、`GRASS`、`LIGHTNING` を各1体選ぶ。種類内は`createdSeq`、canonical marker順、`markerId`で最古を選び、成立セットは最大`createdSeq`の昇順、素材marker順、黒→白で処理する。
2. 現在のBoardViewの有効セルから2×2候補を列挙し、穴・void・進入不能セル・不可侵・完全保護・既存神を含む候補を除く。候補anchorは必ずrow→colでcanonical sortする。
3. 選択素材4体を空きとして投影した空きセル数を数え、最大tier内だけからauthority PRNGで選ぶ。
4. 候補0では何も変更せず正常な「保留」を返す。
5. 選択後は1つのeffect blockとmutation checkpoint内で、次を順に行う。
   - `fusion_consume`で素材4体を除去
   - `summon_clear`で残存占有石をrow-major順に除去
   - 種を通常進入と同じ規則で消費
   - 同色ownerの4石と個別stone IDを生成
   - `SHINRA_BANSHO_GOD` group markerを1個生成
   - ordered presentation eventsを記録
6. `fusion_consume`と`summon_clear`は通常破壊履歴、破壊回避、増殖、復活、生きる意志、救済神を呼ばない限定operationとする。
7. 複数セットは更新後状態から再計算し、成立可能な限り1組ずつ処理する。
8. mutationまたはevent作成が失敗したら、素材、占有石、marker、stone ID、event queue、PRNG checkpointをすべて復元する。

### 検証

- 同色成立、混色、不足、owner不一致
- 最大空きtier、同点乱数、候補0・1の乱数非消費
- 入力cell順を並べ替えても候補順、選択先、PRNG stateが変わらない
- 素材が出現footprint内外にある場合
- 盤面が通常石で埋まっている場合
- 穴・void・拡張セル・封鎖・凍結・不可侵・完全保護・既存神
- 最古素材、複数セット、rollback
- 回避・復活・救済・破壊履歴を発火しないこと

### 完了条件

同じcanonical状態とPRNGから必ず同じ2×2が選ばれ、成功時は4素材消費と2×2召喚が全成立、失敗時は全不成立になる。

## 7. Step 6: ターンパイプラインへ融合settlement hookを接続する

### 目的

アクション途中で融合せず、4体目の既存即時効果を完了した後、次の入力や次の特殊石へ進む前に自動融合する。

### 変更対象

- `game/turn/turn_pipeline_phases.ts`
- `game/turn/card-usage/immediate-effects.ts`
- `game/turn/action-phase/placement-immediate-effects.ts`
- 必要なpending selection完了モジュール
- `game/turn/turn-start/marker-phase.ts`
- `game/turn/turn-start/special-stone-phase.ts`
- 新規 `test/game.shinra-bansho-god-settlement.test.ts`

### 実装内容

1. 次の完了境界に共通のfusion closureを明示的に呼ぶ。
   - 通常配置、通常反転、配置時即時効果の完了後
   - 即時カードと対象選択カードのcanonical効果完了後
   - 生成、複製、誘惑、復活などの盤面変更settlement後
   - ターン開始before-anchor処理と復活flushの完了後
   - ターン開始marker 1個の処理と、そのanchorの復活flushの完了後
   - 全turn-start anchor後の生成石反転・復活flushの完了後
   - 理論の化身の配置後生成、生成石即時効果、復活flushの完了後
   - pending selection完了、追加配置の各sub-placement完了、手番引継ぎ前の最終settlement
2. `BoardOps`の個別mutationへ自動融合を埋め込まず、半完成の中間状態では呼ばない。
3. すべての入口が同じidempotentなfusion closureを呼ぶ。ターン開始marker一覧は開始時点snapshotを維持し、同じ開始処理中に召喚された森羅万象神をその回の対象へ追加しない。
4. 候補0で保留中の素材は、以後の盤面変更settlementごとに再判定する。
5. action resultとnetwork resultには融合eventsを同じcanonical順で含め、次の入力を演出settlement前に解放しない。

### 検証

- 4体目の配置時属性効果が先、融合が後になる
- pending選択完了で条件を満たした場合も自動融合する
- before-anchor復活flush、各anchor復活flush、全anchor後生成flush、理論の化身生成後の各入口で発火漏れと二重発火がない
- ターン開始中の復活・生成で成立した場合、現在anchorの後かつ次anchorの前に融合する
- 同じターン開始中に召喚された神が発動しない
- passや盤面を変えないactionで不要なPRNGを消費しない

### 完了条件

すべてのcanonical盤面変更入口が同じ融合closureへ収束し、入力経路やruntimeによる発火漏れ・二重発火がない。

## 8. Step 7: 森羅万象神のターン開始4pulseを実装する

### 目的

1個体の処理枠内で、火→水→草→雷を直前結果反映・永続・直列settlementで実行する。

### 変更対象

- `game/special-effects/shinra-bansho-god.ts`
- `game/turn/turn-start/marker-phase.ts`
- `game/turn/turn-start/special-stone-phase.ts`
- `game/turn/turn_pipeline_phases.ts`
- 新規 `test/game.shinra-bansho-god-turn-start.test.ts`

### 実装内容

1. group marker 1個をターン開始anchor 1個として既存`createdSeq`順へ参加させる。
2. 対象ownerのターンだけ、寿命減算なしで4pulseを固定順に呼ぶ。
3. 各pulseは直前pulse後のBoardViewから候補を取り直す。
4. 各pulseを独立したpresentation sub-phaseとしてsettleし、不発でも次のpulseへ進む。
5. source metadataへgroup marker ID、4セルfootprint、論理anchorを入れる。
6. 最終pulse後にのみ次の特殊石anchorへ進む。
7. 開始時点のfootprint凍結snapshotで、1セルでも凍結中なら4pulse全体をスキップする。

### 検証

- 火→水→草→雷のevent順とPRNG順
- 火・水の上書き、草の空き候補、雷の敵候補が直前状態を参照する
- 各pulse候補0でも後続を継続する
- 永続でremaining owner turnを持たず、治癒による`+3`対象にならない
- 複数神と他特殊石が`createdSeq`順に処理される
- anchor以外の1セルだけが凍結中でも4pulseを発動せず、開始処理中の期限変化で部分発動しない

### 完了条件

森羅万象神1体につき所有者ターン開始時に4効果が各1回、厳密な順序で発動し、後続markerと混ざらない。

## 9. Step 8: ordered eventsとboard-source playback契約を追加する

### 目的

canonicalな4セル更新を、素材消費→場所確保→大型出現と4属性sub-phaseへ一意に変換する。

### 変更対象

- `game/turn/pipeline-ui/board-event-mapper.ts`
- `game/turn/pipeline-ui/board-event-playback.ts`
- `game/turn/pipeline_ui_adapter.ts`
- `shared/presentation-effect-profiles.ts`
- `ui/board-visual/source-trajectory.ts`
- `test/ui.board-source-trajectory-contract.test.ts`
- 新規 `test/ui.shinra-bansho-god-playback.test.ts`

### 実装内容

1. 融合eventへgroup marker ID、footprint、effect block ID、除去reasonを載せる。
2. 4セルspawnをcanonical state更新に使いながら、出現音と大型石spawn presentationはgroup単位で1回に集約する。
3. `fusion_consume`4件、必要な`summon_clear`、composite spawnの順を固定する。
4. 4属性pulseはそれぞれtarget gateを持ち、前pulseのcommitted frame後に次を開始する。
5. trajectoryの論理sourceはanchor、表示sourceはactive backendが返すcomposite centerとする。
6. NOANIM、reduced motion、strict network settlementの既存分岐を維持する。

### 検証

- event mapperの順序・group集約focused test
- `npm run match:pixijs-board-playback-check`
- board-source trajectoryの既存contract test

### 完了条件

headless event列だけから、どのbackendでも同じ融合順・4pulse順・1体分の出現を再生できる。

## 10. Step 9: BoardRenderModelとPixi/DOM表示を実装する

### 目的

盤面意味は4セルのまま、active backendだけが2×2の大型石1体として描画する。

### 変更対象

- `ui/board-visual/types.ts`
- `ui/board-visual/model-builder.ts`
- `ui/board-visual/model.ts`
- `ui/pixi/board-scene.ts`
- `ui/pixi/stone-view.ts`、または新規のcomposite stone view
- `ui/board-dom-compat/special-marker-renderer.ts`
- DOM互換の盤面CSS
- `test/ui.board-visual.model-builder-capabilities.test.ts`
- `test/ui.pixi-board-scene.test.ts`
- `test/ui.board-dom-compat.special-marker-renderer.test.ts`

### 実装内容

1. `BoardRenderModel`へ読み取り専用の`compositeStones`を追加する。
2. 4 semantic cellsにはowner、stone ID、composite group参照を残す。
3. Pixiでは既存stone layer内でanchor以外を個別描画せず、4セル外接矩形へ大型spriteを1個描く。
4. 保護表示、hover、石情報、source geometryをgroup単位に集約する。
5. DOM互換ではbackend選択時だけ2×2 overlayを1個描き、個別discの見た目を抑止する。
6. compositeはanchor単独ではなくfootprintとmaterialization領域の交差で生成する。anchorだけがviewport外でも他の3セルが見えていれば、同じgroup IDのspriteを1個だけ描画する。
7. 盤面回転、白視点、拡張盤面、viewport clip、context recovery後も同じgroup IDで再構築する。
8. 2つ目のcanvas、ticker、writer、DOM互換への通常Pixi importを追加しない。

### 検証

- render modelでsemantic cell 4、composite 1
- Pixi sprite 1、DOM overlay 1
- anchorのみviewport外、白視点、拡張盤面、context recoveryでもcomposite 1体とsource geometryが残る
- `npm run match:pixi-runtime-fallback-check`
- `npm run match:cross-platform-smoke:vite`
- `npm run check:board-test-selectors`
- 最小の白視点・拡張盤面browser確認

### 完了条件

PixiとDOM互換のどちらでも2×2の1体に見え、盤面操作・アクセシビリティ・Single Visual Writerを壊さない。

## 11. Step 10: 画像、石情報、loader、生成物を接続する

### 目的

黒白の大型石画像、説明、module loading、browser/Worker配布をroot正本から同期する。

### 変更対象

- 新規
  - `assets/images/special-stones/SHINRA_BANSHO_GOD-black.png`
  - `assets/images/special-stones/SHINRA_BANSHO_GOD-white.png`
  - `assets/images/special-cards/backgrounds/shinra_bansho_god_background.png`
- `game/visual-effects-map.ts`
- `ui/presentation/stone-info-controller.ts`
- `ui/presentation/stone-info-panel.ts`
- `entry-browser.js`
- `workers/match-worker-runtime-preload.ts`
- `scripts/build-module-registry.ts`
- asset manifestのsource/generator
- buildが生成する隣接`.js`、`public/module-registry.js`、browser bundle/cachebuster、Worker mirror

### 実装内容

1. 黒白で判別でき、2×2表示時に四辺が切れない同一構図の透過128×128画像を用意する。
2. 1024×1536の不透明カード背景を用意し、カード定義には登録せず森羅万象神の石情報詳細パネル専用背景としてcover表示する。既存パネル色の半透明scrimで本文可読性を保つ。
3. 石情報へ名称、短い説明、`特殊石`・`永続`・`4マス占有`・`完全保護`タグを追加する。
4. どのfootprintセルから開いても同じgroup情報へ解決し、一覧では1体に集約する。
5. classic browser、Vite、Worker preloadに新しいshared/game moduleを既存順序で追加する。
6. `cards/catalog.json`と`CardType`へは追加しない。
7. 生成物を手編集せず、既存scriptでmanifest、browser bundle、Worker mirrorを生成する。

### 検証

- `npm run typecheck`
- `npm run build:ts`
- asset manifestと画像caseのfocused test
- 3画像の寸法・alpha・透明角・視認性を目視/metadata確認し、石情報背景がカード一覧へ混入しないfocused test
- `npm run build:browser`
- `npm run worker:prepare`

### 完了条件

全runtimeが同じroot moduleとassetを読み込み、森羅万象神がカード一覧へ混入せず石情報と盤面だけに表示される。

## 12. Step 11: ネットワーク・CPU・headless parityを固定する

### 目的

新commandを増やさず、同じaction結果として4セル、group marker、PRNG、event順を全runtimeへ伝える。

### 変更対象

- `utils/match-authority.ts`
- `ui/network/snapshot-canonical.ts`
- `ui/network/snapshot-runtime.ts`
- Worker/local authorityで明示的marker allowlistがある箇所
- `game/ai/cpu-policy-board-marker-primitives.ts`
- network、snapshot、CPUのfocused test

### 実装内容

1. 既存snapshotのgeneric marker伝送で足りる場合は構造を変えず、invariant validationだけ追加する。
2. projection/hash/reconnectでmarker 1個とowner 4セルを同じ順序で再構築する。
3. clientは出現場所や4属性targetを再抽選せず、authorityのcommitted resultだけを再生する。
4. CPUとselfplayは盤面評価で4石、特殊石評価で1個体として数える。
5. 旧snapshotに新markerがない場合の互換性を維持し、新markerの壊れたfootprintは黙って通常石へ降格させない。

### 検証

- snapshot canonical round-tripとhash
- reconnect playbackで途中の1〜3セル状態を表示しない
- `npm run test:network:parity`
- CPU/headlessで同じPRNG stateと最終盤面になるfocused test

### 完了条件

browser、local server、Worker、CPU、selfplay、再接続が同じcanonical状態・PRNG・event順を共有する。

## 13. Step 12: 総合検証とコミット

### focused検証

まず新規・更新したJestを`--runInBand`で実行し、失敗を局所化する。最低限、次を含める。

- 融合成立・不成立・保留・複数召喚
- 最大空きtierとPRNG消費
- 完全保護と単セル操作不可
- 単セル凍結、意志の凍結、凍結中4pulse停止
- セル消滅時のgroup解体
- セル消滅batchのgroup dedupeと追加3セルの非破壊会計
- 4pulseの順序・永続・候補なし継続
- render modelとgroup playback
- snapshot/network parity

### repository検証

```powershell
npm run typecheck
npm run check:window
npm run build:ts
npm run test:network:parity
npm run build:browser
npm run worker:prepare
npm run match:pixijs-board-playback-check
npm run match:pixi-runtime-fallback-check
npm run match:cross-platform-smoke:vite
npm run check:board-test-selectors
git diff --check
```

`npm run build:browser`はbrowser表示へ影響するroot変更のfocused test通過後に実行する。`worker-public/`は直接編集せず、`npm run worker:prepare`でのみ同期する。

### 実機確認

1. 空き2×2がある盤面で自動融合する。
2. 空き2×2がなく、通常石を敵味方問わず消して出現する。
3. 最大空き数が同じ複数候補からauthority結果どおりに出現する。
4. 黒視点・白視点で大型石が2×2へ正しく収まる。
5. 所有者ターン開始時に火→水→草→雷が順番に見え、各着弾後に次へ進む。
6. ネットワーク再生と再接続で4セルの途中状態や二重spriteが見えない。
7. Pixi初期化失敗時のDOM互換でも1体表示になり、Pixiと同時mountしない。

### コミット前確認

1. `git status --short`で既存の無関係変更を再分類する。
2. `git diff`で設計外のカード追加、通常破壊の無制限bypass、第2writer、runtime別ロジック複製がないことを確認する。
3. task所有ファイルだけをstageする。
4. focused implementation単位が独立していれば、仕様、headless、presentationの順に小さくコミットする。
5. 最後に生成物とmirrorがroot sourceと一致することを確認する。

### 完了条件

`docs/implementation/shinra-bansho-god-design.md`の8つの完了条件をすべて、テスト結果または実機確認結果へ対応付けて報告できる。

## 14. 要求トレーサビリティ

| ユーザー要求 | 設計上の決定 | 主な実装工程 |
| --- | --- | --- |
| カードではない | CardType・catalogへ追加せず、group markerとして実装 | Step 1、2、10 |
| 同色の火・水・草・雷が同時存在すると自動召喚 | canonical settlement後に最古素材各1体を自動融合 | Step 5、6 |
| 素材4体が勝手に破壊される | `fusion_consume`で操作不要・復活なしに消費 | Step 1、5、8 |
| 永続・不可侵 | 寿命なし、4セルを盤面干渉効果の対象外へ投影 | Step 3、7、14 |
| 自ターン開始時に4効果を順番に発動 | 火→水→草→雷の共有pulseを直列settle | Step 4、7、8 |
| 4マス分の大きさ | backend owner 4セル＋特殊石group 1個 | Step 2、3、9 |
| 表示上は巨大な1体 | `compositeStones`とactive backend内の2×2 sprite | Step 8、9、10 |
| なるべく空きが多い場所へランダム出現 | 最大空き数tierを選び、同点だけauthority PRNG | Step 5 |
| 空き塊がなければ敵味方を問わず場所を作る | 許可された占有石を`summon_clear`で確実に除去 | Step 1、5 |

## 15. Self-review

- 融合を`BoardOps`の全mutationへ暗黙接続する案は、配置時効果の途中や復活連鎖中に発火し得るため退け、turn pipelineのsettlement hookへ限定した。
- 4属性処理を森羅万象神へコピーする案は、元属性石との仕様差分を生むため退け、pulseと寿命を先に分離する工程を追加した。
- markerを4個置く案は、ターン開始4重発火、特殊石数4、単セル分離を招くため、4ownerセル＋1group markerに固定した。
- 「ランダム」を全候補の重み付き抽選と解釈せず、要求の「なるべく空きマスが多い」を保証する最大空きtier方式にした。
- 召喚場所確保を通常破壊へ流す案は、回避・復活・救済で原子的召喚が崩れるため、用途限定のtyped operationへ分けた。一方、完全保護・不可侵・凍結中の占有石は候補から除き、既存防御を暗黙に貫通しない。
- UIへgroup推測を持たせず、canonical eventとrender modelへmarker ID・footprintを明示する工程を追加した。
- state hashやnetwork snapshotはgeneric markerで足りる可能性があるため、変更を前提にせず、明示allowlistや正規化不足が見つかった場合だけ変更する計画にした。
- browser表示、network parity、Worker mirrorへまたがるため、focused test後の`build:browser`、network parity、`worker:prepare`、Pixi/DOM smokeを完了条件に含めた。
- 独立レビューで、既存4属性pulseは候補1でもPRNGを消費する事実、凍結のgroup semantics、セル消滅会計、settlement hook網羅性、candidateのrow→col sort、partial viewport、追加カード背景の用途が不足していると判明した。設計へ戻って修正し、本計画のStep 3〜10と総合検証へ反映した。

## 16. Step 13: 実装後レビュー修正と専用オーラ

### 目的

実装後レビューで再現した4件の不変条件違反を解消し、森羅万象神の盤上保護表現を石上バッジから2×2専用オーラへ変更する。

### 実装内容

1. 通常配置・pending選択の融合settlementを手番引継ぎより前へ移し、action-finalizerの再確認は冪等な安全網として残す。
2. 共有footprint契約へ「完全保護セル」と「完全な多マスgroup」の純粋判定を追加し、毒、意志狩りの王、ゾンビ感染の候補列挙へ適用する。
3. 当時の完全保護仕様では盤界の執行者の絶対執行対象を4占有セルへ展開したが、この挙動はStep 14で不可侵による対象外へ置き換える。
4. v2 complete snapshotは森羅万象神のmarker、`square_2x2.v1`、同色4セル、穴・void非重複、group非重複をstrict board inspectorで検証し、部分groupをfail closedにする。
5. Pixiでは既存stone viewのaura graphics、DOM互換では大型discのCSSだけを使って多色オーラを表示する。保護種別がStep 14で不可侵へ変わった後も、森羅万象神の保護バッジは両backendで表示しない。
6. DOMのオーラ明滅は `prefers-reduced-motion` で停止し、静止オーラへ戻す。

### 検証

- `test/game.shinra-bansho-god.test.ts`: 手番引継ぎ前融合、毒、意志狩りの王、ゾンビ感染、盤界の執行者
- `test/utils.match-authority.board-contract.test.ts`: 正常groupと部分・異色・穴重複groupのstrict拒否
- `test/ui.pixi-board-scene.test.ts`: 1 sprite、バッジ非表示、多色aura graphics
- `test/ui.board-dom-compat.stone-rendering.test.ts`: 1大型disc、バッジ非表示、専用aura class
- board kernel boundary、network parity、browser build、Pixi/DOM smoke、Worker deploy smoke

### 完了条件

レビューで再現した4件がすべて回帰テストで固定され、黒白双方の森羅万象神が能力情報を失わず、盤上では保護バッジなしの2×2専用オーラとして表示される。

### Self-review

- このStepで維持した完全保護能力は、2026-07-30のユーザー指定によりStep 14で不可侵へ置き換える。盤上バッジを出さず専用オーラを使う表示契約は維持する。
- 特殊石個体数と穴化セル数を同じ配列で表すと4マス石で再発するため、盤界の執行者ではinstance収集とaffected-cell展開を別関数にする。
- snapshot検証をWorkerだけへ追加するとbrowser reconnectとlocal authorityがずれるため、全runtimeが使うstrict shared board inspectorへ置く。

## 17. Step 14: 完全保護を不可侵へ置き換える

### 目的

森羅万象神の4セルを、石ローカルな完全保護ではなく、対象列挙そのものから外れる永続の不可侵として全runtimeで統一する。

### 実装内容

1. `01-rulebook.md`、関連する`正本`、設計書、耐性貫通表を不可侵仕様へ更新する。
2. 特殊石レジストリへ非顕現石にも使える機械可読な`inviolable` traitとfootprint-awareなセル判定を追加する。
3. 森羅万象神から`flipProtected`と`destroyProtected`を外し、石情報タグを`完全保護`から`不可侵`へ変更する。
4. marker、selector、protection context、BoardOps、毒、意志狩り、ゾンビ感染、凍結対象列挙を同じ不可侵セル判定へ寄せる。
5. 盤界の執行者は使用条件の個体数と絶対執行対象を分離し、不可侵の森羅万象神は前者だけへ含める。
6. 既存の多色オーラを不可侵表現として維持し、新しい石上マーカーは追加しない。
7. focused test、typecheck/build、network parity、browser build、Worker mirror/bundle smokeでbrowser・headless・local・Workerの一致を確認する。

### 完了条件

- 4セルすべてで不可侵判定と`不可侵`タグが成立し、`完全保護`タグは表示されない。
- 通常反転・破壊・移動・状態付与・凍結・抹消・盤面縮小・絶対執行の対象にならない。
- 盤界の執行者の使用条件では特殊石1体として数えられる。
- 専用多色オーラ、2×2表示、4属性の直列発動、snapshot形状契約は維持される。

### Self-review

- 完全保護へ不可侵を追加する併用案は、UIタグと貫通マトリクスが二重になるため採用しない。レジストリ能力を置換し、不可侵を唯一の保護種別にする。
- 顕現石判定へ森羅万象神を混ぜる案は、特殊石個体数とカード使用封印の意味を壊すため採用しない。特殊石分類は維持し、不可侵traitだけを共通化する。
- 絶対執行で`ignoreInviolable`を残す案は、不可侵化のプレイヤー期待と矛盾するため採用しない。使用条件カウントと効果対象を別関数に分ける。
