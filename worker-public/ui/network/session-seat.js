(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.NetworkSessionSeatModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function createNetworkSessionSeatController(config) {
        const cfg = (config && typeof config === 'object') ? config : {};
        const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : null);

        function resolveState() {
            return (typeof cfg.getState === 'function' && cfg.getState()) || {};
        }

        function normalizePlayerKey(value) {
            if (typeof cfg.normalizePlayerKey === 'function') {
                return cfg.normalizePlayerKey(value);
            }
            const normalized = String(value || '').trim().toLowerCase();
            if (value === -1 || normalized === 'white' || normalized === '-1') return 'white';
            return 'black';
        }

        function normalizeRoomId(value) {
            if (typeof cfg.normalizeRoomId === 'function') {
                return cfg.normalizeRoomId(value);
            }
            return String(value || '').trim().toUpperCase();
        }

        function normalizePlayerName(value) {
            const maxLength = Number.isFinite(Number(cfg.playerNameMax))
                ? Math.max(1, Math.trunc(Number(cfg.playerNameMax)))
                : 7;
            const normalized = String(value || '').replace(/\s+/g, ' ').trim();
            return Array.from(normalized).slice(0, maxLength).join('');
        }

        function normalizeRoomSeats(value) {
            return {
                black: !!(value && value.black),
                white: !!(value && value.white)
            };
        }

        function normalizeSeatNames(value) {
            return {
                black: normalizePlayerName(value && value.black),
                white: normalizePlayerName(value && value.white)
            };
        }

        function normalizeRoomDeck(value) {
            const source = (value && typeof value === 'object') ? value : null;
            if (!source) return null;

            const deckCode = String(source.deckCode || '').trim();
            const parseDeckSize = (candidate) => {
                if (candidate === null || typeof candidate === 'undefined' || candidate === '') return null;
                return Number.isFinite(Number(candidate))
                    ? Math.max(0, Math.trunc(Number(candidate)))
                    : null;
            };
            const deckSize = parseDeckSize(source.deckSize);
            const deckCodeByPlayerSource = (source.deckCodeByPlayer && typeof source.deckCodeByPlayer === 'object')
                ? source.deckCodeByPlayer
                : null;
            const deckSizeByPlayerSource = (source.deckSizeByPlayer && typeof source.deckSizeByPlayer === 'object')
                ? source.deckSizeByPlayer
                : null;
            const deckCodeByPlayer = {
                black: deckCodeByPlayerSource ? String(deckCodeByPlayerSource.black || '').trim() : '',
                white: deckCodeByPlayerSource ? String(deckCodeByPlayerSource.white || '').trim() : ''
            };
            const deckSizeByPlayer = {
                black: parseDeckSize(deckSizeByPlayerSource && deckSizeByPlayerSource.black),
                white: parseDeckSize(deckSizeByPlayerSource && deckSizeByPlayerSource.white)
            };
            const hasPerPlayerDeck = !!(
                deckCodeByPlayer.black ||
                deckCodeByPlayer.white ||
                deckSizeByPlayer.black !== null ||
                deckSizeByPlayer.white !== null
            );
            const mode = String(source.mode || (hasPerPlayerDeck ? 'perPlayer' : 'shared')).trim() || 'shared';
            const roomSource = String(source.source || 'room').trim() || 'room';

            if (!deckCode && deckSize === null && !hasPerPlayerDeck) return null;

            return {
                mode,
                deckCode,
                deckSize,
                deckCodeByPlayer,
                deckSizeByPlayer,
                source: roomSource
            };
        }

        function getSeatDisplayName(seatKey) {
            return normalizePlayerKey(seatKey) === 'white' ? '白' : '黒';
        }

        function hasTwoPlayers() {
            const state = resolveState();
            return !!(state.roomSeats && state.roomSeats.black && state.roomSeats.white);
        }

        function emitRoomStateChanged() {
            const state = resolveState();
            if (typeof state.roomStateListener !== 'function') return;
            try {
                state.roomStateListener({
                    active: typeof cfg.isActive === 'function' ? cfg.isActive() : !!state.active,
                    roomId: state.roomId,
                    seatKey: state.seatKey,
                    seats: normalizeRoomSeats(state.roomSeats),
                    seatNames: normalizeSeatNames(state.seatNames),
                    roomDeck: normalizeRoomDeck(state.roomDeck),
                    hasTwoPlayers: hasTwoPlayers()
                });
            } catch (e) { /* ignore */ }
        }

        function updateRoomSeatsFromPayload(payload) {
            if (!payload || typeof payload !== 'object') return;

            const state = resolveState();
            let changed = false;
            if (Object.prototype.hasOwnProperty.call(payload, 'seats')) {
                state.roomSeats = normalizeRoomSeats(payload.seats);
                changed = true;
            }
            if (Object.prototype.hasOwnProperty.call(payload, 'seatNames')) {
                state.seatNames = normalizeSeatNames(payload.seatNames);
                changed = true;
            }
            if (Object.prototype.hasOwnProperty.call(payload, 'roomDeck')) {
                state.roomDeck = normalizeRoomDeck(payload.roomDeck);
                changed = true;
            }

            if (changed) emitRoomStateChanged();
        }

        function ensureOwnSeatJoined() {
            const state = resolveState();
            state.roomSeats = normalizeRoomSeats(state.roomSeats);
            state.roomSeats[state.seatKey] = true;
        }

        function setSeatGlobals(seatKey) {
            const normalized = normalizePlayerKey(seatKey);
            try {
                if (rootRef) {
                    rootRef.LOCAL_PLAYER_KEY = normalized;
                    rootRef.BOARD_VIEWER_KEY = normalized;
                    rootRef.__LOCAL_PLAYER_KEY = normalized;
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof globalThis !== 'undefined') {
                    globalThis.LOCAL_PLAYER_KEY = normalized;
                    globalThis.BOARD_VIEWER_KEY = normalized;
                    globalThis.__LOCAL_PLAYER_KEY = normalized;
                }
            } catch (e) { /* ignore */ }
        }

        function getSeatStorageKey(roomId) {
            return `network_match_seat_${normalizeRoomId(roomId)}`;
        }

        function readSeatClaim(roomId) {
            try {
                if (typeof localStorage === 'undefined') return null;
                const raw = localStorage.getItem(getSeatStorageKey(roomId));
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return null;
                if (!parsed.seatToken) return null;
                return {
                    seatKey: normalizePlayerKey(parsed.seatKey),
                    seatToken: String(parsed.seatToken)
                };
            } catch (e) { /* ignore */ }
            return null;
        }

        function writeSeatClaim(roomId, seatKey, seatToken) {
            try {
                if (typeof localStorage === 'undefined') return;
                if (!roomId || !seatToken) return;
                localStorage.setItem(getSeatStorageKey(roomId), JSON.stringify({
                    roomId: normalizeRoomId(roomId),
                    seatKey: normalizePlayerKey(seatKey),
                    seatToken: String(seatToken)
                }));
            } catch (e) { /* ignore */ }
        }

        function clearSeatClaim(roomId) {
            try {
                if (typeof localStorage === 'undefined') return;
                if (!roomId) return;
                localStorage.removeItem(getSeatStorageKey(roomId));
            } catch (e) { /* ignore */ }
        }

        function activateSessionFromResponse(data, fallbackRoomId) {
            const payload = data || {};
            const state = resolveState();

            state.active = true;
            state.roomId = String(payload.roomId || fallbackRoomId || '').trim().toUpperCase();
            state.seatKey = normalizePlayerKey(payload.seatKey);
            state.seatToken = String(payload.seatToken || '').trim();
            state.stateVersion = Number.isFinite(Number(payload.stateVersion)) ? Number(payload.stateVersion) : null;
            state.lastResultVersionShown = null;
            state.resultShownForUnversioned = false;
            state.chatHistory = [];
            state.roomSeats = normalizeRoomSeats(payload.seats);
            state.seatNames = normalizeSeatNames(payload.seatNames);
            state.roomDeck = normalizeRoomDeck(payload.roomDeck);

            const ownName = normalizePlayerName(payload.playerName);
            if (ownName) {
                state.seatNames[state.seatKey] = ownName;
            }

            ensureOwnSeatJoined();

            if (typeof cfg.updateTurnTimerFromPayload === 'function') {
                cfg.updateTurnTimerFromPayload(payload);
            }
            setSeatGlobals(state.seatKey);
            if (typeof cfg.ensureActionBridge === 'function') {
                cfg.ensureActionBridge();
            }
            writeSeatClaim(state.roomId, state.seatKey, state.seatToken);
            emitRoomStateChanged();

            if (payload.snapshot && typeof cfg.applySnapshot === 'function') {
                cfg.applySnapshot(payload.snapshot, { force: true });
            }
        }

        function resetSessionState() {
            const state = resolveState();
            state.active = false;
            state.roomId = '';
            state.seatKey = 'black';
            state.seatToken = '';
            state.roomSeats = { black: false, white: false };
            state.seatNames = { black: '', white: '' };
            state.roomDeck = null;
            state.chatHistory = [];
            state.stateVersion = null;
            state.lastResultVersionShown = null;
            state.resultShownForUnversioned = false;
        }

        return {
            normalizePlayerName,
            normalizeRoomSeats,
            normalizeSeatNames,
            getSeatDisplayName,
            hasTwoPlayers,
            emitRoomStateChanged,
            updateRoomSeatsFromPayload,
            ensureOwnSeatJoined,
            setSeatGlobals,
            readSeatClaim,
            writeSeatClaim,
            clearSeatClaim,
            activateSessionFromResponse,
            resetSessionState
        };
    }

    return {
        createNetworkSessionSeatController
    };
}));
