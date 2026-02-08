/**
 * @file regen.js
 * @description REGEN effect helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardRegen = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};

    if (BLACK === undefined || WHITE === undefined || DIRECTIONS === undefined) {
        throw new Error('SharedConstants (BLACK/WHITE/DIRECTIONS) required');
    }

    function applyRegenWill(cardState, playerKey, row, col, deps = {}) {
        const addMarker = deps.addMarker || ((cs, kind, r, c, owner, data) => {
            if (!cs.markers) cs.markers = [];
            const id = (typeof cs._nextMarkerId === 'number') ? cs._nextMarkerId++ : 1;
            const createdSeq = (typeof cs._nextCreatedSeq === 'number') ? cs._nextCreatedSeq++ : 1;
            cs.markers.push({
                id,
                row: r,
                col: c,
                kind: kind,
                owner,
                createdSeq,
                data: { type: data.type, regenRemaining: data.regenRemaining, ownerColor: data.ownerColor }
            });
            return true;
        });

        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'REGEN',
            regenRemaining: 1,
            ownerColor: playerKey === 'black' ? (BLACK || 1) : (WHITE || -1)
        });
        return { applied: true };
    }

    function applyRegenAfterFlips(cardState, gameState, flips, flipperKey, skipCapture, deps = {}) {
        const regened = [];
        const captureFlips = [];
        if (!flips || !flips.length) return { regened, captureFlips };
        const consumedRegenKeys = new Set();

        const getCardContext = deps.getCardContext || (() => ({ protectedStones: (cardState.markers ? cardState.markers.filter(m => m.kind === 'specialStone' && m.data && m.data.type === 'PROTECTED').map(m => ({ row: m.row, col: m.col })) : []), permaProtectedStones: (cardState.markers ? cardState.markers.filter(m => m.kind === 'specialStone' && m.data && (m.data.type === 'PERMA_PROTECTED' || m.data.type === 'DRAGON' || m.data.type === 'BREEDING' || m.data.type === 'ULTIMATE_DESTROY_GOD')).map(m => ({ row: m.row, col: m.col })) : []) }));
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'bomb' && m.row === r && m.col === c)); });

        const specials = (cardState.markers || []).filter(m => m.kind === 'specialStone');
        const dirs = DIRECTIONS;

        const context = getCardContext(cardState);
        const isBlocked = (r, c) => {
            const key = `${r},${c}`;
            const protSet = context.protectedStones ? new Set(context.protectedStones.map(p => `${p.row},${p.col}`)) : null;
            const permaSet = context.permaProtectedStones ? new Set(context.permaProtectedStones.map(p => `${p.row},${p.col}`)) : null;
            if (protSet && protSet.has(key)) return true;
            if (permaSet && permaSet.has(key)) return true;
            return false;
        };

        const toObj = (p) => (typeof p.row === 'number' ? p : { row: p[0], col: p[1] });

        for (const raw of flips) {
            const pos = toObj(raw);
            const idx = specials.findIndex(s => s.data && s.data.type === 'REGEN' && s.row === pos.row && s.col === pos.col && (s.data.regenRemaining || 0) > 0);
            if (idx === -1) continue;
            const regen = specials[idx];
            const ownerColor = regen.owner === 'black' ? (BLACK || 1) : (WHITE || -1);
            if (gameState.board[pos.row][pos.col] === ownerColor) continue; // not flipped against owner

            // consume regen and revert color
            regen.data.regenRemaining -= 1;
            if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                deps.BoardOps.changeAt(cardState, gameState, pos.row, pos.col, regen.owner, 'REGEN', 'regen_triggered');
            } else {
                gameState.board[pos.row][pos.col] = ownerColor;
            }
            regened.push({ row: pos.row, col: pos.col });

            if (skipCapture) continue;

            // single-origin capture from this cell
            for (const [dr, dc] of dirs) {
                const line = [];
                let r = pos.row + dr;
                let c = pos.col + dc;
                while (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === -ownerColor) {
                    if (isBlocked(r, c)) {
                        line.length = 0;
                        break;
                    }
                    line.push({ row: r, col: c });
                    r += dr;
                    c += dc;
                }
                if (line.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === ownerColor) {
                    for (const p of line) {
                        if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                            deps.BoardOps.changeAt(cardState, gameState, p.row, p.col, regen.owner, 'REGEN', 'regen_capture_flip');
                        } else {
                            gameState.board[p.row][p.col] = ownerColor;
                        }
                        clearBombAt(cardState, p.row, p.col);
                        captureFlips.push(p);
                    }
                }
            }

            // REGEN is one-time use. Remove marker immediately and emit a status-removed event
            // so UI can run "regen visual -> normal stone" transition right after regen sequence.
            if ((regen.data.regenRemaining || 0) <= 0) {
                const k = `${pos.row},${pos.col}`;
                if (!consumedRegenKeys.has(k)) {
                    consumedRegenKeys.add(k);

                    if (typeof deps.removeMarkersAt === 'function') {
                        deps.removeMarkersAt(cardState, pos.row, pos.col, {
                            kind: 'specialStone',
                            type: 'REGEN',
                            owner: regen.owner
                        });
                    } else if (Array.isArray(cardState.markers)) {
                        cardState.markers = cardState.markers.filter(m => !(
                            m &&
                            m.kind === 'specialStone' &&
                            m.row === pos.row &&
                            m.col === pos.col &&
                            m.data &&
                            m.data.type === 'REGEN'
                        ));
                    }

                    if (deps.BoardOps && typeof deps.BoardOps.emitPresentationEvent === 'function') {
                        deps.BoardOps.emitPresentationEvent(cardState, {
                            type: 'STATUS_REMOVED',
                            row: pos.row,
                            col: pos.col,
                            cause: 'REGEN',
                            reason: 'regen_consumed',
                            meta: { special: 'REGEN', reason: 'regen_consumed' }
                        });
                    }
                }
            }
        }

        return { regened, captureFlips };
    }

    return {
        applyRegenWill,
        applyRegenAfterFlips
    };
}));
