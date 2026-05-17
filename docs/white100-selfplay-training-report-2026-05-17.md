# 白専用 CPU 学習レーン詳細レポート

作成日: 2026-05-17  
対象リポジトリ: `C:\Users\quarr\Desktop\othello_v2`  
対象プロファイル: `browser_lv6_growth_v1`  
対象 run: `browser_lv6_growth_v1_20260517_white100_cpu`

## 要約

現在の学習方針は「実運用で CPU が白しか担当しない」ことを前提に、白番 CPU の性能を最優先で伸ばす方針である。黒番性能は採用判定の主目的から外し、黒は白 CPU が対峙する環境・対戦相手・局面生成側として扱う。

この方針に合わせて、採用評価の `--adoption-white-priority` は `1.0` に変更済みである。これにより、candidate モデルの採用判定における core score は白番視点の成績だけを見る。黒番の総合勝率成分は core score から除外される。

ただし、現時点で白専用化されているのは主に「採用評価」である。自己対局データそのものには黒手番・白手番の両方が含まれる。ONNX / table 学習の loss も、現設定だけでは白手番サンプルだけに限定されていない。したがって、現在の段階は「白専用採用評価レーン」であり、完全な「白手番サンプル専用学習」ではない。

## 現在の実行状態

確認時点の monitor 状態は以下である。

- run: `browser_lv6_growth_v1_20260517_white100_cpu`
- status: `running`
- phase: `自己対局(train)`
- progress: `240/9000 games`
- iterations: `0/999 completed`, current `1/999`
- gate: `every-iteration`
- baseline: `anchor`
- failure: `none`

実行ディレクトリは以下。

```text
data/runs/browser_lv6_growth_v1/browser_lv6_growth_v1_20260517_white100_cpu
```

主要な出力予定は以下。

```text
data/runs/browser_lv6_growth_v1/browser_lv6_growth_v1_20260517_white100_cpu/config.resolved.json
data/runs/browser_lv6_growth_v1/browser_lv6_growth_v1_20260517_white100_cpu/preflight.json
data/runs/browser_lv6_growth_v1/browser_lv6_growth_v1_20260517_white100_cpu/training-cycle.summary.json
data/runs/browser_lv6_growth_v1/browser_lv6_growth_v1_20260517_white100_cpu/launcher.log
```

## このレーンの目的

`browser_lv6_growth_v1` は、ブラウザ Lv6 CPU の累積成長用レーンである。deploy 用の promoted-only 主線とは分離されており、root deploy の既存モデルを bootstrap として取り込みつつ、candidate を iteration ごとに継続学習する。

このレーンの目的は、厳密な本番 non-regression 判定ではなく、隔離された `data/models/browser_lv6_growth_v1` と `data/runs/browser_lv6_growth_v1` の中で raw strength を積み上げることである。本番反映を強く保証する deploy レーンとは役割が違う。

現在はさらに、運用上 CPU が白しか担当しない前提に合わせて、採用評価を白 100% にしている。これにより、黒番としての candidate の強さより、白番 CPU として相手に勝てるかを優先する。

## 参照している主な設定ファイル

学習プロファイル:

```text
ai/train/configs/profiles/browser_lv6_growth_v1.yaml
```

採用ゲート:

```text
ai/train/configs/gates/browser_lv6_growth_v1.yaml
```

resolved config:

```text
data/runs/browser_lv6_growth_v1/browser_lv6_growth_v1_20260517_white100_cpu/config.resolved.json
```

白 CPU 専用デッキ定義:

```text
shared/deck-spec.ts
```

自己対局デッキ引数の補助:

```text
scripts/selfplay-deck-options.ts
```

採用評価の式:

```text
scripts/benchmark-policy-adoption.ts
```

training cycle から adoption benchmark へ引数を渡す箇所:

```text
scripts/training-cycle-command-builders.ts
```

## 起動方法

今回の run は以下の条件で起動している。

```powershell
node scripts/run-selfplay-training-profile.js `
  --profile browser_lv6_growth_v1 `
  --run-tag browser_lv6_growth_v1_20260517_white100_cpu `
  -- `
  --max-hours 500 `
  --selfplay-jobs 4 `
  --adoption-jobs 4 `
  --onnx-gate-jobs 4 `
  --onnx-device cpu `
  --onnx-batch-size 512
