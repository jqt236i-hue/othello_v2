/**
 * @file breeding.js
 * @description Breeding effect helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardBreeding = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }

    function _posKey(row, col) {
        return `${row},${col}`;
    }

    function _normalizePositions(positions) {
        const out = [];
        const seen = new Set();
        const src = Array.isArray(positions) ? positions : [];
        for (const p of src) {
            if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col)) continue;
            const key = _posKey(p.row, p.col);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ row: p.row, col: p.col });
        }
        return out;
    }

    function _ensureBreedingRuntime(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.breedingFrontierByAnchorId || typeof cardState.breedingFrontierByAnchorId !== 'object') {
            cardState.breedingFrontierByAnchorId = {};
        }
        if (!cardState.breedingSproutByOwner || typeof cardState.breedingSproutByOwner !== 'object') {
            cardState.breedingSproutByOwner = { black: [], white: [] };
        }
        if (!Array.isArray(cardState.breedingSproutByOwner.black)) cardState.breedingSproutByOwner.black = [];
        if (!Array.isArray(cardState.breedingSproutByOwner.white)) cardState.breedingSproutByOwner.white = [];
        if (!cardState._breedingSproutClearedTokenByOwner || typeof cardState._breedingSproutClearedTokenByOwner !== 'object') {
            cardState._breedingSproutClearedTokenByOwner = { black: null, white: null };
        }
    }

    function _getFrontier(cardState, anchorId) {
        _ensureBreedingRuntime(cardState);
        const key = String(anchorId);
        const frontier = cardState.breedingFrontierByAnchorId[key];
        return _normalizePositions(frontier);
    }

    function _setFrontier(cardState, anchorId, positions) {
        _ensureBreedingRuntime(cardState);
        const key = String(anchorId);
        cardState.breedingFrontierByAnchorId[key] = _normalizePositions(positions);
    }

    function _clearFrontier(cardState, anchorId) {
        _ensureBreedingRuntime(cardState);
        delete cardState.breedingFrontierByAnchorId[String(anchorId)];
    }

    function _replaceSprouts(cardState, playerKey, positions) {
        _ensureBreedingRuntime(cardState);
        cardState.breedingSproutByOwner[playerKey] = _normalizePositions(positions);
    }

    function _mergeSprouts(cardState, playerKey, positions) {
        _ensureBreedingRuntime(cardState);
        const base = cardState.breedingSproutByOwner[playerKey] || [];
        cardState.breedingSproutByOwner[playerKey] = _normalizePositions(base.concat(positions || []));
    }

    function _clearSproutsOnceAtTurn(cardState, playerKey) {
        _ensureBreedingRuntime(cardState);
        const token = `${playerKey}:${Number.isFinite(cardState.turnIndex) ? cardState.turnIndex : 0}`;
        if (cardState._breedingSproutClearedTokenByOwner[playerKey] !== token) {
            cardState._breedingSproutClearedTokenByOwner[playerKey] = token;
            _replaceSprouts(cardState, playerKey, []);
        }
    }

    function _collectEmptyNeighborTargets(gameState, origins) {
        const targets = [];
        const seen = new Set();
        const src = _normalizePositions(origins);
        for (const origin of src) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const r = origin.row + dr;
                    const c = origin.col + dc;
                    if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
                    if (gameState.board[r][c] !== EMPTY) continue;
                    const key = _posKey(r, c);
                    if (seen.has(key)) continue;
                    seen.add(key);
                    targets.push({ row: r, col: c });
                }
            }
        }
        return targets;
    }

    function _pickRandomTarget(targets, prng) {
        const list = Array.isArray(targets) ? targets : [];
        if (list.length === 0) return null;
        const p = (prng && typeof prng.random === 'function') ? prng : { random: () => 0 };
        const idx = Math.floor(p.random() * list.length);
        return list[Math.max(0, Math.min(list.length - 1, idx))];
    }

    function _spawnAndFlipBatch(cardState, gameState, playerKey, player, targets, cause, reason, anchorPos, deps) {
        const spawned = [];
        const flipped = [];
        const flippedSet = new Set();
        const getCardContext = deps.getCardContext || (() => ({ protectedStones: [], permaProtectedStones: [] }));
        const getFlipsWithContext = deps.getFlipsWithContext || ((gs, r, c, playerVal, ctx) => []);
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'bomb' && m.row === r && m.col === c)); });
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions;

        for (const target of targets) {
            const context = getCardContext(cardState);
            const flips = getFlipsWithContext(gameState, target.row, target.col, player, context);

            let spawnRes = null;
            if (deps.BoardOps && typeof deps.BoardOps.spawnAt === 'function') {
                spawnRes = deps.BoardOps.spawnAt(cardState, gameState, target.row, target.col, playerKey, cause, reason);
            } else {
                gameState.board[target.row][target.col] = player;
            }
            spawned.push({
                row: target.row,
                col: target.col,
                anchorRow: anchorPos.row,
                anchorCol: anchorPos.col,
                stoneId: spawnRes ? spawnRes.stoneId : undefined
            });

            for (const [fr, fc] of flips) {
                if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                    deps.BoardOps.changeAt(cardState, gameState, fr, fc, playerKey, 'BREEDING', 'breeding_flip');
                } else {
                    gameState.board[fr][fc] = player;
                }
                clearBombAt(cardState, fr, fc);
                const key = _posKey(fr, fc);
                if (!flippedSet.has(key)) {
                    flippedSet.add(key);
                    flipped.push({ row: fr, col: fc });
                }
            }
        }

        if (flipped.length > 0 && typeof clearHyperactiveAtPositions === 'function') {
            clearHyperactiveAtPositions(cardState, flipped);
        }
        return { spawned, flipped };
    }

    function _processTurnStartAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const player = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const spawned = [];
        const destroyed = [];
        const flipped = [];
        const anchors = [];
        _ensureBreedingRuntime(cardState);
        _clearSproutsOnceAtTurn(cardState, playerKey);

        const anchor = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'BREEDING' && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!anchor) return { spawned, destroyed, flipped, anchors };
        if (gameState.board[row][col] !== player) {
            if (anchor.data) anchor.data.remainingOwnerTurns = -1;
            _clearFrontier(cardState, anchor.id);
            return { spawned, destroyed, flipped, anchors };
        }

        // Turn countdown: decrement first, then fire if >= 0 (0 fires too)
        const before = (anchor.data && (anchor.data.remainingOwnerTurns !== undefined && anchor.data.remainingOwnerTurns !== null))
            ? anchor.data.remainingOwnerTurns
            : 0;
        const afterDec = before - 1;
        if (anchor.data) anchor.data.remainingOwnerTurns = afterDec;
        if (afterDec < 0) return { spawned, destroyed, flipped, anchors };
        anchors.push({ row, col, remainingNow: afterDec });

        const previousFrontier = _getFrontier(cardState, anchor.id);
        const brokenFrontier = previousFrontier.some(p => gameState.board[p.row][p.col] !== player);
        const origins = previousFrontier.length === 0 || brokenFrontier
            ? [{ row, col }]
            : previousFrontier;
        const targets = _collectEmptyNeighborTargets(gameState, origins);
        const picked = _pickRandomTarget(targets, prng);

        const batch = _spawnAndFlipBatch(
            cardState,
            gameState,
            playerKey,
            player,
            picked ? [picked] : [],
            'BREEDING',
            'breeding_spawned',
            { row, col },
            deps
        );
        spawned.push(...batch.spawned);
        flipped.push(...batch.flipped);

        if (spawned.length > 0) _setFrontier(cardState, anchor.id, spawned);
        else if (previousFrontier.length === 0 || brokenFrontier) _setFrontier(cardState, anchor.id, []);

        _mergeSprouts(cardState, playerKey, spawned);

        if (afterDec === 0) {
            destroyed.push({ row, col });
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                deps.BoardOps.destroyAt(cardState, gameState, row, col, 'BREEDING', 'anchor_expired');
            } else {
                gameState.board[row][col] = EMPTY;
            }
            if (anchor.data) anchor.data.remainingOwnerTurns = -1;
            _clearFrontier(cardState, anchor.id);
            if (cardState.markers) {
                cardState.markers = cardState.markers.filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'BREEDING' && m.row === row && m.col === col && m.owner === playerKey));
            }
        }

        return { spawned, destroyed, flipped, anchors };
    }

    function processBreedingEffects(cardState, gameState, playerKey, prng, deps = {}) {
        const spawned = [];
        const destroyed = [];
        const flipped = [];
        const anchors = [];
        _ensureBreedingRuntime(cardState);
        _replaceSprouts(cardState, playerKey, []);

        const anchorsForOwner = (cardState.markers || []).filter(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'BREEDING' && s.owner === playerKey
        );
        for (const anchor of anchorsForOwner) {
            const one = _processTurnStartAnchor(cardState, gameState, playerKey, anchor.row, anchor.col, prng, deps);
            if (one.spawned && one.spawned.length) spawned.push(...one.spawned);
            if (one.destroyed && one.destroyed.length) destroyed.push(...one.destroyed);
            if (one.flipped && one.flipped.length) flipped.push(...one.flipped);
            if (one.anchors && one.anchors.length) anchors.push(...one.anchors);
        }

        return { spawned, destroyed, flipped, anchors };
    }

    function processBreedingEffectsAtAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const player = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const spawned = [];
        const destroyed = [];
        const flipped = [];
        _ensureBreedingRuntime(cardState);

        const anchor = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'BREEDING' && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!anchor) return { spawned, destroyed, flipped };
        if (gameState.board[row][col] !== player) return { spawned, destroyed, flipped };

        const targets = _collectEmptyNeighborTargets(gameState, [{ row, col }]);
        const picked = _pickRandomTarget(targets, prng);
        const batch = _spawnAndFlipBatch(
            cardState,
            gameState,
            playerKey,
            player,
            picked ? [picked] : [],
            'BREEDING',
            'breeding_spawn_immediate',
            { row, col },
            deps
        );
        spawned.push(...batch.spawned);
        flipped.push(...batch.flipped);
        _setFrontier(cardState, anchor.id, spawned);
        _mergeSprouts(cardState, playerKey, spawned);

        return { spawned, destroyed, flipped };
    }

    function processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        return _processTurnStartAnchor(cardState, gameState, playerKey, row, col, prng, deps);
    }

    return {
        processBreedingEffects,
        processBreedingEffectsAtAnchor,
        processBreedingEffectsAtTurnStartAnchor
    };
}));
