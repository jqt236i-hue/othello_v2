/**
 * Effect-based card groups for the CPU deck editor (tools/cpu-deck-editor).
 * A card can belong to several groups. 「特殊石」 is not listed here: it uses
 * the game's own judgment (Registry.getMarkerTypeForSpecialStoneCard).
 * Groups are keyed by card type, so copies and generated successors follow.
 */
export type CardRoleDefinition = { key: string; label: string; types: readonly string[] };

export const SPECIAL_STONE_ROLE = Object.freeze({ key: 'special-stone', label: '特殊石' });

export const CARD_ROLE_DEFINITIONS: readonly CardRoleDefinition[] = Object.freeze([
    { key: 'destroy', label: '破壊', types: [
        'SNIPER_WILL', 'DESTROY_ONE_STONE', 'TIME_BOMB', 'SUPER_BUOYANCY_WILL', 'SUPER_GRAVITY_WILL', 'SUPER_ATTRACTION_WILL',
        'CROSS_BOMB', 'X_BOMB', 'ESCAPE_WILL', 'ROBOT_VACUUM_WILL', 'GLUTTONOUS_WILL', 'WILL_HUNTER_KING', 'DESTROY_DRAGON_WILL',
        'LIGHTNING_WILL', 'ULTIMATE_DESTROY_GOD', 'POISON_WILL', 'FIRE_WILL', 'METEOR_WILL', 'METEOR_GOD', 'BOARD_SHRINK_WILL',
        'BOARD_SHRINK_GOD', 'BOARD_EXECUTOR'] },
    { key: 'flip', label: '反転・奪取', types: [
        'SWAP_WITH_ENEMY', 'TEMPT_WILL', 'CAPTURE_WILL', 'DOUBLE_CHAIN_WILL', 'TRIPLE_CHAIN_WILL', 'QUAD_CHAIN_WILL',
        'INFINITE_CHAIN_WILL', 'TABOO_REVERSE_WILL', 'REVERSE_WILL', 'ULTIMATE_REVERSE_DRAGON', 'INSTANT_HYPERACTIVE_WILL',
        'ZOMBIE_WILL', 'ULTIMATE_HYPERACTIVE_GOD'] },
    { key: 'move', label: '移動', types: [
        'POSITION_SWAP_WILL', 'STRONG_WIND_WILL', 'SUPER_BUOYANCY_WILL', 'BUOYANCY_WILL', 'SUPER_GRAVITY_WILL', 'GRAVITY_WILL',
        'SUPER_ATTRACTION_WILL', 'TELEPORT_WILL', 'CELL_TELEPORT_WILL', 'HYPERACTIVE_WILL', 'EXTREME_HYPERACTIVE_WILL',
        'ULTIMATE_HYPERACTIVE_GOD', 'INSTANT_HYPERACTIVE_WILL', 'ESCAPE_WILL', 'ROBOT_VACUUM_WILL', 'ZOMBIE_WILL',
        'ULTIMATE_REVERSE_DRAGON', 'GLUTTONOUS_WILL', 'WILL_HUNTER_KING'] },
    { key: 'placement', label: '追加配置・連続行動', types: [
        'FREE_PLACEMENT', 'LAST_RESORT', 'DOUBLE_PLACE', 'TRIPLE_PLACE', 'QUAD_PLACE', 'INFINITE_PLACE', 'REINFORCEMENT_WILL',
        'SUPPORT_TROOPS_WILL', 'SNIPER_WILL', 'ULTIMATE_REVERSE_DRAGON', 'ULTIMATE_DESTROY_GOD', 'TIME_STOP_GOD', 'TIME_STOP_DEITY',
        'FATE_WILL'] },
    { key: 'defense', label: '防御・耐性', types: [
        'PROTECTED_NEXT_STONE', 'GHOST_WILL', 'AFTERIMAGE_WILL', 'PERMA_PROTECT_NEXT_STONE', 'REGEN_WILL', 'PROLIFERATION_WILL',
        'GUARD_WILL', 'GUARDIAN_GOD', 'FREEZE_WILL', 'MASS_FREEZE_WILL', 'LIVING_WILL', 'SACRIFICE_WILL', 'WATER_WILL',
        'EXTREME_HYPERACTIVE_WILL', 'HYPERACTIVE_WILL'] },
    { key: 'grow', label: '石を増やす・復活', types: [
        'BREEDING_WILL', 'CLONE_WILL', 'SEED_WILL', 'GRASS_WILL', 'STONE_SALVATION_GOD', 'SALVATION_WILL', 'REINFORCEMENT_WILL',
        'SUPPORT_TROOPS_WILL', 'LIVING_WILL', 'REGEN_WILL', 'PROLIFERATION_WILL', 'LAST_RESORT'] },
    { key: 'board', label: '盤面変形・穴マス', types: [
        'BOARD_EXPANSION_WILL', 'BOARD_EXPANSION_GOD', 'BOARD_SHRINK_WILL', 'BOARD_SHRINK_GOD', 'CELL_TELEPORT_WILL',
        'METEOR_WILL', 'METEOR_GOD', 'CAUSAL_REPLAY_WILL', 'BLOCKADE_WILL', 'BOARD_EXECUTOR', 'POISON_WILL', 'FIRE_WILL'] },
    { key: 'charge', label: '布石', types: [
        'TREASURE_BOX', 'WORK_WILL', 'ULTIMATE_WORK_GOD', 'RIBO_WILL', 'GOLD_STONE', 'SILVER_STONE', 'RAINBOW_STONE',
        'CRYSTAL_STONE', 'EQUALITY_WILL', 'TRAP_WILL'] },
    { key: 'hand', label: '手札・カード妨害', types: [
        'HEAVEN_BLESSING', 'REBUILD_WILL', 'CAPTURE_WILL', 'REVEAL_HAND_WILL', 'OBSERVER_WILL', 'CONDEMN_WILL', 'EXECUTION_WILL',
        'TRAP_WILL', 'LOSS_WILL', 'GLUTTONOUS_WILL', 'SACRIFICE_WILL', 'BOARD_EXECUTOR'] },
    { key: 'special-control', label: '特殊石の操作', types: [
        'EXTEND_LIFE_WILL', 'EXTEND_LIFE_GOD', 'CORROSION_WILL', 'LOSS_WILL', 'MASS_FREEZE_WILL', 'TEMPT_WILL', 'CAPTURE_WILL',
        'REINCARNATION_WILL', 'BOARD_EXECUTOR', 'CHAOS_SUMMON', 'THEORY_INCARNATION'] },
    { key: 'manifest', label: '召喚・顕現', types: ['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL', 'CHAOS_SUMMON'] }
].map(role => Object.freeze({ ...role, types: Object.freeze(role.types.slice()) })));

/** Group keys for one card type, special stone first. */
export function resolveCardRoles(cardType: string, isSpecialStone: boolean): string[] {
    const roles: string[] = isSpecialStone ? [SPECIAL_STONE_ROLE.key] : [];
    for (const role of CARD_ROLE_DEFINITIONS) if (role.types.includes(cardType)) roles.push(role.key);
    return roles;
}

/** Ordered group list shown by the editor. */
export function listCardRoles(): { key: string; label: string }[] {
    return [{ ...SPECIAL_STONE_ROLE }, ...CARD_ROLE_DEFINITIONS.map(({ key, label }) => ({ key, label }))];
}
