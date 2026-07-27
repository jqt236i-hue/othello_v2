# 火の意志 実装設計

## 文書の役割

- 対象: 新カード「火の意志」のゲーム仕様、canonical 状態、CPU・通信、盤面表示、生成物への統合
- プレイヤー向け一次情報: `01-rulebook.md`
- 内部契約の一次情報: `docs/architecture-contracts.md`
- 非対象: 専用効果音、草の意志・水の意志の実装、Worker の本番デプロイ

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
- headless、CPU/AUTO、Worker/local authority、snapshot、Pixi、DOM互換表示、生成物、focused tests

## 非ゴール

- 灼熱専用の効果音や攻撃軌道
- 草の意志・水の意志
- 既存カードのコストや毒状態の5手番仕様の変更
- 新しいネットワーク action や snapshot schema version

## 前提と仕様判断

1. カード表示分類は、敵味方を問わず遅延破壊する盤面危険効果であるため「殲滅」とする。
2. 「10ターン」「3ターン」は毒と同じく、黒または白の1手番完了を1ターンとする。設置・接触した手番は減算しない。
3. ランダム候補は canonical board topology 上の穴以外の全マスとし、空き・石あり・既存特殊マスを含む。すでに灼熱マスの場合も新しい10手番の灼熱マスで上書きする。
4. 一時的な特殊マスは同一マスに共存しない。`BLOCKADE`、`FREEZE`、`SEED`、`POISON_CELL`、`SCORCHED_CELL` の新規付与時に、同じマスの既存一時マスマーカーを除去してから新規マーカーを1つ置く。永続穴は対象候補にならず、上書きしない。
5. 毒マスを灼熱マスで上書きしても、すでに石へ付いた `POISONED` は毒の既存仕様どおり残る。灼熱マスが別の特殊マスで上書きされた場合は `SCORCHED` を解除する。
6. `SCORCHED` は完全保護を含む通常石・特殊石へ表示でき、0で既存の通常破壊を1回試みる。完全保護、幽体、破壊回避、復活などは通常の破壊契約どおり解決し、成否にかかわらず今回の `SCORCHED` は解除する。破壊保護で同じ灼熱マス上に残った石は接触同期によって新しい残り3のカウントを開始し、回避移動でマスを離れた石は開始しない。不可侵の顕現石には居座り状態を付与しない。
7. 火石は既存の反転保護アンカーと同様、通常反転・交換では変化せず、破壊は受ける。6回目の所有者ターン開始でも灼熱マスを生成してから通常石へ戻る。
8. 専用効果音は追加せず、カード使用共通音と致死時の通常破壊音を使う。
9. 既存の `assets/images/special-stones/fire-will-black.png` / `fire-will-white.png` と `assets/images/special-cards/backgrounds/fire_will_background.png` を使用し、生成済み manifest 差分は既存の関連作業として引き継ぐ。

## 現在の構造と再利用

- 次置き特殊石と6ターン寿命: `LIGHTNING_WILL` の placement marker、turn-start anchor、反転保護、通常石化契約を再利用する。
- 10手番マスと石カウント: `POISON_CELL` / `POISONED` の global completed-turn timing、marker、presentation、Pixi/DOM表示を拡張する。
- 特殊マス付与: `game/logic/card-resolution/status-cells.ts` を一時マス排他付与の正本とする。
- 盤面候補: shared board topology を使う shape-aware selector を追加し、矩形再構築や expansion 逆投影を行わない。
- 破壊: `BoardOps.destroyAt` を使い、回避・幽体・復活・救済など既存 lifecycle を通す。
- 通信: 既存の標準 card-use command、canonical `cardState.markers`、authority PRNG state、viewer snapshot projection、presentation frameをそのまま使う。
- 表示: `ui/board-visual/controller.ts` 以下の render model → active backend だけが盤面を書く。

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
5. 同じマスの一時マスマーカーを除去し、`SCORCHED_CELL { remainingTurns: 10, appliedTurnNumber }` を置く。
6. そのマスに石があれば `SCORCHED { remainingTurns: 3, appliedTurnNumber, contactRow, contactCol }` を付与する。すでに同じ接触を継続中ならリセットしない。
7. 所有者ターン開始時は canonical marker orderで火石ごとに 4〜6 を実行し、寿命を1減らす。0になった火石は同色通常石へ戻す。
8. 各手番終了時に poison/scorch contact を同期し、`POISONED` と `SCORCHED` を `createdSeq` 順に減算・致死解決する。次に `POISON_CELL` と `SCORCHED_CELL` を減算・解除する。
9. canonical snapshot と ordered presentation event を既存の network intake / timeline / Single Visual Writer で描画する。

