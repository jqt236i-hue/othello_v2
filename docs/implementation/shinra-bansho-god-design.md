# 森羅万象神 設計

## 1. 文書の役割

- 対象: 火の意志・水の意志・草の意志・雷の意志から自動召喚される、2×2マス占有の永続特殊石「森羅万象神」
- プレイヤー向け仕様の正本: `01-rulebook.md`
- 詳細挙動の正本: `正本/共通ルール正本.md`、`正本/ターン進行正本.md`、`正本/カード仕様正本.md`、`正本/演出正本.md`
- 内部境界の正本: `docs/architecture-contracts.md`
- この文書の役割: 実装前の設計正本。実装時は先に上記プレイヤー向け正本を更新する
- 非目標: 新しいカード、デッキ項目、カードコスト、4属性カード自体の効果変更

## 2. 望ましいプレイヤー体験

同じ色の火石・水石・草石・落雷石が盤面に同時にそろうと、プレイヤーの追加操作なしで4体が融合し、盤面上の2×2マスを占める「森羅万象神」が1体出現する。

森羅万象神は永続で、所有者ターン開始時に次の4効果を必ず直列で発動する。

1. 火の意志相当: ランダムな1マスを灼熱マスにする
2. 水の意志相当: ランダムな1マスを治癒マスにする
3. 草の意志相当: ランダムな有効空きマスへ種をまく
4. 雷の意志相当: ランダムな敵石1個へ通常の破壊を試みる

盤面計算上は同色石4個として扱うため、4マスの各セルが反転経路、合法手、石数、最終得点へ通常どおり関与する。見た目と特殊石としての能力主体は1体である。

## 3. 採用する仕様解釈

ユーザー要求だけでは境界挙動が未定義なので、実装可能かつ一貫した仕様として次を採用する。

### 3.1 形と個数

- 「4マスのかたまり」は、上下左右に連続した固定の2×2正方形とする。
- 森羅万象神の内部種別は `SHINRA_BANSHO_GOD` とする。
- カードではないため、カードID、カード定義、カードカタログ、捕獲時の戻りカードは持たない。
- 盤面石数では4個、特殊石個体数では1体として数える。
- 同じ色に2組以上の素材がある場合は、1組ずつ融合判定を繰り返し、条件と出現場所が残る限り複数体の森羅万象神を召喚できる。

### 3.2 融合素材

- 素材は、盤面色とマーカー所有者が一致する `FIRE`、`WATER`、`GRASS`、`LIGHTNING` を各1体とする。
- 素材4体の盤上位置や相互の隣接は問わない。
- 各種類が複数ある場合は `createdSeq`、canonical marker配列順、`markerId` の順で最も古い個体を1体ずつ選ぶ。
- 素材の融合消費は自発的な召喚処理であり、完全保護、凍結、破壊回避、復活、生きる意志、救済神では止めない。
- 融合消費は見た目上は石の破壊として見せるが、通常破壊の再発動連鎖や「直前に破壊された石」の復活対象にはしない。実装上は通常の `destroyAt` と区別した明示的な `fusion_consume` とする。

この区別を設ける理由は、通常破壊へ流すと素材に付いた復活・回避・救済によって4体の消費と2×2召喚を原子的に確定できず、同じ状態から異なる結果や融合の再発火が生じるためである。

### 3.3 融合判定の時点

- 4種類をそろえたcanonicalアクションが完全に解決した直後に判定する。
- 4体目を通常配置または生成した場合、その石の既存の配置時即時効果を先に完了し、その後で融合する。
- ターン開始中の復活などで条件がそろった場合は、その特殊石の処理枠を完了してから融合し、次の特殊石処理へ進む。
- 融合で新しく生まれた森羅万象神は、その同じターン開始処理では発動しない。
- プレイヤー入力、次のカード効果、次の特殊石処理枠へ進む前に融合演出まで直列に解決する。

### 3.4 出現場所

現在の盤面トポロジーから、次の4セルがすべて存在する2×2候補を列挙する。

