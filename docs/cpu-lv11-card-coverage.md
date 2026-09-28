# Lv11自己対局のカード・特殊石対応と一致検証

文書の役割: 検証記録。対象: 通常ブラウザとProductionMatchのゲーム状態遷移。一次情報: `01-rulebook.md`、`cards/catalog.json`、正本TurnPipeline、特殊石registry。組合せの網羅証明やLv11の強さ評価を目的としない。

## 検証範囲と方法

- 通常配信 `http://127.0.0.1:8000/` のVite/Pixiで読み込まれた正本処理と、Nodeの正本処理へ同じ回帰局面・行動列・PRNGを渡した。カード使用とターゲットは通常の合法性検証を通し、各行動後と14ターン境界まで全ゲーム状態を比較した。音・演出待ち・ロック解除をルール実行の条件にしない。
- 99種×黒白198局面と、火・水・草・雷から森羅万象神へ自動融合する黒白2局面の合計200件が一致した。手札/山札、布石、特殊石、遅延効果、追加行動、pending、盤面の穴と拡張、PRNG消費数も含む。
- 長期対局の通常画面操作は別の `browser-parity-v2` で初期化から85手終局まで確認した。回帰局面はブラウザ内の同じ正本処理を直接呼ぶため、200局面のUIクリックや表示品質を確認したという意味ではない。
- 例外・拒否・無進行を黙って成功にしない。初回は最後の切り札のfixtureに合法手が残り2件失敗したため、使用条件を満たす局面に修正し、v1/v2/v3の記録を保持した。カード効果や判定は変更していない。
- 総遷移5862、ターン境界2776、差分0、pageerror0。
- [全体レポート](../data/cpu-lv11/card-browser-v3/report.json) SHA-256: `5cb1f6301660c413237851f24402f302f3e3b14c9d263ad1c8455d83bf4a57c4`。各traceに初期状態、全行動、全中間状態、ブラウザ出力を保存し、レポートにファイルhashを記録。
- 入口: `npm run build:ts` 後、`node dist/scripts/verify-production-card-browser.js <新しい保存先>`。既存保存先への上書きは拒否する。fixtureは `scripts/production-card-fixtures.ts`、比較除外6項目と理由は `src/engine/production-match.ts` の `PRODUCTION_STATE_EXCLUSIONS`。

## カード対応

全行は使用成功とそのカードのターン完了を確認済み。「遷移 黒/白」はターン開始を含む。デッキから除く上位連鎖・投石6種も、生成後の手札で使う回帰として含める。証拠リンクの同名 `-white.json.gz` が白番の記録。

