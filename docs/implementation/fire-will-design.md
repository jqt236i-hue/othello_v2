# 火の意志 実装設計

## 文書の役割

- 対象: 新カード「火の意志」のゲーム仕様、canonical 状態、CPU・通信、盤面表示、炎ビーム、効果音、生成物への統合
- プレイヤー向け一次情報: `01-rulebook.md`
- 内部契約の一次情報: `docs/architecture-contracts.md`
- 非対象: 草の意志・水の意志の実装、Worker の本番デプロイ

## 問題と期待結果

コスト21の「火の意志」を通常カードとして追加する。使用後の次の配置石は6所有者ターン持続する火石になり、反転保護を持つ。火石は配置時と各所有者ターン開始時に、盤面上の穴以外のマスから1マスを canonical PRNG で選び、10手番持続する灼熱マスへ上書きする。

灼熱マスに同じ石が3手番連続で居続けると通常の破壊を1回試みる。灼熱マスと居座り状態は黒白どちらかの1手番完了を1ターンとして数え、付与された手番には減算しない。石が灼熱マスを離れた場合は居座り状態を解除し、再接触時は3から数え直す。反転だけでは石がマスを離れていないためカウントを継続する。

## スコープ

- `fire_will_01` / `FIRE_WILL` のカタログ・型・表示文言・カード面
- `FIRE` 火石、`SCORCHED_CELL` 灼熱マス、`SCORCHED` 居座り状態
- 配置時と所有者ターン開始時の authority PRNG によるランダムな灼熱マス生成
- 火石の6所有者ターン持続、反転保護、通常石化
- 灼熱マスの10手番持続、居座り状態の3手番致死、通常破壊契約
- 毒マスを含む一時的な特殊マスの排他上書き
- 毒状態と灼熱居座り状態が同じ石に共存するときの衝突しないカウント表示
- 火石から成立先へ飛ぶ炎ビームと、着弾時の灼熱マス生成音
- headless、CPU/AUTO、Worker/local authority、snapshot、Pixi、DOM互換表示、生成物、focused tests

## 非ゴール

- 草の意志・水の意志
- 既存カードのコストや毒状態の5手番仕様の変更
- 新しいネットワーク action や snapshot schema version
- 既存 snapshot の `kind: specialStone` を一括置換する破壊的な marker migration。今回は互換形を維持したまま、共有registryの意味分類と型付きselectorを正本にする

## 前提と仕様判断

1. カード表示分類は、敵味方を問わず遅延破壊する盤面危険効果であるため「殲滅」とする。
2. 「10ターン」「3ターン」は毒と同じく、黒または白の1手番完了を1ターンとする。設置・接触した手番は減算しない。
3. ランダム候補は canonical board topology 上の穴以外の全マスとし、空き・石あり・既存特殊マスを含む。すでに灼熱マスの場合も新しい10手番の灼熱マスで上書きする。
4. 一時的な特殊マスは同一マスに共存しない。`BLOCKADE`、`FREEZE`、`SEED`、`POISON_CELL`、`SCORCHED_CELL` の新規付与時に、同じマスの既存一時マスマーカーを除去してから新規マーカーを1つ置く。永続穴は対象候補にならず、上書きしない。
5. 毒マスを灼熱マスで上書きしても、すでに石へ付いた `POISONED` は毒の既存仕様どおり残る。灼熱マスが別の特殊マスで上書きされた場合は `SCORCHED` を解除する。
6. `SCORCHED` は完全保護を含む通常石・特殊石へ表示でき、0で既存の通常破壊を1回試みる。完全保護、幽体、破壊回避、復活などは通常の破壊契約どおり解決し、成否にかかわらず今回の `SCORCHED` は解除する。破壊保護で同じ灼熱マス上に残った石は接触同期によって新しい残り3のカウントを開始し、回避移動でマスを離れた石は開始しない。不可侵の顕現石には居座り状態を付与しない。
7. 火石は既存の反転保護アンカーと同様、通常反転・交換では変化せず、破壊は受ける。6回目の所有者ターン開始でも灼熱マスを生成してから通常石へ戻る。
8. 灼熱マスが成立した場合は、火石から対象マスへの盤面内炎ビームを先に再生し、着弾後に灼熱マスを表示する。成立した灼熱マス1個につき専用生成音を1回鳴らす。候補がなく成立しない場合はビームも音も出さない。
9. 既存の `assets/images/special-stones/fire-will-black.png` / `fire-will-white.png` と `assets/images/special-cards/backgrounds/fire_will_background.png` を使用し、生成済み manifest 差分は既存の関連作業として引き継ぐ。

