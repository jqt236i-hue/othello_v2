/**
 * @file destroy-outcome-contract.ts
 * @description Destroy outcome contract types and utilities
 */

(function (root: any, factory: () => any) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.DestroyOutcomeContract = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DESTROY_OUTCOME_KINDS: Record<string, string> = Object.freeze({
        DESTROYED: 'destroyed',
        REGENERATED: 'regenerated',
        LIVING_WILL_RESTORED: 'living_will_restored',
        GHOST_BLOCKED: 'ghost_blocked',
        PROLIFERATED: 'proliferated',
        EVADED_MOVE: 'evaded_move'
    });

    const DESTROY_OUTCOME_KIND_ALIASES: Record<string, string> = Object.freeze({
        destroyed: DESTROY_OUTCOME_KINDS.DESTROYED,
        regenerated: DESTROY_OUTCOME_KINDS.REGENERATED,
        revived: DESTROY_OUTCOME_KINDS.REGENERATED,
        living_will_restored: DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED,
        livingwillrestored: DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED,
        living_will: DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED,
        livingwill: DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED,
        ghost_blocked: DESTROY_OUTCOME_KINDS.GHOST_BLOCKED,
        ghostblocked: DESTROY_OUTCOME_KINDS.GHOST_BLOCKED,
        blocked_by_ghost: DESTROY_OUTCOME_KINDS.GHOST_BLOCKED,
        blockedbyghost: DESTROY_OUTCOME_KINDS.GHOST_BLOCKED,
        proliferated: DESTROY_OUTCOME_KINDS.PROLIFERATED,
        evaded_move: DESTROY_OUTCOME_KINDS.EVADED_MOVE,
        evadedmove: DESTROY_OUTCOME_KINDS.EVADED_MOVE,
        evaded: DESTROY_OUTCOME_KINDS.EVADED_MOVE
    });

    function hasOwn(object: Record<string, unknown> | null, key: string): boolean {
        return !!object && Object.prototype.hasOwnProperty.call(object, key);
    }

    function cloneStructuredValue(value: unknown): unknown {
        if (value === null || typeof value === 'undefined') return value;
        if (Array.isArray(value)) return value.map(cloneStructuredValue);
        if (value && typeof value === 'object') return Object.assign({}, value);
        return value;
    }

    function normalizeDestroyOutcomeKind(kind: unknown): string | null {
        const raw = String(kind || '').trim().toLowerCase();
        return raw ? (DESTROY_OUTCOME_KIND_ALIASES[raw] || null) : null;
    }

    function getDestroyOutcomeKind(result: Record<string, unknown> | null): string | null {
        const explicit = normalizeDestroyOutcomeKind(result && result.kind);
        if (explicit) return explicit;
        if (!result || typeof result !== 'object') return null;
        if (result.livingWillRevived === true) return DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED;
        if (result.regenerated === true) return DESTROY_OUTCOME_KINDS.REGENERATED;
        if (result.proliferated === true) return DESTROY_OUTCOME_KINDS.PROLIFERATED;
        if (result.blockedByGhost === true) return DESTROY_OUTCOME_KINDS.GHOST_BLOCKED;
        if (result.evaded === true) return DESTROY_OUTCOME_KINDS.EVADED_MOVE;
        if (result.destroyed === true) return DESTROY_OUTCOME_KINDS.DESTROYED;
        return null;
    }

    function isDestroyOutcomeResolved(result: Record<string, unknown> | null): boolean {
        return getDestroyOutcomeKind(result) !== null;
    }

    function isDestroyOutcomeKind(result: Record<string, unknown> | null, kind: unknown): boolean {
        const normalizedKind = normalizeDestroyOutcomeKind(kind);
        return !!normalizedKind && getDestroyOutcomeKind(result) === normalizedKind;
    }

    function createDestroyOutcome(kindOrResult: unknown, details?: unknown): Record<string, unknown> {
        const source = (typeof kindOrResult === 'string')
            ? Object.assign({}, (details && typeof details === 'object') ? details : {}, { kind: kindOrResult })
            : Object.assign({}, (kindOrResult && typeof kindOrResult === 'object') ? kindOrResult : {});
        const kind = normalizeDestroyOutcomeKind((source as Record<string, unknown>).kind) || getDestroyOutcomeKind(source as Record<string, unknown>);
        const outcome: Record<string, unknown> = Object.assign({}, source, {
            destroyed: kind === DESTROY_OUTCOME_KINDS.DESTROYED || (source as Record<string, unknown>).destroyed === true,
            regenerated: kind === DESTROY_OUTCOME_KINDS.REGENERATED || (source as Record<string, unknown>).regenerated === true,
            livingWillRevived: kind === DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED || (source as Record<string, unknown>).livingWillRevived === true,
            evaded: kind === DESTROY_OUTCOME_KINDS.EVADED_MOVE || (source as Record<string, unknown>).evaded === true,
            blockedByGhost: kind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED || (source as Record<string, unknown>).blockedByGhost === true,
            proliferated: kind === DESTROY_OUTCOME_KINDS.PROLIFERATED || (source as Record<string, unknown>).proliferated === true
        });

        if (kind) outcome.kind = kind;
        else delete outcome.kind;

        const src = source as Record<string, unknown>;
        if (hasOwn(src, 'from')) outcome.from = cloneStructuredValue(src.from);
        if (hasOwn(src, 'to')) outcome.to = cloneStructuredValue(src.to);
        if (hasOwn(src, 'source')) outcome.source = cloneStructuredValue(src.source);
        else if (hasOwn(src, 'from')) outcome.source = cloneStructuredValue(src.from);
        if (hasOwn(src, 'target')) outcome.target = cloneStructuredValue(src.target);
        if (hasOwn(src, 'destination')) outcome.destination = cloneStructuredValue(src.destination);
        else if (hasOwn(src, 'to')) outcome.destination = cloneStructuredValue(src.to);
        if (hasOwn(src, 'actor')) outcome.actor = cloneStructuredValue(src.actor);
        if (hasOwn(src, 'visual')) outcome.visual = cloneStructuredValue(src.visual);
        return outcome;
    }

    function normalizeDestroyOutcome(result: unknown): Record<string, unknown> {
        return createDestroyOutcome(result);
    }

    return {
        DESTROY_OUTCOME_KINDS,
        normalizeDestroyOutcomeKind,
        getDestroyOutcomeKind,
        isDestroyOutcomeResolved,
        isDestroyOutcomeKind,
        createDestroyOutcome,
        normalizeDestroyOutcome
    };
}));