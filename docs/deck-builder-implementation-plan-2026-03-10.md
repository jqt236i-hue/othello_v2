# カスタムデッキ構築機能 実装計画・設計書

作成日: 2026-03-10  
対象: カードオセロ UI / game / shared / network / worker-public  
状態: 設計・実装計画書（未実装）

## 0. この文書の位置づけ

- この文書は、カスタムデッキ構築機能を既存の固定デッキ実装へ安全に導入するための設計書です。
- ルールと挙動の一次情報は引き続き `01-rulebook.md` です。
- この文書に書かれている内容のうち、まだコードに入っていないものは「実装予定」です。
- 実装着手時に対局ルールや見え方が確定で変わるため、コード変更前に `01-rulebook.md` のデッキ節を更新します。

---

## 1. 目的

### 1.1 追加したい体験

- プレイヤーが自分で 30 枚のデッキを組める。
- 同じカードは最大 3 枚まで入れられる。
- デッキは 3 件までプリセット保存できる。
- 保存したデッキは名前付きで管理できる。
- デッキコードを発行でき、コード入力でも同じデッキを再利用できる。
- 公開 URL に現在のデッキを反映できる。
- ネット対戦でも同じ形式のデッキ指定を使える。

### 1.2 目指す到達点

- UI でデッキを編集する経路と、URL・コード入力・ネット対戦で使う経路が同じデータ形式を使う。
- `game/` は UI 実装を知らず、初期デッキ指定だけを受け取る。
- `worker-public/` と本体でデッキ関連ロジックが二重化しない。
- 将来、部屋共通デッキから「プレイヤーごとの持ち込みデッキ」へ拡張できる。

### 1.3 非目標

- 初回実装で、ネット対戦の相手デッキ秘匿まで完全対応すること
- 初回実装で、デッキコードを最短文字数まで圧縮すること
- 対局途中に山札を安全に差し替えること
- `worker-public/` を直接編集して本体との差分を抱えること

---

## 2. 要件整理

### 2.1 機能要件

- デッキ上限は 30 枚固定
- 1 種類あたりの重複上限は 3 枚
- 候補カードは既存の有効カード一覧を使う
- プリセット保存は 3 件まで
- プリセットには名前を付けられる
- プリセット一覧から `使用` `編集` `戻る` を操作できる
- `使用` を押すと、現在の固定標準デッキから選択デッキへ切り替わる
- デッキコードを表示・コピー・入力できる
- URL に現在のデッキを反映できる
- ネット対戦で同じデッキ形式を送れる

### 2.2 UI 要件

- デッキボタンは操作パネル内に追加する
- 表示方式は既存の `networkOverlay` / `leaderboardOverlay` と同じモーダルオーバーレイを使う
- デッキ編集画面のカード候補は、手札カードと同系統の見た目を使う
- 同じカードを複数入れている場合は、カード上に枚数表示を出す
- 30 枚に達するまでは保存不可

### 2.3 運用要件

- 保存先は localStorage を使う
- URL とネット対戦は、同じデッキコードを基準に扱う
- 実装後は `worker-public/` 同期と関連テストが必要

---

## 3. 現状の前提と制約

### 3.1 既存実装の前提

- 現在の初期デッキは `game/logic/cards.js` の `createCardState(prng)` が作る固定デッキである
- 初期デッキは「有効カードを各 1 枚ずつ」で生成される
- ネット対戦の room 初期 snapshot もこの固定デッキ前提で生成される
- UI にはモーダルオーバーレイの既存パターンがある
- 手札カードの見た目は `cards/card-renderer.js` の `card-item` が既に持っている

### 3.2 制約

- `game/` は `ui/` に依存しない
- `ui/` は `game/` の公開 API と公開状態だけを使う
- `worker-public/` は直接編集せず、同期経路を使う
- 定数や共通ロジックは単一ソースに寄せる
- 外部依存は追加しない

### 3.3 仕様衝突

- `01-rulebook.md` では現時点で「有効カードを各 1 枚ずつ、重複なし」が一次仕様になっている
- カスタムデッキを実装する時点で、この仕様は明示的に更新が必要

---

## 4. 結論と推奨方針

### 4.1 結論

