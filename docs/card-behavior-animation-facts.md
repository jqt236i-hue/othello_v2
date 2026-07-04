# カード挙動・演出ファクト一覧

この文書は、2026-05-24 時点の root 実装を確認して作成したカード挙動・演出の事実整理です。一次情報は `cards/catalog.json`、演出仕様は `01-rulebook.md`、対象選択契約は `game/logic/cards-internal/pending-selection-registry.ts`、特殊石見た目の対応は `game/visual-effects-map.runtime.js`、専用再生プロファイルは `ui/animation-engine.ts` / `shared/presentation-effect-profiles.ts` を参照しています。

注意:

- `worker-public/` は mirror なので根拠にはしていません。
- 「カード共通の使用/手札/盤面イベント再生のみ確認」は、そのカード固有の専用演出プロファイルや専用特殊石画像マップを列挙できる根拠がこの調査範囲に無い、という意味です。使用・手札・盤面イベントは共通の playback 経路に乗ります。
- 「解決形態」列は早見用です。正確な選択契約は「対象選択契約」、即時処理は「使用直後に解決する効果」、配置時処理は「配置時に特殊石化・効果化する pending」を正とします。
- `enabled:false` のカードも `cards/catalog.json` に存在するため一覧に含めます。
- `enabled:false` のカードは catalog 上は無効です。表の挙動は定義・連鎖設定として存在する説明であり、通常の山札/手札に出る有効カードという意味ではありません。
- カード使用時は原則として `CARD_USED` presentation event が出ます。ブラウザではカード使用・手札増減・盤面イベントが playback engine により順序再生されます。
- 対象選択ありのカードは pending selection registry に定義され、選択完了まで効果確定を待ちます。多くは playback idle 待ちと network publish defer を持ちます。
- 特殊石になるカードは、配置直後から最終見た目を出す方針です。対応する画像キーは `game/visual-effects-map.runtime.js` の `PENDING_TYPE_TO_EFFECT_KEY` に基づきます。

## 共通演出ルール

- UI は `events[]` を順番どおりに再生します。
- フリップは最終見た目へ切り替えてからフリップモーションを行います。
- 石の状態変化は透明度クロスフェードを使う場合があります。
- カード効果由来の反転・破壊・生成は対象セルに一時ハイライトを出します。
- `BLOCKADE_WILL` / `FREEZE_WILL` は既存の赤バツ / 氷表示を使い、追加の一時マスハイライトは出しません。
- 手札破壊は `hand_remove` の透明度フェードアウトを使います。
- 主要時間定数は `FLIP_MS=600`, `PHASE_GAP_MS=200`, `FADE_IN_MS=300`, `FADE_OUT_MS=500`, `OVERLAY_CROSSFADE_MS=600`, `MOVE_MS=400` です。

## 使用条件・事前チェック

`game/logic/cards-internal/card-usage-prechecks.ts` と `game/logic/cards-internal/hand-manager.ts` で確認できる、通常の「コストが足りる」以外の使用条件です。

| type | 実装上の条件 |
| --- | --- |
| `LAST_RESORT` | `canUseLastResortForPlayer` が真。catalog 上は「石数負けかつ合法手0」。 |
| `EQUALITY_WILL` | `canUseEqualityWillForPlayer` が真。catalog 上は「石数が10個以上負け」。 |
| `REINFORCEMENT_WILL` | `canUseReinforcementWillForPlayer` が真。増援配置できる対象が必要。 |
| `RIBO_WILL` | `turnIndex >= RIBO_WILL_UNLOCK_TURN_INDEX`。現行定数は19。 |
| `TIME_STOP_GOD` | `canUseTimeStopGodForPlayer` が真。使用時に自分石3つを破壊し、次に置く石を時間停石化する。 |
| `LOSS_WILL` | 通常石へ戻せる特殊石が1個以上必要。 |
| `SALVATION_WILL` | 直前の相手ターンで救済対象になった破壊石が1個以上必要。 |
| `EXECUTION_WILL` | 直前の相手ターンで自分の石が破壊され、かつ相手手札が1枚以上必要。 |
| `HEAVEN_BLESSING` | 候補カードを1枚以上生成できること。候補数は最大5。 |
| `CONDEMN_WILL` | 相手手札から破壊候補を1枚以上生成できること。 |
| `REVEAL_HAND_WILL` | 相手手札が1枚以上必要。 |
| pending selection registry 登録カード | 対応する target resolver が最低必要数以上の対象を返すこと。 |

## 使用直後に解決する効果

`game/turn/turn_pipeline_phases.ts` の card usage phase で、使用直後に解決または副作用を出す効果です。

