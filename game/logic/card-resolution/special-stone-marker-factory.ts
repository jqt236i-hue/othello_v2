/**
 * @file special-stone-marker-factory.ts
 * @description Builds marker payloads for special stones spawned from card definitions.
 */

const FALLBACK_TURNS = Object.freeze({
    PROTECTED_NEXT_STONE: 1,
    PERMA_PROTECT_NEXT_STONE: 20,
    GHOST_WILL: 8,
    BREEDING_WILL: 5,
    PROLIFERATION_WILL: 10,
    ULTIMATE_REVERSE_DRAGON: 8,
    ULTIMATE_DESTROY_GOD: 6,
    STONE_SALVATION_GOD: 12,
    SNIPER_WILL: 6,
    DESTROY_DRAGON_WILL: 3,
    LIGHTNING_WILL: 6,
    METEOR_GOD: 6,
    TIME_STOP_GOD: 3,
    WILL_HUNTER_KING: 8,
    ROBOT_VACUUM_WILL: 4,
    ULTIMATE_HYPERACTIVE_GOD: 12,
    WORK_WILL: 5
});

function normalizeType(value: any): string {
    return String(value || '').trim().toUpperCase();
}

function readPositiveInt(value: any, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function readSpecialStoneInfoInt(deps: any, type: string, key: string, fallback: number): number {
    const registry = deps && deps.SpecialStoneRegistry;
    const info = registry && typeof registry.getSpecialStoneInfo === 'function'
        ? registry.getSpecialStoneInfo(type)
        : null;
    const n = Number(info && info[key]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function readRegistryMarkerType(cardType: string, deps: any): string | null {
    const registry = deps && deps.SpecialStoneRegistry;
    return registry && typeof registry.getMarkerTypeForSpecialStoneCard === 'function'
        ? registry.getMarkerTypeForSpecialStoneCard(cardType)
        : null;
}

function buildMarkerDataForCardType(cardType: any, deps: any = {}): any | null {
    const type = normalizeType(cardType);
    const constants = deps && deps.constants ? deps.constants : {};
    switch (type) {
        case 'PROTECTED_NEXT_STONE':
            return {
                type: readRegistryMarkerType(type, deps) || 'PROTECTED',
                expiresForPlayer: deps && deps.ownerKey ? deps.ownerKey : null
            };
        case 'PERMA_PROTECT_NEXT_STONE':
            return {
                type: readRegistryMarkerType(type, deps) || 'PERMA_PROTECTED',
                strongWillPromotionOwnerTurnStarts: 0,
                strongWillPromotionThreshold: readPositiveInt(
                    constants.STRONG_WILL_PROMOTION_OWNER_TURNS,
                    FALLBACK_TURNS.PERMA_PROTECT_NEXT_STONE
                )
            };
        case 'GHOST_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'GHOST',
                remainingOwnerTurns: readPositiveInt(constants.GHOST_WILL_TURNS, FALLBACK_TURNS.GHOST_WILL)
            };
        case 'AFTERIMAGE_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'AFTERIMAGE_WILL',
                flipEvadeRemaining: readPositiveInt(constants.AFTERIMAGE_WILL_FLIP_EVADE_LIMIT, 1),
                destroyEvadeRemaining: readPositiveInt(constants.AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT, 1)
            };
        case 'REGEN_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'REGEN',
                regenRemaining: 3
            };
        case 'BREEDING_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'BREEDING',
                remainingOwnerTurns: readPositiveInt(constants.BREEDING_WILL_TURNS, FALLBACK_TURNS.BREEDING_WILL)
            };
        case 'PROLIFERATION_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'PROLIFERATION',
                remainingOwnerTurns: readPositiveInt(constants.PROLIFERATION_WILL_TURNS, FALLBACK_TURNS.PROLIFERATION_WILL)
            };
        case 'ULTIMATE_REVERSE_DRAGON':
            return {
                type: readRegistryMarkerType(type, deps) || 'DRAGON',
                remainingOwnerTurns: readPositiveInt(constants.ULTIMATE_DRAGON_TURNS, FALLBACK_TURNS.ULTIMATE_REVERSE_DRAGON)
            };
        case 'ULTIMATE_DESTROY_GOD':
            return {
                type: readRegistryMarkerType(type, deps) || 'ULTIMATE_DESTROY_GOD',
                remainingOwnerTurns: readPositiveInt(constants.ULTIMATE_DESTROY_GOD_TURNS, FALLBACK_TURNS.ULTIMATE_DESTROY_GOD)
            };
        case 'STONE_SALVATION_GOD':
            return {
                type: readRegistryMarkerType(type, deps) || 'STONE_SALVATION_GOD',
                remainingOwnerTurns: readPositiveInt(constants.STONE_SALVATION_GOD_TURNS, FALLBACK_TURNS.STONE_SALVATION_GOD)
            };
        case 'SNIPER_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'SNIPER',
                remainingOwnerTurns: readPositiveInt(constants.SNIPER_WILL_TURNS, FALLBACK_TURNS.SNIPER_WILL)
            };
        case 'DESTROY_DRAGON':
        case 'DESTROY_DRAGON_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'DESTROY_DRAGON',
                remainingOwnerTurns: readPositiveInt(constants.DESTROY_DRAGON_TURNS, FALLBACK_TURNS.DESTROY_DRAGON_WILL)
            };
        case 'LIGHTNING_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'LIGHTNING',
                remainingOwnerTurns: readPositiveInt(constants.LIGHTNING_WILL_TURNS, FALLBACK_TURNS.LIGHTNING_WILL)
            };
        case 'METEOR_GOD':
            return {
                type: readRegistryMarkerType(type, deps) || 'METEOR_GOD',
                remainingOwnerTurns: readPositiveInt(constants.METEOR_GOD_TURNS, FALLBACK_TURNS.METEOR_GOD)
            };
        case 'TIME_STOP_GOD':
            return {
                type: readRegistryMarkerType(type, deps) || 'TIME_STOP',
                remainingOwnerTurns: readPositiveInt(constants.TIME_STOP_GOD_TURNS, FALLBACK_TURNS.TIME_STOP_GOD)
            };
        case 'WILL_HUNTER_KING':
            return {
                type: readRegistryMarkerType(type, deps) || 'WILL_HUNTER_KING',
                remainingOwnerTurns: readPositiveInt(constants.WILL_HUNTER_KING_TURNS, FALLBACK_TURNS.WILL_HUNTER_KING),
                flipEvadeRemaining: readSpecialStoneInfoInt(deps, 'WILL_HUNTER_KING', 'tagFlipEvadeDefault', 2),
                destroyEvadeRemaining: readSpecialStoneInfoInt(deps, 'WILL_HUNTER_KING', 'tagDestroyEvadeDefault', 2)
            };
        case 'HYPERACTIVE_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'HYPERACTIVE',
                flipEvadeRemaining: readPositiveInt(constants.HYPERACTIVE_FLIP_EVADE_LIMIT, 1)
            };
        case 'EXTREME_HYPERACTIVE_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'EXTREME_HYPERACTIVE',
                flipEvadeRemaining: readPositiveInt(constants.EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT, 5),
                destroyEvadeRemaining: readPositiveInt(constants.EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT, 5)
            };
        case 'ESCAPE_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'ESCAPE_HYPERACTIVE',
                flipEvadeRemaining: readPositiveInt(constants.ESCAPE_HYPERACTIVE_FLIP_EVADE_LIMIT, 1)
            };
        case 'ROBOT_VACUUM':
        case 'ROBOT_VACUUM_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'ROBOT_VACUUM',
                remainingOwnerTurns: readPositiveInt(constants.ROBOT_VACUUM_TURNS, FALLBACK_TURNS.ROBOT_VACUUM_WILL)
            };
        case 'GLUTTONOUS_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'GLUTTONOUS',
                gluttonousMissStreak: 0
            };
        case 'ULTIMATE_HYPERACTIVE_GOD':
            return {
                type: readRegistryMarkerType(type, deps) || 'ULTIMATE_HYPERACTIVE',
                remainingOwnerTurns: readPositiveInt(constants.ULTIMATE_HYPERACTIVE_TURNS, FALLBACK_TURNS.ULTIMATE_HYPERACTIVE_GOD),
                flipEvadeRemaining: readPositiveInt(constants.ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT, 5),
                destroyEvadeRemaining: readPositiveInt(constants.ULTIMATE_HYPERACTIVE_DESTROY_EVADE_LIMIT, 2)
            };
        case 'WORK_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'WORK',
                ownerColor: deps && deps.ownerKey ? deps.ownerKey : null,
                workStage: 0,
                remainingOwnerTurns: readPositiveInt(constants.WORK_WILL_TURNS, FALLBACK_TURNS.WORK_WILL)
            };
        default:
            return null;
    }
}

