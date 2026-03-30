# Teacher CPU / Lv6 カード使用4区分メモ

最終更新: 2026-03-24  
対象: 学習用教師CPU / ブラウザ対戦用白`Lv6`  
位置づけ: 現時点で teacher CPU と browser-playable `Lv6` を同じ共有カード方針にそろえるためのメモ  
一次情報: `01-rulebook.md`, `cards/catalog.json`, `game/ai/cpu-policy-core.js`  
非目標: 各カードの座標評価や pending 対象選択ロジックをここで重複定義しない

## 前提

- 対象は `cards/catalog.json` の有効カード 79 種。
- card use / hand destroy の共有コアは `game/ai/cpu-policy-core.js`。
- Browser `Lv6` と selfplay teacher は、この共有コアを通して同じカード破棄ルールを使う。
- 区分4だけは従来どおり、局面ヒューリスティックと共有カード方針で評価する。

## 区分1: 使わない。手札に来たら即破壊

- 時間停石 (`TIME_STOP_GOD`)
- マステレポート (`CELL_TELEPORT_WILL`)
- 凍結の意志 (`FREEZE_WILL`)

## 区分2: 自分の布石が 50 以下の間は使わず即破壊

- 多動の継承 (`HYPERACTIVE_INHERIT_WILL`)
- 逃げる意志 (`ESCAPE_WILL`)
- 盤面拡張神 (`BOARD_EXPANSION_GOD`)
- 補給の意志 (`SUPPLY_WILL`)

## 区分3: 現在の使用条件を満たしていない間は即破壊

- 最後の切り札 (`LAST_RESORT`)
- リボ払いの意志 (`RIBO_WILL`)
- 平等の意志 (`EQUALITY_WILL`)
- 腐食の意志 (`CORROSION_WILL`)

## 区分4: 上記以外

- 宝箱 (`TREASURE_BOX`)
- 自由の意志 (`FREE_PLACEMENT`)
- 狙撃の意志 (`SNIPER_WILL`)
- 弱い意志 (`PROTECTED_NEXT_STONE`)
- 幽霊の意志 (`GHOST_WILL`)
- 残像の意志 (`AFTERIMAGE_WILL`)
- 交換の意志 (`SWAP_WITH_ENEMY`)
- 入替の意志 (`POSITION_SWAP_WILL`)
- 強い意志 (`PERMA_PROTECT_NEXT_STONE`)
- 強風の意志 (`STRONG_WIND_WILL`)
- 超浮力 (`SUPER_BUOYANCY_WILL`)
- 超重力 (`SUPER_GRAVITY_WILL`)
- 罠の意志 (`TRAP_WILL`)
- 誘惑の意志 (`TEMPT_WILL`)
- 二連鎖の意志 (`DOUBLE_CHAIN_WILL`)
- 禁忌の反転 (`TABOO_REVERSE_WILL`)
- 復活の意志 (`REGEN_WILL`)
- 破壊神 (`DESTROY_ONE_STONE`)
- 時限爆弾 (`TIME_BOMB`)
- 究極反転龍 (`ULTIMATE_REVERSE_DRAGON`)
- 繁殖の意志 (`BREEDING_WILL`)
- 増殖の意志 (`PROLIFERATION_WILL`)
- 複製の意志 (`CLONE_WILL`)
- 分裂の意志 (`SPLIT_WILL`)
- テレポート (`TELEPORT_WILL`)
- 十字爆弾 (`CROSS_BOMB`)
- クロス爆弾 (`X_BOMB`)
- 多動の意志 (`HYPERACTIVE_WILL`)
- 極悪多動魔 (`EXTREME_HYPERACTIVE_WILL`)
- ロボット掃除機 (`ROBOT_VACUUM_WILL`)
- 悪食の意志 (`GLUTTONOUS_WILL`)
- 意志狩りの王 (`WILL_HUNTER_KING`)
- 瞬間多動 (`INSTANT_HYPERACTIVE_WILL`)
- 売却の意志 (`SELL_CARD_WILL`)
- 吸収の意志 (`PLUNDER_WILL`)
- 角の代償 (`CORNER_TRIBUTE`)
- 出稼ぎの意志 (`WORK_WILL`)
- 意志の喪失 (`LOSS_WILL`)
- 二連投石 (`DOUBLE_PLACE`)
- 天の恵み (`HEAVEN_BLESSING`)
- 断罪の意志 (`CONDEMN_WILL`)
- 金の意志 (`GOLD_STONE`)
- 虹の意志 (`RAINBOW_STONE`)
- 銀の意志 (`SILVER_STONE`)
- 水晶の意志 (`CRYSTAL_STONE`)
- 延命の意志 (`EXTEND_LIFE_WILL`)
- 延命神 (`EXTEND_LIFE_GOD`)
- 守る意志 (`GUARD_WILL`)
- 守護神 (`GUARDIAN_GOD`)
- 破壊龍 (`DESTROY_DRAGON_WILL`)
- 落雷 (`LIGHTNING_WILL`)
- 究極破壊神 (`ULTIMATE_DESTROY_GOD`)
- 究極多動神 (`ULTIMATE_HYPERACTIVE_GOD`)
- 盤面拡張 (`BOARD_EXPANSION_WILL`)
- 封鎖の意志 (`BLOCKADE_WILL`)
- 隕石 (`METEOR_WILL`)
- 盤理の観測者 (`OBSERVER_WILL`)
- 再構築の意志 (`REBUILD_WILL`)
- 観測の意志 (`REVEAL_HAND_WILL`)
- 救済の意志 (`SALVATION_WILL`)
- 運命の意志 (`FATE_WILL`)
- 捕獲の意志 (`CAPTURE_WILL`)
- 三連鎖の意志 (`TRIPLE_CHAIN_WILL`)
- 四連鎖の意志 (`QUAD_CHAIN_WILL`)
- 無限連鎖の意志 (`INFINITE_CHAIN_WILL`)
- 三連投石 (`TRIPLE_PLACE`)
- 四連投石 (`QUAD_PLACE`)
- 無限投石 (`INFINITE_PLACE`)

## 補足ルール

- `LOSS_WILL` は区分4に残すが、自分の特殊石が 1 つでも盤面にある間は使用しない。
- 区分3の「現在の使用条件」は、そのターンの `usableCardIds` 判定を基準にする。
- 追加のカード見直しが必要になったら、このファイルと `01-rulebook.md` を同時に更新する。
