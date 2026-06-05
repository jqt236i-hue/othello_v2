/**
 * @file shared-card-heuristics.ts
 * @description Shared card heuristics for CPU and UI
 */

(function (root: any, factory: () => any) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SharedCardHeuristics = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    const DEFAULT_CORNER_RECOVERY_CARD_TYPES: Set<string> = new Set([
        'DESTROY_ONE_STONE',
        'SWAP_WITH_ENEMY',
        'POSITION_SWAP_WILL',
        'STRONG_WIND_WILL',
        'BUOYANCY_WILL',
        'GRAVITY_WILL',
        'TABOO_REVERSE_WILL',
        'TEMPT_WILL',
        'METEOR_WILL',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_REVERSE_DRAGON'
    ]);

    const DEFAULT_CORNER_HOLD_CARD_TYPES: Set<string> = new Set([
        'PROTECTED_NEXT_STONE',
        'PERMA_PROTECT_NEXT_STONE',
        'GUARD_WILL',
        'GUARDIAN_GOD',
        'STONE_SALVATION_GOD',
        'REGEN_WILL',
        'BLOCKADE_WILL'
    ]);

    const DEFAULT_CHARGE_RAMP_CARD_TYPES: Set<string> = new Set([
        'TREASURE_BOX',
        'GOLD_STONE',
        'RAINBOW_STONE',
        'SILVER_STONE',
        'CRYSTAL_STONE',

        'PLUNDER_WILL',
        'WORK_WILL'
    ]);

    function normalizeType(cardType: unknown): string {
        return String(cardType || '').trim();
    }

    function createExtendedTypeSet(baseTypes: Iterable<unknown> | null | undefined, extraTypes: Iterable<unknown> | null | undefined): Set<string> {
        const out = new Set<string>();

        const addTypes = (values: Iterable<unknown> | null | undefined) => {
            if (!values) return;
            for (const value of values) {
                const normalized = normalizeType(value);
                if (normalized) out.add(normalized);
            }
        };

        addTypes(baseTypes);
        addTypes(extraTypes);
        return out;
    }

    function isRecoveryCardType(cardType: unknown): boolean {
        const type = normalizeType(cardType);
        return !!type && DEFAULT_CORNER_RECOVERY_CARD_TYPES.has(type);
    }

    function isHoldCardType(cardType: unknown): boolean {
        const type = normalizeType(cardType);
        return !!type && DEFAULT_CORNER_HOLD_CARD_TYPES.has(type);
    }

    function isChargeRampCardType(cardType: unknown): boolean {
        const type = normalizeType(cardType);
        return !!type && DEFAULT_CHARGE_RAMP_CARD_TYPES.has(type);
    }

    return {
        DEFAULT_CORNER_RECOVERY_CARD_TYPES,
        DEFAULT_CORNER_HOLD_CARD_TYPES,
        DEFAULT_CHARGE_RAMP_CARD_TYPES,
        createExtendedTypeSet,
        isRecoveryCardType,
        isCornerRecoveryCardType: isRecoveryCardType,
        isHoldCardType,
        isCornerHoldCardType: isHoldCardType,
        isChargeRampCardType
    };
}));