function buildTheoryIncarnationSpawnEntry(cardDef: any, deps: any = {}): any | null {
    if (!cardDef || typeof cardDef !== 'object') return null;
    const cardType = normalizeType(cardDef.type);
    const markerData = buildMarkerDataForCardType(cardType, deps);
    if (!markerData) return null;
    const registry = deps && deps.SpecialStoneRegistry;
    if (
        registry &&
        typeof registry.isTheoryIncarnationSpawnCandidate === 'function' &&
        registry.isTheoryIncarnationSpawnCandidate(markerData.type, markerData) !== true
    ) {
        return null;
    }
    const cost = Number(cardDef.cost);
    if (!Number.isFinite(cost) || cost <= 0) return null;
    return {
        cardId: String(cardDef.id || ''),
        cardType,
        cardCost: Math.floor(cost),
        markerData: {
            ...markerData,
            sourceType: 'THEORY_INCARNATION',
            sourceCardId: String(cardDef.id || ''),
            sourceCardType: cardType
        }
    };
}

function buildTheoryIncarnationSpawnTable(cardDefs: any, deps: any = {}): any[] {
    const defs = Array.isArray(cardDefs) ? cardDefs : [];
    return defs
        .map((def) => buildTheoryIncarnationSpawnEntry(def, deps))
        .filter(Boolean);
}

export = {
    buildMarkerDataForCardType,
    buildTheoryIncarnationSpawnEntry,
    buildTheoryIncarnationSpawnTable
};
