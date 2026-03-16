# cpu/ README.ai

## 役割

- `cpu/` は browser 側 CPU の互換層や補助コードを置く場所です。
- 新しい判断ロジックは `game/cpu-decision.js`, `game/cpu-turn-handler.js`, `game/ai/*` を優先します。

## 主要入口

- `game/cpu-decision.js`
- `game/cpu-turn-handler.js`
- `ui/handlers/cpu-policy.js`
- `game/ai/*`

## 変更ルール

- `cpu/` は読み取り専用で扱い、DOM / UI / 音 / タイマーを直接触りません。
- 乱数や時間依存は呼び出し側から注入し、再現性を保ちます。
- browser と headless の判断差分を不用意に増やしません。

## 確認

- 状態変更を伴う処理が入っていない
- 実行コストや fallback の考え方が崩れていない
- 関連 CPU / policy test を選んで検証している
