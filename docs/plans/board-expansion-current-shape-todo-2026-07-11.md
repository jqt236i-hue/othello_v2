# 盤面拡張・盤面拡張神 current shape 対応 TODO

**作成日**: 2026-07-11
**対象**: `盤面拡張`, `盤面拡張神`, playable shape, 穴マス由来の疑似辺・疑似角
**状態**: 完了・後継化（2026-07-26）
**実装単位**: Phase 1（現在のベース盤面＋外周1マス範囲内での汎用化）

---

> **後継文書:** この本文は2026-07-11時点のPhase 1実装記録である。現在の契約は
> `docs/implementation/board-kernel-hardening-design.md`、
> `docs/implementation/board-kernel-hardening-plan.md`、
> `docs/architecture-contracts.md` §6.1.1を参照すること。
> 本文中の `attachBoardShape`、`shape-metadata.ts`、外周1マス制限は現行実装ではなく、
> 現在は明示的な `BoardContext` / `BoardView` と段階的な多重拡張を使用する。

## 0. この文書の位置づけ

- この文書は完了済み Phase 1 の歴史記録であり、現行実装手順ではない。現在の `BoardContext` / `BoardView` / `BoardSearchContext` 契約と実装手順は、冒頭の後継文書に従う。
- プレイヤー向け仕様の一次情報は `01-rulebook.md`、カード挙動の正本は `正本/カード仕様正本.md`、内部境界は `docs/architecture-contracts.md` である。
- この文書自体はゲーム仕様の正本ではない。実装開始時は最初に一次仕様と正本を更新し、それからコードを変更する。
- headless / browser / local network server / Worker で同じ候補・同じ追加座標を得ることを完了条件とする。
- `worker-public/` と `public/module-registry.js` は生成物であり、直接編集しない。

## 1. 目的

- `盤面拡張` の候補を「ベース盤面の左右端」から「現在の playable shape の拡張可能な外周」へ広げる。
- `盤面拡張神` の候補を「ベース盤面の4角」から「現在の playable shape の拡張可能な角」へ広げる。
- 既存の拡張セルや外周の穴化によって盤形状が変化した場合も、現在形状から疑似辺・疑似角を再計算する。
- 盤面中央に閉じた穴を盤面外と誤認せず、内側へ増殖する候補を作らない。
- 人間、CPU、ネット対戦で同じ候補記述子を利用し、クライアント独自の方向推測を廃止する。

## 2. Phase 1 の確定方針

### 2.1 playable shape

- 現在の playable shape は、通常盤セルと生成済み拡張セルから、`METEOR_HOLE` を除いた座標集合として扱う。
- 候補生成には `SharedBoardUtils.attachBoardShape()` で付与される shape metadata を利用し、カード側で別の盤形状表現を作らない。
- 封鎖・凍結・種・石の有無はセルの存在を失わせない。穴マスだけが playable shape から除外される。

### 2.2 外部空間と内部穴の区別

- playable shape の外側を囲う探索枠から flood fill を行い、外部へ連結した非 playable 座標を「外部空間」として分類する。
- 盤面中央に閉じた欠け・穴の周囲は外部空間に含めず、拡張候補にしない。
- 外周に達した穴化によって外形が折れた場合は疑似辺・疑似角の判定材料に含める。
- `METEOR_HOLE` の座標自体は拡張追加先にしない。穴マスの通常マス化は引き続き `因果再生` が担当する。
- 疑似辺・疑似角であっても、予定追加座標が穴マス、既存セル、既存拡張セル、または Phase 1 の許可座標範囲外に重なる候補は不成立とする。

### 2.3 盤面拡張

- 現在の playable shape の外周セルから、直交隣接する外部空間へ1マス追加できる向きを候補にする。
- 同じ基準マスから複数方向へ拡張可能な場合は、方向ごとに別候補として扱う。
- 追加先は必ず1マスで、既存セルや穴マスを上書きしない。

### 2.4 盤面拡張神

- 現在の playable shape の角から、外向きの直交2方向と斜め方向で構成される3マスがすべて追加可能な向きを候補にする。
- 1つの基準マスに複数の外向き象限が成立する場合は、象限ごとに別候補として扱う。
- 1角につき追加するセルは従来どおり3マスとし、穴との重なりを避けるために2マス以下へ減らさない。
- 最大2候補を選ぶ pending フロー、候補が1つなら1回で確定する挙動、同時に追加する3〜6マスという既存契約を維持する。

