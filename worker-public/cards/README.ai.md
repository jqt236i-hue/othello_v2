# cards/ README.ai

## 役割

- `cards/` はカード UI と表示用カタログを担当します。
- 効果解決や state mutation は `game/` 側に置きます。

## 正本

このファイル内のパスは repo root からの相対パスです。`worker-public/cards/README.ai.md` に同期されていても、正本は root 側です。

- データ正本: `cards/catalog.json`
- 仕様正本: `01-rulebook.md`
- 生成物: `cards/catalog.js`, `cards/catalog.ts`, `cards/catalog.generated.js`

## 変更時の順番

1. `cards/catalog.json` を直す
2. `cards/catalog.js`, `cards/catalog.ts`, `cards/catalog.generated.js` をそろえる
3. 効果が変わるなら `game/logic/cards.ts`（`.js` は互換 shim）, `game/card-effects/*`, pending target, CPU, presentation を確認する
4. ブラウザ実行時の反映が必要なら `npm run build:browser` で `dist/` と `public/module-registry.js` を更新する

## 更新漏れしやすい参照

- `shared/deck-spec.ts / .js shim`
- `ui/handlers/rules-help.ts / .js shim`
- `docs/`
- `test/`

## メモ

- カード削除時は `cardId`, `type`, 表示名で残り参照を検索します。
- `worker-public/` は mirror なので、root を直してから `npm run worker:prepare` でそろえます。