| type | 使用直後の処理 | pending の扱い・演出メモ |
| --- | --- | --- |
| `TREASURE_BOX` | deterministic PRNG で1〜3布石を得る。 | pending を即 clear。rulebook 上、宝箱使用では `card_use_button` を再生しない。 |
| `RIBO_WILL` | 布石を30得て、9ターン返済 entry を積む。 | pending を即 clear。ターン開始時に4返済し、不足時は自石4個を破壊する。 |
| `EQUALITY_WILL` | 空きマスへ最大3個ランダム生成し、生成後に挟める場合は反転処理も行う。 | pending を即 clear。生成/反転は playback event 化される。 |
| `REINFORCEMENT_WILL` | 石に隣接する内側空きマスへ1個ランダム生成し、生成後に挟める場合は反転処理も行う。 | pending を即 clear。生成/反転は playback event 化される。 |
| `TIME_STOP_GOD` | 使用解決時に自石破壊コスト相当の処理結果を raw event へ出す。 | `hand-manager.ts` では手札追加時に自動で捨て札へ移す。配置型として残った場合は時間停石 marker を置く処理もある。 |
| `REBUILD_WILL` | 残り手札を全破壊し、最大3枚 draw する。 | pending を即 clear。手札破壊は `HAND_CLEAR` -> `hand_remove`。 |
| `REVEAL_HAND_WILL` | 使用時点の相手手札を使用者視点で公開する。 | `applyRevealHandWill` 側で pending を clear。 |
| `EXECUTION_WILL` | 相手手札をランダムで最大3枚破壊する。 | 手札破壊は `HAND_REMOVE` -> `hand_remove`。 |
| `GLUTTONOUS_WILL` | 使用後、使用カード以外の残り手札を全破壊する。 | pending は残り、次配置で悪食石化する。手札破壊は `HAND_CLEAR` -> `hand_remove`。 |
| `LOSS_WILL` | 対象特殊石を通常石へ戻す。 | pending を即 clear。通常石化は `STATUS_REMOVED` / `CHANGE` 系としてクロスフェード対象。 |
| `SALVATION_WILL` | 直前の相手ターンで破壊された石を自分の通常石としてランダム配置し、挟める場合は反転も行う。 | pending を即 clear。spawn 系ポジティブ強調対象。 |
| `FATE_WILL` | 次の相手ターンの controller override を arm する。 | pending を即 clear。 |

## 対象選択契約

`game/logic/cards-internal/pending-selection-registry.ts` の登録内容です。ここにあるカードは、使用後に選択 UI/CPU handler で対象を決めてから効果を解決します。

| type | kind | turn outcome | cancel | dispatch | target resolver |
| --- | --- | --- | --- | --- | --- |
| `DESTROY_ONE_STONE` | continue_turn | continue_turn | 可 | destroy | getDestroyTargets(board) |
| `STRONG_WIND_WILL` | continue_turn | continue_turn | 不可/未指定 | strong_wind | getStrongWindTargets(board) |
| `BUOYANCY_WILL` | continue_turn | continue_turn | 不可/未指定 | buoyancy | getBuoyancyTargets(board) |
| `SUPER_BUOYANCY_WILL` | continue_turn | continue_turn | 不可/未指定 | super_buoyancy | getSuperBuoyancyTargets(board) |
| `GRAVITY_WILL` | continue_turn | continue_turn | 不可/未指定 | gravity | getGravityTargets(board) |
| `SUPER_GRAVITY_WILL` | continue_turn | continue_turn | 不可/未指定 | super_gravity | getSuperGravityTargets(board) |
| `SUPER_ATTRACTION_WILL` | multi_stage | continue_turn | 不可/未指定 | super_attraction | getSuperAttractionTargets(player_pending) |
| `TELEPORT_WILL` | continue_turn | continue_turn | 不可/未指定 | teleport | getTeleportTargets(board) |
| `CELL_TELEPORT_WILL` | continue_turn | continue_turn | 不可/未指定 | cell_teleport | getCellTeleportTargets(board) |
| `TEMPT_WILL` | continue_turn | continue_turn | 不可/未指定 | tempt | getTemptWillTargets(player) |
| `CAPTURE_WILL` | continue_turn | continue_turn | 不可/未指定 | capture | getCaptureWillTargets(player) |
| `TRAP_WILL` | end_turn | end_turn | 不可/未指定 | trap | getTrapTargets(player) |
| `GUARD_WILL` | continue_turn | continue_turn | 不可/未指定 | guard | getGuardTargets(player) |
| `GUARDIAN_GOD` | continue_turn | continue_turn | 不可/未指定 | guard | getGuardTargets(player) |
| `LIVING_WILL` | continue_turn | continue_turn | 不可/未指定 | living_will | getLivingWillTargets(player) |
| `EXTEND_LIFE_WILL` | continue_turn | continue_turn | 不可/未指定 | extend_life | getExtendLifeTargets(player) |
| `EXTEND_LIFE_GOD` | continue_turn | continue_turn | 不可/未指定 | extend_life | getExtendLifeTargets(player) |
| `CORROSION_WILL` | continue_turn | continue_turn | 不可/未指定 | corrosion | getCorrosionTargets(player) |
| `CLONE_WILL` | continue_turn | continue_turn | 不可/未指定 | clone | getCloneTargets(player) |
| `BLOCKADE_WILL` | continue_turn | continue_turn | 可 | blockade | getBlockadeTargets(player) |
| `BOARD_EXPANSION_WILL` | continue_turn | continue_turn | 可 | board_expansion | getBoardExpansionTargets(player) |
| `BOARD_EXPANSION_GOD` | multi_stage | continue_turn | 可 | board_expansion | getBoardExpansionGodTargets(player) |
| `BOARD_SHRINK_WILL` | multi_stage | continue_turn | 可 | board_shrink | getBoardShrinkTargets(player, min 3) |
| `BOARD_SHRINK_GOD` | multi_stage | continue_turn | 可 | board_shrink | getBoardShrinkGodTargets(player) |
| `FREEZE_WILL` | continue_turn | continue_turn | 可 | freeze | getFreezeTargets(player) |
| `SEED_WILL` | continue_turn | continue_turn | 可 | seed | getSeedTargets(player) |
| `POSITION_SWAP_WILL` | multi_stage | continue_turn | 可 | position_swap | getPositionSwapTargets(player_pending, min 2) |
| `METEOR_WILL` | continue_turn | continue_turn | 可 | meteor | getMeteorTargets(player) |
| `TIME_BOMB` | continue_turn | continue_turn | 不可/未指定 | time_bomb | getTimeBombTargets(player) |
| `SWAP_WITH_ENEMY` | end_turn | end_turn | 不可/未指定 | swap_with_enemy | getSwapTargets(player) |
| `HEAVEN_BLESSING` | hand_overlay | continue_turn | 不可/未指定 | heaven_blessing | 手札/候補選択 |
| `CONDEMN_WILL` | hand_overlay | continue_turn | 不可/未指定 | condemn | 手札/候補選択 |

