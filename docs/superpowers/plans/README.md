# Current execution plans

This directory contains only plans that are explicitly marked `status: active`.

| Active plan | Role |
| --- | --- |
| [2026-07-20 スマホ向け手番描画・Pixi静的レイヤー・非表示パネル画像の実装計画](2026-07-20-mobile-turn-render-pipeline-optimization-plan.md) | Writer単位の最終盤面集約、Pixi静的面のviewport texture化、空きセルStoneView削減、非表示パネル大型画像の初回open遅延を実装する現行計画。 |
| [2026-07-11 behavior-preserving full refactor master plan](2026-07-11-behavior-preserving-full-refactor-master-plan.md) | Current repository-wide behavior-preserving refactor program. |
| [2026-07-11 意志の凍結 implementation plan](2026-07-11-will-freeze-refactor-implementation-plan.md) | Phased plan for the prerequisite target/freeze refactors and complete headless, UI, CPU, and network implementation of 「意志の凍結」. Do not execute its implementation phases concurrently with another plan in the same checkout. |

All earlier dated planning documents were classified as historical on 2026-07-11 and moved, unchanged, to `../../archive/`. Their exact one-to-one path mapping and status are recorded in [the plan-status inventory](../../refactor-baselines/plan-status-inventory-2026-07-11.md). Historical plans are context only; they are not a current implementation instruction or specification.
