# Archive index

このディレクトリは、`docs/` root から退避した historical docs を置く場所です。

- ここにある文書は、調査、計画、実装記録、完了メモ、監査の履歴として残します。
- ここにある文書は、明示的に Active と書かれていない限り、現行契約の正本ではありません。
- ゲーム仕様の正本は `../../01-rulebook.md` です。
- 内部構造、責務境界、ランタイム契約、authority、DI の正本は `../architecture-contracts.md` です。

## What belongs here

- 日付入りの plan / runbook / report / audit
- 完了後に履歴化した作業メモ
- 後から経緯確認に使うが、日常の入口には置かなくてよい文書

## How to use it

- 現在のルールや構造を知りたい時は、まず root の `docs/architecture-contracts.md` と `01-rulebook.md` を見ます。
- ここは「なぜそうなったか」「当時どう進めたか」を追うための参照置き場です。
- historical docs を root に戻すより、必要な安定知識だけを現行ドキュメントへ移してください。

## 2026-07-11 plan classification

`docs/superpowers/plans/` にあった 77 本の過去の日時付き plan は、内容を変更せずここへ移した。すべて `historical` であり、現在の実装指示ではない。正確な移動一覧と唯一の active plan は [plan-status-inventory-2026-07-11.md](../refactor-baselines/plan-status-inventory-2026-07-11.md) を参照する。