## 現在の構造と再利用

- 次置き特殊石と6ターン寿命: `LIGHTNING_WILL` の placement marker、turn-start anchor、反転保護、通常石化契約を再利用する。
- 10手番マスと石カウント: `POISON_CELL` / `POISONED` の global completed-turn timing、marker、presentation、Pixi/DOM表示を拡張する。
- 特殊マス付与: `game/logic/card-resolution/status-cells.ts` を一時マス排他付与の正本とする。
- 盤面候補: shared board topology を使う shape-aware selector を追加し、矩形再構築や expansion 逆投影を行わない。
- 破壊: `BoardOps.destroyAt` を使い、回避・幽体・復活・救済など既存 lifecycle を通す。
- 通信: 既存の標準 card-use command、canonical `cardState.markers`、authority PRNG state、viewer snapshot projection、presentation frameをそのまま使う。
- 表示: `ui/board-visual/controller.ts` 以下の render model → active backend だけが盤面を書く。

## 石・状態・マスを分離する境界設計

今回の通常石ちらつきは、`STATUS_APPLIED` の対象を一律に `{ color, owner, special, timer }` へ平坦化し、最終盤面からイベント適用前の石を逆算したために発生した。灼熱マスが火石自身へ成立すると、盤面マーカーの `owner` と `special` が石本体へ流入し、火石を一時的な通常石として投影できてしまう。

再発防止のため、次の意味契約を共有registryとpresentation DTOの正本にする。

- markerは既存snapshot互換の保存形を維持するが、意味上は `stone_body`、`stone_status`、`cell_marker`、`topology`、`placement_effect` に分類する。
- marker typeごとに `ownershipPolicy`、`durationClock`、`exclusivityGroup`、`visualLayer` を共有registryで一意に定義する。
- `POISON_CELL` と `SCORCHED_CELL` は `ownershipPolicy: none` とし、新規canonical markerの `owner` は `null`、発動者は `sourcePlayer` として分離する。既存snapshotのowner付きhazard cellは意味上ownerなしとして受理し、旧ownerは`sourcePlayer`欠損時のattribution fallbackにだけ使い、石ownerやマスownerへ流用しない。
- `POISON_CELL` と `SCORCHED_CELL` の表示時間は `remainingTurns` を正本とし、`remainingOwnerTurns` へフォールバックしない。
- 新規producerが作る `status_applied` / `status_removed` targetでは `subjectKind` と `stoneMutation` をtarget直下の必須情報として付加する。既存event typeはnetwork互換のため維持する。フィールド欠損をregistryから推論してよいのは、旧保存データまたは旧fixtureを読むlegacy parse境界だけとし、新規の`POISON_CELL` / `SCORCHED_CELL` network playback targetで欠損・不正値を受理しない。
- 一時特殊マスの成立・解除は `subjectKind: cell_marker`、`stoneMutation: preserve` とし、対象マスに石がある場合でも石のbefore/afterを生成・推測・再投影しない。
- marker保存primitiveの汎用`STATUS_APPLIED`とstatus-cell helperの意味イベントを二重発行しない。`addMarker`へ明示的なpresentation ownership optionを設け、status-cell helperがmarker保存時の汎用発行を抑止したうえで、source、timer、subject、mutationを持つイベントを1回だけ発行する。
- `subjectKind` の意味は、`stone_body`=石本体、`stone_status`=石に付随する状態、`cell_marker`=石と独立したマス面、`topology`=穴・復元などマス存在構造、`placement_effect`=配置時だけの効果で固定する。`stoneMutation` は、`preserve`=石本体無変更、`replace`=石visualを別状態へ置換、`remove`=石visualを除去、`timer-only`=石本体を保ったまま状態カウンターだけ更新、とする。
- 新規status targetの許容組合せは、`cell_marker → preserve`、`stone_status → preserve | replace | timer-only`、`stone_body → preserve | replace | remove`、`topology → replace | remove`、`placement_effect → preserve | replace` とする。topologyだから常に石を除去すると推論せず、eventごとにmutationを明示する。
- DOM/Pixiは同じ`stoneMutation`を消費する。`preserve`ではsource trajectoryのsettlementと必要なhighlightだけを処理し、stone-body projection mutatorを呼ばない。
- 最終盤面からイベント時点のbeforeを逆算する処理は、明示的なstone mutationが必要なlegacy eventに限定する。cell markerには使用しない。
- 物理石の生成にはstone state内の明示owner/colorを要求し、マスmarkerやeffect sourceのownerだけから石を生成しない。

