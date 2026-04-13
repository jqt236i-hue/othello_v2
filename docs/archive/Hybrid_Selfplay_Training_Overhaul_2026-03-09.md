# 学習プログラム全面刷新計画 / 設計 / 実行手順書

最終更新: 2026-03-09  
対象: `othello_v2` の CPU 学習基盤  
位置づけ: 既存の `production_v2` / `hardcase_mining_v1` / `research_deepcfr_v1` を整理し、`自己対局主役 + 教師ブートストラップ + 品質ゲート昇格` に統一するための実行文書

## 0. 結論

- 本番主線は `純教師あり` ではなく `ハイブリッド自己対局` に固定する。
- 教師は「最終形」ではなく「立ち上げ用ブートストラップ」と「難局面の追加ラベル供給」に限定する。
- 本番 CPU は引き続き `モデル単独決定` を禁止し、`モデル候補生成 + 角端ルール + 短探索` のハイブリッドにする。
- 研究線は本番昇格線から分離し、DeepCFR 系は教師生成・比較実験に限定する。

## 1. この刷新で解決すること

現状は以下が混在している。

- `run-selfplay-training-cycle.js` に多数の責務が集まり、運用条件が CLI 引数へ広く分散している
- `production_v2` と hardcase 抽出と研究線が近く、何が本番昇格の主線か分かりにくい
- `teacherCommittee`、`policy-table`、`onnx`、探索補正の役割分担が文書上で一枚にまとまっていない
- 採用基準は存在するが、`何を改善したい run なのか` と `どのゲートを通すべきか` の対応が弱い
- hardcase 抽出と再学習が別工程として切り離されておらず、局所的な弱点修正の反復速度が低い

## 2. 現状整理

### 2.1 現在の強み

- 実行時 CPU はすでに `policy-table` / `ONNX` / 既存ヒューリスティック / 探索の混成構造を持つ  
  参照: `game/cpu-decision.js`, `game/ai/cpu-policy-core.js`
- Lv6 共通プロファイルに teacher / browser の分離がある  
  参照: `constants/cpu-lv6-shared-profile.js`
- 学習入口は profile 化されている  
  参照: `scripts/run-selfplay-training-profile.js`, `scripts/load-training-profile.js`
- 本番線、hardcase 抽出線、研究線の profile は既に分け始めている  
  参照: `ai/train/configs/profiles/*.yaml`
- 昇格判定に adoption gate / ONNX gate がある  
  参照: `ai/train/configs/gates/adoption_v2.yaml`

### 2.2 現在の弱み

- 本番線でも `teacher` と `league self-play` の責務がまだ曖昧
- hardcase を抽出しても、その再投入先が運用手順として固定されていない
- move / card / pending target / value の4層分離は設計意図があるが、運用の主線がまだ `move + card` 中心
- preflight は環境点検に寄っており、`run の再現性` や `データ契約の破損` の検査が弱い
- 本番モデル格納先、候補モデル格納先、研究モデル格納先の昇格ルールが運用文書として未固定

## 3. 刷新方針

### 3.1 方針A: 自己対局を主役にする

- 学習データの主成分は `league self-play` とする
- 教師ログ単独で本番採用を決めない
- 勝率だけでなく、角・端・再奪還・カード損益の品質を昇格条件へ含める

### 3.2 方針B: 教師は2用途に限定する

- ブートストラップ用途
  - 初期モデルの立ち上げ
  - collapse 防止
- hardcase 追加ラベル用途
  - 角献上
  - 端崩れ
  - pending target 選択
  - 高コストカード誤使用

### 3.3 方針C: 本番線と研究線を明確に分離する

- 本番線
  - `production_v3` 系 profile
  - 昇格対象は `policy-table`, `policy-net`, `policy-card`, 将来の `policy-target`, `policy-value`
- 補助線
  - `hardcase_mining_v2`
  - 難局面収集と追加ラベル生成専用
- 研究線
  - `research_*`
  - DeepCFR, solver, population 実験
  - 直接昇格禁止

### 3.4 方針D: 実行時 CPU はハイブリッドを維持する

本番 CPU の最終決定順は以下で固定する。

1. 合法手 / 合法行動生成
2. モデルで候補を上位化
3. 角端安全ルールで危険候補を減点または排除
4. 短探索で再順位付け
5. 異常時は既存ヒューリスティックへフォールバック

## 4. 目標アーキテクチャ

### 4.1 学習レーン

1. `Foundation Lane`
   - 教師 / 現行 champion から初期モデルを作る
   - 目的は「ゼロから変な手を覚えない」こと
2. `League Self-Play Lane`
   - champion / challenger / 旧モデル pool を混ぜて自己対局
   - policy diversity を維持しながら主データを生成
3. `Hardcase Lane`
   - self-play から悪い局面だけ抽出
   - 必要なら教師や solver で再ラベル
4. `Promotion Lane`
   - quality gate
   - quick adoption
   - final adoption
   - onnx gate