| カード | 種別 | 遷移 黒/白 | 証拠 |
| --- | --- | --- | --- |
| 宝箱 | `TREASURE_BOX` | 29/29 | [chest_01](../data/cpu-lv11/card-browser-v3/chest_01-black.json.gz) |
| 自由の意志 | `FREE_PLACEMENT` | 29/29 | [free_01](../data/cpu-lv11/card-browser-v3/free_01-black.json.gz) |
| 最後の切り札 | `LAST_RESORT` | 8/8 | [last_resort_01](../data/cpu-lv11/card-browser-v3/last_resort_01-black.json.gz) |
| 狙撃の意志 | `SNIPER_WILL` | 29/29 | [sniper_01](../data/cpu-lv11/card-browser-v3/sniper_01-black.json.gz) |
| 弱い意志 | `PROTECTED_NEXT_STONE` | 29/29 | [hard_01](../data/cpu-lv11/card-browser-v3/hard_01-black.json.gz) |
| 幽霊の意志 | `GHOST_WILL` | 29/29 | [ghost_01](../data/cpu-lv11/card-browser-v3/ghost_01-black.json.gz) |
| 犠牲の意志 | `SACRIFICE_WILL` | 29/29 | [sacrifice_will_01](../data/cpu-lv11/card-browser-v3/sacrifice_will_01-black.json.gz) |
| ゾンビの意志 | `ZOMBIE_WILL` | 29/29 | [zombie_will_01](../data/cpu-lv11/card-browser-v3/zombie_will_01-black.json.gz) |
| 避ける意志 | `AFTERIMAGE_WILL` | 29/29 | [afterimage_will_01](../data/cpu-lv11/card-browser-v3/afterimage_will_01-black.json.gz) |
| 交換の意志 | `SWAP_WITH_ENEMY` | 29/29 | [swap_01](../data/cpu-lv11/card-browser-v3/swap_01-black.json.gz) |
| 入替の意志 | `POSITION_SWAP_WILL` | 31/31 | [position_swap_01](../data/cpu-lv11/card-browser-v3/position_swap_01-black.json.gz) |
| 強い意志 | `PERMA_PROTECT_NEXT_STONE` | 29/29 | [perma_01](../data/cpu-lv11/card-browser-v3/perma_01-black.json.gz) |
| 強風の意志 | `STRONG_WIND_WILL` | 30/30 | [strong_wind_01](../data/cpu-lv11/card-browser-v3/strong_wind_01-black.json.gz) |
| 超浮力 | `SUPER_BUOYANCY_WILL` | 30/30 | [super_buoyancy_01](../data/cpu-lv11/card-browser-v3/super_buoyancy_01-black.json.gz) |
| 浮力 | `BUOYANCY_WILL` | 30/30 | [buoyancy_01](../data/cpu-lv11/card-browser-v3/buoyancy_01-black.json.gz) |
| 超重力 | `SUPER_GRAVITY_WILL` | 30/30 | [super_gravity_01](../data/cpu-lv11/card-browser-v3/super_gravity_01-black.json.gz) |
| 超引力 | `SUPER_ATTRACTION_WILL` | 31/31 | [super_attraction_01](../data/cpu-lv11/card-browser-v3/super_attraction_01-black.json.gz) |
| 重力 | `GRAVITY_WILL` | 30/30 | [gravity_01](../data/cpu-lv11/card-browser-v3/gravity_01-black.json.gz) |
| 罠の意志 | `TRAP_WILL` | 29/29 | [trap_01](../data/cpu-lv11/card-browser-v3/trap_01-black.json.gz) |
| 意志の反転 | `TEMPT_WILL` | 30/30 | [tempt_01](../data/cpu-lv11/card-browser-v3/tempt_01-black.json.gz) |
| 捕獲の意志 | `CAPTURE_WILL` | 30/30 | [capture_01](../data/cpu-lv11/card-browser-v3/capture_01-black.json.gz) |
| 二連鎖の意志 | `DOUBLE_CHAIN_WILL` | 29/29 | [double_chain_01](../data/cpu-lv11/card-browser-v3/double_chain_01-black.json.gz) |
| 三連鎖の意志 | `TRIPLE_CHAIN_WILL` | 29/29 | [triple_chain_01](../data/cpu-lv11/card-browser-v3/triple_chain_01-black.json.gz) |
| 四連鎖の意志 | `QUAD_CHAIN_WILL` | 29/29 | [quad_chain_01](../data/cpu-lv11/card-browser-v3/quad_chain_01-black.json.gz) |
| 無限連鎖の意志 | `INFINITE_CHAIN_WILL` | 29/29 | [infinite_chain_01](../data/cpu-lv11/card-browser-v3/infinite_chain_01-black.json.gz) |
| 禁忌の反転 | `TABOO_REVERSE_WILL` | 29/29 | [taboo_reverse_01](../data/cpu-lv11/card-browser-v3/taboo_reverse_01-black.json.gz) |
| 反転の意志 | `REVERSE_WILL` | 30/30 | [reverse_will_01](../data/cpu-lv11/card-browser-v3/reverse_will_01-black.json.gz) |
| 復活の意志 | `REGEN_WILL` | 29/29 | [regen_01](../data/cpu-lv11/card-browser-v3/regen_01-black.json.gz) |
| 破壊の意志 | `DESTROY_ONE_STONE` | 30/30 | [destroy_01](../data/cpu-lv11/card-browser-v3/destroy_01-black.json.gz) |
| 時限爆弾 | `TIME_BOMB` | 30/30 | [bomb_01](../data/cpu-lv11/card-browser-v3/bomb_01-black.json.gz) |
| 時間停石 | `TIME_STOP_GOD` | 29/29 | [time_stop_god_01](../data/cpu-lv11/card-browser-v3/time_stop_god_01-black.json.gz) |
| 究極反転龍 | `ULTIMATE_REVERSE_DRAGON` | 29/29 | [udr_01](../data/cpu-lv11/card-browser-v3/udr_01-black.json.gz) |
| 繁殖の意志 | `BREEDING_WILL` | 29/29 | [breeding_01](../data/cpu-lv11/card-browser-v3/breeding_01-black.json.gz) |
| 増殖の意志 | `PROLIFERATION_WILL` | 29/29 | [proliferation_01](../data/cpu-lv11/card-browser-v3/proliferation_01-black.json.gz) |
| 複製の意志 | `CLONE_WILL` | 30/30 | [clone_01](../data/cpu-lv11/card-browser-v3/clone_01-black.json.gz) |
| 種まきの意志 | `SEED_WILL` | 30/30 | [seed_01](../data/cpu-lv11/card-browser-v3/seed_01-black.json.gz) |
| テレポート | `TELEPORT_WILL` | 30/30 | [teleport_01](../data/cpu-lv11/card-browser-v3/teleport_01-black.json.gz) |
| マステレポート | `CELL_TELEPORT_WILL` | 30/30 | [cell_teleport_01](../data/cpu-lv11/card-browser-v3/cell_teleport_01-black.json.gz) |
| 十字爆弾 | `CROSS_BOMB` | 29/29 | [cross_bomb_01](../data/cpu-lv11/card-browser-v3/cross_bomb_01-black.json.gz) |
| クロス爆弾 | `X_BOMB` | 29/29 | [x_bomb_01](../data/cpu-lv11/card-browser-v3/x_bomb_01-black.json.gz) |
| 躍動の意志 | `HYPERACTIVE_WILL` | 29/29 | [hyperactive_01](../data/cpu-lv11/card-browser-v3/hyperactive_01-black.json.gz) |
| 極悪躍動魔 | `EXTREME_HYPERACTIVE_WILL` | 29/29 | [extreme_hyperactive_01](../data/cpu-lv11/card-browser-v3/extreme_hyperactive_01-black.json.gz) |
| 逃げる意志 | `ESCAPE_WILL` | 29/29 | [escape_01](../data/cpu-lv11/card-browser-v3/escape_01-black.json.gz) |
| ロボット掃除機 | `ROBOT_VACUUM_WILL` | 29/29 | [robot_vacuum_01](../data/cpu-lv11/card-browser-v3/robot_vacuum_01-black.json.gz) |
| 悪食の意志 | `GLUTTONOUS_WILL` | 29/29 | [gluttonous_will_01](../data/cpu-lv11/card-browser-v3/gluttonous_will_01-black.json.gz) |
| 意志狩りの王 | `WILL_HUNTER_KING` | 29/29 | [will_hunter_king_01](../data/cpu-lv11/card-browser-v3/will_hunter_king_01-black.json.gz) |
| 瞬間躍動 | `INSTANT_HYPERACTIVE_WILL` | 29/29 | [instant_hyperactive_01](../data/cpu-lv11/card-browser-v3/instant_hyperactive_01-black.json.gz) |
| 再構築の意志 | `REBUILD_WILL` | 29/29 | [rebuild_01](../data/cpu-lv11/card-browser-v3/rebuild_01-black.json.gz) |
| 出稼ぎの意志 | `WORK_WILL` | 29/29 | [work_01](../data/cpu-lv11/card-browser-v3/work_01-black.json.gz) |
| 究極労働神 | `ULTIMATE_WORK_GOD` | 29/29 | [ultimate_work_god_01](../data/cpu-lv11/card-browser-v3/ultimate_work_god_01-black.json.gz) |
| リボ払いの意志 | `RIBO_WILL` | 29/29 | [ribo_01](../data/cpu-lv11/card-browser-v3/ribo_01-black.json.gz) |
| 意志の喪失 | `LOSS_WILL` | 29/29 | [loss_will_01](../data/cpu-lv11/card-browser-v3/loss_will_01-black.json.gz) |
| 意志の凍結 | `MASS_FREEZE_WILL` | 29/29 | [mass_freeze_will_01](../data/cpu-lv11/card-browser-v3/mass_freeze_will_01-black.json.gz) |
| 二連投石 | `DOUBLE_PLACE` | 30/30 | [double_01](../data/cpu-lv11/card-browser-v3/double_01-black.json.gz) |
| 三連投石 | `TRIPLE_PLACE` | 31/31 | [triple_01](../data/cpu-lv11/card-browser-v3/triple_01-black.json.gz) |
| 四連投石 | `QUAD_PLACE` | 32/32 | [quad_01](../data/cpu-lv11/card-browser-v3/quad_01-black.json.gz) |
| 無限投石 | `INFINITE_PLACE` | 35/35 | [infinite_01](../data/cpu-lv11/card-browser-v3/infinite_01-black.json.gz) |
| 天の恵み | `HEAVEN_BLESSING` | 30/30 | [heaven_01](../data/cpu-lv11/card-browser-v3/heaven_01-black.json.gz) |
| 観測の意志 | `REVEAL_HAND_WILL` | 29/29 | [reveal_hand_01](../data/cpu-lv11/card-browser-v3/reveal_hand_01-black.json.gz) |
| 理論の化身 | `THEORY_INCARNATION` | 29/29 | [theory_incarnation_01](../data/cpu-lv11/card-browser-v3/theory_incarnation_01-black.json.gz) |
| 盤界の執行者 | `BOARD_EXECUTOR` | 29/29 | [board_executor_01](../data/cpu-lv11/card-browser-v3/board_executor_01-black.json.gz) |
| 盤理の観測者 | `OBSERVER_WILL` | 30/30 | [observer_will_01](../data/cpu-lv11/card-browser-v3/observer_will_01-black.json.gz) |
| 断罪の意志 | `CONDEMN_WILL` | 30/30 | [condemn_01](../data/cpu-lv11/card-browser-v3/condemn_01-black.json.gz) |
| 執行の意志 | `EXECUTION_WILL` | 29/29 | [execution_01](../data/cpu-lv11/card-browser-v3/execution_01-black.json.gz) |
| 金の意志 | `GOLD_STONE` | 29/29 | [gold_stone](../data/cpu-lv11/card-browser-v3/gold_stone-black.json.gz) |
| 虹の意志 | `RAINBOW_STONE` | 29/29 | [rainbow_stone](../data/cpu-lv11/card-browser-v3/rainbow_stone-black.json.gz) |
| 銀の意志 | `SILVER_STONE` | 29/29 | [silver_stone](../data/cpu-lv11/card-browser-v3/silver_stone-black.json.gz) |
| 演算の意志 | `CRYSTAL_STONE` | 29/29 | [crystal_stone](../data/cpu-lv11/card-browser-v3/crystal_stone-black.json.gz) |
| 延命の意志 | `EXTEND_LIFE_WILL` | 30/30 | [extend_life_01](../data/cpu-lv11/card-browser-v3/extend_life_01-black.json.gz) |
| 延命神 | `EXTEND_LIFE_GOD` | 30/30 | [extend_life_god_01](../data/cpu-lv11/card-browser-v3/extend_life_god_01-black.json.gz) |
| 腐食の意志 | `CORROSION_WILL` | 30/30 | [corrosion_01](../data/cpu-lv11/card-browser-v3/corrosion_01-black.json.gz) |
| 守る意志 | `GUARD_WILL` | 30/30 | [guard_01](../data/cpu-lv11/card-browser-v3/guard_01-black.json.gz) |
| 守護神 | `GUARDIAN_GOD` | 30/30 | [guardian_god_01](../data/cpu-lv11/card-browser-v3/guardian_god_01-black.json.gz) |
| 救済神 | `STONE_SALVATION_GOD` | 29/29 | [stone_salvation_god_01](../data/cpu-lv11/card-browser-v3/stone_salvation_god_01-black.json.gz) |
| 破壊龍 | `DESTROY_DRAGON_WILL` | 29/29 | [destroy_dragon_01](../data/cpu-lv11/card-browser-v3/destroy_dragon_01-black.json.gz) |
| 雷の意志 | `LIGHTNING_WILL` | 29/29 | [lightning_01](../data/cpu-lv11/card-browser-v3/lightning_01-black.json.gz) |
| 究極破壊神 | `ULTIMATE_DESTROY_GOD` | 29/29 | [udg_01](../data/cpu-lv11/card-browser-v3/udg_01-black.json.gz) |
| 究極躍動神 | `ULTIMATE_HYPERACTIVE_GOD` | 29/29 | [ultimate_hyperactive_01](../data/cpu-lv11/card-browser-v3/ultimate_hyperactive_01-black.json.gz) |
| 盤面拡張 | `BOARD_EXPANSION_WILL` | 30/30 | [board_expand_01](../data/cpu-lv11/card-browser-v3/board_expand_01-black.json.gz) |
| 盤面拡張神 | `BOARD_EXPANSION_GOD` | 31/31 | [board_expand_god_01](../data/cpu-lv11/card-browser-v3/board_expand_god_01-black.json.gz) |
| 盤面縮小 | `BOARD_SHRINK_WILL` | 32/32 | [board_shrink_01](../data/cpu-lv11/card-browser-v3/board_shrink_01-black.json.gz) |
| 盤面縮小神 | `BOARD_SHRINK_GOD` | 31/31 | [board_shrink_god_01](../data/cpu-lv11/card-browser-v3/board_shrink_god_01-black.json.gz) |
| 封鎖の意志 | `BLOCKADE_WILL` | 30/30 | [blockade_01](../data/cpu-lv11/card-browser-v3/blockade_01-black.json.gz) |
| 毒殺の意志 | `POISON_WILL` | 30/30 | [poison_will_01](../data/cpu-lv11/card-browser-v3/poison_will_01-black.json.gz) |
| 火の意志 | `FIRE_WILL` | 29/29 | [fire_will_01](../data/cpu-lv11/card-browser-v3/fire_will_01-black.json.gz) |
| 水の意志 | `WATER_WILL` | 29/29 | [water_will_01](../data/cpu-lv11/card-browser-v3/water_will_01-black.json.gz) |
| 草の意志 | `GRASS_WILL` | 29/29 | [grass_will_01](../data/cpu-lv11/card-browser-v3/grass_will_01-black.json.gz) |
| 因果抹消 | `METEOR_WILL` | 30/30 | [meteor_01](../data/cpu-lv11/card-browser-v3/meteor_01-black.json.gz) |
| 因果再生 | `CAUSAL_REPLAY_WILL` | 30/30 | [causal_replay_01](../data/cpu-lv11/card-browser-v3/causal_replay_01-black.json.gz) |
| 凍結の意志 | `FREEZE_WILL` | 30/30 | [freeze_01](../data/cpu-lv11/card-browser-v3/freeze_01-black.json.gz) |
| 救済の意志 | `SALVATION_WILL` | 29/29 | [salvation_01](../data/cpu-lv11/card-browser-v3/salvation_01-black.json.gz) |
| 生きる意志 | `LIVING_WILL` | 30/30 | [living_will_01](../data/cpu-lv11/card-browser-v3/living_will_01-black.json.gz) |
| 増援の意志 | `REINFORCEMENT_WILL` | 29/29 | [reinforcement_01](../data/cpu-lv11/card-browser-v3/reinforcement_01-black.json.gz) |
| 援軍の意志 | `SUPPORT_TROOPS_WILL` | 29/29 | [support_troops_01](../data/cpu-lv11/card-browser-v3/support_troops_01-black.json.gz) |
| 平等の意志 | `EQUALITY_WILL` | 29/29 | [equality_will_01](../data/cpu-lv11/card-browser-v3/equality_will_01-black.json.gz) |
| 運命の意志 | `FATE_WILL` | 29/29 | [fate_will_01](../data/cpu-lv11/card-browser-v3/fate_will_01-black.json.gz) |
| 因果抹消神 | `METEOR_GOD` | 29/29 | [meteor_god_01](../data/cpu-lv11/card-browser-v3/meteor_god_01-black.json.gz) |
| 混沌召喚 | `CHAOS_SUMMON` | 29/29 | [chaos_summon_01](../data/cpu-lv11/card-browser-v3/chaos_summon_01-black.json.gz) |
| 時間停神 | `TIME_STOP_DEITY` | 29/29 | [time_stop_deity_01](../data/cpu-lv11/card-browser-v3/time_stop_deity_01-black.json.gz) |

