# 拡張マスを含む単一盤面カーネルへの統合設計

- Status: approved for implementation
- Date: 2026-07-26
- Scope: 盤面拡張・拡張マスを扱う game / CPU / selfplay / Worker / local server / UI / network snapshot
- Player-visible source of truth: `01-rulebook.md`、`正本/カード仕様正本.md`
- Internal source of truth: `docs/architecture-contracts.md`

## 1. 結論

現在のシリアライズ形式である `gameState.board`、`gameState.boardExpansion.cells`、穴 marker は維持する。ただし、その三つを直接解釈してよい場所を `shared/board/` の盤面カーネルだけに限定する。

盤面カーネルは一つの canonical `BoardView` を生成し、次を同じ座標集合と owner 解決規則から提供する。

- 存在マス、プレイ可能マス、穴、拡張マス、境界、角
- 座標の列挙、読み取り、更新、石数
- 8方向の反転、合法手、空きマス
- canonical な拡張マス順序、盤面 revision、snapshot 検証

各 runtime はこの API を利用し、独自の `board.length`、固定 8x8、1周だけの拡張判定、配列の隠し property、失敗時の簡易 fallback を持たない。新しい逸脱は静的検査で CI 失敗にする。

これは盤面データを二重化する `BoardStateV2` 追加ではない。既存 state を一回で完全置換すると、ゲーム、保存、Worker、学習データ、browser bootstrap を同時に二重書きする期間が生まれ、新しい不整合源になる。既存の一つの transport 表現へ単一カーネルを被せ、consumer を順次同じ API へ移す方が、仕様を変えず根因を除去できる。

## 2. 現状の根本原因

### 2.1 論理盤面と型が一致していない

通常マスは `number[][]`、拡張マスは `boardExpansion.cells`、穴は `cardState.markers` に分散している。一方、多くの関数は `board: number[][]` だけを受け取る。そのため、呼び出し元ごとに「通常盤面へ拡張情報を後付けする」「別に拡張配列も走査する」「拡張を無視する」の三方式が混在する。

### 2.2 配列の隠し metadata が transport を越えない

`shared/board/shape-metadata.ts` は `__sharedBoardShapeMeta` を board 配列へ `Object.defineProperty` している。これは JSON、structured clone、Worker message、network snapshot で失われる。また `boardExpansion.cells` や marker を後から変更しても自動で無効化されず、古い topology と owner を参照できる。

### 2.3 共通 helper があっても fallback が別実装になる

`game/logic/cards/expansion.ts`、`game/logic/board_ops.ts`、`game/logic/cards-internal/expansion-fallback.ts`、`game/logic/cards/selectors-board-shape.ts`、`game/move-generator.ts`、UI adapter には、共通 helper が見つからない場合の局所実装がある。その一部は `-1` と `rows/cols` だけを外周とみなし、反復拡張、負座標、疎な形状、穴を正しく扱えない。

依存関係の欠落を「8x8相当の成功」に変換するため、異常が検知されず runtime ごとに結果が分岐する。

### 2.4 合法手の高速経路が topology を迂回する

`shared/board/legal-moves.ts`、CPU、selfplay は `OthelloCore` があれば先に dense-board 実装へ委譲する。dense 実装は拡張座標を列挙できない。さらに `shared/board/othello-primitives.ts` には列境界へ `board.length` を使う経路があり、長方形盤面でも誤る。

このため「盤面表示は拡張済みだが、CPU・合法手・学習では存在しない」という状態を作れる。

### 2.5 勝敗・hash・snapshot が同じ盤面を見ていない

Worker と local server の rated result は dense board だけを数える経路を持つ。拡張石を含めると勝者が逆転する局面でも、レーティング結果が誤る。

状態 hash は配列順を保持するため、同じ拡張マス集合でも `cells` の並びだけで別状態になる。network 入口は board contract を検証せず、重複座標や不正 owner を runtime まで通せる。

### 2.6 UI が topology と content を別々に再構築する

表示 model は topology を共通 helper から得る一方、owner map を別に構築し、不足値を空として補う経路がある。入力も座標・方向文字列だけを保持し、押下後に snapshot が更新されても、古い frame に対する操作を新しい frame へ適用できる。

