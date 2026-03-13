# cards フォルダ — AI向けガイド

- 役割: カードUI（描画・操作）と、表示用のカードカタログを扱う。
- カード定義の一次情報: `cards/catalog.json`（変更時は `cards/catalog.js` と一致させる）。
- 変更ルール: 効果ロジックは `game/logic/cards.js`（または `game/` 側の効果置き場）に置き、`cards/` にロジックを増やさない。
- 依存: `game/` の内部実装に直接依存せず、公開API/DI 経由でつなぐ。