```text
(row, col)       (row, col + 1)
(row + 1, col)   (row + 1, col + 1)
```

候補条件は次のとおり。

- 4セルすべてが現在の盤面に存在する有効セルで、voidまたは穴ではない
- 封鎖・凍結によって進入不能なセルを含まない
- 不可侵の顕現石、完全保護中の石、既存の森羅万象神を含まない
- 融合素材4体は先に消費される前提で空きとして評価する
- 種、毒、灼熱、治癒など、石の進入自体を禁止しないセル状態は候補を妨げない

候補anchorは必ずrow昇順、同rowではcol昇順へcanonical sortする。各候補の「素材消費後の空きセル数」を0〜4で数え、最大値の候補だけを残す。最大値の候補が複数ならauthority PRNGでランダムに1つ選ぶ。1候補しかない場合は不要な乱数を消費しない。

選ばれた2×2に通常石または通常の特殊石が残る場合は、所有者を問わず召喚場所確保として除去する。この除去は `summon_clear` として次の専用契約を持つ。

- 見た目は既存の石破壊演出を使う
- 完全保護・不可侵・凍結中の石は候補段階で除外されるため除去しない
- 候補として許可された石は、破壊回避、増殖、復活、生きる意志、救済神を発動させず確実に除去する
- 石に付随する状態は除去するが、毒・灼熱・治癒などのセル状態は残す
- 種マスは森羅万象神の出現時に通常の石進入と同じく消費する
- 通常破壊履歴や破壊数には加算しない

有効な2×2候補が1つもない場合は、素材を消費せず融合を保留する。以後のcanonicalアクション解決後に再判定し、候補ができた最初の時点で自動融合する。候補不足では乱数を消費しない。

### 3.5 完全保護と多マス石の一体性

- 森羅万象神は永続の特殊石本体で、4セルすべてが生得的な完全保護を持つ。
- 反転、通常破壊、誘惑、捕獲、意志の喪失、腐食、移動、位置入替など、既存の完全保護が防ぐ効果は4セルのどこを指しても成立しない。
- 1セル石を前提にする複製、テレポート、生きる意志、延命、状態付与などの選択対象にも含めない。これは防御の追加強化ではなく、2×2の1個体を1セルだけ複製・移動・復元して壊さないための多マス石制約である。
- 4セルのどれかを起点または終端とする反転経路では、そのセルの所有者色を通常どおり使う。敵側から見た4セルは完全保護石として反転経路を遮断する。
- `凍結の意志`でfootprintの1セルだけが凍結された場合でも、能力主体を部分発動させず、いずれか1セルが凍結中なら森羅万象神全体のターン開始4属性効果を停止する。単セル凍結markerは選択されたセルだけに置く。
- `意志の凍結`は森羅万象神を特殊石1体として1回列挙し、4つのfootprintセルすべてへ同じ5ターンの凍結markerを置く。完全保護はこの凍結を防がない。
- 因果抹消、盤面縮小など、既存仕様で完全保護を貫通するセル消滅は森羅万象神にも成立する。
- セル対象の消滅が4セルの一部へ成立した場合、森羅万象神は`group_dissolve`で1体として消滅し、効果が明示的に穴化したセルだけが穴になる。残りの占有セルは空きマスになる。追加で消えるセルは通常破壊履歴、破壊数、布石獲得、救済、復活、回避の対象にせず、group消滅演出と音はmarker IDごとに1回だけ出す。
- 複数セルを同時に消滅させるbatchは対象穴セルをすべて確定してからmarker IDでgroupを重複排除し、同じ森羅万象神を2回解体しない。
- 盤界の執行者のように特殊石本体そのものを絶対執行する効果では、森羅万象神の4セル全体を対象領域として扱う。

## 4. 現在の構造とリポジトリ根拠

