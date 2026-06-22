# 教師CPU仕様テンプレート（カードリバーシ）

最終更新: 2026-02-23  
対象レベル: `Lv6`（最強用）  
補足: `Lv1-5` は将来別モデルとして段階分離する

## 1. 目的
- 目的: `Lv6` を「人間に勝たれにくい」CPUにするための教師方策を定義する。
- 勝ち方の方針: 「高期待値の勝ち」より「破綻しない安全勝ち」を優先する。
- 「絶対に負けにくい」定義:
  - 角献上と利敵カード使用を極小化する。
  - 盤面優位を守るカード温存と再奪還を優先する。
  - 不利時のみリスク行動を許可する。
- 禁止事項:
  - 角取り返し不能の手を、代替手があるのに選ぶ。
  - 布石を大きく損するだけのカード使用を常態化する。
  - 保護中の敵石に対して無効カードを使う。

## 2. 前提と制約
- ルールバージョン: `01-rulebook.md`（最終更新 2026-02-20）準拠。
- 盤面サイズ: 8x8。
- 数字マス仕様:
  - 初期空き60マス中40マスに配置。
  - 内訳: `1x9, 2x8, 3x6, 4x5, 5x4, 6x3, 7x2, 8x1, 9x1, 10x1`。
  - 取得後は再出現しない。
- カード総数 / 種類:
  - 一次情報は `cards/catalog.json`。
  - 現行有効カードは 39 種（`enabled:false` なし）。
  - 実デッキ枚数は「有効カードIDを各1枚」。
- 計算時間制約（目標）:
  - 教師CPU（オフライン自己対局）: 1手 50ms 以内を目安。
  - ブラウザLv6（本番）: 1手 120ms 以内を目安。
- ブラウザ実行制約:
  - ONNX推論の失敗時は必ず既存ロジックへフォールバック。
  - レンダリング停止を起こす重探索は禁止（終盤のみ段階解禁）。

## 3. 教師CPUの入出力
- 入力:
  - 盤面（石配置）
  - 手番
  - 手札
  - 布石（自/相手）
  - 使用可能カード一覧
  - 保護状態・特殊石状態・爆弾状態
  - 数字マス残存
  - 残り空きマス数（局面フェーズ判定）
- 出力:
  - `actionType`: `place` / `use_card` / `pass`
  - `move`（row,col）
  - `cardId`（使う場合）
  - `confidence`（0-1）
  - `reasonTags`（`corner_safe`, `hold_card`, `deny_opponent`, `charge_roi`, `survival`）

## 4. 意思決定パイプライン（固定）
1. 強制ルール（禁止手/必須手）
2. カード使用可否判定（使用価値と機会損失）
3. 候補手生成（上位K）
4. 探索（浅探索 + 危険局面だけ深探索）
5. 評価関数で順位付け
6. 同点時タイブレーク（seed固定の再現可能順）

## 5. 強制ルール（ハード制約）
- 絶対に避ける手:
  - 角直近のX/Cマスへ無警戒で置く手。
  - カード使用後に相手へ即角確定を与える手。
  - 期待値がマイナスで確定している破壊・交換・売却。
- 絶対に優先する手:
  - 確定角取得。
  - 相手の確定角取得の阻止。
  - 終盤での確定石増加手。
- パス条件:
  - 合法手0で、使用可能カードを試しても合法手0のままならパス。
  - 未解決選択カードはパス時に破棄（ルール準拠）。

## 6. カード使用ポリシー（重要）
### 6.1 カード分類
- 攻撃系:
  - `DESTROY_ONE_STONE`, `ULTIMATE_DESTROY_GOD`, `TIME_BOMB`, `CROSS_BOMB`, `X_BOMB`, `STRONG_WIND_WILL`, `SWAP_WITH_ENEMY`, `POSITION_SWAP_WILL`, `TEMPT_WILL`, `ROBOT_VACUUM_WILL`, `ESCAPE_WILL`, `INSTANT_HYPERACTIVE_WILL`
- 防御/維持系:
  - `PROTECTED_NEXT_STONE`, `PERMA_PROTECT_NEXT_STONE`, `GUARD_WILL`, `REGEN_WILL`, `EXTEND_LIFE_WILL`, `EXTEND_LIFE_GOD`, `BLOCKADE_WILL`
- 展開/手数系:
  - `FREE_PLACEMENT`, `DOUBLE_PLACE`, `SNIPER_WILL`, `HYPERACTIVE_WILL`, `ULTIMATE_HYPERACTIVE_GOD`, `CLONE_WILL`, `BREEDING_WILL`, `BOARD_EXPANSION_WILL`