### 2.5 座標範囲

- Phase 1 は現在の `baseBounds` と `outerBounds`（外周1マス）を維持する。
- 外周1マスより外へ再帰的に何段も拡張する機能は非目標とする。
- 将来の多段拡張では、固定 `outerBounds`、盤面表記、レンダリング領域、スナップショット互換性を別計画で拡張する。

## 3. 非目標

- `因果再生` を使わずに穴マスを通常マスへ戻すこと。
- 盤面中央の閉じた穴を起点に拡張すること。
- `盤面縮小` / `盤面縮小神` の選択・穴化仕様を変更すること。
- 外周1マスを超える無制限または多段の盤面拡張。
- カードコスト、使用回数、カード分類、効果音、追加時フェードの変更。
- UI、CPU、Workerごとに候補生成ロジックを複製すること。

## 4. 現状調査の根拠

| 現状 | 根拠 |
| --- | --- |
| `盤面拡張` はベース盤面の左端・右端を行ごとに列挙する | `game/logic/cards/selectors.ts` の `getBoardExpansionTargets()` |
| `盤面拡張神` はベース盤面4角と追加3座標を固定生成する | `game/logic/cards/selectors.ts` の `getBoardExpansionGodCornerDescriptors()` |
| apply側にも4角の追加座標生成が別実装されている | `game/logic/cards/expansion.ts` の `getBoardExpansionGodCornerDescriptorsForCard()` |
| `盤面縮小神` は shape-aware board から角・辺を動的取得する | `getShapeAwareBoard()` と `SharedBoardUtils.getCornerEdgeLineDescriptors()` |
| shape metadata は通常セル＋拡張セル－穴マスの `playableKeys` を持つ | `shared/board/shape-metadata.ts` |
| 現在の拡張座標は `outerBounds` 内のベース盤面外セルに限定される | `shared/board/expansion-descriptors.ts` |
| 拡張矢印は `盤面拡張神` の方向をベース盤面の行列端から再推測する | `shared/board-hint-projection.ts` の `resolveBoardExpansionGodDirection()` |

## 5. 追加する共通契約

### 5.1 Expansion socket

`shared/board/` に純粋な候補生成 helper を追加し、概念上は次の記述子を返す。

```ts
interface BoardExpansionSocket {
  anchor: { row: number; col: number };
  direction: { row: -1 | 0 | 1; col: -1 | 0 | 1 };
  directionKey: 'up' | 'down' | 'left' | 'right'
    | 'up-left' | 'up-right' | 'down-left' | 'down-right';
  additions: Array<{ row: number; col: number }>;
}
```

- `盤面拡張` は `additions.length === 1` の edge socket を使う。
- `盤面拡張神` は `additions.length === 3` の corner socket を使う。
- 候補の一意キーは `anchor row/col + directionKey` とする。`row/col` だけでは同一基準マスの複数方向を区別できない。
- 候補列挙順は座標と方向の固定順で安定化し、CPU選択・ネットワーク・テストで決定的にする。
- helper は DOM、音、タイマー、ネットワーク、グローバルUI状態を参照しない。

### 5.2 authority と pending

- canonical target validation と apply は同じ socket generator を呼ぶ。
- apply時は、選択時にクライアントが送った `additions` を信用せず、authority側で socketを再生成して一致する候補だけを採用する。
- pending target は少なくとも `row`, `col`, `directionKey` を保持する。必要なら後方互換のため `side` も投影する。
- `pendingEffectId`、選択回数、1候補時の即時確定、2候補時の重複禁止を維持する。
- Worker/local/browser/headlessで同一 helper を使用し、ネットワークスナップショットを最終権威とする（`docs/architecture-contracts.md` §5, §6.3, §8）。

## 6. 実装 TODO

### Phase 0: 仕様を先に確定