- `gameState` の盤面と `shared/board/` のBoardViewは、各セルの所有者をcanonical authorityとして合法手、反転、石数、盤面形状を計算する。
- `cardState.markers` は特殊石個体、`markerId`、`createdSeq`、所有者、持続情報を保持する。
- `game/turn/turn-start/marker-phase.ts` はターン開始対象を開始時点で固定し、`createdSeq`順に1個ずつ処理する。
- `game/turn/turn-start/special-stone-phase.ts` は火・水・草・雷の各アンカーを個体単位で既存効果へ委譲する。
- 火・水・草・雷の現行モジュールは、1回分の属性効果とアンカー寿命減算を同じ関数で行うため、永続神から安全に再利用するには「1回分の効果」と「元アンカーの寿命」を分離する必要がある。
- `shared/special-stone-registry.ts` は反転保護、破壊保護、対象可否、所有権変更時の扱いを集約する。
- `game/logic/board_ops.ts` は石生成、破壊、反転、移動、穴化とordered presentation eventを所有する。
- `ui/board-visual/controller.ts` とactive `BoardVisualBackend` がSingle Visual Writerであり、PixiとDOM互換は同時に盤面を書かない。
- 現在の `BoardRenderModel` とPixi stone viewは1セル1石を前提にするため、2×2の合成石を明示的なrender-model要素として追加する必要がある。
- Worker、ローカルサーバー、browser、headlessはroot実装を共有し、Worker用 `worker-public/` は生成mirrorである。

## 5. 検討した設計案

### 案A: 盤面配列へ2×2石という新しいセル値を追加する

反転、合法手、石数、CPU入力、BoardView、snapshot、学習入力の全てが新セル値を理解する必要がある。ユーザーが求める「バックエンドは4マスに同色石があるイメージ」とも異なるため採用しない。

### 案B: 4セルへ同じ特殊石マーカーを4個置く

既存のセル単位保護は流用しやすいが、ターン開始効果が4回発動し、特殊石数も4体になり、誘惑・捕獲・期限・複製で4個体が分離しやすい。共有group IDを後付けしても各consumerの重複除去が必要になるため採用しない。

### 案C: 盤面は同色石4個、特殊石は1個の2×2グループマーカーにする

反転・合法手・得点は既存BoardViewをそのまま使い、特殊石個体数、ターン開始順、保護、表示は1個体として扱える。追加変更は多マス占有を理解する共通marker lookupとrender modelへ集中できるため採用する。

## 6. Canonicalデータ設計

### 6.1 グループマーカー

森羅万象神は `kind: specialStone` のmarkerを1個だけ持つ。

```ts
{
  markerId: "canonical string id",
  id: 123,
  kind: "specialStone",
  row: 4,
  col: 2,
  owner: "black",
  createdSeq: 456,
  data: {
    type: "SHINRA_BANSHO_GOD",
    footprint: "square_2x2.v1"
  }
}
```

- `row` / `col` は2×2の左上アンカー。
- footprintセルはmarkerへ4座標を重複保存せず、`square_2x2.v1` とアンカーからcanonical順で導出する。
- 各セルには既存どおり個別のstone IDを付ける。4セルで同じstone IDを共有しない。
- markerは持続ターンを持たず、`createdSeq`は召喚成立時に1回だけ採番する。
- markerと4セルの所有者不一致、穴・voidとの重複、footprint欠損は正規状態として受理しない。

### 6.2 共通footprint helper

`shared/multi-cell-stone.ts` を純粋な共通契約として追加し、次を一元化する。

- marker種別の判定
- anchorからのcanonical 2×2座標導出
- markerが指定セルを占有するかの判定
- 盤面トポロジーと所有者に対するinvariant検証
- marker配列からセル→多マス個体のindex構築
- presentation/network向けの安全なfootprint DTO生成

`game/`、UI、snapshot/hash、テストが独自に2×2座標を再構築しない。

### 6.3 marker lookupと保護

`game/logic/cards/markers.ts` のcell indexは、森羅万象神markerを4セルすべてに同じmarker参照としてindexする。一方、`specialMarkers`の個体一覧には1回だけ残す。