## 配置時に特殊石化・効果化する pending

`game/logic/cards-internal/effect-timing.ts` の `applyPlacementEffects` で確認できる配置時処理です。

| type | 配置時処理 |
| --- | --- |
| `FREE_PLACEMENT` / `LAST_RESORT` / `SNIPER_WILL` | 反転0でも配置可能な free placement 扱い。 |
| `PROTECTED_NEXT_STONE` | 配置石に `PROTECTED` marker を付与。 |
| `PERMA_PROTECT_NEXT_STONE` | 配置石に `PERMA_PROTECTED` marker を付与。所有者ターン開始回数による進化はしない。 |
| `REGEN_WILL` | 配置石に復活 marker を付与。 |
| `WORK_WILL` | 使用時に armed flag を立て、次配置石を work stone 化する。 |
| `ULTIMATE_REVERSE_DRAGON` | 配置石に `DRAGON` marker を付与。 |
| `BREEDING_WILL` | 配置石に `BREEDING` marker を付与。 |
| `PROLIFERATION_WILL` | 配置石に `PROLIFERATION` marker を付与。 |
| `ULTIMATE_DESTROY_GOD` | 配置石に `ULTIMATE_DESTROY_GOD` marker を付与。 |
| `STONE_SALVATION_GOD` | 配置石に `STONE_SALVATION_GOD` marker を付与。 |
| `SNIPER_WILL` | 配置石に `SNIPER` marker を付与。 |
| `GHOST_WILL` | 配置石に `GHOST` marker を付与。 |
| `AFTERIMAGE_WILL` | 配置石に `AFTERIMAGE_WILL` marker を付与し、反転/破壊回避カウンタを持つ。 |
| `TIME_STOP_GOD` | 配置石に `TIME_STOP` marker を付与。 |
| `WILL_HUNTER_KING` | 配置石に `WILL_HUNTER_KING` marker を付与し、反転/破壊回避カウンタを持つ。 |
| `DESTROY_DRAGON_WILL` | 配置石に `DESTROY_DRAGON` marker を付与。 |
| `LIGHTNING_WILL` | 配置石に `LIGHTNING` marker を付与。 |
| `HYPERACTIVE_WILL` | 配置石に `HYPERACTIVE` marker を付与し、反転回避1回を持つ。 |
| `EXTREME_HYPERACTIVE_WILL` | 配置石に `EXTREME_HYPERACTIVE` marker を付与し、反転/破壊回避カウンタを持つ。 |
| `ESCAPE_WILL` | 配置石に `ESCAPE_HYPERACTIVE` marker を付与し、反転回避1回を持つ。 |
| `ROBOT_VACUUM_WILL` | 配置石に `ROBOT_VACUUM` marker を付与。 |
| `GLUTTONOUS_WILL` | 配置石に `GLUTTONOUS` marker を付与。 |
| `INSTANT_HYPERACTIVE_WILL` | 配置石に instant 用 `HYPERACTIVE` marker を付与。 |
| `ULTIMATE_HYPERACTIVE_GOD` | 配置石に `ULTIMATE_HYPERACTIVE` marker を付与し、反転/破壊回避カウンタを持つ。 |
| `CROSS_BOMB` | 配置後に縦横2マス範囲を爆破する。 |
| `X_BOMB` | 配置後に斜め2マス範囲を爆破する。 |
| `DOUBLE_PLACE` / `TRIPLE_PLACE` / `QUAD_PLACE` / `INFINITE_PLACE` | 追加配置回数または無限配置 flag を設定する。 |
| `LAST_RESORT` | `placementsRemaining` を減らし、残りがあれば追加配置を継続する。 |

## 専用演出・音・表示の根拠

