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

    const { CARD_DEFS, CARD_TYPE_BY_ID, BLACK, WHITE, EMPTY, DIRECTIONS } = SharedConstants || {};

    if (!CARD_DEFS) {
        throw new Error('SharedConstants not loaded');
    }

    // Constants
    // Policy: no initial draw at game start.
    const INITIAL_HAND_SIZE = 0;
    const MAX_HAND_SIZE = 5;
    const DRAW_INTERVAL = 1; // Draw every turn (turn 1, 2, 3, ...)
    const DOUBLE_PLACE_EXTRA = 1;
    const HEAVEN_BLESSING_OFFER_COUNT = 5;
    const TIME_BOMB_TURNS = 3;
    const ULTIMATE_DRAGON_TURNS = 5;
    const ULTIMATE_DESTROY_GOD_TURNS = 3;
    const DECK_SIZE = 30;

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

    /**
     * Create initial card state
     * @param {Object} [prng] - PRNG object (optional)
     * @returns {Object} cardState
     */
    function createCardState(prng) {
        const p = prng || defaultPrng;

        // Generate deck (30 cards)
        // Spec: guarantee at least one card per type, then allow duplicates to fill to DECK_SIZE.
        const enabledDefs = CARD_DEFS.filter(c => c.enabled !== false);
        const idsByType = new Map();
        for (const def of enabledDefs) {
            if (!idsByType.has(def.type)) idsByType.set(def.type, []);
            idsByType.get(def.type).push(def.id);
        }

        const guaranteed = [];
        for (const [type, ids] of idsByType.entries()) {
            const pool = ids.slice();
            p.shuffle(pool);
            guaranteed.push(pool[0]);
        }

        const deck = guaranteed.slice();
        const allIds = enabledDefs.map(d => d.id);
        while (deck.length < DECK_SIZE && allIds.length > 0) {
            const pool = allIds.slice();
            p.shuffle(pool);
            deck.push(pool[0]);
        }
        // Shuffle final deck so draw order isn't fixed by catalog/type iteration order.
        p.shuffle(deck);

        return {
            deck: deck,
            discard: [],
            initialDeckSize: deck.length,
            reshuffleRequiresFullCycle: false,
            hands: { black: [], white: [] },
            turnIndex: 0,
            lastTurnStartedFor: null,
            turnCountByPlayer: { black: 0, white: 0 },

            // Card usage state
            selectedCardId: null,
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
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
            hyperactiveSeqCounter: 0,

            // Recent usage
            lastUsedCardByPlayer: { black: null, white: null },
            cardUseCountByPlayer: { black: 0, white: 0 },

            // Resources
            charge: { black: 0, white: 0 },
            chargeGainedTotal: { black: 0, white: 0 },

            // Extra actions
            extraPlaceRemainingByPlayer: { black: 0, white: 0 },

            // Work Will state
            workAnchorPosByPlayer: { black: null, white: null },
            workNextPlacementArmedByPlayer: { black: false, white: false }
        };
    }

    /**
     * Deep copy card state
     * @param {Object} cs - Original card state
     * @returns {Object} Copied card state
     */
    function copyCardState(cs) {
        return {
            deck: cs.deck.slice(),
            discard: cs.discard.slice(),
            hands: {
                black: cs.hands.black.slice(),
                white: cs.hands.white.slice()
            },
            turnIndex: cs.turnIndex,
            lastTurnStartedFor: cs.lastTurnStartedFor,
            turnCountByPlayer: { ...cs.turnCountByPlayer },

            selectedCardId: cs.selectedCardId,
            hasUsedCardThisTurnByPlayer: { ...cs.hasUsedCardThisTurnByPlayer },
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
            hyperactiveSeqCounter: cs.hyperactiveSeqCounter || 0,

            lastUsedCardByPlayer: { ...cs.lastUsedCardByPlayer },
            cardUseCountByPlayer: { ...(cs.cardUseCountByPlayer || { black: 0, white: 0 }) },
            charge: { ...cs.charge },
            chargeGainedTotal: { ...(cs.chargeGainedTotal || { black: 0, white: 0 }) },
            extraPlaceRemainingByPlayer: { ...cs.extraPlaceRemainingByPlayer },
            initialDeckSize: Number.isFinite(cs.initialDeckSize) ? cs.initialDeckSize : ((cs.deck ? cs.deck.length : 0) + (cs.discard ? cs.discard.length : 0)),
            reshuffleRequiresFullCycle: cs.reshuffleRequiresFullCycle !== false
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

        // Check if hand is at max capacity
        if (cardState.hands[playerKey].length >= MAX_HAND_SIZE) {
            return null; // Hand full, cannot draw
        }

        // No reshuffle policy: if deck is empty, draw fails.
        if (cardState.deck.length === 0) {
            return null;
        }

        if (cardState.deck.length > 0) {
            const cardId = cardState.deck.pop();
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
        return cardState.charge[playerKey] >= cost;
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
                if (type === 'TEMPT_WILL') {
                    const targets = getTemptWillTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'TRAP_WILL') {
                    const targets = getTrapTargets(cardState, gameState, playerKey);
                    if (!targets || targets.length === 0) continue;
                }
                if (type === 'GUARD_WILL') {
                    const targets = getGuardTargets(cardState, gameState, playerKey);
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
                    if (type === 'SACRIFICE_WILL' && typeof CardSelectorsModule.getSacrificeTargets === 'function') {
                        const targets = CardSelectorsModule.getSacrificeTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'SWAP_WITH_ENEMY' && typeof CardSelectorsModule.getSwapTargets === 'function') {
                        const targets = CardSelectorsModule.getSwapTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'INHERIT_WILL' && typeof CardSelectorsModule.getInheritTargets === 'function') {
                        const targets = CardSelectorsModule.getInheritTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'TRAP_WILL' && typeof CardSelectorsModule.getTrapTargets === 'function') {
                        const targets = CardSelectorsModule.getTrapTargets(cardState, gameState, playerKey);
                        if (!targets || targets.length === 0) continue;
                    }
                    if (type === 'GUARD_WILL' && typeof CardSelectorsModule.getGuardTargets === 'function') {
                        const targets = CardSelectorsModule.getGuardTargets(cardState, gameState, playerKey);
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

    function buildHeavenBlessingOffers(cardIdToExclude) {
        const pool = (CARD_DEFS || [])
            .filter(c => c && c.enabled !== false && c.id && c.id !== cardIdToExclude)
            .map(c => c.id);
        if (pool.length === 0) return [];

        const out = [];
        while (pool.length > 0 && out.length < HEAVEN_BLESSING_OFFER_COUNT) {
            const idx = Math.floor(Math.random() * pool.length);
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
        if (cardType === 'SELL_CARD_WILL') {
            const remainingHandCount = (cardState.hands[handKey] ? cardState.hands[handKey].length : 0) - 1;
            if (remainingHandCount <= 0) return false;
        }
        const heavenOffers = (cardType === 'HEAVEN_BLESSING') ? buildHeavenBlessingOffers(cardId) : null;
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
        if (cardType === 'GUARD_WILL') {
            if (!gameState) return false;
            const targets = getGuardTargets(cardState, gameState, chargeOwnerKey);
            if (!targets.length) return false;
        }

        if (!(opts && opts.noConsume)) {
            // Remove from hand
            cardState.hands[handKey].splice(idx, 1);
            // Add to discard
            cardState.discard.push(cardId);
            // Consume charge
            cardState.charge[chargeOwnerKey] -= cost;
            // Set used flag
            cardState.hasUsedCardThisTurnByPlayer[chargeOwnerKey] = true;
            cardState.cardUseCountByPlayer = cardState.cardUseCountByPlayer || { black: 0, white: 0 };
            cardState.cardUseCountByPlayer[chargeOwnerKey] = (cardState.cardUseCountByPlayer[chargeOwnerKey] || 0) + 1;
        }
        cardState.lastUsedCardByPlayer[chargeOwnerKey] = cardId;

        const needsSelection =
            cardType === 'DESTROY_ONE_STONE' ||
            cardType === 'STRONG_WIND_WILL' ||
            cardType === 'SACRIFICE_WILL' ||
            cardType === 'SELL_CARD_WILL' ||
            cardType === 'HEAVEN_BLESSING' ||
            cardType === 'CONDEMN_WILL' ||
            cardType === 'SWAP_WITH_ENEMY' ||
            cardType === 'INHERIT_WILL' ||
            cardType === 'TRAP_WILL' ||
            cardType === 'TEMPT_WILL' ||
            cardType === 'GUARD_WILL';
        cardState.pendingEffectByPlayer[chargeOwnerKey] = {
            type: cardType,
            cardId,
            stage: needsSelection ? 'selectTarget' : null,
            offers: heavenOffers || condemnOffers || undefined,
            selectedCount: cardType === 'SACRIFICE_WILL' ? 0 : undefined,
            maxSelections: cardType === 'SACRIFICE_WILL' ? 3 : undefined
        };

        // Special handling for WORK_WILL: arm next placement for this player
        if (cardType === 'WORK_WILL') {
            if (!cardState.workNextPlacementArmedByPlayer) cardState.workNextPlacementArmedByPlayer = { black: false, white: false };
            cardState.workNextPlacementArmedByPlayer[chargeOwnerKey] = true;
            try { console.log('[WORK_DEBUG] Card played: WORK_WILL armed for', chargeOwnerKey); } catch (e) {}
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
        if (pending.type !== 'DESTROY_ONE_STONE' && pending.type !== 'INHERIT_WILL' && pending.type !== 'SACRIFICE_WILL') {
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
            cardState.charge[playerKey] = (cardState.charge[playerKey] || 0) + cost;
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
                cardState.charge[victimKey] = 0;
                const gainedCharge = addChargeWithTotal(cardState, ownerKey, victimCharge);

                const victimHand = Array.isArray(cardState.hands[victimKey]) ? cardState.hands[victimKey] : [];
                const stolenCount = Math.min(3, victimHand.length);
                const stolenCards = victimHand.splice(0, stolenCount);

                const ownerHand = Array.isArray(cardState.hands[ownerKey]) ? cardState.hands[ownerKey] : [];
                const handSpace = Math.max(0, MAX_HAND_SIZE - ownerHand.length);
                const toHand = stolenCards.slice(0, handSpace);
                const toDeck = stolenCards.slice(handSpace);
                if (toHand.length > 0) ownerHand.push(...toHand);
                if (toDeck.length > 0) {
                    if (!Array.isArray(cardState.deck)) cardState.deck = [];
                    cardState.deck.push(...toDeck);
                }

                removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'TRAP', owner: ownerKey });
                res.triggered.push({
                    row,
                    col,
                    owner: ownerKey,
                    victim: victimKey,
                    stolenCharge: victimCharge,
                    gainedCharge,
                    stolenHandCount: stolenCount,
                    toHandCount: toHand.length,
                    toDeckCount: toDeck.length
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
            emitPresentationEvent(cardState, { type: 'WORK_REMOVED', row, col, ownerBefore: opponentKey, ownerAfter: playerKey, cause: 'TEMPT_WILL', removed: true, meta: {} });
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true };
    }

    function applyGuardWill(cardState, gameState, playerKey, row, col) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'GUARD_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        const targets = getGuardTargets(cardState, gameState, playerKey);
        const allowed = targets.some(t => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        removeMarkersAt(cardState, row, col, {
            kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
            type: 'GUARD',
            owner: playerKey
        });
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'GUARD',
            remainingOwnerTurns: 3
        });
        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col };
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
                    (r > 0 && gameState.board[r - 1][c] === EMPTY) ||
                    (r < 7 && gameState.board[r + 1][c] === EMPTY) ||
                    (c > 0 && gameState.board[r][c - 1] === EMPTY) ||
                    (c < 7 && gameState.board[r][c + 1] === EMPTY);
                if (hasMove) res.push({ row: r, col: c });
            }
        }
        return res;
    }

    function _getStrongWindMoveOptions(gameState, row, col) {
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

            let tr = nr;
            let tc = nc;
            while (true) {
                const rr = tr + d.dr;
                const cc = tc + d.dc;
                if (rr < 0 || rr >= 8 || cc < 0 || cc >= 8) break;
                if (gameState.board[rr][cc] !== EMPTY) break;
                tr = rr;
                tc = cc;
            }
            options.push({ direction: d, target: { row: tr, col: tc } });
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

    function applyStrongWindWill(cardState, gameState, playerKey, row, col, prng) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'STRONG_WIND_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return { applied: false, reason: 'out_of_board' };
        if (gameState.board[row][col] === EMPTY) return { applied: false, reason: 'empty' };

        const options = _getStrongWindMoveOptions(gameState, row, col);
        if (!options.length) return { applied: false, reason: 'no_move_options' };

        const p = (prng && typeof prng.random === 'function') ? prng : { random: Math.random };
        const pick = options[Math.floor(p.random() * options.length)];
        const to = pick.target;

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
        return { applied: true, from: { row, col }, to, direction: pick.direction };
    }

    /**
     * Turn start processing
     * @param {Object} cardState
     * @param {string} playerKey
     * @param {Object} [prng]
     */
    function onTurnStart(cardState, playerKey, gameState, prng) {
        const p = prng || defaultPrng;

        cardState.turnCountByPlayer[playerKey]++;
        cardState.turnIndex++;
        cardState.lastTurnStartedFor = playerKey;

        // Reset usage flag
        cardState.hasUsedCardThisTurnByPlayer[playerKey] = false;

        // Reset extra place counters (valid only for the turn they are granted)
        cardState.extraPlaceRemainingByPlayer[playerKey] = 0;

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
                if (res.gained && res.gained > 0) {
                    emitPresentationEvent(cardState, { type: 'WORK_INCOME', player: playerKey, gained: res.gained, removed: !!res.removed, meta: {} });
                } else if (res.removed) {
                    emitPresentationEvent(cardState, { type: 'WORK_REMOVED', player: playerKey, removed: true, meta: {} });
                }
            } catch (e) {
                // swallow to avoid breaking turn start in environments without module
            }
        }
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

        const before = cardState.charge[playerKey] || 0;
        const after = Math.min(30, before + amount);
        const added = after - before;

        cardState.charge[playerKey] = after;
        if (added > 0) {
            cardState.chargeGainedTotal[playerKey] = (cardState.chargeGainedTotal[playerKey] || 0) + added;
        }

        return added;
    }

    function applyPlacementEffects(cardState, gameState, playerKey, row, col, flipCount) {
        const effects = { chargeGained: 0 };
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (pending && pending.type === 'FREE_PLACEMENT') {
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
                cardState.charge[opponentKey] -= stolen;
                chargeGain += stolen;
                effects.plunderAmount = stolen;
            }
        }

        // STEAL_CARD logic - delegate to effect module
        if (pending && pending.type === 'STEAL_CARD') {
            let stealEffect;
            if (typeof module === 'object' && module.exports) {
                try { stealEffect = require('./effects/steal_card').applyStealCard; } catch (e) { /* fallback below */ }
            }
            if (typeof stealEffect === 'function') {
                const res = stealEffect(cardState, playerKey, flipCount);
                if (res.stolenCount > 0) {
                    effects.stolenCount = res.stolenCount;
                    effects.stolenCards = res.stolenCards;
                }
            } else {
                const totalSteal = Math.min(
                    flipCount,
                    cardState.hands[opponentKey].length
                );

                if (totalSteal > 0) {
                    const stolenCards = cardState.hands[opponentKey].splice(0, totalSteal);
                    const handSpace = Math.max(0, MAX_HAND_SIZE - cardState.hands[playerKey].length);
                    const toHand = stolenCards.slice(0, handSpace);
                    const toDeck = stolenCards.slice(handSpace);

                    if (toHand.length > 0) {
                        cardState.hands[playerKey].push(...toHand);
                    }
                    if (toDeck.length > 0) {
                        cardState.deck.push(...toDeck);
                    }

                    effects.stolenCards = toHand;
                    effects.stolenCount = totalSteal;
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
            console.log('[WORK_DEBUG] workNextPlacementArmedByPlayer state:', cardState.workNextPlacementArmedByPlayer, 'playerKey:', playerKey, 'row:', row, 'col:', col);
            if (cardState.workNextPlacementArmedByPlayer && cardState.workNextPlacementArmedByPlayer[playerKey]) {
                let workMod;
                if (typeof require === 'function') {
                    try { workMod = require('./cards/work_will'); } catch (e) { /* optional */ }
                } else if (typeof globalThis !== 'undefined' && globalThis.CardWork) {
                    workMod = globalThis.CardWork;
                }
                try {
                    if (workMod && typeof workMod.placeWorkStone === 'function') {
                        console.log('[WORK_DEBUG] Calling placeWorkStone for', playerKey, row, col);
                        workMod.placeWorkStone(cardState, gameState, playerKey, row, col, { addMarker });
                        effects.workPlaced = true;
                        try { if (typeof globalThis !== 'undefined') globalThis._lastWorkPlaced = { playerKey, row, col }; else if (typeof global !== 'undefined') global._lastWorkPlaced = { playerKey, row, col }; } catch (e) {}
                    } else {
                        console.log('[WORK_DEBUG] workMod.placeWorkStone not available, workMod:', !!workMod);
                    }
                } catch (e) {
                    console.error('[WORK_DEBUG] placeWorkStone threw', e && e.message ? e.message : e);
                }
                cardState.workNextPlacementArmedByPlayer[playerKey] = false;
            }
        } catch (e) { /* defensive */ }


        // TIME_BOMB logic - delegate to cards module when present
        if (pending && pending.type === 'TIME_BOMB') {
            let bombEffect;
            if (typeof require === 'function') {
                try {
                    bombEffect = require('./cards/time_bomb').applyTimeBomb;
                } catch (e) {
                    try { bombEffect = require('./effects/time_bomb').applyTimeBomb; } catch (ee) { }
                }
            }
            if (typeof bombEffect === 'function') {
                const res = bombEffect(cardState, playerKey, row, col, { addMarker });
                if (res.placed) effects.bombPlaced = true;
            } else {
                addMarker(cardState, 'bomb', row, col, playerKey, {
                    remainingTurns: TIME_BOMB_TURNS,
                    placedTurn: cardState.turnIndex
                });
                effects.bombPlaced = true;
            }
        }

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

        // HYPERACTIVE_WILL logic - hyperactive stone marker
        if (pending && pending.type === 'HYPERACTIVE_WILL') {
            cardState.hyperactiveSeqCounter = (cardState.hyperactiveSeqCounter || 0) + 1;
            addMarker(cardState, 'specialStone', row, col, playerKey, {
                type: 'HYPERACTIVE',
                hyperactiveSeq: cardState.hyperactiveSeqCounter
            });
            effects.hyperactivePlaced = true;
        }

        // CROSS_BOMB logic - trigger immediate cross explosion after normal flips.
        // Destroy center + orthogonal 1-tile neighbors regardless of owner/special/protection.
        if (pending && pending.type === 'CROSS_BOMB') {
            const targets = [
                { row, col },
                { row: row - 1, col },
                { row: row + 1, col },
                { row, col: col - 1 },
                { row, col: col + 1 }
            ].filter(pos => pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8);

            let destroyedCount = 0;
            for (const pos of targets) {
                if (BoardOpsModule && typeof BoardOpsModule.destroyAt === 'function') {
                    const res = BoardOpsModule.destroyAt(
                        cardState,
                        gameState,
                        pos.row,
                        pos.col,
                        'CROSS_BOMB',
                        'cross_bomb_explosion'
                    );
                    if (res && res.destroyed) destroyedCount++;
                } else if (gameState.board[pos.row][pos.col] !== EMPTY) {
                    removeMarkersAt(cardState, pos.row, pos.col);
                    gameState.board[pos.row][pos.col] = EMPTY;
                    destroyedCount++;
                }
            }
            effects.crossBombExploded = true;
            effects.crossBombDestroyed = destroyedCount;
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

        // Clear pending after placement unless it's CHAIN_WILL (turn-scoped)
        if (!(pending && pending.type === 'CHAIN_WILL')) {
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
     * Apply INHERIT_WILL (意志の継承)
     * @param {Object} cardState
     * @param {Object} gameState
     * @param {string} playerKey
     * @param {number} row
     * @param {number} col
     * @returns {Object} { applied:boolean, reason?:string }
     */
    function applyInheritWill(cardState, gameState, playerKey, row, col) {
        if (!isNormalStoneForPlayer(cardState, gameState, playerKey, row, col)) {
            return { applied: false, reason: '通常石のみ選択できます' };
        }

        applyStrongWill(cardState, playerKey, row, col);
        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true };
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
        if (opponentHand[targetIndex] !== offer.cardId) {
            return { applied: false, reason: 'target_mismatch' };
        }

        const destroyedCardId = opponentHand[targetIndex];
        opponentHand.splice(targetIndex, 1);
        cardState.discard.push(destroyedCardId);
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


    function applyChainWillAfterMove(cardState, gameState, playerKey, primaryFlips, prng) {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'CHAIN_WILL') {
            return { applied: false, flips: [], chosen: null };
        }

        const ownerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const context = getCardContext(cardState);
        const p = prng || defaultPrng;

        // Delegate to chain module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/chain');
            const res = mod.findChainChoice(gameState, primaryFlips, ownerVal, context, p);
            if (!res.applied) return res;
            for (const pos of res.flips) {
                if (BoardOpsModule && typeof BoardOpsModule.changeAt === 'function') {
                    BoardOpsModule.changeAt(cardState, gameState, pos.row, pos.col, playerKey, 'CHAIN_WILL', 'chain_flip');
                } else {
                    gameState.board[pos.row][pos.col] = ownerVal;
                }
                clearBombAt(cardState, pos.row, pos.col);
            }
            clearHyperactiveAtPositions(cardState, res.flips);
            return { applied: true, flips: res.flips, chosen: res.chosen };
        }
        // Browser: use global
        if (typeof CardChain !== 'undefined' && typeof CardChain.findChainChoice === 'function') {
            const res = CardChain.findChainChoice(gameState, primaryFlips, ownerVal, context, p);
            if (!res.applied) return res;
            for (const pos of res.flips) {
                if (BoardOpsModule && typeof BoardOpsModule.changeAt === 'function') {
                    BoardOpsModule.changeAt(cardState, gameState, pos.row, pos.col, playerKey, 'CHAIN_WILL', 'chain_flip');
                } else {
                    gameState.board[pos.row][pos.col] = ownerVal;
                }
                clearBombAt(cardState, pos.row, pos.col);
            }
            clearHyperactiveAtPositions(cardState, res.flips);
            return { applied: true, flips: res.flips, chosen: res.chosen };
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
        // Delegate to effects module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./effects/dragon');
            return mod.processDragonEffects(cardState, gameState, playerKey, { BoardOps: BoardOpsModule });
        }
        // Browser: use global
        if (typeof DragonEffects !== 'undefined' && typeof DragonEffects.processDragonEffects === 'function') {
            return DragonEffects.processDragonEffects(cardState, gameState, playerKey, { BoardOps: BoardOpsModule });
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
        // Delegate to effects module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./effects/dragon');
            return mod.processDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, { BoardOps: BoardOpsModule });
        }
        // Browser: use global
        if (typeof DragonEffects !== 'undefined' && typeof DragonEffects.processDragonEffectsAtAnchor === 'function') {
            return DragonEffects.processDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, { BoardOps: BoardOpsModule });
        }
        // Fallback: no-op
        console.warn('[cards.js] DragonEffects module not available');
        return { converted: [], destroyed: [] };
    }

    function processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col) {
        if (typeof module === 'object' && module.exports) {
            try {
                const mod = require('./effects/dragon');
                if (mod && typeof mod.processDragonEffectsAtTurnStartAnchor === 'function') {
                    return mod.processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, { BoardOps: BoardOpsModule });
                }
            } catch (e) { /* ignore */ }
        }
        if (typeof DragonEffects !== 'undefined' && typeof DragonEffects.processDragonEffectsAtTurnStartAnchor === 'function') {
            return DragonEffects.processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, { BoardOps: BoardOpsModule });
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
            if (!m.data || m.data.type !== 'HYPERACTIVE') return true;
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
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardHyperactive module not available');
        return { moved: [], destroyed: [], flipped: [], flippedByOwner: { black: [], white: [] } };
    }


    function processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng) {
        // Delegate to module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./cards/hyperactive');
            return mod.processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        // Browser: use global
        if (typeof CardHyperactive !== 'undefined' && typeof CardHyperactive.processHyperactiveMoveAtAnchor === 'function') {
            return CardHyperactive.processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, {
                defaultPrng: defaultPrng,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                getCardContext,
                BoardOps: BoardOpsModule,
                destroyAt
            });
        }
        console.warn('[cards.js] CardHyperactive module not available');
        return { moved: [], destroyed: [], flipped: [] };
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
        // Delegate to effect module
        if (typeof module === 'object' && module.exports) {
            const mod = require('./effects/swap_with_enemy');
            const r = mod.applySwapWithEnemy(cardState, gameState, playerKey, row, col, { BoardOps: BoardOpsModule, clearHyperactiveAtPositions });
            return !!r.swapped;
        }
        // Browser: use global
        if (typeof SwapWithEnemy !== 'undefined' && typeof SwapWithEnemy.applySwapWithEnemy === 'function') {
            const r = SwapWithEnemy.applySwapWithEnemy(cardState, gameState, playerKey, row, col, { BoardOps: BoardOpsModule, clearHyperactiveAtPositions });
            return !!r.swapped;
        }
        console.warn('[cards.js] SwapWithEnemy module not available');
        return false;
    }


    /**
     * Get context for core logic
     * @param {Object} cardState
     * @returns {Object} { protectedStones, permaProtectedStones, bombs }
     */
    function getCardContext(cardState) {
        const specials = getSpecialMarkers(cardState);
        const protectedStones = specials
            .filter(s => s.data && s.data.type === 'PROTECTED')
            .map(s => ({ row: s.row, col: s.col, owner: s.owner }));

        // PERMA_PROTECTED, DRAGON, BREEDING, UDG, and GUARD stones are immune to flipping
        const permaProtectedStones = specials
            .filter(s => s.data && (
                s.data.type === 'PERMA_PROTECTED' ||
                s.data.type === 'DRAGON' ||
                s.data.type === 'BREEDING' ||
                s.data.type === 'ULTIMATE_DESTROY_GOD' ||
                s.data.type === 'GUARD'
            ))
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

        return {
            protectedStones,
            permaProtectedStones,
            bombs
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
                    if (pending.type === 'SACRIFICE_WILL' && typeof mod.getSacrificeTargets === 'function') {
                        return mod.getSacrificeTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'SWAP_WITH_ENEMY' && typeof mod.getSwapTargets === 'function') {
                        return mod.getSwapTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'INHERIT_WILL' && typeof mod.getInheritTargets === 'function') {
                        return mod.getInheritTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'TRAP_WILL' && typeof mod.getTrapTargets === 'function') {
                        return mod.getTrapTargets(cardState, gameState, playerKey);
                    }
                    if (pending.type === 'GUARD_WILL' && typeof mod.getGuardTargets === 'function') {
                        return mod.getGuardTargets(cardState, gameState, playerKey);
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

        if (pending.type === 'SWAP_WITH_ENEMY') {
            const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];

            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (gameState.board[r][c] !== opponentVal) continue;
                    const hasSpecialOrBomb = markers.some(m => (m.row === r && m.col === c) && (m.kind === 'specialStone' || m.kind === 'bomb'));
                    if (hasSpecialOrBomb) continue;
                    res.push({ row: r, col: c });
                }
            }
            return res;
        }

        if (pending.type === 'INHERIT_WILL') {
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (isNormalStoneForPlayer(cardState, gameState, playerKey, r, c)) {
                        res.push({ row: r, col: c });
                    }
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

        if (pending.type === 'GUARD_WILL') {
            return getGuardTargets(cardState, gameState, playerKey);
        }

        return res;
    }

    return {
        // Constants
        INITIAL_HAND_SIZE,
        TIME_BOMB_TURNS,
        ULTIMATE_DRAGON_TURNS,
        ULTIMATE_DESTROY_GOD_TURNS,

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
        getUsableCardIds,
        hasUsableCard,
        applyCardUsage,
        destroyAt,
        clearBombAt,
        processBreedingEffects,
        processUltimateDestroyGodEffects,
        processUltimateDestroyGodEffectsAtAnchor,

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
        applyStrongWill,
        applyInheritWill,
        applySacrificeWill,
        applySellCardWill,
        applyHeavenBlessingChoice,
        applyCondemnWill,
        applyTemptWill,
        applyGuardWill,
        applyStrongWindWill,
        applyRegenWill,
        applyRegenAfterFlips,
        applyChainWillAfterMove,
        processBreedingEffectsAtTurnStartAnchor,
        processBreedingEffectsAtAnchor,
        processUltimateDestroyGodEffectsAtTurnStartAnchor,
        processUltimateDestroyGodEffectsAtAnchor,

        // Helpers
        getCardContext,
        hasPendingEffect,
        getPendingEffectType,
        getSelectableTargets,
        getStrongWindTargets,
        cancelPendingSelection,
        getTemptWillTargets,
        getGuardTargets,
        getTrapTargets,
        applyTrapWill,
        processTrapEffects,
        clearHyperactiveAtPositions,
        processHyperactiveMoves,
        processHyperactiveMoveAtAnchor,
        // Presentation helpers (PoC)
        allocateStoneId,
        emitPresentationEvent,
        flushPresentationEvents
    };
}));
