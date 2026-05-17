---
applyTo: 'cards/**/*.ts,cards/**/*.js,cards/**/*.json'
---

# cards instruction

この文書は `cards/` 向けの局所ルールです。カード UI と表示用カタログの境界を守ります。

## この領域で守ること

- `cards/` はカード UI と表示用カタログを担当する。
- 一次情報は `cards/catalog.json` とし、変更時は `cards/catalog.js` と `cards/catalog.generated.js` をそろえる。
- カード効果ロジック、pending target、進行処理は `game/` 側へ置く。
- カード追加 / 削除 / 仕様変更では CPU、presentation、rules help、deck、docs、test まで見る。

## 禁止

- `cards/` に効果解決ロジックや state mutation を持ち込まない。
- 生成物だけ、または 1 面だけを直して整合を崩さない。
- カード削除時の残り参照を放置しない。

## 変更時チェック

- `cards/catalog.json`, `cards/catalog.js`, `cards/catalog.generated.js` が一致している。
- 削除や改名の残り参照が deck / rules help / docs / test に残っていない。
- `01-rulebook.md` のカード仕様と矛盾していない。
