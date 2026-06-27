# training/ AGENTS.md

Selfplay / teacher CPU / CNN-MCTS 学習パイプラインの正本ディレクトリ。CLI エントリは `scripts/`、Python トレーナーは `python/`、テストは `tests/`、補助 runbook は `docs/`。Use this file with the root `AGENTS.md`.

## Where to edit

| Task | Start here | Notes |
| --- | --- | --- |
| TS / JS CLI エントリ (`run-selfplay-*`, `preflight-*`, `monitor-*`, `export-*`, `benchmark-*`) | `scripts/*.ts` | CLI wrappers; root `scripts/*.js` は dist 経由の薄い shim。 |
| 自己対戦エンジン本体 (実体) | `../src/engine/selfplay-runner.ts` (root `src/engine/`) | 訓練の TS オーケストレーション本体はここ。`scripts/*.ts` は CLI のみ。 |
| Python トレーナー (CNN/MCTS/deepCFR) | `python/` | `Teacher_CPU_Spec_Template.md` を雛形に、`CPU_Training_Implementation_Runbook.md` で運用。サブ AGENTS.md は `python/AGENTS.md`。 |
| 訓練テスト | `tests/` | Jest スイートの一部 (`testMatch` がこのディレクトリを含む)。`game/ai/__tests__/`、`scripts/__tests__/` と並列。 |
| 補助 runbook / 計画 | `docs/` | ストレージクリーンアップ、teacher CPU 仕様、再現性ガイドなど。Active 表示のない日付入りファイルは歴史資料。 |
| 共有 TS 補助 | `shared/`, `engine/`, `constants/`, `game/`, `data/`, `src/` | 小さな TS 補助。`src/` は root `src/engine/` への 1 行 shim のみ。 |

## Boundaries

- 訓練は GPU / CPU どちらでも走る。訓練ランを勝手に開始しない (root `AGENTS.md` WORK RULES)。
- 自己対戦ロジック本体は root `src/engine/` 側。`scripts/*.ts` は CLI 引数の組み立てと subprocess / pipeline 起動に専念する。
- `python/` の Python トレーナーは TypeScript 学習オーケストレーションから subprocess 起動される前提。直接 import しない。
- 訓練アーティファクト (`data/`, root `data/`) は `.gitignore` 対象。明示的に依頼されない限り追加・コミットしない。
- `scripts/dist-cli-wrapper.js` のような JS は `node-cli-adapter` 分類。新たな `legacy-implementation` JS の追加は禁止 (`docs/typescript-migration-js-allowlist.md`)。
- シード・乱数源は canonical (root `shared/`, `src/engine/`)。訓練スクリプト側で局所乱数を発明しない。
- テスト・ベンチ・監査スクリプトが既存ランを上書きしない。Lane promotion と root デプロイは別フェーズ (`docs/architecture-contracts.md` §5.2.1)。

## Verification

- 訓練ジョブを実行する前に `preflight-selfplay-training.ts` または `preflight-deepcfr-training.ts` 相当の事前チェックを走らせる。
- 自己対戦ランの再現性は `docs/CPU_Training_Implementation_Runbook.md` と `docs/teacher-cpu-card-usage-buckets.md` に従う。
- Python トレーナー側は `python/AGENTS.md` を併読。
- 訓練スクリプトの TS 変更は `npm run typecheck` + `npm run build:ts` を通す。`npm run checkall` の `check-ts-migration-safety` が新規 `.ts` の `@ts-nocheck` を弾く。
- ベンチ・監査スクリプトの追加は `--smoke` 相当の軽量サンプルで先に動作確認する。