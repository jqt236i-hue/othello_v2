/**
 * @file cards.js
 * @description Core Card Logic (Shared between Browser and Headless)
 * Pure functions/state manipulation only. No UI dependencies.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node.js
        module.exports = factory(require('../../shared-constants'));
    } else {
        // Browser
        root.CardLogic = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const {
        CARD_DEFS,
        CARD_TYPE_BY_ID,
        BLACK,
        WHITE,
        EMPTY,
        DIRECTIONS,
        BOARD_SIZE,
        CHARGE_MAX,
        INITIAL_BOARD_BONUS_DISTRIBUTION
    } = SharedConstants || {};

    if (!CARD_DEFS) {
        throw new Error('SharedConstants not loaded');
    }

    // Constants
    // Policy: no initial draw at game start.
    const INITIAL_HAND_SIZE = 0;
    const MAX_HAND_SIZE = 5;
    const DRAW_INTERVAL = 1; // Draw every turn (turn 1, 2, 3, ...)
    const DOUBLE_PLACE_EXTRA = 1;
    const CHAIN_WILL_MAX_LINKS = 2;
    const HEAVEN_BLESSING_OFFER_COUNT = 5;
    const TIME_BOMB_TURNS = 3;
    const ULTIMATE_DRAGON_TURNS = 5;
    const ULTIMATE_DESTROY_GOD_TURNS = 5;
    const ULTIMATE_HYPERACTIVE_TURNS = 10;
    const ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT = 5;
    const SNIPER_WILL_TURNS = 5;
    const DESTROY_DRAGON_TURNS = 3;
    const LIGHTNING_WILL_TURNS = 5;
    const OBSERVER_WILL_TURNS = 5;
    const ROBOT_VACUUM_TURNS = 5;
    const INHERITED_HYPERACTIVE_TURNS = 10;
    const BLOCKADE_TURNS = 3;
    const GUARD_WILL_TURNS = 3;
    const GUARDIAN_GOD_TURNS = 10;
    const RIBO_WILL_UNLOCK_TURN_INDEX = 19;
    const RIBO_WILL_INITIAL_GAIN = 30;
    const RIBO_WILL_REPAYMENT_AMOUNT = 4;
    const RIBO_WILL_OWNER_TURNS = 9;
    const RIBO_WILL_SHORTAGE_DESTROY_COUNT = 2;

    function isWorkDebugEnabled(cardState) {
        if (cardState && cardState.debugWorkLog === true) return true;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.DEBUG_WORK_LOG === true) return true;
        } catch (e) { /* ignore */ }
        return false;
    }

    function workDebugLog(cardState) {
        if (!isWorkDebugEnabled(cardState)) return;
        try { if (typeof console !== 'undefined' && console.log) console.log.apply(console, Array.prototype.slice.call(arguments, 1)); } catch (e) { /* ignore */ }
    }

    function workDebugError(cardState) {
        if (!isWorkDebugEnabled(cardState)) return;
        try { if (typeof console !== 'undefined' && console.error) console.error.apply(console, Array.prototype.slice.call(arguments, 1)); } catch (e) { /* ignore */ }
    }

    function destroyAt(cardState, gameState, row, col) {
        if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
            const res = BoardOpsModule.destroyAt(cardState, gameState, row, col, 'SYSTEM', 'legacy_fallback');
            return !!res.destroyed;
        }

        if (gameState.board[row][col] === EMPTY) return false;

        removeMarkersAt(cardState, row, col);

        gameState.board[row][col] = EMPTY;
        return true;
    }

    function clearBombAt(cardState, row, col) {
        if (!cardState) return false;
        const beforeLen = getBombMarkers(cardState).length;
        removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb' });
        return getBombMarkers(cardState).length !== beforeLen;
    }

    // PRNG must be provided for reproducibility in online/replay mode.
    // Default methods: shuffle is pass-through (so existing tests that build decks don't break),
    // but random() will throw to force DI of a deterministic PRNG for rule logic.
    const defaultPrng = {
        shuffle: (array) => array,
        random: () => {
            throw new Error('PRNG.random() called without injected PRNG. Inject a deterministic PRNG for rule logic.');
        }
    };

    const CardCostsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/costs');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardCosts || null;
    })();

    const CardDefsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/defs');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardDefs || null;
    })();

    const CardUtilsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/utils');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardUtils || null;
    })();

    function setChargeValue(cardState, playerKey, nextValue, reason) {
        if (CardUtilsModule && typeof CardUtilsModule.setChargeWithDelta === 'function') {
            return CardUtilsModule.setChargeWithDelta(cardState, playerKey, nextValue, reason);
        }
        if (!cardState) return { changed: false, before: 0, after: 0, delta: 0 };
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        const before = Number(cardState.charge[playerKey] || 0);
        const safeBefore = Number.isFinite(before) ? before : 0;
        const requested = Number(nextValue);
        const safeRequested = Number.isFinite(requested) ? requested : safeBefore;
        const after = Math.max(0, Math.min(CHARGE_MAX || 99, safeRequested));
        cardState.charge[playerKey] = after;
        return { changed: after !== safeBefore, before: safeBefore, after, delta: after - safeBefore };
    }

    function addChargeValue(cardState, playerKey, amount, reason) {
        if (CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === 'function') {
            return CardUtilsModule.addChargeWithDelta(cardState, playerKey, amount, reason);
        }
        if (!cardState) return { changed: false, before: 0, after: 0, delta: 0 };
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        const before = Number(cardState.charge[playerKey] || 0);
        const safeBefore = Number.isFinite(before) ? before : 0;
        const add = Number(amount);
        const safeAdd = Number.isFinite(add) ? add : 0;
        return setChargeValue(cardState, playerKey, safeBefore + safeAdd, reason);
    }

    function ensureRiboRepaymentsByPlayer(cardState) {
        if (!cardState || typeof cardState !== 'object') {
            return { black: [], white: [] };
        }
        if (!cardState.riboRepaymentsByPlayer || typeof cardState.riboRepaymentsByPlayer !== 'object') {
            cardState.riboRepaymentsByPlayer = { black: [], white: [] };
        }
        if (!Array.isArray(cardState.riboRepaymentsByPlayer.black)) cardState.riboRepaymentsByPlayer.black = [];
        if (!Array.isArray(cardState.riboRepaymentsByPlayer.white)) cardState.riboRepaymentsByPlayer.white = [];
        return cardState.riboRepaymentsByPlayer;
    }

    function isGuardProtectedCell(cardState, row, col) {
        return Array.isArray(cardState && cardState.markers) && cardState.markers.some((marker) => (
            marker &&
            marker.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            marker.row === row &&
            marker.col === col &&
            marker.data &&
            marker.data.type === 'GUARD'
        ));
    }

    function getRiboExpansionDescriptors(gameState) {
        if (BoardOpsModule && typeof BoardOpsModule.getExpansionDescriptors === 'function') {
            return BoardOpsModule.getExpansionDescriptors(gameState);
        }
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];

        const sourceCells = Array.isArray(expansion.cells)
            ? expansion.cells
            : (expansion.active ? [expansion] : []);
        const out = [];
        for (const cell of sourceCells) {
            if (!cell || typeof cell !== 'object') continue;
            const row = Number(cell.row);
            let col = null;
            if (Number.isInteger(cell.col)) {
                col = cell.col;
            } else if (cell.side === 'left') {
                col = -1;
            } else if (cell.side === 'right') {
                col = 8;
            }
            if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
            out.push({ row, col, owner: cell.owner });
        }
        return out;
    }

    function collectRiboDestroyableOwnStonePositions(cardState, gameState, playerKey) {
        const out = [];
        const ownerValue = playerKey === 'black' ? BLACK : WHITE;
        const boardSize = Number.isInteger(BOARD_SIZE) ? BOARD_SIZE : 8;
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : [];

        for (let row = 0; row < boardSize; row++) {
            const boardRow = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < boardSize; col++) {
                if (boardRow[col] !== ownerValue) continue;
                if (isGuardProtectedCell(cardState, row, col)) continue;
                out.push({ row, col });
            }
        }

        const expansionCells = getRiboExpansionDescriptors(gameState);
        for (const cell of expansionCells) {
            if (!cell || cell.owner !== ownerValue) continue;
            if (isGuardProtectedCell(cardState, cell.row, cell.col)) continue;
            out.push({ row: cell.row, col: cell.col });
        }

        return out;
    }

    function sampleRandomPositions(positions, count, prng) {
        if (!Array.isArray(positions) || positions.length === 0 || !Number.isFinite(count) || count <= 0) return [];
        const randomSource = () => {
            if (prng && typeof prng.random === 'function') {
                try {
                    return prng.random();
                } catch (e) {
                    return Math.random();
                }
            }
            return Math.random();
        };
        const pool = positions.slice();
        const out = [];
        while (pool.length > 0 && out.length < count) {
            const rnd = Math.max(0, Math.min(0.999999, Number(randomSource()) || 0));
            const index = Math.floor(rnd * pool.length);
            out.push(pool.splice(index, 1)[0]);
        }
        return out;
    }

    function armRiboWillEffect(cardState, playerKey) {
        const riboByPlayer = ensureRiboRepaymentsByPlayer(cardState);
        const entry = {
            remainingOwnerTurns: RIBO_WILL_OWNER_TURNS,
            repaymentAmount: RIBO_WILL_REPAYMENT_AMOUNT,
            shortageDestroyCount: RIBO_WILL_SHORTAGE_DESTROY_COUNT
        };
        riboByPlayer[playerKey].push(entry);
        const gained = addChargeWithTotal(cardState, playerKey, RIBO_WILL_INITIAL_GAIN);
        return {
            applied: true,
            gained,
            repaymentAmount: entry.repaymentAmount,
            remainingOwnerTurns: entry.remainingOwnerTurns,
            shortageDestroyCount: entry.shortageDestroyCount,
            activeCount: riboByPlayer[playerKey].length
        };
    }

    function processRiboWillTurnStartEffects(cardState, gameState, playerKey, prng) {
        const riboByPlayer = ensureRiboRepaymentsByPlayer(cardState);
        const active = Array.isArray(riboByPlayer[playerKey]) ? riboByPlayer[playerKey] : [];
        const summary = {
            entries: [],
            totalRepaid: 0,
            totalDestroyed: 0,
            completedCount: 0
        };
        if (active.length === 0) return summary;

        const next = [];
        for (const rawEntry of active) {
            const remainingOwnerTurns = Number.isFinite(Number(rawEntry && rawEntry.remainingOwnerTurns))
                ? Math.max(0, Math.floor(Number(rawEntry.remainingOwnerTurns)))
                : 0;
            if (remainingOwnerTurns <= 0) continue;

            const repaymentAmount = Number.isFinite(Number(rawEntry && rawEntry.repaymentAmount))
                ? Math.max(0, Math.floor(Number(rawEntry.repaymentAmount)))
                : RIBO_WILL_REPAYMENT_AMOUNT;
            const shortageDestroyCount = Number.isFinite(Number(rawEntry && rawEntry.shortageDestroyCount))
                ? Math.max(0, Math.floor(Number(rawEntry.shortageDestroyCount)))
                : RIBO_WILL_SHORTAGE_DESTROY_COUNT;
            const chargeBefore = Number.isFinite(Number(cardState && cardState.charge && cardState.charge[playerKey]))
                ? Number(cardState.charge[playerKey])
                : 0;
            const remainingAfter = Math.max(0, remainingOwnerTurns - 1);
            const entry = {
                repaymentAmount,
                shortageDestroyCount,
                remainingOwnerTurnsBefore: remainingOwnerTurns,
                remainingOwnerTurnsAfter: remainingAfter,
                chargeBefore,
                chargeAfter: chargeBefore,
                repaid: 0,
                shortage: false,
                destroyed: [],
                destroyedCount: 0,
                completed: remainingAfter <= 0
            };

            if (chargeBefore >= repaymentAmount) {
                const deltaRes = addChargeValue(cardState, playerKey, -repaymentAmount, 'ribo_will_repayment');
                entry.repaid = Math.max(0, -(Number(deltaRes && deltaRes.delta) || 0));
                entry.chargeAfter = Number.isFinite(Number(deltaRes && deltaRes.after))
                    ? Number(deltaRes.after)
                    : Math.max(0, chargeBefore - repaymentAmount);
                summary.totalRepaid += entry.repaid;
            } else {
                entry.shortage = true;
                const targets = sampleRandomPositions(
                    collectRiboDestroyableOwnStonePositions(cardState, gameState, playerKey),
                    shortageDestroyCount,
                    prng
                );
                for (const target of targets) {
                    if (!target) continue;
                    let destroyed = false;
                    if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                        const destroyRes = BoardOpsModule.destroyAt(
                            cardState,
                            gameState,
                            target.row,
                            target.col,
                            'RIBO_WILL',
                            'ribo_repayment_shortage',
                            { owner: playerKey }
                        );
                        destroyed = !!(destroyRes && destroyRes.destroyed);
                    } else {
                        destroyed = destroyAt(cardState, gameState, target.row, target.col);
                    }
                    if (!destroyed) continue;
                    entry.destroyed.push({ row: target.row, col: target.col });
                }
                entry.destroyedCount = entry.destroyed.length;
                summary.totalDestroyed += entry.destroyedCount;
            }

            if (entry.completed) {
                summary.completedCount += 1;
            } else {
                next.push({
                    remainingOwnerTurns: remainingAfter,
                    repaymentAmount,
                    shortageDestroyCount
                });
            }
            summary.entries.push(entry);
        }

        riboByPlayer[playerKey] = next;
        return summary;
    }

    const CardSelectorsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./cards/selectors');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.CardSelectors || null;
    })();

    const BoardOpsModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('./board_ops');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.BoardOps || null;
    })();

    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('./markers_adapter');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.MarkersAdapter || null;
    })();
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;

    function ensureMarkers(cardState) {
        if (MarkersAdapter && typeof MarkersAdapter.ensureMarkers === 'function') {
            MarkersAdapter.ensureMarkers(cardState);
            return;
        }
        if (!cardState) return;
        if (!Array.isArray(cardState.markers)) cardState.markers = [];
        if (typeof cardState._nextMarkerId !== 'number') cardState._nextMarkerId = 1;
        if (typeof cardState._nextCreatedSeq !== 'number') cardState._nextCreatedSeq = 1;
    }

    function getMarkers(cardState) {
        return (MarkersAdapter && typeof MarkersAdapter.getMarkers === 'function')
            ? MarkersAdapter.getMarkers(cardState)
            : (cardState && Array.isArray(cardState.markers) ? cardState.markers : []);
    }

    function getSpecialMarkers(cardState) {
        return (MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
            ? MarkersAdapter.getSpecialMarkers(cardState)
            : getMarkers(cardState).filter(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'));
    }

    function getBombMarkers(cardState) {
        return (MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function')
            ? MarkersAdapter.getBombMarkers(cardState)
            : getMarkers(cardState).filter(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb'));
    }

    function getBlockadeMarkers(cardState) {
        return getSpecialMarkers(cardState).filter(m => m && m.data && m.data.type === 'BLOCKADE');
    }

    function getBlockingMarkers(cardState) {
        return getSpecialMarkers(cardState).filter(m => (
            m &&
            m.data &&
            (m.data.type === 'BLOCKADE' || m.data.type === 'METEOR_HOLE')
        ));
    }

    function isMeteorHoleCell(cardState, row, col) {
        return getSpecialMarkers(cardState).some((m) => (
            m &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'METEOR_HOLE'
        ));
    }

    function isMainBoardCellForCard(row, col) {
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    function resolveExpansionSideForCard(side, row, col) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (col === -1) return 'left';
        if (col === 8) return 'right';
        if (row === -1) return 'top';
        if (row === 8) return 'bottom';
        return null;
    }

    function normalizeExpansionOwnerForCard(owner) {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function isExpansionCoordinateForCard(row, col) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (row < -1 || row > 8 || col < -1 || col > 8) return false;
        if (isMainBoardCellForCard(row, col)) return false;
        return true;
    }

    function getExpansionDescriptorsForCard(gameState) {
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];

        const out = [];
        const pushDescriptor = (source, legacyRow, legacyOwner) => {
            let side = null;
            let row = null;
            let col = null;
            let owner = legacyOwner;

            if (source && typeof source === 'object') {
                side = source.side;
                row = source.row;
                col = source.col;
                owner = source.owner;
                if (!Number.isInteger(col) && side === 'left') col = -1;
                if (!Number.isInteger(col) && side === 'right') col = 8;
            } else {
                side = source;
                row = legacyRow;
                if (side === 'left') col = -1;
                if (side === 'right') col = 8;
            }

            if (!isExpansionCoordinateForCard(row, col)) return;
            if (out.some((desc) => desc && desc.row === row && desc.col === col)) return;

            out.push({
                side: resolveExpansionSideForCard(side, row, col),
                row,
                col,
                owner: normalizeExpansionOwnerForCard(owner)
            });
        };

        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object') continue;
                pushDescriptor(cell);
            }
        }

        if (out.length === 0 && expansion.active === true) {
            pushDescriptor(expansion);
        }

        return out;
    }

    function syncLegacyExpansionFieldsForCard(expansion) {
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSideForCard(latest.side, latest.row, latest.col) : null;
        expansion.row = latest ? latest.row : null;
        expansion.owner = latest ? normalizeExpansionOwnerForCard(latest.owner) : EMPTY;
    }

    function ensureMutableBoardExpansionForCard(gameState) {
        if (!gameState.boardExpansion || typeof gameState.boardExpansion !== 'object') {
            gameState.boardExpansion = {
                active: false,
                side: null,
                row: null,
                owner: EMPTY,
                usedByPlayer: { black: false, white: false },
                cells: []
            };
            return gameState.boardExpansion;
        }

        const expansion = gameState.boardExpansion;
        if (!expansion.usedByPlayer || typeof expansion.usedByPlayer !== 'object') {
            expansion.usedByPlayer = { black: false, white: false };
        } else {
            expansion.usedByPlayer.black = !!expansion.usedByPlayer.black;
            expansion.usedByPlayer.white = !!expansion.usedByPlayer.white;
        }

        const descriptors = getExpansionDescriptorsForCard(gameState);
        expansion.cells = descriptors.map((desc) => ({
            side: desc.side,
            row: desc.row,
            col: desc.col,
            owner: normalizeExpansionOwnerForCard(desc.owner)
        }));
        syncLegacyExpansionFieldsForCard(expansion);
        return expansion;
    }

    function writeExpansionDescriptorsForCard(gameState, cells) {
        const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
        boardExpansion.cells = (Array.isArray(cells) ? cells : []).map((cell) => ({
            side: resolveExpansionSideForCard(cell && cell.side, cell && cell.row, cell && cell.col),
            row: cell && cell.row,
            col: cell && cell.col,
            owner: normalizeExpansionOwnerForCard(cell && cell.owner)
        }));
        syncLegacyExpansionFieldsForCard(boardExpansion);
        return boardExpansion;
    }

    function getCellValueForCard(gameState, row, col) {
        if (isMainBoardCellForCard(row, col)) {
            return (gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]))
                ? gameState.board[row][col]
                : null;
        }
        const descriptors = getExpansionDescriptorsForCard(gameState);
        for (const desc of descriptors) {
            if (!desc) continue;
            if (desc.row === row && desc.col === col) {
                return normalizeExpansionOwnerForCard(desc.owner);
            }
        }
        return null;
    }

    function setCellValueForCard(gameState, row, col, value) {
        if (isMainBoardCellForCard(row, col)) {
            if (!gameState || !Array.isArray(gameState.board) || !Array.isArray(gameState.board[row])) return false;
            gameState.board[row][col] = value;
            return true;
        }
        const expansion = ensureMutableBoardExpansionForCard(gameState);
        if (!Array.isArray(expansion.cells)) return false;
        const normalizedOwner = normalizeExpansionOwnerForCard(value);
        for (let i = 0; i < expansion.cells.length; i++) {
            const cell = expansion.cells[i];
            if (!cell) continue;
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null));
            if (!Number.isInteger(cellCol)) continue;
            if (cell.row === row && cellCol === col) {
                expansion.cells[i] = {
                    side: resolveExpansionSideForCard(cell.side, cell.row, cellCol),
                    row: cell.row,
                    col: cellCol,
                    owner: normalizedOwner
                };
                syncLegacyExpansionFieldsForCard(expansion);
                return true;
            }
        }
        return false;
    }

    function clearStoneIdAtForCard(cardState, gameState, row, col) {
        if (!cardState) return;
        if (isMainBoardCellForCard(row, col)) {
            if (cardState.stoneIdMap && cardState.stoneIdMap[row]) {
                cardState.stoneIdMap[row][col] = null;
            }
            return;
        }
        const isExpansion = getExpansionDescriptorsForCard(gameState)
            .some((desc) => desc && desc.row === row && desc.col === col);
        if (!isExpansion) return;
        if (cardState.expansionStoneIdByCell && typeof cardState.expansionStoneIdByCell === 'object') {
            delete cardState.expansionStoneIdByCell[`${row},${col}`];
        }
    }

    function getStoneIdAtForCard(cardState, gameState, row, col) {
        if (!cardState) return null;
        if (isMainBoardCellForCard(row, col)) {
            return (cardState.stoneIdMap && cardState.stoneIdMap[row])
                ? (cardState.stoneIdMap[row][col] || null)
                : null;
        }
        const isExpansion = getExpansionDescriptorsForCard(gameState)
            .some((desc) => desc && desc.row === row && desc.col === col);
        if (!isExpansion) return null;
        if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object') return null;
        return cardState.expansionStoneIdByCell[`${row},${col}`] || null;
    }

    function setStoneIdAtForCard(cardState, gameState, row, col, stoneId) {
        if (!cardState) return false;
        if (isMainBoardCellForCard(row, col)) {
            if (!Array.isArray(cardState.stoneIdMap)) {
                cardState.stoneIdMap = Array.from({ length: 8 }, () => Array(8).fill(null));
            }
            if (!Array.isArray(cardState.stoneIdMap[row])) {
                cardState.stoneIdMap[row] = Array(8).fill(null);
            }
            cardState.stoneIdMap[row][col] = stoneId || null;
            return true;
        }
        const isExpansion = getExpansionDescriptorsForCard(gameState)
            .some((desc) => desc && desc.row === row && desc.col === col);
        if (!isExpansion) return false;
        if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object') {
            cardState.expansionStoneIdByCell = {};
        }
        const key = `${row},${col}`;
        if (stoneId == null) {
            delete cardState.expansionStoneIdByCell[key];
        } else {
            cardState.expansionStoneIdByCell[key] = stoneId;
        }
        return true;
    }

    function isBlockedCell(cardState, row, col, gameState) {
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        const isExpansionCell = getExpansionDescriptorsForCard(gameState)
            .some((desc) => desc && desc.row === rowNum && desc.col === colNum);
        if (!isExpansionCell && !isMainBoardCellForCard(rowNum, colNum)) return false;
        return getBlockingMarkers(cardState).some(m => m.row === rowNum && m.col === colNum);
    }

    function findSpecialMarkerAt(cardState, row, col, type, owner) {
        if (MarkersAdapter && typeof MarkersAdapter.findSpecialMarkerAt === 'function') {
            return MarkersAdapter.findSpecialMarkerAt(cardState, row, col, type, owner);
        }
        return getMarkers(cardState).find(m => (
            m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
            m.row === row &&
            m.col === col &&
            (type ? (m.data && m.data.type === type) : true) &&
            (owner ? m.owner === owner : true)
        ));
    }

    function findBombMarkerAt(cardState, row, col) {
        if (MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function') {
            return MarkersAdapter.findBombMarkerAt(cardState, row, col);
        }
        return getMarkers(cardState).find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb') && m.row === row && m.col === col);
    }

    function isPositionSwapProtectedCell(cardState, row, col) {
        const special = findSpecialMarkerAt(cardState, row, col);
        return !!(special && special.data && special.data.type === 'GLUTTONOUS');
    }

    function removeMarkersAt(cardState, row, col, options) {
        if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
            MarkersAdapter.removeMarkersAt(cardState, row, col, options);
            return;
        }
        if (!cardState || !Array.isArray(cardState.markers)) return;
        const opts = options || {};
        cardState.markers = cardState.markers.filter(m => {
            if (m.row !== row || m.col !== col) return true;
            if (opts.kind && m.kind !== opts.kind) return true;
            if (opts.type && (!m.data || m.data.type !== opts.type)) return true;
            if (opts.owner && m.owner !== opts.owner) return true;
            return false;
        });
    }

    function swapCellCoordinates(cardState, posA, posB) {
        if (!cardState || !posA || !posB) return;

        const aRow = Number(posA.row);
        const aCol = Number(posA.col);
        const bRow = Number(posB.row);
        const bCol = Number(posB.col);
        if (!Number.isInteger(aRow) || !Number.isInteger(aCol) || !Number.isInteger(bRow) || !Number.isInteger(bCol)) return;

        if (cardState.stoneIdMap && cardState.stoneIdMap[aRow] && cardState.stoneIdMap[bRow]) {
            const stoneA = cardState.stoneIdMap[aRow][aCol];
            const stoneB = cardState.stoneIdMap[bRow][bCol];
            cardState.stoneIdMap[aRow][aCol] = stoneB;
            cardState.stoneIdMap[bRow][bCol] = stoneA;
        }

        const markers = getMarkers(cardState);
        for (const m of markers) {
            if (!m) continue;
            if (m.row === aRow && m.col === aCol) {
                m.row = bRow;
                m.col = bCol;
            } else if (m.row === bRow && m.col === bCol) {
                m.row = aRow;
                m.col = aCol;
            }
        }

        const swapPoint = (p) => {
            if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col)) return p;
            if (p.row === aRow && p.col === aCol) return { row: bRow, col: bCol };
            if (p.row === bRow && p.col === bCol) return { row: aRow, col: aCol };
            return p;
        };

        if (cardState.workAnchorPosByPlayer) {
            cardState.workAnchorPosByPlayer.black = swapPoint(cardState.workAnchorPosByPlayer.black);
            cardState.workAnchorPosByPlayer.white = swapPoint(cardState.workAnchorPosByPlayer.white);
        }
        if (cardState.breedingSproutByOwner) {
            for (const owner of ['black', 'white']) {
                const arr = Array.isArray(cardState.breedingSproutByOwner[owner]) ? cardState.breedingSproutByOwner[owner] : [];
                cardState.breedingSproutByOwner[owner] = arr.map(swapPoint);
            }
        }
        if (cardState.breedingFrontierByAnchorId && typeof cardState.breedingFrontierByAnchorId === 'object') {
            for (const key of Object.keys(cardState.breedingFrontierByAnchorId)) {
                const arr = Array.isArray(cardState.breedingFrontierByAnchorId[key]) ? cardState.breedingFrontierByAnchorId[key] : [];
                cardState.breedingFrontierByAnchorId[key] = arr.map(swapPoint);
            }
        }
    }

    function buildInitialBoardBonusMap(prng) {
        const boardSize = Number.isInteger(BOARD_SIZE) ? BOARD_SIZE : 8;
        const center = Math.floor(boardSize / 2);
        const initialStoneCells = [
            { row: center - 1, col: center - 1 },
            { row: center - 1, col: center },
            { row: center, col: center - 1 },
            { row: center, col: center }
        ];
        const orthogonalDirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
        ];

        const blocked = new Set();
        for (const stone of initialStoneCells) {
            blocked.add(`${stone.row},${stone.col}`);
            for (const dir of orthogonalDirs) {
                const nextRow = stone.row + dir.dr;
                const nextCol = stone.col + dir.dc;
                if (nextRow < 0 || nextRow >= boardSize || nextCol < 0 || nextCol >= boardSize) continue;
                blocked.add(`${nextRow},${nextCol}`);
            }
        }

        const allEmptyCells = [];
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const key = `${row},${col}`;
                if (blocked.has(key)) continue;
                allEmptyCells.push({ row, col });
            }
        }

        const dist = Array.isArray(INITIAL_BOARD_BONUS_DISTRIBUTION) && INITIAL_BOARD_BONUS_DISTRIBUTION.length > 0
            ? INITIAL_BOARD_BONUS_DISTRIBUTION
            : [
                { value: 1, count: 9 },
                { value: 2, count: 8 },
                { value: 3, count: 6 },
                { value: 4, count: 5 },
                { value: 5, count: 4 },
                { value: 6, count: 3 },
                { value: 7, count: 2 },
                { value: 8, count: 1 },
                { value: 9, count: 1 },
                { value: 10, count: 1 }
            ];

        const bonusValues = [];
        for (const item of dist) {
            if (!item) continue;
            const value = Number(item.value);
            const count = Number(item.count);
            if (!Number.isInteger(value) || value < 1 || value > 10) continue;
            if (!Number.isInteger(count) || count <= 0) continue;
            for (let i = 0; i < count; i++) bonusValues.push(value);
        }

        const cells = allEmptyCells.slice();
        prng.shuffle(cells);
        const values = bonusValues.slice();
        prng.shuffle(values);

        const assignCount = Math.min(cells.length, values.length);
        const out = {};
        for (let i = 0; i < assignCount; i++) {
            const pos = cells[i];
            out[`${pos.row},${pos.col}`] = values[i];
        }
        return out;
    }

    /**
     * Create initial card state
     * @param {Object} [prng] - PRNG object (optional)
     * @returns {Object} cardState
     */
    function createCardState(prng) {
        const p = prng || defaultPrng;

        // Generate one deck.
        // Spec: include each enabled card id exactly once (no duplicates at initial state).
        const buildDeck = () => {
            const enabledDefs = CARD_DEFS.filter(c => c.enabled !== false);
            const seen = new Set();
            const deck = [];
            for (const def of enabledDefs) {
                if (!def || !def.id) continue;
                if (seen.has(def.id)) continue;
                seen.add(def.id);
                deck.push(def.id);
            }
            p.shuffle(deck);
            return deck;
        };

        const blackDeck = buildDeck();
        const whiteDeck = buildDeck();
        const boardBonusByCell = buildInitialBoardBonusMap(p);

        return {
            // Per-player decks (non-shared)
            decks: {
                black: blackDeck,
                white: whiteDeck
            },
            // Legacy compatibility field. Do not use in new code.
            deck: blackDeck.slice(),
            discard: [],
            initialDeckSize: blackDeck.length,
            initialDeckSizeByPlayer: { black: blackDeck.length, white: whiteDeck.length },
            reshuffleRequiresFullCycle: false,
            hands: { black: [], white: [] },
            turnIndex: 0,
            lastTurnStartedFor: null,
            turnCountByPlayer: { black: 0, white: 0 },
            observerTriviaBaseByPlayer: { black: null, white: null },
            observerTriviaCursorByPlayer: { black: null, white: null },

            // Card usage state
            selectedCardId: null,
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
            pendingEffectByPlayer: { black: null, white: null },
            activeEffectsByPlayer: { black: [], white: [] },

            // Special effects state - unified markers array (future primary storage)
            // Format: { id, row, col, kind, owner, data: {...} }
            markers: [],
            _nextMarkerId: 1,
            _nextCreatedSeq: 1,

            // Presentation event support (PoC)
            presentationEvents: [],   // [{type, stoneId, row, col, ownerBefore, ownerAfter, cause, reason, meta, actionId, turnIndex, plyIndex}]
            _nextStoneId: 5, // s1-s4 are initial stones
            stoneIdMap: (function () {
                const m = Array(8).fill(null).map(() => Array(8).fill(null));
                m[3][3] = 's1'; m[3][4] = 's2'; m[4][3] = 's3'; m[4][4] = 's4';
                return m;
            })(),
            expansionStoneIdByCell: {},
            hyperactiveSeqCounter: 0,

            // Recent usage
            lastUsedCardByPlayer: { black: null, white: null },
            cardUseCountByPlayer: { black: 0, white: 0 },
            totalFlipCountByPlayer: { black: 0, white: 0 },
            cornerCaptureCountByPlayer: { black: 0, white: 0 },

            // Resources
            charge: { black: 0, white: 0 },
            chargeGainedTotal: { black: 0, white: 0 },
            chargeDeltaEvents: [],
            _nextChargeDeltaSeq: 1,
            riboRepaymentsByPlayer: { black: [], white: [] },

            // Extra actions
            extraPlaceRemainingByPlayer: { black: 0, white: 0 },

            // Board bonus tiles (generated once at game start)
            boardBonusByCell,
            boardBonusConsumedByCell: {},

            // Work Will state
            workAnchorPosByPlayer: { black: null, white: null },
            workNextPlacementArmedByPlayer: { black: false, white: false },

            // Breeding runtime state
            // - frontier: next breeding origins per anchor id
            // - sprout: one-turn visual tags for stones spawned by breeding
            breedingFrontierByAnchorId: {},
            breedingSproutByOwner: { black: [], white: [] },
            _breedingSproutClearedTokenByOwner: { black: null, white: null }
        };
    }

    /**
     * Deep copy card state
     * @param {Object} cs - Original card state
     * @returns {Object} Copied card state
     */
    function copyCardState(cs) {
        const legacyDeck = Array.isArray(cs.deck) ? cs.deck.slice() : [];
        const decks = (cs.decks && typeof cs.decks === 'object')
            ? {
                black: Array.isArray(cs.decks.black) ? cs.decks.black.slice() : legacyDeck.slice(),
                white: Array.isArray(cs.decks.white) ? cs.decks.white.slice() : legacyDeck.slice()
            }
            : { black: legacyDeck.slice(), white: legacyDeck.slice() };
        const initialDeckSizeByPlayer = (cs.initialDeckSizeByPlayer && typeof cs.initialDeckSizeByPlayer === 'object')
            ? {
                black: Number.isFinite(cs.initialDeckSizeByPlayer.black) ? cs.initialDeckSizeByPlayer.black : decks.black.length,
                white: Number.isFinite(cs.initialDeckSizeByPlayer.white) ? cs.initialDeckSizeByPlayer.white : decks.white.length
            }
            : {
                black: Number.isFinite(cs.initialDeckSize) ? cs.initialDeckSize : decks.black.length,
                white: Number.isFinite(cs.initialDeckSize) ? cs.initialDeckSize : decks.white.length
            };
        return {
            decks,
            // Legacy compatibility field. Do not use in new code.
            deck: decks.black.slice(),
            discard: cs.discard.slice(),
            hands: {
                black: cs.hands.black.slice(),
                white: cs.hands.white.slice()
            },
            turnIndex: cs.turnIndex,
            lastTurnStartedFor: cs.lastTurnStartedFor,
            turnCountByPlayer: { ...cs.turnCountByPlayer },
            observerTriviaBaseByPlayer: (cs.observerTriviaBaseByPlayer && typeof cs.observerTriviaBaseByPlayer === 'object')
                ? {
                    black: Number.isFinite(Number(cs.observerTriviaBaseByPlayer.black)) ? Number(cs.observerTriviaBaseByPlayer.black) : null,
                    white: Number.isFinite(Number(cs.observerTriviaBaseByPlayer.white)) ? Number(cs.observerTriviaBaseByPlayer.white) : null
                }
                : { black: null, white: null },
            observerTriviaCursorByPlayer: (cs.observerTriviaCursorByPlayer && typeof cs.observerTriviaCursorByPlayer === 'object')
                ? {
                    black: Number.isFinite(Number(cs.observerTriviaCursorByPlayer.black)) ? Number(cs.observerTriviaCursorByPlayer.black) : null,
                    white: Number.isFinite(Number(cs.observerTriviaCursorByPlayer.white)) ? Number(cs.observerTriviaCursorByPlayer.white) : null
                }
                : { black: null, white: null },

            selectedCardId: cs.selectedCardId,
            hasUsedCardThisTurnByPlayer: { ...cs.hasUsedCardThisTurnByPlayer },
            hasDestroyedCardThisTurnByPlayer: {
                black: !!(cs.hasDestroyedCardThisTurnByPlayer && cs.hasDestroyedCardThisTurnByPlayer.black),
                white: !!(cs.hasDestroyedCardThisTurnByPlayer && cs.hasDestroyedCardThisTurnByPlayer.white)
            },
            pendingEffectByPlayer: {
                black: cs.pendingEffectByPlayer.black ? { ...cs.pendingEffectByPlayer.black } : null,
                white: cs.pendingEffectByPlayer.white ? { ...cs.pendingEffectByPlayer.white } : null
            },
            activeEffectsByPlayer: {
                black: cs.activeEffectsByPlayer.black.map(e => ({ ...e })),
                white: cs.activeEffectsByPlayer.white.map(e => ({ ...e }))
            },

            // Unified markers (new primary storage)
            markers: (cs.markers || []).map(m => ({ ...m, data: { ...(m.data || {}) } })),
            _nextMarkerId: cs._nextMarkerId || 1,
            _nextCreatedSeq: cs._nextCreatedSeq || 1,
            stoneIdMap: (cs.stoneIdMap || Array(8).fill(null).map(() => Array(8).fill(null))).map(row => row.slice()),
            expansionStoneIdByCell: (cs.expansionStoneIdByCell && typeof cs.expansionStoneIdByCell === 'object')
                ? { ...cs.expansionStoneIdByCell }
                : {},
            hyperactiveSeqCounter: cs.hyperactiveSeqCounter || 0,

            lastUsedCardByPlayer: { ...cs.lastUsedCardByPlayer },
            cardUseCountByPlayer: { ...(cs.cardUseCountByPlayer || { black: 0, white: 0 }) },
            totalFlipCountByPlayer: { ...(cs.totalFlipCountByPlayer || { black: 0, white: 0 }) },
            cornerCaptureCountByPlayer: { ...(cs.cornerCaptureCountByPlayer || { black: 0, white: 0 }) },
            charge: { ...cs.charge },
            chargeGainedTotal: { ...(cs.chargeGainedTotal || { black: 0, white: 0 }) },
            chargeDeltaEvents: Array.isArray(cs.chargeDeltaEvents) ? cs.chargeDeltaEvents.map(e => ({ ...e })) : [],
            _nextChargeDeltaSeq: (typeof cs._nextChargeDeltaSeq === 'number') ? cs._nextChargeDeltaSeq : 1,
            riboRepaymentsByPlayer: {
                black: (cs.riboRepaymentsByPlayer && Array.isArray(cs.riboRepaymentsByPlayer.black))
                    ? cs.riboRepaymentsByPlayer.black.map((entry) => ({
                        remainingOwnerTurns: Number.isFinite(Number(entry && entry.remainingOwnerTurns))
                            ? Math.max(0, Math.floor(Number(entry.remainingOwnerTurns)))
                            : RIBO_WILL_OWNER_TURNS,
                        repaymentAmount: Number.isFinite(Number(entry && entry.repaymentAmount))
                            ? Math.max(0, Math.floor(Number(entry.repaymentAmount)))
                            : RIBO_WILL_REPAYMENT_AMOUNT,
                        shortageDestroyCount: Number.isFinite(Number(entry && entry.shortageDestroyCount))
                            ? Math.max(0, Math.floor(Number(entry.shortageDestroyCount)))
                            : RIBO_WILL_SHORTAGE_DESTROY_COUNT
                    }))
                    : [],
                white: (cs.riboRepaymentsByPlayer && Array.isArray(cs.riboRepaymentsByPlayer.white))
                    ? cs.riboRepaymentsByPlayer.white.map((entry) => ({
                        remainingOwnerTurns: Number.isFinite(Number(entry && entry.remainingOwnerTurns))
                            ? Math.max(0, Math.floor(Number(entry.remainingOwnerTurns)))
                            : RIBO_WILL_OWNER_TURNS,
                        repaymentAmount: Number.isFinite(Number(entry && entry.repaymentAmount))
                            ? Math.max(0, Math.floor(Number(entry.repaymentAmount)))
                            : RIBO_WILL_REPAYMENT_AMOUNT,
                        shortageDestroyCount: Number.isFinite(Number(entry && entry.shortageDestroyCount))
                            ? Math.max(0, Math.floor(Number(entry.shortageDestroyCount)))
                            : RIBO_WILL_SHORTAGE_DESTROY_COUNT
                    }))
                    : []
            },
            extraPlaceRemainingByPlayer: { ...cs.extraPlaceRemainingByPlayer },
            boardBonusByCell: (cs.boardBonusByCell && typeof cs.boardBonusByCell === 'object')
                ? { ...cs.boardBonusByCell }
                : {},
            boardBonusConsumedByCell: (cs.boardBonusConsumedByCell && typeof cs.boardBonusConsumedByCell === 'object')
                ? { ...cs.boardBonusConsumedByCell }
                : {},
            initialDeckSize: Number.isFinite(cs.initialDeckSize) ? cs.initialDeckSize : decks.black.length,
            initialDeckSizeByPlayer,
            reshuffleRequiresFullCycle: cs.reshuffleRequiresFullCycle !== false,

            // Breeding runtime state
            breedingFrontierByAnchorId: (cs.breedingFrontierByAnchorId && typeof cs.breedingFrontierByAnchorId === 'object')
                ? Object.fromEntries(Object.entries(cs.breedingFrontierByAnchorId).map(([k, arr]) => [
                    String(k),
                    Array.isArray(arr) ? arr.map(p => ({ row: p.row, col: p.col })) : []
                ]))
                : {},
            breedingSproutByOwner: {
                black: (cs.breedingSproutByOwner && Array.isArray(cs.breedingSproutByOwner.black))
                    ? cs.breedingSproutByOwner.black.map(p => ({ row: p.row, col: p.col }))
                    : [],
                white: (cs.breedingSproutByOwner && Array.isArray(cs.breedingSproutByOwner.white))
                    ? cs.breedingSproutByOwner.white.map(p => ({ row: p.row, col: p.col }))
                    : []
            },
            _breedingSproutClearedTokenByOwner: (cs._breedingSproutClearedTokenByOwner && typeof cs._breedingSproutClearedTokenByOwner === 'object')
                ? {
                    black: cs._breedingSproutClearedTokenByOwner.black || null,
                    white: cs._breedingSproutClearedTokenByOwner.white || null
                }
                : { black: null, white: null }
        };
    }

    /**
     * Deal initial hands
     * @param {Object} cardState
     * @param {Object} [prng]
     */
    function dealInitialHands(cardState, prng) {
        // Keep API for compatibility. Current policy intentionally performs no initial draw.
        // eslint-disable-next-line no-unused-vars
        const p = prng || defaultPrng;
        // Reset turn counts to 0 so first onTurnStart increments to 1.
        cardState.turnCountByPlayer['black'] = 0;
        cardState.turnCountByPlayer['white'] = 0;
    }

    /**
     * Initialize a complete game state with deterministic PRNG.
     * This function ensures that PRNG consumption order is fixed:
     * 1. Deck generation (shuffle for guaranteed cards per type)
     * 2. Deck final shuffle
     * 3. No initial hand draw (policy)
     * 
     * For online/replay, both client and server should call this with the same seed.
     * 
     * @param {Object} prng - PRNG object (required for determinism)
     * @returns {{ cardState: Object, prngState: Object }}
     */
    function initGame(prng) {
        if (!prng || typeof prng.shuffle !== 'function') {
            throw new Error('initGame requires a PRNG object for deterministic initialization');
        }

        // Step 1: Create card state (consumes PRNG for deck generation)
        const cardState = createCardState(prng);

        // Step 2: Apply start-of-game hand policy (currently no initial draw)
        dealInitialHands(cardState, prng);

        // Return card state and PRNG state for serialization
        return {
            cardState,
            prngState: typeof prng.getState === 'function' ? prng.getState() : null
        };
    }

    /**
     * Add a marker to the unified markers array and sync to legacy arrays.
     * This is the primary method for adding special stones and bombs.
     * 
     * @param {Object} cardState - Card state
     * @param {string} kind - 'specialStone' or 'bomb'
     * @param {number} row
     * @param {number} col
     * @param {string} owner - 'black' or 'white'
     * @param {Object} data - Additional data (type, remainingTurns, etc.)
     * @returns {Object} The created marker
     */
    function addMarker(cardState, kind, row, col, owner, data) {
        ensureMarkers(cardState);
        const id = cardState._nextMarkerId || 1;
        cardState._nextMarkerId = id + 1;

        // Ensure createdSeq counter exists
        if (typeof cardState._nextCreatedSeq === 'undefined') cardState._nextCreatedSeq = 1;
        const createdSeq = cardState._nextCreatedSeq++;

        const marker = {
            id,
            row,
            col,
            kind,
            owner,
            createdSeq,
            data: data || {}
        };

        cardState.markers.push(marker);

        // Emit a presentation event so UI can apply special visuals immediately.
        // This avoids "one-turn late" visuals when render is skipped during playback.
        try {
            var BoardPresentation = (typeof require === 'function') ? require('./presentation') : null;
            let special = null;
            let timer = null;
            if (kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) {
                special = data && data.type ? data.type : null;
                timer = (data && typeof data.remainingOwnerTurns === 'number') ? data.remainingOwnerTurns : null;
            } else if (kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb')) {
                special = 'TIME_BOMB';
                timer = (data && typeof data.remainingTurns === 'number') ? data.remainingTurns : null;
            }
            if (special && BoardPresentation && typeof BoardPresentation.emitPresentationEvent === 'function') {
                BoardPresentation.emitPresentationEvent(cardState, { type: 'STATUS_APPLIED', row, col, meta: { special, timer, owner } });
            }

            // Fix: When a marker is created as part of placement effects, it can occur AFTER the SPAWN event
            // for the placed disc (BoardOps.spawnAt). In that case, the UI may briefly show a normal disc
            // until STATUS_APPLIED runs and finds the disc.
            //
            // Per 03-visual-rulebook.v2 §1.6, a placed special stone must show its final PNG look immediately.
            // Backfill the most recent matching SPAWN event's meta so the disc is created already-special.
            if (special && cardState) {
                const currentActionId = (cardState._currentActionMeta && cardState._currentActionMeta.actionId) || null;
                const persist = Array.isArray(cardState._presentationEventsPersist) ? cardState._presentationEventsPersist : [];
                const live = Array.isArray(cardState.presentationEvents) ? cardState.presentationEvents : [];
                const patchSpawnMeta = (arr) => {
                    for (let i = arr.length - 1; i >= 0; i--) {
                        const ev = arr[i];
                        if (!ev || ev.type !== 'SPAWN') continue;
                        if (ev.row !== row || ev.col !== col) continue;
                        if (currentActionId && ev.actionId && ev.actionId !== currentActionId) continue;
                        ev.meta = Object.assign({}, ev.meta || {}, { special, timer, owner });
                        return true;
                    }
                    return false;
                };
                // Patch persisted buffer first (usually the one the UI consumes), then the live buffer (may be same refs).
                if (!patchSpawnMeta(persist)) patchSpawnMeta(live);
            }
        } catch (e) { /* ignore presentation failures */ }

        return marker;
    }

    /**
     * Remove a marker by id and sync to legacy arrays
     * @param {Object} cardState
     * @param {number} markerId
     * @returns {boolean} true if removed
     */
    function removeMarkerById(cardState, markerId) {
        if (!cardState.markers) return false;

        const index = cardState.markers.findIndex(m => m.id === markerId);
        if (index === -1) return false;

        const marker = cardState.markers[index];
        cardState.markers.splice(index, 1);

        return true;
    }

    /**
     * Draw a card
     * @param {Object} cardState 
     * @param {string} playerKey - 'black' or 'white'
     * @param {Object} [prng] 
     * @returns {string|null} Drawn card ID
     */
    function commitDraw(cardState, playerKey, prng) {
        const p = prng || defaultPrng;
        const decks = (cardState && cardState.decks && typeof cardState.decks === 'object') ? cardState.decks : null;
        const playerDeck = (decks && Array.isArray(decks[playerKey]))
            ? decks[playerKey]
            : (Array.isArray(cardState.deck) ? cardState.deck : null);
        if (!playerDeck) return null;

        // Check if hand is at max capacity
        if (cardState.hands[playerKey].length >= MAX_HAND_SIZE) {
            return null; // Hand full, cannot draw
        }

        // No reshuffle policy: if deck is empty, draw fails.
        if (playerDeck.length === 0) {
            return null;
        }

        if (playerDeck.length > 0) {
            const cardId = playerDeck.pop();
            cardState.hands[playerKey].push(cardId);
            return cardId;
        }
        return null;
    }

    /**
     * Get card definition
     * @param {string} cardId
     * @returns {Object|null}
     */
    function getCardDef(cardId) {
        if (CardDefsModule && typeof CardDefsModule.getCardDef === 'function') {
            return CardDefsModule.getCardDef(cardId);
        }
        return CARD_DEFS.find(c => c.id === cardId) || null;
    }

    /**
     * Get card type
     * @param {string} cardId
     * @returns {string|null}
     */
    function getCardType(cardId) {
        if (CardDefsModule && typeof CardDefsModule.getCardType === 'function') {
            return CardDefsModule.getCardType(cardId);
        }
        return CARD_TYPE_BY_ID[cardId] || null;
    }

    function getCardDisplayName(cardId) {
        if (CardDefsModule && typeof CardDefsModule.getCardDisplayName === 'function') {
            return CardDefsModule.getCardDisplayName(cardId);
        }
        const def = getCardDef(cardId);
        return def ? def.name : '';
    }

    function getCardCodeName(displayName) {
        if (CardDefsModule && typeof CardDefsModule.getCardCodeName === 'function') {
            return CardDefsModule.getCardCodeName(displayName);
        }
        const def = CARD_DEFS.find(c => c.name === displayName);
        return def ? def.id : null;
    }

    /**
     * Get card cost
     * @param {string} cardId
     * @returns {number}
     */
    function getCardCost(cardId) {
        if (CardCostsModule && typeof CardCostsModule.getCardCost === 'function') {
            return CardCostsModule.getCardCost(cardId);
        }
        const def = getCardDef(cardId);
        return def ? def.cost : 0;
    }

    /**
     * Check if card can be used
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {string} cardId
     * @returns {boolean}
     */
    function canUseCard(cardState, playerKey, cardId) {
        if (cardState.hasUsedCardThisTurnByPlayer[playerKey]) return false;
        if (!cardState.hands[playerKey].includes(cardId)) return false;
        const cost = getCardCost(cardId);
        if (cardState.charge[playerKey] < cost) return false;
        const cardType = getCardType(cardId);
        if (cardType === 'RIBO_WILL' && Number(cardState.turnIndex || 0) < RIBO_WILL_UNLOCK_TURN_INDEX) {
            return false;
        }
        return true;
    }

    function resolveCoreLogicForCards() {
        if (typeof require === 'function') {
            try {
                return require('./core');
            } catch (e) {
                // fall through
            }
        }
        try {
            if (typeof CoreLogic !== 'undefined' && CoreLogic) return CoreLogic;
        } catch (e) { /* ignore */ }
        try {
            if (typeof Core !== 'undefined' && Core) return Core;
        } catch (e) { /* ignore */ }
        return null;
    }

    function hasStandardLegalMoveForPlayer(cardState, gameState, playerKey) {
        if (!gameState || !Array.isArray(gameState.board)) return false;

        const core = resolveCoreLogicForCards();
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const context = getCardContext(cardState);

        if (core && typeof core.hasLegalMove === 'function') {
            try {
                return !!core.hasLegalMove(gameState, playerVal, context);
            } catch (e) {
                // fall through
            }
        }

        if (core && typeof core.getLegalMoves === 'function') {
            try {
                const legal = core.getLegalMoves(gameState, playerVal, context);
                return Array.isArray(legal) && legal.length > 0;
            } catch (e) {
                // fall through
            }
        }

        if (core && typeof core.getFlipsWithContext === 'function') {
            try {
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 8; col++) {
                        if (getCellValueForCard(gameState, row, col) !== EMPTY) continue;
                        if (isBlockedCell(cardState, row, col, gameState)) continue;
                        const flips = core.getFlipsWithContext(gameState, row, col, playerVal, context);
                        if (Array.isArray(flips) && flips.length > 0) return true;
                    }
                }
                const expansions = getExpansionDescriptorsForCard(gameState);
                for (const expansion of expansions) {
                    if (!expansion || !Number.isInteger(expansion.row) || !Number.isInteger(expansion.col)) continue;
                    if (getCellValueForCard(gameState, expansion.row, expansion.col) !== EMPTY) continue;
                    if (isBlockedCell(cardState, expansion.row, expansion.col, gameState)) continue;
                    const flips = core.getFlipsWithContext(gameState, expansion.row, expansion.col, playerVal, context);
                    if (Array.isArray(flips) && flips.length > 0) return true;
                }
            } catch (e) {
                return false;
            }
        }

        return false;
    }

    function _ensureHandDestroyFlags(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.hasDestroyedCardThisTurnByPlayer || typeof cardState.hasDestroyedCardThisTurnByPlayer !== 'object') {
            cardState.hasDestroyedCardThisTurnByPlayer = { black: false, white: false };
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.hasDestroyedCardThisTurnByPlayer, 'black')) {
            cardState.hasDestroyedCardThisTurnByPlayer.black = false;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.hasDestroyedCardThisTurnByPlayer, 'white')) {
            cardState.hasDestroyedCardThisTurnByPlayer.white = false;
        }
    }

    function destroyHandCard(cardState, playerKey, cardId, opts) {
        if (!cardState || !cardState.hands) return { applied: false, reason: 'invalid_state' };
        const ownerKey = playerKey === 'white' ? 'white' : 'black';
        const hand = Array.isArray(cardState.hands[ownerKey]) ? cardState.hands[ownerKey] : null;
        if (!hand) return { applied: false, reason: 'invalid_hand' };

        _ensureHandDestroyFlags(cardState);

        const index = hand.indexOf(cardId);
        if (index < 0) return { applied: false, reason: 'card_not_in_hand' };

        const destroyedCardId = hand[index];
        hand.splice(index, 1);
        if (!Array.isArray(cardState.discard)) cardState.discard = [];
        cardState.discard.push(destroyedCardId);
        cardState.hasDestroyedCardThisTurnByPlayer[ownerKey] = true;

        return { applied: true, destroyedCardId };
    }

    /**
     * Get list of usable card ids for current state (including target availability).
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey
     * @returns {string[]}
     */
    function getUsableCardIds(cardState, gameState, playerKey) {
        if (!cardState || !cardState.hands || !cardState.hands[playerKey]) return [];
        const hand = cardState.hands[playerKey] || [];
        const res = [];

        for (const cardId of hand) {
            if (!canUseCard(cardState, playerKey, cardId)) continue;
            const def = getCardDef(cardId);
            if (!def) continue;
            const type = def.type;

            if (type === 'SELL_CARD_WILL') {
                // Must have at least one other card to sell after consuming this card.
                if (hand.length <= 1) continue;
            }
            if (type === 'CONDEMN_WILL') {
                // Must have at least one opponent hand card to destroy.
                const opponentKey = playerKey === 'black' ? 'white' : 'black';
                const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey])) ? cardState.hands[opponentKey] : [];
                if (opponentHand.length === 0) continue;
            }

            // Cards that require valid targets
            if (gameState) {
                if (type === 'LAST_RESORT') {
                    const hasLegalMove = hasStandardLegalMoveForPlayer(cardState, gameState, playerKey);
                    if (hasLegalMove) continue;
                }
                if (type === 'TEMPT_WILL') {
                    const targets = getTemptWillTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'TRAP_WILL') {
                    const targets = getTrapTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'GUARD_WILL' || type === 'GUARDIAN_GOD') {
                    const targets = getGuardTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'HYPERACTIVE_INHERIT_WILL') {
                    const targets = getHyperactiveInheritTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'EXTEND_LIFE_WILL') {
                    const targets = getExtendLifeTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'CORROSION_WILL') {
                    const targets = getCorrosionTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'TIME_BOMB') {
                    const targets = getTimeBombTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'TELEPORT_WILL') {
                    const targets = getTeleportTargets(cardState, gameState);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'CELL_TELEPORT_WILL') {
                    const targets = getCellTeleportTargets(cardState, gameState);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'SUPER_BUOYANCY_WILL') {
                    const targets = getSuperBuoyancyTargets(cardState, gameState);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'SUPER_GRAVITY_WILL') {
                    const targets = getSuperGravityTargets(cardState, gameState);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'CLONE_WILL') {
                    const targets = getCloneTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'SPLIT_WILL') {
                    const targets = getSplitTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'POSITION_SWAP_WILL') {
                    let occupied = 0;
                    for (let r = 0; r < 8; r++) {
                        for (let c = 0; c < 8; c++) {
                            if (gameState.board[r][c] !== EMPTY) occupied++;
                        }
                    }
                    if (occupied < 2) continue;
                }
                if (type === 'BOARD_EXPANSION_WILL') {
                    const targets = getBoardExpansionTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'BOARD_EXPANSION_GOD') {
                    const targets = getBoardExpansionGodTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length < 2) continue;
                }
                if (type === 'BLOCKADE_WILL') {
                    const targets = getBlockadeTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'METEOR_WILL') {
                    const targets = getMeteorTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (CardSelectorsModule) {
                    if (type === 'DESTROY_ONE_STONE' && typeof CardSelectorsModule.getDestroyTargets === 'function') {
                        const targets = CardSelectorsModule.getDestroyTargets(cardState, gameState);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'STRONG_WIND_WILL' && typeof CardSelectorsModule.getStrongWindTargets === 'function') {
                        const targets = CardSelectorsModule.getStrongWindTargets(cardState, gameState);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'SUPER_BUOYANCY_WILL' && typeof CardSelectorsModule.getSuperBuoyancyTargets === 'function') {
                        const targets = CardSelectorsModule.getSuperBuoyancyTargets(cardState, gameState);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'SUPER_GRAVITY_WILL' && typeof CardSelectorsModule.getSuperGravityTargets === 'function') {
                        const targets = CardSelectorsModule.getSuperGravityTargets(cardState, gameState);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'SACRIFICE_WILL' && typeof CardSelectorsModule.getSacrificeTargets === 'function') {
                        const targets = CardSelectorsModule.getSacrificeTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'SWAP_WITH_ENEMY' && typeof CardSelectorsModule.getSwapTargets === 'function') {
                        const targets = CardSelectorsModule.getSwapTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'POSITION_SWAP_WILL' && typeof CardSelectorsModule.getPositionSwapTargets === 'function') {
                        const targets = CardSelectorsModule.getPositionSwapTargets(cardState, gameState, playerKey, null);
                        if (!targets || targets.length < 2) continue;
                    }
                    if (type === 'TRAP_WILL' && typeof CardSelectorsModule.getTrapTargets === 'function') {
                        const targets = CardSelectorsModule.getTrapTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if ((type === 'GUARD_WILL' || type === 'GUARDIAN_GOD') && typeof CardSelectorsModule.getGuardTargets === 'function') {
                        const targets = CardSelectorsModule.getGuardTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'HYPERACTIVE_INHERIT_WILL' && typeof CardSelectorsModule.getHyperactiveInheritTargets === 'function') {
                        const targets = CardSelectorsModule.getHyperactiveInheritTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'EXTEND_LIFE_WILL' && typeof CardSelectorsModule.getExtendLifeTargets === 'function') {
                        const targets = CardSelectorsModule.getExtendLifeTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'TIME_BOMB' && typeof CardSelectorsModule.getTimeBombTargets === 'function') {
                        const targets = CardSelectorsModule.getTimeBombTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'TELEPORT_WILL' && typeof CardSelectorsModule.getTeleportTargets === 'function') {
                        const targets = CardSelectorsModule.getTeleportTargets(cardState, gameState);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'CELL_TELEPORT_WILL' && typeof CardSelectorsModule.getCellTeleportTargets === 'function') {
                        const targets = CardSelectorsModule.getCellTeleportTargets(cardState, gameState);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'CLONE_WILL' && typeof CardSelectorsModule.getCloneTargets === 'function') {
                        const targets = CardSelectorsModule.getCloneTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'SPLIT_WILL' && typeof CardSelectorsModule.getSplitTargets === 'function') {
                        const targets = CardSelectorsModule.getSplitTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'BOARD_EXPANSION_GOD' && typeof CardSelectorsModule.getBoardExpansionGodTargets === 'function') {
                        const targets = CardSelectorsModule.getBoardExpansionGodTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length < 2) continue;
                    }
                    if (type === 'BLOCKADE_WILL' && typeof CardSelectorsModule.getBlockadeTargets === 'function') {
                        const targets = CardSelectorsModule.getBlockadeTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'METEOR_WILL' && typeof CardSelectorsModule.getMeteorTargets === 'function') {
                        const targets = CardSelectorsModule.getMeteorTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                }
            }

            res.push(cardId);
        }

        return res;
    }

    /**
     * Check if player has any usable card right now.
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey
     * @returns {boolean}
     */
    function hasUsableCard(cardState, gameState, playerKey) {
        return getUsableCardIds(cardState, gameState, playerKey).length > 0;
    }

    function createDeterministicRandomSource(seedText) {
        const text = String(seedText || '');
        let state = 2166136261 >>> 0;
        for (let i = 0; i < text.length; i++) {
            state ^= text.charCodeAt(i);
            state = Math.imul(state, 16777619) >>> 0;
        }
        return {
            random: function () {
                state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
                return state / 0x100000000;
            }
        };
    }

    function buildHeavenBlessingOffers(cardIdToExclude, prng, seedHint) {
        const pool = (CARD_DEFS || [])
            .filter(c => c && c.enabled !== false && c.id && c.id !== cardIdToExclude)
            .map(c => c.id);
        if (pool.length === 0) return [];

        const randomSource = (prng && typeof prng.random === 'function')
            ? prng
            : createDeterministicRandomSource(`heaven:${String(cardIdToExclude || '')}:${String(seedHint || '')}:${pool.length}`);
        const out = [];
        while (pool.length > 0 && out.length < HEAVEN_BLESSING_OFFER_COUNT) {
            const idx = Math.floor(randomSource.random() * pool.length);
            out.push(pool[idx]);
            pool.splice(idx, 1);
        }
        return out;
    }

    function buildCondemnOffers(cardState, playerKey) {
        if (!cardState || !cardState.hands) return [];
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const hand = Array.isArray(cardState.hands[opponentKey]) ? cardState.hands[opponentKey] : [];
        return hand.map((cardId, handIndex) => ({ handIndex, cardId }));
    }

    /**
     * Apply card usage (Remove from hand, consume charge, set pending effect)
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {string} cardId
     * @returns {boolean} success
     */
    function applyCardUsage(cardState, playerKey, cardId) {
        // Backward-compatible signature: (cardState, gameState, playerKey, cardId)
        // Detect if gameState is provided as 2nd argument.
        let gameState = null;
        let handOwnerKey = arguments[3];
        let opts = arguments[4];
        if (typeof playerKey === 'object' && playerKey && typeof cardId === 'string') {
            gameState = playerKey;
            playerKey = arguments[2];
            cardId = arguments[3];
            handOwnerKey = arguments[4];
            opts = arguments[5];
        }

        const chargeOwnerKey = playerKey;
        const handKey = (typeof handOwnerKey === 'string' && handOwnerKey) ? handOwnerKey : playerKey;

        const idx = cardState.hands[handKey].indexOf(cardId);
        if (idx === -1) return false;

        const cost = getCardCost(cardId);
        if (!(opts && opts.ignoreCost)) {
            if (cardState.charge[chargeOwnerKey] < cost) return false;
        }

        // Set pending effect (pre-checks must happen before mutating state)
        const cardType = getCardType(cardId);
        if (cardType === 'TEMPT_WILL') {
            if (!gameState) return false;
            const targets = getTemptWillTargets(cardState, gameState, chargeOwnerKey);
            if (!targets.length) return false;
        }
        if (cardType === 'STRONG_WIND_WILL') {
            if (!gameState) return false;
            const targets = getStrongWindTargets(cardState, gameState);
            if (!targets.length) return false;
        }
        if (cardType === 'SUPER_BUOYANCY_WILL') {
            if (!gameState) return false;
            const targets = getSuperBuoyancyTargets(cardState, gameState);
            if (!targets.length) return false;
        }
        if (cardType === 'SUPER_GRAVITY_WILL') {
            if (!gameState) return false;
            const targets = getSuperGravityTargets(cardState, gameState);
            if (!targets.length) return false;
        }
        if (cardType === 'SELL_CARD_WILL') {
            const remainingHandCount = (cardState.hands[handKey] ? cardState.hands[handKey].length : 0) - 1;
            if (remainingHandCount <= 0) return false;
        }
        if (cardType === 'LAST_RESORT') {
            if (!gameState) return false;
            if (hasStandardLegalMoveForPlayer(cardState, gameState, chargeOwnerKey)) return false;
        }
        if (cardType === 'RIBO_WILL' && Number(cardState.turnIndex || 0) < RIBO_WILL_UNLOCK_TURN_INDEX) {
            return false;
        }
        const heavenSeedHint = `${chargeOwnerKey}|${cardState.turnIndex || 0}|${(cardState.hands && Array.isArray(cardState.hands[chargeOwnerKey])) ? cardState.hands[chargeOwnerKey].length : 0}|${(cardState.charge && Number.isFinite(cardState.charge[chargeOwnerKey])) ? cardState.charge[chargeOwnerKey] : 0}`;
        const heavenOffers = (cardType === 'HEAVEN_BLESSING')
            ? buildHeavenBlessingOffers(cardId, opts && opts.prng, heavenSeedHint)
            : null;
        if (cardType === 'HEAVEN_BLESSING' && (!heavenOffers || heavenOffers.length === 0)) {
            return false;
        }
        const condemnOffers = (cardType === 'CONDEMN_WILL') ? buildCondemnOffers(cardState, chargeOwnerKey) : null;
        if (cardType === 'CONDEMN_WILL' && (!condemnOffers || condemnOffers.length === 0)) {
            return false;
        }
        if (cardType === 'TRAP_WILL') {
            if (!gameState) return false;
            const targets = getTrapTargets(cardState, gameState, chargeOwnerKey);
            if (!targets.length) return false;
        }
        if (cardType === 'GUARD_WILL' || cardType === 'GUARDIAN_GOD') {
            if (!gameState) return false;
            const targets = getGuardTargets(cardState, gameState, chargeOwnerKey);
            if (!targets.length) return false;
        }
        if (cardType === 'HYPERACTIVE_INHERIT_WILL') {
            if (!gameState) return false;
            const targets = getHyperactiveInheritTargets(cardState, gameState, chargeOwnerKey);
            if (!targets.length) return false;
        }
        if (cardType === 'EXTEND_LIFE_WILL') {
            if (!gameState) return false;
            const targets = getExtendLifeTargets(cardState, gameState, chargeOwnerKey);
            if (!targets.length) return false;
        }
        if (cardType === 'CORROSION_WILL') {
            if (!gameState) return false;
            const targets = getCorrosionTargets(cardState, gameState, chargeOwnerKey);
            if (!targets.length) return false;
        }
        if (cardType === 'TIME_BOMB') {
            if (!gameState) return false;
            const targets = getTimeBombTargets(cardState, gameState, chargeOwnerKey);
            if (!targets.length) return false;
        }
        if (cardType === 'TELEPORT_WILL') {
            if (!gameState) return false;
            const targets = getTeleportTargets(cardState, gameState);
            if (!targets.length) return false;
        }
        if (cardType === 'CELL_TELEPORT_WILL') {
            if (!gameState) return false;
            const targets = getCellTeleportTargets(cardState, gameState);
            if (!targets.length) return false;
        }
        if (cardType === 'CLONE_WILL') {
            if (!gameState) return false;
            const targets = getCloneTargets(cardState, gameState, chargeOwnerKey);
            if (!targets.length) return false;
        }
        if (cardType === 'SPLIT_WILL') {
            if (!gameState) return false;
            const targets = getSplitTargets(cardState, gameState, chargeOwnerKey);
            if (!targets.length) return false;
        }
        if (cardType === 'POSITION_SWAP_WILL') {
            if (!gameState) return false;
            const targets = getSelectableTargets({
                ...cardState,
                pendingEffectByPlayer: {
                    ...(cardState.pendingEffectByPlayer || { black: null, white: null }),
                    [chargeOwnerKey]: { type: 'POSITION_SWAP_WILL', stage: 'selectTarget' }
                }
            }, gameState, chargeOwnerKey);
            if (!targets || targets.length < 2) return false;
        }
        if (cardType === 'BOARD_EXPANSION_WILL') {
            if (!gameState) return false;
            const targets = getBoardExpansionTargets(cardState, gameState, chargeOwnerKey);
            if (!targets || targets.length === 0) return false;
        }
        if (cardType === 'BOARD_EXPANSION_GOD') {
            if (!gameState) return false;
            const targets = getBoardExpansionGodTargets(cardState, gameState, chargeOwnerKey);
            if (!targets || targets.length < 2) return false;
        }
        if (cardType === 'BLOCKADE_WILL') {
            if (!gameState) return false;
            const targets = getBlockadeTargets(cardState, gameState, chargeOwnerKey);
            if (!targets || targets.length === 0) return false;
        }
        if (cardType === 'METEOR_WILL') {
            if (!gameState) return false;
            const targets = getMeteorTargets(cardState, gameState, chargeOwnerKey);
            if (!targets || targets.length === 0) return false;
        }

        if (!(opts && opts.noConsume)) {
            // Remove from hand
            cardState.hands[handKey].splice(idx, 1);
            // Add to discard
            cardState.discard.push(cardId);
            // Consume charge
            addChargeValue(cardState, chargeOwnerKey, -cost, 'card_use_cost');
            // Set used flag
            cardState.hasUsedCardThisTurnByPlayer[chargeOwnerKey] = true;
            cardState.cardUseCountByPlayer = cardState.cardUseCountByPlayer || { black: 0, white: 0 };
            cardState.cardUseCountByPlayer[chargeOwnerKey] = (cardState.cardUseCountByPlayer[chargeOwnerKey] || 0) + 1;
        }
        cardState.lastUsedCardByPlayer[chargeOwnerKey] = cardId;

        const needsSelection =
            cardType === 'DESTROY_ONE_STONE' ||
            cardType === 'STRONG_WIND_WILL' ||
            cardType === 'SUPER_BUOYANCY_WILL' ||
            cardType === 'SUPER_GRAVITY_WILL' ||
            cardType === 'SACRIFICE_WILL' ||
            cardType === 'SELL_CARD_WILL' ||
            cardType === 'HEAVEN_BLESSING' ||
            cardType === 'CONDEMN_WILL' ||
            cardType === 'SWAP_WITH_ENEMY' ||
            cardType === 'POSITION_SWAP_WILL' ||
            cardType === 'TRAP_WILL' ||
            cardType === 'TEMPT_WILL' ||
            cardType === 'GUARD_WILL' ||
            cardType === 'GUARDIAN_GOD' ||
            cardType === 'HYPERACTIVE_INHERIT_WILL' ||
            cardType === 'EXTEND_LIFE_WILL' ||
            cardType === 'CORROSION_WILL' ||
            cardType === 'TIME_BOMB' ||
            cardType === 'TELEPORT_WILL' ||
            cardType === 'CELL_TELEPORT_WILL' ||
            cardType === 'CLONE_WILL' ||
            cardType === 'SPLIT_WILL' ||
            cardType === 'BOARD_EXPANSION_WILL' ||
            cardType === 'BOARD_EXPANSION_GOD' ||
            cardType === 'BLOCKADE_WILL' ||
            cardType === 'METEOR_WILL';
        cardState.pendingEffectByPlayer[chargeOwnerKey] = {
            type: cardType,
            cardId,
            stage: needsSelection ? 'selectTarget' : null,
            offers: heavenOffers || condemnOffers || undefined,
            selectedCount: cardType === 'SACRIFICE_WILL' ? 0 : (cardType === 'BOARD_EXPANSION_GOD' ? 0 : undefined),
            maxSelections: cardType === 'SACRIFICE_WILL' ? 3 : (cardType === 'BOARD_EXPANSION_GOD' ? 2 : undefined),
            selectedTargets: cardType === 'BOARD_EXPANSION_GOD' ? [] : undefined,
            placementsRemaining: cardType === 'LAST_RESORT' ? 2 : undefined
        };

        // Special handling for WORK_WILL: arm next placement for this player
        if (cardType === 'WORK_WILL') {
            if (!cardState.workNextPlacementArmedByPlayer) cardState.workNextPlacementArmedByPlayer = { black: false, white: false };
            cardState.workNextPlacementArmedByPlayer[chargeOwnerKey] = true;
            workDebugLog(cardState, '[WORK_DEBUG] Card played: WORK_WILL armed for', chargeOwnerKey);
        }

        const usedCardDef = getCardDef(cardId);

        // Emit a presentation event for card-use transport animation (UI playback).
        try {
            emitPresentationEvent(cardState, {
                type: 'CARD_USED',
                player: chargeOwnerKey,
                cardId: cardId,
                meta: {
                    owner: handKey,
                    cost: Number.isFinite(cost) ? cost : null,
                    name: (usedCardDef && usedCardDef.name) ? usedCardDef.name : null
                }
            });
        } catch (e) { /* ignore presentation emission failures */ }

        return true;
    }

    /**
     * Cancel a pending selection card (refund + return card to hand).
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {Object} [opts] - { refundCost?: boolean, resetUsage?: boolean, noConsume?: boolean }
     * @returns {{canceled: boolean, reason?: string, cardId?: string}}
     */
    function cancelPendingSelection(cardState, playerKey, opts) {
        if (!cardState || !cardState.pendingEffectByPlayer) return { canceled: false, reason: 'no_state' };
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.stage !== 'selectTarget') return { canceled: false, reason: 'not_pending' };
        if (pending.type !== 'DESTROY_ONE_STONE' && pending.type !== 'SACRIFICE_WILL' && pending.type !== 'POSITION_SWAP_WILL' && pending.type !== 'BOARD_EXPANSION_WILL' && pending.type !== 'BOARD_EXPANSION_GOD' && pending.type !== 'BLOCKADE_WILL' && pending.type !== 'METEOR_WILL') {
            return { canceled: false, reason: 'not_cancellable' };
        }

        // SACRIFICE_WILL can be "finished" after at least one selection.
        // In that case this is not a refund-cancel, just end the selection mode.
        if (pending.type === 'SACRIFICE_WILL' && Number(pending.selectedCount || 0) > 0) {
            cardState.pendingEffectByPlayer[playerKey] = null;
            return { canceled: true, cardId: pending.cardId, finished: true };
        }

        const cardId = pending.cardId;
        const cardDef = cardId ? getCardDef(cardId) : null;
        const cost = cardDef ? cardDef.cost : 0;
        const refundCost = !(opts && opts.refundCost === false);
        const resetUsage = !(opts && opts.resetUsage === false);
        const noConsume = !!(opts && opts.noConsume);

        if (refundCost && !noConsume) {
            addChargeValue(cardState, playerKey, cost, 'card_cancel_refund');
        }
        if (resetUsage && !noConsume) {
            cardState.hasUsedCardThisTurnByPlayer[playerKey] = false;
        }
        if (!noConsume) {
            cardState.cardUseCountByPlayer = cardState.cardUseCountByPlayer || { black: 0, white: 0 };
            cardState.cardUseCountByPlayer[playerKey] = Math.max(0, (cardState.cardUseCountByPlayer[playerKey] || 0) - 1);
        }

        if (cardId) {
            const handKey = cardState.hands[playerKey] ? playerKey : 'black';
            if (!cardState.hands[handKey].includes(cardId)) {
                cardState.hands[handKey].push(cardId);
            }
            const discardIndex = cardState.discard.lastIndexOf(cardId);
            if (discardIndex >= 0) {
                cardState.discard.splice(discardIndex, 1);
            }
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { canceled: true, cardId };
    }

    function getSpecialMarkerAt(cardState, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.getSpecialMarkerAt === 'function') {
            return CardUtilsModule.getSpecialMarkerAt(cardState, row, col);
        }
        const special = findSpecialMarkerAt(cardState, row, col);
        if (special) return { kind: 'specialStone', marker: special };
        const bomb = findBombMarkerAt(cardState, row, col);
        if (bomb) return { kind: 'bomb', marker: bomb };
        return null;
    }

    function isSpecialStoneAt(cardState, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.isSpecialStoneAt === 'function') {
            return CardUtilsModule.isSpecialStoneAt(cardState, row, col);
        }
        return !!getSpecialMarkerAt(cardState, row, col);
    }

    function getSpecialOwnerAt(cardState, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.getSpecialOwnerAt === 'function') {
            return CardUtilsModule.getSpecialOwnerAt(cardState, row, col);
        }
        const entry = getSpecialMarkerAt(cardState, row, col);
        if (!entry) return null;
        return entry.marker && entry.marker.owner ? entry.marker.owner : null;
    }

    function getTemptWillTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardTargets)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/targets') : globalThis.CardTargets;
                if (mod && typeof mod.getTemptWillTargets === 'function') {
                    return mod.getTemptWillTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const res = [];
        const hasGuardMarkerAt = (row, col) => getSpecialMarkers(cardState).some(m => (
            m &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'GUARD'
        ));
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (hasGuardMarkerAt(r, c)) continue;
                if (!isSpecialStoneAt(cardState, r, c)) continue;
                if (getSpecialOwnerAt(cardState, r, c) !== opponentKey) continue;
                if (gameState.board[r][c] === 0) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    function getTrapTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getTrapTargets === 'function') {
                    return mod.getTrapTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const playerVal = playerKey === 'black' ? P_BLACK : P_WHITE;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== playerVal) continue;
                const hasBomb = markers.some(m => m && m.row === r && m.col === c && m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb'));
                if (hasBomb) continue;
                const hasOwnTrap = markers.some(m => (
                    m &&
                    m.row === r &&
                    m.col === c &&
                    m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
                    m.owner === playerKey &&
                    m.data &&
                    m.data.type === 'TRAP'
                ));
                if (hasOwnTrap) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    function getGuardTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getGuardTargets === 'function') {
                    return mod.getGuardTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const playerVal = playerKey === 'black' ? P_BLACK : P_WHITE;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== playerVal) continue;
                const hasBomb = markers.some(m => m && m.row === r && m.col === c && m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb'));
                if (hasBomb) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    function getHyperactiveInheritTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getHyperactiveInheritTargets === 'function') {
                    return mod.getHyperactiveInheritTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }
        return getGuardTargets(cardState, gameState, playerKey);
    }

    // Return targets: only your own special stones that have a numeric remainingOwnerTurns > 0
    function getExtendLifeTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getExtendLifeTargets === 'function') {
                    return mod.getExtendLifeTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through
            }
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const m of markers) {
            if (!m || m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            if (m.owner !== playerKey) continue;
            const rem = (m.data && Number.isFinite(m.data.remainingOwnerTurns)) ? Number(m.data.remainingOwnerTurns) : null;
            if (!Number.isFinite(rem) || rem <= 0) continue;
            res.push({ row: m.row, col: m.col });
        }
        return res;
    }

    // Return targets: all timed special stones that have a numeric remainingOwnerTurns > 0
    function getCorrosionTargets(cardState, gameState, playerKey) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];
        for (const m of markers) {
            if (!m || m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            const rem = (m.data && Number.isFinite(m.data.remainingOwnerTurns)) ? Number(m.data.remainingOwnerTurns) : null;
            if (!Number.isFinite(rem) || rem <= 0) continue;
            res.push({ row: m.row, col: m.col });
        }
        return res;
    }

    function getTimeBombTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getTimeBombTargets === 'function') {
                    return mod.getTimeBombTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }
        return getGuardTargets(cardState, gameState, playerKey);
    }

    function getTeleportTargets(cardState, gameState) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getTeleportTargets === 'function') {
                    return mod.getTeleportTargets(cardState, gameState);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        let hasDestination = false;
        for (let r = 0; r < 8 && !hasDestination; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== EMPTY) continue;
                if (isBlockedCell(cardState, r, c, gameState)) continue;
                hasDestination = true;
                break;
            }
        }
        if (!hasDestination) return [];

        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === EMPTY) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    function getCloneTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getCloneTargets === 'function') {
                    return mod.getCloneTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const res = [];
        const hasSpawnSpace = (row, col) => {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = row + dr;
                    const nc = col + dc;
                    if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
                    if (gameState.board[nr][nc] !== EMPTY) continue;
                    if (isBlockedCell(cardState, nr, nc, gameState)) continue;
                    return true;
                }
            }
            return false;
        };

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== playerVal) continue;
                if (!hasSpawnSpace(r, c)) continue;
                res.push({ row: r, col: c });
            }
        }

        return res;
    }

    function getSplitTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getSplitTargets === 'function') {
                    return mod.getSplitTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        return getCloneTargets(cardState, gameState, playerKey);
    }

    function getBoardExpansionTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getBoardExpansionTargets === 'function') {
                    return mod.getBoardExpansionTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];

        const blockedEdgeTargets = new Set();
        const expansionCells = getExpansionDescriptorsForCard(gameState);
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (cell.col === -1 && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < 8) {
                blockedEdgeTargets.add(`${cell.row},0`);
            }
            if (cell.col === 8 && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < 8) {
                blockedEdgeTargets.add(`${cell.row},7`);
            }
        }

        const res = [];
        for (let r = 0; r < 8; r++) {
            if (!blockedEdgeTargets.has(`${r},0`)) {
                res.push({ row: r, col: 0, side: 'left' });
            }
            if (!blockedEdgeTargets.has(`${r},7`)) {
                res.push({ row: r, col: 7, side: 'right' });
            }
        }
        return res;
    }

    function getBoardExpansionGodCornerDescriptorsForCard() {
        return [
            {
                row: 0,
                col: 0,
                cells: [
                    { row: -1, col: 0 },
                    { row: -1, col: -1 },
                    { row: 0, col: -1 }
                ]
            },
            {
                row: 0,
                col: 7,
                cells: [
                    { row: -1, col: 7 },
                    { row: -1, col: 8 },
                    { row: 0, col: 8 }
                ]
            },
            {
                row: 7,
                col: 0,
                cells: [
                    { row: 8, col: 0 },
                    { row: 8, col: -1 },
                    { row: 7, col: -1 }
                ]
            },
            {
                row: 7,
                col: 7,
                cells: [
                    { row: 7, col: 8 },
                    { row: 8, col: 8 },
                    { row: 8, col: 7 }
                ]
            }
        ];
    }

    function getBoardExpansionGodPendingSelectionsForCard(pending) {
        const res = [];
        if (!pending || pending.type !== 'BOARD_EXPANSION_GOD') return res;
        if (pending.firstTarget && Number.isInteger(pending.firstTarget.row) && Number.isInteger(pending.firstTarget.col)) {
            res.push({ row: pending.firstTarget.row, col: pending.firstTarget.col });
        }
        if (Array.isArray(pending.selectedTargets)) {
            for (const target of pending.selectedTargets) {
                if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) continue;
                res.push({ row: target.row, col: target.col });
            }
        }
        const unique = [];
        const seen = new Set();
        for (const target of res) {
            const key = `${target.row},${target.col}`;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(target);
        }
        return unique;
    }

    function getBoardExpansionGodAdditionsForCard(row, col) {
        const corner = getBoardExpansionGodCornerDescriptorsForCard().find((entry) => entry && entry.row === row && entry.col === col);
        if (!corner || !Array.isArray(corner.cells)) return null;
        return corner.cells.map((cell) => ({ row: cell.row, col: cell.col }));
    }

    function getBoardExpansionWillCellDescriptorsForCard() {
        const cells = [];
        for (let row = 0; row < 8; row++) {
            cells.push({ row, col: -1, side: 'left' });
            cells.push({ row, col: 8, side: 'right' });
        }
        return cells;
    }

    function ensureExpansionCellForCard(gameState, row, col, owner) {
        if (isMainBoardCellForCard(row, col)) return true;
        if (!isExpansionCoordinateForCard(row, col)) return false;

        const currentValue = getCellValueForCard(gameState, row, col);
        if (currentValue !== null) {
            return setCellValueForCard(gameState, row, col, owner == null ? currentValue : owner);
        }

        const validExpansionTargets = [];
        validExpansionTargets.push(...getBoardExpansionWillCellDescriptorsForCard());
        for (const corner of getBoardExpansionGodCornerDescriptorsForCard()) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            for (const cell of corner.cells) {
                if (!cell) continue;
                validExpansionTargets.push({
                    row: cell.row,
                    col: cell.col,
                    side: resolveExpansionSideForCard(null, cell.row, cell.col)
                });
            }
        }

        const matched = validExpansionTargets.find((cell) => cell && cell.row === row && cell.col === col);
        if (!matched) return false;

        const cells = getExpansionDescriptorsForCard(gameState);
        cells.push({
            side: resolveExpansionSideForCard(matched.side, row, col),
            row,
            col,
            owner: normalizeExpansionOwnerForCard(owner)
        });
        writeExpansionDescriptorsForCard(gameState, cells);
        return true;
    }

    function getBoardExpansionGodTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getBoardExpansionGodTargets === 'function') {
                    return mod.getBoardExpansionGodTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];

        const occupied = new Set(
            getExpansionDescriptorsForCard(gameState).map((cell) => `${cell.row},${cell.col}`)
        );
        const pending = cardState && cardState.pendingEffectByPlayer
            ? cardState.pendingEffectByPlayer[playerKey]
            : null;
        const selectedKeys = new Set(
            getBoardExpansionGodPendingSelectionsForCard(pending).map((target) => `${target.row},${target.col}`)
        );

        const res = [];
        for (const corner of getBoardExpansionGodCornerDescriptorsForCard()) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            if (selectedKeys.has(`${corner.row},${corner.col}`)) continue;
            const hasOccupied = corner.cells.some((cell) => occupied.has(`${cell.row},${cell.col}`));
            if (hasOccupied) continue;
            res.push({ row: corner.row, col: corner.col });
        }
        return res;
    }

    function getCellTeleportDestinations(cardState, gameState) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getCellTeleportDestinations === 'function') {
                    return mod.getCellTeleportDestinations(cardState, gameState);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];

        const activeByKey = new Map();
        for (const cell of getExpansionDescriptorsForCard(gameState)) {
            if (!cell) continue;
            activeByKey.set(`${cell.row},${cell.col}`, cell);
        }

        const res = [];
        const seen = new Set();
        const pushCandidate = (row, col, side) => {
            const key = `${row},${col}`;
            if (seen.has(key)) return;
            seen.add(key);
            const activeCell = activeByKey.get(key) || null;
            const owner = activeCell ? normalizeExpansionOwnerForCard(activeCell.owner) : EMPTY;
            if (owner !== EMPTY) return;
            if (isBlockedCell(cardState, row, col, gameState)) return;
            res.push({ row, col, side: resolveExpansionSideForCard(side, row, col), active: !!activeCell });
        };

        for (const cell of getBoardExpansionWillCellDescriptorsForCard()) {
            if (!cell) continue;
            pushCandidate(cell.row, cell.col, cell.side);
        }
        for (const corner of getBoardExpansionGodCornerDescriptorsForCard()) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            for (const cell of corner.cells) {
                if (!cell) continue;
                pushCandidate(cell.row, cell.col, resolveExpansionSideForCard(null, cell.row, cell.col));
            }
        }

        return res;
    }

    function getCellTeleportTargets(cardState, gameState) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getCellTeleportTargets === 'function') {
                    return mod.getCellTeleportTargets(cardState, gameState);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        const destinations = getCellTeleportDestinations(cardState, gameState);
        if (!destinations.length) return [];

        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === EMPTY) continue;
                res.push({ row: r, col: c });
            }
        }

        const expansionCells = getExpansionDescriptorsForCard(gameState);
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (normalizeExpansionOwnerForCard(cell.owner) === EMPTY) continue;
            if (isMeteorHoleCell(cardState, cell.row, cell.col)) continue;
            res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function getBlockadeTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getBlockadeTargets === 'function') {
                    return mod.getBlockadeTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== EMPTY) continue;
                if (isBlockedCell(cardState, r, c, gameState)) continue;
                res.push({ row: r, col: c });
            }
        }
        const expansionCells = getExpansionDescriptorsForCard(gameState);
        for (const cell of expansionCells) {
            if (!cell || Number(cell.owner) !== EMPTY) continue;
            if (isBlockedCell(cardState, cell.row, cell.col, gameState)) continue;
            res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function getMeteorTargets(cardState, gameState, playerKey) {
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod && typeof mod.getMeteorTargets === 'function') {
                    return mod.getMeteorTargets(cardState, gameState, playerKey);
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        if (!gameState || !gameState.board || gameState.board.length !== 8) return [];
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (isMeteorHoleCell(cardState, r, c)) continue;
                res.push({ row: r, col: c });
            }
        }
        const expansionCells = getExpansionDescriptorsForCard(gameState);
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (isMeteorHoleCell(cardState, cell.row, cell.col)) continue;
            res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function applyTrapWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'TRAP_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getTrapTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        // Trap replaces any existing special marker at the target cell.
        removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone' });

        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'TRAP',
            armedForPlayer: opponentKey,
            hidden: true
        });

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col };
    }

    function processTrapEffects(cardState, gameState, activePlayerKey, options) {
        const opts = options || {};
        const expireOnOwnerTurnStart = !!opts.expireOnOwnerTurnStart;
        const res = { triggered: [], expired: [], disarmed: [] };
        if (!cardState || !gameState || !gameState.board) return res;

        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const specials = getSpecialMarkers(cardState).filter(m => m && m.data && m.data.type === 'TRAP');
        if (!specials.length) return res;

        for (const trap of specials) {
            const row = trap.row;
            const col = trap.col;
            const ownerKey = trap.owner === 'white' ? 'white' : 'black';
            const opponentKey = ownerKey === 'black' ? 'white' : 'black';
            const ownerVal = ownerKey === 'black' ? P_BLACK : P_WHITE;
            const activeVal = activePlayerKey === 'black' ? P_BLACK : P_WHITE;
            const cellVal = gameState.board[row][col];

            if (cellVal === EMPTY) {
                removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
                res.disarmed.push({ row, col, owner: ownerKey, reason: 'empty' });
                continue;
            }

            if (cellVal === ownerVal) {
                if (expireOnOwnerTurnStart && activePlayerKey === ownerKey) {
                    // Reveal just before destroy so both sides can read the trap icon at expiry.
                    emitPresentationEvent(cardState, {
                        type: 'STATUS_APPLIED',
                        row,
                        col,
                        meta: { special: 'TRAP_REVEAL', owner: ownerKey, reason: 'trap_expired_reveal' }
                    });
                    if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                        BoardOpsModule.destroyAt(cardState, gameState, row, col, 'TRAP_WILL', 'trap_expired', { special: 'TRAP_REVEAL', owner: ownerKey });
                    } else {
                        gameState.board[row][col] = EMPTY;
                        removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
                    }
                    res.expired.push({ row, col, owner: ownerKey });
                }
                continue;
            }

            if (activePlayerKey === opponentKey && cellVal === activeVal) {
                const victimKey = opponentKey;
                const victimCharge = Math.max(0, Number(cardState.charge[victimKey] || 0));
                setChargeValue(cardState, victimKey, 0, 'trap_confiscated');
                const gainedCharge = addChargeWithTotal(cardState, ownerKey, victimCharge);

                const victimHand = Array.isArray(cardState.hands[victimKey]) ? cardState.hands[victimKey] : [];
                const destroyedCards = victimHand.splice(0, victimHand.length);
                const destroyedCount = destroyedCards.length;
                if (destroyedCount > 0) {
                    if (!Array.isArray(cardState.discard)) cardState.discard = [];
                    cardState.discard.push(...destroyedCards);
                }

                removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
                res.triggered.push({
                    row,
                    col,
                    owner: ownerKey,
                    victim: victimKey,
                    stolenCharge: victimCharge,
                    gainedCharge,
                    stolenHandCount: destroyedCount,
                    destroyedHandCount: destroyedCount,
                    destroyedCardIds: destroyedCards.slice(),
                    toHandCount: 0,
                    toDeckCount: 0
                });
                continue;
            }

            removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
            res.disarmed.push({ row, col, owner: ownerKey, reason: 'changed_without_trigger' });
        }

        return res;
    }

    function applyTemptWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'TEMPT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        if (!isSpecialStoneAt(cardState, row, col)) return { applied: false, reason: 'not_special' };
        if (getSpecialOwnerAt(cardState, row, col) !== opponentKey) return { applied: false, reason: 'not_opponent_special' };
        if (gameState.board[row][col] === 0) return { applied: false, reason: 'empty' };
        const guarded = getSpecialMarkers(cardState).some(m => (
            m &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'GUARD'
        ));
        if (guarded) return { applied: false, reason: 'guarded' };

        // Use BoardOps.changeAt if available
        if (BoardOpsModule && typeof BoardOpsModule.changeAt === 'function') {
            BoardOpsModule.changeAt(cardState, gameState, row, col, playerKey, 'TEMPT_WILL', 'tempt_applied');
        } else {
            const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
            gameState.board[row][col] = playerVal;
        }

        // Transfer ownership metadata while preserving remaining turns/counters.
        let wasWork = false;
        const specialMarker = findSpecialMarkerAt(cardState, row, col);
        if (specialMarker) {
            wasWork = !!(specialMarker.data && specialMarker.data.type === 'WORK');
            specialMarker.owner = playerKey;
            if (specialMarker.data && specialMarker.data.expiresForPlayer !== undefined) {
                specialMarker.data.expiresForPlayer = playerKey;
            }
        }
        const bombMarker = findBombMarkerAt(cardState, row, col);
        if (bombMarker) {
            bombMarker.owner = playerKey;
        }

        // If this was a WORK anchor, STEAL ends the effect immediately.
        if (wasWork) {
            // Clear anchor position for previous owner
            if (cardState.workAnchorPosByPlayer && cardState.workAnchorPosByPlayer[opponentKey]) {
                cardState.workAnchorPosByPlayer[opponentKey] = null;
            }
            // Remove special WORK entries and any unified markers
            removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'WORK' });
            // Use centralized presentation event emission so action meta is filled consistently
            emitPresentationEvent(cardState, {
                type: 'WORK_REMOVED',
                row,
                col,
                ownerBefore: opponentKey,
                ownerAfter: playerKey,
                cause: 'TEMPT_WILL',
                reason: 'anchor_lost',
                removed: true,
                meta: { reason: 'anchor_lost' }
            });
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true };
    }

    function applyGuardWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || (pending.type !== 'GUARD_WILL' && pending.type !== 'GUARDIAN_GOD') || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getGuardTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const remainingOwnerTurns = pending.type === 'GUARDIAN_GOD'
            ? GUARDIAN_GOD_TURNS
            : GUARD_WILL_TURNS;

        removeMarkersAt(cardState, row, col, {
            kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
            type: 'GUARD',
            owner: playerKey
        });
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'GUARD',
            remainingOwnerTurns
        });
        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col };
    }

    function applyHyperactiveInheritWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'HYPERACTIVE_INHERIT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getHyperactiveInheritTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        removeMarkersAt(cardState, row, col, {
            kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
            type: 'INHERITED_HYPERACTIVE',
            owner: playerKey
        });

        cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'INHERITED_HYPERACTIVE',
            remainingOwnerTurns: INHERITED_HYPERACTIVE_TURNS,
            flipEvadeRemaining: 1,
            hyperactiveSeq: cardState.hyperactiveSeqCounter
        });

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col, remainingOwnerTurns: INHERITED_HYPERACTIVE_TURNS };
    }

    // Apply EXTEND_LIFE_WILL: double remainingOwnerTurns on chosen cell's own special markers (numeric remainingOwnerTurns only)
    function applyExtendLifeWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'EXTEND_LIFE_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getExtendLifeTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const specialsAtCell = getSpecialMarkers(cardState).filter((marker) => (
            marker &&
            marker.row === row &&
            marker.col === col &&
            marker.owner === playerKey &&
            marker.data &&
            Number.isFinite(marker.data.remainingOwnerTurns) &&
            Number(marker.data.remainingOwnerTurns) > 0
        ));
        if (!specialsAtCell.length) {
            return { applied: false, reason: 'no_duration' };
        }

        const primaryMarker = specialsAtCell.find((marker) => {
            const type = marker && marker.data ? marker.data.type : null;
            return type !== 'GUARD';
        }) || specialsAtCell[0];

        let prev = 0;
        let doubled = 0;
        for (const special of specialsAtCell) {
            const onePrev = Number(special.data.remainingOwnerTurns || 0);
            const oneDoubled = Math.max(1, Math.trunc(onePrev * 2));
            special.data.remainingOwnerTurns = oneDoubled;
            if (special === primaryMarker) {
                prev = onePrev;
                doubled = oneDoubled;
            }
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col, previousRemainingOwnerTurns: prev, newRemainingOwnerTurns: doubled };
    }

    function applyCorrosionWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'CORROSION_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending', affectedCount: 0, details: [] };
        }

        const targets = getCorrosionTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) {
            return { applied: false, reason: 'invalid_target', affectedCount: 0, details: [] };
        }

        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const details = [];
        for (const marker of markers) {
            if (!marker || marker.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) continue;
            if (marker.row !== row || marker.col !== col) continue;
            if (!marker.data || !Number.isFinite(marker.data.remainingOwnerTurns)) continue;

            const before = Number(marker.data.remainingOwnerTurns);
            if (before <= 0) continue;

            const after = Math.max(1, Math.trunc(before / 2));
            marker.data.remainingOwnerTurns = after;
            details.push({
                row: marker.row,
                col: marker.col,
                owner: marker.owner || null,
                special: marker.data && marker.data.type ? marker.data.type : null,
                previousRemainingOwnerTurns: before,
                newRemainingOwnerTurns: after
            });
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, affectedCount: details.length, details };
    }

    function applyTimeBombWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'TIME_BOMB' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getTimeBombTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        // Convert selected stone into a bomb marker.
        removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone' });
        const existingBomb = findBombMarkerAt(cardState, row, col);
        if (existingBomb) return { applied: false, reason: 'exists' };

        addMarker(cardState, 'bomb', row, col, playerKey, {
            remainingTurns: TIME_BOMB_TURNS,
            placedTurn: cardState.turnIndex
        });

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col };
    }

    function cloneMarkerData(data) {
        if (!data || typeof data !== 'object') return {};
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (e) {
            return { ...data };
        }
    }

    function applyCloneWill(cardState, gameState, playerKey, row, col, prng) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'CLONE_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const targets = getCloneTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const sourceVal = gameState.board[row][col];
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        if (sourceVal !== playerVal) return { applied: false, reason: 'not_owner_stone' };

        const sourceSpecials = getSpecialMarkers(cardState).filter(m => m && m.row === row && m.col === col);
        const sourceBombs = getBombMarkers(cardState).filter(m => m && m.row === row && m.col === col);

        const spawnTargets = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const tr = row + dr;
                const tc = col + dc;
                if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) continue;
                if (gameState.board[tr][tc] !== EMPTY) continue;
                if (isBlockedCell(cardState, tr, tc, gameState)) continue;
                spawnTargets.push({ row: tr, col: tc });
            }
        }

        if (!spawnTargets.length) return { applied: false, reason: 'no_space' };

        const p = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const randomIndexRaw = Math.floor(p.random() * spawnTargets.length);
        const randomIndex = Number.isInteger(randomIndexRaw)
            ? Math.max(0, Math.min(spawnTargets.length - 1, randomIndexRaw))
            : 0;
        const selectedTarget = spawnTargets[randomIndex] || spawnTargets[0];

        const spawned = [];
        const target = selectedTarget;
        if (BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function') {
            BoardOpsModule.spawnAt(cardState, gameState, target.row, target.col, playerKey, 'CLONE_WILL', 'clone_spawn', {
                fromRow: row,
                fromCol: col,
                cloneVisual: true
            });
        } else {
            gameState.board[target.row][target.col] = playerVal;
        }

        for (const sm of sourceSpecials) {
            const owner = sm.owner === 'white' ? 'white' : 'black';
            addMarker(cardState, 'specialStone', target.row, target.col, owner, cloneMarkerData(sm.data || {}));
        }
        for (const bm of sourceBombs) {
            const owner = bm.owner === 'white' ? 'white' : 'black';
            addMarker(cardState, 'bomb', target.row, target.col, owner, cloneMarkerData(bm.data || {}));
        }
        spawned.push({ row: target.row, col: target.col });

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, source: { row, col }, spawned };
    }

    function halveDurationValueForSplit(value) {
        const current = Number(value);
        if (!Number.isFinite(current) || current <= 0) return value;
        return Math.max(1, Math.trunc(current / 2));
    }

    function halveDurationOnMarkerDataForSplit(data, kind) {
        if (!data || typeof data !== 'object') return null;
        if (kind === 'specialStone') {
            if (!Number.isFinite(Number(data.remainingOwnerTurns)) || Number(data.remainingOwnerTurns) <= 0) return null;
            const previous = Number(data.remainingOwnerTurns);
            const next = halveDurationValueForSplit(previous);
            data.remainingOwnerTurns = next;
            return {
                durationKey: 'remainingOwnerTurns',
                previousDuration: previous,
                nextDuration: next
            };
        }
        if (kind === 'bomb') {
            if (!Number.isFinite(Number(data.remainingTurns)) || Number(data.remainingTurns) <= 0) return null;
            const previous = Number(data.remainingTurns);
            const next = halveDurationValueForSplit(previous);
            data.remainingTurns = next;
            return {
                durationKey: 'remainingTurns',
                previousDuration: previous,
                nextDuration: next
            };
        }
        return null;
    }

    function applySplitWill(cardState, gameState, playerKey, row, col, prng) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'SPLIT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const targets = getSplitTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const sourceVal = gameState.board[row][col];
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        if (sourceVal !== playerVal) return { applied: false, reason: 'not_owner_stone' };

        const sourceSpecials = getSpecialMarkers(cardState).filter(m => m && m.row === row && m.col === col);
        const sourceBombs = getBombMarkers(cardState).filter(m => m && m.row === row && m.col === col);

        const spawnTargets = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const tr = row + dr;
                const tc = col + dc;
                if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) continue;
                if (gameState.board[tr][tc] !== EMPTY) continue;
                if (isBlockedCell(cardState, tr, tc, gameState)) continue;
                spawnTargets.push({ row: tr, col: tc });
            }
        }

        if (!spawnTargets.length) return { applied: false, reason: 'no_space' };

        const p = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const randomIndexRaw = Math.floor(p.random() * spawnTargets.length);
        const randomIndex = Number.isInteger(randomIndexRaw)
            ? Math.max(0, Math.min(spawnTargets.length - 1, randomIndexRaw))
            : 0;
        const selectedTarget = spawnTargets[randomIndex] || spawnTargets[0];

        const spawned = [];
        const target = selectedTarget;
        if (BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function') {
            BoardOpsModule.spawnAt(cardState, gameState, target.row, target.col, playerKey, 'SPLIT_WILL', 'split_spawn', {
                fromRow: row,
                fromCol: col,
                cloneVisual: true
            });
        } else {
            gameState.board[target.row][target.col] = playerVal;
        }

        const durationChanges = [];
        for (const sm of sourceSpecials) {
            const owner = sm.owner === 'white' ? 'white' : 'black';
            const sourceData = cloneMarkerData(sm.data || {});
            const duration = halveDurationOnMarkerDataForSplit(sourceData, 'specialStone');
            sm.data = sourceData;
            addMarker(cardState, 'specialStone', target.row, target.col, owner, cloneMarkerData(sourceData));
            if (duration) {
                durationChanges.push({
                    row,
                    col,
                    owner,
                    special: sourceData.type || null,
                    durationKey: duration.durationKey,
                    previousDuration: duration.previousDuration,
                    nextDuration: duration.nextDuration
                });
            }
        }
        for (const bm of sourceBombs) {
            const owner = bm.owner === 'white' ? 'white' : 'black';
            const sourceData = cloneMarkerData(bm.data || {});
            const duration = halveDurationOnMarkerDataForSplit(sourceData, 'bomb');
            bm.data = sourceData;
            addMarker(cardState, 'bomb', target.row, target.col, owner, cloneMarkerData(sourceData));
            if (duration) {
                durationChanges.push({
                    row,
                    col,
                    owner,
                    special: 'TIME_BOMB',
                    durationKey: duration.durationKey,
                    previousDuration: duration.previousDuration,
                    nextDuration: duration.nextDuration
                });
            }
        }
        spawned.push({ row: target.row, col: target.col });

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, source: { row, col }, spawned, durationChanges };
    }

    function applyBoardExpansionWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'BOARD_EXPANSION_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getBoardExpansionTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const side = col === 0 ? 'left' : (col === 7 ? 'right' : null);
        if (!side || !Number.isInteger(row) || row < 0 || row >= 8) {
            return { applied: false, reason: 'invalid_target' };
        }

        const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
        const cells = getExpansionDescriptorsForCard(gameState);
        const targetCol = side === 'left' ? -1 : 8;
        const alreadyExists = cells.some((cell) => cell && cell.row === row && cell.col === targetCol);
        if (alreadyExists) return { applied: false, reason: 'already_expanded' };

        cells.push({ side, row, col: targetCol, owner: EMPTY });

        boardExpansion.cells = cells.map((cell) => ({
            side: resolveExpansionSideForCard(cell.side, cell.row, cell.col),
            row: cell.row,
            col: cell.col,
            owner: normalizeExpansionOwnerForCard(cell.owner)
        }));
        syncLegacyExpansionFieldsForCard(boardExpansion);

        boardExpansion.usedByPlayer[playerKey] = true;

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, side, row, col: targetCol };
    }

    function applyBoardExpansionGod(cardState, gameState, playerKey, row, col) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'BOARD_EXPANSION_GOD' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const targets = getBoardExpansionGodTargets(cardState, gameState, playerKey);
        const allowed = targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const maxSelections = 2;
        const selectedTargets = getBoardExpansionGodPendingSelectionsForCard(pending);
        const nextSelections = selectedTargets.concat({ row, col }).map((target) => ({ row: target.row, col: target.col }));

        if (nextSelections.length < maxSelections) {
            pending.selectedTargets = nextSelections;
            pending.selectedCount = pending.selectedTargets.length;
            pending.maxSelections = maxSelections;
            return {
                applied: true,
                completed: false,
                selectedCount: pending.selectedCount,
                maxSelections,
                remainingSelections: maxSelections - pending.selectedCount,
                target: { row, col },
                selectedTargets: pending.selectedTargets.map((target) => ({ row: target.row, col: target.col }))
            };
        }

        const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
        const cells = getExpansionDescriptorsForCard(gameState);
        const occupied = new Set(cells.map((cell) => `${cell.row},${cell.col}`));
        const additions = [];
        const additionKeys = new Set();
        for (const target of nextSelections) {
            const targetAdditions = getBoardExpansionGodAdditionsForCard(target.row, target.col);
            if (!targetAdditions || targetAdditions.length !== 3) {
                return { applied: false, reason: 'invalid_target' };
            }
            for (const cell of targetAdditions) {
                const key = `${cell.row},${cell.col}`;
                if (occupied.has(key) || additionKeys.has(key)) {
                    return { applied: false, reason: 'already_expanded' };
                }
                additionKeys.add(key);
                additions.push({ row: cell.row, col: cell.col });
            }
        }

        for (const cell of additions) {
            cells.push({
                side: resolveExpansionSideForCard(null, cell.row, cell.col),
                row: cell.row,
                col: cell.col,
                owner: EMPTY
            });
        }

        boardExpansion.cells = cells.map((cell) => ({
            side: resolveExpansionSideForCard(cell.side, cell.row, cell.col),
            row: cell.row,
            col: cell.col,
            owner: normalizeExpansionOwnerForCard(cell.owner)
        }));
        syncLegacyExpansionFieldsForCard(boardExpansion);

        boardExpansion.usedByPlayer[playerKey] = true;

        cardState.pendingEffectByPlayer[playerKey] = null;
        return {
            applied: true,
            completed: true,
            source: { row, col },
            sources: nextSelections.map((target) => ({ row: target.row, col: target.col })),
            selectedTargets: nextSelections.map((target) => ({ row: target.row, col: target.col })),
            added: additions.map((cell) => ({ row: cell.row, col: cell.col }))
        };
    }

    function applyBlockadeWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'BLOCKADE_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getBlockadeTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        removeMarkersAt(cardState, row, col, {
            kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
            type: 'BLOCKADE'
        });
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'BLOCKADE',
            remainingOwnerTurns: BLOCKADE_TURNS
        });

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col };
    }

    function applyMeteorWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'METEOR_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getMeteorTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };

        let destroyed = false;
        if (cellValue !== EMPTY) {
            if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                const res = BoardOpsModule.destroyAt(
                    cardState,
                    gameState,
                    row,
                    col,
                    'METEOR_WILL',
                    'meteor_cell_destroy',
                    { ignoreGuard: true }
                );
                destroyed = !!(res && res.destroyed);
                if (res && res.reason === 'out_of_board') {
                    return { applied: false, reason: 'out_of_board' };
                }
            }
            if (!destroyed) {
                clearStoneIdAtForCard(cardState, gameState, row, col);
                setCellValueForCard(gameState, row, col, EMPTY);
                removeMarkersAt(cardState, row, col);
                destroyed = true;
            }
        } else {
            clearStoneIdAtForCard(cardState, gameState, row, col);
            setCellValueForCard(gameState, row, col, EMPTY);
            removeMarkersAt(cardState, row, col);
        }

        // Full erase first, then leave a permanent hole marker.
        removeMarkersAt(cardState, row, col);
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'METEOR_HOLE'
        });

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col, destroyed };
    }

    function applyLossWill(cardState, gameState, playerKey) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'LOSS_WILL') {
            return { applied: false, reason: 'not_pending', removedCount: 0, removed: [] };
        }

        ensureMarkers(cardState);
        const specials = getSpecialMarkers(cardState);
        const guardedCells = new Set(
            specials
                .filter((marker) => (
                    marker &&
                    marker.data &&
                    marker.data.type === 'GUARD' &&
                    Number.isInteger(marker.row) &&
                    Number.isInteger(marker.col)
                ))
                .map((marker) => `${marker.row},${marker.col}`)
        );

        const removableSpecials = specials.filter((marker) => {
            if (!marker) return false;
            if (marker.data && marker.data.type === 'METEOR_HOLE') return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });

        const bombs = getBombMarkers(cardState);
        const removableBombs = bombs.filter((marker) => {
            if (!marker) return false;
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return true;
            return !guardedCells.has(`${marker.row},${marker.col}`);
        });

        const removed = removableSpecials.map((marker) => ({
            row: marker.row,
            col: marker.col,
            owner: marker.owner || null,
            type: (marker.data && marker.data.type) || null
        })).concat(removableBombs.map((marker) => ({
            row: marker.row,
            col: marker.col,
            owner: marker.owner || null,
            type: (marker.data && marker.data.type) || 'TIME_BOMB'
        })));

        const specialKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
        const bombKind = MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb';
        cardState.markers = cardState.markers.filter((marker) => {
            if (!(marker && (marker.kind === specialKind || marker.kind === bombKind))) return true;
            if (marker.kind === specialKind) {
                if (marker.data && marker.data.type === 'METEOR_HOLE') return true;
                if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return false;
                return guardedCells.has(`${marker.row},${marker.col}`);
            }
            if (!Number.isInteger(marker.row) || !Number.isInteger(marker.col)) return false;
            return guardedCells.has(`${marker.row},${marker.col}`);
        });

        for (const entry of removed) {
            if (!Number.isInteger(entry.row) || !Number.isInteger(entry.col)) continue;
            if (!gameState || !Array.isArray(gameState.board)) continue;
            if (!Array.isArray(gameState.board[entry.row])) continue;
            if (gameState.board[entry.row][entry.col] === EMPTY) continue;

            emitPresentationEvent(cardState, {
                type: 'STATUS_REMOVED',
                row: entry.row,
                col: entry.col,
                cause: 'LOSS_WILL',
                reason: 'loss_will_reset',
                meta: {
                    special: entry.type,
                    owner: entry.owner,
                    reason: 'loss_will_reset'
                }
            });
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, removedCount: removed.length, removed };
    }

    function getStrongWindTargets(cardState, gameState) {
        if (CardSelectorsModule && typeof CardSelectorsModule.getStrongWindTargets === 'function') {
            return CardSelectorsModule.getStrongWindTargets(cardState, gameState);
        }
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === EMPTY) continue;
                const hasMove =
                    (r > 0 && gameState.board[r - 1][c] === EMPTY && !isBlockedCell(cardState, r - 1, c, gameState)) ||
                    (r < 7 && gameState.board[r + 1][c] === EMPTY && !isBlockedCell(cardState, r + 1, c, gameState)) ||
                    (c > 0 && gameState.board[r][c - 1] === EMPTY && !isBlockedCell(cardState, r, c - 1, gameState)) ||
                    (c < 7 && gameState.board[r][c + 1] === EMPTY && !isBlockedCell(cardState, r, c + 1, gameState));
                if (hasMove) res.push({ row: r, col: c });
            }
        }
        return res;
    }

    function _collectVerticalCrushMovePlan(cardState, gameState, row, col, dr) {
        if (!gameState || !Array.isArray(gameState.board) || gameState.board.length !== 8) return null;
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        if (dr !== -1 && dr !== 1) return null;

        const firstRow = row + dr;
        if (firstRow < 0 || firstRow >= 8) return null;

        const destroyed = [];
        let to = null;
        for (let r = firstRow; r >= 0 && r < 8; r += dr) {
            if (isBlockedCell(cardState, r, col, gameState)) break;

            if (gameState.board[r][col] !== EMPTY) {
                const guard = findSpecialMarkerAt(cardState, r, col, 'GUARD');
                if (guard) break;
                destroyed.push({ row: r, col });
            }

            to = { row: r, col };
        }

        if (!to) return null;
        const movedDistance = Math.abs(to.row - row) + Math.abs(to.col - col);
        if (movedDistance <= 0) return null;

        return {
            from: { row, col },
            to,
            destroyed,
            direction: { dr, dc: 0 },
            movedDistance
        };
    }

    function getSuperBuoyancyTargets(cardState, gameState) {
        if (CardSelectorsModule && typeof CardSelectorsModule.getSuperBuoyancyTargets === 'function') {
            return CardSelectorsModule.getSuperBuoyancyTargets(cardState, gameState);
        }

        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === EMPTY) continue;
                const plan = _collectVerticalCrushMovePlan(cardState, gameState, r, c, -1);
                if (plan) res.push({ row: r, col: c });
            }
        }
        return res;
    }

    function getSuperGravityTargets(cardState, gameState) {
        if (CardSelectorsModule && typeof CardSelectorsModule.getSuperGravityTargets === 'function') {
            return CardSelectorsModule.getSuperGravityTargets(cardState, gameState);
        }

        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] === EMPTY) continue;
                const plan = _collectVerticalCrushMovePlan(cardState, gameState, r, c, 1);
                if (plan) res.push({ row: r, col: c });
            }
        }
        return res;
    }

    function _getStrongWindMoveOptions(cardState, gameState, row, col) {
        const dirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
        ];
        const options = [];
        for (const d of dirs) {
            const nr = row + d.dr;
            const nc = col + d.dc;
            if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
            if (gameState.board[nr][nc] !== EMPTY) continue;
            if (isBlockedCell(cardState, nr, nc, gameState)) continue;

            let tr = nr;
            let tc = nc;
            while (true) {
                const rr = tr + d.dr;
                const cc = tc + d.dc;
                if (rr < 0 || rr >= 8 || cc < 0 || cc >= 8) break;
                if (gameState.board[rr][cc] !== EMPTY) break;
                if (isBlockedCell(cardState, rr, cc, gameState)) break;
                tr = rr;
                tc = cc;
            }
            const distance = Math.abs(tr - row) + Math.abs(tc - col);
            options.push({ direction: d, target: { row: tr, col: tc }, distance });
        }
        return options;
    }

    function _moveMarkersForStrongWind(cardState, fromRow, fromCol, toRow, toCol) {
        const markers = getMarkers(cardState);
        for (const m of markers) {
            if (!m) continue;
            if (m.row !== fromRow || m.col !== fromCol) continue;
            m.row = toRow;
            m.col = toCol;
        }
    }

    function _getTeleportDestinations(cardState, gameState) {
        const res = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (gameState.board[r][c] !== EMPTY) continue;
                if (isBlockedCell(cardState, r, c, gameState)) continue;
                res.push({ row: r, col: c });
            }
        }
        return res;
    }

    function _moveMarkersForTeleport(cardState, fromRow, fromCol, toRow, toCol) {
        const markers = getMarkers(cardState);
        for (const m of markers) {
            if (!m) continue;
            if (m.row !== fromRow || m.col !== fromCol) continue;
            m.row = toRow;
            m.col = toCol;
        }
    }

    function _leaveMeteorHoleAt(cardState, gameState, playerKey, row, col) {
        clearStoneIdAtForCard(cardState, gameState, row, col);
        setCellValueForCard(gameState, row, col, EMPTY);
        removeMarkersAt(cardState, row, col);
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'METEOR_HOLE'
        });
    }

    function applyTeleportWill(cardState, gameState, playerKey, row, col, prng) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'TELEPORT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return { applied: false, reason: 'out_of_board' };
        if (gameState.board[row][col] === EMPTY) return { applied: false, reason: 'empty' };

        const targets = getTeleportTargets(cardState, gameState);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const destinations = _getTeleportDestinations(cardState, gameState);
        if (!destinations.length) return { applied: false, reason: 'no_destination' };

        const p = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const indexRaw = Math.floor(p.random() * destinations.length);
        const index = Number.isInteger(indexRaw)
            ? Math.max(0, Math.min(destinations.length - 1, indexRaw))
            : 0;
        const to = destinations[index] || destinations[0];

        _moveMarkersForTeleport(cardState, row, col, to.row, to.col);

        if (BoardOpsModule && typeof BoardOpsModule.moveAt === 'function') {
            const res = BoardOpsModule.moveAt(cardState, gameState, row, col, to.row, to.col, 'TELEPORT_WILL', 'teleport_move');
            if (!res || !res.moved) {
                return { applied: false, reason: 'move_failed' };
            }
        } else {
            const val = gameState.board[row][col];
            gameState.board[row][col] = EMPTY;
            gameState.board[to.row][to.col] = val;
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, from: { row, col }, to };
    }

    function applyCellTeleportWill(cardState, gameState, playerKey, row, col, prng) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'CELL_TELEPORT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const targets = getCellTeleportTargets(cardState, gameState);
        const allowed = targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };
        if (cellValue === EMPTY) return { applied: false, reason: 'empty' };

        const destinations = getCellTeleportDestinations(cardState, gameState)
            .filter((target) => !(target && target.row === row && target.col === col));
        if (!destinations.length) return { applied: false, reason: 'no_destination' };

        const p = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const indexRaw = Math.floor(p.random() * destinations.length);
        const index = Number.isInteger(indexRaw)
            ? Math.max(0, Math.min(destinations.length - 1, indexRaw))
            : 0;
        const to = destinations[index] || destinations[0];
        const createdDestination = !to.active;

        if (!ensureExpansionCellForCard(gameState, to.row, to.col, EMPTY)) {
            return { applied: false, reason: 'invalid_destination' };
        }

        let moved = false;
        if (BoardOpsModule && typeof BoardOpsModule.moveAt === 'function') {
            const res = BoardOpsModule.moveAt(cardState, gameState, row, col, to.row, to.col, 'CELL_TELEPORT_WILL', 'teleport_move');
            if (res && res.reason === 'out_of_board') {
                return { applied: false, reason: 'move_failed' };
            }
            moved = !!(res && res.moved);
        }

        if (!moved) {
            const sourceStoneId = getStoneIdAtForCard(cardState, gameState, row, col);
            const cleared = setCellValueForCard(gameState, row, col, EMPTY);
            const placed = setCellValueForCard(gameState, to.row, to.col, cellValue);
            if (!cleared || !placed) {
                return { applied: false, reason: 'move_failed' };
            }
            clearStoneIdAtForCard(cardState, gameState, row, col);
            setStoneIdAtForCard(cardState, gameState, to.row, to.col, sourceStoneId);
        }

        _moveMarkersForTeleport(cardState, row, col, to.row, to.col);
        _leaveMeteorHoleAt(cardState, gameState, playerKey, row, col);

        cardState.pendingEffectByPlayer[playerKey] = null;
        return {
            applied: true,
            from: { row, col },
            to: { row: to.row, col: to.col },
            createdDestination
        };
    }

    function applyStrongWindWill(cardState, gameState, playerKey, row, col, prng) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'STRONG_WIND_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return { applied: false, reason: 'out_of_board' };
        if (gameState.board[row][col] === EMPTY) return { applied: false, reason: 'empty' };

        const options = _getStrongWindMoveOptions(cardState, gameState, row, col);
        if (!options.length) return { applied: false, reason: 'no_move_options' };

        const maxDistance = options.reduce((m, o) => Math.max(m, Number(o && o.distance) || 0), 0);
        const bestOptions = options.filter(o => (Number(o && o.distance) || 0) === maxDistance);
        const p = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const pick = bestOptions[Math.floor(p.random() * bestOptions.length)];
        const to = pick.target;
        const movedDistance = Math.abs(to.row - row) + Math.abs(to.col - col);

        _moveMarkersForStrongWind(cardState, row, col, to.row, to.col);

        if (BoardOpsModule && typeof BoardOpsModule.moveAt === 'function') {
            const res = BoardOpsModule.moveAt(cardState, gameState, row, col, to.row, to.col, 'STRONG_WIND_WILL', 'strong_wind_move');
            if (!res || !res.moved) {
                return { applied: false, reason: 'move_failed' };
            }
        } else {
            const val = gameState.board[row][col];
            gameState.board[row][col] = EMPTY;
            gameState.board[to.row][to.col] = val;
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, from: { row, col }, to, direction: pick.direction, movedDistance, chargeGained: 0 };
    }

    function _applyVerticalCrushWill(cardState, gameState, playerKey, row, col, config) {
        const cfg = config || {};
        const pendingType = String(cfg.pendingType || '');
        const direction = Number(cfg.direction);
        const moveReason = String(cfg.moveReason || '').trim();
        const destroyReason = String(cfg.destroyReason || '').trim();
        const targetGetter = typeof cfg.targetGetter === 'function' ? cfg.targetGetter : null;

        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== pendingType || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return { applied: false, reason: 'out_of_board' };
        if (gameState.board[row][col] === EMPTY) return { applied: false, reason: 'empty' };

        const targets = targetGetter ? targetGetter(cardState, gameState) : [];
        const allowed = targets.some((t) => t && t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const plan = _collectVerticalCrushMovePlan(cardState, gameState, row, col, direction);
        if (!plan) return { applied: false, reason: 'no_move_options' };

        const totalTravelDistance = Number(plan.movedDistance) || Math.abs(plan.to.row - row) || 1;
        const destroyed = [];
        for (let i = 0; i < plan.destroyed.length; i++) {
            const target = plan.destroyed[i];
            if (!target) continue;

            const collisionDistance = Math.abs(target.row - row);
            const collisionProgress = Math.max(0, Math.min(1, collisionDistance / totalTravelDistance));

            if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                const res = BoardOpsModule.destroyAt(
                    cardState,
                    gameState,
                    target.row,
                    target.col,
                    pendingType,
                    destroyReason,
                    {
                        sourceRow: row,
                        sourceCol: col,
                        collisionIndex: i + 1,
                        collisionCount: plan.destroyed.length,
                        collisionProgress,
                        travelDistance: totalTravelDistance,
                        travelToRow: plan.to.row,
                        travelToCol: plan.to.col
                    }
                );
                if (!res || !res.destroyed) {
                    return { applied: false, reason: 'destroy_failed', failedAt: { row: target.row, col: target.col } };
                }
            } else {
                const destroyedOk = destroyAt(cardState, gameState, target.row, target.col);
                if (!destroyedOk) {
                    return { applied: false, reason: 'destroy_failed', failedAt: { row: target.row, col: target.col } };
                }
            }

            destroyed.push({ row: target.row, col: target.col });
        }

        _moveMarkersForStrongWind(cardState, row, col, plan.to.row, plan.to.col);

        if (BoardOpsModule && typeof BoardOpsModule.moveAt === 'function') {
            const res = BoardOpsModule.moveAt(
                cardState,
                gameState,
                row,
                col,
                plan.to.row,
                plan.to.col,
                pendingType,
                moveReason,
                {
                    collisionCount: destroyed.length,
                    travelDistance: totalTravelDistance
                }
            );
            if (!res || !res.moved) {
                return { applied: false, reason: 'move_failed' };
            }
        } else {
            const val = gameState.board[row][col];
            gameState.board[row][col] = EMPTY;
            gameState.board[plan.to.row][plan.to.col] = val;
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return {
            applied: true,
            from: { row, col },
            to: plan.to,
            destroyed,
            destroyedCount: destroyed.length,
            movedDistance: plan.movedDistance,
            direction: plan.direction
        };
    }

    function applySuperBuoyancyWill(cardState, gameState, playerKey, row, col) {
        return _applyVerticalCrushWill(cardState, gameState, playerKey, row, col, {
            pendingType: 'SUPER_BUOYANCY_WILL',
            direction: -1,
            moveReason: 'super_buoyancy_move',
            destroyReason: 'super_buoyancy_collision',
            targetGetter: getSuperBuoyancyTargets
        });
    }

    function applySuperGravityWill(cardState, gameState, playerKey, row, col) {
        return _applyVerticalCrushWill(cardState, gameState, playerKey, row, col, {
            pendingType: 'SUPER_GRAVITY_WILL',
            direction: 1,
            moveReason: 'super_gravity_move',
            destroyReason: 'super_gravity_collision',
            targetGetter: getSuperGravityTargets
        });
    }

    /**
     * Turn start processing
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {Object} [prng]
     */
    function onTurnStart(cardState, playerKey, gameState, prng) {
        const p = prng || defaultPrng;
        const summary = {
            ribo: {
                entries: [],
                totalRepaid: 0,
                totalDestroyed: 0,
                completedCount: 0
            }
        };

        cardState.turnCountByPlayer[playerKey]++;
        cardState.turnIndex++;
        cardState.lastTurnStartedFor = playerKey;

        // Breeding sprout visuals are one-turn tags.
        // Clear the current player's sprout list at turn start even when no breeding anchors remain.
        if (!cardState.breedingSproutByOwner || typeof cardState.breedingSproutByOwner !== 'object') {
            cardState.breedingSproutByOwner = { black: [], white: [] };
        }
        if (!Array.isArray(cardState.breedingSproutByOwner.black)) cardState.breedingSproutByOwner.black = [];
        if (!Array.isArray(cardState.breedingSproutByOwner.white)) cardState.breedingSproutByOwner.white = [];
        if (!cardState._breedingSproutClearedTokenByOwner || typeof cardState._breedingSproutClearedTokenByOwner !== 'object') {
            cardState._breedingSproutClearedTokenByOwner = { black: null, white: null };
        }
        const breedingSproutToken = `${playerKey}:${Number.isFinite(cardState.turnIndex) ? cardState.turnIndex : 0}`;
        if (cardState._breedingSproutClearedTokenByOwner[playerKey] !== breedingSproutToken) {
            cardState._breedingSproutClearedTokenByOwner[playerKey] = breedingSproutToken;
            cardState.breedingSproutByOwner[playerKey] = [];
        }

        // Reset usage flag
        cardState.hasUsedCardThisTurnByPlayer[playerKey] = false;
        _ensureHandDestroyFlags(cardState);
        cardState.hasDestroyedCardThisTurnByPlayer[playerKey] = false;

        // Reset extra place counters (valid only for the turn they are granted)
        cardState.extraPlaceRemainingByPlayer[playerKey] = 0;

        summary.ribo = processRiboWillTurnStartEffects(cardState, gameState, playerKey, p);

        // Draw card every turn (Rule 4.4)
        // Debug override: if debugNoDraw is enabled, skip draws
        if (cardState.debugNoDraw !== true && cardState.turnCountByPlayer[playerKey] % DRAW_INTERVAL === 0) {
            commitDraw(cardState, playerKey, p);
        }

        // Expire special stones (time-based ones are ticked by their effect processors)
        const specialMarkers = getSpecialMarkers(cardState);
        for (const m of specialMarkers) {
            const data = m.data || {};
            if (data.expiresForPlayer === playerKey) {
                // GOLD/SILVER: markers are no longer created (stones are destroyed
                // immediately on placement).  This block is kept as a legacy safety
                // net but should not normally trigger.
                if (data.type === 'GOLD' || data.type === 'SILVER') {
                    if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                        BoardOpsModule.destroyAt(cardState, gameState, m.row, m.col, 'SYSTEM', 'gold_silver_expired');
                    } else {
                        if (gameState && gameState.board) gameState.board[m.row][m.col] = EMPTY;
                        removeMarkersAt(cardState, m.row, m.col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: data.type, owner: m.owner });
                    }
                } else {
                    removeMarkersAt(cardState, m.row, m.col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: data.type, owner: m.owner });
                }
                continue;
            }
            if (typeof data.remainingOwnerTurns === 'number' && data.remainingOwnerTurns <= 0) {
                removeMarkersAt(cardState, m.row, m.col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: data.type, owner: m.owner });
                continue;
            }
            if (data.type === 'REGEN' && (data.regenRemaining || 0) <= 0) {
                removeMarkersAt(cardState, m.row, m.col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: data.type, owner: m.owner });
            }
            if (data.type === 'GUARD' && m.owner === playerKey && typeof data.remainingOwnerTurns === 'number') {
                data.remainingOwnerTurns -= 1;
                if (data.remainingOwnerTurns <= 0) {
                    removeMarkersAt(cardState, m.row, m.col, {
                        kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
                        type: 'GUARD',
                        owner: m.owner
                    });
                }
            }
            if (data.type === 'BLOCKADE' && m.owner === playerKey && typeof data.remainingOwnerTurns === 'number') {
                data.remainingOwnerTurns -= 1;
                if (data.remainingOwnerTurns <= 0) {
                    removeMarkersAt(cardState, m.row, m.col, {
                        kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
                        type: 'BLOCKADE',
                        owner: m.owner
                    });
                }
            }
        }

        // Special effects that mutate the board at turn START (e.g., DRAGON, BREEDING)
        // are processed via UI handlers for animation sequencing.

        // Process Work Will income (per-turn charge gains)
        let workMod;
        if (typeof require === 'function') {
            try { workMod = require('./cards/work_will'); } catch (e) { /* optional */ }
        } else if (typeof globalThis !== 'undefined' && globalThis.CardWork) {
            workMod = globalThis.CardWork;
        }
        if (workMod && typeof workMod.processWorkEffects === 'function') {
            try {
                const res = workMod.processWorkEffects(cardState, gameState, playerKey);
                if (!cardState.presentationEvents) cardState.presentationEvents = [];
                const row = Number.isInteger(res && res.row) ? res.row : null;
                const col = Number.isInteger(res && res.col) ? res.col : null;
                const removedReason = (res && typeof res.removedReason === 'string' && res.removedReason)
                    ? res.removedReason
                    : null;
                const incomeStep = Number.isFinite(Number(res && res.incomeStep))
                    ? Number(res.incomeStep)
                    : null;
                if (res.gained && res.gained > 0) {
                    emitPresentationEvent(cardState, {
                        type: 'WORK_INCOME',
                        player: playerKey,
                        row,
                        col,
                        gained: res.gained,
                        removed: !!res.removed,
                        reason: removedReason,
                        meta: { reason: removedReason, incomeStep }
                    });
                } else if (res.removed) {
                    emitPresentationEvent(cardState, {
                        type: 'WORK_REMOVED',
                        player: playerKey,
                        row,
                        col,
                        removed: true,
                        reason: removedReason,
                        meta: { reason: removedReason }
                    });
                }
            } catch (e) {
                // swallow to avoid breaking turn start in environments without module
            }
        }

        return summary;
    }

    /**
     * Apply effects after placement
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey
     * @param {number} row
     * @param {number} col
     * @param {number} flipCount
     * @returns {Object} Applied effects info
     */
    function addChargeWithTotal(cardState, playerKey, amount) {
        if (!cardState || !amount) return 0;
        if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
        if (!cardState.chargeGainedTotal) cardState.chargeGainedTotal = { black: 0, white: 0 };

        const deltaRes = addChargeValue(cardState, playerKey, amount, 'placement_or_effect_gain');
        const added = Number(deltaRes.delta) || 0;
        if (added > 0) {
            cardState.chargeGainedTotal[playerKey] = (cardState.chargeGainedTotal[playerKey] || 0) + added;
        }

        return added;
    }

    function applyPlacementEffects(cardState, gameState, playerKey, row, col, flipCount) {
        const effects = { chargeGained: 0 };
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (pending && (pending.type === 'FREE_PLACEMENT' || pending.type === 'SNIPER_WILL' || pending.type === 'LAST_RESORT')) {
            effects.freePlacementUsed = true;
        }
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const ownerVal = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponentVal = -ownerVal;

        // Base charge gain
        let chargeGain = flipCount;

        // GOLD_STONE logic - multiplier on flip-based charge gain
        // Immediately destroy the placed stone after charge calculation.
        // UI plays SPAWN → (phase gap) → DESTROY(500ms fade) so the stone
        // is briefly visible before disappearing.  No marker survives to next turn.
        if (pending && pending.type === 'GOLD_STONE') {
            chargeGain = flipCount * 4;
            effects.goldStoneUsed = true;
            // Destroy the placed stone in the same turn (presentation: DESTROY event)
            if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                BoardOpsModule.destroyAt(cardState, gameState, row, col, 'SYSTEM', 'gold_stone_sacrifice');
            } else {
                gameState.board[row][col] = EMPTY;
            }
        }

        // SILVER_STONE logic - multiplier on flip-based charge gain
        // Immediately destroy the placed stone after charge calculation.
        if (pending && pending.type === 'SILVER_STONE') {
            chargeGain = flipCount * 3;
            effects.silverStoneUsed = true;
            // Destroy the placed stone in the same turn (presentation: DESTROY event)
            if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                BoardOpsModule.destroyAt(cardState, gameState, row, col, 'SYSTEM', 'silver_stone_sacrifice');
            } else {
                gameState.board[row][col] = EMPTY;
            }
        }

        // PLUNDER_WILL logic - delegate to effect module
        if (pending && pending.type === 'PLUNDER_WILL') {
            let plunderEffect;
            if (typeof module === 'object' && module.exports) {
                try { plunderEffect = require('./effects/plunder_will').applyPlunderWill; } catch (e) { /* fallback below */ }
            }
            if (typeof plunderEffect === 'function') {
                const res = plunderEffect(cardState, playerKey, flipCount);
                chargeGain += (res.plundered || 0);
                effects.plunderAmount = res.plundered || 0;
            } else {
                const stolen = Math.min(flipCount, cardState.charge[opponentKey]);
                addChargeValue(cardState, opponentKey, -stolen, 'plunder_loss');
                chargeGain += stolen;
                effects.plunderAmount = stolen;
            }
        }

        // STEAL_CARD logic - steal opponent hand cards then sell for +2 charge per card
        if (pending && pending.type === 'STEAL_CARD') {
            let stealEffect;
            if (typeof module === 'object' && module.exports) {
                try { stealEffect = require('./effects/steal_card').applyStealCard; } catch (e) { /* fallback below */ }
            }
            if (typeof stealEffect === 'function') {
                const res = stealEffect(cardState, playerKey, flipCount);
                if (res && res.stolenCount > 0) {
                    effects.stolenCount = res.stolenCount;
                    effects.stolenCards = res.stolenCards;
                }
                if (res && res.resaleGain > 0) {
                    chargeGain += res.resaleGain;
                    effects.resaleGain = res.resaleGain;
                }
            } else {
                const totalSteal = Math.min(
                    flipCount,
                    cardState.hands[opponentKey].length
                );

                if (totalSteal > 0) {
                    const stolenCards = cardState.hands[opponentKey].splice(0, totalSteal);
                    if (!Array.isArray(cardState.discard)) cardState.discard = [];
                    cardState.discard.push(...stolenCards);

                    const resaleGain = totalSteal * 2;
                    chargeGain += resaleGain;

                    effects.stolenCards = stolenCards;
                    effects.stolenCount = totalSteal;
                    effects.resaleGain = resaleGain;
                }
            }
        }

        // Apply charge
        addChargeWithTotal(cardState, playerKey, chargeGain);
        effects.chargeGained = chargeGain;

        // PROTECTED_NEXT_STONE logic - delegate to module when present
        if (pending && pending.type === 'PROTECTED_NEXT_STONE') {
            let mod;
            if (typeof module === 'object' && module.exports) {
                try { mod = require('./effects/protected_next_stone'); } catch (e) { }
            }
            if (mod && typeof mod.applyProtectedNextStone === 'function') {
                const r = mod.applyProtectedNextStone(cardState, playerKey, row, col);
                if (r.applied) effects.protected = true;
            } else {
                addMarker(cardState, 'specialStone', row, col, playerKey, {
                    type: 'PROTECTED',
                    expiresForPlayer: playerKey
                });
                effects.protected = true;
            }
        }

        // PERMA_PROTECT_NEXT_STONE logic - delegate to module when present
        if (pending && pending.type === 'PERMA_PROTECT_NEXT_STONE') {
            let mod;
            if (typeof module === 'object' && module.exports) {
                try { mod = require('./effects/perma_protect_next_stone'); } catch (e) { }
            }
            if (mod && typeof mod.applyPermaProtectNextStone === 'function') {
                const r = mod.applyPermaProtectNextStone(cardState, playerKey, row, col);
                if (r.applied) effects.permaProtected = true;
            } else {
                applyStrongWill(cardState, playerKey, row, col);
                effects.permaProtected = true;
            }
        }

        // REGEN_WILL logic
        if (pending && pending.type === 'REGEN_WILL') {
            applyRegenWill(cardState, playerKey, row, col);
            effects.regenPlaced = true;
        }

        // Work Will: if armed, place a Work marker anchored to this placement
        // Diagnostic logging added to help trace environments where marker isn't created
        try {
            workDebugLog(cardState, '[WORK_DEBUG] workNextPlacementArmedByPlayer state:', cardState.workNextPlacementArmedByPlayer, 'playerKey:', playerKey, 'row:', row, 'col:', col);
            if (cardState.workNextPlacementArmedByPlayer && cardState.workNextPlacementArmedByPlayer[playerKey]) {
                let workMod;
                if (typeof require === 'function') {
                    try { workMod = require('./cards/work_will'); } catch (e) { /* optional */ }
                } else if (typeof globalThis !== 'undefined' && globalThis.CardWork) {
                    workMod = globalThis.CardWork;
                }
                try {
                    if (workMod && typeof workMod.placeWorkStone === 'function') {
                        workDebugLog(cardState, '[WORK_DEBUG] Calling placeWorkStone for', playerKey, row, col);
                        workMod.placeWorkStone(cardState, gameState, playerKey, row, col, { addMarker });
                        effects.workPlaced = true;
                        try { if (typeof globalThis !== 'undefined') globalThis._lastWorkPlaced = { playerKey, row, col }; else if (typeof global !== 'undefined') global._lastWorkPlaced = { playerKey, row, col }; } catch (e) {}
                    } else {
                        workDebugLog(cardState, '[WORK_DEBUG] workMod.placeWorkStone not available, workMod:', !!workMod);
                    }
                } catch (e) {
                    workDebugError(cardState, '[WORK_DEBUG] placeWorkStone threw', e && e.message ? e.message : e);
                }
                cardState.workNextPlacementArmedByPlayer[playerKey] = false;
            }
        } catch (e) { /* defensive */ }

        // ULTIMATE_REVERSE_DRAGON logic - delegate to module when present
        if (pending && pending.type === 'ULTIMATE_REVERSE_DRAGON') {
            let mod;
            if (typeof module === 'object' && module.exports) {
                try { mod = require('./effects/ultimate_reverse_dragon'); } catch (e) { }
            }
            if (mod && typeof mod.applyUltimateDragon === 'function') {
                const r = mod.applyUltimateDragon(cardState, playerKey, row, col);
                if (r.placed) effects.dragonPlaced = true;
            } else {
                addMarker(cardState, 'specialStone', row, col, playerKey, {
                    type: 'DRAGON',
                    remainingOwnerTurns: ULTIMATE_DRAGON_TURNS
                });
                effects.dragonPlaced = true;
            }
        }

        // BREEDING_WILL logic (新規) - unified specialStones
        if (pending && pending.type === 'BREEDING_WILL') {
            const BREEDING_DURATION = 3;
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'BREEDING',
                remainingOwnerTurns: BREEDING_DURATION
            });
            effects.breedingPlaced = true;
        }

        // ULTIMATE_DESTROY_GOD logic - ultimate destroy variant
        if (pending && pending.type === 'ULTIMATE_DESTROY_GOD') {
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'ULTIMATE_DESTROY_GOD',
                remainingOwnerTurns: ULTIMATE_DESTROY_GOD_TURNS
            });
            effects.ultimateDestroyGodPlaced = true;
        }

        // SNIPER_WILL logic - sniper stone marker
        if (pending && pending.type === 'SNIPER_WILL') {
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'SNIPER',
                remainingOwnerTurns: SNIPER_WILL_TURNS
            });
            effects.sniperPlaced = true;
        }

        if (pending && pending.type === 'OBSERVER_WILL') {
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'OBSERVER',
                remainingOwnerTurns: OBSERVER_WILL_TURNS
            });
            effects.observerPlaced = true;
        }

        if (pending && pending.type === 'DESTROY_DRAGON_WILL') {
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'DESTROY_DRAGON',
                remainingOwnerTurns: DESTROY_DRAGON_TURNS
            });
            effects.destroyDragonPlaced = true;
        }

        if (pending && pending.type === 'LIGHTNING_WILL') {
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'LIGHTNING',
                remainingOwnerTurns: LIGHTNING_WILL_TURNS
            });
            effects.lightningPlaced = true;
        }

        // HYPERACTIVE_WILL logic - hyperactive stone marker
        if (pending && pending.type === 'HYPERACTIVE_WILL') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'HYPERACTIVE',
                flipEvadeRemaining: 1,
                hyperactiveSeq: cardState.hyperactiveSeqCounter
            });
            effects.hyperactivePlaced = true;
        }

        // EXTREME_HYPERACTIVE_WILL logic - extreme hyperactive stone marker
        if (pending && pending.type === 'EXTREME_HYPERACTIVE_WILL') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'EXTREME_HYPERACTIVE',
                flipEvadeRemaining: 1,
                hyperactiveSeq: cardState.hyperactiveSeqCounter
            });
            effects.hyperactivePlaced = true;
            effects.extremeHyperactivePlaced = true;
        }

        // ESCAPE_WILL logic - escape hyperactive stone marker
        if (pending && pending.type === 'ESCAPE_WILL') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'ESCAPE_HYPERACTIVE',
                flipEvadeRemaining: 1,
                hyperactiveSeq: cardState.hyperactiveSeqCounter
            });
            effects.hyperactivePlaced = true;
            effects.escapeHyperactivePlaced = true;
        }

        // ROBOT_VACUUM_WILL logic - robot vacuum stone marker
        if (pending && pending.type === 'ROBOT_VACUUM_WILL') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'ROBOT_VACUUM',
                hyperactiveSeq: cardState.hyperactiveSeqCounter,
                remainingOwnerTurns: ROBOT_VACUUM_TURNS
            });
            effects.hyperactivePlaced = true;
            effects.robotVacuumPlaced = true;
        }

        // GLUTTONOUS_WILL logic - gluttonous stone marker
        if (pending && pending.type === 'GLUTTONOUS_WILL') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'GLUTTONOUS',
                hyperactiveSeq: cardState.hyperactiveSeqCounter,
                gluttonousMissStreak: 0
            });
            effects.hyperactivePlaced = true;
            effects.gluttonousPlaced = true;
        }

        // INSTANT_HYPERACTIVE_WILL logic - placement-turn-only hyperactive stone
        if (pending && pending.type === 'INSTANT_HYPERACTIVE_WILL') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'HYPERACTIVE',
                hyperactiveSeq: cardState.hyperactiveSeqCounter,
                instantPlacementOnly: true
            });
            effects.hyperactivePlaced = true;
            effects.instantHyperactivePlaced = true;
        }

        // ULTIMATE_HYPERACTIVE_GOD logic - ultimate hyperactive anchor
        if (pending && pending.type === 'ULTIMATE_HYPERACTIVE_GOD') {
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'ULTIMATE_HYPERACTIVE',
                remainingOwnerTurns: ULTIMATE_HYPERACTIVE_TURNS,
                flipEvadeRemaining: ULTIMATE_HYPERACTIVE_FLIP_EVADE_LIMIT
            });
            effects.ultimateHyperactivePlaced = true;
        }

        function explodeCells(cells, cause, reason) {
            const inBoundsTargets = cells.filter(pos => pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8);
            let destroyedCount = 0;
            for (const pos of inBoundsTargets) {
                if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                    const res = BoardOpsModule.destroyAt(cardState, gameState, pos.row, pos.col, cause, reason);
                    if (res && res.destroyed) destroyedCount++;
                } else if (gameState.board[pos.row][pos.col] !== EMPTY) {
                    removeMarkersAt(cardState, pos.row, pos.col);
                    gameState.board[pos.row][pos.col] = EMPTY;
                    destroyedCount++;
                }
            }
            return destroyedCount;
        }

        // CROSS_BOMB / X_BOMB logic - trigger immediate explosion after normal flips.
        if (pending && (pending.type === 'CROSS_BOMB' || pending.type === 'X_BOMB')) {
            const targets = [{ row, col }];
            for (const dist of [1, 2]) {
                if (pending.type === 'CROSS_BOMB') {
                    targets.push(
                        { row: row - dist, col },
                        { row: row + dist, col },
                        { row, col: col - dist },
                        { row, col: col + dist }
                    );
                } else {
                    targets.push(
                        { row: row - dist, col: col - dist },
                        { row: row - dist, col: col + dist },
                        { row: row + dist, col: col - dist },
                        { row: row + dist, col: col + dist }
                    );
                }
            }

            if (pending.type === 'CROSS_BOMB') {
                const destroyedCount = explodeCells(targets, 'CROSS_BOMB', 'cross_bomb_explosion');
                effects.crossBombExploded = true;
                effects.crossBombDestroyed = destroyedCount;
            } else {
                const destroyedCount = explodeCells(targets, 'X_BOMB', 'x_bomb_explosion');
                effects.xBombExploded = true;
                effects.xBombDestroyed = destroyedCount;
            }
        }

        // DOUBLE_PLACE logic - delegate to effect module
        if (pending && pending.type === 'DOUBLE_PLACE') {
            let dpEffect;
            if (typeof module === 'object' && module.exports) {
                try { dpEffect = require('./effects/double_place').applyDoublePlace; } catch (e) { /* fallback below */ }
            }
            if (typeof dpEffect === 'function') {
                const res = dpEffect(cardState, playerKey);
                if (res.activated) effects.doublePlaceActivated = true;
            } else {
                // Ensure container exists before setting by playerKey (protects browser UI quick-harness)
                if (!cardState.extraPlaceRemainingByPlayer) cardState.extraPlaceRemainingByPlayer = {};
                cardState.extraPlaceRemainingByPlayer[playerKey] = DOUBLE_PLACE_EXTRA;
                effects.doublePlaceActivated = true;
            }
        }

        // LAST_RESORT logic - exactly two free placements this turn.
        if (pending && pending.type === 'LAST_RESORT') {
            const remainingBefore = Number.isFinite(Number(pending.placementsRemaining))
                ? Math.max(0, Math.floor(Number(pending.placementsRemaining)))
                : 2;
            const remainingAfter = Math.max(0, remainingBefore - 1);
            pending.placementsRemaining = remainingAfter;

            if (remainingBefore > 1) {
                if (!cardState.extraPlaceRemainingByPlayer) cardState.extraPlaceRemainingByPlayer = {};
                const currentExtra = Number(cardState.extraPlaceRemainingByPlayer[playerKey] || 0);
                cardState.extraPlaceRemainingByPlayer[playerKey] = Math.max(currentExtra, DOUBLE_PLACE_EXTRA);
                effects.lastResortContinues = true;
            } else {
                effects.lastResortCompleted = true;
            }
        }

        // Clear pending after placement.
        // CHAIN_WILL is consumed in the same placement turn (applyChainWillAfterMove runs before this),
        // so it must not remain into future turns.
        if (!(pending && pending.type === 'LAST_RESORT' && Number(pending.placementsRemaining || 0) > 0)) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }

        return effects;
    }

    function isNormalStoneForPlayer(cardState, gameState, playerKey, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.isNormalStoneForPlayer === 'function') {
            return CardUtilsModule.isNormalStoneForPlayer(cardState, gameState, playerKey, row, col);
        }
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const playerVal = playerKey === 'black' ? P_BLACK : P_WHITE;

        if (gameState.board[row][col] !== playerVal) return false;

        const specials = getSpecialMarkers(cardState);
        if (specials.some(s => s.row === row && s.col === col)) return false;

        const bombs = getBombMarkers(cardState);
        if (bombs.some(b => b.row === row && b.col === col)) return false;

        return true;
    }

    function applyStrongWill(cardState, playerKey, row, col) {
        const already = getSpecialMarkers(cardState).some(s =>
            s.row === row && s.col === col && s.data && s.data.type === 'PERMA_PROTECTED'
        );
        if (!already) {
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'PERMA_PROTECTED'
            });
        }
        return { applied: true };
    }

    /**
     * Apply REGEN_WILL (next placed stone becomes regen stone)
     */
    function applyRegenWill(cardState, playerKey, row, col) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/regen');
            return mod.applyRegenWill(cardState, playerKey, row, col, { addMarker, BLACK, WHITE });
        }
        // Browser: use global
        if (typeof CardRegen !== 'undefined' && typeof CardRegen.applyRegenWill === 'function') {
            return CardRegen.applyRegenWill(cardState, playerKey, row, col, { addMarker, BLACK, WHITE });
        }
        console.warn('[cards.js] CardRegen.applyRegenWill not available');
        return { applied: false };
    }


    /**
     * Resolve regen behavior for a set of flips (after board has been updated to newColor).
     * Delegates to cards/regen.js module.
     */
    function applyRegenAfterFlips(cardState, gameState, flips, flipperKey, skipCapture) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/regen');
            return mod.applyRegenAfterFlips(cardState, gameState, flips, flipperKey, skipCapture, {
                getCardContext,
                clearBombAt,
                removeMarkersAt,
                BoardOps: BoardOpsModule
            });
        }
        // Browser: use global
        if (typeof CardRegen !== 'undefined' && typeof CardRegen.applyRegenAfterFlips === 'function') {
            return CardRegen.applyRegenAfterFlips(cardState, gameState, flips, flipperKey, skipCapture, {
                getCardContext,
                clearBombAt,
                removeMarkersAt,
                BoardOps: BoardOpsModule
            });
        }
        console.warn('[cards.js] CardRegen module not available');
        return { regened: [], captureFlips: [] };
    }


    /**
     * Apply SACRIFICE_WILL (生贄の意志)
     * Destroy own stone and gain +5 charge, up to 3 selections.
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey
     * @param {number} row
     * @param {number} col
     * @returns {{applied:boolean, reason?:string, gained?:number, selectedCount?:number, maxSelections?:number, completed?:boolean}}
     */
    function applySacrificeWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'SACRIFICE_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'pending_not_found' };
        }

        const ownerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        if (!gameState || !gameState.board || gameState.board[row][col] !== ownerVal) {
            return { applied: false, reason: '自分の石のみ選択できます' };
        }

        const destroyed = destroyAt(cardState, gameState, row, col);
        if (!destroyed) {
            return { applied: false, reason: '破壊に失敗しました' };
        }

        const gained = addChargeWithTotal(cardState, playerKey, 5);
        const selectedCount = Number(pending.selectedCount || 0) + 1;
        const maxSelections = Number(pending.maxSelections || 3);
        pending.selectedCount = selectedCount;
        pending.maxSelections = maxSelections;

        const remainTargets = getSelectableTargets(cardState, gameState, playerKey);
        const completed = selectedCount >= maxSelections || remainTargets.length === 0;
        if (completed) {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }

        return { applied: true, gained, selectedCount, maxSelections, completed };
    }

    /**
     * Apply SELL_CARD_WILL (売却の意志)
     * Sell exactly one card from own hand and gain charge equal to its cost.
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {string} soldCardId
     * @returns {{applied:boolean, reason?:string, soldCardId?:string, gained?:number}}
     */
    function applySellCardWill(cardState, playerKey, soldCardId) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'SELL_CARD_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'pending_not_found' };
        }
        if (!soldCardId || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) {
            return { applied: false, reason: 'invalid_target' };
        }
        const idx = cardState.hands[playerKey].indexOf(soldCardId);
        if (idx === -1) {
            return { applied: false, reason: '手札にないカードは売却できません' };
        }

        cardState.hands[playerKey].splice(idx, 1);
        cardState.discard.push(soldCardId);

        const gainBase = getCardCost(soldCardId);
        const gained = addChargeWithTotal(cardState, playerKey, gainBase);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, soldCardId, gained };
    }

    /**
     * Apply HEAVEN_BLESSING (天の恵み)
     * Select exactly one offered card and add it to hand.
     * Non-selected offers are removed (not discarded).
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {string} selectedCardId
     * @returns {{applied:boolean, reason?:string, selectedCardId?:string, vanished?:string[]}}
     */
    function applyHeavenBlessingChoice(cardState, playerKey, selectedCardId) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'HEAVEN_BLESSING' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'pending_not_found' };
        }

        const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
        if (!offers.length) {
            cardState.pendingEffectByPlayer[playerKey] = null;
            return { applied: false, reason: 'offers_not_found' };
        }
        if (!selectedCardId || !offers.includes(selectedCardId)) {
            return { applied: false, reason: 'invalid_target' };
        }
        if (!cardState.hands || !Array.isArray(cardState.hands[playerKey])) {
            return { applied: false, reason: 'invalid_hand' };
        }
        if (cardState.hands[playerKey].length >= MAX_HAND_SIZE) {
            return { applied: false, reason: 'hand_full' };
        }

        cardState.hands[playerKey].push(selectedCardId);
        const vanished = offers.filter(id => id !== selectedCardId);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, selectedCardId, vanished };
    }

    /**
     * Apply CONDEMN_WILL (断罪の意志)
     * Reveal opponent hand and destroy exactly one selected card.
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {number} targetIndex
     * @returns {{applied:boolean, reason?:string, destroyedCardId?:string}}
     */
    function applyCondemnWill(cardState, playerKey, targetIndex) {
        const parseHiddenHandToken = (value) => {
            if (typeof value !== 'string') return null;
            const m = /^__hidden_hand__:(black|white):(\d+)$/.exec(value);
            if (!m) return null;
            return { owner: m[1], handIndex: Number(m[2]) };
        };
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'CONDEMN_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'pending_not_found' };
        }

        const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
        if (!offers.length) {
            cardState.pendingEffectByPlayer[playerKey] = null;
            return { applied: false, reason: 'offers_not_found' };
        }

        if (!Number.isInteger(targetIndex)) {
            return { applied: false, reason: 'invalid_target' };
        }
        const offer = offers.find(o => o && Number.isInteger(o.handIndex) && o.handIndex === targetIndex);
        if (!offer || !offer.cardId) {
            return { applied: false, reason: 'invalid_target' };
        }

        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey])) ? cardState.hands[opponentKey] : null;
        if (!opponentHand) {
            return { applied: false, reason: 'invalid_hand' };
        }
        if (targetIndex < 0 || targetIndex >= opponentHand.length) {
            return { applied: false, reason: 'invalid_target' };
        }
        const handCardId = opponentHand[targetIndex];
        if (handCardId !== offer.cardId) {
            const handToken = parseHiddenHandToken(handCardId);
            const offerToken = parseHiddenHandToken(offer.cardId);
            const handMatchesIndex = !!(
                handToken &&
                handToken.owner === opponentKey &&
                handToken.handIndex === targetIndex
            );
            const offerMatchesIndex = !!(
                offerToken &&
                offerToken.owner === opponentKey &&
                offerToken.handIndex === targetIndex
            );
            if (!handMatchesIndex && !offerMatchesIndex) {
                return { applied: false, reason: 'target_mismatch' };
            }
        }

        const handToken = parseHiddenHandToken(handCardId);
        const offerToken = parseHiddenHandToken(offer.cardId);
        const destroyedCardId = handToken && !offerToken ? offer.cardId : handCardId;
        opponentHand.splice(targetIndex, 1);
        cardState.discard.push(handCardId);
        cardState.pendingEffectByPlayer[playerKey] = null;

        return { applied: true, destroyedCardId };
    }

    function getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/flips');
            return mod.getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context);
        }
        // Browser: use global
        if (typeof CardFlips !== 'undefined' && typeof CardFlips.getDirectionalChainFlips === 'function') {
            return CardFlips.getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context);
        }
        console.warn('[cards.js] CardFlips.getDirectionalChainFlips not available');
        return [];
    }

    function getCellValueForCard(gameState, row, col) {
        if (!gameState) return null;
        if (isMainBoardCellForCard(row, col)) {
            if (!Array.isArray(gameState.board) || !Array.isArray(gameState.board[row])) return null;
            return gameState.board[row][col];
        }
        const expansionCells = getExpansionDescriptorsForCard(gameState);
        const matched = expansionCells.find((cell) => cell && cell.row === row && cell.col === col);
        return matched ? normalizeExpansionOwnerForCard(matched.owner) : null;
    }

    function getTabooReverseDirectionalFlips(gameState, row, col, ownerVal, direction, context = {}) {
        const protectedStones = context.protectedStones || [];
        const permaProtectedStones = context.permaProtectedStones || [];

        const protectedSet = protectedStones.length
            ? new Set(protectedStones.map(p => `${p.row},${p.col}`))
            : null;
        const permaSet = permaProtectedStones.length
            ? new Set(permaProtectedStones.map(p => `${p.row},${p.col}`))
            : null;

        const [dr, dc] = direction;
        const flips = [];
        let r = row + dr;
        let c = col + dc;

        while (getCellValueForCard(gameState, r, c) === -ownerVal) {
            const key = `${r},${c}`;
            if ((protectedSet && protectedSet.has(key)) || (permaSet && permaSet.has(key))) {
                return [];
            }
            flips.push({ row: r, col: c });
            r += dr;
            c += dc;
        }

        const tail = getCellValueForCard(gameState, r, c);
        if (tail === ownerVal) {
            return [];
        }

        return flips;
    }

    function getTabooReverseCandidates(cardState, gameState, playerKey, row, col) {
        if (!gameState || !Array.isArray(gameState.board)) return [];
        if (!Number.isInteger(row) || !Number.isInteger(col)) return [];

        const targetValue = getCellValueForCard(gameState, row, col);
        if (targetValue !== EMPTY) return [];

        const context = getCardContext(cardState);
        const blockedCells = (context && Array.isArray(context.blockedCells)) ? context.blockedCells : [];
        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map((p) => `${p.row},${p.col}`))
            : null;
        if (blockedSet && blockedSet.has(`${row},${col}`)) return [];

        const ownerKey = playerKey === 'white' ? 'white' : 'black';
        const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);

        const candidates = [];
        for (const direction of (DIRECTIONS || [])) {
            if (!Array.isArray(direction) || direction.length !== 2) continue;
            const flips = getTabooReverseDirectionalFlips(gameState, row, col, ownerVal, direction, context);
            if (!Array.isArray(flips) || flips.length === 0) continue;
            candidates.push({
                direction: [direction[0], direction[1]],
                flips,
                score: flips.length
            });
        }
        return candidates;
    }

    function pickTabooReverseFlips(cardState, gameState, playerKey, row, col, prng) {
        const candidates = getTabooReverseCandidates(cardState, gameState, playerKey, row, col);
        if (candidates.length === 0) {
            return { applied: false, flips: [], direction: null, score: 0 };
        }

        const maxScore = candidates.reduce((max, one) => Math.max(max, Number(one && one.score) || 0), 0);
        const topCandidates = candidates.filter((one) => (Number(one && one.score) || 0) === maxScore);

        const randomSource = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const rawIndex = Math.floor(randomSource.random() * topCandidates.length);
        const index = Number.isInteger(rawIndex)
            ? Math.max(0, Math.min(topCandidates.length - 1, rawIndex))
            : 0;
        const chosen = topCandidates[index] || topCandidates[0];

        return {
            applied: true,
            flips: (chosen.flips || []).map((pos) => ({ row: pos.row, col: pos.col })),
            direction: chosen.direction ? [chosen.direction[0], chosen.direction[1]] : null,
            score: Number(chosen.score) || 0
        };
    }


    function applyChainWillAfterMove(cardState, gameState, playerKey, primaryFlips, prng) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'CHAIN_WILL') {
            return { applied: false, flips: [], chosen: null };
        }

        const ownerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const context = getCardContext(cardState);
        const p = prng || defaultPrng;

        function runChainLinks(findChainChoiceFn) {
            const appliedFlips = [];
            const chosenSteps = [];
            let sourceFlips = Array.isArray(primaryFlips) ? primaryFlips.slice() : [];
            for (let i = 0; i < CHAIN_WILL_MAX_LINKS; i++) {
                const res = findChainChoiceFn(gameState, sourceFlips, ownerVal, context, p);
                if (!res || !res.applied || !Array.isArray(res.flips) || res.flips.length === 0) break;
                const chainLink = i + 1;
                for (const pos of res.flips) {
                    if (BoardOpsModule && typeof BoardOpsModule.changeAt === 'function') {
                        BoardOpsModule.changeAt(cardState, gameState, pos.row, pos.col, playerKey, 'CHAIN_WILL', 'chain_flip', { chainLink });
                    } else {
                        gameState.board[pos.row][pos.col] = ownerVal;
                    }
                    clearBombAt(cardState, pos.row, pos.col);
                }
                clearHyperactiveAtPositions(cardState, res.flips);
                appliedFlips.push(...res.flips);
                chosenSteps.push(res.chosen || null);
                sourceFlips = res.flips;
            }
            if (appliedFlips.length === 0) return { applied: false, flips: [], chosen: null, chosenSteps: [] };
            return { applied: true, flips: appliedFlips, chosen: chosenSteps[chosenSteps.length - 1] || null, chosenSteps };
        }

        // Delegate to chain module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/chain');
            if (mod && typeof mod.findChainChoice === 'function') {
                return runChainLinks(mod.findChainChoice);
            }
        }
        // Browser: use global
        if (typeof CardChain !== 'undefined' && typeof CardChain.findChainChoice === 'function') {
            return runChainLinks(CardChain.findChainChoice);
        }
        console.warn('[cards.js] CardChain module not available');
        return { applied: false, flips: [], chosen: null };
    }




    /**
    * Process Bomb countdowns
    * Delegates to cards/time_bomb.js module.
    */
    function tickBombs(cardState, gameState, playerKey) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/time_bomb');
            return mod.tickBombs(cardState, gameState, playerKey, { BoardOps: BoardOpsModule, destroyAt });
        }
        // Browser: use global
        if (typeof CardTimeBomb !== 'undefined' && typeof CardTimeBomb.tickBombs === 'function') {
            return CardTimeBomb.tickBombs(cardState, gameState, playerKey, { BoardOps: BoardOpsModule, destroyAt });
        }
        console.warn('[cards.js] CardTimeBomb module not available');
        return { exploded: [], destroyed: [] };
    }

    /**
     * Tick a single bomb (by object) at turn start. Delegates to time_bomb_single if available.
     */
    function tickBombAt(cardState, gameState, bomb, activeKey) {
        if (!bomb) return { exploded: [], destroyed: [], removed: false };
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/time_bomb');
                if (mod && typeof mod.tickBombAt === 'function') return mod.tickBombAt(cardState, gameState, bomb, activeKey, { BoardOps: BoardOpsModule, destroyAt });
            } catch (e) { /* ignore */ }
        }
        if (typeof CardTimeBomb !== 'undefined' && typeof CardTimeBomb.tickBombAt === 'function') {
            return CardTimeBomb.tickBombAt(cardState, gameState, bomb, activeKey, { BoardOps: BoardOpsModule, destroyAt });
        }
        // Fallback: emulate tick for single bomb
        const bombs = getBombMarkers(cardState);
        const idx = bombs.findIndex(b => (bomb.id && b.id === bomb.id) || (b.row === bomb.row && b.col === bomb.col && b.owner === bomb.owner && b.createdSeq === bomb.createdSeq));
        if (idx === -1) return { exploded: [], destroyed: [], removed: false };
        const b = bombs[idx];
        if (activeKey && b.owner !== activeKey) return { exploded: [], destroyed: [], removed: false };
        if (b.data && b.data.placedTurn === cardState.turnIndex) return { exploded: [], destroyed: [], removed: false };
        if (!b.data) b.data = {};
        b.data.remainingTurns = (typeof b.data.remainingTurns === 'number') ? b.data.remainingTurns - 1 : -1;
        if (b.data.remainingTurns <= 0) {
            const exploded = [{ row: b.row, col: b.col }];
            const destroyed = [];
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = b.row + dr;
                    const c = b.col + dc;
                    if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        let destroyedRes = false;
                        if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                            const res = BoardOpsModule.destroyAt(cardState, gameState, r, c, 'TIME_BOMB', 'bomb_explosion');
                            destroyedRes = !!(res && res.destroyed);
                        } else {
                            destroyedRes = destroyAt(cardState, gameState, r, c);
                        }
                        if (destroyedRes) destroyed.push({ row: r, col: c });
                    }
                }
            }
            if (typeof removeMarkerById === 'function' && b.id !== undefined) {
                removeMarkerById(cardState, b.id);
            } else {
                removeMarkersAt(cardState, b.row, b.col, { kind: MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb', owner: b.owner });
            }
            return { exploded, destroyed, removed: true };
        }
        return { exploded: [], destroyed: [], removed: false };
    }


    /**
     * Process Dragon effects
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey - Current player
     * @returns {Object} { converted: [...], destroyed: [...] }
     */
    function processDragonEffects(cardState, gameState, playerKey) {
        const dragonDeps = { BoardOps: BoardOpsModule, getCardContext };
        // Delegate to effects module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./effects/dragon');
            return mod.processDragonEffects(cardState, gameState, playerKey, dragonDeps);
        }
        // Browser: use global
        if (typeof DragonEffects !== 'undefined' && typeof DragonEffects.processDragonEffects === 'function') {
            return DragonEffects.processDragonEffects(cardState, gameState, playerKey, dragonDeps);
        }
        // Fallback: no-op
        console.warn('[cards.js] DragonEffects module not available');
        return { converted: [], destroyed: [], anchors: [] };
    }


    /**
     * Process a single DRAGON anchor immediately (placement-turn immediate fire).
     * Does NOT decrement remainingOwnerTurns (only owner turn starts decrement).
     * @returns {Object} { converted: [...], destroyed: [...] }
     */
    function processDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col) {
        const dragonDeps = { BoardOps: BoardOpsModule, getCardContext };
        // Delegate to effects module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./effects/dragon');
            return mod.processDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, dragonDeps);
        }
        // Browser: use global
        if (typeof DragonEffects !== 'undefined' && typeof DragonEffects.processDragonEffectsAtAnchor === 'function') {
            return DragonEffects.processDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, dragonDeps);
        }
        // Fallback: no-op
        console.warn('[cards.js] DragonEffects module not available');
        return { converted: [], destroyed: [] };
    }

    function processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col) {
        const dragonDeps = { BoardOps: BoardOpsModule, getCardContext };
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./effects/dragon');
                if (mod && typeof mod.processDragonEffectsAtTurnStartAnchor === 'function') {
                    return mod.processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, dragonDeps);
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof DragonEffects !== 'undefined' && typeof DragonEffects.processDragonEffectsAtTurnStartAnchor === 'function') {
            return DragonEffects.processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, dragonDeps);
        }
        console.warn('[cards.js] DragonEffects turn-start anchor processor not available');
        return { converted: [], destroyed: [], anchors: [] };
    }


    /**
     * Process ULTIMATE_DESTROY_GOD effects at owner turn start.
     * Delegates to cards/udg.js module.
     */
    function processUltimateDestroyGodEffects(cardState, gameState, playerKey) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/udg');
            return mod.processUltimateDestroyGodEffects(cardState, gameState, playerKey, { destroyAt, BoardOps: BoardOpsModule });
        }
        // Browser: use global
        if (typeof CardUdG !== 'undefined' && typeof CardUdG.processUltimateDestroyGodEffects === 'function') {
            return CardUdG.processUltimateDestroyGodEffects(cardState, gameState, playerKey, { destroyAt, BoardOps: BoardOpsModule });
        }
        console.warn('[cards.js] CardUdG module not available');
        return { destroyed: [], anchors: [], expired: [] };
    }


    /**
     * Immediate placement-turn activation for UDG anchor.
     * Delegates to cards/udg.js module.
     */
    function processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, opts = {}) {
        // Delegate to module
        const deps = Object.assign({ destroyAt, BoardOps: BoardOpsModule }, opts);
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/udg');
            return mod.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        // Browser: use global
        if (typeof CardUdG !== 'undefined' && typeof CardUdG.processUltimateDestroyGodEffectsAtAnchor === 'function') {
            return CardUdG.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        console.warn('[cards.js] CardUdG module not available');
        return { destroyed: [] };
    }

    function processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col) {
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/udg');
                if (mod && typeof mod.processUltimateDestroyGodEffectsAtTurnStartAnchor === 'function') {
                    return mod.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, { destroyAt, BoardOps: BoardOpsModule });
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof CardUdG !== 'undefined' && typeof CardUdG.processUltimateDestroyGodEffectsAtTurnStartAnchor === 'function') {
            return CardUdG.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, { destroyAt, BoardOps: BoardOpsModule });
        }
        console.warn('[cards.js] CardUdG turn-start anchor processor not available');
        return { destroyed: [] };
    }

    let cachedSniperModule = undefined;
    function resolveSniperModule() {
        if (cachedSniperModule !== undefined) return cachedSniperModule;
        cachedSniperModule = null;
        if (!(typeof module === 'object' && module.exports && typeof require === 'function')) {
            return cachedSniperModule;
        }

        const normalize = (mod) => {
            if (!mod || typeof mod !== 'object') return null;
            if (mod.default && typeof mod.default === 'object') {
                mod = Object.assign({}, mod.default, mod);
            }
            if (
                typeof mod.processSniperWillEffects === 'function' ||
                typeof mod.processSniperWillEffectsAtTurnStartAnchor === 'function'
            ) {
                return mod;
            }
            return null;
        };

        try {
            cachedSniperModule = normalize(require('./cards/sniper'));
        } catch (e) {
            cachedSniperModule = null;
        }
        if (cachedSniperModule) return cachedSniperModule;

        try {
            const pathMod = require('path');
            const absPath = pathMod.resolve(__dirname, 'cards', 'sniper.js');
            cachedSniperModule = normalize(require(absPath));
        } catch (e) {
            cachedSniperModule = null;
        }
        return cachedSniperModule;
    }

    function processSniperWillEffects(cardState, gameState, playerKey, prng) {
        const mod = resolveSniperModule();
        if (mod && typeof mod.processSniperWillEffects === 'function') {
            return mod.processSniperWillEffects(cardState, gameState, playerKey, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        if (typeof CardSniper !== 'undefined' && typeof CardSniper.processSniperWillEffects === 'function') {
            return CardSniper.processSniperWillEffects(cardState, gameState, playerKey, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        console.warn('[cards.js] CardSniper module not available');
        return { destroyed: [], anchors: [], expired: [] };
    }

    function processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prngOrOpts) {
        const normalizeRandomSource = (value, fallback) => {
            if (value && typeof value.random === 'function') return value;
            if (typeof value === 'function') return { random: value };
            return fallback;
        };
        const fallbackRandom = { random: Math.random };
        const hasOptionShape = !!(prngOrOpts && typeof prngOrOpts === 'object' && (
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'decrementRemainingOwnerTurns') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'destroyAt') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'BoardOps')
        ));
        const deps = hasOptionShape
            ? Object.assign({ destroyAt, BoardOps: BoardOpsModule, random: defaultPrng }, prngOrOpts)
            : { destroyAt, BoardOps: BoardOpsModule, random: prngOrOpts || defaultPrng };
        const randomCandidate = (
            hasOptionShape &&
            prngOrOpts &&
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random')
        )
            ? prngOrOpts.random
            : prngOrOpts;
        deps.random = normalizeRandomSource(randomCandidate, fallbackRandom);

        const mod = resolveSniperModule();
        if (mod && typeof mod.processSniperWillEffectsAtTurnStartAnchor === 'function') {
            return mod.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        if (typeof CardSniper !== 'undefined' && typeof CardSniper.processSniperWillEffectsAtTurnStartAnchor === 'function') {
            return CardSniper.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        console.warn('[cards.js] CardSniper turn-start anchor processor not available');
        return { destroyed: [], expired: [] };
    }
    let cachedLightningModule = undefined;
    function resolveLightningModule() {
        if (cachedLightningModule !== undefined) return cachedLightningModule;
        cachedLightningModule = null;
        if (!(typeof module === 'object' && module.exports && typeof require === 'function')) {
            return cachedLightningModule;
        }

        const normalize = (mod) => {
            if (!mod || typeof mod !== 'object') return null;
            if (mod.default && typeof mod.default === 'object') {
                mod = Object.assign({}, mod.default, mod);
            }
            if (
                typeof mod.processLightningWillEffects === 'function' ||
                typeof mod.processLightningWillEffectsAtAnchor === 'function' ||
                typeof mod.processLightningWillEffectsAtTurnStartAnchor === 'function'
            ) {
                return mod;
            }
            return null;
        };

        try {
            cachedLightningModule = normalize(require('./cards/lightning'));
        } catch (e) {
            cachedLightningModule = null;
        }
        if (cachedLightningModule) return cachedLightningModule;

        try {
            const pathMod = require('path');
            const absPath = pathMod.resolve(__dirname, 'cards', 'lightning.js');
            cachedLightningModule = normalize(require(absPath));
        } catch (e) {
            cachedLightningModule = null;
        }
        return cachedLightningModule;
    }

    function processLightningWillEffects(cardState, gameState, playerKey, prng) {
        const mod = resolveLightningModule();
        if (mod && typeof mod.processLightningWillEffects === 'function') {
            return mod.processLightningWillEffects(cardState, gameState, playerKey, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        if (typeof CardLightning !== 'undefined' && typeof CardLightning.processLightningWillEffects === 'function') {
            return CardLightning.processLightningWillEffects(cardState, gameState, playerKey, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        console.warn('[cards.js] CardLightning module not available');
        return { destroyed: [], anchors: [], expired: [] };
    }

    function processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, prngOrOpts) {
        const normalizeRandomSource = (value, fallback) => {
            if (value && typeof value.random === 'function') return value;
            if (typeof value === 'function') return { random: value };
            return fallback;
        };
        const fallbackRandom = { random: Math.random };
        const hasOptionShape = !!(prngOrOpts && typeof prngOrOpts === 'object' && (
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'decrementRemainingOwnerTurns') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'destroyAt') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'BoardOps')
        ));
        const deps = hasOptionShape
            ? Object.assign({ destroyAt, BoardOps: BoardOpsModule, random: defaultPrng }, prngOrOpts)
            : { destroyAt, BoardOps: BoardOpsModule, random: prngOrOpts || defaultPrng };
        const randomCandidate = (
            hasOptionShape &&
            prngOrOpts &&
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random')
        )
            ? prngOrOpts.random
            : prngOrOpts;
        deps.random = normalizeRandomSource(randomCandidate, fallbackRandom);

        const mod = resolveLightningModule();
        if (mod && typeof mod.processLightningWillEffectsAtAnchor === 'function') {
            return mod.processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        if (mod && typeof mod.processLightningWillEffectsAtTurnStartAnchor === 'function') {
            return mod.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        if (typeof CardLightning !== 'undefined' && typeof CardLightning.processLightningWillEffectsAtAnchor === 'function') {
            return CardLightning.processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        if (typeof CardLightning !== 'undefined' && typeof CardLightning.processLightningWillEffectsAtTurnStartAnchor === 'function') {
            return CardLightning.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        console.warn('[cards.js] CardLightning anchor processor not available');
        return { destroyed: [], expired: [] };
    }

    function processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prngOrOpts) {
        return processLightningWillEffectsAtAnchor(cardState, gameState, playerKey, row, col, prngOrOpts);
    }

    function processObserverWillEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prngOrOpts) {
        const normalizeRandomSource = (value, fallback) => {
            if (value && typeof value.random === 'function') return value;
            if (typeof value === 'function') return { random: value };
            return fallback;
        };
        const fallbackRandom = { random: Math.random };
        const hasOptionShape = !!(prngOrOpts && typeof prngOrOpts === 'object' && (
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random') ||
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'decrementRemainingOwnerTurns')
        ));
        const opts = hasOptionShape
            ? Object.assign({ random: defaultPrng, decrementRemainingOwnerTurns: true }, prngOrOpts)
            : { random: prngOrOpts || defaultPrng, decrementRemainingOwnerTurns: true };
        const randomCandidate = (
            hasOptionShape &&
            prngOrOpts &&
            Object.prototype.hasOwnProperty.call(prngOrOpts, 'random')
        )
            ? prngOrOpts.random
            : prngOrOpts;
        opts.random = normalizeRandomSource(randomCandidate, fallbackRandom);

        const result = {
            activated: false,
            triggered: false,
            gained: 0,
            remainingOwnerTurns: null,
            expired: []
        };

        if (!cardState || !gameState) return result;

        const marker = getSpecialMarkers(cardState).find((entry) => {
            if (!entry || entry.row !== row || entry.col !== col) return false;
            if (entry.owner !== playerKey) return false;
            const data = entry.data || {};
            return String(data.type || '').toUpperCase() === 'OBSERVER';
        });
        if (!marker) return result;

        const ownerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const boardRow = Array.isArray(gameState.board) ? gameState.board[row] : null;
        const cellValue = Array.isArray(boardRow) ? boardRow[col] : null;

        result.activated = true;
        if (cellValue !== ownerVal) {
            removeMarkersAt(cardState, row, col, {
                kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
                type: 'OBSERVER',
                owner: playerKey
            });
            result.remainingOwnerTurns = 0;
            result.expired.push({ row, col, owner: playerKey, reason: 'anchor_lost' });
            return result;
        }

        const randomSource = (() => {
            if (opts && typeof opts.random === 'function') {
                return { random: opts.random };
            }
            if (opts && opts.random && typeof opts.random.random === 'function') {
                return opts.random;
            }
            return defaultPrng;
        })();
        const procRoll = Number(randomSource.random());
        if (procRoll < 0.3) {
            const gainRoll = Number(randomSource.random());
            const gain = 1 + Math.floor(Math.max(0, Math.min(0.999999, gainRoll)) * 5);
            const added = addChargeWithTotal(cardState, playerKey, gain);
            result.triggered = true;
            result.gained = added;
        }

        const shouldDecrement = opts.decrementRemainingOwnerTurns !== false;
        const markerData = marker.data || {};
        if (shouldDecrement && typeof markerData.remainingOwnerTurns === 'number') {
            markerData.remainingOwnerTurns -= 1;
            result.remainingOwnerTurns = markerData.remainingOwnerTurns;
            if (markerData.remainingOwnerTurns <= 0) {
                removeMarkersAt(cardState, row, col, {
                    kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
                    type: 'OBSERVER',
                    owner: playerKey
                });
                result.remainingOwnerTurns = 0;
                result.expired.push({ row, col, owner: playerKey, reason: 'duration_end' });
            }
        } else {
            result.remainingOwnerTurns = (typeof markerData.remainingOwnerTurns === 'number')
                ? markerData.remainingOwnerTurns
                : null;
        }

        return result;
    }

    function processDestroyDragonEffects(cardState, gameState, playerKey, prng) {
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/destroy_dragon');
                if (mod && typeof mod.processDestroyDragonEffects === 'function') {
                    return mod.processDestroyDragonEffects(cardState, gameState, playerKey, {
                        destroyAt,
                        BoardOps: BoardOpsModule,
                        random: prng || defaultPrng
                    });
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof CardDestroyDragon !== 'undefined' && typeof CardDestroyDragon.processDestroyDragonEffects === 'function') {
            return CardDestroyDragon.processDestroyDragonEffects(cardState, gameState, playerKey, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        console.warn('[cards.js] CardDestroyDragon module not available');
        return { destroyed: [], anchors: [], expired: [] };
    }

    function processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, opts = {}) {
        const deps = Object.assign({
            destroyAt,
            BoardOps: BoardOpsModule,
            random: defaultPrng
        }, opts || {});
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/destroy_dragon');
                if (mod && typeof mod.processDestroyDragonEffectsAtAnchor === 'function') {
                    return mod.processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof CardDestroyDragon !== 'undefined' && typeof CardDestroyDragon.processDestroyDragonEffectsAtAnchor === 'function') {
            return CardDestroyDragon.processDestroyDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        }
        console.warn('[cards.js] CardDestroyDragon anchor processor not available');
        return { destroyed: [], expired: [] };
    }

    function processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng) {
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/destroy_dragon');
                if (mod && typeof mod.processDestroyDragonEffectsAtTurnStartAnchor === 'function') {
                    return mod.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, {
                        destroyAt,
                        BoardOps: BoardOpsModule,
                        random: prng || defaultPrng
                    });
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof CardDestroyDragon !== 'undefined' && typeof CardDestroyDragon.processDestroyDragonEffectsAtTurnStartAnchor === 'function') {
            return CardDestroyDragon.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, {
                destroyAt,
                BoardOps: BoardOpsModule,
                random: prng || defaultPrng
            });
        }
        console.warn('[cards.js] CardDestroyDragon turn-start anchor processor not available');
        return { destroyed: [], expired: [] };
    }


    /**
      * Process Breeding effects (Stone spawning)
      * @param {Object} cardState
      * @param {Object} gameState
     * @param {string} playerKey
     * @param {Object} prng
     * @returns {Object} { spawned: [...], destroyed: [...], flipped: [...] }
     */
    function getFlipsWithContextLocal(state, row, col, player, context = {}) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/flips');
            return mod.getFlipsWithContext(state, row, col, player, context);
        }
        // Browser: use global
        if (typeof CardFlips !== 'undefined' && typeof CardFlips.getFlipsWithContext === 'function') {
            return CardFlips.getFlipsWithContext(state, row, col, player, context);
        }
        console.warn('[cards.js] CardFlips module not available');
        return [];
    }


    function clearHyperactiveAtPositions(cardState, positions) {
        const removeSet = new Set(positions.map(p => `${p.row},${p.col}`));
        if (!cardState || !Array.isArray(cardState.markers)) return;
        cardState.markers = cardState.markers.filter(m => {
            if (m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone')) return true;
            if (!m.data || (m.data.type !== 'HYPERACTIVE' && m.data.type !== 'ESCAPE_HYPERACTIVE' && m.data.type !== 'INHERITED_HYPERACTIVE' && m.data.type !== 'EXTREME_HYPERACTIVE' && m.data.type !== 'ROBOT_VACUUM' && m.data.type !== 'GLUTTONOUS' && m.data.type !== 'ULTIMATE_HYPERACTIVE' && m.data.type !== 'SNIPER' && m.data.type !== 'OBSERVER')) return true;
            return !removeSet.has(`${m.row},${m.col}`);
        });
    }

    function moveHyperactiveOnce(cardState, gameState, entry, prng) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            return mod.moveHyperactiveOnce(cardState, gameState, entry, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearHyperactiveAtPositions,
                clearBombAt,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        // Browser: use global
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.moveHyperactiveOnce === 'function') {
            return CardHyperactive.moveHyperactiveOnce(cardState, gameState, entry, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearHyperactiveAtPositions,
                clearBombAt,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardHyperactive module not available');
        return { moved: [], destroyed: [], flipped: [], ownerKey: entry ? entry.owner : 'black' };
    }


    function processHyperactiveMoves(cardState, gameState, prng) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            return mod.processHyperactiveMoves(cardState, gameState, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        // Browser: use global
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processHyperactiveMoves === 'function') {
            return CardHyperactive.processHyperactiveMoves(cardState, gameState, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardHyperactive module not available');
        return { moved: [], destroyed: [], flipped: [], flippedByOwner: { black: [], white: [] } };
    }


    function processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, options = {}) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            return mod.processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt,
                currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
                inheritedHyperactiveTurns: INHERITED_HYPERACTIVE_TURNS,
                expectedSpecialType: options.expectedSpecialType || null
            });
        }
        // Browser: use global
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processHyperactiveMoveAtAnchor === 'function') {
            return CardHyperactive.processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt,
                currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
                inheritedHyperactiveTurns: INHERITED_HYPERACTIVE_TURNS,
                expectedSpecialType: options.expectedSpecialType || null
            });
        }
        console.warn('[cards.js] CardHyperactive module not available');
        return { moved: [], destroyed: [], flipped: [] };
    }

    function processRobotVacuumMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, options = {}) {
        const deps = {
            defaultPrng: defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            isBlockedCell,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt,
            currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
            robotVacuumTurns: ROBOT_VACUUM_TURNS
        };
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            if (mod && typeof mod.processRobotVacuumMoveAtAnchor === 'function') {
                return mod.processRobotVacuumMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps);
            }
        }
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processRobotVacuumMoveAtAnchor === 'function') {
            return CardHyperactive.processRobotVacuumMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps);
        }
        console.warn('[cards.js] CardHyperactive robot-vacuum module not available');
        return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey, sucked: [], expired: [], suckedCount: 0 };
    }

    function processGluttonousMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, options = {}) {
        const deps = {
            defaultPrng: defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            isBlockedCell,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt,
            currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey
        };
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            if (mod && typeof mod.processGluttonousMoveAtAnchor === 'function') {
                return mod.processGluttonousMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps);
            }
        }
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processGluttonousMoveAtAnchor === 'function') {
            return CardHyperactive.processGluttonousMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps);
        }
        console.warn('[cards.js] CardHyperactive gluttonous module not available');
        return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey, ate: [] };
    }

    function resolveHyperactiveFlipEvasion(cardState, gameState, flipCells, ownerAfterKey, prng) {
        const fallbackFlips = (Array.isArray(flipCells) ? flipCells : []).map((cell) => {
            if (Array.isArray(cell) && Number.isInteger(cell[0]) && Number.isInteger(cell[1])) {
                return [cell[0], cell[1]];
            }
            if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col)) {
                return [cell.row, cell.col];
            }
            return null;
        }).filter((cell) => !!cell);

        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            if (mod && typeof mod.resolveHyperactiveFlipEvasion === 'function') {
                return mod.resolveHyperactiveFlipEvasion(cardState, gameState, fallbackFlips, ownerAfterKey, prng, {
                    defaultPrng: defaultPrng,
                    clearHyperactiveAtPositions,
                    isBlockedCell,
                    BoardOps: BoardOpsModule,
                    destroyAt
                });
            }
        }

        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.resolveHyperactiveFlipEvasion === 'function') {
            return CardHyperactive.resolveHyperactiveFlipEvasion(cardState, gameState, fallbackFlips, ownerAfterKey, prng, {
                defaultPrng: defaultPrng,
                clearHyperactiveAtPositions,
                isBlockedCell,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }

        console.warn('[cards.js] CardHyperactive flip-evasion module not available');
        return { remainingFlips: fallbackFlips, moved: [], destroyed: [], evaded: [] };
    }

    function processInstantHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng) {
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            return mod.processInstantHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processInstantHyperactiveMoveAtAnchor === 'function') {
            return CardHyperactive.processInstantHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                isBlockedCell,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardHyperactive instant module not available');
        return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey };
    }

    function processUltimateHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, options = {}) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            return mod.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
                ultimateHyperactiveTurns: ULTIMATE_HYPERACTIVE_TURNS,
                clearUltimateAtPositions: clearHyperactiveAtPositions,
                clearHyperactiveAtPositions,
                clearBombAt,
                isBlockedCell,
                getFlipsWithContext: getFlipsWithContextLocal,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        // Browser: use global
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processUltimateHyperactiveMoveAtAnchor === 'function') {
            return CardHyperactive.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                currentTurnPlayerKey: options.currentTurnPlayerKey || playerKey,
                ultimateHyperactiveTurns: ULTIMATE_HYPERACTIVE_TURNS,
                clearUltimateAtPositions: clearHyperactiveAtPositions,
                clearHyperactiveAtPositions,
                clearBombAt,
                isBlockedCell,
                getFlipsWithContext: getFlipsWithContextLocal,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardHyperactive ultimate module not available');
        return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey };
    }


    function processBreedingEffects(cardState, gameState, playerKey, prng) {
        // Delegate to cards/breeding.js module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/breeding');
            return mod.processBreedingEffects(cardState, gameState, playerKey, prng, {
                defaultPrng: defaultPrng,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        // Browser: use global
        if (typeof CardBreeding !== 'undefined' && typeof CardBreeding.processBreedingEffects === 'function') {
            return CardBreeding.processBreedingEffects(cardState, gameState, playerKey, prng, {
                defaultPrng: defaultPrng,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardBreeding module not available');
        return { spawned: [], destroyed: [], flipped: [], anchors: [] };
    }


    /**
     * Process a single BREEDING anchor immediately (placement-turn immediate spawn).
     * Delegates to cards/breeding.js module.
     */
    function processBreedingEffectsAtAnchor(cardState, gameState, playerKey, row, col, prng) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/breeding');
            return mod.processBreedingEffectsAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        // Browser: use global
        if (typeof CardBreeding !== 'undefined' && typeof CardBreeding.processBreedingEffectsAtAnchor === 'function') {
            return CardBreeding.processBreedingEffectsAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardBreeding module not available');
        return { spawned: [], destroyed: [], flipped: [] };
    }

    function processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng) {
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./cards/breeding');
                if (mod && typeof mod.processBreedingEffectsAtTurnStartAnchor === 'function') {
                    return mod.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng, {
                        defaultPrng: defaultPrng,
                        getCardContext,
                        getFlipsWithContext: getFlipsWithContextLocal,
                        clearBombAt,
                        clearHyperactiveAtPositions,
                        BoardOps: BoardOpsModule,
                        destroyAt
                    });
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof CardBreeding !== 'undefined' && typeof CardBreeding.processBreedingEffectsAtTurnStartAnchor === 'function') {
            return CardBreeding.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardBreeding turn-start anchor processor not available');
        return { spawned: [], destroyed: [], flipped: [], anchors: [] };
    }


    /**
     * Apply DESTROY_ONE_STONE
     * Delegates to effects/destroy_one_stone.js module.
     */
    function applyDestroyEffect(cardState, gameState, playerKey, row, col) {
        // Delegate to effect module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./effects/destroy_one_stone');
            const r = mod.applyDestroyOneStone(cardState, gameState, playerKey, row, col, { BoardOps: BoardOpsModule, destroyAt });
            return !!r.destroyed;
        }
        // Browser: use global
        if (typeof DestroyOneStone !== 'undefined' && typeof DestroyOneStone.applyDestroyOneStone === 'function') {
            const r = DestroyOneStone.applyDestroyOneStone(cardState, gameState, playerKey, row, col, { BoardOps: BoardOpsModule, destroyAt });
            return !!r.destroyed;
        }
        console.warn('[cards.js] DestroyOneStone module not available');
        return false;
    }


    /**
     * Apply SWAP_WITH_ENEMY
     * Delegates to effects/swap_with_enemy.js module.
     */
    function applySwapEffect(cardState, gameState, playerKey, row, col) {
        const cardContext = getCardContext(cardState);
        // Delegate to effect module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./effects/swap_with_enemy');
            const core = require('./core');
            const r = mod.applySwapWithEnemy(cardState, gameState, playerKey, row, col, {
                BoardOps: BoardOpsModule,
                clearHyperactiveAtPositions,
                clearBombAt,
                cardContext,
                Core: core
            });
            return !!r.swapped;
        }
        // Browser: use global
        if (typeof SwapWithEnemy !== 'undefined' && typeof SwapWithEnemy.applySwapWithEnemy === 'function') {
            const browserCore = (typeof CoreLogic !== 'undefined')
                ? CoreLogic
                : (typeof Core !== 'undefined' ? Core : null);
            const r = SwapWithEnemy.applySwapWithEnemy(cardState, gameState, playerKey, row, col, {
                BoardOps: BoardOpsModule,
                clearHyperactiveAtPositions,
                clearBombAt,
                cardContext,
                Core: browserCore
            });
            return !!r.swapped;
        }
        console.warn('[cards.js] SwapWithEnemy module not available');
        return false;
    }

    function applyPositionSwapWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'POSITION_SWAP_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return { applied: false, reason: 'out_of_board' };
        if (!gameState || !gameState.board || gameState.board[row][col] === EMPTY) return { applied: false, reason: 'empty' };
        if (isPositionSwapProtectedCell(cardState, row, col)) return { applied: false, reason: 'swap_protected' };

        const first = pending.firstTarget ? { row: pending.firstTarget.row, col: pending.firstTarget.col } : null;
        if (!first) {
            pending.firstTarget = { row, col };
            return { applied: true, completed: false, firstTarget: { row, col } };
        }

        if (first.row === row && first.col === col) {
            return { applied: false, reason: 'same_target' };
        }
        if (first.row < 0 || first.row >= 8 || first.col < 0 || first.col >= 8) {
            pending.firstTarget = { row, col };
            return { applied: true, completed: false, firstTarget: { row, col } };
        }
        if (gameState.board[first.row][first.col] === EMPTY) {
            pending.firstTarget = { row, col };
            return { applied: true, completed: false, firstTarget: { row, col } };
        }
        if (isPositionSwapProtectedCell(cardState, first.row, first.col)) {
            pending.firstTarget = { row, col };
            return { applied: true, completed: false, firstTarget: { row, col } };
        }

        const stoneIdA = cardState.stoneIdMap && cardState.stoneIdMap[first.row] ? cardState.stoneIdMap[first.row][first.col] : null;
        const stoneIdB = cardState.stoneIdMap && cardState.stoneIdMap[row] ? cardState.stoneIdMap[row][col] : null;
        const ownerBeforeA = gameState.board[first.row][first.col] === (BLACK || 1) ? 'black' : 'white';
        const ownerBeforeB = gameState.board[row][col] === (BLACK || 1) ? 'black' : 'white';

        const tmp = gameState.board[first.row][first.col];
        gameState.board[first.row][first.col] = gameState.board[row][col];
        gameState.board[row][col] = tmp;

        swapCellCoordinates(cardState, first, { row, col });
        cardState.pendingEffectByPlayer[playerKey] = null;

        emitPresentationEvent(cardState, {
            type: 'MOVE',
            stoneId: stoneIdA,
            row,
            col,
            prevRow: first.row,
            prevCol: first.col,
            ownerBefore: ownerBeforeA,
            ownerAfter: ownerBeforeA,
            cause: 'POSITION_SWAP_WILL',
            reason: 'position_swap'
        });
        emitPresentationEvent(cardState, {
            type: 'MOVE',
            stoneId: stoneIdB,
            row: first.row,
            col: first.col,
            prevRow: row,
            prevCol: col,
            ownerBefore: ownerBeforeB,
            ownerAfter: ownerBeforeB,
            cause: 'POSITION_SWAP_WILL',
            reason: 'position_swap'
        });

        return { applied: true, completed: true, from: first, to: { row, col } };
    }


    /**
     * Get context for core logic
     * @param {Object} cardState
    * @returns {Object} { protectedStones, permaProtectedStones, bombs, blockedCells }
     */
    function getCardContext(cardState) {
        const specials = getSpecialMarkers(cardState);
        const protectedStones = specials
            .filter(s => s.data && s.data.type === 'PROTECTED')
            .map(s => ({ row: s.row, col: s.col, owner: s.owner }));

        // PERMA_PROTECTED, DRAGON, BREEDING, UDG, LIGHTNING, GLUTTONOUS, and GUARD stones are immune to flipping.
        const permaProtectedStones = specials
            .filter(s => {
                if (!s.data) return false;
                if (
                    s.data.type === 'PERMA_PROTECTED' ||
                    s.data.type === 'DRAGON' ||
                    s.data.type === 'BREEDING' ||
                    s.data.type === 'DESTROY_DRAGON' ||
                    s.data.type === 'LIGHTNING' ||
                    s.data.type === 'GLUTTONOUS' ||
                    s.data.type === 'ULTIMATE_DESTROY_GOD' ||
                    s.data.type === 'GUARD'
                ) {
                    return true;
                }
                return false;
            })
            .map(s => ({
                row: s.row,
                col: s.col,
                owner: s.owner === 'black' ? BLACK : WHITE
            }));

        const bombs = getBombMarkers(cardState).map(b => ({
            row: b.row,
            col: b.col,
            remainingTurns: b.data ? b.data.remainingTurns : undefined,
            owner: b.owner,
            placedTurn: b.data ? b.data.placedTurn : undefined,
            createdSeq: b.createdSeq
        }));

        const blockedCells = getBlockingMarkers(cardState).map(m => ({
            row: m.row,
            col: m.col,
            type: m.data ? m.data.type : null,
            remainingOwnerTurns: m.data ? m.data.remainingOwnerTurns : undefined,
            owner: m.owner
        }));

        return {
            protectedStones,
            permaProtectedStones,
            bombs,
            blockedCells
        };
    }

    /**
     * Called when a turn ends (after move or pass)
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey - 'black' or 'white'
     */
    function onTurnEnd(cardState, gameState, playerKey) {
        // Protection expiration is now handled exclusively in onTurnStart
        // to ensure it lasts until the start of the owner's next turn.
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (pending && pending.type === 'CHAIN_WILL') {
            cardState.pendingEffectByPlayer[playerKey] = null;
        }
    }

    /**
     * Check active pending effect
     * @param {Object} cardState
     * @param {string} playerKey
     * @returns {boolean}
     */
    function hasPendingEffect(cardState, playerKey) {
        return cardState.pendingEffectByPlayer[playerKey] !== null;
    }

    // Presentation event helpers (PoC)
    function allocateStoneId(cardState) {
        if (!cardState) return null;
        if (cardState._nextStoneId === undefined || cardState._nextStoneId === null) cardState._nextStoneId = 1;
        const id = 's' + String(cardState._nextStoneId++);
        return id;
    }

    function emitPresentationEvent(cardState, ev) {
        if (!cardState) return;
        // BoardOps central emitter fills action meta (actionId, turnIndex, plyIndex)
        if (BoardOpsModule && typeof BoardOpsModule.emitPresentationEvent === 'function') {
            BoardOpsModule.emitPresentationEvent(cardState, ev);
            return;
        }
        // BoardOps not available; rely on centralized presentation helper to warn once if needed.
    }

    function flushPresentationEvents(cardState) {
        if (!cardState || !cardState.presentationEvents) return [];
        const out = cardState.presentationEvents.slice();
        // Persist only when BoardOps is not available (BoardOps already persists on emit).
        if (!(BoardOpsModule && typeof BoardOpsModule.emitPresentationEvent === 'function')) {
            if (!cardState._presentationEventsPersist) cardState._presentationEventsPersist = [];
            cardState._presentationEventsPersist.push(...out);
        }
        cardState.presentationEvents.length = 0;
        return out;
    }

    /**
     * Get pending effect type
     * @param {Object} cardState
     * @param {string} playerKey
     * @returns {string|null}
     */
    function getPendingEffectType(cardState, playerKey) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        return pending ? pending.type : null;
    }

    /**
     * Get selectable friendly stone cells for the current pending effect (UI highlight helper).
     * @param {Object} cardState 
     * @param {Object} gameState 
     * @param {string} playerKey - 'black'|'white'
     * @returns {Array<{row:number,col:number}>}
     */
    function getSelectableTargets(cardState, gameState, playerKey) {
        const pending = (cardState && cardState.pendingEffectByPlayer) ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending) return [];

        // Delegate to selectors module when available
        if (typeof require === 'function' || (typeof globalThis !== 'undefined' && globalThis.CardSelectors)) {
            try {
                const mod = (typeof require === 'function') ? require('./cards/selectors') : globalThis.CardSelectors;
                if (mod) {
                    if (pending.type === 'DESTROY_ONE_STONE' && typeof mod.getDestroyTargets === 'function') {
                        return mod.getDestroyTargets(cardState, gameState);
                    }
                    if (pending.type === 'STRONG_WIND_WILL' && typeof mod.getStrongWindTargets === 'function') {
                        return mod.getStrongWindTargets(cardState, gameState);
                    }
                    if (pending.type === 'SUPER_BUOYANCY_WILL' && typeof mod.getSuperBuoyancyTargets === 'function') {
                        return mod.getSuperBuoyancyTargets(cardState, gameState);
                    }
                    if (pending.type === 'SUPER_GRAVITY_WILL' && typeof mod.getSuperGravityTargets === 'function') {
                        return mod.getSuperGravityTargets(cardState, gameState);
                    }
                    if (pending.type === 'SACRIFICE_WILL' && typeof mod.getSacrificeTargets === 'function') {
                        return mod.getSacrificeTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'SWAP_WITH_ENEMY' && typeof mod.getSwapTargets === 'function') {
                        return mod.getSwapTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'POSITION_SWAP_WILL' && typeof mod.getPositionSwapTargets === 'function') {
                        return mod.getPositionSwapTargets(cardState, gameState, playerKey, pending);
                    }
                    if (pending.type === 'TRAP_WILL' && typeof mod.getTrapTargets === 'function') {
                        return mod.getTrapTargets(cardState, gameState, playerKey);
                    }
                    if ((pending.type === 'GUARD_WILL' || pending.type === 'GUARDIAN_GOD') && typeof mod.getGuardTargets === 'function') {
                        return mod.getGuardTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'HYPERACTIVE_INHERIT_WILL' && typeof mod.getHyperactiveInheritTargets === 'function') {
                        return mod.getHyperactiveInheritTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'TIME_BOMB' && typeof mod.getTimeBombTargets === 'function') {
                        return mod.getTimeBombTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'TELEPORT_WILL' && typeof mod.getTeleportTargets === 'function') {
                        return mod.getTeleportTargets(cardState, gameState);
                    }
                    if (pending.type === 'CELL_TELEPORT_WILL' && typeof mod.getCellTeleportTargets === 'function') {
                        return mod.getCellTeleportTargets(cardState, gameState);
                    }
                    if (pending.type === 'CLONE_WILL' && typeof mod.getCloneTargets === 'function') {
                        return mod.getCloneTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'SPLIT_WILL' && typeof mod.getSplitTargets === 'function') {
                        return mod.getSplitTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'BOARD_EXPANSION_WILL' && typeof mod.getBoardExpansionTargets === 'function') {
                        return mod.getBoardExpansionTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'BOARD_EXPANSION_GOD' && typeof mod.getBoardExpansionGodTargets === 'function') {
                        return mod.getBoardExpansionGodTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'EXTEND_LIFE_WILL' && typeof mod.getExtendLifeTargets === 'function') {
                        return mod.getExtendLifeTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'CORROSION_WILL' && typeof mod.getCorrosionTargets === 'function') {
                        return mod.getCorrosionTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'BLOCKADE_WILL' && typeof mod.getBlockadeTargets === 'function') {
                        return mod.getBlockadeTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'METEOR_WILL' && typeof mod.getMeteorTargets === 'function') {
                        return mod.getMeteorTargets(cardState, gameState, playerKey);
                    }
                }
            } catch (e) {
                // fall through to local implementation
            }
        }

        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const opponentVal = -playerVal;
        const res = [];

        if (pending.type === 'DESTROY_ONE_STONE') {
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (gameState.board[r][c] !== EMPTY) {
                        res.push({ row: r, col: c });
                    }
                }
            }
            return res;
        }

        if (pending.type === 'SACRIFICE_WILL') {
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (gameState.board[r][c] === playerVal) {
                        res.push({ row: r, col: c });
                    }
                }
            }
            return res;
        }

        if (pending.type === 'STRONG_WIND_WILL') {
            return getStrongWindTargets(cardState, gameState);
        }

        if (pending.type === 'SUPER_BUOYANCY_WILL') {
            return getSuperBuoyancyTargets(cardState, gameState);
        }

        if (pending.type === 'SUPER_GRAVITY_WILL') {
            return getSuperGravityTargets(cardState, gameState);
        }

        if (pending.type === 'SWAP_WITH_ENEMY') {
            const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];

            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (gameState.board[r][c] !== opponentVal) continue;
                    const hasSpecialOrBomb = markers.some(m => {
                        if (!m || m.row !== r || m.col !== c) return false;
                        if (m.kind === 'bomb') return true;
                        if (m.kind !== 'specialStone') return false;
                        const isExpiredUltimateHyperactive = !!(
                            m.data &&
                            m.data.type === 'ULTIMATE_HYPERACTIVE' &&
                            Number.isFinite(Number(m.data.remainingOwnerTurns)) &&
                            Number(m.data.remainingOwnerTurns) <= 0
                        );
                        if (isExpiredUltimateHyperactive) return false;
                        return true;
                    });
                    if (hasSpecialOrBomb) continue;
                    res.push({ row: r, col: c });
                }
            }
            return res;
        }

        if (pending.type === 'POSITION_SWAP_WILL') {
            const first = pending.firstTarget ? { row: pending.firstTarget.row, col: pending.firstTarget.col } : null;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (gameState.board[r][c] === EMPTY) continue;
                    if (first && first.row === r && first.col === c) continue;
                    if (isPositionSwapProtectedCell(cardState, r, c)) continue;
                    res.push({ row: r, col: c });
                }
            }
            return res;
        }

        if (pending.type === 'TEMPT_WILL') {
            return getTemptWillTargets(cardState, gameState, playerKey);
        }

        if (pending.type === 'TRAP_WILL') {
            return getTrapTargets(cardState, gameState, playerKey);
        }

        if (pending.type === 'GUARD_WILL' || pending.type === 'GUARDIAN_GOD') {
            return getGuardTargets(cardState, gameState, playerKey);
        }
        if (pending.type === 'HYPERACTIVE_INHERIT_WILL') {
            return getHyperactiveInheritTargets(cardState, gameState, playerKey);
        }
        if (pending.type === 'TIME_BOMB') {
            return getTimeBombTargets(cardState, gameState, playerKey);
        }
        if (pending.type === 'TELEPORT_WILL') {
            return getTeleportTargets(cardState, gameState);
        }
        if (pending.type === 'CELL_TELEPORT_WILL') {
            return getCellTeleportTargets(cardState, gameState);
        }
        if (pending.type === 'CLONE_WILL') {
            return getCloneTargets(cardState, gameState, playerKey);
        }
        if (pending.type === 'SPLIT_WILL') {
            return getSplitTargets(cardState, gameState, playerKey);
        }
        if (pending.type === 'BOARD_EXPANSION_WILL') {
            return getBoardExpansionTargets(cardState, gameState, playerKey);
        }
        if (pending.type === 'BOARD_EXPANSION_GOD') {
            return getBoardExpansionGodTargets(cardState, gameState, playerKey);
        }
        if (pending.type === 'EXTEND_LIFE_WILL') {
            return getExtendLifeTargets(cardState, gameState, playerKey);
        }
        if (pending.type === 'CORROSION_WILL') {
            return getCorrosionTargets(cardState, gameState, playerKey);
        }
        if (pending.type === 'BLOCKADE_WILL') {
            return getBlockadeTargets(cardState, gameState, playerKey);
        }
        if (pending.type === 'METEOR_WILL') {
            return getMeteorTargets(cardState, gameState, playerKey);
        }

        return res;
    }

    return {
        // Constants
        INITIAL_HAND_SIZE,
        TIME_BOMB_TURNS,
        ULTIMATE_DRAGON_TURNS,
        ULTIMATE_DESTROY_GOD_TURNS,
        ULTIMATE_HYPERACTIVE_TURNS,
        SNIPER_WILL_TURNS,
        DESTROY_DRAGON_TURNS,
        LIGHTNING_WILL_TURNS,
        OBSERVER_WILL_TURNS,

        // State factories
        createCardState,
        copyCardState,
        dealInitialHands,
        initGame,
        addMarker,
        removeMarkerById,

        // Core operations
        commitDraw,
        getCardDef,
        getCardType,
        getCardDisplayName,
        getCardCodeName,
        getCardCost,
        canUseCard,
        destroyHandCard,
        getUsableCardIds,
        hasUsableCard,
        applyCardUsage,
        destroyAt,
        clearBombAt,
        processBreedingEffects,
        processUltimateDestroyGodEffects,
        processSniperWillEffects,
        processDestroyDragonEffects,
        processLightningWillEffects,

        // Game flow
        onTurnStart,
        onTurnEnd,
        applyPlacementEffects,
        tickBombs,
        tickBombAt,
        processDragonEffects,
        processDragonEffectsAtTurnStartAnchor,
        processDragonEffectsAtAnchor,
        applyDestroyEffect,
        applySwapEffect,
        applyPositionSwapWill,
        applyStrongWill,
        applySacrificeWill,
        applySellCardWill,
        applyHeavenBlessingChoice,
        applyCondemnWill,
        applyTemptWill,
        applyExtendLifeWill,
        applyCorrosionWill,
        applyGuardWill,
        applyHyperactiveInheritWill,
        applyTimeBombWill,
        applyTeleportWill,
        applyCellTeleportWill,
        applyCloneWill,
        applySplitWill,
        applyBoardExpansionWill,
        applyBoardExpansionGod,
        applyBlockadeWill,
        applyMeteorWill,
        applyLossWill,
        applyStrongWindWill,
        applySuperBuoyancyWill,
        applySuperGravityWill,
        armRiboWillEffect,
        applyRegenWill,
        applyRegenAfterFlips,
        applyChainWillAfterMove,
        processBreedingEffectsAtTurnStartAnchor,
        processBreedingEffectsAtAnchor,
        processUltimateDestroyGodEffectsAtTurnStartAnchor,
        processUltimateDestroyGodEffectsAtAnchor,
        processSniperWillEffectsAtTurnStartAnchor,
        processLightningWillEffectsAtTurnStartAnchor,
        processLightningWillEffectsAtAnchor,
        processObserverWillEffectsAtTurnStartAnchor,
        processDestroyDragonEffectsAtAnchor,
        processDestroyDragonEffectsAtTurnStartAnchor,

        // Helpers
        getCardContext,
        hasPendingEffect,
        getPendingEffectType,
        getSelectableTargets,
        getStrongWindTargets,
        getSuperBuoyancyTargets,
        getSuperGravityTargets,
        getTabooReverseCandidates,
        pickTabooReverseFlips,
        cancelPendingSelection,
        getTemptWillTargets,
        getExtendLifeTargets,
        getCorrosionTargets,
        getGuardTargets,
        getHyperactiveInheritTargets,
        getTimeBombTargets,
        getTeleportTargets,
        getCellTeleportTargets,
        getCloneTargets,
        getSplitTargets,
        getBoardExpansionTargets,
        getBoardExpansionGodTargets,
        getBlockadeTargets,
        getMeteorTargets,
        isBlockedCell,
        getTrapTargets,
        applyTrapWill,
        processTrapEffects,
        clearHyperactiveAtPositions,
        resolveHyperactiveFlipEvasion,
        processHyperactiveMoves,
        processHyperactiveMoveAtAnchor,
        processGluttonousMoveAtAnchor,
        processRobotVacuumMoveAtAnchor,
        processInstantHyperactiveMoveAtAnchor,
        processUltimateHyperactiveMoveAtAnchor,
        // Presentation helpers (PoC)
        allocateStoneId,
        emitPresentationEvent,
        flushPresentationEvents
    };
}));
