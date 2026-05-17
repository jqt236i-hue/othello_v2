# カードオセロ / SKILLS.md

最終更新: 2026-04-12

## 0. この文書の役割

- この文書は、利用可能な skill の索引と選び方だけを置く場所です。
- repo-wide rule は `01-rulebook.md`, `.github/copilot-instructions.md`, `AGENTS.md`, `.github/instructions/*.instructions.md` が担当します。
- 各 skill の手順本文は `.github/skills/**/SKILL.md` を読みます。

## 1. どの文書を見るか

| 欲しい情報 | 見る場所 |
| --- | --- |
| ゲーム仕様 | `01-rulebook.md` |
| 常時有効の hard rule | `.github/copilot-instructions.md` |
| 調査順 / 編集順 / 確認順 | `AGENTS.md` |
| フォルダ別の差分ルール | `.github/instructions/*.instructions.md` |
| 反復タスクの手順 | `.github/skills/**/SKILL.md` |
| 局所メモ | `README.ai.md` |
| 精査専用 agent 契約 | `.github/agents/*.agent.md` |

## 2. skill を使う場面

- 同じ種類の作業が繰り返し出る時
- 複数ファイルにまたがる定型調査と検証束がある時
- 既知の罠があり、読む順と確認順を固定したほうが安全な時
- 一度きりの局所ルールなら、skill より instruction や `README.ai.md` を優先する
- 構造問題や再発不具合で責務境界ごと直す時は、`safe-rational-refactor` に押し込まず `design-plan-runbook-authoring-workflow` を先に使って phase を切る

## 3. skill index

| Skill | 使う時 | 主対象 |
| --- | --- | --- |
| `animation-visual-playback-workflow` | 演出順、board render、playback lock、visual regression を直す時 | `ui/animation-*`, `ui/diff-renderer.js`, `ui/playback-engine.js`, `ui/presentation-handler.ts / .js shim`, `ui/playback-state-manager.ts / .js shim` |
| `new-card-implementation-workflow` | 新カード実装を type 分岐から end-to-end で通す時 | `cards/catalog.json`, `game/card-effects/*`, `game/cpu-turn-handler.ts / .js shim`, pending target / deferred publish, CPU, presentation, docs / tests |
| `card-effect-integration-workflow` | 既存カードの削除、既存仕様変更、関連統合作業を end-to-end で通す時 | `cards/catalog.json`, `game/card-effects/*`, pending target, CPU, presentation, deck / rules help |
| `card-cost-adjustment-workflow` | カードの cost 数値変更を end-to-end で通す時 | `cards/catalog.json`, generated catalog, tier UI, CPU cost scoring, docs / tests |
| `card-description-surface-workflow` | カードの簡易説明 / 詳細説明 / 重複除外を shared resolver から surface までそろえる時 | `cards/card-interaction-effects.ts / .js shim`, `cards/card-interaction.ts / .js shim`, `ui/handlers/rules-help.ts / .js shim`, description surface tests |
| `pending-selection-flow-workflow` | pending selection、multi-stage target、deferred publish、selection cache をそろえる時 | `game/turn-handlers/pending-target-selector.ts / .js shim`, `game/turn/pending-coordinator.js`, `game/network-turn-handoff.ts / .js shim`, `game/cpu-turn-handler.ts / .js shim`, `ui/network/snapshot.ts / .js shim`, `ui/network-client.ts / .js shim` |
| `marker-duration-lifecycle-workflow` | marker の追加、duration、turn-start expire、STATUS_* をそろえる時 | `game/logic/cards/markers.ts / .js shim`, `game/logic/cards-internal/effect-timing.ts / .js shim`, `game/turn/pipeline_ui_adapter.ts / .js shim` |
| `board-expansion-movement-workflow` | board expansion、movement card、expansion render / sound、CPU target をそろえる時 | `game/logic/core.ts / .js shim`, `game/logic/cards/expansion.ts / .js shim`, `game/logic/cards/movement.ts / .js shim`, `game/card-effects/position-swap.js`, `game/move-generator.js`, `game/cpu-turn-handler.ts / .js shim`, `ui/diff-renderer.js` |
| `cpu-onnx-gate-workflow` | browser ONNX gate と benchmark / fallback をそろえる時 | `ui/handlers/cpu-policy.ts / .js shim`, `game/ai/policy-onnx-runtime.js`, `game/cpu-decision.ts / .js shim`, benchmark scripts |
| `deck-builder-authoring-workflow` | deck builder の authoring UI を直す時 | `shared/deck-spec.ts / .js shim`, `shared/deck-codec.ts / .js shim`, `ui/handlers/deck-builder.ts / .js shim` |
| `design-plan-runbook-authoring-workflow` | design / plan / runbook 文書を作る時 | `docs/README.md`, `docs/*-plan*.md`, `*-runbook*.md`, `docs/architecture-contracts.md` |
| `network-backend-worker-workflow` | local match server と worker authority を直す時 | `scripts/local-match-server.ts / .js shim`, `workers/match-worker.mjs`, `shared/network-action-schema.ts / .js shim`, `shared/playback-event-helpers.ts / .js shim`, `utils/match-authority.ts / .js shim` |
| `network-selfmatch-bug-hunt-workflow` | Playwright で headed の 2 ブラウザを同室接続し、終局と UI / animation の崩れまで含めて network 特有の不具合を探す時 | 必要時の `tmp/playwright-network-verify/`, `ui/network-client.ts / .js shim`, `ui/network/snapshot.ts / .js shim`, `workers/match-worker.mjs`, `scripts/local-match-server.ts / .js shim` |
| `network-playback-workflow` | snapshot / reconnect / publish / playback queue を直す時 | `ui/network-client.ts / .js shim`, `ui/network/snapshot.ts / .js shim`, `ui/playback-state-manager.ts / .js shim`, `shared/playback-event-helpers.ts / .js shim` |
| `prompt-refinement-workflow` | 雑な依頼や短いメモを、目的・制約・完了条件つきの正確な指示文 / prompt に変換したい時 | `.github/skills/prompt-refinement-workflow/SKILL.md`, rough notes, agent task prompts |
| `repo-skill-authoring-workflow` | 新しい skill を作る、既存 skill を整理する時 | `.github/skills/**/SKILL.md`, `SKILLS.md` |
| `safe-rational-refactor` | 局所整理を公開契約と責務境界を保ちながら進める時 | 既存コード全般 |
| `selfplay-training-pipeline-workflow` | selfplay 学習 profile、gate、promotion を回す時 | `scripts/load-training-profile.js`, `scripts/resolve-training-profile.js`, `scripts/run-selfplay-training-profile.js`, `scripts/run-selfplay-training-cycle.js`, `scripts/clean-selfplay-artifacts.js`, `scripts/rollback-policy-model.js`, `ai/train/*` |
| `selfplay-training-run-ops-workflow` | selfplay 学習 run の停止、再起動、run-tag 管理、監視コマンド提示を安全に回す時 | `scripts/load-training-profile.js`, `scripts/run-selfplay-training-profile.js`, `scripts/monitor-selfplay-training-run.js`, `data/runs/*` |
| `ui-bootstrap-load-order-workflow` | classic script の load order と DI を直す時 | `index.html`, `shared/ui-bootstrap-shared.js`, `ui/bootstrap.ts / .js compatibility shim`, `ui/handlers/init.ts / .js shim` |
| `worker-public-sync-workflow` | root と worker-public mirror を同期する時 | `scripts/prepare-worker-assets.ts / .js shim`, `index.html`, `worker-public/*` |