- 布石・手札経済系:
  - `TREASURE_BOX`, `WORK_WILL`, `GOLD_STONE`, `SILVER_STONE`, `HEAVEN_BLESSING`, `CONDEMN_WILL`, `TRAP_WILL`, `DOUBLE_CHAIN_WILL`, `TRIPLE_CHAIN_WILL`, `QUAD_CHAIN_WILL`, `INFINITE_CHAIN_WILL`, `ULTIMATE_REVERSE_DRAGON`

### 6.2 使用禁止条件（利敵回避）
- 条件1: 使用後1手以内に相手の角確定率が上がるなら禁止。
- 条件2: 消費布石に対して見返り（石差/角差/将来布石）が負なら禁止。
- 条件3: 対象無効（保護・不在・空き不足）なら禁止。
- 条件4: 勝勢局面での高コスト博打カード（`>=20`）は原則禁止。

### 6.3 使用推奨条件（高価値）
- 条件1: 相手の角筋を切断できる。
- 条件2: 終盤の確定石差を増やせる。
- 条件3: `work/gold/silver/steal` が高ROI（回収見込み > 消費）。
- 条件4: 危険特殊石を破壊・無効化できる。

### 6.4 温存ルール
- 序盤（空きマス 44〜60）:
  - 高コストカードは原則温存。
  - 低コスト防御カードのみ局所使用可。
- 中盤（空きマス 16〜43）:
  - 角争いに直結するカードを優先使用。
  - 経済カードは回収見込みがある時のみ使用。
- 終盤（空きマス 0〜15）:
  - 即時石差と確定石に効くカードを優先。
  - 持続型は残ターン不足なら温存せず即使用。
- 布石しきい値:
  - 最低防衛布石を常に `>=8` 残す。

### 6.5 全カード一覧（現行41種）
| type | 名称 | cost | 主用途 |
|---|---|---:|---|
| TREASURE_BOX | 宝箱 | 0 | 経済 |
| FREE_PLACEMENT | 自由の意志 | 14 | 展開 |
| SNIPER_WILL | 狙撃の意志 | 23 | 攻撃 |
| PROTECTED_NEXT_STONE | 弱い意志 | 1 | 防御 |
| SWAP_WITH_ENEMY | 交換の意志 | 17 | 攻撃 |
| POSITION_SWAP_WILL | 入替の意志 | 13 | 攻撃/盤面操作 |
| PERMA_PROTECT_NEXT_STONE | 強い意志 | 15 | 防御 |
| STRONG_WIND_WILL | 強風の意志 | 9 | 攻撃/盤面操作 |
| TRAP_WILL | 罠の意志 | 4 | 牽制 |
| TEMPT_WILL | 誘惑の意志 | 34 | 攻撃 |
| DOUBLE_CHAIN_WILL | 二連鎖の意志 | 22 | 攻撃 |
| TRIPLE_CHAIN_WILL | 三連鎖の意志 | 22 | 攻撃 |
| QUAD_CHAIN_WILL | 四連鎖の意志 | 22 | 攻撃 |
| INFINITE_CHAIN_WILL | 無限連鎖の意志 | 50 | 攻撃 |
| REGEN_WILL | 復活の意志 | 12 | 防御 |
| DESTROY_ONE_STONE | 破壊の意志 | 14 | 攻撃 |
| TIME_BOMB | 時限爆弾 | 13 | 攻撃 |
| ULTIMATE_REVERSE_DRAGON | 究極反転龍 | 30 | 攻撃 |
| BREEDING_WILL | 繁殖の意志 | 16 | 展開 |
| CLONE_WILL | 複製の意志 | 16 | 展開 |
| CROSS_BOMB | 十字爆弾 | 18 | 攻撃 |
| X_BOMB | クロス爆弾 | 18 | 攻撃 |
| HYPERACTIVE_WILL | 多動の意志 | 8 | 展開 |
| ESCAPE_WILL | 逃げる意志 | 12 | 攻撃/攪乱 |
| ROBOT_VACUUM_WILL | ロボット掃除機 | 17 | 攻撃/経済 |
| INSTANT_HYPERACTIVE_WILL | 瞬間多動 | 5 | 攻撃 |
| WORK_WILL | 出稼ぎの意志 | 11 | 経済 |
| DOUBLE_PLACE | 二連投石 | 24 | 展開 |
| HEAVEN_BLESSING | 天の恵み | 3 | 手札補充 |
| CONDEMN_WILL | 断罪の意志 | 8 | 手札干渉 |
| GOLD_STONE | 金の意志 | 6 | 経済 |
| SILVER_STONE | 銀の意志 | 3 | 経済 |
| EXTEND_LIFE_WILL | 延命の意志 | 4 | 防御 |
| EXTEND_LIFE_GOD | 延命神 | 10 | 防御 |
| GUARD_WILL | 守る意志 | 2 | 防御 |
| ULTIMATE_DESTROY_GOD | 究極破壊神 | 30 | 攻撃 |
| ULTIMATE_HYPERACTIVE_GOD | 究極多動神 | 28 | 展開/攪乱 |
| BOARD_EXPANSION_WILL | 盤面拡張 | 19 | 盤面操作 |
| BLOCKADE_WILL | 封鎖の意志 | 1 | 防御/盤面操作 |

