# Unity 移植 Turn Sequence Contract

この文書は、Unity/C# 版で守るターン処理順序を定義する。カード効果は単体の効果だけでなく、いつ発動するかが重要である。

## 基本方針

- GameCore がターン処理を完了し、結果として `MatchState` と `PresentationEvent[]` を返す。
- UnityPresentation は event を順番に再生する。
- アニメーション完了によってゲーム結果を変えない。
- 追加配置の間に、通常のターン開始効果を再実行しない。
- 遅延効果は UI だけの記憶にせず、`MatchState` / `cardState` 相当の canonical state に残す。

## 通常ターンの流れ

```text
1. ターン開始
2. ターン開始効果
3. 使用可能カード判定
4. カード使用または石配置コマンド受付
5. カード使用前チェック
6. カード使用解決
7. pending selection があれば対象選択へ移行
8. 石配置判定
9. 石配置
10. 通常反転
11. 配置時効果
12. 反転後効果
13. 破壊/復活/生成/移動の派生処理
14. 追加配置があれば配置受付へ戻る
15. ターン終了効果
16. 手札/山札/捨て札更新
17. 勝敗/パス/次ターン判定
18. 次プレイヤーへ移行
```

## リバーシモード

リバーシモードは通常リバーシ対戦として処理する。

- カード、デッキ、手札、布石、数字マス、特殊石、カード由来のターン開始効果をすべて無効にする。
- パスは合法手が 0 のときだけ可能とし、カード使用可否では判定しない。
- CPU は白として動く。CPU レベルは白設定を使う。
- PresentationEvent は配置、反転、ターン変更、リザルトなど通常リバーシに必要なものだけを出す。

## カード使用

カード使用は次の種類に分かれる。

| 種類 | 例 | 処理 |
| --- | --- | --- |
| 即時解決 | 宝箱、角の代償、リボ払い、再構築、補給 | 使用時に効果を解決し pending を clear |
| 対象選択 | 破壊の意志、封鎖、盤面縮小、天の恵み | pending selection を作り、選択完了後に解決 |
| 次配置効果 | 狙撃の意志、破壊龍、救済神、十字爆弾 | pending/armed 状態を持ち、次の配置で石に marker を付与 |
| 追加配置 | 二連投石、三連投石、四連投石、無限投石 | 残り配置回数を管理する |
| 連鎖反転 | 二連鎖の意志など | 通常反転後に追加反転を解決する |

即時解決カードのうち、`TREASURE_BOX` は deterministic PRNG が必須。Unity 版でも、RNG が注入されていない状態で成功形の fallback にしてはいけない。

## 対象選択

対象選択中は、通常の配置や別カード使用を進めない。

処理:

```text
1. PendingSelection を作成
2. 選択可能対象を UI に渡す
3. ユーザーまたは CPU が対象を選ぶ
4. 選択数/段階/キャンセル可否を検証
5. dispatch に応じて効果解決
6. turnOutcome に従って continue_turn または end_turn
```

現行 pending selection registry は 33 種類を持つ。target resolver があるものは、使用時に最低必要数以上の候補を返せない場合は使用不可にする。