## 4. 選び方の近道

- 演出や再生の崩れ、board diff、visual regression: `animation-visual-playback-workflow`
- 新カード実装を既存 type 再利用か新 type 追加かの分岐から進め、selection / deferred publish まで通す: `new-card-implementation-workflow`
- 既存カードの削除 / 仕様変更 / 統合作業: `card-effect-integration-workflow`
- カードの cost 数値変更と tier / CPU 影響確認: `card-cost-adjustment-workflow`
- カードの `簡易説明` / `詳細説明` / `詳細効果`、重複除外、shared resolver の整理: `card-description-surface-workflow`
- pending selection、multi-stage target、deferred publish、selection cache、network handoff: `pending-selection-flow-workflow`
- marker の追加、duration、turn-start expire、STATUS_*: `marker-duration-lifecycle-workflow`
- board expansion、movement card、position-swap、expansion render / sound、CPU target: `board-expansion-movement-workflow`
- CPU の ONNX 利用条件、runtime guard、fallback: `cpu-onnx-gate-workflow`
- deck builder / deck spec・codec: `deck-builder-authoring-workflow`
- 設計書 / 計画書 / runbook / architecture contracts: `design-plan-runbook-authoring-workflow`
- network authority / worker / seat token / SSE / smoke: `network-backend-worker-workflow`
- Playwright で実ブラウザ 2 台を同室接続し、必要なら `tmp/playwright-network-verify/` に一時 runner を置いて network と見た目崩れを探す: `network-selfmatch-bug-hunt-workflow`
- network client 側の snapshot metadata / reconnect / playback queue: `network-playback-workflow`
- 雑な依頼、短いメモ、曖昧な指示を正確な指示文 / prompt に整理: `prompt-refinement-workflow`
- repo 向け skill 自体の追加 / 更新: `repo-skill-authoring-workflow`
- 局所的な責務整理 / helper 抽出 / 重複解消: `safe-rational-refactor`
- 段階的な構造変更の設計: `design-plan-runbook-authoring-workflow`
- selfplay / training / load-resolve / preflight / gate / promotion / rollback: `selfplay-training-pipeline-workflow`
- selfplay 学習 run の再起動 / log / monitor / stop: `selfplay-training-run-ops-workflow`
- classic script 順と shared bootstrap / DI: `ui-bootstrap-load-order-workflow`
- root から worker-public への prepare / mirror / deploy 同期: `worker-public-sync-workflow`

## 5. 補足

- skill は repo-wide rule を再定義しません。まず上位文書の境界を守ります。
- `worker-public/` を直接正本扱いせず、必要な時だけ mirror として同期します。
