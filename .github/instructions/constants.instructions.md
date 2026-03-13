---
applyTo: "constants/**/*.js,shared-constants.js"
---

# constants/ 追加指示（差分のみ）

共通ガードレールは `AGENTS.md` と `.github/copilot-instructions.md` を適用する。

- 定数は単一ソースで管理し、同じ意味の値を重複定義しない。
- 追加・変更時は参照側の更新漏れを防げる形（列挙/マップ/共通関数）を優先する。
- 既存の命名と粒度を保ち、差分最小で追加する。
- 画面専用の値を `game/` へ埋め込まない。

変更時チェック:
- 重複定数を増やしていない
- 参照側の更新漏れがない
- 置き場所が `constants/` または `shared-constants.js` に統一されている
