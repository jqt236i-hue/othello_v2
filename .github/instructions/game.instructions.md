---
applyTo: "game/**/*.js"
---

# game/（ルール・進行）向け追加指示

- `game/` は UI に依存しない（`ui/` を参照しない）。UI依存が必要なら DI（`ui/bootstrap.js` で注入）に寄せる。
- DOM / `window` / `document` 前提の処理を入れない。
- ターン進行や副作用（タイマー等）は既存の責務分離に合わせ、同種の処理を増やさない（例: タイマーは `game/timers.js` 側に寄せる）。
- 定数は単一ソース（`shared-constants.js` と `constants/`）。同じ意味の値を複製しない。
- 仕様変更は `01-rulebook.md` → 実装の順で行う。

変更時チェック（短い自己点検）:
- UI依存が混入していない（DOM/API/グローバル参照なし）
- 同じ定数を別ファイルに増やしていない
