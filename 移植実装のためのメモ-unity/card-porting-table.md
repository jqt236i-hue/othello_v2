# Unity 移植 Card Porting Table

この表は `cards/catalog.json` から移植対象カードを追跡するための一覧です。カード名、type、cost、enabled、表示分類は `cards/catalog.json` を正本にする。

## 状態の定義

| 状態 | 意味 |
| --- | --- |
| 未着手 | Unity 実装前 |
| ロジック中 | GameCore 実装中 |
| ロジック完了 | GameCore の結果が JS 版と一致 |
| 演出完了 | PresentationEvent / UnityPresentation 対応済み |
| 検証完了 | `test-scenarios.md` と parity checklist で確認済み |
| 保留 | 仕様確認または実装判断待ち |

## 分類の読み方

- `対象選択`: `pending-selection-registry.ts` に登録されている。
- `特殊見た目キー`: `game/visual-effects-map.runtime.js` の `PENDING_TYPE_TO_EFFECT_KEY` に対応がある。
- `通常候補`: `enabled:false` ではないため、デフォルトデッキ抽選候補に入る。
- `連続定義`: `enabled:false` だが、二連鎖/二連投石などから到達する定義として実装対象に残す。

## 全カード表

| name_ja | type | cost | catalog | display_type | 対象選択 | 特殊見た目キー | 移植扱い | 状態 |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| 宝箱 | `TREASURE_BOX` | 0 | enabled | 採掘 |  |  | 通常候補 | 未着手 |
| 自由の意志 | `FREE_PLACEMENT` | 14 | enabled | 禁忌 |  |  | 通常候補 | 未着手 |
| 最後の切り札 | `LAST_RESORT` | 9 | enabled | 禁忌 |  |  | 通常候補 | 未着手 |
| 狙撃の意志 | `SNIPER_WILL` | 23 | enabled | 戦闘 |  | sniperStone | 通常候補 | 未着手 |
| 弱い意志 | `PROTECTED_NEXT_STONE` | 1 | enabled | 守護 |  | protectedStoneTemporary | 通常候補 | 未着手 |
| 幽霊の意志 | `GHOST_WILL` | 5 | enabled | 守護 |  | ghostStone | 通常候補 | 未着手 |
| 残像の意志 | `AFTERIMAGE_WILL` | 8 | enabled | 守護 |  | afterimageStone | 通常候補 | 未着手 |
| 交換の意志 | `SWAP_WITH_ENEMY` | 17 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 入替の意志 | `POSITION_SWAP_WILL` | 13 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 強い意志 | `PERMA_PROTECT_NEXT_STONE` | 15 | enabled | 守護 |  | protectedStone | 通常候補 | 未着手 |
| 強風の意志 | `STRONG_WIND_WILL` | 9 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 超浮力 | `SUPER_BUOYANCY_WILL` | 31 | enabled | 殲滅 | yes |  | 通常候補 | 未着手 |
| 浮力 | `BUOYANCY_WILL` | 9 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 超重力 | `SUPER_GRAVITY_WILL` | 31 | enabled | 殲滅 | yes |  | 通常候補 | 未着手 |
| 超引力 | `SUPER_ATTRACTION_WILL` | 40 | enabled | 殲滅 | yes |  | 通常候補 | 未着手 |
| 重力 | `GRAVITY_WILL` | 9 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 罠の意志 | `TRAP_WILL` | 4 | enabled | 特殊 | yes | trapStone | 通常候補 | 未着手 |
| 誘惑の意志 | `TEMPT_WILL` | 23 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 捕獲の意志 | `CAPTURE_WILL` | 20 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 二連鎖の意志 | `DOUBLE_CHAIN_WILL` | 22 | enabled | 禁忌 |  |  | 通常候補 | 未着手 |
| 三連鎖の意志 | `TRIPLE_CHAIN_WILL` | 22 | enabled:false | 禁忌 |  |  | 連続定義 | 未着手 |
| 四連鎖の意志 | `QUAD_CHAIN_WILL` | 22 | enabled:false | 禁忌 |  |  | 連続定義 | 未着手 |
| 無限連鎖の意志 | `INFINITE_CHAIN_WILL` | 50 | enabled:false | 禁忌 |  |  | 連続定義 | 未着手 |
| 禁忌の反転 | `TABOO_REVERSE_WILL` | 44 | enabled | 禁忌 |  |  | 通常候補 | 未着手 |
| 復活の意志 | `REGEN_WILL` | 12 | enabled | 守護 |  | regenStone | 通常候補 | 未着手 |
| 破壊の意志 | `DESTROY_ONE_STONE` | 19 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 時限爆弾 | `TIME_BOMB` | 13 | enabled | 殲滅 | yes | timeBombStone | 通常候補 | 未着手 |
| 時間停石 | `TIME_STOP_GOD` | 0 | enabled | 禁忌 |  | timeStopStone | 通常候補 | 未着手 |
| 究極反転龍 | `ULTIMATE_REVERSE_DRAGON` | 30 | enabled | 戦闘 |  | ultimateDragon | 通常候補 | 未着手 |
| 繁殖の意志 | `BREEDING_WILL` | 16 | enabled | 守護 |  | breedingStone | 通常候補 | 未着手 |
| 増殖の意志 | `PROLIFERATION_WILL` | 4 | enabled | 繁栄 |  | proliferationStone | 通常候補 | 未着手 |
| 複製の意志 | `CLONE_WILL` | 16 | enabled | 繁栄 | yes |  | 通常候補 | 未着手 |
| 種まきの意志 | `SEED_WILL` | 7 | enabled | 繁栄 | yes |  | 通常候補 | 未着手 |
| テレポート | `TELEPORT_WILL` | 10 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| マステレポート | `CELL_TELEPORT_WILL` | 18 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 十字爆弾 | `CROSS_BOMB` | 18 | enabled | 殲滅 |  | crossBombStone | 通常候補 | 未着手 |
| クロス爆弾 | `X_BOMB` | 18 | enabled | 殲滅 |  | xBombStone | 通常候補 | 未着手 |
| 多動の意志 | `HYPERACTIVE_WILL` | 8 | enabled | 戦闘 |  | hyperactiveStone | 通常候補 | 未着手 |
| 多動の継承 | `HYPERACTIVE_INHERIT_WILL` | 11 | enabled | 特殊 | yes | hyperactiveStone | 通常候補 | 未着手 |
| 極悪多動魔 | `EXTREME_HYPERACTIVE_WILL` | 35 | enabled | 戦闘 |  | extremeHyperactiveStone | 通常候補 | 未着手 |
| 逃げる意志 | `ESCAPE_WILL` | 7 | enabled | 殲滅 |  | escapeHyperactiveStone | 通常候補 | 未着手 |
| ロボット掃除機 | `ROBOT_VACUUM_WILL` | 17 | enabled | 戦闘 |  | robotVacuumStone | 通常候補 | 未着手 |
| 悪食の意志 | `GLUTTONOUS_WILL` | 29 | enabled | 戦闘 |  | gluttonousStone | 通常候補 | 未着手 |
| 意志狩りの王 | `WILL_HUNTER_KING` | 33 | enabled | 戦闘 |  | willHunterKingStone | 通常候補 | 未着手 |
| 瞬間多動 | `INSTANT_HYPERACTIVE_WILL` | 2 | enabled | 戦闘 |  | hyperactiveStone | 通常候補 | 未着手 |
| 再構築の意志 | `REBUILD_WILL` | 0 | enabled | 観測 |  |  | 通常候補 | 未着手 |
| 補給の意志 | `SUPPLY_WILL` | 1 | enabled | 観測 |  |  | 通常候補 | 未着手 |
| 吸収の意志 | `PLUNDER_WILL` | 4 | enabled | 採掘 |  |  | 通常候補 | 未着手 |
| 角の代償 | `CORNER_TRIBUTE` | 0 | enabled | 採掘 |  |  | 通常候補 | 未着手 |
| 出稼ぎの意志 | `WORK_WILL` | 11 | enabled | 採掘 |  | workStone | 通常候補 | 未着手 |
| リボ払いの意志 | `RIBO_WILL` | 0 | enabled | 採掘 |  |  | 通常候補 | 未着手 |
| 意志の喪失 | `LOSS_WILL` | 15 | enabled | 執行 |  |  | 通常候補 | 未着手 |
| 二連投石 | `DOUBLE_PLACE` | 24 | enabled | 禁忌 |  |  | 通常候補 | 未着手 |
| 三連投石 | `TRIPLE_PLACE` | 24 | enabled:false | 禁忌 |  |  | 連続定義 | 未着手 |
| 四連投石 | `QUAD_PLACE` | 24 | enabled:false | 禁忌 |  |  | 連続定義 | 未着手 |
| 無限投石 | `INFINITE_PLACE` | 50 | enabled:false | 禁忌 |  |  | 連続定義 | 未着手 |
| 天の恵み | `HEAVEN_BLESSING` | 3 | enabled | 観測 | yes |  | 通常候補 | 未着手 |
| 観測の意志 | `REVEAL_HAND_WILL` | 2 | enabled | 観測 |  |  | 通常候補 | 未着手 |
| 断罪の意志 | `CONDEMN_WILL` | 8 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 執行の意志 | `EXECUTION_WILL` | 2 | enabled | 執行 |  |  | 通常候補 | 未着手 |
| 金の意志 | `GOLD_STONE` | 6 | enabled | 採掘 |  | goldStone | 通常候補 | 未着手 |
| 虹の意志 | `RAINBOW_STONE` | 10 | enabled | 採掘 |  | rainbowStone | 通常候補 | 未着手 |
| 銀の意志 | `SILVER_STONE` | 3 | enabled | 採掘 |  | silverStone | 通常候補 | 未着手 |
| 演算の意志 | `CRYSTAL_STONE` | 6 | enabled | 採掘 |  |  | 通常候補 | 未着手 |
| 理論の化身 | `THEORY_INCARNATION` | 25 | enabled | 特殊石 |  | theoryIncarnationStone | 通常候補 | 未着手 |
| 延命の意志 | `EXTEND_LIFE_WILL` | 4 | enabled | 守護 | yes |  | 通常候補 | 未着手 |
| 延命神 | `EXTEND_LIFE_GOD` | 10 | enabled | 守護 | yes |  | 通常候補 | 未着手 |
| 腐食の意志 | `CORROSION_WILL` | 2 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 守る意志 | `GUARD_WILL` | 2 | enabled | 守護 | yes |  | 通常候補 | 未着手 |
| 守護神 | `GUARDIAN_GOD` | 10 | enabled | 守護 | yes |  | 通常候補 | 未着手 |
| 救済神 | `STONE_SALVATION_GOD` | 25 | enabled | 繁栄 |  | stoneSalvationGod | 通常候補 | 未着手 |
| 破壊龍 | `DESTROY_DRAGON_WILL` | 7 | enabled | 戦闘 |  | destroyDragonStone | 通常候補 | 未着手 |
| 落雷 | `LIGHTNING_WILL` | 26 | enabled | 戦闘 |  | lightningStone | 通常候補 | 未着手 |
| 究極破壊神 | `ULTIMATE_DESTROY_GOD` | 25 | enabled | 戦闘 |  | ultimateDestroyGod | 通常候補 | 未着手 |
| 究極多動神 | `ULTIMATE_HYPERACTIVE_GOD` | 28 | enabled | 戦闘 |  | ultimateHyperactiveGod | 通常候補 | 未着手 |
| 盤面拡張 | `BOARD_EXPANSION_WILL` | 19 | enabled | 禁忌 | yes |  | 通常候補 | 未着手 |
| 盤面拡張神 | `BOARD_EXPANSION_GOD` | 27 | enabled | 禁忌 | yes |  | 通常候補 | 未着手 |
| 盤面縮小 | `BOARD_SHRINK_WILL` | 19 | enabled | 禁忌 | yes |  | 通常候補 | 未着手 |
| 盤面縮小神 | `BOARD_SHRINK_GOD` | 27 | enabled | 禁忌 | yes |  | 通常候補 | 未着手 |
| 封鎖の意志 | `BLOCKADE_WILL` | 1 | enabled | 特殊 | yes |  | 通常候補 | 未着手 |
| 隕石 | `METEOR_WILL` | 21 | enabled | 執行 | yes |  | 通常候補 | 未着手 |
| 凍結の意志 | `FREEZE_WILL` | 5 | enabled | 特殊 | yes |  | 通常候補 | 未着手 |
| 盤理の観測者 | `OBSERVER_WILL` | 1 | enabled | 採掘 |  | observerStone | 通常候補 | 未着手 |
| 救済の意志 | `SALVATION_WILL` | 17 | enabled | 繁栄 |  |  | 通常候補 | 未着手 |
| 生きる意志 | `LIVING_WILL` | 20 | enabled | 繁栄 | yes |  | 通常候補 | 未着手 |
| 増援の意志 | `REINFORCEMENT_WILL` | 6 | enabled | 繁栄 |  |  | 通常候補 | 未着手 |
| 平等の意志 | `EQUALITY_WILL` | 15 | enabled | 繁栄 |  |  | 通常候補 | 未着手 |
| 運命の意志 | `FATE_WILL` | 50 | enabled | 禁忌 |  |  | 通常候補 | 未着手 |