## 表示設計

- 火石: 黒白別の既存専用画像。特殊石残りターンと反転保護バッジは既存の石表示契約。
- 灼熱マス: 毒マスと同じ surface marker 構造を使い、赤〜橙の半透明面にする。残り10手番は左上の赤い角ラベル。
- 居座り状態: 石の中央に赤〜橙の専用カウントを表示する。
- 毒＋灼熱: どちらか片方だけなら中央。両方ある場合は毒を中央より少し左、灼熱を少し右へずらし、両方を表示する。
- Pixi を通常経路、DOMを排他的互換経路として同じ情報を表示する。新しいcanvasや別writerは作らない。
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
- typecheck、window boundary、browser build
- network parity、Worker prepare/mirror、Worker bundle smoke
- 最小のブラウザ/Pixi playback check

## リスクと緩和

- 複数危険状態の同時致死: `createdSeq` 順の単一processorと、各処理前のmarker生存確認で二重破壊を防ぐ。
- 移動後に古い居座りカウントが追従する: `SCORCHED` をstone statusとして移動させつつ、固定した `contactRow/contactCol` と現在座標を同期時に比較して解除する。
- 特殊マスの重複: category-basedな排他付与helperとfocused testsで防ぐ。
- 拡張盤面差異: shared board topologyから候補を取得し、base/expansion/holeを再構築しない。
- UIカウント衝突: render modelに別marker kindを保持し、Pixi/DOM両方でdual状態を明示配置する。

## 完了条件

- 火の意志が有効カードcatalog、全カードpool、custom deck指定で利用でき、コスト21で使用できる。
- 次の石が火石になり、配置時と各所有者ターン開始時に同一canonical結果の灼熱マスを作る。
- 火石6ターン、灼熱マス10手番、居座り3手番、反転保護、通常破壊が仕様どおり。
- 特殊マスは排他的に上書きされ、毒状態と灼熱状態は石上で共存表示できる。
- Pixi、DOM互換、headless、CPU、local authority、Worker authority、再接続snapshotが一致する。
- 必要な仕様・カタログ・生成物・mirrorが同期し、所定のfocused/parity/build/smoke検証が通る。
- タスク所有差分だけがコミットされる。

## 独立レビュー反映

- browser classic loader、startup module registry、Worker runtime preloadの3経路へ専用moduleを登録する。
- 移動・破壊・回避で盤面固定markerを手書きリストにせず、共有registryのboard-marker分類を使う。
- 火石アンカー1個の灼熱付与と寿命更新、各危険状態の致死、特殊マス期限切れと接触解除を、それぞれ同じ`BoardOps.runEffectBlock`内で確定する。
- 各危険状態の処理直前に接触状態を再検証し、破壊・回避後と特殊マス期限切れ直後にも同期する。
- capture source、living-will復元、network turn handoff、context builder、effect resolverへ`FIRE`を通す。
- テスト範囲にsame-cell refresh、完全保護、破壊回避、同時危険状態、固定marker移動防止、art path後方互換を追加する。

## Self-review

初稿では灼熱処理を毒と別processorにする案があったが、同じ石で毒と灼熱が同時に0になると入口順依存になるため、危険状態を`createdSeq`順で処理する共通status-cell lifecycleへ変更した。また、火背景を`assets/images/card`へ複製する案はassetの二重管理になるため、catalogの明示pathをgeneratorが検証する設計へ変更した。通信は新actionやschema追加が不要で、既存marker projectionとauthority PRNGで要件を満たすことを確認した。
