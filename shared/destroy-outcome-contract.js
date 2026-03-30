(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.DestroyOutcomeContract = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DESTROY_OUTCOME_KINDS = Object.freeze({
        DESTROYED: 'destroyed',
        REGENERATED: 'regenerated',
        GHOST_BLOCKED: 'ghost_blocked',
        PROLIFERATED: 'proliferated',
        EVADED_MOVE: 'evaded_move'
    });

    const DESTROY_OUTCOME_KIND_ALIASES = Object.freeze({
        destroyed: DESTROY_OUTCOME_KINDS.DESTROYED,
        regenerated: DESTROY_OUTCOME_KINDS.REGENERATED,
        revived: DESTROY_OUTCOME_KINDS.REGENERATED,
        ghost_blocked: DESTROY_OUTCOME_KINDS.GHOST_BLOCKED,
        ghostblocked: DESTROY_OUTCOME_KINDS.GHOST_BLOCKED,
        blocked_by_ghost: DESTROY_OUTCOME_KINDS.GHOST_BLOCKED,
        blockedbyghost: DESTROY_OUTCOME_KINDS.GHOST_BLOCKED,
        proliferated: DESTROY_OUTCOME_KINDS.PROLIFERATED,
        evaded_move: DESTROY_OUTCOME_KINDS.EVADED_MOVE,
        evadedmove: DESTROY_OUTCOME_KINDS.EVADED_MOVE,
        evaded: DESTROY_OUTCOME_KINDS.EVADED_MOVE
    });

    function hasOwn(object, key) {
        return !!object && Object.prototype.hasOwnProperty.call(object, key);
    }

    function cloneStructuredValue(value) {
        if (value === null || typeof value === 'undefined') return value;
        if (Array.isArray(value)) return value.map(cloneStructuredValue);
        if (value && typeof value === 'object') return Object.assign({}, value);
        return value;
    }

    function normalizeDestroyOutcomeKind(kind) {
        const raw = String(kind || '').trim().toLowerCase();
        return raw ? (DESTROY_OUTCOME_KIND_ALIASES[raw] || null) : null;
    }

    function getDestroyOutcomeKind(result) {
        const explicit = normalizeDestroyOutcomeKind(result && result.kind);
        if (explicit) return explicit;
        if (!result || typeof result !== 'object') return null;
        if (result.regenerated === true) return DESTROY_OUTCOME_KINDS.REGENERATED;
        if (result.proliferated === true) return DESTROY_OUTCOME_KINDS.PROLIFERATED;
        if (result.blockedByGhost === true) return DESTROY_OUTCOME_KINDS.GHOST_BLOCKED;
        if (result.evaded === true) return DESTROY_OUTCOME_KINDS.EVADED_MOVE;
        if (result.destroyed === true) return DESTROY_OUTCOME_KINDS.DESTROYED;
        return null;
    }

    function isDestroyOutcomeResolved(result) {
        return getDestroyOutcomeKind(result) !== null;
    }

    function isDestroyOutcomeKind(result, kind) {
        const normalizedKind = normalizeDestroyOutcomeKind(kind);
        return !!normalizedKind && getDestroyOutcomeKind(result) === normalizedKind;
    }

    function createDestroyOutcome(kindOrResult, details) {
        const source = (typeof kindOrResult === 'string')
            ? Object.assign({}, (details && typeof details === 'object') ? details : {}, { kind: kindOrResult })
            : Object.assign({}, (kindOrResult && typeof kindOrResult === 'object') ? kindOrResult : {});
        const kind = normalizeDestroyOutcomeKind(source.kind) || getDestroyOutcomeKind(source);
        const outcome = Object.assign({}, source, {
            destroyed: kind === DESTROY_OUTCOME_KINDS.DESTROYED || source.destroyed === true,
            regenerated: kind === DESTROY_OUTCOME_KINDS.REGENERATED || source.regenerated === true,
            evaded: kind === DESTROY_OUTCOME_KINDS.EVADED_MOVE || source.evaded === true,
            blockedByGhost: kind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED || source.blockedByGhost === true,
            proliferated: kind === DESTROY_OUTCOME_KINDS.PROLIFERATED || source.proliferated === true
        });

        if (kind) outcome.kind = kind;
        else delete outcome.kind;

        if (hasOwn(source, 'from')) outcome.from = cloneStructuredValue(source.from);
        if (hasOwn(source, 'to')) outcome.to = cloneStructuredValue(source.to);
        if (hasOwn(source, 'source')) outcome.source = cloneStructuredValue(source.source);
        else if (hasOwn(source, 'from')) outcome.source = cloneStructuredValue(source.from);
        if (hasOwn(source, 'target')) outcome.target = cloneStructuredValue(source.target);
        if (hasOwn(source, 'destination')) outcome.destination = cloneStructuredValue(source.destination);
        else if (hasOwn(source, 'to')) outcome.destination = cloneStructuredValue(source.to);
        if (hasOwn(source, 'actor')) outcome.actor = cloneStructuredValue(source.actor);
        if (hasOwn(source, 'visual')) outcome.visual = cloneStructuredValue(source.visual);
        return outcome;
    }

    function normalizeDestroyOutcome(result) {
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
