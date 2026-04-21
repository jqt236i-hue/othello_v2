(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root || (typeof globalThis !== 'undefined' ? globalThis : this));
    } else {
        root.NetworkApplyCoordinatorModule = factory(root);
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function normalizeSnapshotVersion(value) {
        return Number.isFinite(Number(value))
            ? Number(value)
            : null;
    }

    function shouldApplyPublishResponseSnapshot(entry, snapshotVersion, hasNewerQueuedPublish) {
        if (!entry) return false;
        if (typeof hasNewerQueuedPublish === 'function' && hasNewerQueuedPublish(entry.sequence) === true) {
            return false;
        }
        if (entry.selfSnapshotReceived !== true) return true;

        var responseVersion = normalizeSnapshotVersion(snapshotVersion);
        var selfSnapshotVersion = normalizeSnapshotVersion(entry.selfSnapshotVersion);
        if (responseVersion === null) return false;
        if (selfSnapshotVersion === null) return false;
        return responseVersion > selfSnapshotVersion;
    }

    function shouldApplyTrackedPublishSnapshot(entry, snapshotVersion, source, options) {
        if (!entry) return true;

        var opts = (options && typeof options === 'object') ? options : {};
        var sourceKey = typeof source === 'string' ? source : '';
        var normalizedSnapshotVersion = normalizeSnapshotVersion(snapshotVersion);
        var appliedVersion = normalizeSnapshotVersion(entry.appliedVersion);
        if (normalizedSnapshotVersion !== null && appliedVersion !== null && normalizedSnapshotVersion <= appliedVersion) {
            return false;
        }
        if (sourceKey === 'publish_response') {
            return shouldApplyPublishResponseSnapshot(entry, normalizedSnapshotVersion, opts.hasNewerQueuedPublish);
        }
        if (
            sourceKey === 'stream'
            && typeof opts.hasNewerQueuedPublish === 'function'
            && opts.hasNewerQueuedPublish(entry.sequence) === true
        ) {
            return false;
        }
        return true;
    }

    function applySnapshotThroughCoordinator(snapshot, options) {
        var opts = (options && typeof options === 'object') ? options : {};
        var trackedPublish = opts.trackedPublish || null;
        var source = typeof opts.source === 'string' ? opts.source : '';
        var applyOptions = (opts.applyOptions && typeof opts.applyOptions === 'object')
            ? opts.applyOptions
            : {};
        var getSnapshotStateVersion = typeof opts.getSnapshotStateVersion === 'function'
            ? opts.getSnapshotStateVersion
            : function () { return null; };
        var applySnapshot = typeof opts.applySnapshot === 'function'
            ? opts.applySnapshot
            : null;
        if (!applySnapshot) {
            throw new Error('applySnapshot_required');
        }

        var snapshotVersion = getSnapshotStateVersion(snapshot);
        if (!shouldApplyTrackedPublishSnapshot(trackedPublish, snapshotVersion, source, {
            hasNewerQueuedPublish: opts.hasNewerQueuedPublish
        })) {
            return false;
        }

        var applied = applySnapshot(snapshot, applyOptions);
        if (applied && trackedPublish && typeof opts.markTrackedPublishSnapshotApplied === 'function') {
            opts.markTrackedPublishSnapshotApplied(trackedPublish, snapshot, source);
        }
        if (applied && snapshotVersion !== null && typeof opts.onAppliedVersion === 'function') {
            opts.onAppliedVersion(snapshotVersion);
        }
        return applied;
    }

    return {
        shouldApplyTrackedPublishSnapshot: shouldApplyTrackedPublishSnapshot,
        applySnapshotThroughCoordinator: applySnapshotThroughCoordinator
    };
}));