```

プロファイル本体には `--selfplay-jobs 10`、`--adoption-jobs 16`、`--onnx-batch-size 2048`、`--onnx-device auto` が定義されているが、今回の起動では pass-through 引数で以下が上書きされている。

- `--selfplay-jobs 4`
- `--adoption-jobs 4`
- `--onnx-gate-jobs 4`
- `--onnx-device cpu`
- `--onnx-batch-size 512`
- `--max-hours 500`

つまり、設定ファイル上の標準値より軽めの CPU 実行として動いている。

## Bootstrap とモデル管理

bootstrap は root の既存モデルを isolated lane にコピーまたは保持する方式である。

入力元:

```text
data/models/policy-table.json
data/models/policy-net.onnx
data/models/policy-net.onnx.meta.json
```

レーン内の保存先:

```text
data/models/browser_lv6_growth_v1/policy-table.json
data/models/browser_lv6_growth_v1/policy-net.onnx
data/models/browser_lv6_growth_v1/policy-net.onnx.meta.json
```

resolved config 上では、今回の bootstrap action は既存ファイルを保持する `kept-existing` になっている。`autoResumeLatestCheckpoint` は `false` だが、training cycle 側の `--carry-over-checkpoint` により iteration 間では checkpoint を引き継ぐ設計である。

## 自己対局データ生成

各 iteration で、まず training 用の自己対局データを生成する。

主な設定は以下。

- train games: `9000`
- eval games: `320`
- max plies: `180`
- seed: `1`
- seed stride: `1000`
- cards: enabled
- hardcase generation: disabled by `--no-selfplay-hardcases`
- resume chunk size: `1000`
- current run の selfplay jobs: `4`

iteration 1 の自己対局コマンドでは、以下のように train データが出力される。

```text
data/runs/browser_lv6_growth_v1/selfplay.train.browser_lv6_growth_v1_20260517_white100_cpu.it01.ndjson
```

自己対局は chunk 実行される。今回の 9000 games では、ログ上 `run chunk 1/9 games=1000 offset=0` のように 1000 games 単位で進む。

## カード使用率

プロファイル全体には `--card-usage-rate 0.60` があるが、自己対局では staged schedule が有効である。

```text
--selfplay-card-usage-rate-schedule 0.20@1,0.28@4,0.36@8,0.48@12,0.60@20
```

このため、iteration 1 では自己対局のカード使用率は `0.20` で始まる。以後、iteration が進むにつれて 0.28、0.36、0.48、0.60 と段階的に増える。

さらに `--selfplay-card-usage-rate-jitter 0.01` があるため、各ゲームまたは方策構築時に小さな揺らぎが入る。目的は、単一の固定使用率に過適合することを避け、少し広い分布でカード判断を学ばせることにある。

## 白専用デッキ

白には CPU Lv6 用の固定デッキが使われる。

定義元:

```text
shared/deck-spec.ts
```

デッキコード:

```text
D1C1:chest_01.hard_01.swap_01.position_swap_01.perma_01.strong_wind_01.super_buoyancy_01.super_gravity_01.tempt_01.capture_01.regen_01.udr_01.seed_01.teleport_01.hyperactive_01.will_hunter_king_01.loss_will_01.gold_stone.silver_stone.extend_life_01.guard_01.destroy_dragon_01.lightning_01.udg_01.ultimate_hyperactive_01.board_expand_01.board_shrink_01.blockade_01.observer_01.reinforcement_01
```

このデッキコードは `scripts/selfplay-deck-options.ts` の `DEFAULT_SELFPLAY_WHITE_DECK_CODE` として参照される。

自己対局データ生成時には、実際のコマンドに以下が入っている。

```text
--white-deck-code D1C1:chest_01...reinforcement_01
```

## 黒デッキの扱い

黒には明示的な deckCode が渡されていない。

設定上は以下である。

```text
selfplayBlackDeckCode: null
selfplayWhiteDeckCode: DEFAULT_SELFPLAY_WHITE_DECK_CODE
```

`scripts/selfplay-deck-options.ts` では、`blackDeckCode` が null の場合、黒には明示 deck がない状態として扱われる。白だけ deckCode があるため、初期化側では白は固定デッキ、黒はデフォルトデッキ生成に回る。

ゲームロジック側では、明示 deck がないプレイヤーには `buildDefaultDeckCardIds(prng)` によるデフォルト生成デッキが与えられる。したがって、現在の前提は以下である。

- 白: CPU Lv6 固定専用デッキ
- 黒: PRNG による通常生成デッキ

この設計では、黒は「白 CPU が戦う相手環境」として機能する。黒を学習対象の主役にはしないが、白が対応すべき局面分布を作るためには黒の手番と黒の行動が必要である。

## 方策の混合と継続成長

自己対局では policy table model を guide として使う。

主な設定:

```text
--selfplay-policy-mix-rate 1.0
--selfplay-policy-model-pool-size 4
--selfplay-policy-pool-sampling recency
--selfplay-policy-pool-recency-decay 1.6
--selfplay-policy-current-anchor-rate 0.70
```

意味は以下である。

- `policy-mix-rate 1.0`: 使用可能な model がある場合、方策モデルを常に使う方向。
- `model-pool-size 4`: 直近候補を含む最大 4 個程度のモデル候補プールを扱う。
- `pool-sampling recency`: 新しいモデルを優先的に選びやすい。
- `recency-decay 1.6`: 古いモデルほど選ばれにくくする。
- `current-anchor-rate 0.70`: 現在の anchor / guide 系を高めに残す。

目的は、candidate を毎 iteration で自己増殖的に更新しつつ、極端に新しい弱い候補だけへ寄り切ることを避けることである。

## Tactical selfplay

自己対局は単純なモデル出力だけではなく、tactical lookahead と heuristic を混ぜる。

主な設定:

```text
--selfplay-tactical-weight-min 0.70
--selfplay-tactical-weight-max 0.95
--selfplay-tactical-depth-opening 2
--selfplay-tactical-depth-mid 3
--selfplay-tactical-depth-end 4
--selfplay-tactical-beam-width 3
--selfplay-policy-score-weight-min 1.10
--selfplay-policy-score-weight-max 1.60
--selfplay-heuristic-weight-min 0.85
--selfplay-heuristic-weight-max 1.0
```

局面に対して、モデル評価、戦術探索、ヒューリスティックを混ぜた teacher 的な判断を生成する。opening / mid / end で探索深さが変わり、終盤ほど深く見る。

この設計の意図は、モデルが未熟な段階でも、ある程度まともな教師信号を生成することである。モデルが自分自身の誤りだけを再学習する危険を下げるために、探索とヒューリスティックを混ぜる。

## Teacher committee

自己対局には teacher committee 系の重みも入っている。

```text
--selfplay-teacher-committee-weight-min 24
--selfplay-teacher-committee-weight-max 40
--selfplay-teacher-committee-consensus-bonus-min 280
--selfplay-teacher-committee-consensus-bonus-max 520
```

これは複数観点の teacher 判断や consensus を強く評価するための設定である。合意が強い手には bonus が乗り、局面ごとの教師方策が安定しやすくなる。

## 学習対象

現設定で有効なのは主に以下である。

- policy table candidate
- policy ONNX candidate
- card policy ONNX candidate

無効化されているもの:

```text
--no-train-target-head
--no-train-value-head
```

したがって、現在の run では target head と value head は学習しない。過去 run では target / value を有効にしたレーンも存在するが、この `white100_cpu` run の resolved config では無効である。

## ONNX 学習設定

主な設定は以下。

```text
--onnx-epochs 9999
--onnx-batch-size 512
--onnx-lr 0.00025
--onnx-hidden-size 384
--onnx-device cpu
--onnx-val-split 0.15
--onnx-early-stop-patience 20
--onnx-early-stop-min-delta 0.00004
--onnx-early-stop-min-epochs 96
--onnx-early-stop-monitor val_loss
--onnx-early-stop-smoothing-window 5
--onnx-lr-plateau-patience 8
--onnx-lr-plateau-factor 0.60
--onnx-lr-plateau-min-lr 0.00003
```

`epochs 9999` は実質的な上限であり、早期終了が前提である。最低 96 epoch は見た上で、validation loss の改善が止まったら early stop する。

学習率は plateau 検出で下げられる。`val_loss` が伸び悩むと lr を 0.60 倍し、最小 `0.00003` まで下げる。

今回の起動では `--onnx-device cpu` が pass-through で指定されているため、PyTorch 環境上 CUDA が使えるとしても、この run は CPU 学習指定である。

## サンプル重み

ONNX 学習には、局面や行動種別に応じた重み付けが入っている。

```text
--onnx-card-no-action-weight 0.66
--onnx-card-class-balance-power 0.45
--onnx-winner-sample-boost 0.40
--onnx-loser-sample-weight 0.92
--onnx-draw-sample-weight 1.0
--onnx-corner-emergency-sample-boost 0.75
--onnx-negative-future-disc-sample-boost 0.65
--onnx-negative-future-disc-threshold -1.0
--onnx-tactical-miss-sample-boost 0.60
--onnx-tactical-miss-threshold 0.05
--onnx-hand-pressure-sample-boost 0.35
--onnx-pending-target-sample-boost 0.45
--onnx-corner-balance-sample-boost 0.18
--onnx-edge-balance-sample-boost 0.08
```

意図は以下である。

- カード未使用ばかりを学習しすぎないようにする。
- 勝者側サンプルを強める。
- 敗者側サンプルは完全には捨てず、やや弱める。
- corner emergency、negative future disc、tactical miss、hand pressure、pending target など、重要局面を増幅する。
- corner / edge など、盤面戦略上重要な特徴のバランスを取る。

重要な注意点として、現時点ではここに「白手番専用 loss weight」は明示されていない。白 100% は採用評価側の設定であり、ONNX 学習 loss そのものを白手番だけにする設定ではない。

## 採用評価の基本構造

candidate は iteration ごとに anchor / baseline と比較される。

現在の設定:

```text
--adoption-use-anchor-baseline
--promotion-mode quick-only
--selfplay-candidate-admission quick-pass
```

baseline は fixed anchor であり、現在の run では以下が使われる。

```text
data/models/browser_lv6_growth_v1/policy-table.json
```

candidate は iteration ごとに生成される policy table candidate である。

採用評価は `scripts/benchmark-policy-adoption.ts` で実行され、training cycle からは `scripts/training-cycle-command-builders.ts` を通じて `--white-priority` などの引数が渡される。

## 白 100% 評価の正確な意味

採用評価では以下の式で core score を作る。

```text
baselineCoreScore =
  baselineOverallScore * (1 - whiteWeight)
  + baselineWhiteScore * whiteWeight