## 3. 変更しない仕様

- 「盤面拡張」「盤面拡張神」の対象、追加数、使用回数、演出、説明文
- 現在の盤面外周を基準とする反復拡張
- 拡張マスが通常の配置、反転、8近傍、破壊、特殊石、勝敗へ参加すること
- 円形盤面、穴、盤面縮小との組み合わせ
- `events[]` の順序、turn flow、network server authority
- Pixi を通常 backend、DOM を互換 backend とする Single Visual Writer
- 既存 snapshot を読める後方互換性

今回の変更は既存仕様への実装修復であるため、`01-rulebook.md` と `正本/*.md` は変更しない。

## 4. canonical 盤面カーネル

### 4.1 入力

カーネルの state 入力は次の構造を読む。

```ts
interface BoardStateSource {
  board: unknown[][];
  boardConfig?: unknown;
  boardExpansion?: unknown;
}

interface BoardContext {
  cardState?: unknown;
}
```

`board` 配列単体は `createDenseBoardView(board)` という明示 dense 専用 API だけで受ける。拡張、穴、円形を含む shape-aware API では完全な `{ gameState, cardState }` source を必須とし、board 配列から外部 state/context を引く互換登録 API は作らない。

`cardState` の省略を許すのは穴を持てない dense 専用 API だけとする。state を渡した場合、明示された `boardExpansion.cells` が空なら空が正本であり、古い cache から拡張マスを復活させない。

### 4.2 `BoardView`

`createBoardView(stateOrBoard, options?)` は、その呼び出し時点の immutable な投影を返す。

```ts
interface BoardView {
  topology: BoardTopology;
  boardDigest: string;
  coordinates: readonly CellCoord[];
  expansionCells: readonly ExpansionDescriptor[];
  has(row: number, col: number): boolean;
  isPlayable(row: number, col: number): boolean;
  get(row: number, col: number): number | null;
  count(): { black: number; white: number; empty: number };
  getFlips(
    row: number,
    col: number,
    player: number,
    constraints?: FlipConstraints
  ): readonly CellCoord[];
  getLegalMoves(
    player: number,
    constraints?: FlipConstraints
  ): readonly BoardMove[];
}
```

同じ view 内で topology と content は必ず同じ source revision から作る。存在するマスに owner がない、不正 owner、重複拡張座標、通常マスと拡張マスの衝突、許容範囲外座標があれば、versioned transport と authority 経路では失敗させる。legacy local input は既存互換の正規化を行えるが、診断結果を返し、曖昧な値を複数の解釈へ分岐させない。

`FlipConstraints` は純粋な `blockedKeys`、`protectedKeys`、`permanentProtectedKeys` の集合だけを受ける。card marker から constraint を作る責任は game 境界に残す。kernel は8方向走査を所有するが、カード保護ルールの authority は所有しない。

base cell 判定は raw matrix bounds ではなく `baseKeys` を使う。円形盤面の dense envelope 内 void に expansion descriptor がある場合は descriptor が唯一の owner sourceである。「衝突」は base playable key または既存/hole keyとの衝突を指し、単に配列 index が存在することは衝突ではない。

`boardDigest` は canonical content の同一性、cache、runtime parity 用である。canonical byte列は、board contract version、boardConfig、座標順に並べた existing cell の origin/playability/owner、穴座標から作り、`side`、legacy field、配列挿入順、presentation state は含めない。digest algorithm とversionを定数として固定する。

### 4.3 書き込み

書き込みは state を渡す atomic helper に限定する。

```ts
getStateCellValue(state, row, col, context?)
setStateCellValue(state, row, col, owner, context?)
addStateExpansionCells(state, cells, context?)
canonicalizeStateBoard(state, context?)
removeStateCellsToHoles(source, cells, mutationMeta?)
restoreStateHoles(source, cells, mutationMeta?)
```

- 通常マスなら `state.board`、拡張マスなら canonical descriptor を更新する。
- 拡張 descriptor を更新したら legacy 単一セル field も同じ transaction で同期する。
- 追加時に重複、通常マス衝突、穴との衝突、不正方向、不正 owner を拒否する。
- canonical transport 用配列は `row, col` 順へ並べる。
- helper 成功後に新 revision が観測できる。
- 穴化/復元は base/expansion owner、stone id、関連 marker、hole marker を事前検証し、すべて成功する場合だけ commit する。途中失敗時は元の source を保持する。