`ui/board-visual/types.ts` の `BoardCellVisualState { stone, markers }` をpresentation側でも基準形とし、stone status resolver、移動時snapshot helper、互換投影は共有registryの分類を通してboard markerを石本体候補から除外する。保存形を絞るための `kind === specialStone` は許容するが、「どれが石本体か」を選ぶ意味判断はregistry selectorを必須とする。

### 採用しない案: 既存marker kindの即時一括移行

`specialStone`を複数のkindへ一括変更すると、snapshot、Worker/local authority、CPU、移動・破壊・復活、旧保存データの全経路へmigrationが必要になる。今回のプレイヤー向け結果に対して変更範囲が過大であるため、保存形は維持し、意味分類を共有registryへ集約する。各consumerは保存種別の候補抽出後、registry selectorで石本体を選び、「最初のmarker」を石本体と見なさない。将来kindを移行する場合も、この意味分類がmigration境界になる。

## 選択肢と採用理由

### 灼熱処理を毒処理から完全分離する

実装は局所的だが、手番終了に毒と灼熱の別々の減算入口ができ、同じ石に両状態がある場合の破壊順が入口順に依存する。採用しない。

### 一時マスと危険状態を共通の status-cell lifecycle に統合する

毒と灼熱を同じ completed-turn processor で `createdSeq` 順に処理し、状態破壊をすべて終えてからマス寿命を減算する。特殊マス排他も1つの付与 helper に置ける。既存毒の順序契約を保ちつつ、毒＋灼熱の同時0も決定的になるため採用する。

### 火の意志専用ネットワーク action を追加する

対象選択がなく、次置き石とauthority乱数だけで完結するため不要。標準カード使用・配置 command のまま Worker/local/headless を同一ロジックへ通す方が小さく安全なので採用しない。

## データと制御フロー

1. `FIRE_WILL` 使用で通常の pending next-stone effect を canonical state に保存する。
2. 次の合法配置で `FIRE` marker `{ remainingOwnerTurns: 6 }` を置く。
3. placement immediate dispatcher がその `FIRE` anchor だけを処理する。配置時は寿命を減らさない。
4. shape-aware candidate listから authority PRNG で1マス選ぶ。
5. 同じマスの一時マスマーカーを除去し、ownerなしの`SCORCHED_CELL { remainingTurns: 10, appliedTurnNumber, sourcePlayer }` を汎用presentation抑止付きで置く。
6. そのマスに石があれば `SCORCHED { remainingTurns: 3, appliedTurnNumber, contactRow, contactCol }` を付与する。すでに同じ接触を継続中ならリセットしない。
7. 所有者ターン開始時は canonical marker orderで火石ごとに 4〜6 を実行し、寿命を1減らす。0になった火石は同色通常石へ戻す。
8. 各手番終了時に poison/scorch contact を同期し、`POISONED` と `SCORCHED` を `createdSeq` 順に減算・致死解決する。次に `POISON_CELL` と `SCORCHED_CELL` を減算・解除する。
9. status-cell helperが`STATUS_APPLIED`を1回だけ発行する。表示メタデータへ火石の発射元座標を保持し、targetを`subjectKind: cell_marker`、`stoneMutation: preserve`として既存の board-source trajectory 契約で炎ビームを開始する。canonical state/snapshotは通常どおり即時に受理し、active backendの対象visual projectionとcommitted visual frame applyだけが軌道settlementを待つ。待機中も物理石へ一切書き込まない。
10. canonical snapshot と ordered presentation event を既存の network intake / timeline / Single Visual Writer で描画する。旧snapshot内のowner付きhazard markerはsnapshot hash/version互換のためserialized値を変更せずbyte-preserveし、意味処理ではownerを完全に無視する。新規markerだけを`owner: null`で保存し、旧ownerは`sourcePlayer`欠損時のattribution fallbackにだけ使う。

