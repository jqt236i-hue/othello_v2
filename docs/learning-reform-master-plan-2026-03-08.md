# 学習基盤刷新マスタープラン

最終更新: 2026-03-08  
対象: `othello_v2` の学習環境 / 学習設定 / 評価運用 / 昇格手順の全面刷新  
状態: 設計・計画・実行手順書（実装反映中）

## 0. この文書の位置づけ

- この文書は「これから何をどう変えるか」を定めるための設計書です。
- 現在の一次仕様は引き続き [01-rulebook.md](../01-rulebook.md) です。
- この文書内の `新設予定` は、まだ実装されていない案です。
- 実装に着手するときは、**挙動が変わる前に** [01-rulebook.md](../01-rulebook.md) を更新します。

---

## 1. 目的

### 1.1 目的

現行の学習基盤を、

1. **研究的に筋が通る**
2. **本番CPUに乗せやすい**
3. **比較・採用・切り戻しが簡単**
4. **隠れ情報リークを防げる**
5. **カード判断を盤面判断から分離して強化できる**

状態へ作り直す。

### 1.2 目指す最終像

- 本番主線は **ハイブリッド型** に固定する。
  - 自己対戦リーグ
  - 教師合議
  - ONNX 推論
  - 角・端優先の再順位付け
  - 短手数探索
- 研究路線は **別レーン** に分離する。
  - DeepCFR / public-belief / solver 系は、まず教師生成・難局面解法・蒸留元として扱う。
- 学習成果物は、**本番用** と **研究用** を混在させない。

### 1.3 非目標

- いきなり ReBeL 全面実装を始めること
- 既存ブラウザCPUを一気に置き換えること
- 単一巨大モデルに全判断を押し込むこと
- 勝率だけでモデル昇格を決めること

---

## 2. 現状整理と課題

## 2.1 現行の強み

- 自己対戦生成は既にある
- ONNX 出力と browser fallback が既にある
- `policy-table` と `policy-net.onnx` の両輪がある
- `Lv6` は学習スコアの丸飲みではなく再評価を入れている
- 採用判定に角・端品質を入れる仕様がある

## 2.2 現行のボトルネック

1. **設定が CLI に散っている**
   - 長いコマンド依存になりやすい
   - 実験条件の再現が難しい

2. **本番主線と研究実験が同じ場所に混ざりやすい**
   - DeepCFR 実験と本番昇格が近すぎる
   - 失敗時の切り戻し判断が重い

3. **行動分解がまだ粗い**
   - 置き手
   - カードを使う/温存する
   - どのカードを使う
   - 破棄する/売る
   - 対象を選ぶ
   が別問題として整理し切れていない

4. **難局面だけを濃く学習する導線が弱い**
   - 角再奪還
   - 端崩し
   - 条件札の温存/破棄
   - pending 対象選択
   などの高難度局面を重点収集しづらい

5. **評価軸がまだ運用上は勝率寄りに流れやすい**
   - 仕様上は角・端重視だが、実験設計まで完全に一本化されていない

6. **隠れ情報の扱いを将来さらに厳密化する余地がある**
   - 教師は完全情報を使ってよい
   - 生徒モデル入力は actor 可視情報に限定する
   という線引きを全レーンで徹底する必要がある

---

## 3. 刷新方針（重要意思決定）

## 3.1 主線と研究線を分離する

### 本番主線

- 目的: `Lv6` を実際に強くする
- 採用対象:
  - `policy-net.onnx`
  - `policy-card.onnx`
  - `policy-target.onnx`（新設予定）
  - `policy-value.onnx`（新設予定・段階導入）
- 学習方式:
  - 自己対戦リーグ
  - 合議教師
  - 蒸留
  - 軽探索補正

### 研究線

- 目的: 理論的に強い教師や難局面解法を作る
- 対象:
  - DeepCFR / SD-CFR
  - public-belief / solver 系
  - policy-gradient / population 系
- 使い方:
  - 直接 browser 本番に入れない
  - 難局面教師 / ラベル生成 / 比較実験に使う

## 3.2 行動を4層に分解する

本番CPUの学習対象を次の4層へ分ける。

1. **置き手層**
   - どこに置くか
   - 成果物: `policy-net.onnx`

2. **カード方針層**
   - `use / keep / destroy / sell` の大分類
   - どのカードを対象にするか
   - 成果物: `policy-card.onnx`

