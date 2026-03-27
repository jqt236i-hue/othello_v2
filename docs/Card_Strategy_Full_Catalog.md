# Card Strategy Full Catalog（実装根拠版）

作成方針: `cards/catalog.json` を基準に、`cards/card-interaction.js` / `cards/card-interaction-effects.js`、`game/logic/cards.js`、`game/card-effects/**`、`game/turn/turn_pipeline_phases.js` / `game/turn/turn_pipeline_phase_helpers.js`、`game/ai/cpu-policy-core.js`、`01-rulebook.md` の順で照合。推測は記載せず、不確定は「未確認」と明示。

## 1. 概要
- 有効カード総数: **39**（`cards/catalog.json`）
- 分類（主分類）※運用カテゴリ。件数は `5.1` 更新時に再集計する。
  - 攻撃: 破壊・爆破・直接除去系
  - 防御: 保護・延命・封鎖系
  - 経済: 布石増減・手札更新系
  - 展開: 配置自由化・移動・盤面拡張系
  - 妨害: 罠・誘惑・手札破壊系

## 2. 全カード一覧（表）
| cardId | 表示名 | type | cost | 効果要約（実装ベース） | 発動条件 | 対象選択有無 | 失敗条件（不発/無効） | 期待リターン | 主なリスク（利敵条件） | 推奨フェーズ | 根拠（path:line） |
|---|---|---|---:|---|---|---|---|---|---|---|---|
| chest_01 | 宝箱 | TREASURE_BOX | 0 | 即時 +1〜+3 布石 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 主な不発なし（コスト不足/使用済み制限のみ） | 即時 +1〜+3 布石 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:6<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>shared-constants.js:105 |
| free_01 | 自由の意志 | FREE_PLACEMENT | 14 | 反転0でも配置可能化（直接布石増加なし） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | コスト不足/使用済み | 反転0でも配置可能化（直接布石増加なし） | 高分散札（優勢時はCPU減点） | 中盤〜終盤（合法手が少ない局面） | cards/catalog.json:13<br>game/logic/cards.js:2175<br>shared-constants.js:56 |
| sniper_01 | 狙撃の意志 | SNIPER_WILL | 23 | 毎ターン開始で最寄り敵1破壊（5ターン） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | コスト不足/使用済み | 毎ターン開始で最寄り敵1破壊（5ターン） | 高分散札（優勢時はCPU減点） | 中盤（角/辺に置ける局面） | cards/catalog.json:20<br>game/logic/cards.js:2175<br>game/logic/cards.js:2378 |
| hard_01 | 弱い意志 | PROTECTED_NEXT_STONE | 1 | 次配置石の短期保護 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | コスト不足/使用済み | 次配置石の短期保護 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:27<br>game/logic/cards.js:2275<br>shared-constants.js:57 |
| swap_01 | 交換の意志 | SWAP_WITH_ENEMY | 17 | 交換1枚 + 交換起点反転枚数ぶん布石 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 相手の通常石（特殊石/爆弾以外）が必要 | あり | 対象が通常石でない・対象不足 | 交換1枚 + 交換起点反転枚数ぶん布石 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:34<br>game/logic/cards.js:992<br>game/logic/cards.js:1207 |
| position_swap_01 | 入替の意志 | POSITION_SWAP_WILL | 13 | 位置入替のみ（直接布石増減なし） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 盤面に石が2個以上必要 | あり | 同一マス選択・空マス選択・対象不足 | 位置入替のみ（直接布石増減なし） | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:41<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| perma_01 | 強い意志 | PERMA_PROTECT_NEXT_STONE | 15 | 次配置石の永続反転耐性 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | コスト不足/使用済み | 次配置石の永続反転耐性 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:55<br>game/logic/cards.js:2293<br>shared-constants.js:102 |
| strong_wind_01 | 強風の意志 | STRONG_WIND_WILL | 9 | 最長方向へ石を移動（同距離ランダム） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 上下左右いずれかへ移動可能な石が必要 | あり | 移動可能対象なし・対象不正 | 最長方向へ石を移動（同距離ランダム） | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:62<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| trap_01 | 罠の意志 | TRAP_WILL | 4 | 自分石1つを罠化してターン終了。発動時: 相手布石最大20奪取 + 相手手札全破壊 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 自分石の有効対象が1個以上必要 | あり | 対象不足・次相手ターンで未発動のまま消滅・このターンの配置価値が高い | 自分石1つを罠化してターン終了。発動時: 相手布石最大20奪取 + 相手手札全破壊 | 条件未充足で使用不可/低効率 | 中盤劣勢〜拮抗 | cards/catalog.json:69<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| tempt_01 | 誘惑の意志 | TEMPT_WILL | 20 | 相手特殊石の所有権奪取 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 相手特殊石（GUARD以外）が1個以上必要 | あり | 対象が相手特殊石でない/対象不足/GUARD保護 | 相手特殊石の所有権奪取 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:76<br>game/logic/cards.js:942<br>game/logic/cards.js:1114 |
| double_chain_01 | 二連鎖の意志 | DOUBLE_CHAIN_WILL | 22 | 通常反転後に追加反転1回 + 三連鎖生成 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 一次反転を起点に候補が無い場合は追加連鎖なし | 追加反転1回 + 使用後に三連鎖の意志が手札追加 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json<br>game/logic/cards.js |
| triple_chain_01 | 三連鎖の意志 | TRIPLE_CHAIN_WILL | 22 | 通常反転後に追加反転2回 + 四連鎖生成 | generated-only（使用後生成で入手） | なし | 一次反転起点から候補が不足すると途中終了 | 追加反転2回 + 使用後に四連鎖の意志が手札追加 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json<br>game/logic/cards.js |
| quad_chain_01 | 四連鎖の意志 | QUAD_CHAIN_WILL | 22 | 通常反転後に追加反転3回 + 無限連鎖生成 | generated-only（使用後生成で入手） | なし | 一次反転起点から候補が不足すると途中終了 | 追加反転3回 + 使用後に無限連鎖の意志が手札追加 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json<br>game/logic/cards.js |
| infinite_chain_01 | 無限連鎖の意志 | INFINITE_CHAIN_WILL | 50 | 通常反転後に追加反転を可能な限り継続 | generated-only（使用後生成で入手） | なし | 追加反転できなくなった時点で終了 | 追加反転を可能な限り継続 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json<br>game/logic/cards.js |
| regen_01 | 復活の意志 | REGEN_WILL | 12 | 1回だけ再生 + 再生起点反転 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 反転されないままなら再生効果未発動 | 1回だけ再生 + 再生起点反転 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:90<br>game/logic/cards.js:2308<br>shared-constants.js:136 |
| destroy_01 | 破壊神 | DESTROY_ONE_STONE | 14 | 任意1石破壊 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + GUARDで守られていない石が1個以上必要 | あり | GUARD保護対象は破壊失敗 | 任意1石破壊 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:97<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| bomb_01 | 時限爆弾 | TIME_BOMB | 13 | 3ターン後に3x3破壊 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 自分石の有効対象が1個以上必要 | あり | 対象不足・既存爆弾重複不可・反転で解除 | 3ターン後に3x3破壊 | 高分散札（優勢時はCPU減点） | 中盤〜終盤劣勢 | cards/catalog.json:104<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| udr_01 | 究極反転龍 | ULTIMATE_REVERSE_DRAGON | 30 | 自由配置で配置時/ターン開始に周囲8反転（5ターン） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | アンカー喪失で終了 | 自由配置で配置時/ターン開始に周囲8反転（5ターン） | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:111<br>game/logic/cards.js:2341<br>shared-constants.js:144 |
| breeding_01 | 繁殖の意志 | BREEDING_WILL | 16 | 配置時/ターン開始に生成拡散（5ターン） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 周囲空きなし時は生成なし・アンカー喪失で終了 | 配置時/ターン開始に生成拡散（5ターン） | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:118<br>game/logic/cards.js:2359<br>shared-constants.js:147 |
| clone_01 | 複製の意志 | CLONE_WILL | 16 | 隣接1マスへ同種石を1つ複製 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 周囲に空きがある自分石が1個以上必要 | あり | 周囲空きなし/対象不正で失敗 | 隣接1マスへ同種石を1つ複製 | 高分散札（優勢時はCPU減点） | 中盤（優勢維持局面） | cards/catalog.json:125<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| cross_bomb_01 | 十字爆弾 | CROSS_BOMB | 18 | 配置直後に十字範囲爆破 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 中心/十字範囲に石が無い場合は破壊効果が薄い | 配置直後に十字範囲爆破 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:132<br>game/logic/cards.js:2457<br>game/logic/cards.js:2460 |
| x_bomb_01 | クロス爆弾 | X_BOMB | 18 | 配置直後にX範囲爆破 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 中心/X範囲に石が無い場合は破壊効果が薄い | 配置直後にX範囲爆破 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:139<br>game/logic/cards.js:2457<br>game/logic/cards.js:2482 |
| hyperactive_01 | 多動の意志 | HYPERACTIVE_WILL | 8 | ターン開始移動 + 反転機会 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 移動先なしで消滅 | ターン開始移動 + 反転機会 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:146<br>game/logic/cards.js:2387<br>shared-constants.js:153 |
| escape_01 | 逃げる意志 | ESCAPE_WILL | 12 | ターン開始移動 + 反転機会 + 移動不能時爆破 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 移動先なしで周囲爆破後に消滅 | ターン開始移動 + 反転機会 + 移動不能時爆破 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:153<br>game/logic/cards.js:2397<br>shared-constants.js:156 |
| robot_vacuum_01 | ロボット掃除機 | ROBOT_VACUUM_WILL | 17 | 敵へ接近移動後に敵1吸引破壊、吸引成功で寿命+1 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 移動先なしで消滅、GUARD対象は吸引不可 | 敵へ接近移動後に敵1吸引破壊、吸引成功で寿命+1 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:160<br>game/logic/cards.js:2408<br>shared-constants.js:159 |
| instant_hyperactive_01 | 瞬間多動 | INSTANT_HYPERACTIVE_WILL | 5 | 配置直後3回移動後に消滅 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 3回移動後に必ず消滅 | 配置直後3回移動後に消滅 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:167<br>game/logic/cards.js:2420<br>shared-constants.js:162 |
| sell_01 | 売却の意志 | SELL_CARD_WILL | 8 | 売却カードのcost分を即時獲得 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 使用後に売却用の自分手札が最低1枚必要（手札>1） | あり | 売却対象未選択/手札不足 | 売却カードのcost分を即時獲得 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:174<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| rebuild_01 | 再構築の意志 | REBUILD_WILL | 0 | 手札を全破壊して即時2ドロー | 手札所持・このターン未使用（`applyCardUsage`） | なし | 山札不足時は2枚未満ドローで終了 | 手札品質の再抽選（即時2枚補充） | 高優先カードを手放すと利敵 | 中盤（手札詰まり解消） | cards/catalog.json:181<br>game/turn/turn_pipeline_phases.js / game/turn/turn_pipeline_phase_helpers.js<br>shared-constants.js:169 |
| plunder_will | 吸収の意志 | PLUNDER_WILL | 4 | 反転枚数ぶん吸収（自 gain += plundered） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 相手布石が少ないと吸収量が伸びない | 反転枚数ぶん吸収（自 gain += plundered） | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:188<br>game/logic/cards.js:2216<br>shared-constants.js:168 |
| work_01 | 出稼ぎの意志 | WORK_WILL | 11 | 自ターン開始で 1→2→4→8→16（上限99） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | アンカー喪失または残りターン0で終了 | 自ターン開始で 1→2→4→8→16（上限99） | 条件未充足で使用不可/低効率 | 序盤〜中盤（角/辺に置ける時） | cards/catalog.json:195<br>game/logic/cards.js:1227<br>shared-constants.js:171 |
| double_01 | 二連投石 | DOUBLE_PLACE | 24 | そのターンのみ追加1手 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 2手目の合法手が無ければ追加配置できない | そのターンのみ追加1手 | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:202<br>game/logic/cards.js:2489<br>shared-constants.js:173 |
| heaven_01 | 天の恵み | HEAVEN_BLESSING | 3 | 候補5枚から1枚を手札獲得 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 候補生成に成功し、手札上限5未満 | あり | 候補なし/手札上限で受取不可 | 候補5枚から1枚を手札獲得 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:209<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| condemn_01 | 断罪の意志 | CONDEMN_WILL | 8 | 相手手札1枚破壊 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 相手手札が1枚以上必要 | あり | 対象index不正/target_mismatch | 相手手札1枚破壊 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:216<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| gold_stone | 金の意志 | GOLD_STONE | 6 | 反転布石×4、配置石は即時消滅 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 反転0〜1枚だと費用回収しにくい | 反転布石×4、配置石は即時消滅 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:223<br>game/logic/cards.js:2191<br>shared-constants.js:180 |
| silver_stone | 銀の意志 | SILVER_STONE | 3 | 反転布石×3、配置石は即時消滅 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 反転0〜1枚だと費用回収しにくい | 反転布石×3、配置石は即時消滅 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:230<br>game/logic/cards.js:2204<br>shared-constants.js:240 |
| extend_life_01 | 延命の意志 | EXTEND_LIFE_WILL | 4 | remainingOwnerTurns を2倍 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + remainingOwnerTurns>0 の自分特殊石が必要 | あり | 対象が特殊石でない/remainingOwnerTurns無効 | remainingOwnerTurns を2倍 | 条件未充足で使用不可/低効率 | 中盤〜終盤（寿命付き特殊石が残る局面） | cards/catalog.json:244<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| extend_life_god_01 | 延命神 | EXTEND_LIFE_GOD | 10 | remainingOwnerTurns を4倍 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + remainingOwnerTurns>0 の自分特殊石が必要 | あり | 対象が特殊石でない/remainingOwnerTurns無効 | remainingOwnerTurns を4倍 | 条件未充足で使用不可/低効率 | 中盤〜終盤（寿命付き特殊石を長く残したい局面） | cards/catalog.json<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| guard_01 | 守る意志 | GUARD_WILL | 2 | 3ターン完全保護（反転/交換/破壊/誘惑を遮断） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 自分石の有効対象が1個以上必要 | あり | 対象不足 | 3ターン完全保護（反転/交換/破壊/誘惑を遮断） | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:251<br>cards/card-interaction.js / cards/card-interaction-effects.js<br>cards/card-interaction.js / cards/card-interaction-effects.js |
| udg_01 | 究極破壊神 | ULTIMATE_DESTROY_GOD | 25 | 自由配置で配置時/ターン開始に周囲8破壊（5ターン） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | アンカー喪失で終了 | 自由配置で配置時/ターン開始に周囲8破壊（5ターン） | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:258<br>game/logic/cards.js:2369<br>game/logic/cards.js:2371 |
| ultimate_hyperactive_01 | 究極多動神 | ULTIMATE_HYPERACTIVE_GOD | 28 | 両者ターン開始に直線1〜5マス移動×2+反転（10ターン） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） | なし | 移動先なしで消滅、残り0で同色通常石化 | 両者ターン開始に直線1〜5マス移動×2+反転（10ターン） | 高分散札（優勢時はCPU減点） | 未確認（個別の明示ロジックなし） | cards/catalog.json:265<br>game/logic/cards.js:2432<br>game/logic/cards/hyperactive.js:105 |
| board_expand_01 | 盤面拡張 | BOARD_EXPANSION_WILL | 19 | 左右外側に1セル追加（各プレイヤー1回） | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 未使用かつ拡張未展開、左右端選択対象が存在 | あり | 使用済み/既に拡張中で使用不可 | 左右外側に1セル追加（各プレイヤー1回） | 高分散札（優勢時はCPU減点） | 終盤劣勢（cornerEmergency想定） | cards/catalog.json:272<br>game/logic/cards.js:971<br>game/logic/cards.js:1175 |
| blockade_01 | 封鎖の意志 | BLOCKADE_WILL | 1 | 空き1マスを3ターン封鎖 | 手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 空きかつ未封鎖マスが1個以上必要 | あり | 空きマス不足/対象不正 | 空き1マスを3ターン封鎖 | 条件未充足で使用不可/低効率 | 未確認（個別の明示ロジックなし） | cards/catalog.json:279<br>game/logic/cards.js:975<br>game/logic/cards.js:1016 |

