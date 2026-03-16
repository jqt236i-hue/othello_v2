# カードオセロ / SKILLS.md

最終更新: 2026-03-16

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
- 構造問題や再発不具合で大きく直す時は、`safe-rational-refactor` に押し込まず `design-plan-runbook-authoring-workflow` を先に使って phase を切る

## 3. skill index

| Skill | 使う時 | 主対象 |
| --- | --- | --- |
| `animation-visual-playback-workflow` | 演出順、board render、playback lock、visual regression を直す時 | `ui/animation-*`, `ui/presentation-handler.js`, `ui/playback-state-manager.js` |
| `card-effect-integration-workflow` | カード追加、削除、仕様変更を end-to-end で通す時 | `cards/catalog.json`, `game/card-effects/*`, pending target, CPU, presentation |
| `cpu-onnx-gate-workflow` | browser ONNX gate と benchmark / fallback をそろえる時 | `ui/handlers/cpu-policy.js`, `game/ai/policy-onnx-runtime.js`, benchmark scripts |
| `deck-builder-authoring-workflow` | deck builder と story-deck-lab の authoring UI を直す時 | `shared/deck-spec.js`, `shared/deck-codec.js`, `ui/deck-builder-*`, `ui/story-deck-lab/*` |
| `design-plan-runbook-authoring-workflow` | design / plan / runbook 文書を作る時 | `docs/*-plan*.md`, `docs/*-runbook*.md` |
| `network-backend-worker-workflow` | local match server と worker authority を直す時 | `scripts/local-match-server.js`, `workers/match-worker.mjs`, `scripts/match-network-smoke.js` |
| `network-selfmatch-bug-hunt-workflow` | Playwright で headed の 2 ブラウザを同室接続し、終局と UI / animation の崩れまで含めて network 特有の不具合を探す時 | `tmp/playwright-network-verify/*.js`, `ui/network-client.js`, `ui/network/snapshot.js`, `workers/match-worker.mjs` |
| `network-playback-workflow` | snapshot / reconnect / publish / playback queue を直す時 | `ui/network-client.js`, `ui/network/snapshot.js` |
| `repo-skill-authoring-workflow` | 新しい skill を作る、既存 skill を整理する時 | `.github/skills/**/SKILL.md`, `SKILLS.md` |
| `safe-rational-refactor` | 局所整理を最小差分で安全に進める時 | 既存コード全般 |
| `selfplay-training-pipeline-workflow` | selfplay 学習 profile、gate、promotion を回す時 | `scripts/run-selfplay-training-*.js`, `ai/train/*` |
| `story-tutorial-workflow` | tutorial / story の進行や overlay を直す時 | `ui/tutorial/*`, `ui/story/*`, handlers |
| `ui-bootstrap-load-order-workflow` | classic script の load order と DI を直す時 | `index.html`, `ui/bootstrap.js`, `ui/handlers/init.js` |
| `worker-public-sync-workflow` | root と worker-public mirror を同期する時 | `scripts/prepare-worker-assets.js`, `worker-public/*` |

## 4. 選び方の近道

- 演出や再生の崩れ: `animation-visual-playback-workflow`
- カードの追加 / 削除 / 表示や効果の一貫性: `card-effect-integration-workflow`
- CPU の ONNX 利用条件や fallback: `cpu-onnx-gate-workflow`
- deck builder / story-deck-lab: `deck-builder-authoring-workflow`
- 設計書や実行手順書: `design-plan-runbook-authoring-workflow`
- network authority / worker / smoke: `network-backend-worker-workflow`
- Playwright で実ブラウザを開いて別クライアント同士を最後まで対戦させ、network と見た目崩れを探す: `network-selfmatch-bug-hunt-workflow`
- network client 側の snapshot / reconnect / playback: `network-playback-workflow`
- repo 向け skill 自体の追加 / 更新: `repo-skill-authoring-workflow`
- 局所的な最小差分リファクタ: `safe-rational-refactor`
- 段階的な大幅改革の設計: `design-plan-runbook-authoring-workflow`
- selfplay / training / promotion: `selfplay-training-pipeline-workflow`
- story / tutorial / overlay: `story-tutorial-workflow`
- script 順と UI bootstrap: `ui-bootstrap-load-order-workflow`
- root から worker-public への同期: `worker-public-sync-workflow`

## 5. 補足

- skill は repo-wide rule を再定義しません。まず上位文書の境界を守ります。
- `worker-public/` を直接正本扱いせず、必要な時だけ mirror として同期します。