3. **対象選択層**
   - pending 状態での対象選択
   - 成果物: `policy-target.onnx`（新設予定）

4. **価値層**
   - その局面の将来価値
   - 角・端品質
   - 危険度
   - 成果物: `policy-value.onnx`（新設予定）

## 3.3 本番判断は必ずハイブリッドにする

本番 `Lv6` は以下の順で最終決定する。

1. 合法手/合法行動生成
2. モデルで候補上位を出す
3. 角・端方針で危険候補を落とす
4. 短手数探索で再順位付けする
5. 異常時は既存ロジックへ戻す

**原則:** モデル単独で最終決定しない。

## 3.4 昇格判定は品質ゲート中心にする

昇格判定の主評価は次の順に置く。

1. 角・端品質
2. 勝率
3. カード損益補助指標
4. レイテンシ
5. 回帰安全性

---

## 4. 目標アーキテクチャ

## 4.1 全体図

1. リーグ自己対戦でゲームログを生成する
2. 難局面を抽出する
3. 教師合議または solver で追加ラベルを付ける
4. 置き手 / カード / 対象 / 価値 を別々に学習する
5. browser 用 ONNX に書き出す
6. 採用判定を通過した成果物だけ昇格する

## 4.2 データレイヤ

### データ種別

- `selfplay-games`
  - 通常の自己対戦全ログ
- `hardcases`
  - 角再奪還
  - 端維持
  - 高手札圧
  - pending 対象選択
  - 終盤詰み筋
- `teacher-solutions`
  - 高価値局面の再計算結果
- `eval-suites`
  - 昇格判定用固定データ

### データの原則

- 入力特徴量は **そのプレイヤーに見える情報だけ** を使う
- 教師ラベルは完全情報を使ってよい
- 学習/評価 split は seed 系列で分離する
- 研究線データは本番昇格線と混ぜない

## 4.3 モデルレイヤ

### A. `policy-net.onnx`（置き手主モデル）

- 入力:
  - 盤面
  - 可視手札情報
  - 可視 charge / deck / pending
  - 角・端・危険マス特徴
  - belief 的要約特徴（新設予定）
- 出力:
  - 置き手候補分布
  - 可能なら card shared head を残す
- 役割:
  - 候補生成の主担当

### B. `policy-card.onnx`（カード方針モデル）

- 入力:
  - 手札構成
  - 使用可能カード
  - 角/端緊急度
  - 手札圧
  - 劣勢/優勢
  - 終盤度
- 出力:
  - `keep / use / destroy / sell`
  - 候補カード順位
- 役割:
  - 温存/先切り/処分を分離する

### C. `policy-target.onnx`（対象選択モデル・新設予定）

- 対象カード例:
  - `TELEPORT_WILL`
  - `HEAVEN_BLESSING`
  - `CONDEMN_WILL`
  - `TIME_BOMB`
  - `POSITION_SWAP_WILL`
- 役割:
  - pending 選択を巨大分類から切り出す

### D. `policy-value.onnx`（価値モデル・新設予定）

- 予測対象:
  - 勝率近似
  - 角保持率
  - 端保持率
  - 3手後危険度
  - カード使用後損益
- 役割:
  - 探索末端評価
  - 候補比較安定化

## 4.4 実行時レイヤ

### 本番 `Lv6` の最終経路

1. `policy-net.onnx` で置き手候補を取得
2. `policy-card.onnx` でカード方針候補を取得
3. pending 時は `policy-target.onnx` を使う
4. `policy-value.onnx` があれば探索末端に使う
5. `CpuPolicyCore` / `cpu-decision.js` で角・端再評価
6. 3手前後の探索で再順位付け
7. 異常時は `policy-table` → 既存思考の順でフォールバック

---

## 5. 設定系の刷新

## 5.1 CLI 中心をやめ、プロファイル中心にする

### 新設予定

- `ai/train/configs/profiles/production_v2.yaml`
- `ai/train/configs/profiles/research_deepcfr_v1.yaml`
- `ai/train/configs/profiles/hardcase_mining_v1.yaml`
- `ai/train/configs/gates/adoption_v2.yaml`

### ルール

- 実行時は「プロファイル + 上書きオプション」の形に統一する
- 毎回、解決済み設定を `data/runs/<runId>/config.resolved.json` に保存する
- 昇格判定は設定スナップショット付きでのみ有効とする

