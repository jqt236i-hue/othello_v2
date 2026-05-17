(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let CommentaryContextHelpers = null;
        try {
            CommentaryContextHelpers = require('./commentary-context-helpers');
        } catch (e) { /* ignore */ }
        module.exports = factory(CommentaryContextHelpers);
    } else {
        root.CommentaryRuntimeHelpers = factory(root.CommentaryContextHelpers || null);
    }
}(typeof self !== 'undefined' ? self : this as Record<string, unknown>, function (CommentaryContextHelpers: unknown) {
    'use strict';

    interface CommentaryRuntime {
        requestCommentary: (...args: unknown[]) => unknown;
    }

    interface PlaybackEvent {
        cardId?: string;
        type?: string;
        targets?: Array<{ cardId?: string }>;
    }

    function normalizePlayerKey(value: unknown, fallbackKey: unknown): string {
        try {
            if (
                CommentaryContextHelpers &&
                typeof (CommentaryContextHelpers as { normalizePlayerKey?: (v: unknown, f: unknown) => string }).normalizePlayerKey === 'function'
            ) {
                return (CommentaryContextHelpers as { normalizePlayerKey: (v: unknown, f: unknown) => string }).normalizePlayerKey(value, fallbackKey);
            }
        } catch (e) { /* ignore */ }

        if (value === 'white' || value === -1 || value === '-1') return 'white';
        if (value === 'black' || value === 1 || value === '1') return 'black';
        return fallbackKey === 'white' ? 'white' : 'black';
    }

    function hasCommentaryRuntime(runtime: unknown): boolean {
        return !!(runtime && typeof (runtime as CommentaryRuntime).requestCommentary === 'function');
    }

    function resolveFromGlobal(globalName: string, rootRef: unknown): unknown | null {
        const candidates: unknown[] = [];
        if (rootRef) candidates.push(rootRef);
        try {
            if (typeof globalThis !== 'undefined' && globalThis && globalThis !== rootRef) {
                candidates.push(globalThis);
            }
        } catch (e) { /* ignore */ }

        for (const candidate of candidates) {
            try {
                const resolved = candidate && (candidate as Record<string, unknown>)[globalName];
                if (resolved) return resolved;
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveCommentaryRuntimeFromGlobal(rootRef: unknown): CommentaryRuntime | null {
        const runtime = resolveFromGlobal('CpuCommentaryRuntime', rootRef);
        if (hasCommentaryRuntime(runtime)) return runtime as CommentaryRuntime;
        return null;
    }

    function resolveCommentaryRuntimeByRequire(moduleIds: unknown, requireFn: unknown): CommentaryRuntime | null {
        const ids = Array.isArray(moduleIds) ? moduleIds as string[] : [];
        const loader = typeof requireFn === 'function'
            ? requireFn as (id: string) => unknown
            : (typeof require === 'function' ? require as (id: string) => unknown : null);
        if (!loader) return null;

        for (const moduleId of ids) {
            try {
                const runtime = loader(moduleId);
                if (hasCommentaryRuntime(runtime)) return runtime as CommentaryRuntime;
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function extractCardIdFromPlaybackEvents(playbackEvents: unknown): string | null {
        const events = Array.isArray(playbackEvents) ? playbackEvents as PlaybackEvent[] : [];
        for (const ev of events) {
            if (!ev || typeof ev !== 'object') continue;
            if (ev.cardId) return String(ev.cardId);
            if (ev.type !== 'card_use_animation') continue;

            const targets = Array.isArray(ev.targets) ? ev.targets : [];
            for (const target of targets) {
                if (target && target.cardId) return String(target.cardId);
            }
        }
        return null;
    }

    function resolveCommentaryEventType(actionType: unknown, cardId: unknown): string {
        const type = String(actionType || '').toLowerCase();
        if (type === 'pass') return 'pass';
        if (type === 'use_card') return 'card_used';
        if (cardId) return 'card_used';
        return 'turn_start';
    }

    function normalizeSpeakerRole(value: unknown, fallbackRole: unknown): string {
        return 'cpu';
    }

    function getSpeakerPrefix(playerKey: unknown, speakerRole: unknown): string {
        return normalizePlayerKey(playerKey, 'black') === 'white' ? '白CPU' : '黒CPU';
    }

    function getCpuSpeakerPrefix(playerKey: unknown): string {
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