保護・対象判定・石情報取得は「markerのanchor座標一致」ではなく共通の占有判定を使う。レジストリ上の `SHINRA_BANSHO_GOD` は次を持つ。

- `flipProtected: true`
- `destroyProtected: true`
- 特殊石本体として数える
- 誘惑・捕獲・意志の喪失・意志狩り・延命・理論の化身生成の対象外
- 所有権変更は通常経路では成立しない
- カードへの逆変換定義を持たない

## 7. 融合と召喚の制御フロー

`game/special-effects/shinra-bansho-god.ts` をheadlessな正本とし、次の2入口を持たせる。

1. `resolveElementalFusionAfterAction(...)`
2. `processShinraBanshoGodAtTurnStartAnchor(...)`

融合解決は次の順で1つの `BoardOps.runEffectBlock()` 内に収める。

1. 黒・白ごとに成立する素材セットを検出する
2. 成立セットを、4体目に相当する最大`createdSeq`の昇順、4素材の安定marker順、所有者順（黒→白）で決定的に並べる
3. 現在状態から出現候補を列挙し、最大空き数tierからauthority PRNGで1候補を選ぶ
4. 候補がなければそのセットを変更せず終了する
5. 素材4体を `fusion_consume` で除去する
6. 選択footprint上の残存石をrow-major順で `summon_clear` 除去する
7. 4セルへ同色石と個別stone IDを原子的に生成する
8. 1個の `SHINRA_BANSHO_GOD` markerを追加する
9. 融合開始、素材消費、場所確保、2×2召喚が分かるordered eventsを確定する
10. 残り素材で次のセットが成立する場合は、更新後盤面から再計算する

盤面・marker・stone ID・presentation eventの途中状態を成功扱いにしない。候補選択後のcanonical書込みは、BoardViewのmutation checkpointを使った全成功または全復元のtransactionにする。

融合判定はBoardOpsの全操作へ暗黙に埋め込まない。ターン層の明示的なsettlement hookとして次へ接続する。

- 通常配置と配置時即時効果の完了後
- 対象選択型・即時型カード効果の完了後
- 生成、複製、誘惑、復活などを含む配置後処理の完了後
- ターン開始before-anchor処理と、その復活flushの完了後
- 各ターン開始anchor本体と、そのanchorが生じさせた復活flushの完了後
- 全turn-start anchor後の生成石反転・復活flushの完了後
- 理論の化身による配置後生成と、その生成石の即時効果・復活flushの完了後
- pending selection完了、追加配置の各sub-placement完了、手番引継ぎ前の最終盤面settlement

各入口は同じidempotentなfusion closureを呼ぶ。ターン開始marker snapshotは開始時点で固定したままにし、同じ開始処理中に生まれた森羅万象神をその回の発動対象へ加えない。

これによりBoardOpsを特定特殊石のルールauthorityにせず、アクション途中の半完成状態でも融合しない。

## 8. ターン開始の4属性効果

火・水・草・雷の各モジュールから、次の責務を分離して公開する。

- 1回分の対象候補作成
- 必要な場合だけauthority PRNGを1回消費する選択
- 1回分のcanonical効果とpresentation metadata生成
- 元の属性石markerの寿命減算・通常石化

既存属性石は「1回分の効果→寿命減算」を従来どおり組み合わせる。森羅万象神は寿命処理を呼ばず、同じ1回分の効果だけを次の順で呼ぶ。

```text
fire pulse
  → water pulse
    → grass pulse
      → lightning pulse
```

各pulseは直前の結果を反映した盤面から対象を決める。例えば火が作った灼熱マスを同じターンの水が上書きし得る。草は火・水処理後の有効空きマスを使い、雷は3効果後の敵石集合を使う。既存4属性石は候補が1つでも1回PRNGを消費するため、共有pulseでもこのcall countを変えない。候補0だけは消費しない。候補1で乱数を省略するのは新規の2×2出現先選択だけである。

