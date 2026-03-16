---
applyTo: 'ui/**/*.js'
---

# ui/ instruction

この文書は `ui/` 向けの局所ルールだけを置きます。repo-wide rule は上位文書を参照します。

## この領域で守ること

- `ui/` は表示、入力、再生管理、DI を担当し、`game/` の公開 API / event / DI だけを使う。
- 注入や公開入口は `ui/bootstrap.js` に寄せ、`__uiImpl_*` の出口は必要最小限にする。
- 演出と見た目の差分は `ui/animation-*`, `ui/stone-visuals.js`, `ui/presentation-handler.js`, `ui/playback-state-manager.js` に集約する。
- debug 専用処理は明示フラグでだけ有効化する。

## 禁止

- `game/` の内部実装に直接依存しない。
- 同じ演出や playback 書き込み経路を別ファイルへ複製しない。
- 通常時に動く debug 副作用や広い `window` 公開を増やさない。

## 変更時チェック

- `game/` への依存が公開入口だけに収まっている。
- `events[]` 順と Single Visual Writer を壊していない。
- debug が通常プレイ時に有効化されていない。