- デッキ機能は UI 単体ではなく「初期デッキ指定システム」として実装する。
- プリセット保存、デッキコード、URL 共有、ネット対戦は、同じ正規化済みデッキ仕様を使う。
- 初回実装のネット対戦は `shared room deck` を採用する。
- `per-player deck` は第 2 段階で追加する。

### 4.2 初回実装で採る方針

- canonical な内部表現は `DeckSpec` に統一する
- ゲーム開始時だけデッキを差し替える
- `使用` は active deck spec の保存までを即時反映とし、実際の deck 適用は次回 `resetGame()` / 初期化時から行う
- 対局中に `使用` した場合は、現在の対局をリセットして次回初期化から反映する確認を挟む
- デッキコードは version 付きの JSON ベース形式にする
- UI と worker で共有するロジックは `shared/` に置く

### 4.3 後回しにする方針

- 相手プレイヤーの持ち込みデッキ秘匿
- 超短縮コード化
- デッキ公開ランキングや検索

---

## 5. データ設計

### 5.1 canonical な内部表現

初回実装では、カード順ベースの圧縮形式ではなく、カード ID と枚数を持つ明示形式を基準にする。

```js
// normalized DeckSpec v1
{
  version: 1,
  catalogVersion: 1,
  cards: [
    { cardId: 'free_01', count: 2 },
    { cardId: 'hard_01', count: 3 },
    { cardId: 'swap_01', count: 1 }
  ]
}
```

### 5.2 正規化ルール

- browser / Node / worker の実行形態差を吸収するため、実ランタイムでは `SharedConstants.CARD_DEFS` または `CardCatalog` から解決できる enabled カードだけを許可する
- `count` は 1〜3 の整数のみ許可する
- 合計枚数はちょうど 30 にする
- 同一 `cardId` の重複 entry は許可しない
- 保存・URL・ネット対戦へ出す前に必ず `DeckSpec` に正規化する

### 5.3 展開形

ゲーム初期化で使う時だけ、以下の形へ展開する。

```js
['free_01', 'free_01', 'hard_01', 'hard_01', 'hard_01', 'swap_01']
```

### 5.4 デッキコード

初回実装では、堅牢性優先で version 付き JSON payload を URL-safe Base64 化する。

```text
D1.<base64url(payload-json)>
```

payload 例:

```js
{
  version: 1,
  catalogVersion: 1,
  cards: [
    ['free_01', 2],
    ['hard_01', 3],
    ['swap_01', 1]
  ]
}
```

補足:

- 文字数が長い場合でも、初回実装では正しさを優先する
- 将来、必要になれば compact codec に差し替える
- codec の public format は version で判別できるようにする

### 5.5 プリセット保存形式

```js
{
  version: 1,
  activePresetId: 'preset_2',
  presets: [
    {
      id: 'preset_1',
      name: '標準寄り',
      deckCode: 'D1....',
      updatedAt: 1760000000000
    },
    {
      id: 'preset_2',
      name: '速攻型',
      deckCode: 'D1....',
      updatedAt: 1760000000001
    },
    {
      id: 'preset_3',
      name: '',
      deckCode: '',
      updatedAt: 0
    }
  ]
}
```

---

## 6. アーキテクチャ設計

### 6.1 推奨ファイル構成

- `shared/deck-spec.js`
  - デッキ正規化、検証、展開
- `shared/deck-codec.js`
  - encode / decode、URL-safe 文字列化
- `ui/storage/deck-presets.js`
  - localStorage 読込・保存
- `ui/deck-builder/deck-builder-state.js`
  - 編集中の 30 枚状態管理
- `ui/deck-builder/deck-builder-renderer.js`
  - オーバーレイ描画とカード候補一覧描画
- `ui/deck-builder/deck-builder-controller.js`
  - UI 状態遷移とイベント処理
- `ui/handlers/deck-builder.js`
  - `initializeUI()` から呼ぶ入口

補足:

- `shared/deck-spec.js` と `shared/deck-codec.js` は、既存 shared モジュールと同じく classic script と CommonJS の両方で読める形にする
- browser 側では `index.html` の script 順で deck builder より先に読む
- `worker-public/` 側には `shared/` ディレクトリ同期で配布する

### 6.2 既存変更対象

- `index.html`
  - デッキボタン追加
  - デッキビルダー用オーバーレイ追加
  - 追加スクリプト読み込み
- `ui/handlers/init.js`
  - DOM 取得と `setupDeckBuilderControls()` 呼び出し追加