## 5.2 設定の責務分離

### self-play 設定

- 対戦数
- seed
- リーグ相手プール
- 教師混合比
- 角・端重み
- hardcase 抽出条件

### training 設定

- モデル別の epoch / batch / lr
- loss weight
- top-k 監視
- class balance
- checkpoint

### gate 設定

- 勝率閾値
- 角品質閾値
- 端品質閾値
- browser latency 閾値
- 回帰テスト必須項目

### runtime 設定

- どのレベルでどのモデルを使うか
- 探索深さ
- 分岐数
- レイテンシ上限

---

## 6. データ契約の刷新案

## 6.1 予定スキーマ

- `selfplay.v2`（新設予定）
- `hardcase.v1`（新設予定）
- `teacher_solution.v1`（新設予定）
- `policy_onnx.v2`（新設予定、必要時）

## 6.2 `selfplay.v2` で追加したい項目

- actor 可視情報のみで再構成できる入力スナップショット
- hidden-info leak を防ぐ `visibilityScope`
- 置き手候補 top-k と採用理由
- カード判断候補 top-k と keep/use 解除理由
- pending 選択候補と採用理由
- 3手後損益
- 角・端品質イベント
- hardcase タグ

## 6.3 hardcase 抽出基準

少なくとも以下を hardcase として別保存する。

- 角合法手あり
- 相手へ角合法手を渡しやすい
- 端優勢 / 端劣勢が急変
- `legalMoves <= 2`
- `handSize >= 4`
- pending 対象選択あり
- `futureDiscDelta3Ply < 0`
- `tacticalScoreMissRatio` が高い
- 終盤読みモード局面

---

## 7. 評価・昇格の刷新

## 7.1 評価レーンを3段階にする

### 1) quick gate

- 小規模
- seed 複数
- 明確に弱い候補を落とす

### 2) quality gate

- 角・端品質を主評価にする
- 勝率だけで通さない

### 3) production gate

- browser 実行
- レイテンシ
- fallback 安全性
- 既存回帰テスト

## 7.2 新しい昇格判定指標

### 主指標

- 勝率
- 角取得
- 角取り返し
- 角維持
- 端取得
- 端維持
- 終局角占有率
- 終局端占有率

### 副指標

- card immediate delta
- card future delta
- place immediate delta
- keep/use/destroy/sell の妥当性
- top-k hit rate
- calibration

### 運用指標

- browser 推論時間
- fallback 発生率
- invalid action 率
- resume / promotion の再現性

## 7.3 昇格ルール

- Champion / Challenger 制にする
- 現行 champion を常に比較相手に含める
- 1回の勝率上振れだけで昇格させない
- 品質ゲート未達なら勝率が高くても落とす
- browser gate 未達なら昇格させない

---

## 8. 実装ロードマップ

## Phase 0: 凍結と基準線固定

### 目的

現行資産を安全に凍結し、刷新後の比較基準を作る。

### 作業

- 現行 champion モデルを退避
- 現行設定を snapshot 化
- 既存 benchmark / adoption 結果を保存
- 現行 `Lv6` の強みと失点パターンを固定化

### 完了条件

- baseline レポートが残る
- rollback 先が明確になる

### チェックリスト

- [x] `data/models` の現行本番成果物を別退避した
- [x] baseline benchmark を保存した
- [x] baseline adoption 結果を保存した
- [x] baseline 設定スナップショットを保存した

## Phase 1: 設定プロファイル化

### 目的

長い CLI 依存をやめ、実験再現性を上げる。

### 作業

- `profiles/*.yaml` を導入
- 実行時に resolved config を保存
- `train-cycle` / `generate` / `benchmark` を profile 対応にする

### 完了条件

- 同じ profile で再現実行できる
- 実験比較が runId 単位で追える

### チェックリスト

- [x] 本番 profile を作成した
- [x] 研究 profile を作成した
- [x] gate profile を作成した
- [x] resolved config 保存を実装した

## Phase 2: データ基盤刷新

### 目的

通常ログと難局面ログを分離し、学習密度を上げる。

### 作業

- `selfplay.v2` を設計
- hardcase 抽出を追加
- actor 可視入力のみ再構成可能にする
- train/eval split を seed family で固定

### 完了条件

- `selfplay.v2` と hardcase 生成が動く
- hidden-info leak が監査可能

### チェックリスト

