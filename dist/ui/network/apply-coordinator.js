"use strict";
/**
 * @file apply-coordinator.ts
 * @description Network snapshot apply coordination
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function normalizeSnapshotVersion(value) {
    return Number.isFinite(Number(value))
        ? Number(value)
        : null;
}
function shouldApplyPublishResponseSnapshot(entry, snapshotVersion, hasNewerQueuedPublish) {
    if (!entry)
        return false;
    if (typeof hasNewerQueuedPublish === 'function' && hasNewerQueuedPublish(entry.sequence) === true) {
        return false;
    }
    if (entry.selfSnapshotReceived !== true)
        return true;
    const responseVersion = snapshotVersion;
    const selfSnapshotVersion = normalizeSnapshotVersion(entry.selfSnapshotVersion);
    if (responseVersion === null)
        return false;
    if (selfSnapshotVersion === null)
        return false;
    return responseVersion > selfSnapshotVersion;
}
function shouldApplyTrackedPublishSnapshot(entry, snapshotVersion, source, options) {
    if (!entry)
        return true;
    const opts = (options && typeof options === 'object') ? options : {};
    const sourceKey = typeof source === 'string' ? source : '';
    const normalizedSnapshotVersion = snapshotVersion;
    const appliedVersion = normalizeSnapshotVersion(entry.appliedVersion);
    if (normalizedSnapshotVersion !== null && appliedVersion !== null && normalizedSnapshotVersion <= appliedVersion) {
        return false;
    }
    if (sourceKey === 'publish_response') {
        return shouldApplyPublishResponseSnapshot(entry, normalizedSnapshotVersion, opts.hasNewerQueuedPublish);
    }
    if (sourceKey === 'stream'
        && typeof opts.hasNewerQueuedPublish === 'function'
        && opts.hasNewerQueuedPublish(entry.sequence) === true) {
        return false;
    }
    return true;
}
function applySnapshotThroughCoordinator(snapshot, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const trackedPublish = opts.trackedPublish || null;
    const source = typeof opts.source === 'string' ? opts.source : '';
    const applyOptions = (opts.applyOptions && typeof opts.applyOptions === 'object')
        ? opts.applyOptions
        : {};
    const getSnapshotStateVersion = typeof opts.getSnapshotStateVersion === 'function'
        ? opts.getSnapshotStateVersion
        : function () { return null; };
    const applySnapshot = typeof opts.applySnapshot === 'function'
        ? opts.applySnapshot
        : null;
    if (!applySnapshot) {
        throw new Error('applySnapshot_required');
    }
    const snapshotVersion = getSnapshotStateVersion(snapshot);
    if (!shouldApplyTrackedPublishSnapshot(trackedPublish, snapshotVersion, source, {
        hasNewerQueuedPublish: opts.hasNewerQueuedPublish
    })) {
        return false;
    }
    const applied = applySnapshot(snapshot, applyOptions);
    if (applied && trackedPublish && typeof opts.markTrackedPublishSnapshotApplied === 'function') {
        opts.markTrackedPublishSnapshotApplied(trackedPublish, snapshot, source);
    }
    if (applied && snapshotVersion !== null && typeof opts.onAppliedVersion === 'function') {
        opts.onAppliedVersion(snapshotVersion);
    }
    return applied;
}
module.exports = {
    shouldApplyTrackedPublishSnapshot,
    applySnapshotThroughCoordinator
};
//# sourceMappingURL=apply-coordinator.js.map