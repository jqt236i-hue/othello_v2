/**
 * @file work_will.js
 * @description Work Will (出稼ぎの意志) helpers
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardWork = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};

    function placeWorkStone(cardState, gameState, playerKey, row, col, deps = {}) {
        try { console.log('[WORK_DEBUG] placeWorkStone called', { playerKey, row, col }); } catch (e) { }
        // Ensure only one per player: remove old work stone if exists
        const prev = (cardState.workAnchorPosByPlayer && cardState.workAnchorPosByPlayer[playerKey]) || null;
        if (prev && (prev.row !== row || prev.col !== col)) {
            // remove existing specialStone of type WORK at prev
            if (cardState.markers) {
                cardState.markers = cardState.markers.filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'WORK' && m.owner === playerKey && m.row === prev.row && m.col === prev.col));
            }
            cardState.workAnchorPosByPlayer[playerKey] = null;
        }

        // Add marker
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
                data: Object.assign({ type: 'WORK', ownerColor: owner, workStage: 0, remainingOwnerTurns: 5 }, data || {})
            });
            return { placed: true };
        });

        addMarker(cardState, 'specialStone', row, col, playerKey, { type: 'WORK', ownerColor: playerKey, workStage: 0, remainingOwnerTurns: 5 });
        // anchor pos
        if (!cardState.workAnchorPosByPlayer) cardState.workAnchorPosByPlayer = { black: null, white: null };
        cardState.workAnchorPosByPlayer[playerKey] = { row, col };

        return { placed: true };
    }

    function processWorkEffects(cardState, gameState, playerKey, deps = {}) {
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const ownerVal = playerKey === 'black' ? P_BLACK : P_WHITE;

        // locate work stone via anchor or fallback scan
        const anchor = (cardState.workAnchorPosByPlayer && cardState.workAnchorPosByPlayer[playerKey]) || null;
        let row = null, col = null;
        if (anchor) { row = anchor.row; col = anchor.col; }
        let special = null;
        if (row !== null) {
            special = (cardState.markers || []).find(s => s.kind === 'specialStone' && s.data && s.data.type === 'WORK' && s.owner === playerKey && s.row === row && s.col === col);
        }
        if (!special) {
            // fallback: search
            special = (cardState.markers || []).find(s => s.kind === 'specialStone' && s.data && s.data.type === 'WORK' && s.owner === playerKey);
            if (special) { row = special.row; col = special.col; cardState.workAnchorPosByPlayer[playerKey] = { row, col }; }
        }

        if (!special) return { gained: 0, removed: false };

        // validate: cell must exist and match ownerColor
        const cellVal = gameState.board[row][col];
        const ownerColor = (special.data && special.data.ownerColor) || special.owner; // ownerColor may be string 'black'/'white'
        const expectedVal = ownerColor === 'black' ? P_BLACK : (ownerColor === 'white' ? P_WHITE : (playerKey === 'black' ? P_BLACK : P_WHITE));
        if (cellVal === EMPTY || cellVal !== expectedVal) {
            // remove special marker
            cardState.markers = (cardState.markers || []).filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'WORK' && m.owner === playerKey && m.row === row && m.col === col));
            cardState.workAnchorPosByPlayer[playerKey] = null;
            return { gained: 0, removed: true };
        }

        // compute gain based on workStage (0..4)
        const stage = (special.data && typeof special.data.workStage === 'number') ? special.data.workStage : 0;
        if (stage < 0 || stage > 4) {
            // inconsistent, remove
            cardState.workAnchorPosByPlayer[playerKey] = null;
            return { gained: 0, removed: true };
        }

        const gain = Math.min(30, (1 << stage)); // 1,2,4,8,16 (but later clamp)
        // apply charge with clamp at 30
        cardState.charge[playerKey] = Math.min(30, (cardState.charge[playerKey] || 0) + gain);

        // increment stage
        const newStage = stage + 1;
        // update marker (stage + remainingOwnerTurns)
        for (const s of (cardState.markers || [])) {
            if (s.kind === 'specialStone' && s.data && s.data.type === 'WORK' && s.row === row && s.col === col && s.owner === playerKey) {
                s.data.workStage = newStage;
                // remainingOwnerTurns counts down from 5
                s.data.remainingOwnerTurns = Math.max(0, 5 - newStage);
                if (s.data.ownerColor === undefined) s.data.ownerColor = s.owner;
            }
        }

        let removed = false;
        if (newStage >= 5) {
            // remove marker and anchor
            cardState.markers = (cardState.markers || []).filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'WORK' && m.owner === playerKey && m.row === row && m.col === col));
            cardState.workAnchorPosByPlayer[playerKey] = null;
            removed = true;
        }

        return { gained: gain, removed };
    }

    return {
        placeWorkStone,
        processWorkEffects
    };
}));