## 表示設計

- 火石: 黒白別の既存専用画像。特殊石残りターンと反転保護バッジは既存の石表示契約。
- 灼熱マス: 毒マスと同じ surface marker 構造を使い、赤〜橙の半透明面にする。残り10手番は左上の赤い角ラベル。
- 居座り状態: 石の中央に赤〜橙の専用カウントを表示する。
- 毒＋灼熱: どちらか片方だけなら中央。両方ある場合は毒を中央より少し左、灼熱を少し右へずらし、両方を表示する。
- Pixi を通常経路、DOMを排他的互換経路として同じ情報を表示する。DOM backendが排他的に選択された時だけDOM互換演出を動かし、新しいcanvasや別writerは作らない。
- 炎ビームは `status_applied` 用の board-source trajectory profile とし、発射元と対象がともに盤面座標である既存の盤面内軌道経路を使う。Pixiは既存effect layerの赤・橙・黄の多層ビーム、DOM互換は選択時だけ同じ始点・終点・settlement順序のCSSビームを描画する。
- 通常モーションではビーム着弾後に灼熱マスを表示し、生成音を直後の予約phaseへ割り当てる。複数の火石が同一ターンに発動する場合も、各火石について「ビームと赤マス表示→生成音」の順を保ってから次の火石へ進む。NOANIMではオブジェクトを作らず即時settleし、reduced motionではsourceをskipしてtarget表示を妨げない。
- カード面: catalog の明示的な `card_face_art_path` を card-art generator が検証・生成し、既存の火背景をカード背景に使う。既存カードの `assets/images/card` 解決は維持する。
- `card_face_art_path` は optional field とし、未指定カードは従来の日本語名→`assets/images/card` 解決を維持する。generator は絶対path、親directory参照、存在しないassetを拒否する。catalog自体の通信schemaは変えないためversionは据え置く。

## CPU・AUTO・ネットワーク

- CPU taxonomy では安定配置を好む長期アンカー型として雷の意志に近い分類へ加える。
- 対象選択はないため CPU 専用結果を作らず、通常の card-use → placement plannerを使う。
- authorityだけが灼熱マス候補を抽選し、更新後 `prngState` とmarkersを保存する。
- snapshot/projection schemaは既存markerの可搬形を利用し、秘密情報を追加しない。
- Worker runtime preloadへ火効果moduleを登録し、local/Workerとも同じroot moduleを使う。

## 互換性・失敗時動作

- 既存snapshotに新markerがなければ挙動は変わらない。
- 新markerは既存のmarker projectionにそのまま載る。古いクライアント互換はこのrepoの同時配布契約に従い、Worker mirrorとbrowser bundleを同じコミットで更新する。
- PRNG、board topology、destroy、revert dependencyが欠ける場合は成功形にせず明示的に失敗させる。
- ランダム候補が0なら灼熱生成は不発だが、火石の寿命処理は継続する。

## テスト・検証戦略