## 3. カード別詳細（1カード1節）

### chest_01 / 宝箱（TREASURE_BOX）
- 効果詳細（処理順含む）: 即時 +1〜+3 布石
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「即時 +1〜+3 布石」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「主な不発なし（コスト不足/使用済み制限のみ）」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: +（即時+1〜+3）
- 根拠コード参照
  - cards/catalog.json:6
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - shared-constants.js:105
  - game/ai/cpu-policy-core.js:70
  - 01-rulebook.md:224
  - 01-rulebook.md:714

### free_01 / 自由の意志（FREE_PLACEMENT）
- 効果詳細（処理順含む）: 反転0でも配置可能化（直接布石増加なし）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「反転0でも配置可能化（直接布石増加なし）」を満たす見込みがある手で使う。
  - 推奨フェーズ「中盤〜終盤（合法手が少ない局面）」に寄せて使用する。
- 利敵行為になる使い方
  - 失敗条件「コスト不足/使用済み」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 良: 合法手<=1・角取り困難 / 悪: 角を直で取れる手が既にある盤面
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:13
  - game/logic/cards.js:2175
  - shared-constants.js:56
  - game/ai/cpu-policy-core.js:38
  - game/ai/cpu-policy-core.js:56
  - game/ai/cpu-policy-core.js:241
  - 01-rulebook.md:229