4pulseは森羅万象神1体のターン開始処理枠に属するが、presentation上は4つの直列sub-phaseとする。火のビームと灼熱成立、水のビームと治癒成立、草のビームと種成立、雷の演出と破壊結果をそれぞれsettleしてから次へ進む。4pulseすべてが終わるまで、後続の別特殊石は開始しない。

発射元metadataにはgroup marker IDとfootprintを含める。論理アンカーは左上セルのboard coordinateを維持し、active backendは同じmarker IDの2×2visual centerを軌道の見た目上の始点にする。UIが独自に乱数や対象を決めない。

## 9. 盤面ルールと他効果

### 9.1 反転・合法手・得点

- BoardViewでは4セルとも通常の黒または白owner値を持つ。
- 所有者側の石として、各セルは挟み反転の終端になれる。
- 相手側からは4セルすべてが完全保護座標となり、敵石列の途中にあれば反転経路を遮断する。
- 通常配置候補、空きマス候補、盤面石数、勝敗得点では4セルを占有済みとして扱う。

### 9.2 単体対象

- 完全保護または多マス一体性により成立し得ない複製、移動、交換、誘惑、捕獲、喪失、延命などは、盤面入力とCPU target resolverの選択候補へ出さない。
- 石情報表示のための読取はどのセルからでも同じgroup markerへ解決してよい。
- 特殊石数条件ではgroup marker 1個として数える。
- ランダムな敵石を列挙する効果は、元効果の候補規則を変えない。雷の意志のように盤面ownerセルを列挙してから通常破壊を試みる効果では4セルがそれぞれ候補になり、選ばれた1セルへの破壊試行を完全保護が防ぎ、再抽選しない。元から完全保護石を候補外にする効果だけは候補外とする。

### 9.3 セル状態とセル消滅

- 毒・灼熱・治癒などのcell markerは各footprintセルの下に残り得る。
- footprintのいずれか1セルに有効な凍結markerがあれば、森羅万象神全体を凍結中として扱い、そのターン開始4pulseをすべてスキップする。開始時点の凍結snapshotで判定し、同じ開始処理中の期限変化で部分発動しない。
- 森羅万象神は持続ターンを持たないため治癒による`+3`対象外。
- 完全保護により毒付与・通常破壊は防ぐ。灼熱接触は既存完全保護ルールどおりカウントしても、破壊試行は防がれ、状態を解除する。
- topology変更で一部セルが失われた場合はgroup markerと全4石を原子的に除去する。

## 10. 表示設計

### 10.1 Render model

`BoardRenderModel` に、1セル石とは別に読み取り専用の `compositeStones` を追加する。

```ts
{
  id: markerId,
  owner: "black",
  specialType: "SHINRA_BANSHO_GOD",
  anchor: { row, col },
  cells: [topLeft, topRight, bottomLeft, bottomRight],
  span: { rows: 2, cols: 2 }
}
```

各 `cells[].stone` は盤面意味上のownerを保持し、同じcomposite IDとroleを参照する。これによりアクセシビリティ、入力、石数、セルgeometryは4セルのまま維持し、描画だけを1体へ合成できる。

compositeはanchorセル単独ではなくfootprintとmaterialization領域の交差で生成する。anchorがviewport外でも残り3セルのどれかが表示領域に入る場合は、同じmarker IDの大型石を1個だけ描画する。

### 10.2 Pixi

- 既存の単一Pixi application、stone layer、timeline、resource lifecycle内にcomposite stone viewを追加する。
- anchor以外の3セルの通常stone viewを非表示にし、2×2の外接矩形へ黒白別の大型画像を1枚描画する。
- 画像は `assets/images/special-stones/SHINRA_BANSHO_GOD-black.png` と `SHINRA_BANSHO_GOD-white.png` を正本とする。
- 完全保護表示は4個のバッジではなく、composite全体へ1つの保護表現を付ける。
- viewport外や部分表示でも、既存materializationとeffect gutterの範囲内だけ描画し、2つ目のcanvasや別tickerを作らない。

