---
applyTo: 'shared/**/*.js'
---

# shared instruction

この文書は `shared/` 向けの局所ルールだけを置きます。browser / worker / headless で共有する契約と pure helper を守るための差分ルールです。

## この領域で守ること

- `shared/` には runtime をまたいで再利用する契約、codec、shape helper、純粋 helper を置く。
- browser / worker / headless のどれでも同じ結果になる形を優先する。
- 値の正規化、ID 変換、形状補助のような境界処理はここへ寄せ、呼び出し側へ重複させない。

## 禁止

- DOM、`window`、音、描画依存を持ち込まない。
- `game/` や `ui/` 専用の都合だけで shared 契約をねじ曲げない。
- 隠れた副作用や環境依存の分岐で pure helper を壊さない。

## 変更時チェック

- browser / worker / headless のどこでも同じ契約で使える。
- 共有 helper が副作用なしで動く。
- 呼び出し側の更新漏れがない。