- [x] `01-rulebook.md` の `盤面拡張` を、左右端固定から current playable shape の外周＋方向選択へ更新する。
- [x] `01-rulebook.md` の `盤面拡張神` を、ベース盤面4角固定から current playable shape の拡張可能な角へ更新する。
- [x] 外部連結した外周穴、閉じた内部穴、穴座標への上書き禁止、外周1マス制限を明記する。
- [x] `正本/カード仕様正本.md` の2カードを同じプレイヤー向け意図へ更新する。
- [x] カード面の短文変更が必要か確認し、必要なら `cards/catalog.json` を更新する。

### Phase 1: 共通形状 helper

- [x] `shared/board/` に exterior classification と expansion socket generator を追加する。
- [x] `shared/shared-board-utils.ts` から純粋APIとして公開する。
- [x] 既存 `shape-metadata.ts` の `playableKeys` / `meteorHoleKeys` / `expansionCells` を入力として再利用する。
- [x] Phase 1 の探索枠を `outerBounds` に固定し、範囲外候補を明示的に除外する。
- [x] 外部空間と内部穴、凸角と凹角、同一anchorの複数方向をfixtureで固定する。

### Phase 2: headless selector / apply の一本化

- [x] `getBoardExpansionTargets()` をedge socket projectionへ置き換える。
- [x] `getBoardExpansionGodTargets()` をcorner socket projectionへ置き換える。
- [x] `game/logic/cards/selectors.ts` と `game/logic/cards/expansion.ts` に重複する固定角descriptorを削除し、共通helperへ委譲する。
- [x] `getBoardExpansionGodAdditionsForCard()` を `row/col/directionKey` でauthority再解決する。
- [x] `applyBoardExpansionWill()` / `applyBoardExpansionGod()` が選択時と同じsocketを再検証してから追加するようにする。
- [x] 追加予定セル同士の重複、既存拡張、穴、範囲外への明示的な失敗理由を揃える。
- [x] 既存の `events[]`、効果ブロック、ログ、追加時フェード、拡張効果音の順序を維持する。

### Phase 3: pending / UIヒント

- [x] pending selection registry とstate managerで `directionKey` を保持・複製・snapshot化できることを確認する。
- [x] 同じanchorに複数候補がある場合、UIで方向ごとに選択できる入力表現を追加する。
- [x] `shared/board-hint-projection.ts` のベース盤面端による方向再推測を廃止し、canonical targetの `directionKey` を使う。
- [x] 外向き矢印、選択済み紫ハイライト、新規セルfade-inをSingle Visual Writer配下で維持する。
- [x] 盤面縮小系の方向矢印・予定列プレビューに回帰がないことを確認する。

### Phase 4: CPU / selfplay

- [x] CPUが人間と同じ selectable targets / socket identity を取得するようにする。
- [x] `chooseBoardExpansionTarget` とpending action payloadが `directionKey` を失わないようにする。
- [x] 敵角を優先する既存盤面拡張評価が「ベース盤面の角」と「current shapeの疑似角」を混同していないか確認する。
- [x] selfplay chooserのtarget serializationが新しい候補identityに追随することを確認する。
- [x] 長時間selfplayは行わず、focused sampleで決定的に解決できることだけを確認する。

### Phase 5: network authority / parity

- [x] publish actionが `directionKey` を送信でき、schema normalizationで欠落しないことを確認する。
- [x] Worker/local authorityが受信した `additions` を信用せず、canonical socketを再生成するテストを追加する。
- [x] 同じanchorの別方向を別候補として受理し、存在しない方向を拒否することを確認する。
- [x] pending snapshot、reconnect、同一version reconciliation後も選択済み方向が一致することを確認する。
- [x] authorityイベントからpresentation frame、visual settlement、最終snapshotまで追加セル順が一致することを確認する。
- [x] root source完了後にのみWorker mirrorを生成する。

### Phase 6: catalog / browser生成物

- [x] `cards/catalog.json` を変更した場合は `npm run generate:catalog` を実行し、生成差分を確認する。
- [x] browser表示に影響するroot sourceのfocused test通過後、`npm run build:browser` を実行する。
- [x] `public/module-registry.js` とcachebusterが生成スクリプト由来であることを確認する。
- [x] `npm run worker:prepare` で `worker-public/` を同期し、手編集しない。

## 7. 必須テストケース

### 共通geometry