### sniper_01 / 狙撃の意志（SNIPER_WILL）
- 効果詳細（処理順含む）: 毎ターン開始で最寄り敵1破壊（5ターン）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「毎ターン開始で最寄り敵1破壊（5ターン）」を満たす見込みがある手で使う。
  - 推奨フェーズ「中盤（角/辺に置ける局面）」に寄せて使用する。
- 利敵行為になる使い方
  - 失敗条件「コスト不足/使用済み」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 良: 角/辺など生存しやすい配置点がある / 悪: 空きが少なく寿命を使い切れない盤面
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:20
  - game/logic/cards.js:2175
  - game/logic/cards.js:2378
  - game/logic/cards/sniper.js:149
  - shared-constants.js:111
  - game/ai/cpu-policy-core.js:20
  - game/ai/cpu-policy-core.js:39
  - game/ai/cpu-policy-core.js:66

### hard_01 / 弱い意志（PROTECTED_NEXT_STONE）
- 効果詳細（処理順含む）: 次配置石の短期保護
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「次配置石の短期保護」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「コスト不足/使用済み」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:27
  - game/logic/cards.js:2275
  - shared-constants.js:57
  - game/ai/cpu-policy-core.js:9
  - game/ai/cpu-policy-core.js:60
  - 01-rulebook.md:245
  - 01-rulebook.md:829

### swap_01 / 交換の意志（SWAP_WITH_ENEMY）
- 効果詳細（処理順含む）: 交換1枚 + 交換起点反転枚数ぶん布石
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 相手の通常石（特殊石/爆弾以外）が必要」を満たす局面で使う。
  - 期待リターン「交換1枚 + 交換起点反転枚数ぶん布石」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「対象が通常石でない・対象不足」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 特殊石/爆弾は交換対象外（通常石のみ）。
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:34
  - game/logic/cards.js:992
  - game/logic/cards.js:1207
  - game/logic/cards.js:3670
  - game/logic/cards.js:3733
  - game/card-effects/swap.js:22
  - game/logic/effects/swap_with_enemy.js:3
  - shared-constants.js:58

### position_swap_01 / 入替の意志（POSITION_SWAP_WILL）
- 効果詳細（処理順含む）: 位置入替のみ（直接布石増減なし）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 盤面に石が2個以上必要」を満たす局面で使う。
  - 期待リターン「位置入替のみ（直接布石増減なし）」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「同一マス選択・空マス選択・対象不足」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:41
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - game/logic/cards.js:962
  - game/logic/cards.js:996
  - game/logic/cards.js:1164
  - game/logic/cards.js:1170
  - game/card-effects/position-swap.js:22

### perma_01 / 強い意志（PERMA_PROTECT_NEXT_STONE）
- 効果詳細（処理順含む）: 次配置石の永続反転耐性
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「次配置石の永続反転耐性」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「コスト不足/使用済み」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:55
  - game/logic/cards.js:2293
  - shared-constants.js:102
  - game/ai/cpu-policy-core.js:10
  - game/ai/cpu-policy-core.js:61
  - 01-rulebook.md:261
  - 01-rulebook.md:829

### strong_wind_01 / 強風の意志（STRONG_WIND_WILL）
- 効果詳細（処理順含む）: 最長方向へ石を移動（同距離ランダム）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 上下左右いずれかへ移動可能な石が必要」を満たす局面で使う。
  - 期待リターン「盤面位置の調整」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「移動可能対象なし・対象不正」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接増加なし）