5. `Research Lane`
   - 本番昇格と切り離した実験

### 4.2 成果物レイヤ

- `policy-table`
  - ブラウザ fallback / 可観測比較 / adoption 指標用
- `policy-net.onnx`
  - 置き手候補生成の主線
- `policy-card.onnx`
  - カード使用 / 温存判断
- `policy-target.onnx`
  - pending target 選択用
- `policy-value.onnx`
  - 探索末端評価と candidate 再順位付け

### 4.3 データレイヤ

- `selfplay-main`
  - 本番自己対局の主データ
- `selfplay-eval`
  - seed 分離済み評価データ
- `hardcases`
  - 難局面だけ集めた高密度データ
- `teacher-solutions`
  - 教師再解答データ
- `promotion-snapshots`
  - 各 run の比較結果、採用判定、昇格元情報

## 5. 新しいディレクトリ責務

### 5.1 維持する場所

- `ai/train/configs/profiles/`
- `ai/train/configs/gates/`
- `data/models/`
- `data/runs/`

### 5.2 新設または再編する場所

- `ai/train/configs/profiles/production_v3.yaml`
  - 本番主線の正式 profile
- `ai/train/configs/profiles/foundation_bootstrap_v1.yaml`
  - 教師ブートストラップ専用
- `ai/train/configs/profiles/hardcase_mining_v2.yaml`
  - hardcase 収集専用
- `ai/train/configs/profiles/retrain_from_hardcases_v1.yaml`
  - hardcase 再学習専用
- `ai/train/configs/gates/promotion_v3.yaml`
  - 品質重視の昇格判定
- `data/models/promoted/champion/`
  - 現行採用モデル
- `data/models/promoted/challenger/`
  - 次回挑戦モデル
- `data/models/archive/<runTag>/`
  - 採用・不採用を含む保存先

## 6. 実装ワークストリーム

### 6.1 ワークストリーム1: profile と gate の整理

目的:

- 長い CLI の責務を profile/gate に寄せる
- run の種類を profile 名で判別できるようにする

実施項目:

- `production_v2` を凍結し、新規本線を `production_v3` として定義
- teacher bootstrap / league self-play / hardcase mining / hardcase retrain を別 profile 化
- `adoption_v2` を複製せず、`promotion_v3` で品質重視へ更新

主な変更対象:

- `ai/train/configs/profiles/*.yaml`
- `ai/train/configs/gates/*.yaml`
- `scripts/load-training-profile.js`

### 6.2 ワークストリーム2: 学習サイクルの分割

目的:

- 1本の train-cycle に混ざっている責務を分離する

分割対象:

- foundation run
- league self-play run
- hardcase extraction run
- retrain run
- promotion run

主な変更対象:

- `scripts/run-selfplay-training-cycle.js`
- 新設: `scripts/run-foundation-bootstrap.js`
- 新設: `scripts/run-hardcase-retrain.js`
- 新設: `scripts/extract-hardcases.js`

### 6.3 ワークストリーム3: hardcase 中心の反復改善

目的:

- 「どこで弱いか」を狙って改善できるようにする

hardcase 分類の初期セット:

- 角献上直前
- 角取り返し失敗
- 端維持失敗
- 高コストカード誤使用
- pending target 誤選択
- 終盤 solve 不一致

主な変更対象:

- `scripts/generate-selfplay-data*.js`
- 新設: `scripts/extract-hardcases.js`
- 新設: `scripts/export-hardcase-summary.js`

### 6.4 ワークストリーム4: モデル責務の分離

目的:

- 置き手とカード判断を別々に改善しやすくする

段階:

1. move / card を安定化
2. pending target を切り出す
3. value を導入して探索末端評価へ接続

主な変更対象:

- `ai/train/train_policy_onnx.py`
- `ai/train/train_card_onnx.py`
- 将来新設: `ai/train/train_target_onnx.py`
- 将来新設: `ai/train/train_value_onnx.py`
- `game/ai/policy-onnx-runtime.js`
- `game/cpu-decision.js`

### 6.5 ワークストリーム5: 昇格と切り戻しの厳格化

目的:

- 強い時だけ昇格し、悪化したら即戻せるようにする

主な変更対象:

- `scripts/benchmark-policy-adoption.js`
- `scripts/benchmark-policy-onnx-gate.js`
- `scripts/promote-policy-model.js`
- `data/models/promoted/*`

## 7. フェーズ計画

### Phase 0: 現状固定

成果:

- 現行 champion を明示
- 基準 run を固定
- 比較 seed を固定

作業:

- `production_v2` を凍結扱いにする
- 現行 `policy-table.json`, `policy-net.onnx`, `policy-card.onnx` を champion として退避
- baseline adoption 結果を保存

完了条件:

- `champion` ディレクトリと baseline レポートが揃う

### Phase 1: 設定再編

成果:

- `production_v3`, `foundation_bootstrap_v1`, `hardcase_mining_v2`, `retrain_from_hardcases_v1` を作成

作業:

- profiles 追加
- gate 追加
- launcher が新 profile を解決できることを確認

完了条件:

- `--dry-run` ですべての profile が解決できる

### Phase 2: 学習サイクル分割

成果:

- foundation と league と hardcase retrain が別実行になる

作業:

- train-cycle を orchestration 専用に寄せる
- 各レーンを独立スクリプト化する

完了条件:

- foundation 単独
- self-play 単独
- hardcase retrain 単独

の3経路がそれぞれ完走する

### Phase 3: hardcase パイプライン導入

成果:

- 負け筋局面だけを抽出して再学習できる

作業:

- self-play 出力から hardcase 抽出
- summary 生成
- teacher relabel を接続

完了条件:

- hardcase データ数
- 分類別件数
- 再学習入力件数

を run summary に残せる

### Phase 4: 本番 CPU 接続の再調整

成果:

- move / card / target / value の責務が整理される

作業:

- runtime 側のモデル読込責務を整理
- candidate rerank の優先順を固定

完了条件:

- モデル未読込でも正常動作
- モデル読込時に deterministic に動作

### Phase 5: 昇格運用の固定

成果:

- 研究結果と本番昇格を混同しない

作業:

- champion/challenger/archive の運用を固定
- promotion report に必須項目を追加

完了条件:

- どのモデルが何に勝って昇格したか追跡できる

## 8. 実行手順

### 8.1 Day 1: 基準固定

1. champion モデルを退避する
2. baseline adoption を実行する
3. `production_v2` を凍結 run として記録する

実行例:

```powershell
node scripts/run-selfplay-training-profile.js --profile production_v2 --dry-run
node scripts/benchmark-policy-adoption.js --games 800 --seed 1 --seed-count 5 --seed-stride 1000 --candidate-model data/models/policy-table.json
```

### 8.2 Day 2-3: profile / gate 再編

1. `production_v3.yaml` を作る
2. `foundation_bootstrap_v1.yaml` を作る
3. `hardcase_mining_v2.yaml` を作る
4. `retrain_from_hardcases_v1.yaml` を作る
5. `promotion_v3.yaml` を作る
6. 全 profile を `--dry-run` で検証する

### 8.3 Day 4-6: スクリプト分割

1. `run-selfplay-training-cycle.js` を orchestration 中心へ縮小
2. foundation bootstrap 専用スクリプトを追加
3. hardcase 抽出スクリプトを追加
4. hardcase retrain スクリプトを追加
5. summary JSON の schema を揃える

### 8.4 Day 7-9: hardcase 反復

1. 旧 champion vs challenger の self-play を実行
2. hardcase を抽出
3. 教師再ラベル
4. hardcase 再学習
5. quick adoption

### 8.5 Day 10-14: 本番接続と昇格試験

1. runtime 接続を調整
2. quality gate
3. final adoption
4. ONNX gate
5. champion 更新または据え置き

## 9. 受け入れ基準

### 9.1 設計完了条件

- profile ごとの役割が一意
- champion/challenger/archive 運用が固定
- hardcase 反復が明文化

### 9.2 実装完了条件

- 新 profile 群が解決できる
- 新スクリプト群が単独完走する
- summary / promotion report に必要項目が残る

### 9.3 運用完了条件

- challenger が champion に勝った時だけ昇格する
- どの seed / profile / gate で採用されたか追跡できる
- 切り戻しが 1 コマンドでできる

## 10. 失敗しやすい点と対策

### 10.1 self-play collapse

対策:

- foundation bootstrap を毎回残す
- champion / challenger / old pool の混合対戦にする
- hardcase だけ別レーンで濃く学習する

### 10.2 勝率だけ伸びて品質が悪化

対策:

- corner / edge / recapture / hold を昇格ゲートへ残す
- quality gate を adoption 前段へ固定

### 10.3 研究線が本番線を汚染

対策:

- `research_*` profile の直接昇格を禁止
- 本番昇格は `promotion_v3` 通過のみ許可

### 10.4 runtime と teacher の乖離

対策:

- `constants/cpu-lv6-shared-profile.js` の teacher/browser 共有設定を維持
- run summary に teacher 設定 snapshot を保存

## 11. 直近の実装順

優先度順に着手する。

1. `production_v3` / `promotion_v3` の追加
2. champion/challenger/archive の昇格運用固定
3. hardcase 抽出スクリプト追加
4. train-cycle の orchestration 化
5. `policy-target` / `policy-value` の段階導入

## 12. 今回の文書でまだ実装しないもの

- MCTS への全面置換
- ReBeL 系の public belief 実装
- browser runtime の大規模設計変更
- `01-rulebook.md` の仕様変更

## 13. この文書を使う時のルール

- 設計着手時はこの文書を親計画として扱う
- 挙動が変わる実装に入る前に `01-rulebook.md` 更新要否を毎回判定する
- 実装ごとの PR 相当作業では、この文書の Phase / Workstream 番号を紐付ける
- 完了報告では `どの phase まで終わったか` を明記する