### 10.3 DOM互換

- DOM backendが排他的に選択された時だけ、2×2セルをまたぐ専用overlayを1個生成する。
- 4セルのsemantic要素とowner情報は維持し、見た目の4個のdiscだけを抑止する。
- Pixi通常経路からDOM互換moduleをimport・評価しない。

### 10.4 Playback

融合演出は次の順にする。

1. 素材4石をcanonical順で消す
2. 出現footprint上の占有石があれば場所確保として消す
3. 2×2の中央へ大型石を1体として出現させる

canonical盤面更新用には4セル分のspawn情報を保持するが、音と大型石の出現演出は1体分だけ再生する。全イベントへ同じgroup marker ID、footprint、effect block IDを付け、Pixi/DOMが別々のgroup推測をしない。

4属性のboard-source trajectoryは2×2のvisual centerから発射する。既存のtarget gate、strict network settlement、NOANIM、reduced motionを維持する。

### 10.5 石情報

- 名称: `森羅万象神`
- 短い説明: `火・水・草・雷の意志が融合した2×2の永続特殊石。自ターン開始時に4属性効果を順番に発動する。`
- タグ: `特殊石`、`永続`、`4マス占有`、`完全保護`
- `assets/images/special-cards/backgrounds/shinra_bansho_god_background.png` はカード定義やデッキへ登録せず、森羅万象神の石情報詳細パネル専用背景として使う。1024×1536の不透明画像をパネル内でcover表示し、本文可読性のため既存パネル色の半透明scrimを重ねる。
- 盤上の石一覧では4セルを4体と数えず、group marker IDで1体に集約する。

## 11. Authority・ネットワーク・CPU

- 融合条件、素材選択、footprint選択、4属性のランダム対象はauthority PRNGだけが決める。
- `prngState`、4セルowner、1個のgroup markerをcanonical snapshotへ保存する。
- footprintは安定した文字列種別とanchorから再構築し、snapshot hash、projection、再接続で順序差を作らない。
- 新しいネットワークcommandは追加しない。既存のカード使用、配置、ターン開始commandの結果に自動融合を含める。
- Workerとローカルサーバーは同じroot resolverをpreloadして使い、runtime別実装を持たない。
- CPU、AUTO、selfplay、headlessも同じsettlement hookを通る。盤面評価では4石、特殊石評価では1個体として扱う。
- 標準8×8の学習入力契約はowner値4セルのままであり、新しいセル値やaction spaceは追加しない。

## 12. 互換性と失敗時動作

- 既存snapshotに新markerがなければ挙動は変わらない。
- 新markerを含むsnapshotは、対応browser/Workerを同じ配布単位で更新する。旧client向けの部分描画fallbackは作らない。
- markerがあるのに4セルの一部が欠ける、ownerが異なる、footprintが穴・voidを含む場合は、通常石4個へ黙って降格せずcanonical validationを失敗させる。
- 必須のBoardView、BoardOps transaction、authority PRNG、属性pulse APIが欠ける場合は成功形へfallbackせず明示的に失敗させる。
- 出現候補がない場合だけは仕様上の保留であり、状態を変更せず正常終了する。
- presentation failureはcanonical結果を変更しない。strict network playbackは既存どおりcommitted frame適用まで入力と結果表示を解放しない。

## 13. 仕様・文書・生成物への影響

実装時に次を更新する。

- `01-rulebook.md`: 特殊石分類、完全保護例外、融合条件、2×2占有、出現候補、ターン開始順、他効果との関係
- `正本/共通ルール正本.md`: 多マス特殊石、1個体/4石の数え分け、保護とセル消滅
- `正本/ターン進行正本.md`: アクション後の自動融合、4属性sub-phase、他特殊石との直列順
- `正本/カード仕様正本.md`: 4属性カードが素材になること。ただしカード効果自体は変更しない
- `正本/演出正本.md`: 素材消費、場所確保、大型石出現、4属性発射元
- `docs/architecture-contracts.md`: canonical multi-cell marker、composite render model、board-source trajectoryのcomposite source geometry
- browser module registry、bundle/cachebuster、asset manifest
- Worker bundleと`worker-public/` mirror
- 黒石・白石の透過128×128画像と、カード登録しない石情報背景1024×1536画像