## 特殊石・石状態・配置時効果

盤上に残る種類は、下記traceの中間状態に存在することを検査した。金・虹・銀、十字/クロス爆弾は配置時に解決して消えるため、対応カードのpendingと配置後の盤面/布石/PRNGを照合する。分類は正本registryを使用する。

| 種類 | 分類 | 証拠 |
| --- | --- | --- |
| 弱い石 (`PROTECTED`) | true_special_stone | [chest_01](../data/cpu-lv11/card-browser-v3/chest_01-black.json.gz) |
| 強い石 (`PERMA_PROTECTED`) | true_special_stone | [perma_01](../data/cpu-lv11/card-browser-v3/perma_01-black.json.gz) |
| 究極反転龍 (`DRAGON`) | true_special_stone | [udr_01](../data/cpu-lv11/card-browser-v3/udr_01-black.json.gz) |
| 繁殖石 (`BREEDING`) | true_special_stone | [chest_01](../data/cpu-lv11/card-browser-v3/chest_01-black.json.gz) |
| 増殖石 (`PROLIFERATION`) | true_special_stone | [proliferation_01](../data/cpu-lv11/card-browser-v3/proliferation_01-black.json.gz) |
| 究極破壊神 (`ULTIMATE_DESTROY_GOD`) | true_special_stone | [udg_01](../data/cpu-lv11/card-browser-v3/udg_01-black.json.gz) |
| 破壊龍 (`DESTROY_DRAGON`) | true_special_stone | [destroy_dragon_01](../data/cpu-lv11/card-browser-v3/destroy_dragon_01-black.json.gz) |
| 狙撃石 (`SNIPER`) | true_special_stone | [sniper_01](../data/cpu-lv11/card-browser-v3/sniper_01-black.json.gz) |
| 落雷石 (`LIGHTNING`) | true_special_stone | [lightning_01](../data/cpu-lv11/card-browser-v3/lightning_01-black.json.gz) |
| 火石 (`FIRE`) | true_special_stone | [fire_will_01](../data/cpu-lv11/card-browser-v3/fire_will_01-black.json.gz) |
| 水石 (`WATER`) | true_special_stone | [water_will_01](../data/cpu-lv11/card-browser-v3/water_will_01-black.json.gz) |
| 草石 (`GRASS`) | true_special_stone | [grass_will_01](../data/cpu-lv11/card-browser-v3/grass_will_01-black.json.gz) |
| 森羅万象神 (`SHINRA_BANSHO_GOD`) | true_special_stone | [shinra-fusion](../data/cpu-lv11/card-browser-v3/shinra-fusion-black.json.gz) |
| 因果抹消神石 (`METEOR_GOD`) | true_special_stone | [theory_incarnation_01](../data/cpu-lv11/card-browser-v3/theory_incarnation_01-black.json.gz) |
| 躍動石 (`HYPERACTIVE`) | true_special_stone | [hyperactive_01](../data/cpu-lv11/card-browser-v3/hyperactive_01-black.json.gz) |
| 極悪躍動魔 (`EXTREME_HYPERACTIVE`) | true_special_stone | [extreme_hyperactive_01](../data/cpu-lv11/card-browser-v3/extreme_hyperactive_01-black.json.gz) |
| 逃亡石 (`ESCAPE_HYPERACTIVE`) | true_special_stone | [escape_01](../data/cpu-lv11/card-browser-v3/escape_01-black.json.gz) |
| ロボット掃除機石 (`ROBOT_VACUUM`) | true_special_stone | [robot_vacuum_01](../data/cpu-lv11/card-browser-v3/robot_vacuum_01-black.json.gz) |
| 悪食石 (`GLUTTONOUS`) | true_special_stone | [gluttonous_will_01](../data/cpu-lv11/card-browser-v3/gluttonous_will_01-black.json.gz) |
| 究極躍動神 (`ULTIMATE_HYPERACTIVE`) | true_special_stone | [ultimate_hyperactive_01](../data/cpu-lv11/card-browser-v3/ultimate_hyperactive_01-black.json.gz) |
| 復活石 (`REGEN`) | true_special_stone | [regen_01](../data/cpu-lv11/card-browser-v3/regen_01-black.json.gz) |
| 屍石 (`ZOMBIE`) | true_special_stone | [zombie_will_01](../data/cpu-lv11/card-browser-v3/zombie_will_01-black.json.gz) |
| 生きる意志 (`LIVING_WILL`) | stone_status | [living_will_01](../data/cpu-lv11/card-browser-v3/living_will_01-black.json.gz) |
| 金石 (`GOLD`) | placement_effect | [gold_stone](../data/cpu-lv11/card-browser-v3/gold_stone-black.json.gz) |
| 虹石 (`RAINBOW`) | placement_effect | [rainbow_stone](../data/cpu-lv11/card-browser-v3/rainbow_stone-black.json.gz) |
| 銀石 (`SILVER`) | placement_effect | [silver_stone](../data/cpu-lv11/card-browser-v3/silver_stone-black.json.gz) |
| 労働石 (`WORK`) | true_special_stone | [chest_01](../data/cpu-lv11/card-browser-v3/chest_01-black.json.gz) |
| 究極労働神 (`ULTIMATE_WORK_GOD`) | true_special_stone | [ultimate_work_god_01](../data/cpu-lv11/card-browser-v3/ultimate_work_god_01-black.json.gz) |
| 時限爆弾 (`TIME_BOMB`) | bomb | [bomb_01](../data/cpu-lv11/card-browser-v3/bomb_01-black.json.gz) |
| 時間停石 (`TIME_STOP`) | true_special_stone | [time_stop_god_01](../data/cpu-lv11/card-browser-v3/time_stop_god_01-black.json.gz) |
| 時間停神 (`TIME_STOP_DEITY`) | true_special_stone | [time_stop_deity_01](../data/cpu-lv11/card-browser-v3/time_stop_deity_01-black.json.gz) |
| 十字爆弾 (`CROSS_BOMB`) | placement_effect | [cross_bomb_01](../data/cpu-lv11/card-browser-v3/cross_bomb_01-black.json.gz) |
| クロス爆弾 (`X_BOMB`) | placement_effect | [x_bomb_01](../data/cpu-lv11/card-browser-v3/x_bomb_01-black.json.gz) |
| 守る石 (`GUARD`) | stone_status | [guard_01](../data/cpu-lv11/card-browser-v3/guard_01-black.json.gz) |
| 救済神 (`STONE_SALVATION_GOD`) | true_special_stone | [stone_salvation_god_01](../data/cpu-lv11/card-browser-v3/stone_salvation_god_01-black.json.gz) |
| 罠石 (`TRAP`) | trap | [trap_01](../data/cpu-lv11/card-browser-v3/trap_01-black.json.gz) |
| 凍結マス (`FREEZE`) | board_marker | [mass_freeze_will_01](../data/cpu-lv11/card-browser-v3/mass_freeze_will_01-black.json.gz) |
| 封鎖マス (`BLOCKADE`) | board_marker | [blockade_01](../data/cpu-lv11/card-browser-v3/blockade_01-black.json.gz) |
| 種マス (`SEED`) | board_marker | [seed_01](../data/cpu-lv11/card-browser-v3/seed_01-black.json.gz) |
| 毒マス (`POISON_CELL`) | board_marker | [poison_will_01](../data/cpu-lv11/card-browser-v3/poison_will_01-black.json.gz) |
| 毒状態 (`POISONED`) | stone_status | [poison_will_01](../data/cpu-lv11/card-browser-v3/poison_will_01-black.json.gz) |
| 灼熱マス (`SCORCHED_CELL`) | board_marker | [fire_will_01](../data/cpu-lv11/card-browser-v3/fire_will_01-black.json.gz) |
| 治癒マス (`HEALING_CELL`) | board_marker | [water_will_01](../data/cpu-lv11/card-browser-v3/water_will_01-black.json.gz) |
| 灼熱状態 (`SCORCHED`) | stone_status | [fire_will_01](../data/cpu-lv11/card-browser-v3/fire_will_01-black.json.gz) |
| 理論の化身 (`THEORY_INCARNATION`) | manifest_stone | [theory_incarnation_01](../data/cpu-lv11/card-browser-v3/theory_incarnation_01-black.json.gz) |
| 盤界の執行者 (`BOARD_EXECUTOR`) | manifest_stone | [board_executor_01](../data/cpu-lv11/card-browser-v3/board_executor_01-black.json.gz) |
| 盤理の観測者 (`OBSERVER_WILL`) | manifest_stone | [observer_will_01](../data/cpu-lv11/card-browser-v3/observer_will_01-black.json.gz) |
| 幽体石 (`GHOST`) | true_special_stone | [ghost_01](../data/cpu-lv11/card-browser-v3/ghost_01-black.json.gz) |
| 犠牲石 (`SACRIFICE`) | true_special_stone | [sacrifice_will_01](../data/cpu-lv11/card-browser-v3/sacrifice_will_01-black.json.gz) |
| 残像石 (`AFTERIMAGE_WILL`) | true_special_stone | [afterimage_will_01](../data/cpu-lv11/card-browser-v3/afterimage_will_01-black.json.gz) |
| 意志狩りの王 (`WILL_HUNTER_KING`) | true_special_stone | [will_hunter_king_01](../data/cpu-lv11/card-browser-v3/will_hunter_king_01-black.json.gz) |
| 流星穴 (`METEOR_HOLE`) | board_marker | [cell_teleport_01](../data/cpu-lv11/card-browser-v3/cell_teleport_01-black.json.gz) |

## 終了・追加行動・拒否の回帰

- `test/selfplay.production-match.test.ts`: 盤が埋まっただけでは終了せず、正本の2連続パスでのみ終局する。違法配置は拒否した操作のまま記録し、別操作へ置き換えない。
- `test/game.last-resort.test.ts`: 石数負け/合法手0/空きマス条件、残り2マスの場合の配置終了。最後の切り札の黒白traceも、使用して3回配置した後のターン進行を照合した。
- 二〜無限投石、時間停石、時間停神、運命の意志のtraceで、追加配置・追加ターン・手番の操作権を含む全状態が一致。`ProductionMatch.controller`が公開された操作権を読み、該当CPUの通常ターン判断と記憶を選ぶ。
- `test/game.shinra-bansho-god.test.ts`: 自動融合、4マス占有、不可侵、移動/破壊/穴化拒否。融合黒白traceでも4属性効果と後続のターン境界を照合した。
- 全カード・特殊石の代表局面を通った結果であり、あらゆるカード順序/盤面/相互作用を尽くした証明ではない。新しい不一致が出た場合はその局面を保存し回帰へ追加する。