- 根拠コード参照
  - cards/catalog.json:62
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - game/logic/cards.js:984
  - game/logic/cards.js:1119
  - game/logic/cards.js:1202
  - game/logic/cards.js:1991
  - game/card-effects/strong-wind.js:46

### trap_01 / 罠の意志（TRAP_WILL）
- 効果詳細（処理順含む）: 自分石1つを罠化してターン終了。次の相手ターンに反転されると発動時: 相手布石最大20奪取 + 相手手札全破壊
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 自分石の有効対象が1個以上必要」を満たす局面で使う。
  - 自分の通常配置を手放してでも、相手に反転を強要できる接触点で使う。
  - 推奨フェーズ「中盤劣勢〜拮抗」に寄せて使用する。
- 利敵行為になる使い方
  - 失敗条件「対象不足・次相手ターンで未発動のまま消滅・このターンの配置価値が高い」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 良: 相手が反転を通しやすい接触点 / 悪: 次相手ターンで触られない孤立点
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:69
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - game/logic/cards.js:946
  - game/logic/cards.js:1000
  - game/logic/cards.js:1139
  - game/logic/cards.js:1209
  - game/card-effects/trap.js:121

### tempt_01 / 誘惑の意志（TEMPT_WILL）
- 効果詳細（処理順含む）: 相手特殊石の所有権奪取
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 相手特殊石（GUARD以外）が1個以上必要」を満たす局面で使う。
  - 期待リターン「相手特殊石の所有権奪取」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「対象が相手特殊石でない/対象不足/GUARD保護」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: GUARD石は誘惑対象から除外される。
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:76
  - game/logic/cards.js:942
  - game/logic/cards.js:1114
  - game/logic/cards.js:1210
  - game/logic/cards.js:1677
  - game/card-effects/tempt.js:22
  - shared-constants.js:224
  - game/ai/cpu-policy-core.js:29

### chain-will 系 / 連鎖系
- 対象カード: `double_chain_01` / `triple_chain_01` / `quad_chain_01` / `infinite_chain_01`
- 効果詳細（処理順含む）:
  - `DOUBLE_CHAIN_WILL`: 通常反転のあと追加反転1回。使用後に `TRIPLE_CHAIN_WILL` を手札追加
  - `TRIPLE_CHAIN_WILL`: 通常反転のあと追加反転2回。使用後に `QUAD_CHAIN_WILL` を手札追加
  - `QUAD_CHAIN_WILL`: 通常反転のあと追加反転3回。使用後に `INFINITE_CHAIN_WILL` を手札追加
  - `INFINITE_CHAIN_WILL`: 通常反転のあと追加反転を可能な限り継続
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「追加反転 + 次段生成」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「一次反転を起点に候補が無い場合は追加連鎖なし」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json
  - game/logic/cards.js
  - game/ai/cpu-policy-core.js
  - game/ai/cpu-policy-core.js:28
  - 01-rulebook.md:290
  - 01-rulebook.md:586

### regen_01 / 復活の意志（REGEN_WILL）
- 効果詳細（処理順含む）: 1回だけ再生 + 再生起点反転
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「1回だけ再生 + 再生起点反転」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「反転されないままなら再生効果未発動」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:90
  - game/logic/cards.js:2308
  - shared-constants.js:136
  - game/ai/cpu-policy-core.js:12
  - game/ai/cpu-policy-core.js:63
  - 01-rulebook.md:296
  - 01-rulebook.md:587

### destroy_01 / 破壊神（DESTROY_ONE_STONE）
- 効果詳細（処理順含む）: 任意1石破壊
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + GUARDで守られていない石が1個以上必要」を満たす局面で使う。
  - 期待リターン「任意1石破壊」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「GUARD保護対象は破壊失敗」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: GUARD石は `destroyAt` で破壊拒否される。
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:97
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - game/logic/cards.js:980
  - game/logic/cards.js:1201
  - game/logic/cards.js:1263
  - game/logic/cards.js:3661
  - game/logic/effects/destroy_one_stone.js:3

### bomb_01 / 時限爆弾（TIME_BOMB）
- 効果詳細（処理順含む）: 3ターン後に3x3破壊
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 自分石の有効対象が1個以上必要」を満たす局面で使う。
  - 期待リターン「3ターン後に3x3破壊」を満たす見込みがある手で使う。
  - 推奨フェーズ「中盤〜終盤劣勢」に寄せて使用する。
- 利敵行為になる使い方
  - 失敗条件「対象不足・既存爆弾重複不可・反転で解除」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 良: 敵石密集3x3が作れる / 悪: 反転されやすく即解除される位置
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:104
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - game/logic/cards.js:718
  - game/logic/cards.js:954
  - game/logic/cards.js:1008
  - game/logic/cards.js:1154
  - game/card-effects/time-bomb.js:22

### udr_01 / 究極反転龍（ULTIMATE_REVERSE_DRAGON）
- 効果詳細（処理順含む）: 反転0でも空きマスへ配置でき、配置時/ターン開始に周囲8反転（5ターン）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 通常合法手では届かない空きマスにも置けるので、安定マスや敵石に隣接する空きマスへアンカーを置きたい時に使う。
  - 期待リターン「自由配置で配置時/ターン開始に周囲8反転（5ターン）」を満たす見込みがある手で使う。
- 利敵行為になる使い方
  - 失敗条件「アンカー喪失で終了」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 自由配置できても、直後に破壊・交換されやすい不安定マスへ置いてアンカーを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:111
  - game/logic/cards.js:2341
  - shared-constants.js:144
  - game/ai/cpu-policy-core.js:24
  - game/ai/cpu-policy-core.js:55
  - 01-rulebook.md:314

### breeding_01 / 繁殖の意志（BREEDING_WILL）
- 効果詳細（処理順含む）: 配置時/ターン開始に生成拡散（5ターン）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「配置時/ターン開始に生成拡散（5ターン）」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「周囲空きなし時は生成なし・アンカー喪失で終了」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:118
  - game/logic/cards.js:2359
  - shared-constants.js:147
  - game/ai/cpu-policy-core.js:35
  - 01-rulebook.md:322
  - 01-rulebook.md:746

### clone_01 / 複製の意志（CLONE_WILL）
- 効果詳細（処理順含む）: 隣接1マスへ同種石を1つ複製
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 周囲に空きがある自分石が1個以上必要」を満たす局面で使う。
  - 期待リターン「隣接1マスへ同種石を1つ複製」を満たす見込みがある手で使う。
  - 推奨フェーズ「中盤（優勢維持局面）」に寄せて使用する。
- 利敵行為になる使い方
  - 失敗条件「周囲空きなし/対象不正で失敗」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 良: 自石密度が高く隣接空きが多い / 悪: 周囲空きが少ない・劣勢緊急盤面
