# Docs index

このディレクトリは、現行の契約文書と、時点依存の計画・実行記録を分けて扱うための入口です。

ゲーム仕様の正本は repo root の `01-rulebook.md` です。
内部構造、責務境界、ランタイム契約、authority、DI の正本は `docs/architecture-contracts.md` です。

## Current contract docs

- `architecture-contracts.md`: 内部アーキテクチャ契約の正本。モジュール境界、ランタイム契約、authority、state、DI、validation bundle を扱います。

## Current operational/reference docs

- `network-worker-deploy.md`: Worker 配信と再参加確認の運用手順。
- `LARGE_FILES.md`: 大きいファイルの扱いに関する補助ガイド。
- `local-cpu-commentary.md`: ローカル CPU commentary の現行リファレンス。
- `Card_Strategy_Full_Catalog.md`: カード戦略カタログ。
- `CPU_Training_Implementation_Runbook.md`: CPU 学習パイプラインの実行手順。
- `teacher-cpu-card-usage-buckets.md`: teacher CPU 向けカード使用分類メモ。
- `Teacher_CPU_Spec_Template.md`: teacher CPU 仕様テンプレート。
- `UI_Adjustment_Request_Guide.md`: UI 調整依頼ガイド。

## Historical docs

- `archive/README.md`: root から退避した historical docs の索引です。
- `archive/DI-boundary.md`: DI 境界整備の完了記録。安定した契約は `architecture-contracts.md` に移管済みです。
- `archive/COMPLETION.md`: 2026-02 時点の DI 境界整備完了メモです。
- `archive/` 配下の日付入り `*-2026-02-*.md` / `*-2026-03-*.md` 文書: plan / runbook / report / audit の実行時資料です。明示的に Active と書かれていない限り、現行契約の正本としては扱いません。

## How to maintain docs

- 安定した内部契約が増えたら、同じ差分で `architecture-contracts.md` を更新します。
- plan / runbook / report は、必要な契約を `architecture-contracts.md` に反映したあとで historical として残します。
- `worker-public/` 配下の文書や生成物は root の正本を上書きしません。