`ui/animation-engine.ts`, `game/turn/pipeline_ui_adapter.ts`, `shared/presentation-effect-profiles.ts`, `01-rulebook.md` で確認できる専用扱いです。

| 対象 | 事実 |
| --- | --- |
| `SNIPER_WILL` | `sniper_shot` は狙撃石から対象へ小球を飛ばしてから破壊。 |
| `DESTROY_DRAGON_WILL` / `DESTROY_DRAGON` | `destroy_dragon_breath` は発動元から対象へブレスを表示してから破壊。 |
| `ULTIMATE_DESTROY_GOD` | `udg_destroyed` は対象へ雷演出を表示してから破壊。 |
| `LIGHTNING_WILL` | `lightning_destroyed` は対象へ落雷演出を表示してから破壊。 |
| `ROBOT_VACUUM` | `robot_vacuum_suck` は吸い込み演出を使い、対象破壊後の cell clear も専用扱い。 |
| `GLUTTONOUS_WILL` / `GLUTTONOUS` | 捕食破壊は専用 profile があり、捕食破壊と進入移動を同一フェーズで扱う仕様。 |
| `WILL_HUNTER_KING` | `will_hunter_king_slash` は斬撃演出 profile。 |
| `BREEDING` / `EQUALITY_WILL` / `REINFORCEMENT_WILL` / `SALVATION_WILL` / `STONE_SALVATION_GOD` / `CLONE_WILL` / `PROLIFERATION_WILL` | spawn 系ポジティブ強調 profile。 |
| `TIME_BOMB` / `CROSS_BOMB` / `X_BOMB` / `ESCAPE_HYPERACTIVE` | batch/bomb destroy cause としてまとめて破壊フェーズ化される。 |
| `BUOYANCY_WILL` / `SUPER_BUOYANCY_WILL` / `GRAVITY_WILL` / `SUPER_GRAVITY_WILL` / `SUPER_ATTRACTION_WILL` | pipeline adapter の移動系 cause set に含まれる。通常の浮力/重力は縦方向 slide、超浮力/超重力/超引力は movement 実装側で経路上または到達先の石を破壊する。 |
| `TABOO_REVERSE_WILL` / 龍 / 連鎖 / 復活 / 繁殖 / 多動 / 交換 / 誘惑などのカード効果反転 | `card_effect_flip` 音の対象。 |
| `CARD_USED` | 原則として `card_use_button` 音を push。宝箱は rulebook 上の例外で使用ボタン音を再生しない。 |
| `HAND_CLEAR` / `HAND_REMOVE` | `hand_remove` playback event になり、手札破壊フェードを使う。 |

## 全カード一覧

