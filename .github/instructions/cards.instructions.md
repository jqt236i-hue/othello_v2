---
applyTo: "cards/**/*.js,cards/**/*.json"
---

# cards/ 追加指示（差分のみ）

共通ガードレールは `AGENTS.md` と `.github/copilot-instructions.md` を適用する。

- `cards/` はカード UI（描画・操作）と表示用カタログを担当する。
- カード効果ロジックは `game/logic/cards.js`（または `game/` 側の効果置き場）に置く。
- 一次情報は `cards/catalog.json`。追加・削除・仕様変更時は `cards/catalog.js` と整合を取る。
- 必要なら `node scripts/generate-catalog.js` で `cards/catalog.generated.js` を更新する。
- 描画は `cards/card-renderer.js`、操作は `cards/card-interaction.js` に寄せる。
- カード削除時は `cardId` / `type` / 表示名を `test/`, `shared/deck-spec.js`, `shared/story-deck-spec.js`, `ui/handlers/rules-help.js`, `docs/` まで検索する。

変更時チェック:
- `cards/` に効果ロジックを持ち込んでいない
- `cards/catalog.json` と `cards/catalog.js` と `cards/catalog.generated.js` が一致している
- 削除したカードの参照が deck / rules help / docs / test に残っていない
- `01-rulebook.md` のカード仕様/UI演出と矛盾していない