- 特殊石や保護状態との相互作用: 特殊石・爆弾の marker data を複製先へ引き継ぐ。
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:125
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - game/logic/cards.js:958
  - game/logic/cards.js:1012
  - game/logic/cards.js:1159
  - game/logic/cards.js:1214
  - game/card-effects/clone.js:22

### cross_bomb_01 / 十字爆弾（CROSS_BOMB）
- 効果詳細（処理順含む）: 配置直後に十字範囲爆破
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「配置直後に十字範囲爆破」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「中心/十字範囲に石が無い場合は破壊効果が薄い」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:132
  - game/logic/cards.js:2457
  - game/logic/cards.js:2460
  - game/logic/cards.js:2477
  - game/logic/cards.js:2478
  - shared-constants.js:150
  - game/ai/cpu-policy-core.js:33
  - 01-rulebook.md:342

### x_bomb_01 / クロス爆弾（X_BOMB）
- 効果詳細（処理順含む）: 配置直後にX範囲爆破
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「配置直後にX範囲爆破」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「中心/X範囲に石が無い場合は破壊効果が薄い」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:139
  - game/logic/cards.js:2457
  - game/logic/cards.js:2482
  - shared-constants.js:151
  - game/ai/cpu-policy-core.js:34
  - 01-rulebook.md:347
  - 01-rulebook.md:349

### hyperactive_01 / 多動の意志（HYPERACTIVE_WILL）
- 効果詳細（処理順含む）: ターン開始移動 + 反転機会
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「ターン開始移動 + 反転機会」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「移動先なしで消滅」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:146
  - game/logic/cards.js:2387
  - shared-constants.js:153
  - game/ai/cpu-policy-core.js:40
  - 01-rulebook.md:353
  - 01-rulebook.md:361

### escape_01 / 逃げる意志（ESCAPE_WILL）
- 効果詳細（処理順含む）: ターン開始移動 + 反転機会 + 移動不能時爆破
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「ターン開始移動 + 反転機会 + 移動不能時爆破」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「移動先なしで周囲爆破後に消滅」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:153
  - game/logic/cards.js:2397
  - shared-constants.js:156
  - game/ai/cpu-policy-core.js:41
  - 01-rulebook.md:370
  - 01-rulebook.md:589

### robot_vacuum_01 / ロボット掃除機（ROBOT_VACUUM_WILL）
- 効果詳細（処理順含む）: 敵へ接近移動後に敵1吸引破壊、吸引成功で寿命+1
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「敵へ接近移動後に敵1吸引破壊、吸引成功で寿命+1」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「移動先なしで消滅、GUARD対象は吸引不可」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: GUARD石は吸引破壊できない。
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:160
  - game/logic/cards.js:2408
  - shared-constants.js:159
  - 01-rulebook.md:379
  - 01-rulebook.md:382

### instant_hyperactive_01 / 瞬間多動（INSTANT_HYPERACTIVE_WILL）
- 効果詳細（処理順含む）: 配置直後3回移動後に消滅
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「配置直後3回移動後に消滅」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「3回移動後に必ず消滅」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:167
  - game/logic/cards.js:2420
  - shared-constants.js:162
  - game/ai/cpu-policy-core.js:42
  - 01-rulebook.md:361
  - 01-rulebook.md:364

### sell_01 / 売却の意志（SELL_CARD_WILL）
- 効果詳細（処理順含む）: 売却カードのcost分を即時獲得
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 使用後に売却用の自分手札が最低1枚必要（手札>1）」を満たす局面で使う。
  - 期待リターン「売却カードのcost分を即時獲得」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「売却対象未選択/手札不足」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: +（売却cost分）
- 根拠コード参照
  - cards/catalog.json:174
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - game/logic/cards.js:929
  - game/logic/cards.js:1124
  - game/logic/cards.js:1204
  - game/logic/cards.js:2642
  - shared-constants.js:165

### rebuild_01 / 再構築の意志（REBUILD_WILL）
- 効果詳細（処理順含む）: 手札を全破壊し、即時2ドローして pending を解消
- 合理的な使い方
  - 発動条件「手札所持・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 手札詰まり（低効率カード過多、角回収不能）を解消したい局面で使う。
  - 手札上限付近（4〜5枚）で次ターンの選択肢を更新したい時に使う。
- 利敵行為になる使い方
  - 角保持/再奪還に必要な高優先カードを抱えたまま切る。
  - 山札が薄く、2枚補充が見込めない局面で切る。
  - このターンに温存すべき防御カードまで一括破棄してしまう。
- 相性の良い盤面/悪い盤面: 良: 手札品質が低く更新価値が高い局面 / 悪: 既に防御札が揃い温存優位な局面
- 特殊石や保護状態との相互作用: 盤面石には直接干渉せず、手札破棄とドローのみ実行する。
- 布石収支観点（定性的）: 0（直接の布石増減なし）
- 根拠コード参照
  - cards/catalog.json:181
  - game/turn/turn_pipeline_phases.js / game/turn/turn_pipeline_phase_helpers.js
  - game/turn/turn_pipeline_phases.js / game/turn/turn_pipeline_phase_helpers.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - shared-constants.js:169
  - 01-rulebook.md:398

### plunder_will / 吸収の意志（PLUNDER_WILL）
- 効果詳細（処理順含む）: 反転枚数ぶん吸収（自 gain += plundered）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「反転枚数ぶん吸収（自 gain += plundered）」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「相手布石が少ないと吸収量が伸びない」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 相手布石が少ない状態で使い、吸収量がコストを下回る。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: ±（-cost + 反転 + 吸収）
- 根拠コード参照
  - cards/catalog.json:188
  - game/logic/cards.js:2216
  - shared-constants.js:168
  - game/ai/cpu-policy-core.js:13
  - game/ai/cpu-policy-core.js:74
  - game/ai/cpu-policy-core.js:249
  - 01-rulebook.md:398

### work_01 / 出稼ぎの意志（WORK_WILL）
- 効果詳細（処理順含む）: 自ターン開始で 1→2→4→8→16（上限99）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「自ターン開始で 1→2→4→8→16（上限99）」を満たす見込みがある手で使う。
  - 推奨フェーズ「序盤〜中盤（角/辺に置ける時）」に寄せて使用する。
- 利敵行為になる使い方
  - 失敗条件「アンカー喪失または残りターン0で終了」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 良: 次配置を失いにくい角/辺 / 悪: 反転・破壊されやすい中心密集
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: +（継続収入）
- 根拠コード参照
  - cards/catalog.json:195
  - game/logic/cards.js:1227
  - shared-constants.js:171
  - game/ai/cpu-policy-core.js:76
  - game/ai/cpu-policy-core.js:238
  - game/ai/cpu-policy-core.js:490
  - 01-rulebook.md:402
  - 01-rulebook.md:719

### double_01 / 二連投石（DOUBLE_PLACE）
- 効果詳細（処理順含む）: そのターンのみ追加1手
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「そのターンのみ追加1手」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「2手目の合法手が無ければ追加配置できない」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:202
  - game/logic/cards.js:2489
  - shared-constants.js:173
  - game/ai/cpu-policy-core.js:27
  - 01-rulebook.md:104
  - 01-rulebook.md:183

