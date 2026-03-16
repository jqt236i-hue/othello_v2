# cards/ README.ai

## 役割

- `cards/` はカード UI と表示用カタログを担当します。
- 効果解決や state mutation は `game/` 側に置きます。

## 正本

- データ正本: `cards/catalog.json`
- 仕様正本: `01-rulebook.md`
- 生成物: `cards/catalog.generated.js`

## 変更時の順番

1. `cards/catalog.json` を直す
2. `cards/catalog.js` と `cards/catalog.generated.js` をそろえる
3. 効果が変わるなら `game/logic/cards.js`, `game/card-effects/*`, pending target, CPU, presentation を確認する

## 更新漏れしやすい参照

- `shared/deck-spec.js`
- `shared/story-deck-spec.js`
- `ui/handlers/rules-help.js`
- `docs/`
- `test/`

## メモ

- カード削除時は `cardId`, `type`, 表示名で残り参照を検索します。
- `worker-public/` は mirror なので、root を直してから `npm run worker:prepare` でそろえます。
