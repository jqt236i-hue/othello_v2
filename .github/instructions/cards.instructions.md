---
applyTo: "cards/**/*.js,cards/**/*.json"
---

# cards/（カード定義・UI）向け追加指示

- カード定義の一次情報は `cards/catalog.json`（ミラー: `cards/catalog.js`）。片方だけ更新して乖離させない。
- 既存カードの意味変更や追加は、`01-rulebook.md` の該当箇所（カード仕様/UI演出）と整合させる。
- UI側のレンダリングは `cards/card-renderer.js` 系に寄せ、同じ描画ロジックを増やさない。

変更時チェック:
- catalog の単一ソースが保たれている
- 仕様（rulebook）と実装が矛盾していない