`cards/catalog.json` と `CardType` は変更しない。

## 14. 検証戦略

### 14.1 Headless・ルール

- 同色4種類で融合し、混色・不足・board owner不一致では融合しない
- 複数候補では空きセル数が最大のtierだけから選ぶ
- 同点候補のauthority乱数、1候補時と候補0時の乱数非消費
- 素材がfootprint内にある場合は空きとして評価する
- 普通石で盤面が埋まっていても場所確保後に召喚できる
- 穴、circle void、拡張セル、封鎖、凍結、不可侵、完全保護、既存神を含む候補の除外
- 候補0では素材を残し、後の盤面変化で自動召喚する
- 各種類が複数ある場合の最古素材選択と複数召喚
- 融合消費と場所確保が破壊回避・復活・救済・破壊履歴を発火しない
- 4セルが合法手、反転終端、反転遮断、石数、得点へ正しく反映される
- 特殊石数は1、盤面石数は4
- 4セルすべてで完全保護が成立する
- 単セル凍結ではgroup全体の4pulseが止まり、意志の凍結では4セルすべてが同時に凍結される
- 雷の意志がfootprintセルを選んだ場合は通常破壊が防がれ、再抽選せず、元の雷の意志の候補規則を変えない
- セル消滅時にgroup全体が消え、対象セルだけが効果どおり穴になる
- セル消滅batchで同じgroupを重複解体せず、追加3セルを通常破壊履歴・復活・救済へ入れない
- 単セル移動、交換、複製、誘惑、捕獲、喪失、延命の対象外

### 14.2 ターン開始

- 火→水→草→雷の厳密な順序
- 各pulseが直前pulse後の盤面を参照する
- 候補なしの属性だけ不発となり、後続属性は続行する
- 森羅万象神は寿命減算せず永続する
- 同じ開始中に召喚された神は発動しない
- 1体の4pulseが完了してから次の`createdSeq`特殊石へ進む
- network/local/headlessでPRNG消費数と結果が一致する
- 4属性pulseは候補1でも既存どおりPRNGを1回消費し、2×2出現先だけは候補1で消費しない

### 14.3 表示・playback

- render modelに4 semantic cellsと1 compositeが存在する
- Pixiの大型spriteは1個、通常facet stoneは0個表示
- DOM互換もoverlay 1個で、Pixiと同時にmountしない
- 融合の素材消費→場所確保→大型出現の順
- 4属性軌道が2×2の中心から始まり、各target settlement後に次へ進む
- NOANIM、reduced motion、viewport clip、白視点180度、拡張盤面
- anchorだけがviewport外で他のfootprintセルが表示中でもcomposite 1体と軌道始点が得られる
- 石情報一覧が1体表示となり、4セルから同じ詳細へ解決する
- 石情報詳細だけが専用カード背景を使い、カード一覧・デッキ・CardTypeへ混入しない
- strict network playbackとcommitted frameが2×2の途中状態を露出しない

### 14.4 検証コマンド