- カタログ・CardType・カード面path・詳細タグ・特殊石registry
- 火の意志 focused headless tests: コスト、配置、配置時抽選、拡張セル、上書き、10/3手番、移動リセット、反転継続、毒共存、通常破壊、6回目通常石化、反転保護
- 既存毒 focused tests: 排他上書き後も毒状態が残ることを含む回帰
- marker、board runtime parity、CPU all-card taxonomy、AUTO planner
- render model、Pixi scene、DOM互換marker、毒＋灼熱の位置
- `status_applied` source trajectory の分類、発射元/対象座標、着弾前のtarget gate、Pixi/DOMの開始・settlement、NOANIM
- canonical火効果からpresentation adapterを経由した実イベントで、空マス、通常石、火石、別特殊石、発射元と対象が同一の各ケースにおいて、active backendの石の有無・種類が一度も変化しないこと
- owner付きlegacy hazard snapshotを受理しても、そのownerが石生成・石owner・マスownerへ流れず、source attributionだけに限定されること
- ownerなしhazard cell、`remainingTurns` timer、`subjectKind`、`stoneMutation`をnetwork replay contractで検証する
- status-cell成立1回につき適用presentation eventが1本だけで、汎用marker eventが先行しないこと
- marker primitiveは既定optionで従来の`STATUS_APPLIED` / `SPAWN` backfillを維持し、抑止optionではmarker保存だけを行って汎用適用eventを0本にすること。status-cell helperは上書き時の意味付き`STATUS_REMOVED`を維持し、意味付き`STATUS_APPLIED`だけを1本発行すること
- `cell_marker/preserve` のapply、tick、removeでbefore/afterを生成せず、Pixiの`setProjectedStone`とDOMのdisc更新を0回にすること
- stone status resolver、移動snapshot、互換投影がboard markerを石本体として選ばないこと
- 灼熱成立時の専用音キューと音源map、成立しない場合の無音
- typecheck、window boundary、browser build
- network parity、Worker prepare/mirror、Worker bundle smoke
- 最小のブラウザ/Pixi playback check

## リスクと緩和

- 複数危険状態の同時致死: `createdSeq` 順の単一processorと、各処理前のmarker生存確認で二重破壊を防ぐ。
- 移動後に古い居座りカウントが追従する: `SCORCHED` をstone statusとして移動させつつ、固定した `contactRow/contactCol` と現在座標を同期時に比較して解除する。
- 特殊マスの重複: category-basedな排他付与helperとfocused testsで防ぐ。
- 拡張盤面差異: shared board topologyから候補を取得し、base/expansion/holeを再構築しない。
- UIカウント衝突: render modelに別marker kindを保持し、Pixi/DOM両方でdual状態を明示配置する。
- ビームより先に赤マスが見える: raw source trajectoryをphase内で先に開始し、`status_applied` targetが対応軌道のsettlementを待ってから最終表示を適用する。
- 既存status eventへの波及: 火の意志だけをcause/reason/profileで共有classifierが分類し、他の`status_applied`は従来どおり軌道なしで即時処理する。
- legacy status eventとの互換: event typeは維持し、targetの意味フィールドを追加する。意味フィールドがない旧fixtureはlegacy parse境界だけで共有registryから同じ分類を導出するが、ownerから物理石を補完しない。新規hazard-cell producerと厳格network validatorは欠損を拒否する。
- legacy hazard markerとの互換: owner付き`POISON_CELL` / `SCORCHED_CELL`は読み込み時に意味上ownerなしとして扱う。`sourcePlayer`がない場合だけ旧ownerをattributionへ読み替える。hash/version互換のため旧snapshotのserialized ownerは保存・projectionで書き換えず、新規markerだけownerなしにする。
- 汎用marker event抑止の波及: `addMarker`の既定動作は維持し、status-cell helperだけが明示optionで汎用発行を抑止する。他の特殊石・bomb・manifestのpresentationは変更しない。
- marker kind一括移行の波及: 保存形は維持し、registry selectorの導入と危険な「最初のspecialStone」参照の除去を先に行う。

## 完了条件

- 火の意志が有効カードcatalog、全カードpool、custom deck指定で利用でき、コスト21で使用できる。
- 次の石が火石になり、配置時と各所有者ターン開始時に同一canonical結果の灼熱マスを作る。
- 火石6ターン、灼熱マス10手番、居座り3手番、反転保護、通常破壊が仕様どおり。
- 特殊マスは排他的に上書きされ、毒状態と灼熱状態は石上で共存表示できる。
- Pixi、DOM互換、headless、CPU、local authority、Worker authority、再接続snapshotが一致する。
- 火石から成立先への炎ビームが両backendで再生され、着弾後に灼熱マスを表示し、成立1マスにつき専用音を1回鳴らす。
- 空マス・通常石・火石・別特殊石のどこへ灼熱マスが成立しても、beam開始からcommitted visual frame applyまでactive backend上の物理石の存在・owner・special typeが変化しない。canonical state/snapshotの受理は遅延しない。
- 毒・灼熱マスはcanonical上ownerなしで、source playerと10手番timerが混同されない。
- status playbackの対象種別とstone mutationが型・network validator・両backendで一致し、board markerを石状態として選ぶ既知のselectorが残らない。
- 灼熱マス1個の成立につき意味の完全な`STATUS_APPLIED`が1本だけ発行され、source trajectoryなしの汎用適用イベントが先行しない。
- 必要な仕様・カタログ・生成物・mirrorが同期し、所定のfocused/parity/build/smoke検証が通る。
- タスク所有差分だけがコミットされる。