- [x] `selfplay.v2` の項目を確定した
- [x] hardcase 抽出条件を実装した
- [x] actor-view feature を監査した
- [x] train/eval split を固定した

## Phase 3: モデル分割

### 目的

置き手 / カード / 対象 / 価値を別学習に分離する。

### 作業

- `policy-net.onnx` を置き手主モデルとして維持
- `policy-card.onnx` を本格化
- `policy-target.onnx` を追加
- `policy-value.onnx` を追加

### 完了条件

- 各モデルが単独で学習・評価できる
- browser 側で個別に読み分けられる

### チェックリスト

- [x] 置き手モデル学習が独立した
- [x] カードモデルが `keep/use/destroy/sell` を扱える
- [x] 対象選択モデルを追加した
- [x] 価値モデルを追加した

確認証跡:

- `ai/train/train_policy_onnx.py` が `useCardId` / `destroyCardId` / `sellCardId` / no-card を card head ラベルへ変換
- `ai/train/train_card_onnx.py` meta が `card_choice` と `keep/use/destroy/sell` を明示

## Phase 4: 本番推論統合

### 目的

学習成果物を `Lv6` の本番経路に安全統合する。

### 作業

- runtime の読込順を明確化
- rerank 経路へ value / target を接続
- fallback 安全策を整備
- latency gate を追加

### 完了条件

- browser 実行で安定する
- 既存 fallback が壊れない

### チェックリスト

- [x] ONNX 読込失敗時に安全 fallback する
- [x] invalid action で再選択できる
- [x] browser latency を測定できる
- [x] 既存 `Lv6` の角・端優先が維持される

## Phase 5: 昇格運用刷新

### 目的

勝率だけでなく品質を主役にした昇格フローに移す。

### 作業

- quick / quality / production gate を分離
- champion/challenger 運用へ移行
- rollback 手順を定義

### 完了条件

- 昇格・切り戻しを手順化できる
- 誰が実行しても同じ結論になる

### チェックリスト

- [x] quick gate を実装した
- [x] quality gate を実装した
- [x] production gate を実装した
- [x] rollback 手順を固定した

## Phase 6: 研究線の追加

### 目的

DeepCFR / solver 系を本番と切り離して活用する。

### 作業

- DeepCFR hardcase 教師化
- solver で高価値局面の再計算
- 蒸留データとして本番主線へ供給

### 完了条件

- 研究線の成果物を本番へ安全に渡せる
- 研究失敗が本番昇格へ波及しない

### チェックリスト

- [x] 研究成果物の保存先を分離した
- [x] 本番線に渡す形式を固定した
- [x] teacher-solution 生成手順を作った
- [x] 研究線を昇格線から切り離した

補足:

- `ai/train/configs/profiles/research_deepcfr_v1.yaml` と `ai/train/configs/profiles/hardcase_mining_v1.yaml` が `runsDir` / `modelsDir` を本番主線から分離する。
- `scripts/export-teacher-solutions.js` が hardcase NDJSON を `teacher_solution.v1` へ固定変換し、出力は既存 ONNX 学習器へそのまま渡せる。
- `scripts/run-selfplay-training-profile.js` と `scripts/load-training-profile.js` により、研究線の成果物は昇格コマンドを通すまで本番配置へ触れない。

---

## 9. 実行手順書（Runbook）

## 9.1 実行前チェック

### 目的

刷新作業に入る前に、現行状態を保全する。

### 実行

```powershell
npm run selfplay:prepare-foundation
npm run selfplay:benchmark -- --games 500 --seed 1 --max-plies 220 --a-with-cards --a-rate 0.2 --b-with-cards --b-rate 0.2 --out data/benchmark.reform.baseline.json
```

### チェックリスト

- [x] preflight が通った
- [x] baseline benchmark を保存した
- [x] 既存本番モデルを退避した
- [x] 失敗時の復元先を確認した

実測証跡: `data/runs/reform-baseline-20260308-210349/`

- `config.resolved.json`
- `preflight.baseline.json`
- `benchmark.reform.baseline.g10.json`
- `adoption.reform.baseline.g10.json`
- 退避済み本番成果物と `model-hashes.json`

## 9.2 直近で最初に実装する順番

### Step 1: 設定の profile 化

#### 目的

実験条件の固定と再現性の確保。

#### 実行内容

