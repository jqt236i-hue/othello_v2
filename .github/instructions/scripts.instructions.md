---
applyTo: 'scripts/**/*.ts,scripts/**/*.js'
---

# scripts instruction

この文書は `scripts/` 向けの局所ルールだけを置きます。生成、検証、運用補助を安全に回すための差分ルールです。

## この領域で守ること

- script の目的を 1 つに絞り、生成、検証、運用補助の責務を明確にする。
- root を正本とする前提で path と入出力を扱う。
- 失敗時は明確に失敗として返し、検証 script は success 条件を隠さない。

## 禁止

- secrets や環境依存の前提を直書きしない。
- 生成物を手編集前提にした運用へ寄せない。
- 広い try/catch や無言継続で失敗を見えなくしない。

## 変更時チェック

- script の入出力と exit code が明確である。
- root 正本 / mirror / generated の境界が崩れていない。
- 関連する package script や test の更新漏れがない。