カード固有の使用済み flag はカード resolution が所有し、盤面カーネルは幾何と owner だけを所有する。

canonical cell identity は `(row, col)` とする。`side` は座標と base topology から決定的に導出する非 authority projection であり、digest/hashへ含めない。`cells` property が存在する場合は空配列でも正本とし、legacy `active/side/row/owner` を読まない。legacy fallback は `cells` property 自体がない unversioned input だけに限定する。canonical sort後にlegacy projectionを再生成するが、v2 inspectorはlegacy fieldをgameplay判断へ使わない。

### 4.4 cache

配列 property への metadata 書き込みを廃止し、module-private `WeakMap<object, CacheEntry>` を使う。

cache entry は完全な source tuple と、盤面形状へ影響する値から作る signature を持つ。cache は欠けた source を補完しない。

- board の行数、各行長、owner
- normalized boardConfig
- expansion の座標・方向・owner
- hole marker の座標

取得時に signature が一致しなければ再構築する。JSON や Worker を越える正しさは cache に依存せず、受信 state から常に再構築できる。cache は性能最適化であり authority ではない。

`BOARD_SHAPE_META_KEY` と `__sharedBoardShapeMeta` は production API から削除する。

## 5. runtime ごとの統合

### 5.1 headless game / cards

- `game/logic/core.ts` の読み取り、反転、合法手、石数は state-aware kernel を使う。現行の protected/permanent-protected/blocked constraint と結果一致を必須とする。
- `game/logic/board_ops.ts` は marker・presentation event の orchestration を保持し、盤面の幾何・owner 読み書きは kernel へ委譲する。
- `cards/expansion.ts` は拡張カードの使用条件と legacy field 同期の薄い adapter にする。
- `cards-internal/expansion-fallback.ts` は既存 loader 名を保つ互換 wrapper とし、局所 geometry は持たない。共通カーネルが欠けていれば明示的に失敗する。
- selector、move generator、各カードは kernel の座標列挙を使い、固定外周を推測しない。

### 5.2 CPU / selfplay / quiescence Worker

- CPU と selfplay の primitive は共通 topology-aware legal moves を第一かつ唯一の実装にする。
- 標準 dense board の高速化が必要な場合も、カーネルが `standardDense === true` と証明した内部最適化としてだけ使用する。consumer が `OthelloCore` を先に選ばない。
- quiescence request は `boardShape` を明示的に serialize する。Worker は request から view を再構築し、隠し property を復元しない。
- root CPU、selfplay、専用 Worker は同じ fixture に対し、合法手・評価対象座標・石数が一致する parity test を持つ。

### 5.3 Worker / local server / network

- authority の勝敗・rated result は `countStateDiscs` を使う。
- board schema識別子を `snapshot._meta.boardContractVersion` に固定する。既存の単調 `snapshot.stateVersion`、presentation cursor、operationIdとは兼用しない。新規に生成する完全 snapshot は v2 とする。
- v2 snapshot は strict inspection を通過しなければ client state へ適用しない。
- version field がない既存 snapshot は legacy reader で受け、canonical view を構築できることを確認してから適用する。
- public projection と state hash の前に、拡張 descriptor だけを canonical 順へ整列する。他の配列の意味順序は変更しない。
- Worker と local server は同じ inspector、canonicalizer、count helper を使う。
- Worker storage、public/seat/spectator projection、journal `snapshotAfter`、reconnect、base snapshot の全経路で `boardContractVersion` を保持・検査する。

### 5.4 UI / Single Visual Writer

- model builder は一つの `BoardView` から topology と各 cell の owner を同時に投影する。
- playable cell の content 不足を空として補わず、model build を失敗させ、controller の既存 recovery に渡す。
- model へ `boardDigest` と `modelCommitId` を含める。`modelCommitId` は controller が commit ごとに単調増加させる。
- board input は pointer-down 時の settled identity を保持する。network では `stateVersion + visualSeq + pendingEffectId + modelCommitId`、local では `modelCommitId + pendingEffectId` が pointer-up 時にも一致する場合だけ受理する。A→B→Aで内容が戻っても古い入力は通さない。
- expansion direction は現在 cell の `directionHints` に含まれる値だけを受理する。
- public geometry は settled model に存在する座標だけ返す。
- UI は game state を修正せず、Pixi と DOM compatibility の writer 排他は維持する。

