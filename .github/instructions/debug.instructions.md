---
applyTo: "game/debug/**/*.js,ui/handlers/debug.js"
---

# debug 追加指示（差分のみ）

共通ガードレールは `AGENTS.md` と `.github/copilot-instructions.md` を適用する。

- 本番影響のある debug は `?debug=1` 等で明示的に ON にした時だけ動かす。
- 常駐 `setInterval` は原則禁止（必要なら debug 有効時のみ）。
- `window` への公開は最小限にし、追加時は公開理由と参照先を記録する。
- debug 実装で `game/` と `ui/` の境界を崩さない。

変更時チェック:
- 通常プレイ時に副作用がない
- グローバル公開が不要に増えていない
- 境界（game/ui）を直接またぐ処理を増やしていない
