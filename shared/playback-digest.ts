/**
 * @file playback-digest.ts
 * @description Semantic digest for comparing local preview playback with authoritative playback.
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

const StateHash = _require('./state-hash');

function stringOrNull(value: unknown): string | null {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    return String(value);
}

function numberOrNull(value: unknown): number | null {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function readObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normalizePlaybackTargetForDigest(target: unknown): Record<string, unknown> {
    const obj = readObject(target);
    const from = readObject(obj.from);
    const to = readObject(obj.to);
    return {
        row: numberOrNull(obj.row ?? obj.r),
        col: numberOrNull(obj.col),
        toRow: numberOrNull(obj.toRow ?? obj.toR ?? to.row ?? to.r),
        toCol: numberOrNull(obj.toCol ?? to.col),
        fromRow: numberOrNull(obj.fromRow ?? obj.fromR ?? from.row ?? from.r),
        fromCol: numberOrNull(obj.fromCol ?? from.col),
        player: stringOrNull(obj.player),
        owner: stringOrNull(obj.owner),
        cardId: stringOrNull(obj.cardId),
        soundKey: stringOrNull(obj.soundKey),
        special: stringOrNull(obj.special)
    };
}

function normalizePlaybackEventForDigest(event: unknown): Record<string, unknown> {
    const obj = readObject(event);
    const targets = Array.isArray(obj.targets)
        ? obj.targets.map((target) => normalizePlaybackTargetForDigest(target))
        : [];
    return {
        type: stringOrNull(obj.type),
        phase: numberOrNull(obj.phase),
        actionId: stringOrNull(obj.actionId),
        effectBlockId: stringOrNull(obj.effectBlockId),
        sequenceIndex: numberOrNull(obj.sequenceIndex),
        plyIndex: numberOrNull(obj.plyIndex ?? obj.stepIndex),
        row: numberOrNull(obj.row ?? obj.r),
        col: numberOrNull(obj.col),
        toRow: numberOrNull(obj.toRow ?? obj.toR),
        toCol: numberOrNull(obj.toCol),
        cause: stringOrNull(obj.cause),
        reason: stringOrNull(obj.reason),
        targets
    };
}

function normalizePlaybackEventsForDigest(playbackEvents: unknown[]): Record<string, unknown>[] {
    return (Array.isArray(playbackEvents) ? playbackEvents : [])
        .map((event) => normalizePlaybackEventForDigest(event));
}

function computePlaybackDigest(playbackEvents: unknown[]): string {
    const normalized = normalizePlaybackEventsForDigest(playbackEvents);
    return StateHash.computeStableHash(normalized);
}

export = {
    normalizePlaybackEventsForDigest,
    computePlaybackDigest
};
