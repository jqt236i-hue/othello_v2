# ストーリーモード

`story/` は、カードリバーシのノベルゲーム風ストーリーモード専用の bounded context です。

目的は、会話、背景、立ち絵、選択肢、フラグ分岐、バックログ、既読、セーブ、ストーリー対局などを、既存の対局実装へ無秩序に混ぜずに扱える基盤を作ることです。

## ディレクトリ責務

```text
story/
├── core/       # headless story schema, state, runner, validator
├── content/    # scenario, asset IDs, battle stages, story deck presets
├── ui/         # story-root rendering, novel UI, story-only audio
├── bridge/     # existing game startup, save, and battle result connection
└── editor/     # separated story authoring tool
```

## core

`story/core/` は純粋なストーリー進行ロジックです。

ここに置くもの:

- `StoryCommand`
- `StoryScenario`
- `StoryChapter`
- `StoryNode`
- `StoryState`
- `StoryRunner`
- `StoryValidator`
- フラグ管理
- 選択肢分岐
- jump 解決
- battle request 生成
- unlock / seen line / backlog 用の純粋データ

禁止:

- DOM 操作
- `window` / `document` / `Audio` / `HTMLAudioElement`
- `localStorage`
- `setTimeout` / `setInterval`
- network
- 既存 `game/`, `ui/`, `workers/` の内部実装への依存
- `story/ui/` への依存

## content

`story/content/` はシナリオ、素材ID、ストーリー対局 stage、story deck preset を持ちます。

シナリオ本文には画像パスや音声パスを直書きせず、素材IDだけを書きます。実パスは asset registry に集約します。

story battle stage は `boardSize`, `protagonistSide`, `enemySide`, `protagonistDeck`, `enemyDeck` を持てます。

## ui

`story/ui/` は story-root 内のノベル画面専用 UI です。

ここに置くもの:

- 背景レイヤー
- キャラレイヤー
- 会話ウィンドウ
- 名前欄
- 選択肢
- バックログ UI
- オート / スキップ UI
- story 専用音声制御
- `story/ui/story.css`

story UI は既存 board DOM を書き換えません。CSS は `story/ui/story.css` に集約し、既存 `styles-*.css` へ分散させません。

## bridge

`story/bridge/` は既存ゲームとの接続口です。

`story/core/` は battle command に到達しても既存ゲームを直接起動しません。`StoryBattleRequest` を返して停止し、bridge が stage 定義を解決して既存の対局開始経路へ渡します。

story battle result は bridge が受け取り、`StoryRunner.resumeFromBattle(result)` へ戻します。

## editor

`story/editor/` は将来的な制作ツールです。本番ゲームの通常起動入口ではありません。

初期は巨大なノードエディタを作らず、シナリオ入力、preview、validator error、mock battle result を扱える最小構成から始めます。

## assets

ストーリー素材は `assets/story/` に置きます。

想定カテゴリ:

- `bg`
- `chars`
- `bgm`
- `se`
- `cg`

シナリオからは素材IDを参照し、ファイルパスは asset registry で解決します。

制作時の素材IDルール:

- 背景IDは `room_day`, `arena_evening` のように場所と時間帯が分かる snake_case にする
- キャラIDは人物単位、pose は `normal`, `confident`, `angry` のような表情・状態単位にする
- BGM/SE/CG もシナリオ本文では ID だけを使う
- `*.story.ts` や editor 入力に `assets/story/...`, `.png`, `.mp3` などの直接パスを書かない
- 仮素材は本素材と同じ ID で差し替えられる形にする

## Story Battle

ストーリー対局は story battle stage 定義で管理します。

- 初期対応の `boardSize` は `6x6` / `8x8`
- 盤面サイズはプレイヤー自由選択ではなく stage 固定
- `boardSize` は既存の対局初期化経路へ渡す
- 盤面初期化、描画、CPU処理は既存ロジックを流用する
- story 側で 6x6 専用の初期配置ロジックを作らない
- 初期実装では CPU 経路の置換・専用化を行わない

## Story Deck

story battle stage は主人公側と敵CPU側の両方に deck 指定を持てます。

指定できる deck source:

- `default`
- `currentPlayerDeck`
- `deckPreset`
- `deckCode`

deckCode / deckSpec は既存の `deck-codec` / `deck-spec` 系を使い、decode、normalize、validate、canonical encode を行います。

story 側で deckCode parser を再実装しません。`story/core/` は deckCode を直接 decode しません。deckCode / deckPreset の解決は `story/content/` または `story/bridge/` 側で行います。

既存ゲーム初期化へ渡すときは、黒白別の `initialDeckSpecByPlayer` を優先します。

制作時の deck ルール:

- 再利用する主人公・敵CPUデッキは `story/content/story-deck-presets.ts` に置き、stage では `deckPreset` 参照を優先する
- 1回限りの検証や短い fixture では `deckCode` 直書きも許可する
- `currentPlayerDeck` はプレイヤーの保存デッキを使う演出意図がある stage だけで使う
- deckCode の decode / validate は既存 `shared/deck-codec` / `shared/deck-spec` 系を使う
- story 側で deckCode parser を再実装しない
- story editor の validate は deckPreset / deckCode も検証する

## Import 境界

- `game/` から `story/` を import しない
- `shared/` から `story/` を import しない
- `workers/` から `story/` を import しない
- 既存ゲームとの接続は `story/index.ts` の公開APIと `story/bridge/` を基本にする

## 混ぜない場所

以下へ story 固有処理を追加しません。

- board renderer
- playback engine
- `game/turn-manager.ts`
- `game/move-executor.ts`
- `sound-engine.ts`
- `ui/network-client.ts`
- `workers/*`
- `gameState`
- `cardState`
- network room deck
- network snapshot
- worker authority state

## 現在の次工程

素材や本編シナリオが未完成の間は、制作基盤を先に固めます。

1. story editor の validate / preview / mock battle を制作確認に使える品質へ上げる
2. `story-validator` で素材ID、jump、battle stage、deckPreset、deckCode を継続検証する
3. PC 推奨UIとして story screen の操作感、文字送り、バックログ、オート、スキップを磨く
4. 本素材と本編シナリオが揃ったら、`story/content/chapters/*.story.ts` と asset registry に流し込む
