# ネット対戦 Worker 配信手順

## 1. 事前準備

- `wrangler.toml` には以下が設定済みです。
  - Worker 本体: `workers/match-worker.mjs`
  - Durable Objects バインディング: `MATCH_ROOM`
  - 静的配信バインディング: `ASSETS`
  - マイグレーション: `MatchRoomDurableObject`

## 2. ローカル確認

```bash
npm run worker:dev
```

- `worker:dev` 実行時に `worker-public/` が自動生成され、そこから静的配信します
- 画面を開いて `ネット対戦` を選択
- `部屋作成` で部屋番号が出ることを確認
- 別タブで同じ部屋番号に `参加` できることを確認

## 3. 公開

```bash
npm run worker:deploy
```

- `worker:deploy` 実行時も `worker-public/` を自動再生成してから公開します
- 公開後は同一オリジンの `/api/match/*` が有効になります
- 接続先欄を空欄にすると同一オリジンへ接続します

## 4. 再参加確認

1. 端末Aで `部屋作成`
2. 端末Bで同じ部屋へ `参加`
3. 端末Bでページ再読込
4. 同じ部屋番号へ再参加し、同じ席（黒/白）に復帰することを確認
