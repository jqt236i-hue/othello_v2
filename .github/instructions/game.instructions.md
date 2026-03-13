---
applyTo: "game/**/*.js"
---

# game/ 追加指示（差分のみ）

共通ガードレールは `AGENTS.md` と `.github/copilot-instructions.md` を適用する。

- `game/` から `ui/` へ直接依存しない（UI連携が必要なら `ui/bootstrap.js` で DI）。
- `game/` に DOM 操作（`window` / `document`）や画面・音の直接操作を入れない。
- ターン進行や副作用は既存責務に寄せる（`game/turn/*`, `game/timers.js`）。
- `owner` / `player` / 色の値は境界で正規化し、内部表現を混在させない。
- 挙動や見え方が変わる変更は `01-rulebook.md` を先に更新する。

変更時チェック:
- `ui/` を import していない
- DOM/グローバル参照を増やしていない
- 既存責務の置き場所に寄せている