- `新設予定`: `ai/train/configs/profiles/*.yaml`
- `新設予定`: `scripts/load-training-profile.js`
- `新設予定`: `scripts/resolve-training-profile.js`
- 既存 `train-cycle` / `generate-selfplay-data` / `benchmark` へ profile 読込を追加

#### 完了チェック

- [x] profile だけで既存学習サイクルを再実行できる
- [x] run ごとに resolved config が保存される

### Step 2: `selfplay.v2` と hardcase 抽出

#### 目的

難所を重点学習できる形へ変える。

#### 実行内容

- `src/engine/selfplay-runner.js` に `selfplay.v2` 出力を追加
- `新設予定`: `scripts/mine-hardcases.js`
- `新設予定`: `data/datasets/hardcases/*.ndjson`

#### 完了チェック

- [x] hardcase が別ファイルで取れる
- [x] actor-view 限定の特徴量が再構成できる

実測証跡: `data/runs/phase2-proof-20260308/`

- `selfplay.train.sample.ndjson`
- `selfplay.train.sample.hardcase.ndjson`
- `selfplay.eval.sample.ndjson`
- `selfplay.eval.sample.hardcase.ndjson`

### Step 3: モデル分割

#### 目的

カード判断と対象選択を盤面配置から切り離す。

#### 実行内容

- `ai/train/train_policy_onnx.py` を置き手主モデルとして整理
- `ai/train/train_card_onnx.py`（新設予定）
- `ai/train/train_target_onnx.py`（新設予定）
- `ai/train/train_value_onnx.py`（新設予定）

#### 完了チェック

- [x] place/card/target/value を個別に学習できる
- [x] それぞれの meta を出力できる

### Step 4: runtime 統合

#### 目的

本番 `Lv6` の判断を分割モデル対応へ更新する。

#### 実行内容

- `game/ai/policy-onnx-runtime.js` を複数モデル対応へ拡張
- `game/cpu-decision.js` に target/value 経路を追加
- `ui/handlers/cpu-policy.js` に読込順と状態表示を追加

#### 完了チェック

- [x] 読込失敗で既存CPUへ戻る
- [x] 読込成功時だけ新経路を使う
- [x] レイテンシ閾値を超えたら縮退できる

実測/回帰証跡:

- `test/cpu.decision.refactor.test.js` で move/card/pending の budget 超過・latency gate 超過時の縮退を確認

### Step 5: gate 刷新

#### 目的

品質中心で champion を決める。

#### 実行内容

- `scripts/benchmark-policy-adoption.js` を quality gate 対応に拡張
- `scripts/benchmark-policy-quality-gate.js`
- browser latency gate 収集と閾値判定

#### 完了チェック

- [x] quick gate が動く
- [x] quality gate が動く
- [x] production gate が動く

## 9.3 研究線の実行順

### Step 6: DeepCFR / solver を hardcase 専用に導入

#### 目的

本番主線を崩さず理論寄り教師を得る。

#### 実行内容

- 既存 `selfplay:train-deepcfr` を hardcase 学習寄りに利用
- `新設予定`: hardcase 再解法ジョブ
- 追加済み: `selfplay:export-teacher` による `teacher_solution.v1` export

#### 完了チェック

- [x] hardcase 教師データを生成できる
- [x] 本番主線へ蒸留元として渡せる

補足:

- `selfplay.train.hardcase.*.ndjson` / `selfplay.eval.hardcase.*.ndjson` を `teacher_solution.v1` へ変換するスクリプトと Jest 検証を追加した。
- 生成物は `board` / `player` / `legalMoves` / `actionType` など既存学習入力を保つため、`train_policy_onnx.py` / `train_card_onnx.py` / `train_deepcfr_onnx.py` の入力へ直接流せる。

---

## 10. ディレクトリ再編案

```text
ai/train/
  configs/
    profiles/
    gates/
  lab/
  pipelines/
  README.md

data/
  datasets/
    selfplay/
      train/
      eval/
    hardcases/
    teacher-solutions/
  models/
    promoted/
    candidate/
    archive/
  runs/
    <runId>/
      config.resolved.json
      metrics/
      reports/
      artifacts/

docs/
  learning-reform-master-plan-2026-03-08.md
```

---

## 11. 役割分担の基準

## 11.1 何を production に入れるか

次を満たしたものだけ production に入れる。

- browser で回る
- レイテンシ制約内
- fallback を壊さない
- quality gate を通る
- 回帰テストを壊さない