### heaven_01 / 天の恵み（HEAVEN_BLESSING）
- 効果詳細（処理順含む）: 候補5枚から1枚を手札獲得
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 候補生成に成功し、手札上限5未満」を満たす局面で使う。
  - 期待リターン「候補5枚から1枚を手札獲得」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「候補なし/手札上限で受取不可」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:209
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - game/logic/cards.js:1129
  - game/logic/cards.js:1132
  - game/logic/cards.js:1205
  - game/logic/cards.js:2673
  - shared-constants.js:175

### condemn_01 / 断罪の意志（CONDEMN_WILL）
- 効果詳細（処理順含む）: 相手手札1枚破壊
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 相手手札が1枚以上必要」を満たす局面で使う。
  - 期待リターン「相手手札1枚破壊」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「対象index不正/target_mismatch」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:216
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - game/logic/cards.js:933
  - game/logic/cards.js:1135
  - game/logic/cards.js:1136
  - game/logic/cards.js:1206
  - shared-constants.js:177

### gold_stone / 金の意志（GOLD_STONE）
- 効果詳細（処理順含む）: 反転布石×4、配置石は即時消滅
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「反転布石×4、配置石は即時消滅」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「反転0〜1枚だと費用回収しにくい」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 反転0〜1枚想定で使用し、自己消滅だけ発生させる。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: ±（-6 + 4*flipCount）
- 根拠コード参照
  - cards/catalog.json:223
  - game/logic/cards.js:2191
  - shared-constants.js:180
  - game/ai/cpu-policy-core.js:71
  - game/ai/cpu-policy-core.js:251
  - 01-rulebook.md:427
  - 01-rulebook.md:717

### silver_stone / 銀の意志（SILVER_STONE）
- 効果詳細（処理順含む）: 反転布石×3、配置石は即時消滅
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「反転布石×3、配置石は即時消滅」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「反転0〜1枚だと費用回収しにくい」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 反転0〜1枚想定で使用し、倍率回収前に枠を失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: ±（-3 + 3*flipCount）
- 根拠コード参照
  - cards/catalog.json:230
  - game/logic/cards.js:2204
  - shared-constants.js:240
  - game/ai/cpu-policy-core.js:72
  - game/ai/cpu-policy-core.js:252
  - 01-rulebook.md:432
  - 01-rulebook.md:717

### extend_life_01 / 延命の意志（EXTEND_LIFE_WILL）
- 効果詳細（処理順含む）: remainingOwnerTurns を2倍
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + remainingOwnerTurns>0 の自分特殊石が必要」を満たす局面で使う。
  - 期待リターン「remainingOwnerTurns を2倍」を満たす見込みがある手で使う。
  - 推奨フェーズ「中盤〜終盤（寿命付き特殊石が残る局面）」に寄せて使用する。
- 利敵行為になる使い方
  - 失敗条件「対象が特殊石でない/remainingOwnerTurns無効」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: remainingOwnerTurns を持つ自分特殊石のみ対象。

### extend_life_god_01 / 延命神（EXTEND_LIFE_GOD）
- 効果詳細（処理順含む）: remainingOwnerTurns を4倍
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + remainingOwnerTurns>0 の自分特殊石が必要」を満たす局面で使う。
  - 期待リターン「remainingOwnerTurns を4倍」を満たす見込みがある手で使う。
  - 推奨フェーズ「中盤〜終盤（寿命付き特殊石を長く残したい局面）」に寄せて使用する。
- 利敵行為になる使い方
  - 失敗条件「対象が特殊石でない/remainingOwnerTurns無効」に該当する状態で切る。
  - このターンのカード使用枠と高めの布石コストを、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（個別の明示ロジックなし）
- 特殊石や保護状態との相互作用: remainingOwnerTurns を持つ自分特殊石のみ対象。同一マスのGUARDは同時に延長される。
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:244
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - game/logic/cards.js:1149
  - game/logic/cards.js:1212
  - game/logic/cards.js:1758
  - game/logic/cards.js:3691
  - game/card-effects/extend-life.js:3

### guard_01 / 守る意志（GUARD_WILL）
- 効果詳細（処理順含む）: 3ターン完全保護（反転/交換/破壊/誘惑を遮断）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 自分石の有効対象が1個以上必要」を満たす局面で使う。
  - 期待リターン「3ターン完全保護（反転/交換/破壊/誘惑を遮断）」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「対象不足」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 反転・交換・破壊・誘惑を遮断。
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:251
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - cards/card-interaction.js / cards/card-interaction-effects.js
  - game/logic/cards.js:950
  - game/logic/cards.js:1004
  - game/logic/cards.js:1144
  - game/logic/cards.js:1211
  - game/card-effects/guard.js:22

### udg_01 / 究極破壊神（ULTIMATE_DESTROY_GOD）
- 効果詳細（処理順含む）: 反転0でも空きマスへ配置でき、配置時/ターン開始に周囲8破壊（5ターン）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 通常合法手では届かない空きマスにも置けるので、敵石に密着した空きマスへアンカーを置きたい時に使う。
  - 期待リターン「自由配置で配置時/ターン開始に周囲8破壊（5ターン）」を満たす見込みがある手で使う。
- 利敵行為になる使い方
  - 失敗条件「アンカー喪失で終了」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 自由配置できても、直後に破壊・交換されやすい不安定マスへ置いてアンカーを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:258
  - game/logic/cards.js:2369
  - game/logic/cards.js:2371
  - game/logic/cards.js:3540
  - game/logic/cards/regen.js:56
  - game/logic/cards/udg.js:85
  - game/logic/effects/dragon.js:77
  - shared-constants.js:192

