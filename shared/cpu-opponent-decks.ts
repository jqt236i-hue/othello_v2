'use strict';

// CPUごとの固定デッキ（カードID。同じカードを何枚でも入れられる）。01-rulebook.md「CPUの固有デッキ」。
// CPUデッキ調整ツール（npm run cpu-decks:editor）の「反映」で書き換える。手で編集する場合も印の間はJSONのまま保つ。
// null はデフォルトデッキ（対局ごとにランダムな30枚）。Lv9 終焉の冥灰は全種デッキ固定のためここに含めない。
//   1: Lv1 盤喰いの小鬼
//   2: Lv2 反転の影
//   3: Lv3 布石を紡ぐ者
//   4: Lv4 盤面支配者
//   5: Lv5 終局を告げる者
//   6: Lv6 盤理の観測者
//   7-board-executor: Lv7 盤界の執行者
//   8-theory-incarnation: Lv8 理論の化身
//   10-observed-dark-dragon: Lv10 観測ダークドラゴン
//   11-execution-chaos-dragon: Lv11 執行エグゼキューションカオスドラゴン
//   12-strategy-cpu: Lv12 理論カオスロジカルエンペラービースト
//   13-truth-chaos-emperor-beast: Lv13 真理カオスロジカルエンペラービースト
const CPU_OPPONENT_DECK_DATA: Record<string, string[] | null> = /* cpu-decks:begin */{
    "1": null,
    "2": null,
    "3": null,
    "4": null,
    "5": null,
    "6": [
        "chest_01", "hard_01", "swap_01", "position_swap_01", "perma_01", "strong_wind_01",
        "super_buoyancy_01", "super_gravity_01", "tempt_01", "capture_01", "regen_01", "udr_01",
        "breeding_01", "seed_01", "teleport_01", "hyperactive_01", "will_hunter_king_01", "loss_will_01",
        "observer_will_01", "gold_stone", "silver_stone", "extend_life_01", "guard_01", "destroy_dragon_01",
        "lightning_01", "ultimate_hyperactive_01", "board_expand_01", "board_shrink_01", "reinforcement_01", "support_troops_01"
    ],
    "7-board-executor": [
        "sniper_01", "ghost_01", "afterimage_will_01", "swap_01", "strong_wind_01", "super_buoyancy_01",
        "super_gravity_01", "super_attraction_01", "trap_01", "tempt_01", "capture_01", "regen_01",
        "destroy_01", "proliferation_01", "teleport_01", "hyperactive_01", "will_hunter_king_01", "loss_will_01",
        "double_01", "board_executor_01", "condemn_01", "execution_01", "guard_01", "destroy_dragon_01",
        "lightning_01", "udg_01", "board_shrink_01", "blockade_01", "meteor_01", "equality_will_01"
    ],
    "8-theory-incarnation": [
        "ghost_01", "perma_01", "tempt_01", "regen_01", "udr_01", "breeding_01",
        "proliferation_01", "clone_01", "hyperactive_01", "escape_01", "robot_vacuum_01", "will_hunter_king_01",
        "instant_hyperactive_01", "heaven_01", "theory_incarnation_01", "gold_stone", "rainbow_stone", "crystal_stone",
        "extend_life_01", "extend_life_god_01", "guard_01", "guardian_god_01", "stone_salvation_god_01", "destroy_dragon_01",
        "lightning_01", "udg_01", "ultimate_hyperactive_01", "meteor_god_01", "chaos_summon_01", "chaos_summon_01"
    ],
    "10-observed-dark-dragon": [
        "chest_01", "free_01", "last_resort_01", "sniper_01", "hard_01", "ghost_01",
        "sacrifice_will_01", "zombie_will_01", "afterimage_will_01", "swap_01", "position_swap_01", "perma_01",
        "strong_wind_01", "super_buoyancy_01", "buoyancy_01", "super_gravity_01", "super_attraction_01", "gravity_01",
        "trap_01", "tempt_01", "capture_01", "double_chain_01", "taboo_reverse_01", "reverse_will_01",
        "regen_01", "destroy_01", "bomb_01", "time_stop_god_01", "udr_01", "breeding_01",
        "proliferation_01", "clone_01", "seed_01", "teleport_01", "cell_teleport_01", "cross_bomb_01",
        "x_bomb_01", "hyperactive_01", "extreme_hyperactive_01", "escape_01", "robot_vacuum_01", "gluttonous_will_01",
        "will_hunter_king_01", "instant_hyperactive_01", "rebuild_01", "work_01", "ultimate_work_god_01", "ribo_01",
        "loss_will_01", "mass_freeze_will_01", "double_01", "heaven_01", "reveal_hand_01", "theory_incarnation_01",
        "board_executor_01", "observer_will_01", "condemn_01", "execution_01", "gold_stone", "rainbow_stone",
        "silver_stone", "crystal_stone", "extend_life_01", "extend_life_god_01", "corrosion_01", "guard_01",
        "guardian_god_01", "stone_salvation_god_01", "destroy_dragon_01", "lightning_01", "udg_01", "ultimate_hyperactive_01",
        "board_expand_01", "board_expand_god_01", "board_shrink_01", "board_shrink_god_01", "blockade_01", "poison_will_01",
        "fire_will_01", "water_will_01", "grass_will_01", "meteor_01", "causal_replay_01", "freeze_01",
        "salvation_01", "living_will_01", "reinforcement_01", "support_troops_01", "equality_will_01", "fate_will_01",
        "meteor_god_01", "chaos_summon_01", "time_stop_deity_01", "reincarnation_will_01"
    ],
    "11-execution-chaos-dragon": [
        "chest_01", "free_01", "last_resort_01", "sniper_01", "hard_01", "ghost_01",
        "sacrifice_will_01", "zombie_will_01", "afterimage_will_01", "swap_01", "position_swap_01", "perma_01",
        "strong_wind_01", "super_buoyancy_01", "buoyancy_01", "super_gravity_01", "super_attraction_01", "gravity_01",
        "trap_01", "tempt_01", "capture_01", "double_chain_01", "taboo_reverse_01", "reverse_will_01",
        "regen_01", "destroy_01", "bomb_01", "time_stop_god_01", "udr_01", "breeding_01",
        "proliferation_01", "clone_01", "seed_01", "teleport_01", "cell_teleport_01", "cross_bomb_01",
        "x_bomb_01", "hyperactive_01", "extreme_hyperactive_01", "escape_01", "robot_vacuum_01", "gluttonous_will_01",
        "will_hunter_king_01", "instant_hyperactive_01", "rebuild_01", "work_01", "ultimate_work_god_01", "ribo_01",
        "loss_will_01", "mass_freeze_will_01", "double_01", "heaven_01", "reveal_hand_01", "theory_incarnation_01",
        "board_executor_01", "observer_will_01", "condemn_01", "execution_01", "gold_stone", "rainbow_stone",
        "silver_stone", "crystal_stone", "extend_life_01", "extend_life_god_01", "corrosion_01", "guard_01",
        "guardian_god_01", "stone_salvation_god_01", "destroy_dragon_01", "lightning_01", "udg_01", "ultimate_hyperactive_01",
        "board_expand_01", "board_expand_god_01", "board_shrink_01", "board_shrink_god_01", "blockade_01", "poison_will_01",
        "fire_will_01", "water_will_01", "grass_will_01", "meteor_01", "causal_replay_01", "freeze_01",
        "salvation_01", "living_will_01", "reinforcement_01", "support_troops_01", "equality_will_01", "fate_will_01",
        "meteor_god_01", "chaos_summon_01", "time_stop_deity_01", "reincarnation_will_01"
    ],
    "12-strategy-cpu": [
        "sniper_01", "sniper_01", "sniper_01", "hard_01", "ghost_01", "ghost_01",
        "ghost_01", "sacrifice_will_01", "sacrifice_will_01", "sacrifice_will_01", "zombie_will_01", "zombie_will_01",
        "zombie_will_01", "afterimage_will_01", "afterimage_will_01", "afterimage_will_01", "trap_01", "capture_01",
        "capture_01", "udr_01", "udr_01", "udr_01", "proliferation_01", "proliferation_01",
        "proliferation_01", "cross_bomb_01", "x_bomb_01", "hyperactive_01", "hyperactive_01", "hyperactive_01",
        "extreme_hyperactive_01", "extreme_hyperactive_01", "extreme_hyperactive_01", "escape_01", "escape_01", "escape_01",
        "robot_vacuum_01", "robot_vacuum_01", "robot_vacuum_01", "gluttonous_will_01", "gluttonous_will_01", "gluttonous_will_01",
        "will_hunter_king_01", "will_hunter_king_01", "will_hunter_king_01", "instant_hyperactive_01", "instant_hyperactive_01", "instant_hyperactive_01",
        "ultimate_work_god_01", "ultimate_work_god_01", "theory_incarnation_01", "theory_incarnation_01", "theory_incarnation_01", "extend_life_01",
        "extend_life_01", "extend_life_god_01", "extend_life_god_01", "extend_life_god_01", "guard_01", "guard_01",
        "guardian_god_01", "guardian_god_01", "guardian_god_01", "destroy_dragon_01", "destroy_dragon_01", "destroy_dragon_01",
        "lightning_01", "lightning_01", "lightning_01", "udg_01", "udg_01", "udg_01",
        "ultimate_hyperactive_01", "ultimate_hyperactive_01", "ultimate_hyperactive_01", "fire_will_01", "fire_will_01", "fire_will_01",
        "water_will_01", "water_will_01", "water_will_01", "grass_will_01", "grass_will_01", "grass_will_01",
        "living_will_01", "fate_will_01", "chaos_summon_01", "chaos_summon_01", "chaos_summon_01", "reincarnation_will_01",
        "reincarnation_will_01", "reincarnation_will_01"
    ],
    "13-truth-chaos-emperor-beast": [
        "free_01", "free_01", "last_resort_01", "sniper_01", "sniper_01", "hard_01",
        "ghost_01", "ghost_01", "zombie_will_01", "zombie_will_01", "afterimage_will_01", "afterimage_will_01",
        "swap_01", "swap_01", "position_swap_01", "position_swap_01", "perma_01", "perma_01",
        "strong_wind_01", "strong_wind_01", "super_buoyancy_01", "super_buoyancy_01", "buoyancy_01", "buoyancy_01",
        "super_gravity_01", "super_gravity_01", "super_attraction_01", "super_attraction_01", "gravity_01", "gravity_01",
        "tempt_01", "tempt_01", "capture_01", "capture_01", "double_chain_01", "double_chain_01",
        "taboo_reverse_01", "reverse_will_01", "reverse_will_01", "regen_01", "regen_01", "destroy_01",
        "destroy_01", "bomb_01", "udr_01", "udr_01", "breeding_01", "breeding_01",
        "proliferation_01", "proliferation_01", "clone_01", "clone_01", "seed_01", "seed_01",
        "teleport_01", "teleport_01", "cross_bomb_01", "cross_bomb_01", "x_bomb_01", "x_bomb_01",
        "escape_01", "escape_01", "robot_vacuum_01", "robot_vacuum_01", "gluttonous_will_01", "will_hunter_king_01",
        "will_hunter_king_01", "work_01", "ultimate_work_god_01", "ultimate_work_god_01", "double_01", "double_01",
        "theory_incarnation_01", "board_executor_01", "observer_will_01", "extend_life_01", "extend_life_god_01", "extend_life_god_01",
        "guard_01", "guardian_god_01", "guardian_god_01", "stone_salvation_god_01", "stone_salvation_god_01", "destroy_dragon_01",
        "destroy_dragon_01", "lightning_01", "lightning_01", "udg_01", "udg_01", "ultimate_hyperactive_01",
        "ultimate_hyperactive_01", "board_expand_01", "board_expand_01", "board_expand_god_01", "board_shrink_01", "board_shrink_01",
        "board_shrink_god_01", "board_shrink_god_01", "fire_will_01", "fire_will_01", "water_will_01", "grass_will_01",
        "grass_will_01", "meteor_01", "meteor_01", "causal_replay_01", "salvation_01", "living_will_01",
        "living_will_01", "support_troops_01", "support_troops_01", "fate_will_01", "meteor_god_01", "chaos_summon_01",
        "chaos_summon_01", "reincarnation_will_01"
    ]
}/* cpu-decks:end */;

const CPU_OPPONENT_DECKS: Readonly<Record<string, readonly string[] | null>> = (() => {
    const decks: Record<string, readonly string[] | null> = {};
    for (const id of Object.keys(CPU_OPPONENT_DECK_DATA)) {
        const deck = CPU_OPPONENT_DECK_DATA[id];
        decks[id] = deck ? Object.freeze(deck.slice()) : null;
    }
    return Object.freeze(decks);
})();

export = { CPU_OPPONENT_DECKS };
