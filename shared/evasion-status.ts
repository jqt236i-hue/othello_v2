const EvasionStatus: any = (function () {
    'use strict';

    interface EvasionProfile {
        flipDefault?: number;
        destroyDefault?: number;
        visualFlipDefault?: number;
        flipCause?: string;
        flipMoveReason?: string;
        requiresActiveDuration?: boolean;
        pruneWhenBothDepleted?: boolean;
    }

    interface EvasionProfileMap {
        [key: string]: Readonly<EvasionProfile>;
    }

    interface EvasionReadOptions {
        mode?: 'runtime' | 'info' | 'visual';
    }

    interface EvasionLike {
        type?: unknown;
        data?: {
            type?: unknown;
            remainingOwnerTurns?: unknown;
            instantPlacementOnly?: boolean;
            flipEvadeRemaining?: unknown;
            destroyEvadeRemaining?: unknown;
        };
        remainingOwnerTurns?: unknown;
        instantPlacementOnly?: boolean;
        flipEvadeRemaining?: unknown;
        destroyEvadeRemaining?: unknown;
    }

    const EVASION_TYPE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
        EXTREME_HYPERACTIVE_WILL: 'EXTREME_HYPERACTIVE',
        ULTIMATE_HYPERACTIVE_GOD: 'ULTIMATE_HYPERACTIVE'
    });

    const EVASION_PROFILES: Readonly<EvasionProfileMap> = Object.freeze({
        HYPERACTIVE: Object.freeze({
            flipDefault: 1,
            flipCause: 'HYPERACTIVE',
            flipMoveReason: 'hyperactive_flip_evade_move'
        }),
        ESCAPE_HYPERACTIVE: Object.freeze({
            flipDefault: 1,
            flipCause: 'ESCAPE_HYPERACTIVE',
            flipMoveReason: 'escape_hyperactive_flip_evade_move'
        }),
        EXTREME_HYPERACTIVE: Object.freeze({
            flipDefault: 5,
            destroyDefault: 5,
            visualFlipDefault: 5,
            flipCause: 'EXTREME_HYPERACTIVE_WILL',
            flipMoveReason: 'extreme_hyperactive_flip_evade_move'
        }),
        ULTIMATE_HYPERACTIVE: Object.freeze({
            flipDefault: 5,
            destroyDefault: 2,
            visualFlipDefault: 5,
            flipCause: 'ULTIMATE_HYPERACTIVE_GOD',
            flipMoveReason: 'ultimate_hyperactive_flip_evade_move',
            requiresActiveDuration: true
        }),
        AFTERIMAGE_WILL: Object.freeze({
            flipDefault: 6,
            destroyDefault: 6,
            flipCause: 'AFTERIMAGE_WILL',
            flipMoveReason: 'afterimage_will_flip_evade_move',
            pruneWhenBothDepleted: true
        }),
        WILL_HUNTER_KING: Object.freeze({
            flipDefault: 2,
            destroyDefault: 2,
            flipCause: 'WILL_HUNTER_KING',
            flipMoveReason: 'will_hunter_king_flip_evade_move'
        })
    });

    function toCounterOrNull(value: unknown): number | null {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return Math.max(0, Math.trunc(n));
    }

    function resolveEvasionData(source: unknown): Record<string, unknown> | null {
        if (!source || typeof source !== 'object') return null;
        const candidate = source as EvasionLike;
        if (candidate.data && typeof candidate.data === 'object') {
            return candidate.data as Record<string, unknown>;
        }
        return candidate as unknown as Record<string, unknown>;
    }

    function normalizeEvasionType(rawTypeOrSource: unknown): string | null {
        const source = resolveEvasionData(rawTypeOrSource);
        const rawType = source && Object.prototype.hasOwnProperty.call(source, 'type')
            ? source.type
            : rawTypeOrSource;
        if (rawType === null || typeof rawType === 'undefined') return null;
        const upper = String(rawType).trim().toUpperCase();
        if (!upper) return null;
        return EVASION_TYPE_ALIASES[upper] || upper;
    }

    function getEvasionProfile(rawTypeOrSource: unknown): Readonly<EvasionProfile> | null {
        const type = normalizeEvasionType(rawTypeOrSource);
        if (!type) return null;
        return EVASION_PROFILES[type] || null;
    }

    function getFlipEvadeDefault(rawTypeOrSource: unknown, options: EvasionReadOptions = {}): number | null {
        const profile = getEvasionProfile(rawTypeOrSource);
        if (!profile) return null;
        if (options.mode === 'visual') {
            return toCounterOrNull(profile.visualFlipDefault);
        }
        return toCounterOrNull(profile.flipDefault);
    }

    function getDestroyEvadeDefault(rawTypeOrSource: unknown, options: EvasionReadOptions = {}): number | null {
        const profile = getEvasionProfile(rawTypeOrSource);
        if (!profile) return null;
        if (options.mode === 'visual') return null;
        return toCounterOrNull(profile.destroyDefault);
    }

    function readFlipEvadeRemaining(rawTypeOrSource: unknown, options: EvasionReadOptions = {}): number | null {
        const source = resolveEvasionData(rawTypeOrSource);
        const remaining = toCounterOrNull(source && source.flipEvadeRemaining);
        if (remaining !== null) return remaining;
        return getFlipEvadeDefault(rawTypeOrSource, options);
    }

    function readDestroyEvadeRemaining(rawTypeOrSource: unknown, options: EvasionReadOptions = {}): number | null {
        const source = resolveEvasionData(rawTypeOrSource);
        const remaining = toCounterOrNull(source && source.destroyEvadeRemaining);
        if (remaining !== null) return remaining;
        return getDestroyEvadeDefault(rawTypeOrSource, options);
    }

    function canUseFlipEvade(rawTypeOrSource: unknown): boolean {
        const profile = getEvasionProfile(rawTypeOrSource);
        if (!profile) return false;

        const source = resolveEvasionData(rawTypeOrSource);
        if (source && source.instantPlacementOnly === true) return false;

        if (profile.requiresActiveDuration === true) {
            const remainingOwnerTurns = toCounterOrNull(source && source.remainingOwnerTurns);
            if (remainingOwnerTurns !== null && remainingOwnerTurns <= 0) return false;
        }

        const remaining = readFlipEvadeRemaining(rawTypeOrSource);
        return remaining !== null && remaining > 0;
    }

    function consumeFlipEvade(rawTypeOrSource: unknown): number | null {
        const source = resolveEvasionData(rawTypeOrSource);
        if (!source) return null;
        const remaining = readFlipEvadeRemaining(source);
        if (remaining === null) return null;
        const after = Math.max(0, remaining - 1);
        source.flipEvadeRemaining = after;
        return after;
    }

    function consumeDestroyEvade(rawTypeOrSource: unknown): number | null {
        const source = resolveEvasionData(rawTypeOrSource);
        if (!source) return null;
        const remaining = readDestroyEvadeRemaining(source);
        if (remaining === null) return null;
        const after = Math.max(0, remaining - 1);
        source.destroyEvadeRemaining = after;
        return after;
    }

    function shouldPruneEvasionMarker(rawTypeOrSource: unknown): boolean {
        const profile = getEvasionProfile(rawTypeOrSource);
        if (!profile || profile.pruneWhenBothDepleted !== true) return false;
        const flipRemaining = readFlipEvadeRemaining(rawTypeOrSource) || 0;
        const destroyRemaining = readDestroyEvadeRemaining(rawTypeOrSource) || 0;
        return flipRemaining <= 0 && destroyRemaining <= 0;
    }

    function getFlipEvadeCause(rawTypeOrSource: unknown): string | null {
        const profile = getEvasionProfile(rawTypeOrSource);
        return profile && profile.flipCause ? profile.flipCause : null;
    }

    function getFlipEvadeMoveReason(rawTypeOrSource: unknown): string | null {
        const profile = getEvasionProfile(rawTypeOrSource);
        return profile && profile.flipMoveReason ? profile.flipMoveReason : null;
    }

    return {
        EVASION_PROFILES,
        normalizeEvasionType,
        getEvasionProfile,
        toCounterOrNull,
        getFlipEvadeDefault,
        getDestroyEvadeDefault,
        readFlipEvadeRemaining,
        readDestroyEvadeRemaining,
        canUseFlipEvade,
        consumeFlipEvade,
        consumeDestroyEvade,
        shouldPruneEvasionMarker,
        getFlipEvadeCause,
        getFlipEvadeMoveReason
    };
})();

export = EvasionStatus;