candidateCoreScore =
  candidateOverallScore * (1 - whiteWeight)
  + candidateWhiteScore * whiteWeight
```

現在は `whiteWeight = 1.0` である。

したがって式は以下に単純化される。

```text
baselineCoreScore = baselineWhiteScore
candidateCoreScore = candidateWhiteScore
```

つまり、採用評価の core score は白番視点の score だけになる。candidate が黒番でどれだけ強いか、または overall score がどうかは core score には混ざらない。

ただし、quality score は別途加算される。

```text
baselineScore = baselineCoreScore + baselineQualityScore
candidateScore = candidateCoreScore + candidateQualityScore
uplift = candidateScore - baselineScore
```

そのため、白 100% とは「勝率系 core score を白番に完全寄せする」ことであり、「すべての評価指標から黒由来情報を物理的に消す」ことではない。quality metrics は policy A の行動品質を評価するため、白番評価と一緒に candidate の局面品質を見る。

## Quick gate

quick gate は毎 iteration の早い採用判断に使われる。

設定:

```text
--quick-games 120
--quick-adoption-threshold 0.010
--quick-adoption-seed-count 5
--quick-adoption-seed-stride 1000
--quick-adoption-seed-offset 200000
--quick-adoption-confidence-level 0.92
--quick-adoption-min-lower-bound -0.015
--quick-adoption-min-seed-uplift -0.050
--quick-adoption-min-seed-pass-count 3
```

意味は以下。

- 1 seed あたり 120 games を走らせる。
- 5 seed で確認する。
- 平均 uplift が `0.010` 以上なら強い candidate とみなす。
- confidence lower bound は `-0.015` 以上を要求する。
- seed 別の最悪 uplift が `-0.050` を下回りすぎると危険視する。
- 5 seed 中 3 seed 以上で pass する必要がある。

quick gate が通らなければ、quality gate と final gate はブロックされる構造である。

## Quality gate

quality gate は quick gate 後に追加で品質退行を確認するための gate である。

設定:

```text
--quality-gate
--quality-gate-games 60
--quality-gate-seed-count 3
--quality-gate-seed-stride 1000
--quality-gate-threshold -0.005
--quality-gate-confidence-level 0.92
--quality-gate-min-lower-bound -0.010
--quality-gate-min-seed-uplift -0.010
--quality-gate-min-seed-pass-count 2
--quality-gate-strength-first
```

quality gate は strength-first であり、大きな品質悪化や実戦退行を弾く目的が強い。threshold は `-0.005` で、わずかな悪化は許容するが、seed 別・下限・pass count で極端な退行を弾く。

## Final gate

final gate はより重い採用確認である。

設定:

```text
--final-games 240
--final-adoption-threshold 0.004
--final-adoption-seed-count 3
--final-adoption-seed-stride 1000
--final-adoption-confidence-level 0.95
--final-adoption-min-lower-bound 0.001
--final-adoption-min-seed-uplift -0.020
--final-adoption-min-seed-pass-count 2
```

ただし、現在の promotion mode は `quick-only` である。したがって、モデル更新の主判定は quick gate を中心に進む。quality gate は有効だが、quick が落ちると quality / final は進まない。

## Quality score の構成

採用評価では、勝敗スコアだけでなく行動品質を加点する。

現在の quality weight:

```text
corner: 0.08
edge: 0.03
cornerRecovery: 0.07
cornerRecapture: 0.05
edgeRecovery: 0.04
cornerHold: 0.07
cornerHoldTurns: 0.04
edgeHold: 0.04
edgeChain: 0.08
finalCornerShare: 0.09
finalEdgeShare: 0.02
finalLongestEdgeRunShare: 0.06
bonus: 0.004
cardImmediate: 0.018
cardFuture: 0.024
placeDelta: 0.012
```

見ている観点は以下である。

- 角を取れる機会で取れているか。
- 辺を取れる機会で取れているか。
- 角を取られた後に回復できるか。
- 角を再取得できるか。
- 辺の回復ができるか。
- 取った角や辺を維持できるか。
- 辺の連鎖的な支配を伸ばせているか。
- 終局時の角占有率、辺占有率、最長辺連続支配を取れているか。
- カード使用の即時・未来 3 ply の石差改善があるか。
- 通常配置の石差改善があるか。

白専用 CPU という観点では、これらは白番で強くなる candidate を選ぶ補助指標として機能する。

## Promotion と candidate admission

現在の主要設定:

```text
--selfplay-candidate-admission quick-pass
--promotion-mode quick-only
```

意味は、candidate を次の guide / pool に入れるかどうか、また隔離レーン内で採用するかどうかを quick gate 中心に判断するということである。

このレーンは deploy 主線ではないため、厳格な browser non-regression を通さないと本番反映できないという設計ではない。あくまで `browser_lv6_growth_v1` 内で candidate を育てる。

## 現在の白専用化でできていること

できていること:

- 採用評価の core score は白 100%。
- 白は CPU Lv6 専用固定デッキ。
- 黒は明示 deck なしの通常生成デッキ。
- baseline は anchor 固定で、candidate の白番改善を anchor と比較する。
- quick / quality / final の各 gate にも白専用デッキ指定が渡る。

このため、candidate が「白 CPU として強いか」を採用判断の中心にできている。

## 現在まだ白専用化されていないこと

まだ白専用化されていないこと:

- 自己対局データには黒手番サンプルも含まれる。
- policy ONNX / table の loss は、現設定だけでは白手番サンプルだけを強くする設計ではない。
- 黒方策も局面分布生成に関与する。
- 黒番での誤った教師行動が、学習データに混ざる可能性は残る。

これは必ずしも悪いことではない。黒は白が対峙する相手として必要であり、黒が動かなければ白が学ぶ局面も生成されない。ただし、白専用 CPU を徹底するなら、次の段階では学習 loss 側にも白手番重みを入れるべきである。

## 黒を完全に消さない理由

黒は CPU の運用対象ではないが、白の対戦相手としては必要である。

黒の役割は以下。

- 白が対応すべき盤面を作る。
- 白専用デッキが不利になる状況を作る。
- 白のカード判断、角・辺支配、終盤対応を試す。
- 自己対局をゲームとして成立させる。

したがって、黒を学習の主目的から外すことと、黒をゲームから消すことは別である。現在の設計は、黒を opponent / environment として残しつつ、採用評価では白性能だけを見る折衷である。

## 現在の弱点とリスク

主なリスクは以下である。

1. 白評価 100% による overfit

白専用デッキと白番評価だけに最適化されるため、黒番や別デッキへの汎用性は落ちる可能性がある。ただし、運用上 CPU が白だけなら許容できる。

2. 学習 loss に黒手番が残る

採用評価は白 100% だが、学習データには黒手番が残る。黒手番の教師サンプルが白専用モデルにとってノイズになる可能性がある。

3. quality score は完全な白専用ではない可能性がある

core score は白 100% だが、quality score は policy A の行動品質評価として加算される。白番中心の採用意図には合うが、全指標が純粋に白だけという意味ではない。

4. CPU 実行

今回の run は `--onnx-device cpu` であり、GPU が使える環境でも CPU 学習になる。速度面では不利である。

5. CardLivingWill 系 retry

過去の run では `CardLivingWill requires an injected deterministic PRNG` による retry が出ていた。現 run ではまだ初期段階だが、同種の retry が再発する可能性がある。retry で回復している限り致命停止ではないが、学習効率には影響する。

## 次の改善案

白専用 CPU としてさらに筋を通すなら、次の順で進めるのがよい。

### 1. 白手番サンプル重みを導入する

採用評価だけでなく、学習 loss 側で以下のような重みを導入する。

```text
white sample weight = 1.0
black sample weight = 0.1 ～ 0.25
```

黒を完全に 0 にすると、局面分布の安定性や相手行動の学習が弱くなる可能性がある。最初は 0.25 程度に落とすのが現実的である。

### 2. 白専用メトリクスを training summary に明示する

現在も white score は採用評価に含まれるが、summary 上で以下を明示すると判断しやすい。

- candidateWhiteScore
- baselineWhiteScore
- white uplift
- white final corner share
- white card future delta
- white edge / corner hold

### 3. 白専用の hardcase mining

現在は `--no-selfplay-hardcases` で hardcase generation は切っている。白専用の問題局面を拾うなら、白番での敗着、角損、辺崩壊、カード誤使用を hardcase として保存する価値がある。

### 4. GPU run への切り替え

環境上 CUDA は使えるため、速度を重視するなら `--onnx-device cpu` を外すか、明示的に GPU を使う run に切り替える。ただし GPU 使用中の別作業との競合を避ける必要がある。

### 5. 白専用デッキのバリエーション評価

本番白デッキを固定するなら現状でよい。だが相手の黒デッキ分布が広いなら、白固定デッキは維持しつつ、黒デッキ生成の分布を監査した方がよい。

## 運用上の見方

この run の結果を見る時は、overall win rate よりも以下を見るべきである。

- quick gate の `candidateWhiteScore`
- quick gate の `uplift`
- seed pass count
- lower bound
- final corner share
- final edge share
- card future delta
- corner recovery / recapture
- edge chain

白専用 CPU では、黒番での candidate 成績は主目的ではない。黒が混ざることで採用判断が鈍る問題は、今回の `whitePriority = 1.0` で core score 上は解消している。

## 現在の結論

現在の学習方針は、白 CPU 専用の実運用に対して合理的である。白は固定の CPU Lv6 専用デッキを使い、黒はランダム生成系の相手として機能し、採用評価では白番性能を 100% 見る。

現時点の限界は、学習 loss まで白専用化されていない点である。つまり、現在の状態は「白専用採用評価レーン」であり、「白手番サンプル専用学習レーン」ではない。次に進めるなら、白手番サンプル重みを導入し、黒手番サンプルの影響を明示的に下げるのが最も効果的である。
