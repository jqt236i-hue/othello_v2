"use strict";
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let CommentaryContextHelpers = null;
        try {
            CommentaryContextHelpers = require('./commentary-context-helpers');
        }
        catch (e) { /* ignore */ }
        module.exports = factory(CommentaryContextHelpers);
    }
    else {
        root.CommentaryRuntimeHelpers = factory(root.CommentaryContextHelpers || null);
    }
}(typeof self !== 'undefined' ? self : this, function (CommentaryContextHelpers) {
    'use strict';
    function normalizePlayerKey(value, fallbackKey) {
        try {
            if (CommentaryContextHelpers &&
                typeof CommentaryContextHelpers.normalizePlayerKey === 'function') {
                return CommentaryContextHelpers.normalizePlayerKey(value, fallbackKey);
            }
        }
        catch (e) { /* ignore */ }
        if (value === 'white' || value === -1 || value === '-1')
            return 'white';
        if (value === 'black' || value === 1 || value === '1')
            return 'black';
        return fallbackKey === 'white' ? 'white' : 'black';
    }
    function hasCommentaryRuntime(runtime) {
        return !!(runtime && typeof runtime.requestCommentary === 'function');
    }
    function resolveFromGlobal(globalName, rootRef) {
        const candidates = [];
        if (rootRef)
            candidates.push(rootRef);
        try {
            if (typeof globalThis !== 'undefined' && globalThis && globalThis !== rootRef) {
                candidates.push(globalThis);
            }
        }
        catch (e) { /* ignore */ }
        for (const candidate of candidates) {
            try {
                const resolved = candidate && candidate[globalName];
                if (resolved)
                    return resolved;
            }
            catch (e) { /* ignore */ }
        }
        return null;
    }
    function resolveCommentaryRuntimeFromGlobal(rootRef) {
        const runtime = resolveFromGlobal('CpuCommentaryRuntime', rootRef);
        if (hasCommentaryRuntime(runtime))
            return runtime;
        return null;
    }
    function resolveCommentaryRuntimeByRequire(moduleIds, requireFn) {
        const ids = Array.isArray(moduleIds) ? moduleIds : [];
        const loader = typeof requireFn === 'function'
            ? requireFn
            : (typeof require === 'function' ? require : null);
        if (!loader)
            return null;
        for (const moduleId of ids) {
            try {
                const runtime = loader(moduleId);
                if (hasCommentaryRuntime(runtime))
                    return runtime;
            }
            catch (e) { /* ignore */ }
        }
        return null;
    }
    function extractCardIdFromPlaybackEvents(playbackEvents) {
        const events = Array.isArray(playbackEvents) ? playbackEvents : [];
        for (const ev of events) {
            if (!ev || typeof ev !== 'object')
                continue;
            if (ev.cardId)
                return String(ev.cardId);
            if (ev.type !== 'card_use_animation')
                continue;
            const targets = Array.isArray(ev.targets) ? ev.targets : [];
            for (const target of targets) {
                if (target && target.cardId)
                    return String(target.cardId);
            }
        }
        return null;
    }
    function resolveCommentaryEventType(actionType, cardId) {
        const type = String(actionType || '').toLowerCase();
        if (type === 'pass')
            return 'pass';
        if (type === 'use_card')
            return 'card_used';
        if (cardId)
            return 'card_used';
        return 'turn_start';
    }
    function normalizeSpeakerRole(value, fallbackRole) {
        const role = String(value || '').trim().toLowerCase();
        if (role === 'cpu' || role === 'hero')
            return role;
        return String(fallbackRole || '').trim().toLowerCase() === 'hero' ? 'hero' : 'cpu';
    }
    function getSpeakerPrefix(playerKey, speakerRole) {
        if (normalizeSpeakerRole(speakerRole, 'cpu') === 'hero')
            return '勇者';
        return normalizePlayerKey(playerKey, 'black') === 'white' ? '白CPU' : '黒CPU';
    }
    function getCpuSpeakerPrefix(playerKey) {
        return getSpeakerPrefix(playerKey, 'cpu');
    }
    return {
        hasCommentaryRuntime,
        resolveFromGlobal,
        resolveCommentaryRuntimeFromGlobal,
        resolveCommentaryRuntimeByRequire,
        extractCardIdFromPlaybackEvents,
        resolveCommentaryEventType,
        normalizeSpeakerRole,
        getSpeakerPrefix,
        getCpuSpeakerPrefix
    };
}));
//# sourceMappingURL=commentary-runtime-helpers.js.map