- [x] 通常8x8で従来候補と互換になる。
- [x] `盤面拡張` が上・下を含むcurrent outer edgeを候補にできる。
- [x] 生成済み拡張セルを含むcurrent shapeから候補を再計算する。
- [x] 外周穴で形状が折れた場合に疑似辺・疑似角を検出する。
- [x] ただし予定追加座標が穴なら候補から除外し、穴を復元しない。
- [x] 盤面中央の閉じた穴の周囲には候補を作らない。
- [x] 凹角を外向き凸角として扱わない。
- [x] 同じanchorに複数方向がある場合、候補キーが衝突しない。
- [x] `outerBounds` 外の候補を生成しない。

### カード解決

- [x] `盤面拡張` は選択したsocketの1マスだけを追加する。
- [x] `盤面拡張神` は1候補時3マス、2候補時6マスを同時追加する。
- [x] 2つのsocketの追加予定セルが重複する組み合わせを選べない。
- [x] 選択後に盤形状が変わった古いsocketをauthorityが拒否する。
- [x] 新規拡張セルが配置・反転・移動・周囲参照の対象になる既存契約を維持する。
- [x] `盤面縮小` / `盤面縮小神` / `因果再生` と交互に使用してもshape metadataが陳腐化しない。

### UI / CPU / network

- [x] 矢印がsocketの実際の追加方向と一致する。
- [x] CPUが同じanchorの複数方向を区別して選択・解決できる。
- [x] local/headless/Workerで同じ入力から同じ候補順・追加座標になる。
- [x] ネット対戦の両seatとspectatorで最終盤面が一致する。
- [x] reconnect中のpending選択が同じ `directionKey` で復元される。

## 8. 検証コマンド

実装時はfocused testから開始し、影響範囲に応じて次を実行する。

```powershell
npx jest --runInBand test/game.board-expansion-will.test.ts
npx jest --runInBand test/game.board-shrink-will.test.ts
npx jest --runInBand test/shared.board-hint-projection.test.ts
npx jest --runInBand test/game.pending-coordinator.contract.test.ts
npx jest --runInBand test/workers.match-pending-effect-id.test.ts
npm run typecheck
npm run check:window
npm run test:network:parity
npm run build:browser
npm run worker:prepare
npm run check:worker-mirror
```

- catalog文言を変更した場合はfocused test前に `npm run generate:catalog` を追加する。
- API/SSE自体を変更した場合だけ `npm run match:check` を追加する。
- UI方向選択を変更した場合は、最小の実機またはE2Eシナリオで疑似角・複数方向・ネット同期を確認する。

## 9. 完了条件

- [x] 一次仕様・正本・catalog表示が実装結果と一致している。
- [x] 固定された左右端・4角descriptorがcanonical候補生成から除去されている。
- [x] edge/corner socket generatorが候補判定とapplyの単一ソースになっている。
- [x] 外周穴由来の疑似形状を扱い、内部穴と穴復元を明確に除外できている。
- [x] 人間、CPU、headless、local server、Workerで候補と結果が一致している。
- [x] 矢印・ハイライト・fade・効果音・`events[]` 順序に回帰がない。
- [x] focused tests、typecheck、window境界、network parity、browser build、Worker mirror検証が通る。
- [x] task-owned差分だけを確認し、生成物は生成スクリプト由来である。

## 10. 主なリスクと対策

| リスク | 対策 |
| --- | --- |
| 内部穴を外部と誤認して盤面内側へ拡張する | outside flood fillと内部穴fixtureを共通helperで固定する |
| 穴マスを拡張が上書きして `因果再生` の役割を壊す | `meteorHoleKeys` を追加先除外条件としてauthorityで再検証する |
| 同一anchorの複数方向が `row/col` だけで衝突する | `directionKey` を候補identity・pending・network actionへ通す |
| selectorとapplyで追加座標がずれる | 両方を同じsocket generatorへ委譲する |
| UIがベース盤面寸法から誤った矢印を推測する | canonical targetの方向をhint projectionへ渡す |
| Worker/local/browserで候補順が変わる | 座標＋方向の固定sortとnetwork parity testを追加する |
| Phase 1で多段拡張まで混入して影響が広がる | `outerBounds` 制限を明示し、多段拡張は別計画に分離する |