## 6. 境界検査

`scripts/check-board-kernel-boundary.ts` を `checkall` に組み込む。TypeScript AST と狭い文字列検査を使い、少なくとも次を禁止する。

- production の `__sharedBoardShapeMeta`
- topology-sensitive consumer における固定 `0/7`、`-1/rows/cols` の拡張 geometry
- CPU / selfplay から dense `OthelloCore` を優先する合法手取得
- authority result での dense board 直接集計
- UI model / adapter での `boardExpansion.cells` 再構築
- compatibility wrapper 以外の expansion fallback 利用

初期盤面生成、encoding、モデル tensor 化など、dense 配列自体が契約である場所だけを file + purpose 単位で allowlist する。allowlist は件数上限を持ち、新規追加には検査変更が必要になるようにする。

## 7. 互換性、失敗、性能

### 7.1 互換性

- state の wire shape は維持する。
- legacy の `active/side/row/owner` は `cells` から同期し、read-only compatibility を保つ。
- unversioned snapshot は読み取り互換を保つ。
- classic browser の global/module load orderは既存 `SharedBoardUtils` entry を維持し、新規 public global を増やさない。
- 新kernelは `shared/board/` のpure CommonJS/TS dependencyとし、game/card/UI globalをrequireしない。hole情報は渡されたpure sourceだけから解釈する。
- classic側は `entry-browser.js` のdependency closureと既存generator sourceを更新し、生成registryを手編集しない。`SharedBoardUtils` preload単体で依存が解決してからcard/compatibility moduleをloadする順序をbootstrap testで固定する。

### 7.2 fail-closed

共通カーネルの欠落、不正 v2 snapshot、重複座標、存在しない座標への書き込みは成功扱いしない。ゲーム中の通常 API は理由付き false/result、bootstrap 契約違反は明示 Error、network inbound は snapshot reject とする。

例外を catch して 8x8 fallback へ進む経路は作らない。

### 7.3 性能

`BoardView` は一度の座標走査で topology、owner map、counts、digest を構築し、同一 view の反転・合法手で再利用する。WeakMap cache は同じ完全source signatureの view 再構築を省く。

標準 8x8 の legal moves は最大64座標×8方向であり、正しさ優先の sparse 実装でも十分小さい。性能 harness で既存予算を確認し、必要ならカーネル内部だけに dense fast path を追加する。

### 7.4 並行性

view は immutable snapshot とし、mutation helper 実行後に古い view を更新しない。UI と network は単調commit identityで stale work を拒否する。Worker request は明示 shape を持つため、process 間 cache 共有を仮定しない。

## 8. 移行順序

段階1〜6の中間状態は非deployableとする。kernel追加後、authority・CPU・selfplay・Worker・UIのparity gateが同一commit系列で成立するまで本番deployしない。旧/新実装をruntime選択するfeature flagは設けず、shadow比較を行う場合はtest/diagnostics専用に限定する。

既存consumerがboard配列だけを渡す期間は、現行 `attachBoardShape` facadeを非authorityの移行adapterとして一時的に残す。hidden array propertyは最初にWeakMapへ退避するが、board-only APIをdense専用へ固定しadapterを削除するのは全consumer cutoverと同時に行う。中間adapterは最終architecture contractではなく、非deployable移行を成立させるためだけのものとする。

1. カーネル、WeakMap cache、state read/write、穴 transaction、合法手、validation、canonicalization を追加する。
2. headless core と board operations を切り替える。
3. CPU、selfplay、quiescence Worker を切り替える。
4. Worker/local server の勝敗、projection、hash、snapshot version を切り替える。
5. UI model、state adapter、input、geometry を切り替える。
6. fallback を薄い strict wrapper へ縮小し、静的 boundary check を有効化する。
7. focused、property、parity、network、browser、全体検証を通し、生成物と mirror を正規生成する。