| type | kind | outcome | cancel | dispatch | target resolver |
| --- | --- | --- | --- | --- | --- |
| `DESTROY_ONE_STONE` | continue_turn | continue_turn | 可 | destroy | getDestroyTargets(board) |
| `STRONG_WIND_WILL` | end_turn | end_turn | 不可 | strong_wind | getStrongWindTargets(board) |
| `BUOYANCY_WILL` | end_turn | end_turn | 不可 | buoyancy | getBuoyancyTargets(board) |
| `SUPER_BUOYANCY_WILL` | end_turn | end_turn | 不可 | super_buoyancy | getSuperBuoyancyTargets(board) |
| `GRAVITY_WILL` | end_turn | end_turn | 不可 | gravity | getGravityTargets(board) |
| `SUPER_GRAVITY_WILL` | end_turn | end_turn | 不可 | super_gravity | getSuperGravityTargets(board) |
| `SUPER_ATTRACTION_WILL` | multi_stage | end_turn | 不可 | super_attraction | getSuperAttractionTargets(player_pending) |
| `TELEPORT_WILL` | continue_turn | continue_turn | 不可 | teleport | getTeleportTargets(board) |
| `CELL_TELEPORT_WILL` | continue_turn | continue_turn | 不可 | cell_teleport | getCellTeleportTargets(board) |
| `TEMPT_WILL` | continue_turn | continue_turn | 不可 | tempt | getTemptWillTargets(player) |
| `CAPTURE_WILL` | continue_turn | continue_turn | 不可 | capture | getCaptureWillTargets(player) |
| `TRAP_WILL` | end_turn | end_turn | 不可 | trap | getTrapTargets(player) |
| `GUARD_WILL` | continue_turn | continue_turn | 不可 | guard | getGuardTargets(player) |
| `GUARDIAN_GOD` | continue_turn | continue_turn | 不可 | guard | getGuardTargets(player) |
| `LIVING_WILL` | continue_turn | continue_turn | 不可 | living_will | getLivingWillTargets(player) |
| `EXTEND_LIFE_WILL` | continue_turn | continue_turn | 不可 | extend_life | getExtendLifeTargets(player) |
| `EXTEND_LIFE_GOD` | continue_turn | continue_turn | 不可 | extend_life | getExtendLifeTargets(player) |
| `CORROSION_WILL` | continue_turn | continue_turn | 不可 | corrosion | getCorrosionTargets(player) |
| `CLONE_WILL` | continue_turn | continue_turn | 不可 | clone | getCloneTargets(player) |
| `BLOCKADE_WILL` | continue_turn | continue_turn | 可 | blockade | getBlockadeTargets(player) |
| `BOARD_EXPANSION_WILL` | continue_turn | continue_turn | 可 | board_expansion | getBoardExpansionTargets(player) |
| `BOARD_EXPANSION_GOD` | multi_stage | continue_turn | 可 | board_expansion | getBoardExpansionGodTargets(player) |
| `BOARD_SHRINK_WILL` | multi_stage | continue_turn | 可 | board_shrink | getBoardShrinkTargets(player), min 3 |
| `BOARD_SHRINK_GOD` | multi_stage | continue_turn | 可 | board_shrink | getBoardShrinkGodTargets(player) |
| `FREEZE_WILL` | continue_turn | continue_turn | 可 | freeze | getFreezeTargets(player) |
| `SEED_WILL` | continue_turn | continue_turn | 可 | seed | getSeedTargets(player) |
| `POSITION_SWAP_WILL` | multi_stage | continue_turn | 可 | position_swap | getPositionSwapTargets(player_pending), min 2 |
| `METEOR_WILL` | continue_turn | continue_turn | 可 | meteor | getMeteorTargets(player) |
| `TIME_BOMB` | continue_turn | continue_turn | 不可 | time_bomb | getTimeBombTargets(player) |
| `SWAP_WITH_ENEMY` | end_turn | end_turn | 不可 | swap_with_enemy | getSwapTargets(player) |
| `HEAVEN_BLESSING` | hand_overlay | continue_turn | 不可 | heaven_blessing | hand/candidate overlay |
| `CONDEMN_WILL` | hand_overlay | continue_turn | 不可 | condemn | hand overlay |

## 破壊、復活、生成

破壊や生成は presentation event の順序が重要である。

- 破壊対象を確定する。
- 保護、凍結、幽霊、復活、救済神などの介入を評価する。
- 実際に盤面状態を更新する。
- 必要な spawn / flip / destroy event を出す。
- 同一破壊ブロック内の救済神処理は、正本の順序に従う。
- 破壊+穴化は、破壊、穴/status 適用、救済 flush の順序を崩さない。
- effect block をまたぐ spawn / rescue は、表示メタデータを保持する。

## 追加配置

追加配置中に再実行しないもの:

- 通常のターン開始効果
- 通常のドロー開始処理
- ターン開始時特殊石処理

追加配置中も実行するもの:

- 配置合法判定
- 通常反転
- 配置時効果
- 反転後効果
- 破壊/復活/生成

## CPU ターン

CPU も UI と同じ `GameCommand` を発行する。

- CPU は GameCore の状態を読んで候補を評価する。
- CPU が盤面や手札を直接変更しない。
- 対象選択カードは pending selection を経由する。
- CPU の乱数も deterministic RNG から取得する。
- 標準 `8x8` 以外では、`8x8` 専用の policy-table / ONNX / pending 対象選択経路を使わず、安全な通常判断へ切り替える。
- 初期 Unity 移植で ONNX を載せない場合でも、Lv6 の共有 profile 方針と fallback 方針を明示する。

## リザルト

- CPU 対戦では、終局後に観測石獲得を計算してローカル所持数へ加算する。
- 引き分け/敗北は `観測石 +100（基本100 / 追加0）`。
- 勝利時は `100 + 追加ドロップ`。追加ドロップは `100..3000` の `10` 刻みで、線形重み `weight(k) = 291 - k` に従う。
- ランキング送信、共有ランキング文言、ネット対戦視点の勝敗判定は初期移植では扱わない。

## PresentationEvent 順序

UnityPresentation は `PresentationEvent[]` を order 順に再生する。

表示処理の例:

```text
CARD_USED
HAND_REMOVE
STONE_PLACED
STONE_FLIPPED
STONE_DESTROYED
STONE_SPAWNED
STONE_MOVED
MARKER_CHANGED
HAND_ADD
TURN_CHANGED
```

JS 版の events playback order と Single Visual Writer の考え方を維持する。