実装時はfocused Jestの後、少なくとも次を実行する。

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
```

最小の実機ブラウザ確認では、空き2×2への召喚、占有石を消しての召喚、4属性の直列発動、白視点、ネット再生を確認する。

## 15. リスクと緩和

- 4セルを4個体として扱うconsumerが残る: 共通footprint indexを先に導入し、座標直比較のfocused auditを行う。
- 盤面は4石、特殊石は1体という数え分けが混ざる: BoardViewのowner countとmarker registryの個体countを明示的に分離する。
- 4体目の配置時効果と融合順がずれる: settlement hookを配置時即時効果の後に固定し、順序テストを置く。
- 候補選択が矩形8×8前提になる: shared BoardViewの`playableKeys`だけから2×2を列挙する。
- 途中失敗で素材だけ消える: mutation checkpointとpresentation queue checkpointを同じtransactionで復元する。
- groupの一部だけ移動・破壊・反転される: 4セルすべてをregistry保護へ投影し、セル消滅だけをgroup-awareな原子的解体へ通す。
- 大型spriteが2つ目の盤面writerになる: active backendの既存stone layerとtimeline内だけで描画する。
- 4属性ロジックがコピーされて将来ずれる: 各属性の1pulse APIを元属性石と神から共有し、神側に効果本体を複製しない。
- 既存4属性石のPRNG列がずれる: pulse分離後も候補1で1回消費する現行call countを回帰テストで固定する。
- 多マス石の一部だけが凍結される: any-footprint freezeでgroup全体を停止し、意志の凍結だけは4セルへ同時投影する。
- セル消滅batchで4石が重複会計される: `group_dissolve`をmarker IDでdedupeし、元効果の穴セルと追加解体セルを分離する。
- snapshotに壊れたfootprintが入る: authority ingressとcomplete snapshot検証でfail closedにする。
- 通常破壊と召喚除去の意味が混ざる: `fusion_consume` / `summon_clear` をtyped reasonとして限定し、通常破壊履歴・復活処理へ入れない。

## 16. 完了条件

1. 同色の火石・水石・草石・落雷石がそろったアクションの完了後、操作不要で森羅万象神が召喚される。
2. 出現先は有効な2×2候補のうち空きセル数が最大のtierからランダムに決まり、必要なら敵味方を問わず場所を確保する。
3. backend上は同色ownerの4セルで、反転、合法手、石数、得点が既存BoardViewと一致する。
4. 特殊石としては1体で、永続・完全保護・単セル操作不可が4セル全体へ成立する。
5. 所有者ターン開始時に火→水→草→雷の4効果が1つずつ直列に発動する。
6. PixiとDOM互換の双方で2×2の大型石1体として表示され、同時writerや第2canvasを作らない。
7. browser、headless、CPU、selfplay、ローカルauthority、Worker、再接続snapshotで同じ状態・PRNG・event順になる。
8. 仕様正本、architecture contract、asset、生成物、Worker mirrorが同期し、focused/parity/build/browser検証が通る。

## 17. Self-review

- 初案の「4セルへ同じmarkerを4個置く」方式は、ターン開始4重発火と特殊石数4体化を招くため、4ownerセル＋1group markerへ変更した。
- 素材消費と場所確保を通常破壊へ流す案は、復活・回避・救済で2×2が確保できず中間状態が残るため、typedな融合専用除去へ分離した。ただし完全保護・不可侵・凍結中の占有石は出現候補から除外し、既存防御を無断で貫通しない。
- 「ランダムだが空きが多い場所」を重み付き抽選にすると空きの少ない場所も選ばれるため、最大空き数tierを先に選び、そのtier内だけをランダムにした。
- 4体目が持つ配置時効果を失わせないため、融合判定をmarker成立直後ではなく、そのcanonicalアクションの即時効果完了後に置いた。
- 1個体が4マスを占めるため、セル消滅時の部分残存を許さずgroup全体を解体する一方、穴化範囲は元効果の対象セルだけに限定した。
- 完全保護だけでは友好的な複製・延命などが対象になり得るため、2×2一体性を守る「単セル操作不可」を別制約として明記した。
- 盤面source trajectoryの始点を左上セル中心にすると見た目がずれるため、論理anchorは維持しつつactive backendがcomposite centerを解決する契約を追加した。
- 独立レビューで既存4属性pulseの候補1 PRNG消費、凍結、セル消滅会計、settlement hook、candidate sort、partial viewport、追加カード背景の不足を確認し、本節を含む設計へ反映した。
