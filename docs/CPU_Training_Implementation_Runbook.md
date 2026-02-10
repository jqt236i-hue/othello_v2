# 最強CPU実装・学習 完遂計画書

最終更新: 2026-02-10  
対象リポジトリ: `othello_v2`

## 1. 目的

- 人間がほぼ勝てないCPUを、**このリポジトリ内だけで完結**して実装する。
- 学習だけでなく、**ブラウザ版の対戦CPUとして実運用**できる状態まで完遂する。
- `headless` とブラウザで挙動を合わせ、再現可能な手順で改善を継続できる状態にする。

## 2. ゴール定義（完了条件）

以下を全て満たしたら完了とする。

1. CPU強化の判定基準が固定され、毎回同じ条件で比較できる。
2. 学習データ生成、学習、評価、モデル反映の手順が1本化されている。
3. 学習結果がブラウザ版CPUに組み込まれ、未読込時の安全なフォールバックがある。
4. 回帰テストと再現テストが通り、ゲーム進行・演出・UIを壊さない。
5. 「新モデル採用条件」を満たした場合のみCPUを更新できる。

## 3. 現状（2026-02-08時点）

既に存在する実装:

- self-play実行基盤: `src/engine/selfplay-runner.js`
- データ生成: `scripts/generate-selfplay-data.js`
- 方針比較ベンチ: `scripts/benchmark-selfplay-policy.js`
- CPU選択コア: `game/ai/cpu-policy-core.js`
- CPU判断本体: `game/cpu-decision.js`
- Python学習雛形:
  - `ai/train/train_policy_table.py`
  - `ai/train/evaluate_policy_table.py`
  - `ai/train/setup.ps1`

利用可能コマンド:

- `npm run selfplay:generate`
- `npm run selfplay:benchmark`
- `npm run test:jest`
- `npm run check:window`

## 4. 全体アーキテクチャ（設計）

## 4.1 学習パイプライン

1. `selfplay-runner` で対戦ログ（NDJSON）を生成
2. Pythonでモデル（JSON）を学習
3. 同形式の別データで評価
4. ブラウザCPUへモデルを読み込んで利用
5. ベンチ勝率で採用可否を判定

## 4.2 実行時CPUの構成

- 第1層: ルール上の合法手生成（既存）
- 第2層: 学習モデルによる優先順位付け
- 第3層: 安全フォールバック（既存ロジック）

方針:

- 学習モデルがなくても必ず動く。
- モデル読み込み失敗時は自動で既存CPUへ戻る。
- 既存の `game -> ui` 境界を崩さない。

## 4.3 データ契約（固定）

- self-play記録スキーマ: `selfplay.v1`（`src/engine/selfplay-runner.js`）
- 学習モデルスキーマ: `policy_table.v2`（`ai/train/train_policy_table.py`）

ルール:

- スキーマ変更時はバージョンを必ず更新する。
- 旧バージョン読み込み時は明示エラーを出す。
- 補足: 実行時は `v1` / `v2` 互換読み込みを許可するが、学習出力と新規採用判定は `v2` を正とする。

## 5. 実行フェーズ（詳細手順）

## フェーズ0: 基準線固定

目的:

- 改善前の強さを固定条件で保存し、比較可能にする。

作業:

1. 既存CPU同士の固定シードベンチ結果を保存
2. 以降の採用基準を明文化

実行:

```powershell
npm run selfplay:benchmark -- --games 500 --seed 1 --max-plies 220 --a-with-cards --a-rate 0.2 --b-with-cards --b-rate 0.2 --out data/benchmark.baseline.json
```

完了条件:

- `data/benchmark.baseline.json` が生成される。
- 今後の比較時に同じコマンドを再利用できる。

## フェーズ1: データ生成の本番運用化

目的:

- 学習用と評価用データを分離し、過学習を抑える。

作業:

1. 学習データ生成（大規模）
2. 評価データ生成（別seed）
3. 生成ログ/件数確認

実行:

```powershell
npm run selfplay:generate -- --games 20000 --seed 1 --max-plies 220 --with-cards --card-usage-rate 0.2 --out data/selfplay.train.ndjson
npm run selfplay:generate -- --games 3000 --seed 100001 --max-plies 220 --with-cards --card-usage-rate 0.2 --out data/selfplay.eval.ndjson
```

完了条件:

- `train` と `eval` が別ファイルで生成される。
- summary JSONに `schemaVersion` が記録される。

## フェーズ2: Python学習（初版）

目的:

- まずは安定して再現できる学習ループを作る。

作業:

1. Python環境セットアップ
2. 方策表モデル学習
3. 評価レポート確認

実行:

```powershell
.\ai\train\setup.ps1
.\.venv\Scripts\python.exe .\ai\train\train_policy_table.py --input data/selfplay.train.ndjson --model-out data/models/policy-table.json --min-visits 3
.\.venv\Scripts\python.exe .\ai\train\evaluate_policy_table.py --input data/selfplay.eval.ndjson --model data/models/policy-table.json
```

補足:

- 学習用追加パッケージの管理先は `ai/train/requirements.txt` とする（ルート直下の `requirements.txt` は使わない）。
- `train_policy_table.py` の出力 `schemaVersion` が `policy_table.v2` であることを毎回確認する。

完了条件:

- `data/models/policy-table.json` が生成される。
- 評価コマンドがエラーなく最後まで完走する。

## フェーズ3: ブラウザCPUへの組み込み

目的:

- 学習結果をブラウザ対戦で実際に使えるようにする。

実装対象:

- 新規: `game/ai/policy-table-runtime.js`（読み込み・問い合わせ）
- 変更: `game/cpu-decision.js`（候補手順位にモデルを反映）
- 必要に応じて: `index.html`（読み込み順）

設計ルール:

1. モデル読込失敗時は既存選択ロジックへ即時フォールバック
2. CPUレベル別にON/OFF可能にする（例: Lv4以上で有効）
3. 読み込み・参照は `game/` 内で完結し、`ui/` 非依存にする

完了条件:

- モデル有無の両方でCPUが正常動作する。
- 既存テストが落ちない。

## フェーズ4: 強さ改善（探索 + 学習）

目的:

- 学習のみではなく読み（探索）と組み合わせて上限を引き上げる。

作業:

1. 候補手の探索優先順を導入
2. 学習スコアを探索順へ反映
3. ターン時間上限内で安定動作

推奨実装:

- `CpuPolicyCore.chooseMove` に「学習優先順位」を注入可能にする
- 同点時の決定順を固定して再現性を維持する

完了条件:

- 同seedで結果が再現する。
- `selfplay:benchmark` で基準線を統計的に上回る。

## フェーズ5: 採用判定と更新ルール

目的:

- 「強い時だけ更新」を機械的に判定する。

採用基準（更新版）:

1. ベンチ総合スコアが基準線 +5%以上
2. 反転不能・進行停止・例外発生が0件
3. 既存主要テストが全通過
4. 最終判定は `games=2000`（先行ふるいは `games=500` を許可）
5. 自己対戦だけで採用確定しない。人間操作を含む確認対戦ログを残す（最低20ゲーム、同条件）

判定の進め方:

1. 先行ふるい: `games=500` で候補を絞る
2. 本判定: `games=2000` で再判定
3. 人間操作を含む確認対戦ログを保存して採用可否を最終確定

実行:

```powershell
npm run selfplay:benchmark -- --games 500 --seed 1 --max-plies 220 --a-with-cards --a-rate 0.25 --b-with-cards --b-rate 0.2 --a-model data/models/policy-table.candidate.json --out data/benchmark.candidate.quick.json
npm run selfplay:benchmark -- --games 2000 --seed 1 --max-plies 220 --a-with-cards --a-rate 0.25 --b-with-cards --b-rate 0.2 --a-model data/models/policy-table.candidate.json --out data/benchmark.candidate.final.json
npm run test:jest
npm run check:window
```

完了条件:

- 採用基準をすべて満たしたモデルのみ本採用する。

採用判定の自動化:

```powershell
npm run selfplay:adoption-check -- --games 500 --seed 1 --max-plies 220 --threshold 0.05 --candidate-model data/models/policy-table.candidate.json --out data/benchmark.adoption.quick.json
npm run selfplay:adoption-check -- --games 2000 --seed 1 --max-plies 220 --threshold 0.05 --candidate-model data/models/policy-table.candidate.json --out data/benchmark.adoption.final.json
```

補足:

- 終了コード `0`: 採用基準を満たす
- 終了コード `2`: 採用基準未達（比較は成功）
- 終了コード `1`: 実行エラー

採用後の反映:

```powershell
npm run selfplay:promote-model -- --adoption-result data/benchmark.adoption.final.json --candidate-model data/models/policy-table.candidate.json
```

補足:

- 判定が `passed=true` のときのみ `data/models/policy-table.json` へ反映される。
- 強制反映が必要なときだけ `--force` を使う。

## 6. テスト計画

## 6.1 自動テスト

- `test/selfplay.runner.test.js`
- `test/selfplay.benchmark-policy.test.js`
- `test/game.cpu-policy-core.test.js`
- `test/cpu.decision.refactor.test.js`

## 6.2 追加テスト実装状況

1. モデル読み込み失敗時フォールバックの単体テスト: 実装済み（`test/ui.cpu-policy-handler.test.js`）
2. ブラウザCPUでモデル有/無の選択分岐テスト: 実装済み（`test/ui.cpu-policy-handler.test.js`）
3. `headless` とブラウザのモデル解釈一致テスト: 実装済み（`test/selfplay.runtime-parity.test.js`）

## 7. 失敗時の切り戻し

ルール:

1. モデルが壊れていてもCPUは必ず対戦継続する。
2. 異常検出時はモデル利用を自動停止する。
3. 停止時は既存 `CpuPolicyCore` のみで動作する。

最低限の安全策:

- モデルスキーマ不一致なら読み込まない
- JSON破損なら読み込まない
- 不正な手を返したら既存ロジックで再選択

## 8. 運用ループ（反復）

1. データ生成
2. 学習
3. 評価
4. ベンチ比較
5. 採用判定
6. 組み込み更新

この6手順を1サイクルとして繰り返す。

## 9. 実行チェックリスト（毎回）

1. `train` / `eval` のseedが分離されている
2. スキーマ版が一致している
3. ベンチ比較結果が保存されている
4. 自動テストが通っている
5. ブラウザで1ゲーム通し確認済み

## 10. 直近の実行順（推奨）

1. フェーズ0の基準線保存
2. フェーズ1の本番量データ生成
3. フェーズ2の学習/評価
4. フェーズ3のブラウザ組み込み実装
5. フェーズ4の強化
6. フェーズ5の採用判定

---

この計画は、学習実験だけで終わらせず、**ブラウザ対戦CPUとして実装完了すること**を前提としている。

## 11. 最新実行メモ（2026-02-08）

- ランID: `20260208-155701`
- 生成:
  - `data/selfplay.train.20260208-155701.ndjson`（12000ゲーム）
  - `data/selfplay.eval.20260208-155701.ndjson`（2000ゲーム）
- 学習候補:
  - `data/models/policy-table.candidate.20260208-155701.mv3.json`
  - `data/models/policy-table.candidate.20260208-155701.mv5.json`
  - `data/models/policy-table.candidate.20260208-155701.mv8.json`
  - `data/models/policy-table.candidate.20260208-155701.mv12.json`
- 採用判定:
  - `data/runs/adoption.20260208-155701.mv3.json`
  - `data/runs/adoption.20260208-155701.mv5.json`
  - `data/runs/adoption.20260208-155701.mv8.json`
  - `data/runs/adoption.20260208-155701.mv12.json`
  - 追加検証: `data/runs/adoption.20260208-155701.mv3.postcardfix.json`
- 結果:
  - いずれも `baseline=0.500 / candidate=0.500 / uplift=0.000` で採用基準未達。

次の改善軸:

1. 学習ターゲットを「行動選択の価値差」に寄せる（単純平均からの脱却）。
2. モデル特徴量を増やす（局面段階・手番情報・カード行動文脈）。
3. 探索の強化（候補絞り後に浅い読みを追加）。

追加検証（同日）:

- 抽象状態 `abstractStates` を導入（v2互換の追加フィールド）。
- 安全のため、抽象状態は「カード使用判断」のみ参照し、石配置判断には未適用。
- 学習ターゲット拡張:
  - `--shape-immediate`（即時石差分の混合）を追加。
  - 試行値 `0.1 / 0.25 / 0.4` で短時間判定を実施。
- 結果:
  - `data/runs/adoption.20260208-155701.shape0p1.mv5.json`
  - `data/runs/adoption.20260208-155701.shape0p25.mv5.json`
  - `data/runs/adoption.20260208-155701.shape0p4.mv5.json`
  - いずれも `uplift=0.000`（未採用）