各段階で旧 state 形式は変わらないため、二重書きの中間状態を作らない。

## 9. 回帰防止テスト

### 9.1 カーネル性質テスト

seed 固定の生成器で長方形・円形、負座標、複数周、疎な拡張、穴を作る。

- view の座標は重複せず deterministic 順
- `has/get/set/count` が独立 sparse-map 参照実装と一致
- 8方向反転と合法手が参照実装と一致
- clone、JSON roundtrip、Worker DTO 復元後も一致
- source mutation 後に cache が古い結果を返さない
- expansion 配列順が違っても canonical hash と revision が一致
- 円形 envelope 内 void が expansion、occupied、hole、restore と遷移しても owner/topology が一致
- `cells: []` と stale `active: true` が拡張マスを復活させない

### 9.2 runtime parity

- game core、CPU、selfplay、quiescence Worker の合法手一致
- Worker/local server の projection、勝敗、rated result 一致
- reconnect snapshot 後の model owner/topology 一致

### 9.3 UI

- 拡張マス owner を空で補わない
- A→B→Aを含む stale commit identity の click/tap を発行しない
- 不正 direction key を発行しない
- void 座標の geometry を返さない
- Pixi/DOM compatibility で同じ semantic model

### 9.4 静的検査

禁止パターンを意図的に置いた fixture が boundary check で失敗し、既存 allowlist が増えていないことを固定する。

## 10. 完了条件

- production に `__sharedBoardShapeMeta` が存在しない。
- topology-sensitive な game、card、CPU、selfplay、Worker、local server、UI、network が単一カーネルを利用する。
- 拡張マスを含む合法手、反転、石数、勝敗、rated result、hash、表示、入力が同じ view と parity test で一致する。
- network v2 snapshot が strict validation され、legacy snapshot 互換も通る。
- fallback 欠落時に silent 8x8 動作をしない。
- boundary check が `checkall` に入り、新しい迂回実装を拒否する。
- `npm run typecheck`、focused Jest、`npm run check:window`、`npm run test:network:parity`、`npm run build:browser`、`npm run match:ui-control-smoke:classic`、`npm run build:vite`、`npm run match:cross-platform-smoke:vite`、`npm run match:pixijs-board-playback-check`、`npm run match:pixi-runtime-fallback-check`、`npm run worker:prepare`、`npm run check:worker-mirror`、full Jestが成功する。
- focused testには protected/permanent-protected/blocked flips、circle-envelope expansion、expansion hole remove/restore、legacy `cells:[] + active:true`、descriptor reorder hash、rated winner reversal、structuredClone Worker復元、A→B→A stale input、classic SharedBoardUtils boot、Worker preloadを含める。
- root source から browser artifacts と Worker mirror を再生成し、task-owned diff だけをコミットする。

## 11. Self-review

- full `BoardStateV2` 置換は、二重 authority と大規模同時移行を生むため採用しなかった。単一 wire state + 単一 interpreter なら authority は増えない。
- WeakMap は正しさの保存先ではなく cache に限定し、process/JSON を越えると常に explicit state から再構築する。
- legacy snapshot 互換は残すが、新しく生成する v2 snapshot では曖昧な正規化を許可しない。
- performance のために consumer へ dense shortcut を戻さず、必要な最適化は view が標準 dense と証明した内部だけに閉じる。
- UI へゲーム判断を移さず、同じ view の読み取り投影と stale input rejectionだけを追加する。
- card rule、演出順序、network authority、盤面 writer を変更しないため、既存 player-visible 正本と Single Visual Writer を維持する。

## 12. Independent review反映

独立レビューで指摘された次の欠落を実装前に修正した。

- 段階移行中を非deployableとし、新旧interpreterのruntime切替を禁止
- protected/permanent-protected/blocked constraintを合法手APIへ追加
- 穴化・復元をall-or-nothing mutationへ追加
- board-only shape登録を廃止し、dense専用APIと完全source APIを分離
- content digestと単調input commit identityを分離
- `_meta.boardContractVersion` と既存 `stateVersion` を分離
- classic/Worker preload順、円形envelope内void、legacy空cells、side非authorityを明文化
- 必須commandと重大fixtureを完了条件へ固定