- `game/logic/cards.js`
  - `createCardState(prng, options)` 化
  - deckSpec 適用追加
- `card-system.js`
  - `initCardState(seed, options)` 化
- `ui/network-client.js`
  - room create へ `deckCode` を渡す
- `workers/match-worker.mjs`
  - `deckCode` 検証、room への保存、snapshot 生成反映

### 6.3 置いてはいけない責務

- `game/` にモーダル開閉ロジックを置かない
- `cards/` にデッキ保存ロジックを置かない
- `ui/` にデッキ検証の唯一の実装を置かない
- `worker-public/` にだけ存在するデッキロジックを作らない

### 6.4 UI から game への受け渡し契約

現状の `resetGame()` は `initCardState()` を引数なしで呼ぶため、active deck spec をどこから受け取るかを先に固定する必要がある。

推奨方針:

- game は localStorage や DOM を直接読まない
- `turn-manager` の UI DI に `readActiveDeckSpec()` または `buildCardInitOptions()` を追加する
- `resetGame()` は UI DI 経由で deck 初期化 options を受け取り、`initCardState(undefined, options)` へ渡す
- UI 側では active deck spec の保存と読込だけを担当する

これにより、game / ui 境界を崩さずにローカル対局へカスタムデッキを適用できる。

---

## 7. game 側の設計

### 7.1 createCardState の拡張方針

現状:

```js
createCardState(prng)
```

変更後の想定:

```js
createCardState(prng, {
  initialDeckSpec,
  initialDeckSpecByPlayer
})
```

### 7.2 適用ルール

- `initialDeckSpecByPlayer` があれば黒白別に使う
- `initialDeckSpec` があれば両プレイヤー共通で使う
- 両方なければ既存の標準固定デッキを使う
- どの場合でも shuffle は黒白別に行う

### 7.3 ローカル reset 経路

- `resetGame()` から `initCardState()` へ options を渡せるようにする
- options の取得元は UI DI に限定する
- headless から `CardLogic.initGame(prng)` や `CardLogic.createCardState(prng)` を直接呼んでいる経路は、未指定時の既定動作が変わらないことを前提に互換維持する

### 7.4 root cause 対応

デッキ構築機能は、既存の deck 初期化を UI から直接いじるのではなく、初期生成の責務そのものを options 化する。

### 7.5 互換維持

- `cardState.deck` の legacy field は従来通り残す
- `initialDeckSizeByPlayer` は 30 枚デッキにも対応する
- デッキ未指定時の既存テストは維持する
- `src/engine/selfplay-runner.js` と `scripts/local-match-server.js` の既定動作は変えない

---

## 8. UI 設計

### 8.1 ボタン配置方針

- デッキボタンは操作パネル内に追加する
- 見た目上はデバッグ系導線の近くに置くが、機能自体は debug 限定にしない
- グループ名は `DECK` とし、既存の `MATCH` や `GAME` と並ぶ粒度で置く

### 8.2 オーバーレイ構成

モーダル内は 3 画面構成にする。

1. プリセット一覧
2. デッキ編集
3. コード入力 / コード表示

### 8.3 画面遷移

- 初期表示はプリセット一覧
- プリセットを押すと `使用` `編集` `戻る`
- `編集` でデッキ編集へ
- `コード入力` で deckCode から読み込み可能
- `保存` は 30/30 達成時のみ有効

### 8.4 カード候補 UI

- カード候補は `card-item` 見た目を流用する
- 候補カードごとに現在枚数バッジを表示する
- 3 枚上限のカードは追加不可の見た目にする
- 選択済み 30 枚の一覧を別領域で表示する
- 候補カードを押すと +1、選択済みカードを押すと -1 にする

### 8.5 モバイル対応

- 900px 未満では、候補一覧とサイドパネルを縦積みにする
- 600px 未満では、`選択` `プリセット` `コード` のタブ切替にする
- モーダル自体は既存の responsive パターンに合わせる

### 8.6 使用ボタンの挙動

- 非対局中は即時にアクティブデッキへ反映する
- 対局中は「現在の対局をリセットして切り替える」確認を出す
- 対局途中の山札差し替えは初回実装では行わない

---

## 9. URL 設計

### 9.1 URL パラメータ

- `deck=<deckCode>` を canonical にする

例:

