---
applyTo: "cpu/**/*.js"
---

# cpu/ 追加指示（差分のみ）

共通ガードレールは `AGENTS.md` と `.github/copilot-instructions.md` を適用する。

- `cpu/` は `game/` の読み取り専用 API だけを使い、副作用を持たない。
- DOM / UI / 音 / タイマーを直接操作しない。
- 乱数や時間に依存する処理は呼び出し側から注入し、再現性を維持する。
- 重い探索を追加する場合は `constants/difficulty-constants.js` などで上限管理する。
- 新規の意思決定ロジックは `game/cpu-decision.js` 側を優先する。

変更時チェック:
- 状態変更（ミューテーション）をしていない
- `ui/` や DOM への依存が混入していない
- 実行コスト上限の管理がある
