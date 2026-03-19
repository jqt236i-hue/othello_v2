(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let OwnerHelpers = null;
        try {
            OwnerHelpers = require('../utils/owner-helpers');
        } catch (e) { /* ignore */ }
        module.exports = factory(OwnerHelpers);
    } else {
        root.PlaybackEventHelpers = factory(root.OwnerHelpers || null);
    }
}(typeof self !== 'undefined' ? self : this, function (OwnerHelpers) {
    'use strict';

    function parseSeatKeyOptional(value) {
        try {
            if (OwnerHelpers && typeof OwnerHelpers.normalizePlayerKeyOptional === 'function') {
                const normalized = OwnerHelpers.normalizePlayerKeyOptional(value);
                if (normalized) return normalized;
            }
        } catch (e) { /* ignore */ }

        if (value === 'black' || value === 1 || value === '1' || value === '+1') return 'black';
        if (value === 'white' || value === -1 || value === '-1') return 'white';

        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();
        if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        if (normalized === 'white' || normalized === '-1') return 'white';
        return null;
    }

    function resolvePlayerKey(value, fallbackPlayerKey, normalizePlayerKey) {
        const normalize = typeof normalizePlayerKey === 'function' ? normalizePlayerKey : null;
        if (normalize) {
            try {
                const direct = normalize(value);
                if (direct) return direct;
            } catch (e) { /* ignore */ }
            try {
                const fallback = normalize(fallbackPlayerKey);
                if (fallback) return fallback;
            } catch (e) { /* ignore */ }
        }
        return parseSeatKeyOptional(value) || parseSeatKeyOptional(fallbackPlayerKey) || 'black';
    }

    function mapRawPlaceEventsToPlayback(rawEvents, options) {
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        if (events.length === 0) return [];

        const opts = (options && typeof options === 'object') ? options : {};
        const fallbackTurnIndex = Number.isFinite(Number(opts.fallbackTurnIndex))
            ? Math.trunc(Number(opts.fallbackTurnIndex))
            : 0;
        const playbackEvents = [];
        for (const ev of events) {
            if (!ev || ev.type !== 'place') continue;
            if (!Number.isInteger(ev.row) || !Number.isInteger(ev.col)) continue;
            const ownerKey = resolvePlayerKey(ev.owner || ev.player, opts.fallbackPlayerKey, opts.normalizePlayerKey);
            playbackEvents.push({
                type: 'place_hand_animation',
                phase: 0,
                rawType: ev.type,
                actionId: ev.actionId || null,
                turnIndex: Number.isFinite(Number(ev.turnIndex)) ? Math.trunc(Number(ev.turnIndex)) : fallbackTurnIndex,
                targets: [{ r: ev.row, col: ev.col, player: ownerKey, owner: ownerKey }]
            });
        }
        return playbackEvents;
    }

    function countRawPlaceEvents(rawEvents) {
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        let count = 0;
        for (const event of events) {
            if (!event || event.type !== 'place') continue;
            if (!Number.isInteger(event.row) || !Number.isInteger(event.col)) continue;
            count += 1;
        }
        return count;
    }

    function countPlaceHandAnimationEvents(playbackEvents) {
        const events = Array.isArray(playbackEvents) ? playbackEvents : [];
        let count = 0;
        for (const event of events) {
            if (!event || event.type !== 'place_hand_animation') continue;
            count += 1;
        }
        return count;
    }

    function createAssemblyDiagnostics(rawEvents, playbackEvents) {
        const rawPlaceCount = countRawPlaceEvents(rawEvents);
        const placeHandAnimationCount = countPlaceHandAnimationEvents(playbackEvents);
        const warnings = [];
        if (rawPlaceCount !== placeHandAnimationCount) {
            warnings.push(`raw place count ${rawPlaceCount} does not match place_hand_animation count ${placeHandAnimationCount}`);
        }
        return {
            rawPlaceCount,
            placeHandAnimationCount,
            warnings
        };
    }

    function resolvePlaybackAdapter(adapterValue) {
        return (adapterValue && typeof adapterValue === 'object') ? adapterValue : null;
    }

    function assemblePlaybackEvents(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const rawEvents = Array.isArray(opts.rawEvents) ? opts.rawEvents : [];
        const presentationEvents = Array.isArray(opts.presentationEvents) ? opts.presentationEvents : [];
        const snapshot = (opts.snapshot && typeof opts.snapshot === 'object') ? opts.snapshot : {};
        const adapter = resolvePlaybackAdapter(opts.adapter);
        const normalizePlayerKey = typeof opts.normalizePlayerKey === 'function' ? opts.normalizePlayerKey : null;

        const rawPlacePlaybackEvents = mapRawPlaceEventsToPlayback(rawEvents, {
            fallbackPlayerKey: opts.fallbackPlayerKey || null,
            fallbackTurnIndex: (snapshot && snapshot.cardState && typeof snapshot.cardState.turnIndex === 'number')
                ? snapshot.cardState.turnIndex
                : 0,
            normalizePlayerKey
        });

        let playbackEvents = rawPlacePlaybackEvents.slice();
        if (presentationEvents.length > 0) {
            if (adapter && typeof adapter.mapToPlaybackEvents === 'function') {
                const mappedPlaybackEvents = adapter.mapToPlaybackEvents(
                    presentationEvents,
                    snapshot && snapshot.cardState,
                    snapshot && snapshot.gameState
                );
                if (!Array.isArray(mappedPlaybackEvents)) {
                    throw new Error('PlaybackEventHelpers.assemblePlaybackEvents expected adapter.mapToPlaybackEvents to return an array');
                }
                playbackEvents = rawPlacePlaybackEvents.concat(mappedPlaybackEvents);
            } else {
                playbackEvents = rawPlacePlaybackEvents.concat(presentationEvents);
            }
        }

        if (adapter && typeof adapter.normalizePlaybackEvents === 'function') {
            const normalizedPlaybackEvents = adapter.normalizePlaybackEvents(
                playbackEvents,
                rawEvents,
                presentationEvents,
                snapshot
            );
            if (!Array.isArray(normalizedPlaybackEvents)) {
                throw new Error('PlaybackEventHelpers.assemblePlaybackEvents expected adapter.normalizePlaybackEvents to return an array');
            }
            playbackEvents = normalizedPlaybackEvents;
        }

        if (adapter && typeof adapter.appendSoundEffectPlaybackEvents === 'function') {
            const playbackWithSound = adapter.appendSoundEffectPlaybackEvents(
                playbackEvents,
                rawEvents,
                presentationEvents
            );
            if (!Array.isArray(playbackWithSound)) {
                throw new Error('PlaybackEventHelpers.assemblePlaybackEvents expected adapter.appendSoundEffectPlaybackEvents to return an array');
            }
            playbackEvents = playbackWithSound;
        }

        const diagnostics = createAssemblyDiagnostics(rawEvents, playbackEvents);
        return {
            playbackEvents: cloneJsonSafe(playbackEvents),
            diagnostics: cloneJsonSafe(diagnostics)
        };
    }

    function cloneJsonSafe(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (e) {
            return Array.isArray(value) ? value.slice() : value;
        }
    }

    function getMaxPlaybackPhase(events) {
        const list = Array.isArray(events) ? events : [];
        let maxPhase = 0;
        for (const event of list) {
            const phase = Number(event && event.phase);
            if (Number.isFinite(phase) && phase > maxPhase) {
                maxPhase = phase;
            }
        }
        return maxPhase;
    }

    function appendPlaybackEventsAfter(baseEvents, appendedEvents) {
        const base = Array.isArray(baseEvents) ? cloneJsonSafe(baseEvents) : [];
        const appended = Array.isArray(appendedEvents) ? cloneJsonSafe(appendedEvents) : [];
        if (base.length === 0) return appended;
        if (appended.length === 0) return base;

        let minPhase = Infinity;
        for (const event of appended) {
            const phase = Number(event && event.phase);
            const normalized = Number.isFinite(phase) ? phase : 0;
            if (normalized < minPhase) minPhase = normalized;
        }
        if (!Number.isFinite(minPhase)) minPhase = 0;

        const baseMaxPhase = getMaxPlaybackPhase(base);
        const phaseOffset = (baseMaxPhase + 1) - minPhase;
        const shifted = appended.map((event) => {
            const cloned = (event && typeof event === 'object') ? event : {};
            const srcPhase = Number(cloned.phase);
            cloned.phase = Number.isFinite(srcPhase) ? (srcPhase + phaseOffset) : (baseMaxPhase + 1);
            return cloned;
        });

        return base.concat(shifted);
    }

    return {
        assemblePlaybackEvents,
        countRawPlaceEvents,
        countPlaceHandAnimationEvents,
        createAssemblyDiagnostics,
        mapRawPlaceEventsToPlayback,
        appendPlaybackEventsAfter
    };
}));
