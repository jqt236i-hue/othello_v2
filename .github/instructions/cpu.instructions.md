---
applyTo: 'cpu/**/*.js'
---

# cpu/ instruction

この文書は `cpu/` 向けの局所ルールです。CPU は読み取り専用の判断補助として扱います。

## この領域で守ること

- `cpu/` は `game/` の読み取り API を使い、判断補助や互換層に徹する。
- 新しい意思決定ロジックは `game/cpu-decision.js`, `game/cpu-turn-handler.js`, `game/ai/*` を優先する。
- 乱数や時間依存は呼び出し側から注入し、再現性を保つ。
- 重い探索や gate は profile / constants 側で上限を管理する。

## 禁止

- DOM / UI / 音 / タイマーを直接操作しない。
- 状態変更を伴うミューテーションをしない。
- 旧 `cpu/` 側だけで別ポリシーを分岐させない。

## 変更時チェック

- 読み取り専用が保たれている。
- 実行コストの上限や fallback の考え方が崩れていない。
- browser と headless の判断差分を不必要に増やしていない。