## 独立レビュー反映

- browser classic loader、startup module registry、Worker runtime preloadの3経路へ専用moduleを登録する。
- 移動・破壊・回避で盤面固定markerを手書きリストにせず、共有registryのboard-marker分類を使う。
- 火石アンカー1個の灼熱付与と寿命更新、各危険状態の致死、特殊マス期限切れと接触解除を、それぞれ同じ`BoardOps.runEffectBlock`内で確定する。
- 各危険状態の処理直前に接触状態を再検証し、破壊・回避後と特殊マス期限切れ直後にも同期する。
- capture source、living-will復元、network turn handoff、context builder、effect resolverへ`FIRE`を通す。
- テスト範囲にsame-cell refresh、完全保護、破壊回避、同時危険状態、固定marker移動防止、art path後方互換を追加する。
- presentation対象生成元の`game/turn/pipeline_ui_adapter.ts`、marker公開facadeの`game/cards/effects/markers.ts`、移動visual metaの`game/logic/cards/hyperactive.ts`、破壊・移動visual metaの`game/logic/board_ops.ts`を意味契約の実装対象へ追加する。`game/turn/presentation-helpers.ts`のtype一致検索は石本体選択を行わないため監査allowlistとし、status-cell eventの単一producer確認だけを行う。

## Self-review

初稿では灼熱処理を毒と別processorにする案があったが、同じ石で毒と灼熱が同時に0になると入口順依存になるため、危険状態を`createdSeq`順で処理する共通status-cell lifecycleへ変更した。また、火背景を`assets/images/card`へ複製する案はassetの二重管理になるため、catalogの明示pathをgeneratorが検証する設計へ変更した。通信は新actionやschema追加が不要で、既存marker projectionとauthority PRNGで要件を満たすことを確認した。

効果音・炎ビーム追補の初案では専用の全画面DOM演出を追加する余地があったが、発射元と対象がともに盤面座標であるためSingle Visual Writer契約に反する。既存のboard-source trajectoryへ`status_applied` profileを追加する設計へ変更した。canonical stateには演出状態を入れず、既存のordered presentation eventへ発射元座標だけを載せる。これによりWorker/local/headlessの結果を変えず、PixiとDOM互換のtarget gate、NOANIM、厳格network playbackを同じ契約で検証できる。

追加監査では、空マス向けのowner補完を止めても、火石自身が対象になった場合に`before.special`を消して通常石を再投影する経路が残ることを再現した。このため局所的なowner guardでは不十分と判断し、cell marker eventがstone stateを持たない設計へ修正した。また、marker kindの即時一括移行は保存・通信互換に対して過大であるため見送り、共有registryの意味traits、型付きtarget、厳格stone constructor、consumer selectorの順で段階的に境界を固定する。

実経路を追加確認したところ、marker primitiveの汎用`STATUS_APPLIED`とstatus-cell helperのsource trajectory付き`STATUS_APPLIED`が同じ成立に対して二重発行されていた。前者は炎ビームより先に再生可能で、timer・owner・subjectの意味も不完全になる。設計を修正し、marker保存APIは既定互換を保ったまま呼び出し単位で汎用presentationを抑止できるようにし、status-cell helperを唯一の意味イベント発行者とする。

独立再レビューでは、canonical state適用とvisual settlementの語が混在していたため、canonical state/snapshotは即時受理し、遅延するのはactive backendのvisual projectionとcommitted visual frame applyだけであることを明記した。またowner付きlegacy hazard snapshotを破棄せず、旧ownerをsource attribution fallbackに限定する互換条件を追加した。