### ultimate_hyperactive_01 / 究極多動神（ULTIMATE_HYPERACTIVE_GOD）
- 効果詳細（処理順含む）: 両者ターン開始に直線1〜5マス移動を2回+反転（10ターン）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`）」を満たす局面で使う。
  - 期待リターン「両者ターン開始に直線1〜5マス移動を2回+反転（10ターン）」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「移動先なしで消滅、残り0で同色通常石化」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:265
  - game/logic/cards.js:2432
  - game/logic/cards/hyperactive.js:105
  - shared-constants.js:195
  - game/ai/cpu-policy-core.js:26
  - 01-rulebook.md:456
  - 01-rulebook.md:458

### board_expand_01 / 盤面拡張（BOARD_EXPANSION_WILL）
- 効果詳細（処理順含む）: 左右外側に1セル追加（各プレイヤー1回）
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 未使用かつ拡張未展開、左右端選択対象が存在」を満たす局面で使う。
  - 期待リターン「左右外側に1セル追加（各プレイヤー1回）」を満たす見込みがある手で使う。
  - 推奨フェーズ「終盤劣勢（cornerEmergency想定）」に寄せて使用する。
- 利敵行為になる使い方
  - 失敗条件「使用済み/既に拡張中で使用不可」に該当する状態で切る。
  - CPU方針で高分散札として減点される局面（優勢・角確保局面）で先打ちする。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 良: 角劣勢で手筋拡張が必要 / 悪: 既に優勢で盤面を広げる必要が薄い
- 特殊石や保護状態との相互作用: 未確認（当該カード固有の追加条件は明示コードを確認できず）
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:272
  - game/logic/cards.js:971
  - game/logic/cards.js:1175
  - game/logic/cards.js:1215
  - game/logic/cards.js:1263
  - game/card-effects/board-expansion.js:22
  - shared-constants.js:198
  - game/ai/cpu-policy-core.js:44

### blockade_01 / 封鎖の意志（BLOCKADE_WILL）
- 効果詳細（処理順含む）: 空き1マスを3ターン封鎖
- 合理的な使い方
  - 発動条件「手札所持・布石コスト充足・このターン未使用（`applyCardUsage`） + 空きかつ未封鎖マスが1個以上必要」を満たす局面で使う。
  - 期待リターン「空き1マスを3ターン封鎖」を満たす見込みがある手で使う。
  - CPU方針で明示がないため、対象条件を満たす時だけ選択する。
- 利敵行為になる使い方
  - 失敗条件「空きマス不足/対象不正」に該当する状態で切る。
  - このターンのカード使用枠を、直接価値が薄い局面で消費する。
  - 対象不足を見落とし、使用不可/不発でテンポを失う。
- 相性の良い盤面/悪い盤面: 未確認（盤面相性の明示ロジックなし）
- 特殊石や保護状態との相互作用: 封鎖マスは配置/移動の双方で使用不可。
- 布石収支観点（定性的）: 0（直接の布石式は未確認）
- 根拠コード参照
  - cards/catalog.json:279
  - game/logic/cards.js:975
  - game/logic/cards.js:1016
  - game/logic/cards.js:1180
  - game/logic/cards.js:1216
  - game/card-effects/blockade.js:22
  - shared-constants.js:201
  - game/ai/cpu-policy-core.js:64

## 4. 重点分析（必須）

### 4.1 金の意志（GOLD_STONE）
- 高効率ケース
  - 実装式は `-cost + 4*flipCount`（コスト減算後に `chargeGain = flipCount * 4`）。
  - 反転2枚以上で回収ライン、3枚以上で明確な上振れ。
- 損するケース
  - 反転0〜1枚だと回収不足。さらに配置石は即時消滅。
- 根拠
  - game/logic/cards.js:1192
  - game/logic/cards.js:2192
  - game/logic/cards.js:2195

### 4.2 銀の意志（SILVER_STONE）
- 高効率ケース
  - 実装式は `-cost + 3*flipCount`。反転2枚以上で回収ライン。
- 損するケース
  - 反転0〜1枚で費用負けしやすく、配置石は即時消滅。
- 根拠
  - game/logic/cards.js:1192
  - game/logic/cards.js:2205
  - game/logic/cards.js:2208

### 4.3 吸収の意志（PLUNDER_WILL）
- 高効率ケース
  - 実装式は `-cost + flipCount + plundered`（`plundered` は相手布石依存）。
  - `flipCount` と相手布石が十分ある局面ほど回収率が高い。
- 損するケース
  - 相手布石が薄い局面では `plundered` が伸びず、費用を回収しにくい。
- 根拠
  - game/logic/cards.js:1192
  - game/logic/cards.js:2216
  - game/logic/cards.js:2223

### 4.4 反転無効/保護石が絡むときの最適対応
- 高効率ケース
  - 反転判定は `protectedStones` / `permaProtectedStones` / `blockedCells` を除外して計算されるため、保護外ラインを優先して手を作る。
  - GUARD石は破壊が `guard_protected` で拒否されるため、破壊系は非GUARD対象へ切り替える。
  - SWAP_WITH_ENEMY は通常石専用なので、特殊石/爆弾を避けて対象選択する。
- 損するケース
  - 保護石を挟みラインに含める前提で手を読むと、合法手/反転枚数の見積りが崩れる。
  - GUARD対象へ破壊系を投げると不発し、カード使用枠だけ失う。
- 根拠
  - game/logic/core.js:137
  - game/logic/core.js:146
  - game/logic/board_ops.js:244
  - game/logic/cards/selectors.js:16
  - game/logic/cards/selectors.js:38

## 5. 教師CPU実装向けルール草案

### 5.1 カード別 use_if / avoid_if / 優先度
- chest_01 (TREASURE_BOX) / 優先度: A / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 主な不発なし（コスト不足/使用済み制限のみ）
- free_01 (FREE_PLACEMENT) / 優先度: S / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- sniper_01 (SNIPER_WILL) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- hard_01 (PROTECTED_NEXT_STONE) / 優先度: A / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: コスト不足/使用済み
- swap_01 (SWAP_WITH_ENEMY) / 優先度: C / use_if: 相手の通常石（特殊石/爆弾以外）が必要 を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- position_swap_01 (POSITION_SWAP_WILL) / 優先度: C / use_if: 盤面に石が2個以上必要 を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- perma_01 (PERMA_PROTECT_NEXT_STONE) / 優先度: A / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: コスト不足/使用済み
- strong_wind_01 (STRONG_WIND_WILL) / 優先度: C / use_if: 上下左右いずれかへ移動可能な石が必要 を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- trap_01 (TRAP_WILL) / 優先度: A / use_if: 自分石の有効対象が1個以上必要 を満たす / avoid_if: 対象不足・次相手ターンで未発動のまま消滅・このターンの配置価値が高い
- tempt_01 (TEMPT_WILL) / 優先度: C / use_if: 相手特殊石（GUARD以外）が1個以上必要 を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- double_chain_01 (DOUBLE_CHAIN_WILL) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- triple_chain_01 (TRIPLE_CHAIN_WILL) / 優先度: C / use_if: generated-only で手札に入っており、基本条件を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- quad_chain_01 (QUAD_CHAIN_WILL) / 優先度: C / use_if: generated-only で手札に入っており、基本条件を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- infinite_chain_01 (INFINITE_CHAIN_WILL) / 優先度: C / use_if: generated-only で手札に入っており、基本条件を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- regen_01 (REGEN_WILL) / 優先度: A / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 反転されないままなら再生効果未発動
- destroy_01 (DESTROY_ONE_STONE) / 優先度: A / use_if: GUARDで守られていない石が1個以上必要 を満たす / avoid_if: GUARD保護対象は破壊失敗
- bomb_01 (TIME_BOMB) / 優先度: C / use_if: 自分石の有効対象が1個以上必要 を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- udr_01 (ULTIMATE_REVERSE_DRAGON) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- breeding_01 (BREEDING_WILL) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- clone_01 (CLONE_WILL) / 優先度: C / use_if: 周囲に空きがある自分石が1個以上必要 を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- cross_bomb_01 (CROSS_BOMB) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- x_bomb_01 (X_BOMB) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- hyperactive_01 (HYPERACTIVE_WILL) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- escape_01 (ESCAPE_WILL) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- robot_vacuum_01 (ROBOT_VACUUM_WILL) / 優先度: B / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 移動先なしで消滅、GUARD対象は吸引不可
- instant_hyperactive_01 (INSTANT_HYPERACTIVE_WILL) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- sell_01 (SELL_CARD_WILL) / 優先度: A / use_if: 使用後に売却用の自分手札が最低1枚必要（手札>1） を満たす / avoid_if: 売却対象未選択/手札不足
- rebuild_01 (REBUILD_WILL) / 優先度: B / use_if: 手札品質が低く再抽選したい時、手札4枚以上で詰まり解消したい時 / avoid_if: 高優先防御札を保持中、山札が薄い時
- plunder_will (PLUNDER_WILL) / 優先度: A / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 相手布石が少ないと吸収量が伸びない
- work_01 (WORK_WILL) / 優先度: A / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: アンカー喪失または残りターン0で終了
- double_01 (DOUBLE_PLACE) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- heaven_01 (HEAVEN_BLESSING) / 優先度: B / use_if: 候補生成に成功し、手札上限5未満 を満たす / avoid_if: 候補なし/手札上限で受取不可
- condemn_01 (CONDEMN_WILL) / 優先度: B / use_if: 相手手札が1枚以上必要 を満たす / avoid_if: 対象index不正/target_mismatch
- gold_stone (GOLD_STONE) / 優先度: A / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 反転0〜1枚だと費用回収しにくい
- silver_stone (SILVER_STONE) / 優先度: A / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 反転0〜1枚だと費用回収しにくい
- extend_life_01 (EXTEND_LIFE_WILL) / 優先度: B / use_if: remainingOwnerTurns>0 の自分特殊石が必要 を満たす / avoid_if: 対象が特殊石でない/remainingOwnerTurns無効
- extend_life_god_01 (EXTEND_LIFE_GOD) / 優先度: B / use_if: remainingOwnerTurns>0 の自分特殊石が必要 を満たす / avoid_if: 対象が特殊石でない/remainingOwnerTurns無効
- guard_01 (GUARD_WILL) / 優先度: A / use_if: 自分石の有効対象が1個以上必要 を満たす / avoid_if: 対象不足
- udg_01 (ULTIMATE_DESTROY_GOD) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- ultimate_hyperactive_01 (ULTIMATE_HYPERACTIVE_GOD) / 優先度: C / use_if: 基本条件（手札/コスト/未使用）を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- board_expand_01 (BOARD_EXPANSION_WILL) / 優先度: C / use_if: 未使用かつ拡張未展開、左右端選択対象が存在 を満たす / avoid_if: 優勢時・角確保手がある時・緊急性が低い時
- blockade_01 (BLOCKADE_WILL) / 優先度: A / use_if: 空きかつ未封鎖マスが1個以上必要 を満たす / avoid_if: 空きマス不足/対象不正

### 5.2 低リスク運用ルール
- 共通: 使用前に `getUsableCardIds` 相当の対象存在チェックを必須化する。
- 共通: 角保持/再奪還に関わるカード（防御群・再奪還群）を優先し、`HIGH_VARIANCE` 群は後回しにする。
- 経済群: `-cost + 期待獲得` が非負見込みのときのみ選択する。
- 破壊系: GUARD対象除外を前提に候補生成する。

### 5.3 緊急時のみ許可する高リスク運用ルール
- `FREE_PLACEMENT`: 合法手<=1 または角劣勢時の緊急脱出に限定。
- `TIME_BOMB` / `BOARD_EXPANSION_WILL`: 劣勢巻き返し（cornerEmergency相当）時に限定。
- `HIGH_VARIANCE` 群: 優勢時は原則封印し、終盤逆転が必要な局面でのみ解禁。

### 5.4 CPU判断コンテキスト（固定キー）
- `cornerEmergency`: `oppCorners > ownCorners || (!hasCornerMoveNow && oppCorners > 0)`。
- `cornerHoldMode`: `!cornerEmergency && ownCorners > 0 && ownCorners >= oppCorners`。
- `highBonusMoveAvailable`: `maxLegalMoveBonus >= 3`。
- `reserveChargeFloor`（既定）: `empties <= 12 ? 4 : (empties <= 30 ? 6 : 8)`、`cornerEmergency` 時は `-2`（下限2）、`forceUseCard` 時は `0`。
- `minUseScore`（既定）: `forceUseCard ? -∞ : (level>=6 ? 22 : (level>=4 ? 6 : -8))`。手札4〜5枚・高チャージ時に段階的に緩和。
- 高確信ゲート `requiredMargin`: `14` を基準に、`+22(hasCornerMoveNow) +8(highBonusMoveAvailable) +6(discDiff>=8) -4(discDiff<=-10) -8(handSize>=5)`、下限 `4`。
- 根拠: `game/ai/cpu-policy-core.js`（`buildCardDecisionContext`, `scoreCardUseDecision`） / `game/cpu-decision.js` / `game/cpu-decision-board-utils.js`（`buildCornerPlanState`, `buildCardUseDecisionContext`, `isCardChoiceAllowedByHighConfidence`）。

### 5.5 自己対局・学習の固定設定
- 自己対局の既定値: `cardUsageRate=0.2`, `policyMixRate=1`, `cardUsageRateJitter=0`, `tacticalDepthOpening=2`, `tacticalDepthMid=3`, `tacticalDepthEnd=4`。
- 自己対局の重みレンジ（既定）: `tacticalWeightMin/Max=1`, `policyScoreWeightMin/Max=1`, `heuristicWeightMin/Max=1`。
- ONNX入力: `BASE_INPUT_DIM=80`、全入力は `80 + 2*CARD_ACTION_DIM`（手札頻度 + 使用可能フラグ）。
- カード未使用ラベル: `NO_CARD_ACTION_ID="__no_card__"`。`place` 行動で `usableCardIds` が非空なら未使用ラベルを学習対象に含める。
- ONNX学習重みの既定: `card_loss_weight=2.0`, `card_no_action_weight=0.7`, `card_class_balance_power=0.25`。
- policy-table 形状重み（既定）: `disc=0.48`, `bonus=0.24`, `positional=0.20`, `card=0.08`。
- 根拠: `src/engine/selfplay-runner.js`（`normalizeOptions`, `buildPerGamePolicySet`） / `ai/train/train_policy_onnx.py` / `ai/train/train_policy_table.py`。

## 6. 未確定事項
- 定義と実装の不一致: `01-rulebook.md` 4.1 で「現行は38枚」とあるが、`cards/catalog.json` 実装定義は40枚。
  - 根拠: 01-rulebook.md:88 / cards/catalog.json:6
- `game/logic/cards.js` には `./effects/plunder_will` 等の任意requireがあるが、実ファイルは確認できず inline フォールバック経路で実行される。
  - 根拠: game/logic/cards.js:2217 / game/logic/cards.js:2235
- 個別カードの盤面評価（どの座標が最善か）は、`cpu-policy-core.js` で明示されるカードと未記述カードが混在する。未記述カードは追加調査が必要。
  - 追加調査候補: game/ai/cpu-policy-core.js の `scoreCardUseDecision` 対象外カード
