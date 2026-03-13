---
applyTo: "ui/**/*.js"
---

# ui/ 追加指示（差分のみ）

共通ガードレールは `AGENTS.md` と `.github/copilot-instructions.md` を適用する。

- `ui/` は `game/` の公開 API / イベント / DI だけを使い、内部実装に依存しない。
- UI実装の注入は `ui/bootstrap.js` に集約し、`__uiImpl_*` の出口をむやみに増やさない。
- 演出は `ui/animation-*` と `ui/stone-visuals.js` に寄せ、同種処理を分散させない。
- デバッグ処理は `?debug=1` 等で明示的に有効化し、通常時に動かさない。
- `window` / `globalThis` への新規公開は最小限にする。

変更時チェック:
- `game/` の内部実装へ直接依存していない
- debug が通常時に有効化されない
- 同じ演出ロジックを別ファイルに複製していない