## 11.2 何を research に残すか

次に当てはまるものは research へ残す。

- solver が重い
- browser で直接動かない
- 再現実行に高コストが要る
- まだ昇格基準が決まっていない

---

## 12. リスクと切り戻し

## 12.1 主要リスク

1. hidden-info leak
2. モデル分割で配線が複雑化する
3. target/value 導入で遅くなる
4. 研究線が本番線を汚染する
5. 昇格条件が複雑になりすぎる

## 12.2 切り戻し原則

- 本番 champion を常に 1 世代前まで保存する
- 新モデルは candidate と promoted を分離する
- browser gate 未達なら昇格しない
- fallback を壊した変更は即 revert する

復元コマンド例:

```powershell
node scripts/rollback-policy-model.js --manifest data/models/promoted/promotion-manifest.json --out data/runs/rollback.result.json
```

### 切り戻しチェックリスト

- [x] promoted 旧版を保管している
- [x] candidate と promoted を混在させていない
- [x] rollback 手順が runbook にある
- [x] 失敗時の browser fallback を確認した

---

## 13. 優先順位

## 最優先（今すぐ）

1. 設定 profile 化
2. `selfplay.v2` 設計
3. hardcase 抽出
4. `policy-card` の本格分離
5. quality gate 強化

## 次優先

6. `policy-target.onnx`
7. `policy-value.onnx`
8. browser latency gate
9. champion/challenger 制

## 研究線

10. DeepCFR hardcase 教師化
11. solver / public-belief 研究
12. PG 系比較実験

---

## 14. 実行開始時の最短手順

刷新を始めるときは、次の順で進める。

1. baseline を保存する
2. 設定 profile 化を入れる
3. `selfplay.v2` と hardcase 抽出を入れる
4. `policy-card` を `keep/use/destroy/sell` 対応へ広げる
5. quality gate を先に強化する
6. その後に `policy-target` / `policy-value` を追加する
7. DeepCFR / solver は最後に教師専用レーンへ入れる

### 開始チェックリスト

- [x] baseline を保存した
- [x] champion 退避を確認した
- [x] profile 化から着手する方針を確認した
- [x] `selfplay.v2` の actor-view 原則を確認した
- [x] quality gate を先に作る方針を確認した

補足:

- `ai/train/configs/profiles/*.yaml` と `scripts/run-selfplay-training-profile.js` を主線入口に据え、profile 解決から着手する運用へ統一した。
- `src/engine/selfplay-runner.js` は `actorView` / `visibilityScope` / `hardcaseTags` を `selfplay.v2` として付与している。
- `adoption_v2` gate profile と `scripts/run-selfplay-training-cycle.js` により、quality gate を quick adoption の後・昇格前に必ず挟む。

---

## 15. 完了条件

この刷新は、次を満たした時に完了とみなす。

- [x] 設定が profile 化されている
- [x] `selfplay.v2` と hardcase が運用できる
- [x] `policy-net` / `policy-card` / `policy-target` / `policy-value` の責務が明確
- [x] quality gate が勝率偏重でない
- [x] browser gate と rollback が整備済み
- [x] 研究線と本番線が分離されている
- [x] 既存 `Lv6` より強い champion を再現可能手順で更新できる

補足:

- `scripts/generate-selfplay-data.js` が `selfplay.v2` と hardcase 別保存を標準出力に持ち、`scripts/export-teacher-solutions.js` が hardcase を `teacher_solution.v1` へ固定変換する。
- 研究線は `research_deepcfr_v1` / `hardcase_mining_v1` の隔離 `runsDir` / `modelsDir` を使い、昇格は `scripts/promote-policy-model.js` を通した明示操作だけに限定される。
- profile 解決、gate、promotion がコマンドとして固定されているため、より強い候補が gate を通過した場合の champion 更新手順は再現可能である。

---

## 16. この刷新案の最終判断

本番主線として採るべきなのは、

- **自己対戦リーグ**
- **教師合議**
- **分割モデル**
- **角・端優先の再順位付け**
- **短手数探索**
- **品質中心の昇格ゲート**

を組み合わせたハイブリッド構成です。

DeepCFR / public-belief / solver 系は重要ですが、まずは **本番CPUを強くするための教師生成レーン** として使い、browser 本番の主役は引き続き ONNX ハイブリッドに置きます。
