---
applyTo: "cards/**/*.js,cards/**/*.json"
---

# cards/ 向け追加指示（カード定義・カードUI）

このファイルは `cards/` 配下にだけ効く追加指示。全体方針は `.github/copilot-instructions.md` と `AGENTS.md` を前提にする（衝突したら `.github/copilot-instructions.md` を優先）。

## ローカル完結（厳禁）

- 外部のコード保管先への送受信や外部レビュー依頼を前提にした提案をしない（詳細は `.github/copilot-instructions.md`）。

## 役割（置き場所）

- `cards/` は **カードUI（描画・操作・見た目）** と **カード表示用カタログ** を担当する。
- カードの効果ロジックは `game/logic/cards.js`（または `game/` 側の効果置き場）に置き、`cards/` にロジックを増やさない。
- 盤面の演出や共通アニメーションは `ui/animation-*`・`ui/stone-visuals.js` に寄せ、`cards/` に同種の仕組みを複製しない。

## カードカタログ（必須）

- 一次情報: `cards/catalog.json`
- ブラウザ側ミラー: `cards/catalog.js`（`index.html` で読み込まれる）
- 生成物（必要に応じて更新）: `cards/catalog.generated.js`（`node scripts/generate-catalog.js`）
- 変更時は `cards/catalog.json` と `cards/catalog.js` の内容が一致する状態にする（ずれたままにしない）。

## UI 実装（寄せ先）

- 描画は `cards/card-renderer.js`、操作は `cards/card-interaction.js` に寄せる。
- 同じ画面要素の更新や状態判定のロジックを別ファイルへ分散させない（差分最小・共通経路の再利用）。

## 変更時チェック

- `01-rulebook.md` のカード仕様/UI演出と矛盾していない
- `cards/catalog.json` と `cards/catalog.js` が一致している（関連テストが通る）
- `cards/` に効果ロジックを持ち込んでいない（`game/` 側に寄せている）
