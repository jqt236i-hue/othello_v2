# デッキ構築画面の縦スクロール修正設計

## 背景

デッキ構築のプリセット編集画面で、カード一覧がモーダル下端を超えても縦スクロールできない。

原因は `styles-layout-controls.css` 後段の Compact density 上書きが
`#deckBuilderBody` に `overflow: hidden !important` を指定し、同ファイル前段の
`overflow-y: auto` を無効化していることにある。

## 期待する動作

- デッキ構築モーダルのヘッダーと閉じるボタンは固定する。
- `#deckBuilderBody` の内容だけを縦スクロール可能にする。
- 横方向にはスクロールさせない。
- 再描画時のスクロール位置を維持する既存処理は変更しない。
- 他のモーダルやゲーム進行には影響を与えない。

## 実装

Compact density の `#deckBuilderBody` 上書きを
`overflow-y: auto !important` と `overflow-x: hidden` に変更する。
モーダルの `max-height`、flex 構造、ヘッダー構造は維持する。

## 検証

`test/ui.deck-builder-layout-css.test.ts` に、最終的な Compact density 規則が
縦スクロールを許可し、横スクロールを抑止する CSS 契約テストを追加する。
テストが修正前に失敗し、修正後に成功することを確認する。

実機ゲーム UI の操作確認は行わない。