```text
https://.../index.html?deck=D1....
```

### 9.2 URL 読込

- 起動時に `deck` があれば decode して正規化する
- decode 失敗時は標準デッキへ fallback し、UI に無効コードを通知する

### 9.3 URL 反映

- アクティブデッキ変更時に `URLSearchParams` を使って `deck` パラメータだけを追加・更新する
- `matchServer` `debug` `simAspect` など既存 query パラメータは保持する
- deck 未設定へ戻す時は `deck` パラメータだけを削除する
- URL 全体を deck 用に置き換えない
- プリセット名は URL に含めない
- deckCode 以外の共有用メタデータは URL に含めない

---

## 10. ネット対戦設計

### 10.1 初回実装の方針

初回は `shared room deck` を採用する。

- 部屋作成者が指定した `deckCode` を room 共通デッキとして固定する
- 参加者はその room に入るだけで同じデッキを使う
- 両者が別々の持ち込みデッキを使う設計は後回しにする

### 10.2 shared room deck を先に採る理由

- 現在の worker は手札だけを秘匿しており、相手デッキ秘匿までは扱っていない
- room 作成時に snapshot を確定する構造と相性が良い
- URL と deckCode の設計をそのまま使える

### 10.3 API 変更案

`/api/match/create` request:

```js
{
  playerName: 'Alice',
  deckCode: 'D1....'
}
```

worker 内部保存:

```js
{
  deckMode: 'shared',
  deckCode: 'D1....',
  deckSpec: { ...normalizedDeckSpec }
}
```

### 10.4 snapshot 生成

- room create 時に `deckCode` を decode して `DeckSpec` に正規化する
- `makeInitialSnapshot(seed, { initialDeckSpec })` の形で初期 snapshot を作る
- rematch 時も同じ room deck を再利用する

### 10.5 room deck metadata の公開契約

初回実装では shared room deck を公開情報として扱う。

返却対象:

- `/api/match/create` response
- `/api/match/join` response
- `/api/match/state` response
- `/api/match/stream` の snapshot payload

公開する metadata 例:

```js
{
  roomDeck: {
    mode: 'shared',
    deckCode: 'D1....',
    deckSize: 30,
    source: 'room'
  }
}
```

方針:

- 初回実装では join 前 preview API は追加しない
- room deck の表示は create / join 成功後と、参加中の network UI に限定する
- `roomDeck` は shared room deck なので両プレイヤーへ同じ内容を返す
- 将来 per-player deck を入れる場合は、この公開契約を再設計する

### 10.6 UI 側の責務分担

- 送受信と session 管理は `ui/network-client.js` が担当する
- create / join ボタン、overlay 開閉、room deck の表示や受理 UI は `ui/handlers/match-mode.js` が担当する
- `ui/handlers/init.js` は DOM を取得して match-mode 側へ束ねるだけに留める

### 10.7 将来の per-player deck

後続フェーズでは次を検討する。

- `deckSpecByPlayer` を room に保持する
- 参加者 join 時に deckCode を提出する
- 相手 deck をどこまで公開するかの秘匿ポリシーを追加する

初回実装では対応しない。

---

## 11. 保存設計

### 11.1 localStorage キー案

- `deck_builder_presets_v1`
- `deck_builder_active_deck_v1`
- `deck_builder_import_code_v1`

### 11.2 保存責務

- UI から localStorage を直接叩かず、`ui/storage/deck-presets.js` に集約する
- 保存対象は deckCode と表示名を基本にし、展開済み cardIds は都度 decode する

### 11.3 優先順位と復帰ルール

local active deck、URL deck、network room deck が競合する場合は、以下の順で扱う。

1. network session 中の実対局では `roomDeck` を最優先に使う
2. network session 外では、有効な URL `deck` があればそれを local active deck へ反映する
3. URL `deck` が無効または無い場合は、保存済み local active deck を使う
4. 保存済み local active deck も無効な場合だけ標準デッキへ fallback する

追加ルール:

- create 時は、その時点の local active deck を room deck として固定する
- join 時は、local active deck を保持したまま、対局中だけ room deck を一時的に使う
- leave 時は、保存済み local active deck に戻る
- URL の `deck` は local 用の指定であり、room deck を表すためには使わない
- network 参加中も URL は勝手に room deck 用へ書き換えない
- URL `deck` が無効だった場合は、保存済み local active deck を維持し、それも無効なら標準デッキへ落とす