## 7. 探索仕様
- 探索方式: `hybrid`（ルールベース事前フィルタ + 深さ可変探索）。
- 通常深さ: 4手。
- 危険局面深さ: 8手。
- 終盤深さ: 12手。
- 分岐削減ルール:
  - 候補手を上位K（既定K=8）に圧縮。
  - 角献上候補を事前排除。
  - 無効カード分岐を探索対象外にする。
- タイムアウト時フォールバック:
  - 直前深さの最良手を返す。
  - それも無ければ「角安全度 > 可動性 > 石差」で即断。

## 8. 評価関数（初期重み）
合計スコア =  
`w_corner * corner` +  
`w_edge * edge` +  
`w_mobility * mobility` +  
`w_stability * stability` +  
`w_disc * disc_diff` +  
`w_card_value * card_value` +  
`w_risk * (-risk)`

- `w_corner`: 6.0
- `w_edge`: 2.0
- `w_mobility`: 2.5
- `w_stability`: 4.0
- `w_disc`: 1.0
- `w_card_value`: 3.0
- `w_risk`: 5.0

補足:
- 序盤は `w_disc` を下げ、`w_mobility/w_risk` を上げる。
- 終盤は `w_disc/w_stability` を上げる。

## 9. 学習データ収集方針（教師生成）
- selfplayカード使用率:
  - スケジュール運用 `0.58, 0.70, 0.82, 0.92`（多様性確保）。
- 多様性パラメータ:
  - `policyMixRate=0.85`
  - `cardUsageRateJitter=0.40`
  - `tacticalWeightRange=1.2..3.1`
  - `policyScoreWeightRange=2.2..4.0`
  - `heuristicWeightRange=0.75..1.0`
- seed運用:
  - train と eval を seed/offset で分離。
  - adoption は `seedCount>=3` 固定。
- 悪手サンプルの混入方針:
  - 全探索候補を保持し、選択外候補も教師ラベルに残す。
- train/eval分離ルール:
  - train: 22000局
  - eval: 3500局
  - 同seed再利用禁止。

## 10. 採用判定（ゲート）
- quick判定:
  - games: 700
  - pass条件: baseline比 `uplift >= 0.01` かつ `minSeedUplift >= -0.01` かつ `seedPassCount >= 2/3`
- final判定:
  - games: 3000
  - pass条件: quick同等条件 + pool gate（履歴モデル複数比較）を通過
- ONNXゲート:
  - games: 10
  - pass条件:
    - `averageScore >= 0.52`
    - `minSeedScore >= 0.45`
    - `seedPassCount >= 2/3`
    - runtime/match error 0

## 11. 失敗時の自動対応
- 失敗パターン:
  - uplift停滞
  - ONNX gate失敗
  - カード乱用/カード未使用
- 対応:
  - 重み調整: `w_risk` と `w_card_value` を再配分
  - 探索深さ変更: 危険局面だけ深さ拡張
  - カード禁止/解禁ルール修正
  - カバレッジ低下時は抽象状態キー設計を見直し

## 12. 受け入れ基準（Done）
- ブラウザ`Lv6`で読み込み成功
- モデル未読込/失敗時フォールバック正常
- quick/final/onnx gate全通過
- 人間対戦での再現結果:
  - 対局数: 30以上
  - 勝率: 人間側が安定して2割未満
  - 体感課題: 「カード温存」「利敵回避」「角管理」で明確な改善を確認

## 13. 変更履歴
- 2026-02-23:
  - `01-rulebook.md` と `cards/catalog.json` を基準に、Lv6教師CPU仕様を実運用値で記入。
  - 全カード38種を用途別に分類して一覧化。