| カード | type | cost | 状態 | 挙動 | 解決形態 | 演出・表示 |
| --- | --- | ---: | --- | --- | --- | --- |
| 宝箱 | `TREASURE_BOX` | 0 | 有効 | 使用時に布石を1〜3ランダムで獲得する。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 自由の意志 | `FREE_PLACEMENT` | 14 | 有効 | 反転0でも空きマスに置ける。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 最後の切り札 | `LAST_RESORT` | 9 | 有効 | 石数負けかつ合法手0の時に使用可能、空きマスに石を3個配置できる。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 狙撃の意志 | `SNIPER_WILL` | 23 | 有効 | 次に置く石を狙撃石化。空きマスに自由配置でき、配置時と自ターン開始時に最も近い敵石を1つ破壊する。6ターン持続。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`sniperStone` / 狙撃破壊時は狙撃石から対象へ小球が直線移動してから破壊フェード。 |
| 弱い意志 | `PROTECTED_NEXT_STONE` | 1 | 有効 | 次に置く石は次の相手ターン中だけ反転されない。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`protectedStoneTemporary` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 幽霊の意志 | `GHOST_WILL` | 5 | 有効 | 次に置く石を幽体化する。8ターンの間、反転・破壊の対象にはなるがその石自身は受けない。誘惑・捕獲など、対象条件を満たす反転・破壊以外の効果は通常どおり受ける。交換の意志は通常石のみ対象のため対象外。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`ghostStone` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 避ける意志 | `AFTERIMAGE_WILL` | 8 | 有効 | 次に置く石は反転または破壊されたとき3回まで復活する、復活後挟める列があれば反転させる。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`afterimageStone` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 交換の意志 | `SWAP_WITH_ENEMY` | 17 | 有効 | 相手通常石1つを自分の通常石に交換する。(反転可能)。使用後、手番終了。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 入替の意志 | `POSITION_SWAP_WILL` | 13 | 有効 | 盤面上の石2つを選び、位置を入れ替える。通常石・特殊石・爆弾を問わず対象にできる。 | 対象選択あり | 専用の特殊石画像マップなし / 入替元/先の両方を赤ハイライト。移動演出は通常移動より20%短い。 |
| 強い意志 | `PERMA_PROTECT_NEXT_STONE` | 15 | 有効 | 次に置く石はずっと反転されない強い石になる。強い石は特殊石として扱い、進化しない。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`protectedStone` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 強風の意志 | `STRONG_WIND_WILL` | 9 | 有効 | 選択した石を左右どちらかに端まで移動させる。 | 対象選択あり | 専用の特殊石画像マップなし / 移動先マスを演出中だけ赤ハイライト。移動時間は距離非依存。 |
| 超浮力 | `SUPER_BUOYANCY_WILL` | 31 | 有効 | 盤面の石1つを選び、上方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 浮力 | `BUOYANCY_WILL` | 9 | 有効 | 石1つ選び上方向の端まで移動させる | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 超重力 | `SUPER_GRAVITY_WILL` | 31 | 有効 | 盤面の石1つを選び、下方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 超引力 | `SUPER_ATTRACTION_WILL` | 40 | 有効 | 盤面の石1つを選び、盤面上の別マスまで最短経路で引き寄せる。経路上と指定マス上の石はすべて破壊する。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 重力 | `GRAVITY_WILL` | 9 | 有効 | 石1つ選び下方向の端まで移動させる。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 罠の意志 | `TRAP_WILL` | 4 | 有効 | 自分の石1つを罠石化してターン終了。次の相手ターン中に反転されると相手の布石を最大10奪う+手札全破壊。 | 対象選択あり | 特殊石見た目=`trapStone` / 設置直後は罠見た目にせず通常石表示。発動/不発で公開される瞬間まで隠す。発動時の手札破壊は `hand_remove` フェード。 |
| 意志の反転 | `TEMPT_WILL` | 34 | 有効 | 相手の特殊石を1つ選んで自分の色に変える。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 捕獲の意志 | `CAPTURE_WILL` | 20 | 有効 | 盤面上の敵の特殊石を1つ捕獲して自分の手札に加える。対象が無いと使えない。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 二連鎖の意志 | `DOUBLE_CHAIN_WILL` | 22 | 有効 | 反転後新たに挟める列ができた場合、1列追加反転する。使用後、三連鎖の意志が手札に加わる。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 一次反転後、追加連鎖を順番に再生する。 |
| 三連鎖の意志 | `TRIPLE_CHAIN_WILL` | 22 | 無効(`enabled:false`) | 反転後新たに挟める列ができた場合、2列追加反転する。使用後、四連鎖の意志が手札に加わる。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 一次反転後、追加連鎖を順番に再生する。 |
| 四連鎖の意志 | `QUAD_CHAIN_WILL` | 22 | 無効(`enabled:false`) | 反転後新たに挟める列ができた場合、3列追加反転する。使用後、無限連鎖の意志が手札に加わる。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 一次反転後、追加連鎖を順番に再生する。 |
| 無限連鎖の意志 | `INFINITE_CHAIN_WILL` | 50 | 無効(`enabled:false`) | 反転後新たに挟める列ができた場合、可能な限り追加反転する。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 一次反転後、可能な追加連鎖を順番に再生する。 |
| 禁忌の反転 | `TABOO_REVERSE_WILL` | 44 | 有効 | 次に置く石は挟めなくても反転可能。最も反転枚数が多い列1方向のみ。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 復活の意志 | `REGEN_WILL` | 12 | 有効 | 次に置く石は復活可能回数3を持つ。反転または破壊されるたびに1回消費して元色に戻り、そこから挟める列を反転する。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`regenStone` / 復活時は敵色への一時フリップを省略しクロスフェード優先。 |
| 破壊の意志 | `DESTROY_ONE_STONE` | 19 | 有効 | 盤上の石1つを破壊する。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 時限爆弾 | `TIME_BOMB` | 13 | 有効 | 盤面上の自分の石1つを時限爆弾化。3ターン後にそのマスと周囲1マス（3x3）を爆破。反転されると解除。 | 対象選択あり | 特殊石見た目=`timeBombStone` / 爆弾本体から周囲爆破の順で再生。 |
| 時間停石 | `TIME_STOP_GOD` | 0 | 有効 | 手札に残り、使用時に自分石3つを破壊して次に置く石を時間停石化。5ターン後時間停止を発動し2連続行動できる。 | 対象選択なし/配置時処理 | 特殊石見た目=`timeStopStone` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 究極反転龍 | `ULTIMATE_REVERSE_DRAGON` | 30 | 有効 | 空きマス自由配置可。置いた石が龍化し、配置時に周囲1マスを反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マスを反転（8ターン）。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`ultimateDragon` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 繁殖の意志 | `BREEDING_WILL` | 16 | 有効 | 次に置く石を繁殖化。周囲優先で石を1個生成し、周囲が埋まっている場合は最寄り空きへ生成。(5ターン) | 対象選択なし/配置時または即時処理 | 特殊石見た目=`breedingStone` / 生成は spawn 系のポジティブ強調対象。配置/ターン開始の生成は反転しない。 |
| 増殖の意志 | `PROLIFERATION_WILL` | 4 | 有効 | 次に置く石を増殖石化。破壊される時、周囲の空きへ1個増殖して破壊を防ぐ。10ターン後や反転時は通常石に戻る。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`proliferationStone` / 増殖生成は spawn 系のポジティブ強調対象。 |
| 複製の意志 | `CLONE_WILL` | 16 | 有効 | 盤面上の自分の石1つを選び、周囲8マスの空きからランダム1マスへ同じ石を複製する。生成では反転しない。特殊石は残り持続ターンなどを引き継ぐ。周囲に空きがない石は対象外。 | 対象選択あり | 専用の特殊石画像マップなし / 複製生成は spawn 系のポジティブ強調対象。 |
| 種まきの意志 | `SEED_WILL` | 7 | 有効 | 空きマス1つに種をまく。種マスは通常どおり配置でき、石が置かれると種は消える。所有者ターン開始時だけ減算し、5回目で空いたままなら同色の通常石が1個芽生える。芽生えでは反転しない。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| テレポート | `TELEPORT_WILL` | 10 | 有効 | 盤面上の石1つを選び、ランダムな空きマスへテレポートさせる。対象は敵味方・通常石・特殊石を問わない。 | 対象選択あり | 専用の特殊石画像マップなし / 移動先マスを演出中だけ赤ハイライト。 |
| マステレポート | `CELL_TELEPORT_WILL` | 18 | 有効 | マスを1つ選び、盤面外側へランダムテレポートさせ、元マスを穴化。 | 対象選択あり | 専用の特殊石画像マップなし / 移動先マスを演出中だけ赤ハイライトし、元マスは穴化する。 |
| 十字爆弾 | `CROSS_BOMB` | 18 | 有効 | 次に置く石を十字爆弾化。通常反転後に即起爆し、その石を起点に縦横2マス（中心含む十字）の石を爆破する。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`crossBombStone` / 通常反転後に即起爆し、爆破対象は destroy フェーズで再生。 |
| クロス爆弾 | `X_BOMB` | 18 | 有効 | 次に置く石をクロス爆弾化。通常反転後に即起爆し、その石を起点に斜め2マス（中心含むX字）の石を爆破する。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`xBombStone` / 通常反転後に即起爆し、爆破対象は destroy フェーズで再生。 |
| 多動の意志 | `HYPERACTIVE_WILL` | 8 | 有効 | 次に置く石を多動化。両者ターン開始時に1マス移動、反転回避を1回持つ。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`hyperactiveStone` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 極悪多動魔 | `EXTREME_HYPERACTIVE_WILL` | 35 | 有効 | 次に置く石を極悪多動魔化。両者ターン開始時に周囲へ移動し、近くの石を押しのける。反転5回・破壊5回を回避し、ターン制限なし。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`extremeHyperactiveStone` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 逃げる意志 | `ESCAPE_WILL` | 7 | 有効 | 次に置く石を逃亡石化。毎ターン1マス逃げるように移動し、移動できるマスがなくなると爆発。反転回避を1回持つ。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`escapeHyperactiveStone` / 移動先がない爆発は時限爆弾系と同様に同一 destroy フェーズで一括再生。 |
| ロボット掃除機 | `ROBOT_VACUUM_WILL` | 17 | 有効 | 次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。吸い込むと持続ターンが1増える。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`robotVacuumStone` / 吸い込み破壊だけ専用の吸い込み演出を使う。 |
| 悪食の意志 | `GLUTTONOUS_WILL` | 29 | 有効 | 使用後、残り手札をすべて破壊し、次に置く石を悪食石化。両者ターン開始時に敵石方向へ1マス移動し、隣接敵石へは優先して進入しながら捕食する。隣接敵石が無い場合は近づくように移動し、2連続で捕食できなければ飢えて消滅する。反転保護を持つ特殊石。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`gluttonousStone` / 使用時に残り手札を `hand_remove` フェード。捕食時は破壊と進入移動を同一フェーズで再生。 |
| 意志狩りの王 | `WILL_HUNTER_KING` | 33 | 有効 | 次に置く石を意志狩り化。自ターン開始時、敵石を1つ破壊してそのマスへ移動する。敵の特殊石を優先して狙う。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`willHunterKingStone` / 破壊時は斬撃演出プロファイルがある。 |
| 瞬間多動 | `INSTANT_HYPERACTIVE_WILL` | 2 | 有効 | 次に置く石を瞬間多動石化。配置直後にランダム1マス移動を3回行い、各移動後に挟めば反転。最後に消滅する。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`hyperactiveStone` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 再構築の意志 | `REBUILD_WILL` | 0 | 有効 | 手札をすべて破壊し、新たに3枚ドローする。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 手札破壊は `hand_remove` フェード。 |
| 出稼ぎの意志 | `WORK_WILL` | 11 | 有効 | 次の配置石をアンカー化。自ターン開始時に1→2→4→8→16の順でチャージ獲得（最大99）。失うと終了。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`workStone` / 出稼ぎ石の登場/終了/収入吹き出しを約3秒表示し終端でフェードアウト。 |
| リボ払いの意志 | `RIBO_WILL` | 0 | 有効 | 布石を30得る。その後9ターンの間4返済。足りない場合は自石4個を消滅させる。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 意志の喪失 | `LOSS_WILL` | 15 | 有効 | 盤面上の特殊石をすべて通常石に戻す。敵味方を問わず、色は変わらない。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 特殊石/爆弾を通常石へ戻す切替は透明度クロスフェード。 |
| 二連投石 | `DOUBLE_PLACE` | 24 | 有効 | 使用ターンだけ石を2連続で置ける。使用後、三連投石が手札に加わる。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 追加配置の間に開始時効果を再実行しない。 |
| 三連投石 | `TRIPLE_PLACE` | 24 | 無効(`enabled:false`) | 使用ターンだけ石を3連続で置ける。使用後、四連投石が手札に加わる。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 追加配置の間に開始時効果を再実行しない。 |
| 四連投石 | `QUAD_PLACE` | 24 | 無効(`enabled:false`) | 使用ターンだけ石を4連続で置ける。使用後、無限投石が手札に加わる。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 追加配置の間に開始時効果を再実行しない。 |
| 無限投石 | `INFINITE_PLACE` | 50 | 無効(`enabled:false`) | 使用ターンだけ合法手がなくなるまで石を連続で置ける。置けなくなった時点で終了する。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 合法手が尽きた時点で終了し、追加配置間に開始時効果を再実行しない。 |
| 天の恵み | `HEAVEN_BLESSING` | 3 | 有効 | ランダムな候補5枚から1枚を選んで獲得する。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 観測の意志 | `REVEAL_HAND_WILL` | 2 | 有効 | 現在の相手手札をすべて表にする。使用後に相手が引いたカードは表にならない。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 断罪の意志 | `CONDEMN_WILL` | 8 | 有効 | 相手手札を公開し、1枚選んで破壊する。 | 対象選択あり | 専用の特殊石画像マップなし / 相手手札破壊は `hand_remove` フェード。 |
| 執行の意志 | `EXECUTION_WILL` | 2 | 有効 | 直前の相手ターンで自分の石が破壊されていた場合に使用可能。相手手札をランダムで最大3枚破壊する。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 相手手札破壊は `hand_remove` フェード。 |
| 金の意志 | `GOLD_STONE` | 6 | 有効 | 次の反転で得る布石を4倍にする。使用後その石は消滅。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`goldStone` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 虹の意志 | `RAINBOW_STONE` | 10 | 有効 | 次の反転で得る布石を6倍にする。使用後その石は消滅。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`rainbowStone` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 銀の意志 | `SILVER_STONE` | 3 | 有効 | 次の反転で得る布石を3倍にする。使用後その石は消滅。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`silverStone` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 演算の意志 | `CRYSTAL_STONE` | 6 | 有効 | 次に得る数字マスの布石を2倍にする。数字マス以外では何も起こらない。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 延命の意志 | `EXTEND_LIFE_WILL` | 4 | 有効 | 盤面上の自分の特殊石1つを選び、その持続ターンを2倍にする。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 延命神 | `EXTEND_LIFE_GOD` | 10 | 有効 | 盤面上の自分の特殊石1つを選び、その持続ターンを4倍にする。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 腐食の意志 | `CORROSION_WILL` | 2 | 有効 | 盤面上の特殊石1つを選び、その持続ターンを半減させる。対象がない場合は使用不可。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 守る意志 | `GUARD_WILL` | 2 | 有効 | 自分の石1つに完全保護を付与する。3ターン持続。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 守護神 | `GUARDIAN_GOD` | 10 | 有効 | 自分の石1つに完全保護を付与する。10ターン持続。 | 対象選択あり | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 救済神 | `STONE_SALVATION_GOD` | 25 | 有効 | 次に置く石を救済神化。12ターンの間、破壊された石を救済神の持ち主の通常石として空きマスに復活させる。救済神自身は復活しない。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`stoneSalvationGod` / 救済神による復活配置は spawn 系のポジティブ強調対象。 |
| 破壊龍 | `DESTROY_DRAGON_WILL` | 7 | 有効 | 次に置く石を破壊龍化。配置時と自ターン開始時に周囲1マス（8方向）の敵石をランダム1個だけ破壊する。3ターン持続。反転保護を持つ特殊石。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`destroyDragonStone` / 周囲破壊時は発動元から対象へ炎ブレスを表示してから破壊フェード。 |
| 落雷 | `LIGHTNING_WILL` | 26 | 有効 | 次に置く石を落雷石化。配置ターン即時と自ターン開始時に盤面上のランダムな敵石を1個破壊する。6ターン持続。反転保護を持つ特殊石。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`lightningStone` / 落雷破壊時は対象マスへ落雷演出を表示してから破壊フェード。 |
| 究極破壊神 | `ULTIMATE_DESTROY_GOD` | 30 | 有効 | 次に置く石を究極破壊神化。空きマスに自由配置でき、配置時と自ターン開始時に周囲1マスの敵石を破壊する。6ターン持続。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`ultimateDestroyGod` / 周囲破壊時は対象マスへ雷演出を表示してから破壊フェード。 |
| 究極多動神 | `ULTIMATE_HYPERACTIVE_GOD` | 28 | 有効 | 次に置く石を究極多動神化。12ターンの間、両者ターン開始時に直線移動を2回行う。移動後に挟めば反転し、反転5回・破壊2回を回避する。 | 対象選択なし/配置時または即時処理 | 特殊石見た目=`ultimateHyperactiveGod` / カード共通の使用/手札/盤面イベント再生のみ確認。 |
| 盤面拡張 | `BOARD_EXPANSION_WILL` | 19 | 有効 | 盤面の左右どちらか外側に1マスを追加する。追加位置は左右端マスから選ぶ。1対局で1回のみ使用可能。 | 対象選択あり | 専用の特殊石画像マップなし / 新規拡張マスは短いフェードインで表示。 |
| 盤面拡張神 | `BOARD_EXPANSION_GOD` | 27 | 有効 | 初期8x8の角マスから拡張可能な角を最大2つ選び、その外側3〜6マス（各角3マスずつ、直交2方向+斜め）に拡張セルを追加する。 | 対象選択あり | 専用の特殊石画像マップなし / 新規拡張マスは短いフェードインで表示。 |
| 盤面縮小 | `BOARD_SHRINK_WILL` | 19 | 有効 | 現在の盤面外周の角/辺から3マスを順に選び、3つ目の選択時に不可侵の顕現石以外を封鎖・凍結・種など既存状態ごと同時に穴化する。 | 対象選択あり | 専用の特殊石画像マップなし / 選択完了時に対象マスを同一フェーズで穴化し、外側フレームが押し込まれた見た目を残す。 |
| 盤面縮小神 | `BOARD_SHRINK_GOD` | 27 | 有効 | 現在の盤面外周の角を1つ選び、その角から伸びる辺1列を選ぶ。選んだ辺1列の不可侵の顕現石以外を封鎖・凍結・種など既存状態ごと同時に穴化する。 | 対象選択あり | 専用の特殊石画像マップなし / 選択完了時に対象列を同一フェーズで穴化し、外側フレームが押し込まれた見た目を残す。 |
| 封鎖の意志 | `BLOCKADE_WILL` | 1 | 有効 | 盤面の空きマス1つを封鎖し、3ターンの間は両者とも配置・移動で入れない。 | 対象選択あり | 専用の特殊石画像マップなし / 既存の赤バツ表示を使い、追加の一時マスハイライトは出さない。 |
| 隕石 | `METEOR_WILL` | 21 | 有効 | 盤面上のマスを1つ選び、不可侵の顕現石がなければ石や封鎖・凍結・種など既存状態ごと永続穴にする。穴は配置・移動不可で反転経路も遮断する。 | 対象選択あり | 専用の特殊石画像マップなし / 石がある対象は破壊演出後に永続穴マス画像へ変わる。 |
| 凍結の意志 | `FREEZE_WILL` | 5 | 有効 | 盤面上のマスを1つ選び、5ターン凍結する。凍結マスとその石は反転・破壊されず、凍結中は特殊石の持続ターンが減らない。 | 対象選択あり | 専用の特殊石画像マップなし / 対象マスに `assets/images/other/ICE.png` を半透明で重ね、終了時は氷オーバーレイをフェードアウト。 |
| 救済の意志 | `SALVATION_WILL` | 17 | 有効 | 直前の相手ターンで破壊された全ての石を救済し、自分の通常石として空きマスにランダム配置。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 救済配置は spawn 系のポジティブ強調対象。 |
| 生きる意志 | `LIVING_WILL` | 20 | 有効 | 自分の石1つに生きる意志を付与。失われる時に1回だけ、付与時点の石状態で復活する。元マスが使えない時は別の空きマスへ復活。 | 対象選択あり | 専用の特殊石画像マップなし / 復活時は対応する復活イベントとして再生される。 |
| 増援の意志 | `REINFORCEMENT_WILL` | 4 | 有効 | 石に隣接する内側空きマスへランダム1マス通常石を配置する。(反転可能) | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / 増援配置は spawn 系のポジティブ強調対象。 |
| 平等の意志 | `EQUALITY_WILL` | 15 | 有効 | 空きマスに3個石をランダム配置、石数が10個以上負けているときに使用可能。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / ランダム配置は spawn 系のポジティブ強調対象。 |
| 運命の意志 | `FATE_WILL` | 50 | 有効 | 次の相手のターンを自分が操作できる。 | 対象選択なし/配置時または即時処理 | 専用の特殊石画像マップなし / カード共通の使用/手札/盤面イベント再生のみ確認。 |

## 根拠ファイル

- `cards/catalog.json`: カード名、type、cost、説明、enabled 状態。
- `game/logic/cards.ts`: カード解決 API、配置時効果、ターン開始/終了処理への接続。
- `game/logic/cards-internal/effect-timing.ts`: 次配置で特殊石化するカード、反転後効果、複数配置/連鎖処理。
- `game/logic/cards-internal/pending-selection-registry.ts`: 対象選択カード、選択完了後の turn outcome、network publish defer、CPU/UI handler。
- `game/visual-effects-map.runtime.js`: pending type / special type から特殊石画像キーへの対応。
- `shared/presentation-effect-profiles.ts`: 専用破壊プロファイルと spawn 系ハイライト対象。
- `ui/animation-engine.ts`: 破壊元アニメーション、移動、フリップ、クロスフェード、手札/盤面再生。
- `01-rulebook.md`: UI/演出仕様、例外演出、音声/時間定数。