---

## 12. フェーズ計画

## Phase 0: 仕様確定

目的:

- カスタムデッキの一次仕様を `01-rulebook.md` に反映する
- room 共通デッキを初回スコープと確定する

チェックリスト:

- [ ] `01-rulebook.md` のデッキ節を「標準デッキ」と「カスタムデッキ」に分ける
- [ ] 30 枚上限、3 枚重複上限を一次仕様へ反映する
- [ ] URL 共有とネット対戦で同じ deckCode を使う方針を明記する
- [ ] 初回実装は `shared room deck` と明記する
- [ ] 対局途中の山札差し替えを非対応と明記する

完了条件:

- `01-rulebook.md` と設計書の矛盾がない

## Phase 1: 共有デッキ仕様と codec

目的:

- デッキの正規化、検証、コード化を shared 層へ作る

対象:

- `shared/deck-spec.js`
- `shared/deck-codec.js`

チェックリスト:

- [ ] enabled カードだけを許可する正規化関数を追加する
- [ ] 合計 30 枚、1 種類 3 枚までを検証する
- [ ] `DeckSpec -> expanded cardIds[]` の展開関数を追加する
- [ ] `DeckSpec -> deckCode` / `deckCode -> DeckSpec` を実装する
- [ ] 不正コード時の error shape を統一する

完了条件:

- shared 層だけで deckCode の往復が成立する

## Phase 2: game 初期化の拡張

目的:

- 標準固定デッキに加えて、指定デッキで初期化できるようにする

対象:

- `game/logic/cards.js`
- `card-system.js`

チェックリスト:

- [ ] `createCardState(prng, options)` を追加する
- [ ] `initGame(prng, options)` へ pass-through する
- [ ] `initCardState(seed, options)` へ pass-through する
- [ ] 標準固定デッキ fallback を維持する
- [ ] `initialDeckSizeByPlayer` が 30 枚デッキでも正しく出る

完了条件:

- 標準デッキとカスタムデッキの両方で起動できる

## Phase 3: ローカル適用経路の固定

目的:

- active deck spec が local reset から確実に渡る経路を先に固定する

対象:

- `game/turn-manager.js`
- `ui/bootstrap.js`
- `card-system.js`

チェックリスト:

- [ ] UI DI に `readActiveDeckSpec()` または等価な getter を追加する
- [ ] `resetGame()` から `initCardState()` へ options を渡せるようにする
- [ ] game が DOM や localStorage を直接読まないことを確認する
- [ ] active deck 未設定時の既定動作が変わらないことを確認する

完了条件:

- `使用` した active deck が次回 reset から反映される

## Phase 4: UI デッキビルダー

目的:

- プリセット管理、30 枚編集、コード入力の UI を追加する

対象:

- `index.html`
- `ui/handlers/init.js`
- `ui/handlers/deck-builder.js`
- `ui/deck-builder/*`
- `ui/storage/deck-presets.js`

チェックリスト:

- [ ] デッキボタンを操作パネルへ追加する
- [ ] デッキビルダー用オーバーレイを追加する
- [ ] プリセット 3 枠を表示する
- [ ] `使用` `編集` `戻る` の遷移を実装する
- [ ] 30 枚未満では保存不可にする
- [ ] 3 枚上限のカードは追加不可表示にする
- [ ] アクティブデッキ保存と読込を localStorage に集約する

完了条件:

- UI だけでプリセット保存、編集、使用が成立する

## Phase 5: URL 共有

目的:

- 現在のアクティブデッキを URL へ反映する

対象:

- `index.html`
- `ui/handlers/init.js`
- `ui/handlers/deck-builder.js`

チェックリスト:

- [ ] 起動時に `deck=` を decode してアクティブデッキへ適用する
- [ ] deckCode 不正時の fallback と UI 通知を実装する
- [ ] アクティブデッキ変更時に URL を `replaceState` で更新する
- [ ] プリセット名を URL に乗せない
- [ ] 既存 query を保持したまま `deck` だけを更新する
- [ ] invalid URL 時は saved active deck を優先し、最後に標準デッキへ落とす

完了条件:

- URL を開くだけで同じデッキを再現できる

## Phase 6: ネット対戦 shared room deck

目的:

- room 作成時に deckCode を持たせ、共有デッキで対戦できるようにする

対象:

- `ui/network-client.js`
- `ui/handlers/match-mode.js`
- `workers/match-worker.mjs`

チェックリスト:

- [ ] room create payload に `deckCode` を追加する
- [ ] worker で deckCode を decode / validate する
- [ ] room に shared deck 情報を保存する
- [ ] 初期 snapshot と rematch で同じ room deck を使う
- [ ] create / join overlay で room deck の使用を受け入れる
- [ ] room deck の表示責務を `match-mode` 側へ固定する
- [ ] create / join / state / stream の全経路で `roomDeck` metadata を返す
- [ ] network session 中は room deck が local active deck より優先されることを明記どおり実装する
- [ ] leave 時に local active deck へ復帰する

完了条件:

- 部屋作成者が選んだ deckCode でネット対戦開始が成立する

## Phase 7: optional 拡張

目的:

- 将来の `per-player deck` と秘匿対応の準備を行う

チェックリスト:

- [ ] `deckSpecByPlayer` の room 設計を分離する
- [ ] 相手 deck の公開範囲を決める
- [ ] projectSnapshotForViewer への秘匿拡張が必要か判断する
- [ ] replay / restore の互換ルールを定義する

完了条件:

- 初回実装と衝突しない拡張方針が文書化される

---

## 13. テスト計画

### 13.1 単体テスト

- deckCode encode / decode の往復
- 無効 cardId の reject
- enabled=false の reject
- 29 枚 / 31 枚 / 4 枚重複の reject
- `createCardState()` で custom deck を適用した時の deck 長確認
- headless 呼び出しで deck 未指定時の既定動作が変わらないことの確認

### 13.2 結合テスト

- 標準デッキとカスタムデッキで `commitDraw()` が動く
- URL から読み込んだ deckCode で初期化できる
- 既存 query を保持したまま `deck` だけ更新できる
- shared room deck で create / join / rematch が成立する

### 13.3 手動確認

- カード候補の枚数バッジが正しい
- 3 枚上限で追加不可表示が出る
- 30 枚到達時だけ保存可能になる
- `使用` 後に新規対局で選択デッキが使われる
- deckCode をコピーして別タブで再現できる
- `matchServer` `debug` 付き URL でも deck 追加で壊れない

### 13.4 worker-public 確認

- `npm run worker:prepare` 実行
- `worker-public/` へ shared / ui / game の必要ファイルが同期されていることを確認

### 13.5 repo 固有の確認

- `npm run checkall` を通す
- `npm test` を通す
- UI 境界テストを落とさない
- window 依存チェックを落とさない
- script 読込順と worker mirror の既存テストを落とさない

---

## 14. リスクと回避策

### 14.1 deckCode の長さ

リスク:

- JSON ベース code は長くなる可能性がある

回避策:

- 初回は堅牢性優先で採用する
- 長すぎると判断した時だけ compact codec を別 version で追加する

### 14.2 対局途中の切替

リスク:

- 途中対局の deck 差し替えは state 整合を壊しやすい

回避策:

- 即時切替は「次の初期化から適用」に限定する
- 対局中はリセット確認を出す

### 14.3 ネット対戦の秘匿

リスク:

- player ごと持ち込み式にすると、相手デッキの見え方を再設計する必要がある

回避策:

- 初回は room 共通デッキに限定する

### 14.4 catalog 更新との互換

リスク:

- 将来カードが増減すると旧 deckCode の取り扱いが難しくなる

回避策:

- deckCode に version と catalogVersion を含める
- 互換 migration は別フェーズで扱う

---

## 15. 実装着手順の最短順序

1. `01-rulebook.md` 更新
2. `shared/deck-spec.js` と `shared/deck-codec.js` 作成
3. `game/logic/cards.js` と `card-system.js` の options 化
4. UI デッキビルダー追加
5. URL 読込 / 反映追加
6. ネット対戦 shared room deck 対応
7. `worker:prepare` とテスト確認

---

## 16. 完了条件

- カスタムデッキが 30 枚・3 枚重複上限で編集できる
- 3 件のプリセット保存と再利用ができる
- deckCode で再現できる
- URL 共有で同じデッキを開ける
- ネット対戦で shared room deck が使える
- `01-rulebook.md`、実装、テスト結果が一致している
