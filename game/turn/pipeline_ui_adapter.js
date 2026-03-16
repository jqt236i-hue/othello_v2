/**
 * @file pipeline_ui_adapter.js
 * @description Bridge TurnPipeline event log -> browser UI via Canonical Playback Events.
 * aligns with 03-visual-rulebook.v2.txt.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TurnPipelineUIAdapter = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('../logic/markers_adapter');
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
    const OwnerHelpersModule = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../utils/owner-helpers');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.OwnerHelpers || null;
    })();
    const SharedBoardUtils = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../shared/shared-board-utils');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.SharedBoardUtils || null;
    })();

    const REGEN_CAUSE = 'REGEN';
    const REGEN_TRIGGER_REASON = 'regen_triggered';
    const REGEN_CONSUMED_REASON = 'regen_consumed';
    const BATCH_DESTROY_CAUSES = new Set(['TIME_BOMB', 'ULTIMATE_DESTROY_GOD', 'CROSS_BOMB', 'X_BOMB', 'ESCAPE_HYPERACTIVE']);
    const BOMB_DESTROY_CAUSES = new Set(['TIME_BOMB', 'CROSS_BOMB', 'X_BOMB', 'ESCAPE_HYPERACTIVE']);
    const SUPER_CRUSH_CAUSES = new Set(['SUPER_BUOYANCY_WILL', 'SUPER_GRAVITY_WILL']);
    const SPECIAL_DURATION_EXPIRE_CAUSES = new Set([
        'SNIPER_WILL',
        'LIGHTNING_WILL',
        'DESTROY_DRAGON',
        'DRAGON',
        'BREEDING',
        'ROBOT_VACUUM',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_HYPERACTIVE_GOD',
        'TRAP_WILL'
    ]);
    const SOUND_EVENT_TYPE = 'sound_effect';
    const GENERATED_THROW_CHAIN_REASON = 'generated_throw_chain';
    const WORK_LOST_BUBBLE_TEXT = 'あああああああああああああ';
    const WORK_INCOME_BUBBLE_TEXT_BY_STEP = Object.freeze({
        1: '布石＋1 初儲けや！',
        2: '布石＋2 もっと掘るでー！',
        3: '布石＋4 順調やな！',
        4: '布石＋8 ぼろ儲けや！',
        5: '布石＋16 これで家族が養える...！'
    });
    const deferredGeneratedThrowChainPlaybackByPlayer = {
        black: [],
        white: []
    };

    function _clearDeferredGeneratedThrowChainPlaybackForPlayer(ownerKey) {
        if (ownerKey !== 'black' && ownerKey !== 'white') return;
        deferredGeneratedThrowChainPlaybackByPlayer[ownerKey] = [];
    }

    function clearDeferredGeneratedThrowChainPlayback(playerKey) {
        const ownerKey = _normalizePlayerKey(playerKey);
        if (ownerKey) {
            _clearDeferredGeneratedThrowChainPlaybackForPlayer(ownerKey);
            return;
        }
        _clearDeferredGeneratedThrowChainPlaybackForPlayer('black');
        _clearDeferredGeneratedThrowChainPlaybackForPlayer('white');
    }

    function _inferWorkIncomeStepByGain(gained) {
        const g = Number(gained) || 0;
        if (g >= 16) return 5;
        if (g >= 8) return 4;
        if (g >= 4) return 3;
        if (g >= 2) return 2;
        if (g >= 1) return 1;
        return null;
    }

    function _resolveWorkIncomeBubbleText(ev) {
        const directText = String(ev && ev.text ? ev.text : '').trim();
        if (directText) return directText;
        const metaText = String(ev && ev.meta && ev.meta.text ? ev.meta.text : '').trim();
        if (metaText) return metaText;

        const rawStep = Number.isFinite(Number(ev && ev.incomeStep))
            ? Number(ev.incomeStep)
            : (Number.isFinite(Number(ev && ev.meta && ev.meta.incomeStep))
                ? Number(ev.meta.incomeStep)
                : _inferWorkIncomeStepByGain(ev && ev.gained));
        const step = Number.isFinite(rawStep) ? Math.max(1, Math.min(5, Math.trunc(rawStep))) : null;
        if (step && WORK_INCOME_BUBBLE_TEXT_BY_STEP[step]) return WORK_INCOME_BUBBLE_TEXT_BY_STEP[step];

        return WORK_INCOME_BUBBLE_TEXT_BY_STEP[1];
    }

    function _resolveWorkRemovedBubbleText(ev) {
        const directText = String(ev && ev.text ? ev.text : '').trim();
        if (directText) return directText;
        const metaText = String(ev && ev.meta && ev.meta.text ? ev.meta.text : '').trim();
        if (metaText) return metaText;
        return WORK_LOST_BUBBLE_TEXT;
    }

    function _formatCrystalStonePlacementLog(effects) {
        const gain = Number.isFinite(Number(effects && effects.crystalStoneGain))
            ? Math.max(0, Number(effects.crystalStoneGain))
            : 0;
        return gain > 0
            ? '水晶石: 数字マス布石+' + gain + '（4倍）'
            : '水晶石: 数字マスなしで増加なし';
    }

    function isRegenTriggeredChange(ev) {
        return !!(ev && ev.cause === REGEN_CAUSE && ev.reason === REGEN_TRIGGER_REASON);
    }

    function isRegenConsumedStatus(ev) {
        return !!(ev && ev.meta && ev.meta.special === REGEN_CAUSE && ev.meta.reason === REGEN_CONSUMED_REASON);
    }

    function isChainFlipPresentationEvent(ev) {
        if (!ev) return false;
        const reason = String(ev.reason || '').toLowerCase();
        const cause = String(ev.cause || '').toUpperCase();
        return reason === 'chain_flip' || cause === 'CHAIN_WILL';
    }

    function getChainFlipLink(ev) {
        if (!ev || !ev.meta || !Number.isFinite(ev.meta.chainLink)) return 1;
        const link = Number(ev.meta.chainLink);
        return link >= 1 ? link : 1;
    }

    function isInheritedHyperactiveType(type) {
        return String(type || '').toUpperCase() === 'INHERITED_HYPERACTIVE';
    }

    function getVisualSpecialFromMeta(meta) {
        const special = (meta && meta.special) || null;
        return isInheritedHyperactiveType(special) ? null : special;
    }

    function resolveDisplayTimerValue(special, timerValue, regenRemainingValue) {
        if (isInheritedHyperactiveType(special)) return null;
        const timer = toCounterOrNull(timerValue);
        if (timer !== null) return timer;
        if (String(special || '').toUpperCase() === 'REGEN') {
            return toCounterOrNull(regenRemainingValue);
        }
        return null;
    }

    function getPrimaryTimerFromMeta(meta) {
        const special = (meta && meta.special) || null;
        return resolveDisplayTimerValue(special, meta && meta.timer, meta && meta.regenRemaining);
    }

    function getInheritedTimerFromMeta(meta) {
        const inheritedTimer = (meta && meta.inheritedTimer) || null;
        if (inheritedTimer !== null && inheritedTimer !== undefined) return inheritedTimer;
        const special = (meta && meta.special) || null;
        return isInheritedHyperactiveType(special) ? ((meta && meta.timer) || null) : null;
    }

    function getInheritedOwnerFromMeta(meta) {
        const inheritedOwner = (meta && meta.inheritedOwner) || null;
        if (inheritedOwner !== null && inheritedOwner !== undefined) return inheritedOwner;
        const special = (meta && meta.special) || null;
        return isInheritedHyperactiveType(special) ? ((meta && meta.owner) || null) : null;
    }

    function toCounterOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return Math.max(0, Math.trunc(n));
    }

    function getFlipEvadeRemainingFromMeta(meta) {
        return toCounterOrNull(meta && meta.flipEvadeRemaining);
    }

    function getInheritedFlipEvadeRemainingFromMeta(meta) {
        const inherited = toCounterOrNull(meta && meta.inheritedFlipEvadeRemaining);
        if (inherited !== null) return inherited;
        const special = (meta && meta.special) || null;
        if (isInheritedHyperactiveType(special)) {
            return getFlipEvadeRemainingFromMeta(meta);
        }
        return null;
    }

    function getDestroyEvadeRemainingFromMeta(meta) {
        return toCounterOrNull(meta && meta.destroyEvadeRemaining);
    }

    function isMainBoardCell(r, c) {
        return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < 8 && c >= 0 && c < 8;
    }

    function getExpansionColorAt(gameState, r, c) {
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return 0;

        const cells = (Array.isArray(expansion.cells) && expansion.cells.length > 0)
            ? expansion.cells
            : (expansion.active === true ? [expansion] : []);

        for (const cell of cells) {
            if (!cell || typeof cell !== 'object') continue;
            const row = Number.isInteger(cell.row) ? cell.row : null;
            let col = Number.isInteger(cell.col) ? cell.col : null;
            if (col === null && cell.side === 'left') col = -1;
            if (col === null && cell.side === 'right') col = 8;
            if (row !== r || col !== c) continue;
            return (cell.owner === 1 || cell.owner === -1) ? cell.owner : 0;
        }

        return 0;
    }

    function getCellColorAt(gameState, r, c) {
        if (!gameState || !Array.isArray(gameState.board)) return 0;
        if (isMainBoardCell(r, c)) {
            const boardRow = gameState.board[r];
            if (!Array.isArray(boardRow)) return 0;
            const value = boardRow[c];
            return (value === 1 || value === -1) ? value : 0;
        }
        return getExpansionColorAt(gameState, r, c);
    }

    /**
     * Helper to get visual state of a cell from game/card state.
     */
    function getVisualStateAt(r, c, cardState, gameState) {
        if (!gameState || !gameState.board) return {
            color: 0,
            special: null,
            timer: null,
            owner: null,
            inheritedTimer: null,
            inheritedOwner: null,
            flipEvadeRemaining: null,
            inheritedFlipEvadeRemaining: null,
            destroyEvadeRemaining: null
        };
        const color = getCellColorAt(gameState, r, c);

        // Find special stone
        let special = null;
        let timer = null;
        let owner = null;
        let inheritedTimer = null;
        let inheritedOwner = null;
        let flipEvadeRemaining = null;
        let inheritedFlipEvadeRemaining = null;
        let destroyEvadeRemaining = null;

        if (cardState && cardState.markers) {
            const markersAtCell = cardState.markers.filter((m) => (
                m &&
                m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
                m.row === r &&
                m.col === c
            ));

            const inherited = markersAtCell.find((m) => (
                m &&
                m.data &&
                String(m.data.type || '').toUpperCase() === 'INHERITED_HYPERACTIVE'
            ));
            if (inherited) {
                inheritedTimer = (inherited.data && Number.isFinite(Number(inherited.data.remainingOwnerTurns)))
                    ? Number(inherited.data.remainingOwnerTurns)
                    : null;
                inheritedOwner = (inherited.owner !== undefined && inherited.owner !== null) ? inherited.owner : null;
                inheritedFlipEvadeRemaining = toCounterOrNull(inherited.data && inherited.data.flipEvadeRemaining);
            }

            const visualSpecial = markersAtCell.find((m) => {
                const typeUpper = String(m && m.data && m.data.type ? m.data.type : '').toUpperCase();
                if (!typeUpper) return false;
                if (typeUpper === 'GUARD') return false;
                if (typeUpper === 'INHERITED_HYPERACTIVE') return false;
                return true;
            });

            if (visualSpecial) {
                special = (visualSpecial.data && visualSpecial.data.type) || null;
                timer = resolveDisplayTimerValue(
                    special,
                    visualSpecial.data && visualSpecial.data.remainingOwnerTurns,
                    visualSpecial.data && visualSpecial.data.regenRemaining
                );
                owner = (visualSpecial.owner !== undefined && visualSpecial.owner !== null) ? visualSpecial.owner : null;
                flipEvadeRemaining = toCounterOrNull(visualSpecial.data && visualSpecial.data.flipEvadeRemaining);
                destroyEvadeRemaining = toCounterOrNull(visualSpecial.data && visualSpecial.data.destroyEvadeRemaining);
                if (flipEvadeRemaining === null && String(special || '').toUpperCase() === 'ULTIMATE_HYPERACTIVE') {
                    flipEvadeRemaining = 5;
                }
            }
        }

        // Bomb check
        if (!special && cardState && cardState.markers) {
            const b = MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function'
                ? MarkersAdapter.findBombMarkerAt(cardState, r, c)
                : cardState.markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb') && m.row === r && m.col === c);
            if (b) {
                special = 'TIME_BOMB';
                timer = (b.data && b.data.remainingTurns) || null;
                owner = (b.owner !== undefined && b.owner !== null) ? b.owner : null;
            }
        }

        return {
            color,
            special,
            timer,
            owner,
            inheritedTimer,
            inheritedOwner,
            flipEvadeRemaining,
            inheritedFlipEvadeRemaining,
            destroyEvadeRemaining
        };
    }

    /**
     * Converts presentation events (BoardOps output) into PlaybackEvents.
     * This expects events to be JSON-safe presentationEvents as emitted by BoardOps.
     */
    function mapToPlaybackEvents(presEvents, finalCardState, finalGameState) {
        const playbackEvents = [];
        let currentPhase = 1;
        let prevWasChainFlip = false;
        let prevChainFlipLink = null;
        let prevDestroyCause = null;
        let superCrushPhase = null;
        let superCrushActionId = null;
        let gluttonousEatPhase = null;
        let gluttonousEatActionId = null;
        let willHunterKingSlashPhase = null;

        for (const ev of presEvents || []) {
            const pEvent = {
                type: null,
                phase: currentPhase,
                targets: [],
                meta: ev.meta || null,
                rawType: ev.type,
                actionId: ev.actionId || null,
                turnIndex: (typeof ev.turnIndex === 'number') ? ev.turnIndex : (finalCardState && typeof finalCardState.turnIndex === 'number' ? finalCardState.turnIndex : 0),
                plyIndex: (typeof ev.plyIndex === 'number') ? ev.plyIndex : null
            };

            switch (ev.type) {
                case 'SPAWN':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    willHunterKingSlashPhase = null;
                    const spawnCause = String(ev.cause || '').toUpperCase();
                    if (
                        (spawnCause === 'CLONE_WILL' || spawnCause === 'SPLIT_WILL') &&
                        ev.meta &&
                        Number.isInteger(ev.meta.fromRow) &&
                        Number.isInteger(ev.meta.fromCol)
                    ) {
                        pEvent.type = 'move';
                        pEvent.targets = [{
                            from: { r: ev.meta.fromRow, col: ev.meta.fromCol },
                            to: { r: ev.row, col: ev.col },
                            stoneId: ev.stoneId,
                            ownerBefore: ev.ownerAfter,
                            ownerAfter: ev.ownerAfter,
                            cause: ev.cause || null,
                            reason: ev.reason || null,
                            clone: true
                        }];
                    } else {
                        pEvent.type = 'spawn';
                        pEvent.targets = [{
                            r: ev.row,
                            col: ev.col,
                            stoneId: ev.stoneId,
                            ownerAfter: ev.ownerAfter,
                            cause: ev.cause || null,
                            reason: ev.reason || null
                        }];
                    }
                    break;
                case 'DESTROY':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    pEvent.type = 'destroy';
                    const destroyMeta = (ev && ev.meta && typeof ev.meta === 'object') ? ev.meta : null;
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        stoneId: ev.stoneId,
                        ownerBefore: ev.ownerBefore,
                        cause: ev.cause || null,
                        reason: ev.reason || null,
                        meta: destroyMeta,
                        sourceRow: destroyMeta && Number.isInteger(destroyMeta.sourceRow) ? destroyMeta.sourceRow : null,
                        sourceCol: destroyMeta && Number.isInteger(destroyMeta.sourceCol) ? destroyMeta.sourceCol : null,
                        projectileOwner: destroyMeta && typeof destroyMeta.projectileOwner === 'string' ? destroyMeta.projectileOwner : null,
                        projectileStone: destroyMeta && typeof destroyMeta.projectileStone === 'string' ? destroyMeta.projectileStone : null
                    }];
                    // For area-destroy effects, keep all destroys in the same phase so UI can animate simultaneously.
                    const destroyCause = String(ev.cause || '');
                    const destroyCauseUpper = destroyCause.toUpperCase();
                    const destroyReason = String(ev.reason || '').toLowerCase();
                    const isGluttonousEatDestroy =
                        destroyCauseUpper === 'GLUTTONOUS_WILL' &&
                        destroyReason.indexOf('gluttonous_eat') === 0;
                    const isSuperCrushDestroy =
                        SUPER_CRUSH_CAUSES.has(destroyCauseUpper) &&
                        (destroyReason.indexOf('super_buoyancy_collision') === 0 || destroyReason.indexOf('super_gravity_collision') === 0);
                    const isWillHunterKingSlashDestroy =
                        destroyCauseUpper === 'WILL_HUNTER_KING' &&
                        destroyReason.indexOf('will_hunter_king_slash') === 0;
                    if (isGluttonousEatDestroy) {
                        willHunterKingSlashPhase = null;
                        superCrushPhase = null;
                        superCrushActionId = null;
                        const destroyActionId = ev.actionId || null;
                        const hasActionMismatch =
                            gluttonousEatPhase !== null &&
                            gluttonousEatActionId !== null &&
                            destroyActionId !== null &&
                            gluttonousEatActionId !== destroyActionId;
                        if (gluttonousEatPhase === null || hasActionMismatch) {
                            currentPhase++;
                            gluttonousEatPhase = currentPhase;
                        }
                        gluttonousEatActionId = destroyActionId;
                        pEvent.phase = gluttonousEatPhase;
                    } else if (isSuperCrushDestroy) {
                        willHunterKingSlashPhase = null;
                        gluttonousEatPhase = null;
                        gluttonousEatActionId = null;
                        const destroyActionId = ev.actionId || null;
                        const hasActionMismatch =
                            superCrushPhase !== null &&
                            superCrushActionId !== null &&
                            destroyActionId !== null &&
                            superCrushActionId !== destroyActionId;
                        if (superCrushPhase === null || hasActionMismatch) {
                            currentPhase++;
                            superCrushPhase = currentPhase;
                        }
                        superCrushActionId = destroyActionId;
                        pEvent.phase = superCrushPhase;
                    } else if (isWillHunterKingSlashDestroy) {
                        gluttonousEatPhase = null;
                        gluttonousEatActionId = null;
                        superCrushPhase = null;
                        superCrushActionId = null;
                        currentPhase++;
                        willHunterKingSlashPhase = currentPhase;
                        pEvent.phase = willHunterKingSlashPhase;
                    } else if (BATCH_DESTROY_CAUSES.has(destroyCauseUpper)) {
                        willHunterKingSlashPhase = null;
                        gluttonousEatPhase = null;
                        gluttonousEatActionId = null;
                        superCrushPhase = null;
                        superCrushActionId = null;
                        if (prevDestroyCause !== destroyCauseUpper) {
                            currentPhase++;
                        }
                        pEvent.phase = currentPhase;
                    } else {
                        willHunterKingSlashPhase = null;
                        gluttonousEatPhase = null;
                        gluttonousEatActionId = null;
                        superCrushPhase = null;
                        superCrushActionId = null;
                        currentPhase++;
                        pEvent.phase = currentPhase;
                    }
                    prevDestroyCause = destroyCauseUpper;
                    break;
                case 'CHANGE':
                    prevDestroyCause = null;
                    willHunterKingSlashPhase = null;
                    // Map CHANGE -> flip to match UI AnimationEngine expectations (Spec B)
                    pEvent.type = 'flip';
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        ownerBefore: ev.ownerBefore,
                        ownerAfter: ev.ownerAfter,
                        cause: ev.cause || null,
                        reason: ev.reason || null
                    }];
                    const isChainFlip = isChainFlipPresentationEvent(ev);
                    const chainFlipLink = isChainFlip ? getChainFlipLink(ev) : null;
                    if (isChainFlip && (!prevWasChainFlip || prevChainFlipLink !== chainFlipLink)) {
                        // CHAIN_WILL: primary flips -> chain link 1 -> chain link 2 ...
                        currentPhase++;
                        pEvent.phase = currentPhase;
                    }
                    if (isRegenTriggeredChange(ev)) {
                        // Keep "normal flip -> regen back" readable by separating phases.
                        // Without this, both flips can be batched together for the same cell.
                        currentPhase++;
                        pEvent.phase = currentPhase;
                    }
                    prevWasChainFlip = isChainFlip;
                    prevChainFlipLink = isChainFlip ? chainFlipLink : null;
                    break;
                case 'MOVE':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    pEvent.type = 'move';
                    pEvent.targets = [{
                        from: { r: ev.prevRow, col: ev.prevCol },
                        to: { r: ev.row, col: ev.col },
                        stoneId: ev.stoneId,
                        ownerBefore: ev.ownerBefore,
                        ownerAfter: ev.ownerAfter,
                        cause: ev.cause || null,
                        reason: ev.reason || null
                    }];
                    const moveCause = String(ev.cause || '').toUpperCase();
                    const moveReason = String(ev.reason || '').toLowerCase();
                    const isGluttonousEatMove =
                        moveCause === 'GLUTTONOUS_WILL' &&
                        moveReason.indexOf('gluttonous_eat_move') === 0;
                    const isSuperCrushMove =
                        SUPER_CRUSH_CAUSES.has(moveCause) &&
                        (moveReason.indexOf('super_buoyancy_move') === 0 || moveReason.indexOf('super_gravity_move') === 0);
                    const isWillHunterKingSlashMove =
                        moveCause === 'WILL_HUNTER_KING' &&
                        moveReason.indexOf('will_hunter_king_slash_move') === 0;
                    const moveActionId = ev.actionId || null;
                    const isSuperCrushActionMatched =
                        superCrushActionId === null ||
                        moveActionId === null ||
                        superCrushActionId === moveActionId;
                    const isGluttonousActionMatched =
                        gluttonousEatActionId === null ||
                        moveActionId === null ||
                        gluttonousEatActionId === moveActionId;
                    if (isGluttonousEatMove && gluttonousEatPhase !== null && isGluttonousActionMatched) {
                        pEvent.phase = gluttonousEatPhase;
                    } else if (isSuperCrushMove && superCrushPhase !== null && isSuperCrushActionMatched) {
                        pEvent.phase = superCrushPhase;
                    } else if (isWillHunterKingSlashMove && willHunterKingSlashPhase !== null) {
                        pEvent.phase = willHunterKingSlashPhase;
                    } else {
                        currentPhase++;
                        pEvent.phase = currentPhase;
                    }
                    gluttonousEatPhase = null;
                    gluttonousEatActionId = null;
                    superCrushPhase = null;
                    superCrushActionId = null;
                    willHunterKingSlashPhase = null;
                    break;
                case 'STATUS_APPLIED':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    willHunterKingSlashPhase = null;
                    pEvent.type = 'status_applied';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    break;
                case 'STATUS_TICK':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    willHunterKingSlashPhase = null;
                    pEvent.type = 'status_applied';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    break;
                case 'STATUS_REMOVED':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    willHunterKingSlashPhase = null;
                    pEvent.type = 'status_removed';
                    pEvent.targets = [{ r: ev.row, col: ev.col }];
                    if (isRegenConsumedStatus(ev)) {
                        currentPhase++;
                        pEvent.phase = currentPhase;
                    }
                    break;
                case 'HAND_CLEAR':
                case 'HAND_REMOVE':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    willHunterKingSlashPhase = null;
                    pEvent.type = 'hand_remove';
                    pEvent.targets = [{
                        player: ev.player || null,
                        count: Number.isFinite(ev.count) ? ev.count : 0,
                        reason: ev.reason || null,
                        cardId: ev.cardId || null,
                        cardIds: Array.isArray(ev.cardIds) ? ev.cardIds.slice() : null
                    }];
                    currentPhase++;
                    pEvent.phase = currentPhase;
                    break;
                case 'DRAW_CARD':
                case 'HAND_ADD':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    willHunterKingSlashPhase = null;
                    pEvent.type = 'hand_add';
                    pEvent.targets = [{
                        player: ev.player || null,
                        cardId: ev.cardId || null,
                        count: Number.isFinite(ev.count) ? ev.count : 1,
                        reason: ev.reason || (ev.meta && ev.meta.reason) || null,
                        sourceType: ev.meta && ev.meta.sourceType ? ev.meta.sourceType : null,
                        generatedName: ev.meta && ev.meta.generatedName ? ev.meta.generatedName : null
                    }];
                    // Draw animation should run as its own readable step.
                    currentPhase++;
                    pEvent.phase = currentPhase;
                    break;
                case 'CARD_USED':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    willHunterKingSlashPhase = null;
                    pEvent.type = 'card_use_animation';
                    pEvent.targets = [{
                        player: ev.player || null,
                        owner: (ev.meta && ev.meta.owner) ? ev.meta.owner : (ev.player || null),
                        cardId: ev.cardId || null,
                        cost: (ev.meta && Number.isFinite(ev.meta.cost)) ? ev.meta.cost : null,
                        name: (ev.meta && ev.meta.name) ? ev.meta.name : null
                    }];
                    // Card-use transport is also a readable step.
                    currentPhase++;
                    pEvent.phase = currentPhase;
                    break;
                case 'WORK_INCOME':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    willHunterKingSlashPhase = null;
                    pEvent.type = 'log';
                    pEvent.targets = [];
                    if (Number.isInteger(ev.row) && Number.isInteger(ev.col)) {
                        playbackEvents.push({
                            type: 'observer_bubble',
                            phase: currentPhase,
                            targets: [{
                                r: ev.row,
                                col: ev.col,
                                owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                                gained: Number(ev.gained) || 0,
                                text: _resolveWorkIncomeBubbleText(ev),
                                incomeStep: Number.isFinite(Number(ev.incomeStep))
                                    ? Number(ev.incomeStep)
                                    : (Number.isFinite(Number(ev.meta && ev.meta.incomeStep)) ? Number(ev.meta.incomeStep) : null)
                            }],
                            rawType: 'WORK_BUBBLE',
                            meta: ev.meta || null,
                            actionId: ev.actionId || null,
                            turnIndex: (typeof ev.turnIndex === 'number') ? ev.turnIndex : (finalCardState && typeof finalCardState.turnIndex === 'number' ? finalCardState.turnIndex : 0),
                            plyIndex: (typeof ev.plyIndex === 'number') ? ev.plyIndex : null
                        });
                    }
                    break;
                case 'WORK_REMOVED':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    willHunterKingSlashPhase = null;
                    pEvent.type = 'log';
                    pEvent.targets = [];
                    if (!_isWorkDurationExpiredPresentationEvent(ev) && Number.isInteger(ev.row) && Number.isInteger(ev.col)) {
                        playbackEvents.push({
                            type: 'observer_bubble',
                            phase: currentPhase,
                            targets: [{
                                r: ev.row,
                                col: ev.col,
                                owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                                gained: 0,
                                text: _resolveWorkRemovedBubbleText(ev)
                            }],
                            rawType: 'WORK_BUBBLE',
                            meta: ev.meta || null,
                            actionId: ev.actionId || null,
                            turnIndex: (typeof ev.turnIndex === 'number') ? ev.turnIndex : (finalCardState && typeof finalCardState.turnIndex === 'number' ? finalCardState.turnIndex : 0),
                            plyIndex: (typeof ev.plyIndex === 'number') ? ev.plyIndex : null
                        });
                    }
                    break;
                case 'WORK_BUBBLE':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    pEvent.type = 'observer_bubble';
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                        gained: Number(ev.gained) || 0,
                        text: (typeof ev.text === 'string' && ev.text.trim())
                            ? ev.text.trim()
                            : _resolveWorkIncomeBubbleText(ev)
                    }];
                    break;
                case 'OBSERVER_TRIGGERED':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    pEvent.type = 'observer_bubble';
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                        gained: Number(ev.gained) || 0,
                        text: (typeof ev.text === 'string' && ev.text.trim()) ? ev.text.trim() : ((ev.meta && typeof ev.meta.text === 'string' && ev.meta.text.trim()) ? ev.meta.text.trim() : null)
                    }];
                    break;
                case 'OBSERVER_BUBBLE':
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    willHunterKingSlashPhase = null;
                    pEvent.type = 'observer_bubble';
                    pEvent.targets = [{
                        r: ev.row,
                        col: ev.col,
                        owner: ev.owner || ev.player || (ev.meta && ev.meta.owner) || null,
                        gained: Number(ev.gained) || 0,
                        text: (typeof ev.text === 'string' && ev.text.trim()) ? ev.text.trim() : ((ev.meta && typeof ev.meta.text === 'string' && ev.meta.text.trim()) ? ev.meta.text.trim() : null)
                    }];
                    break;
                default:
                    // Unknown presentation event:
                    // keep playback resilient by ignoring silently in player-facing logs.
                    pEvent.type = null;
                    prevWasChainFlip = false;
                    prevChainFlipLink = null;
                    prevDestroyCause = null;
                    continue;
            }

            if (ev.type !== 'DESTROY' && ev.type !== 'MOVE') {
                superCrushPhase = null;
                superCrushActionId = null;
            }

            // NOTE: Do not populate 'after' using a final snapshot. Adapter is a thin transform.
            // Instead, include minimal per-target 'after' info derived from the presentation event itself
            // so that visual writers can render based on event payload without requiring snapshots.
            if (pEvent.type !== 'log' && pEvent.type !== 'card_use_animation' && pEvent.type !== 'observer_bubble') {
                for (const t of pEvent.targets) {
                    // Add a best-effort 'after' using event-sourced owner fields (no final snapshot)
                    if (t.ownerAfter !== undefined) {
                        t.after = {
                            color: (t.ownerAfter === 'black') ? 1 : -1,
                            special: getVisualSpecialFromMeta(ev.meta),
                            timer: getPrimaryTimerFromMeta(ev.meta),
                            owner: (ev.meta && ev.meta.owner) || null,
                            inheritedTimer: getInheritedTimerFromMeta(ev.meta),
                            inheritedOwner: getInheritedOwnerFromMeta(ev.meta),
                            flipEvadeRemaining: getFlipEvadeRemainingFromMeta(ev.meta),
                            inheritedFlipEvadeRemaining: getInheritedFlipEvadeRemainingFromMeta(ev.meta),
                            destroyEvadeRemaining: getDestroyEvadeRemainingFromMeta(ev.meta)
                        };
                    } else if (pEvent.type === 'spawn') {
                        t.after = {
                            color: (t.ownerAfter === 'black') ? 1 : -1,
                            special: getVisualSpecialFromMeta(ev.meta),
                            timer: getPrimaryTimerFromMeta(ev.meta),
                            owner: (ev.meta && ev.meta.owner) || null,
                            inheritedTimer: getInheritedTimerFromMeta(ev.meta),
                            inheritedOwner: getInheritedOwnerFromMeta(ev.meta),
                            flipEvadeRemaining: getFlipEvadeRemainingFromMeta(ev.meta),
                            inheritedFlipEvadeRemaining: getInheritedFlipEvadeRemainingFromMeta(ev.meta),
                            destroyEvadeRemaining: getDestroyEvadeRemainingFromMeta(ev.meta)
                        };
                    } else if (pEvent.type === 'move') {
                        const afterColor = (t.ownerAfter === 'black') ? 1 : ((t.ownerAfter === 'white') ? -1 : 0);
                        t.after = {
                            color: afterColor,
                            special: getVisualSpecialFromMeta(ev.meta),
                            timer: getPrimaryTimerFromMeta(ev.meta),
                            owner: (ev.meta && ev.meta.owner) || t.ownerAfter || null,
                            inheritedTimer: getInheritedTimerFromMeta(ev.meta),
                            inheritedOwner: getInheritedOwnerFromMeta(ev.meta),
                            flipEvadeRemaining: getFlipEvadeRemainingFromMeta(ev.meta),
                            inheritedFlipEvadeRemaining: getInheritedFlipEvadeRemainingFromMeta(ev.meta),
                            destroyEvadeRemaining: getDestroyEvadeRemainingFromMeta(ev.meta)
                        };
                    } else if (pEvent.type === 'destroy') {
                        t.after = {
                            color: 0,
                            special: null,
                            timer: null,
                            owner: null,
                            inheritedTimer: null,
                            inheritedOwner: null,
                            flipEvadeRemaining: null,
                            inheritedFlipEvadeRemaining: null,
                            destroyEvadeRemaining: null
                        };
                    } else if (pEvent.type === 'status_applied' || pEvent.type === 'status_removed') {
                        const visual = getVisualStateAt(t.r, t.col, finalCardState, finalGameState);
                        const specialFromEventRaw = (ev.meta && ev.meta.special) || null;
                        const specialFromEvent = getVisualSpecialFromMeta(ev.meta);
                        const ownerFromEvent = (ev.meta && ev.meta.owner) || null;
                        const inheritedTimerFromEvent = getInheritedTimerFromMeta(ev.meta);
                        const inheritedOwnerFromEvent = getInheritedOwnerFromMeta(ev.meta);
                        const flipEvadeRemainingFromEvent = getFlipEvadeRemainingFromMeta(ev.meta);
                        const inheritedFlipEvadeRemainingFromEvent = getInheritedFlipEvadeRemainingFromMeta(ev.meta);
                        const destroyEvadeRemainingFromEvent = getDestroyEvadeRemainingFromMeta(ev.meta);
                        const isStatusRemoved = pEvent.type === 'status_removed';
                        let color = visual.color || 0;
                        if (color === 0 && (specialFromEventRaw === 'TRAP' || specialFromEventRaw === 'TRAP_REVEAL')) {
                            if (ownerFromEvent === 'black' || ownerFromEvent === 1 || ownerFromEvent === '1') color = 1;
                            if (ownerFromEvent === 'white' || ownerFromEvent === -1 || ownerFromEvent === '-1') color = -1;
                        }
                        const specialForVisual = isStatusRemoved ? (visual.special || null) : (specialFromEvent || visual.special || null);
                        const timerForVisual = isStatusRemoved
                            ? (visual.timer || null)
                            : ((ev.meta && ev.meta.timer) || visual.timer || null);
                        const ownerForVisual = isStatusRemoved
                            ? (visual.owner || null)
                            : (ownerFromEvent || visual.owner || null);
                        const inheritedTimerForVisual = isStatusRemoved
                            ? (visual.inheritedTimer || null)
                            : (inheritedTimerFromEvent || visual.inheritedTimer || null);
                        const inheritedOwnerForVisual = isStatusRemoved
                            ? (visual.inheritedOwner || null)
                            : (inheritedOwnerFromEvent || visual.inheritedOwner || null);
                        const flipEvadeRemainingForVisual = isStatusRemoved
                            ? (visual.flipEvadeRemaining ?? null)
                            : ((flipEvadeRemainingFromEvent ?? visual.flipEvadeRemaining) ?? null);
                        const inheritedFlipEvadeRemainingForVisual = isStatusRemoved
                            ? (visual.inheritedFlipEvadeRemaining ?? null)
                            : ((inheritedFlipEvadeRemainingFromEvent ?? visual.inheritedFlipEvadeRemaining) ?? null);
                        const destroyEvadeRemainingForVisual = isStatusRemoved
                            ? (visual.destroyEvadeRemaining ?? null)
                            : ((destroyEvadeRemainingFromEvent ?? visual.destroyEvadeRemaining) ?? null);
                        t.after = {
                            color,
                            special: specialForVisual,
                            timer: timerForVisual,
                            owner: ownerForVisual,
                            inheritedTimer: inheritedTimerForVisual,
                            inheritedOwner: inheritedOwnerForVisual,
                            flipEvadeRemaining: flipEvadeRemainingForVisual,
                            inheritedFlipEvadeRemaining: inheritedFlipEvadeRemainingForVisual,
                            destroyEvadeRemaining: destroyEvadeRemainingForVisual
                        };
                    } else {
                        t.after = {
                            color: 0,
                            special: null,
                            timer: null,
                            owner: null,
                            inheritedTimer: null,
                            inheritedOwner: null,
                            flipEvadeRemaining: null,
                            inheritedFlipEvadeRemaining: null,
                            destroyEvadeRemaining: null
                        };
                    }
                }
            }            if (pEvent.type) playbackEvents.push(pEvent);
        }

        const generatedThrowChainSplit = _extractGeneratedThrowChainPlayback(playbackEvents);
        return _appendGeneratedThrowChainPlayback(generatedThrowChainSplit.immediateEvents, generatedThrowChainSplit.deferredEvents);
    }

    function _phaseNum(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function _getPrimaryPlaybackTarget(ev) {
        if (ev && Array.isArray(ev.targets) && ev.targets.length > 0) {
            return ev.targets[0];
        }
        return ev || null;
    }

    function _hasGeneratedThrowChainReason(reason) {
        return String(reason || '').trim().toLowerCase() === GENERATED_THROW_CHAIN_REASON;
    }

    function _isGeneratedThrowChainHandAddPlaybackEvent(ev) {
        if (!ev || ev.type !== 'hand_add') return false;
        if (String(ev.rawType || '').toUpperCase() !== 'HAND_ADD') return false;
        if (_hasGeneratedThrowChainReason(ev.reason)) return true;
        if (_hasGeneratedThrowChainReason(ev.meta && ev.meta.reason)) return true;
        const candidates = Array.isArray(ev.targets) && ev.targets.length > 0
            ? ev.targets
            : [ev];
        return candidates.some((target) => !!target && _hasGeneratedThrowChainReason(target.reason));
    }

    function _countPlaybackCards(ev) {
        const target = _getPrimaryPlaybackTarget(ev);
        const count = Number(target && target.count);
        return Number.isFinite(count) ? Math.max(1, Math.trunc(count)) : 1;
    }

    function _clonePlaybackTarget(target) {
        if (!target || typeof target !== 'object') return target;
        const clonedTarget = Object.assign({}, target);
        if (target.from && typeof target.from === 'object') clonedTarget.from = Object.assign({}, target.from);
        if (target.to && typeof target.to === 'object') clonedTarget.to = Object.assign({}, target.to);
        if (target.after && typeof target.after === 'object') clonedTarget.after = Object.assign({}, target.after);
        if (target.meta && typeof target.meta === 'object') clonedTarget.meta = Object.assign({}, target.meta);
        return clonedTarget;
    }

    function _clonePlaybackEventWithPhase(ev, phase) {
        const clonedEvent = Object.assign({}, ev, { phase });
        if (clonedEvent.meta && typeof clonedEvent.meta === 'object') {
            clonedEvent.meta = Object.assign({}, clonedEvent.meta);
        }
        if (Array.isArray(ev && ev.targets)) {
            clonedEvent.targets = ev.targets.map((target) => _clonePlaybackTarget(target));
        }
        return clonedEvent;
    }

    function _setDeferredGeneratedThrowChainPlayback(playerKey, events) {
        const ownerKey = _normalizePlayerKey(playerKey) || 'black';
        deferredGeneratedThrowChainPlaybackByPlayer[ownerKey] = Array.isArray(events)
            ? events.map((ev) => _clonePlaybackEventWithPhase(ev, _phaseNum(ev && ev.phase)))
            : [];
    }

    function _takeDeferredGeneratedThrowChainPlayback(playerKey) {
        const ownerKey = _normalizePlayerKey(playerKey) || 'black';
        const queued = Array.isArray(deferredGeneratedThrowChainPlaybackByPlayer[ownerKey])
            ? deferredGeneratedThrowChainPlaybackByPlayer[ownerKey].slice()
            : [];
        _clearDeferredGeneratedThrowChainPlaybackForPlayer(ownerKey);
        return queued;
    }

    function _extractGeneratedThrowChainPlayback(playbackEvents) {
        const immediateEvents = [];
        const deferredEvents = [];
        for (const ev of Array.isArray(playbackEvents) ? playbackEvents : []) {
            if (_isGeneratedThrowChainHandAddPlaybackEvent(ev)) {
                deferredEvents.push(ev);
            } else {
                immediateEvents.push(ev);
            }
        }
        return { immediateEvents, deferredEvents };
    }

    function _appendGeneratedThrowChainPlayback(playbackEvents, deferredEvents) {
        const baseEvents = Array.isArray(playbackEvents) ? playbackEvents.slice() : [];
        const pendingEvents = Array.isArray(deferredEvents) ? deferredEvents : [];
        if (pendingEvents.length <= 0) return baseEvents;

        const startPhase = Math.max(1, _maxPhase(baseEvents) + 1);
        for (let index = 0; index < pendingEvents.length; index += 1) {
            baseEvents.push(_clonePlaybackEventWithPhase(pendingEvents[index], startPhase + index));
        }
        return baseEvents;
    }

    function _processGeneratedThrowChainPlayback(playbackEvents, action, playerKey) {
        const split = _extractGeneratedThrowChainPlayback(playbackEvents);
        const actionType = String(action && action.type ? action.type : '').toLowerCase();
        const ownerKey = _normalizePlayerKey(playerKey) || 'black';

        if (actionType === 'use_card') {
            if (split.deferredEvents.length > 0) {
                _setDeferredGeneratedThrowChainPlayback(ownerKey, split.deferredEvents);
                return {
                    playbackEvents: split.immediateEvents,
                    deferredGeneratedThrowChainHandAdd: {
                        playerKey: ownerKey,
                        count: split.deferredEvents.reduce((sum, ev) => sum + _countPlaybackCards(ev), 0),
                        reason: GENERATED_THROW_CHAIN_REASON
                    }
                };
            }
            return { playbackEvents: split.immediateEvents, deferredGeneratedThrowChainHandAdd: null };
        }

        if (actionType === 'place') {
            const queuedDeferredEvents = _takeDeferredGeneratedThrowChainPlayback(ownerKey);
            const allDeferredEvents = queuedDeferredEvents.concat(split.deferredEvents);
            return {
                playbackEvents: _appendGeneratedThrowChainPlayback(split.immediateEvents, allDeferredEvents),
                deferredGeneratedThrowChainHandAdd: null
            };
        }

        if (split.deferredEvents.length > 0) {
            _setDeferredGeneratedThrowChainPlayback(ownerKey, split.deferredEvents);
        }

        return { playbackEvents: split.immediateEvents, deferredGeneratedThrowChainHandAdd: null };
    }

    function _maxPhase(playbackEvents) {
        const arr = Array.isArray(playbackEvents) ? playbackEvents : [];
        return arr.reduce((maxP, ev) => {
            const p = _phaseNum(ev && ev.phase);
            return p > maxP ? p : maxP;
        }, 0);
    }

    function _findPhase(playbackEvents, predicate, fallbackPhase) {
        const arr = Array.isArray(playbackEvents) ? playbackEvents : [];
        for (const ev of arr) {
            if (predicate(ev)) return _phaseNum(ev && ev.phase);
        }
        return _phaseNum(fallbackPhase);
    }

    function _rawDetailCount(ev) {
        if (!ev || !Array.isArray(ev.details)) return 0;
        return ev.details.length;
    }

    function _hasRawEvent(rawEvents, type, predicate) {
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        for (const ev of events) {
            if (!ev || ev.type !== type) continue;
            if (!predicate || predicate(ev)) return true;
        }
        return false;
    }

    function _isDestroyWithCause(target, causes) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        return causes.has(cause);
    }

    function _isHyperactiveMoveTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return (
            cause === 'HYPERACTIVE' ||
            cause === 'ESCAPE_HYPERACTIVE' ||
            cause === 'EXTREME_HYPERACTIVE_WILL' ||
            cause === 'GLUTTONOUS_WILL' ||
            cause === 'ULTIMATE_HYPERACTIVE' ||
            cause === 'ULTIMATE_HYPERACTIVE_GOD' ||
            reason.indexOf('hyperactive') >= 0 ||
            reason.indexOf('gluttonous') >= 0
        );
    }

    function _isSuperCrushMoveTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return (
            SUPER_CRUSH_CAUSES.has(cause) ||
            reason.indexOf('super_buoyancy_move') === 0 ||
            reason.indexOf('super_gravity_move') === 0
        );
    }

    function _isSpecialDurationExpiredDestroyTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        if (!reason || reason.indexOf('expired') < 0) return false;
        if (cause === 'TRAP_WILL' && (reason.indexOf('trap_expired') >= 0 || reason.indexOf('trap_disarmed') >= 0)) return false;
        if (BOMB_DESTROY_CAUSES.has(cause)) return false;
        return SPECIAL_DURATION_EXPIRE_CAUSES.has(cause);
    }

    function _isSpecialDurationExpiredDestroyEvent(ev) {
        return !!(ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t) => _isSpecialDurationExpiredDestroyTarget(t)));
    }

    function _isSniperShotDestroyTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return cause === 'SNIPER_WILL' && reason.indexOf('sniper_shot') >= 0;
    }

    function _isLightningDestroyTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return cause === 'LIGHTNING_WILL' && reason.indexOf('lightning_destroyed') >= 0;
    }

    function _isRobotVacuumSuckDestroyTarget(target) {
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return cause === 'ROBOT_VACUUM' && reason.indexOf('robot_vacuum_suck') >= 0;
    }

    function _isGoldSilverSelfDestroyTarget(target) {
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        return reason === 'gold_stone_sacrifice' || reason === 'rainbow_stone_sacrifice' || reason === 'silver_stone_sacrifice' || reason === 'crystal_stone_sacrifice';
    }

    function _isGoldSilverSelfDestroyEvent(ev) {
        return !!(ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t) => _isGoldSilverSelfDestroyTarget(t)));
    }

    function _isWorkDurationExpiredPresentationEvent(ev) {
        if (!ev || !ev.type) return false;
        if (ev.type === 'WORK_INCOME') {
            if (ev.removed !== true) return false;
            const reasonIncome = String(ev.reason || (ev.meta && ev.meta.reason) || '').toLowerCase();
            const causeIncome = String(ev.cause || '').toLowerCase();
            if (!reasonIncome && !causeIncome) return true;
            return reasonIncome === 'duration_end' || reasonIncome.indexOf('duration') >= 0 || reasonIncome.indexOf('expire') >= 0 || causeIncome.indexOf('expire') >= 0;
        }
        if (ev.type !== 'WORK_REMOVED') return false;
        const cause = String(ev.cause || '').toLowerCase();
        const reason = String(ev.reason || (ev.meta && ev.meta.reason) || '').toLowerCase();
        if (reason === 'duration_end' || reason.indexOf('duration') >= 0) return true;
        return cause.indexOf('expire') >= 0 || reason.indexOf('expire') >= 0;
    }

    function _isWorkFlipOrDestroyRemovedPresentationEvent(ev) {
        if (!ev || ev.type !== 'WORK_REMOVED') return false;
        if (ev.removed === false) return false;
        if (_isWorkDurationExpiredPresentationEvent(ev)) return false;
        return true;
    }

    function appendSoundEffectPlaybackEvents(playbackEvents, rawEvents, presentationEvents) {
        const base = Array.isArray(playbackEvents) ? playbackEvents.slice() : [];
        const raw = Array.isArray(rawEvents) ? rawEvents : [];
        const pres = Array.isArray(presentationEvents) ? presentationEvents : [];
        if (!raw.length && !base.length) return base;

        const maxPhase = _maxPhase(base);
        const fallbackPhase = maxPhase + 1;
        const added = [];
        const seenSingleKeys = new Set();

        const pushCue = (soundKey, phase, sourceType, options = {}) => {
            const key = String(soundKey || '').trim();
            const allowRepeat = !!(options && options.allowRepeat === true);
            if (!key) return;
            if (!allowRepeat) {
                if (seenSingleKeys.has(key)) return;
                seenSingleKeys.add(key);
            }
            added.push({
                type: SOUND_EVENT_TYPE,
                phase: _phaseNum(phase),
                targets: [{ soundKey: key }],
                meta: sourceType ? { sourceType } : null
            });
        };

        const bombDestroyPhases = Array.from(new Set(
            base
                .filter((ev) => ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t) => _isDestroyWithCause(t, BOMB_DESTROY_CAUSES)))
                .map((ev) => _phaseNum(ev && ev.phase))
                .filter((phase) => phase > 0)
        )).sort((a, b) => a - b);
        if (bombDestroyPhases.length > 0) {
            for (const phase of bombDestroyPhases) {
                pushCue('bomb_explode', phase, 'bomb_destroy', { allowRepeat: true });
            }
        } else if (_hasRawEvent(raw, 'bombs_exploded', (ev) => !!(ev && ev.details))) {
            pushCue('bomb_explode', fallbackPhase, 'bombs_exploded');
        }

        const breedingPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'spawn' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                const reason = String(t && t.reason ? t.reason : '').toLowerCase();
                return cause === 'BREEDING' || reason.indexOf('breeding_spawn') === 0;
            }),
            fallbackPhase
        );
        if (
            _hasRawEvent(raw, 'breeding_spawned_start', (ev) => _rawDetailCount(ev) > 0) ||
            _hasRawEvent(raw, 'breeding_spawned_immediate', (ev) => _rawDetailCount(ev) > 0)
        ) {
            pushCue('breeding_spawn', breedingPhase, 'breeding_spawned');
        }

        const dragonFlipPhases = Array.from(new Set(
            base
                .filter((ev) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                    const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                    const reason = String(t && t.reason ? t.reason : '').toLowerCase();
                    return cause === 'DRAGON' && reason.indexOf('dragon_convert') === 0;
                }))
                .map((ev) => _phaseNum(ev && ev.phase))
                .filter((phase) => phase > 0)
        )).sort((a, b) => a - b);
        if (dragonFlipPhases.length > 0) {
            for (const phase of dragonFlipPhases) {
                pushCue('dragon_flip', phase, 'dragon_converted', { allowRepeat: true });
            }
        } else {
            const dragonFallbackCount = raw.reduce((sum, ev) => {
                if (!ev || !ev.type) return sum;
                if (ev.type !== 'dragon_converted_start' && ev.type !== 'dragon_converted_immediate') return sum;
                return sum + (_rawDetailCount(ev) > 0 ? 1 : 0);
            }, 0);
            for (let i = 0; i < dragonFallbackCount; i++) {
                pushCue('dragon_flip', fallbackPhase + i, 'dragon_converted', { allowRepeat: true });
            }
        }

        const hyperactiveMoveEvents = base.filter((ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => _isHyperactiveMoveTarget(t)));
        if (hyperactiveMoveEvents.length > 0) {
            for (const moveEv of hyperactiveMoveEvents) {
                const phase = _phaseNum(moveEv && moveEv.phase);
                const targets = Array.isArray(moveEv.targets) ? moveEv.targets : [];
                const moveCount = targets.filter((t) => _isHyperactiveMoveTarget(t)).length;
                for (let i = 0; i < moveCount; i++) {
                    pushCue('hyperactive_move', phase, 'hyperactive_moved', { allowRepeat: true });
                }
            }
        } else {
            const fallbackMoveCount = raw.reduce((sum, ev) => {
                if (!ev || !ev.type) return sum;
                if (
                    ev.type !== 'hyperactive_moved_start' &&
                    ev.type !== 'hyperactive_moved_immediate' &&
                    ev.type !== 'ultimate_hyperactive_moved_start' &&
                    ev.type !== 'ultimate_hyperactive_moved_immediate'
                ) {
                    return sum;
                }
                return sum + _rawDetailCount(ev);
            }, 0);
            for (let i = 0; i < fallbackMoveCount; i++) {
                pushCue('hyperactive_move', fallbackPhase + i, 'hyperactive_moved', { allowRepeat: true });
            }
        }

        const specialExpiredPhase = _findPhase(base, _isSpecialDurationExpiredDestroyEvent, fallbackPhase);
        if (base.some(_isSpecialDurationExpiredDestroyEvent)) {
            pushCue('special_expired', specialExpiredPhase, 'special_expired');
        }

        const trapSelectPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'TRAP',
            fallbackPhase
        );
        const timeBombSelectPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'TIME_BOMB',
            fallbackPhase
        );
        if (_hasRawEvent(raw, 'trap_selected', (ev) => !!(ev && ev.applied))) {
            pushCue('trap_select', trapSelectPhase, 'trap_selected');
        }
        if (_hasRawEvent(raw, 'time_bomb_selected', (ev) => !!(ev && ev.applied))) {
            pushCue('trap_select', timeBombSelectPhase, 'time_bomb_selected');
        }

        const guardSelectPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'GUARD',
            fallbackPhase
        );
        if (_hasRawEvent(raw, 'guard_selected', (ev) => !!(ev && ev.applied))) {
            pushCue('guard_select', guardSelectPhase, 'guard_selected');
        }

        const freezeSelectPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'FREEZE',
            fallbackPhase
        );
        if (_hasRawEvent(raw, 'freeze_selected', (ev) => !!(ev && ev.applied))) {
            pushCue('freeze_select', freezeSelectPhase, 'freeze_selected');
        }

        const trapTriggeredEvent = raw.find((ev) => ev && ev.type === 'trap_triggered' && _rawDetailCount(ev) > 0);
        const trapTriggeredDetail = trapTriggeredEvent && Array.isArray(trapTriggeredEvent.details)
            ? trapTriggeredEvent.details[0]
            : null;
        const trapTriggeredPhase = (trapTriggeredDetail && Number.isInteger(trapTriggeredDetail.row) && Number.isInteger(trapTriggeredDetail.col))
            ? _findPhase(
                base,
                (ev) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((t) => t && t.r === trapTriggeredDetail.row && t.col === trapTriggeredDetail.col),
                fallbackPhase
            )
            : fallbackPhase;
        if (trapTriggeredEvent) {
            pushCue('trap_triggered', trapTriggeredPhase, 'trap_triggered');
        }

        const strongWindPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                const reason = String(t && t.reason ? t.reason : '').toLowerCase();
                return cause === 'STRONG_WIND_WILL' || reason.indexOf('strong_wind_move') === 0;
            }),
            fallbackPhase
        );
        if (_hasRawEvent(raw, 'strong_wind_selected', (ev) => !!(ev && ev.applied))) {
            pushCue('strong_wind_move', strongWindPhase, 'strong_wind_selected');
        }

        const superBuoyancyPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                if (!_isSuperCrushMoveTarget(t)) return false;
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                return cause === 'SUPER_BUOYANCY_WILL';
            }),
            fallbackPhase
        );
        if (_hasRawEvent(raw, 'super_buoyancy_selected', (ev) => !!(ev && ev.applied))) {
            pushCue('super_buoyancy_move', superBuoyancyPhase, 'super_buoyancy_selected');
        }

        const superGravityPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                if (!_isSuperCrushMoveTarget(t)) return false;
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                return cause === 'SUPER_GRAVITY_WILL';
            }),
            fallbackPhase
        );
        if (_hasRawEvent(raw, 'super_gravity_selected', (ev) => !!(ev && ev.applied))) {
            pushCue('super_gravity_move', superGravityPhase, 'super_gravity_selected');
        }

        const teleportPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                const reason = String(t && t.reason ? t.reason : '').toLowerCase();
                return cause === 'TELEPORT_WILL' || reason.indexOf('teleport_move') === 0;
            }),
            fallbackPhase
        );
        if (_hasRawEvent(raw, 'teleport_selected', (ev) => !!(ev && ev.applied))) {
            pushCue('teleport_select', teleportPhase, 'teleport_selected');
        }

        const trapMisfirePhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const reason = String(t && t.reason ? t.reason : '').toLowerCase();
                return reason.indexOf('trap_disarmed') >= 0 || reason.indexOf('trap_expired') >= 0;
            }),
            fallbackPhase
        );
        if (
            _hasRawEvent(raw, 'trap_disarmed', (ev) => _rawDetailCount(ev) > 0) ||
            _hasRawEvent(raw, 'trap_expired', (ev) => _rawDetailCount(ev) > 0)
        ) {
            pushCue('trap_misfire', trapMisfirePhase, 'trap_misfire');
        }

        const clonePhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                return !!(t && t.clone === true) || cause === 'CLONE_WILL' || cause === 'SPLIT_WILL';
            }),
            fallbackPhase
        );
        if (
            _hasRawEvent(raw, 'clone_selected', (ev) => !!(ev && ev.applied)) ||
            _hasRawEvent(raw, 'split_selected', (ev) => !!(ev && ev.applied))
        ) {
            pushCue('clone_spawn', clonePhase, 'clone_selected');
        }

        const extendLifePhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() !== 'TRAP',
            fallbackPhase
        );
        if (_hasRawEvent(raw, 'extend_life_selected', (ev) => !!(ev && ev.applied))) {
            pushCue('extend_life', extendLifePhase, 'extend_life_selected');
        }

        const corrosionPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'card_use_animation',
            fallbackPhase
        );
        if (_hasRawEvent(raw, 'corrosion_will_resolved', (ev) => Number(ev && ev.affectedCount) > 0)) {
            pushCue('corrosion_tick', corrosionPhase, 'corrosion_will_resolved');
        }

        const temptPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((t) => {
                const cause = String(t && t.cause ? t.cause : '').toUpperCase();
                const reason = String(t && t.reason ? t.reason : '').toLowerCase();
                return cause === 'TEMPT_WILL' || reason.indexOf('tempt_applied') === 0;
            }),
            fallbackPhase
        );
        if (_hasRawEvent(raw, 'tempt_selected', (ev) => !!(ev && ev.applied))) {
            pushCue('tempt_select', temptPhase, 'tempt_selected');
        }

        const treasureUsePhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'card_use_animation',
            0
        );
        const treasurePhase = treasureUsePhase > 0 ? (treasureUsePhase + 1) : fallbackPhase;
        const hasTreasureGain = _hasRawEvent(raw, 'treasure_box_gain', (ev) => Number(ev && ev.gained) > 0);
        if (hasTreasureGain) {
            pushCue('treasure_gain', treasurePhase, 'treasure_box_gain');
        }

        const condemnPhase = _findPhase(
            base,
            (ev) => ev && ev.type === 'card_use_animation',
            fallbackPhase
        );
        if (_hasRawEvent(raw, 'condemn_selected', (ev) => !!(ev && ev.applied && ev.destroyedCardId))) {
            pushCue('stone_destroy', condemnPhase, 'condemn_selected');
        }

        const workIncomePhase = _findPhase(
            base,
            (ev) => ev && ev.rawType === 'WORK_INCOME',
            _findPhase(
                base,
                (ev) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'WORK',
                fallbackPhase
            )
        );
        const hasWorkIncome16 = pres.some((ev) => ev && ev.type === 'WORK_INCOME' && Number(ev.gained) === 16);
        const hasWorkIncome = pres.some((ev) => ev && ev.type === 'WORK_INCOME' && Number(ev.gained) > 0);
        if (hasWorkIncome16) {
            pushCue('work_income_16', workIncomePhase, 'work_income');
        } else if (hasWorkIncome && !hasTreasureGain) {
            pushCue('sell_sacrifice_gain', workIncomePhase, 'work_income');
        }

        const workRemovedEvents = pres.filter((ev) => _isWorkFlipOrDestroyRemovedPresentationEvent(ev));
        if (workRemovedEvents.length > 0) {
            const workRemovedPlaybackEvents = base.filter((ev) => ev && ev.rawType === 'WORK_REMOVED');
            const workRemovedFallbackPhase = _findPhase(
                base,
                (ev) => ev && ev.rawType === 'WORK_REMOVED',
                fallbackPhase
            );
            for (let i = 0; i < workRemovedEvents.length; i++) {
                const playbackEv = workRemovedPlaybackEvents[i];
                const phase = playbackEv ? _phaseNum(playbackEv.phase) : workRemovedFallbackPhase;
                pushCue('work_removed', phase, 'work_removed', { allowRepeat: true });
            }
        }

        const hasAppliedSacrificeSelection = _hasRawEvent(raw, 'sacrifice_selected', (ev) => !!(ev && ev.applied));

        const sniperDestroyEvents = base.filter((ev) => (
            ev &&
            ev.type === 'destroy' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((t) => _isSniperShotDestroyTarget(t))
        ));
        if (sniperDestroyEvents.length > 0) {
            for (const sniperEv of sniperDestroyEvents) {
                const phase = _phaseNum(sniperEv && sniperEv.phase);
                const targets = Array.isArray(sniperEv.targets) ? sniperEv.targets : [];
                const shotCount = targets.filter((t) => _isSniperShotDestroyTarget(t)).length;
                for (let i = 0; i < shotCount; i++) {
                    pushCue('stone_destroy', phase, 'sniper_shot', { allowRepeat: true });
                }
            }
        }

        const lightningDestroyEvents = base.filter((ev) => (
            ev &&
            ev.type === 'destroy' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((t) => _isLightningDestroyTarget(t))
        ));
        if (lightningDestroyEvents.length > 0) {
            for (const lightningEv of lightningDestroyEvents) {
                const phase = _phaseNum(lightningEv && lightningEv.phase);
                const targets = Array.isArray(lightningEv.targets) ? lightningEv.targets : [];
                const hitCount = targets.filter((t) => _isLightningDestroyTarget(t)).length;
                for (let i = 0; i < hitCount; i++) {
                    pushCue('stone_destroy', phase, 'lightning_destroyed', { allowRepeat: true });
                }
            }
        }

        const robotVacuumSuckPhases = Array.from(new Set(
            base
                .filter((ev) => (
                    ev &&
                    ev.type === 'destroy' &&
                    Array.isArray(ev.targets) &&
                    ev.targets.some((t) => _isRobotVacuumSuckDestroyTarget(t))
                ))
                .map((ev) => _phaseNum(ev && ev.phase))
                .filter((phase) => phase > 0)
        )).sort((a, b) => a - b);
        for (const phase of robotVacuumSuckPhases) {
            pushCue('robot_vacuum_suck', phase, 'robot_vacuum_suck', { allowRepeat: true });
        }

        const goldSilverSelfDestroyPhases = Array.from(new Set(
            base
                .filter((ev) => _isGoldSilverSelfDestroyEvent(ev))
                .map((ev) => _phaseNum(ev && ev.phase))
                .filter((phase) => phase > 0)
        )).sort((a, b) => a - b);
        for (const phase of goldSilverSelfDestroyPhases) {
            pushCue('sell_sacrifice_gain', phase, 'gold_silver_self_destroy', { allowRepeat: true });
        }

        const isGenericDestroyEvent = (ev) => {
            if (!ev || ev.type !== 'destroy' || !Array.isArray(ev.targets)) return false;
            if (_isSpecialDurationExpiredDestroyEvent(ev)) return false;
            return ev.targets.some((t) => {
            const cause = String(t && t.cause ? t.cause : '').toUpperCase();
            const reason = String(t && t.reason ? t.reason : '').toLowerCase();
            if (hasAppliedSacrificeSelection) return false;
            if (BOMB_DESTROY_CAUSES.has(cause)) return false;
            if (_isSniperShotDestroyTarget(t)) return false;
            if (_isLightningDestroyTarget(t)) return false;
            if (_isRobotVacuumSuckDestroyTarget(t)) return false;
            if (_isGoldSilverSelfDestroyTarget(t)) return false;
            if (cause === 'ULTIMATE_DESTROY_GOD' && reason.indexOf('expired') >= 0) return false;
            if (cause === 'TRAP_WILL' && (reason.indexOf('trap_expired') >= 0 || reason.indexOf('trap_disarmed') >= 0)) return false;
            return true;
            });
        };
        if (base.some(isGenericDestroyEvent)) {
            const genericDestroyPhase = _findPhase(base, isGenericDestroyEvent, fallbackPhase);
            pushCue('stone_destroy', genericDestroyPhase, 'destroy');
        }

        added.sort((a, b) => _phaseNum(a.phase) - _phaseNum(b.phase));
        return base.concat(added);
    }

    function _playerLabel(playerKey) {
        return playerKey === 'black' ? '黒' : '白';
    }

    function _toPosText(pos) {
        if (!pos || !Number.isInteger(pos.row) || !Number.isInteger(pos.col)) return '';
        if (SharedBoardUtils && typeof SharedBoardUtils.formatPosTextJa === 'function') {
            return SharedBoardUtils.formatPosTextJa(pos);
        }
        if (pos.col === -1) return `左外${pos.row + 1}`;
        if (pos.col === 8) return `右外${pos.row + 1}`;
        const file = String.fromCharCode('A'.charCodeAt(0) + pos.col);
        return `${file}${pos.row + 1}`;
    }

    function _specialLabelJa(rawSpecial) {
        const s = String(rawSpecial || '').toUpperCase();
        if (s === 'BREEDING') return '繁殖石';
        if (s === 'TIME_BOMB') return '時限爆弾';
        if (s === 'DRAGON') return '究極反転龍';
        if (s === 'DESTROY_DRAGON') return '破壊龍';
        if (s === 'ULTIMATE_DESTROY_GOD') return '究極破壊神';
        if (s === 'SNIPER') return '狙撃石';
        if (s === 'LIGHTNING') return '落雷石';
        if (s === 'OBSERVER') return '盤理の観測者石';
        if (s === 'HYPERACTIVE') return '多動石';
        if (s === 'EXTREME_HYPERACTIVE') return '極悪多動魔';
        if (s === 'ESCAPE_HYPERACTIVE') return '逃亡石';
        if (s === 'GLUTTONOUS') return '悪食石';
        if (s === 'ULTIMATE_HYPERACTIVE') return '究極多動神';
        if (s === 'REGEN') return '復活石';
        if (s === 'WORK') return '労働石';
        if (s === 'CROSS_BOMB') return '十字爆弾';
        if (s === 'X_BOMB') return 'クロス爆弾';
        if (s === 'PROTECTED') return '反転保護';
        if (s === 'PERMA_PROTECTED') return '永続反転保護';
        if (s === 'GUARD') return '守る石';
        if (s === 'TRAP' || s === 'TRAP_REVEAL') return '罠石';
        if (s === 'BLOCKADE') return '封鎖マス';
        return rawSpecial || '';
    }

    function _detailCount(ev) {
        return (ev && Array.isArray(ev.details)) ? ev.details.length : 0;
    }

    function _detailGainedSum(ev) {
        if (!ev || !Array.isArray(ev.details)) return 0;
        return ev.details.reduce((sum, one) => sum + (Number(one && one.gained) || 0), 0);
    }

    function _hyperactiveLabel(ev, fallback) {
        const details = (ev && Array.isArray(ev.details)) ? ev.details : null;
        const first = details && details[0] ? details[0] : null;
        const markerType = String(first && (first.specialType || first.type) ? (first.specialType || first.type) : '').toUpperCase();
        if (markerType === 'EXTREME_HYPERACTIVE') return '極悪多動魔';
        if (markerType === 'ESCAPE_HYPERACTIVE') return '逃亡石';
        if (markerType === 'GLUTTONOUS') return '悪食石';
        return fallback;
    }

    function _pushCountLog(logs, ev, label, suffix) {
        logs.push(`${label}${_detailCount(ev)}${suffix}`);
    }

    function _normalizePlayerKey(v) {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            const normalized = OwnerHelpersModule.normalizePlayerKeyOptional(v);
            if (normalized) return normalized;
        }
        if (v === 'black' || v === 1 || v === '1') return 'black';
        if (v === 'white' || v === -1 || v === '-1') return 'white';
        return null;
    }

    function _resolveEventActorKey(ev, fallbackPlayerKey) {
        const byPlayer = _normalizePlayerKey(ev && ev.player);
        if (byPlayer) return byPlayer;
        const details = ev && Array.isArray(ev.details) ? ev.details : null;
        if (details && details.length > 0) {
            const byDetailOwner = _normalizePlayerKey(details[0] && details[0].owner);
            if (byDetailOwner) return byDetailOwner;
            const byDetailOwnerKey = _normalizePlayerKey(details[0] && details[0].ownerKey);
            if (byDetailOwnerKey) return byDetailOwnerKey;
        }
        return _normalizePlayerKey(fallbackPlayerKey) || 'black';
    }

    function _withActorPrefix(line, actorKey) {
        const text = String(line || '').trim();
        if (!text) return '';
        if (/^(黒|白):/.test(text)) return text;
        return `${_playerLabel(actorKey)}: ${text}`;
    }

    function mapEffectLogsFromPipeline(rawEvents, presEvents, playerKey) {
        const logs = [];
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        const seenStatusTick = new Set();

        for (const ev of events) {
            if (!ev || !ev.type) continue;
            const actorKey = _resolveEventActorKey(ev, playerKey);
            const push = (line) => {
                const msg = _withActorPrefix(line, actorKey);
                if (msg) logs.push(msg);
            };
            switch (ev.type) {
                case 'bombs_exploded':
                    push(`時限爆弾が${(ev.details && Array.isArray(ev.details.exploded)) ? ev.details.exploded.length : 0}箇所で爆発`);
                    break;
                case 'chain_flipped':
                    push(`連鎖: ${_detailCount(ev)}枚を追加反転`);
                    break;
                case 'taboo_reverse_flipped':
                    push(`禁忌の反転: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'dragon_converted_start':
                case 'dragon_converted_immediate':
                    push(`究極反転龍: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'dragon_destroyed_anchor_start':
                case 'dragon_destroyed_anchor_immediate':
                    push(`究極反転龍: 親石${_detailCount(ev)}個が消滅`);
                    break;
                case 'breeding_spawned_start':
                case 'breeding_spawned_immediate':
                    push(`繁殖石: ${_detailCount(ev)}個を生成`);
                    break;
                case 'breeding_flipped_start':
                case 'breeding_flipped_immediate':
                    push(`繁殖石: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'breeding_destroyed_anchor_start':
                    push(`繁殖石: 親石${_detailCount(ev)}個が消滅`);
                    break;
                case 'hyperactive_moved_start':
                case 'hyperactive_moved_immediate':
                    push(`${_hyperactiveLabel(ev, '多動石')}: ${_detailCount(ev)}回移動`);
                    break;
                case 'hyperactive_destroyed_start':
                case 'hyperactive_destroyed_immediate':
                    push(`${_hyperactiveLabel(ev, '多動石')}: ${_detailCount(ev)}個が消滅`);
                    break;
                case 'hyperactive_flipped_start':
                case 'hyperactive_flipped_immediate':
                    push(`${_hyperactiveLabel(ev, '多動石')}: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'extreme_hyperactive_repelled_start':
                case 'extreme_hyperactive_repelled_immediate':
                    push(`極悪多動魔: 隣接石を${_detailCount(ev)}個退避`);
                    break;
                case 'robot_vacuum_moved_start':
                case 'robot_vacuum_moved_immediate':
                    push(`ロボット掃除機石: ${_detailCount(ev)}回移動`);
                    break;
                case 'robot_vacuum_sucked_start':
                case 'robot_vacuum_sucked_immediate':
                    push(`ロボット掃除機石: ${_detailCount(ev)}個を吸い込み`);
                    break;
                case 'robot_vacuum_destroyed_start':
                case 'robot_vacuum_destroyed_immediate':
                    push(`ロボット掃除機石: ${_detailCount(ev)}個が消滅`);
                    break;
                case 'robot_vacuum_flipped_start':
                case 'robot_vacuum_flipped_immediate':
                    push(`ロボット掃除機石: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'ultimate_hyperactive_moved_start':
                case 'ultimate_hyperactive_moved_immediate':
                    push(`究極多動神: ${_detailCount(ev)}回移動`);
                    break;
                case 'ultimate_hyperactive_destroyed_start':
                case 'ultimate_hyperactive_destroyed_immediate':
                    push(`究極多動神: ${_detailCount(ev)}個が消滅`);
                    break;
                case 'ultimate_hyperactive_flipped_start':
                case 'ultimate_hyperactive_flipped_immediate':
                    push(`究極多動神: ${_detailCount(ev)}枚を反転`);
                    break;
                case 'regen_triggered_start':
                case 'regen_triggered':
                    push(`復活石: ${_detailCount(ev)}個が再生`);
                    break;
                case 'regen_capture_flipped_start':
                case 'regen_capture_flipped':
                    push(`復活石: 再生後に${_detailCount(ev)}枚を反転`);
                    break;
                case 'udg_destroyed_start':
                case 'udg_destroyed_immediate':
                    push(`究極破壊神: ${_detailCount(ev)}個を破壊`);
                    break;
                case 'udg_expired_start':
                case 'udg_expired_immediate':
                    push(`究極破壊神: 親石${_detailCount(ev)}個が消滅`);
                    break;
                case 'destroy_dragon_destroyed_start':
                case 'destroy_dragon_destroyed_immediate':
                    push(`破壊龍: ${_detailCount(ev)}個を破壊`);
                    break;
                case 'destroy_dragon_expired_start':
                case 'destroy_dragon_expired_immediate':
                    push(`破壊龍: 親石${_detailCount(ev)}個が消滅`);
                    break;
                case 'sniper_destroyed_start':
                case 'sniper_destroyed_immediate':
                    push(`狙撃石: ${_detailCount(ev)}個を破壊`);
                    break;
                case 'sniper_expired_start':
                case 'sniper_expired_immediate':
                    push(`狙撃石: 親石${_detailCount(ev)}個が消滅`);
                    break;
                case 'lightning_destroyed_start':
                case 'lightning_destroyed_immediate':
                    push(`落雷石: ${_detailCount(ev)}個を破壊`);
                    break;
                case 'lightning_expired_start':
                case 'lightning_expired_immediate':
                    push(`落雷石: 親石${_detailCount(ev)}個が消滅`);
                    break;
                case 'will_hunter_king_destroyed_start':
                case 'will_hunter_king_destroyed_immediate':
                    push(`意志狩りの王: ${_detailCount(ev)}個を斬撃破壊`);
                    break;
                case 'will_hunter_king_moved_start':
                case 'will_hunter_king_moved_immediate':
                    push(`意志狩りの王: ${_detailCount(ev)}回移動`);
                    break;
                case 'will_hunter_king_expired_start':
                case 'will_hunter_king_expired_immediate':
                    push(`意志狩りの王: 親石${_detailCount(ev)}個が消滅`);
                    break;
                case 'observer_triggered_start':
                case 'observer_triggered_immediate':
                    push(`盤理の観測者: 布石+${_detailGainedSum(ev)}`);
                    break;
                case 'observer_expired_start':
                case 'observer_expired_immediate':
                    push(`盤理の観測者: 親石${_detailCount(ev)}個が消滅`);
                    break;
                case 'destroy_selected':
                    if (ev.destroyed) push(`破壊神で${_toPosText(ev.target)}を破壊`);
                    break;
                case 'strong_wind_selected':
                    if (ev.applied) push(`強風で${_toPosText(ev.from)}→${_toPosText(ev.to)}に移動`);
                    break;
                case 'super_buoyancy_selected':
                    if (ev.applied) push(`超浮力で${_toPosText(ev.from)}→${_toPosText(ev.to)}に移動（破壊${Array.isArray(ev.destroyed) ? ev.destroyed.length : 0}）`);
                    break;
                case 'super_gravity_selected':
                    if (ev.applied) push(`超重力で${_toPosText(ev.from)}→${_toPosText(ev.to)}に移動（破壊${Array.isArray(ev.destroyed) ? ev.destroyed.length : 0}）`);
                    break;
                case 'teleport_selected':
                    if (ev.applied) {
                        if (ev.cardType === 'CELL_TELEPORT_WILL') {
                            push(`マステレポートで${_toPosText(ev.from)}→${_toPosText(ev.to)}へ移動し、元マスを穴化`);
                        } else {
                            push(`テレポートで${_toPosText(ev.from)}→${_toPosText(ev.to)}に移動`);
                        }
                    }
                    break;
                case 'sacrifice_selected':
                    if (ev.applied) push(`生贄で${_toPosText(ev.target)}を破壊（布石+${ev.gained || 0}）`);
                    break;
                case 'sell_selected':
                    if (ev.applied) push(`売却で+${ev.gained || 0}`);
                    break;
                case 'rebuild_will_resolved':
                    push(`再構築の意志: 手札${Number(ev.destroyedCount) || 0}枚を破壊し、${Number(ev.drawnCount) || 0}枚ドロー`);
                    break;
                case 'supply_will_resolved':
                    push(`補給の意志: ${Number(ev.drawnCount) || 0}枚ドロー`);
                    break;
                case 'corner_tribute_resolved':
                    push(`角の代償: 相手の布石を${Number(ev.stolen) || 0}奪取`);
                    break;
                case 'ribo_will_resolved':
                    push(`リボ払いの意志: 布石+${Number(ev.gained) || 0}、以後${Number(ev.remainingOwnerTurns) || 0}ターンは開始時に${Number(ev.repaymentAmount) || 0}返済`);
                    break;
                case 'ribo_will_repaid':
                    push(`リボ払いの意志: 布石-${Number(ev.repaid) || 0}返済（残り${Number(ev.remainingOwnerTurns) || 0}ターン）`);
                    break;
                case 'ribo_will_shortage':
                    push(`リボ払いの意志: 布石不足で自石${Number(ev.destroyedCount) || 0}個を破壊（残り${Number(ev.remainingOwnerTurns) || 0}ターン）`);
                    break;
                case 'gluttonous_will_hand_destroyed':
                    push(`悪食の意志: 手札${Number(ev.destroyedCount) || 0}枚を破壊`);
                    break;
                case 'loss_will_resolved':
                    push(`意志の喪失: 特殊石${Number(ev.removedCount) || 0}個を通常石に戻す`);
                    break;
                case 'corrosion_will_resolved':
                    push(`腐食の意志: 特殊石${Number(ev.affectedCount) || 0}個の持続ターンを半減`);
                    break;
                case 'heaven_blessing_selected':
                    if (ev.applied) push('天の恵みでカード獲得');
                    break;
                case 'condemn_selected':
                    if (ev.applied) push('断罪で相手カードを破壊');
                    break;
                case 'tempt_selected':
                    if (ev.applied) push('誘惑で特殊石を奪取');
                    break;
                case 'swap_selected':
                    if (ev.swapped) push(`交換で${_toPosText({ row: ev.row, col: ev.col })}を変換`);
                    break;
                case 'position_swap_first_selected':
                    if (ev.applied) push(`入替の意志: 1つ目に${_toPosText(ev.from || ev.target)}を選択`);
                    break;
                case 'position_swap_selected':
                    if (ev.applied && ev.completed) push(`入替の意志: ${_toPosText(ev.from)} と ${_toPosText(ev.to)} を入替`);
                    break;
                case 'trap_selected':
                    if (ev.applied) push('罠石がどこかに潜んでいる...');
                    break;
                case 'guard_selected':
                    if (ev.applied) push('守る意志で完全保護を付与');
                    break;
                case 'extend_life_selected':
                    if (ev.applied) push('延命の意志で持続を延長');
                    break;
                case 'time_bomb_selected':
                    if (ev.applied) push(`時限爆弾を${_toPosText(ev.target)}に設置`);
                    break;
                case 'clone_selected':
                    if (ev.applied) push(`複製の意志: ${_toPosText(ev.target)}から${_detailCount(ev)}個を生成`);
                    break;
                case 'split_selected':
                    if (ev.applied) push(`分裂の意志: ${_toPosText(ev.target)}から${_detailCount(ev)}個を生成（持続ターン半減）`);
                    break;
                case 'board_expansion_first_selected':
                    if (ev.applied) push(`盤面拡張神: 1つ目に${_toPosText(ev.target)}を選択`);
                    break;
                case 'board_expansion_selected':
                    if (ev.applied) {
                        if (ev.cardType === 'BOARD_EXPANSION_GOD') {
                            const addedCount = Array.isArray(ev.added) ? ev.added.length : 0;
                            push(`盤面拡張神: 2角から${addedCount || 6}マス拡張`);
                        } else {
                            const sideLabel = ev.side === 'left' ? '左' : (ev.side === 'right' ? '右' : '左右');
                            push(`盤面拡張: ${sideLabel}側へ1マス拡張`);
                        }
                    }
                    break;
                case 'blockade_selected':
                    if (ev.applied) push(`封鎖の意志: ${_toPosText(ev.target)}を3ターン封鎖`);
                    break;
                case 'meteor_selected':
                    if (ev.applied) push(`隕石: ${_toPosText(ev.target)}をマスごと破壊`);
                    break;
                case 'freeze_selected':
                    if (ev.applied) push(`凍結の意志: ${_toPosText(ev.target)}を5ターン凍結`);
                    break;
                case 'treasure_box_gain':
                    push(`宝箱: 布石+${Number(ev.gained) || 0}`);
                    break;
                case 'board_bonus_gain':
                    push(`数字マス${_toPosText(ev)}: 布石+${Number(ev.gained) || Number(ev.bonus) || 0}${Number(ev.multiplier) > 1 ? `（${Number(ev.multiplier)}倍）` : ''}`);
                    break;
                case 'trap_triggered': {
                    const details = Array.isArray(ev.details) ? ev.details : [];
                    if (details.length > 0) {
                        const destroyedHand = details.reduce((sum, d) => sum + (Number(d && (d.destroyedHandCount ?? d.stolenHandCount)) || 0), 0);
                        push(`罠石が発動: 布石最大20奪取 / 手札全破壊（${destroyedHand}枚）`);
                    }
                    break;
                }
                case 'trap_expired':
                    if (_detailCount(ev) > 0) push('罠石は不発で消滅');
                    break;
                case 'trap_disarmed':
                    if (_detailCount(ev) > 0) push('罠石は不発で解除');
                    break;
                case 'placement_effects':
                    if (ev.effects) {
                        const e = ev.effects;
                        if (e.doublePlaceActivated) push('二連投石: 追加手を獲得');
                        if (e.freePlacementUsed && !e.sniperPlaced) push('自由の意志:自由な空きマスに配置');
                        if (e.sniperPlaced) push('狙撃の意志: 狙撃石を設置');
                        if (e.lightningPlaced) push('落雷の意志: 落雷石を設置');
                        if (e.observerPlaced) push('盤理の観測者を設置');
                        if (e.willHunterKingPlaced) push('意志狩りの王を設置');
                        if (e.silverStoneUsed) push('銀石: 獲得布石3倍');
                        if (e.goldStoneUsed) push('金石: 獲得布石4倍');
                        if (e.rainbowStoneUsed) push('虹石: 獲得布石6倍');
                        if (e.crystalStoneUsed) push(_formatCrystalStonePlacementLog(e));
                        if (e.protected) push('反転保護を付与');
                        if (e.permaProtected) push('永続反転保護を付与');
                        if (e.bombPlaced) push('時限爆弾を設置');
                        if (e.dragonPlaced) push('究極反転龍を設置');
                        if (e.ultimateDestroyGodPlaced) push('究極破壊神を設置');
                        if (e.ultimateHyperactivePlaced) push('究極多動神を設置');
                        if (e.instantHyperactivePlaced) push('瞬間多動石を設置');
                        if (e.escapeHyperactivePlaced) push('逃亡石を設置');
                        if (e.extremeHyperactivePlaced) push('極悪多動魔を設置');
                        if (e.robotVacuumPlaced) push('ロボット掃除機石を設置');
                        if (e.gluttonousPlaced) push('悪食石を設置');
                        if (e.hyperactivePlaced && !e.instantHyperactivePlaced && !e.escapeHyperactivePlaced && !e.extremeHyperactivePlaced && !e.robotVacuumPlaced && !e.gluttonousPlaced) push('多動石を設置');
                        if (e.crossBombExploded) push(`十字爆弾: ${e.crossBombDestroyed || 0}個を爆破`);
                        if (e.xBombExploded) push(`クロス爆弾: ${e.xBombDestroyed || 0}個を爆破`);
                        if (e.plunderAmount > 0) push(`吸収の意志: 布石を${e.plunderAmount}吸収`);
                    }
                    break;
                case 'extra_place_consumed':
                    push('二連投石: 追加手を消費');
                    break;
                default:
                    break;
            }
        }

        const pres = Array.isArray(presEvents) ? presEvents : [];
        for (const ev of pres) {
            if (!ev) continue;
            const actorKey = _resolveEventActorKey(ev, playerKey);
            const push = (line) => {
                const msg = _withActorPrefix(line, actorKey);
                if (msg) logs.push(msg);
            };
            if (ev.type === 'WORK_INCOME') {
                const gained = Number.isFinite(ev.gained) ? ev.gained : ((ev.meta && Number.isFinite(ev.meta.gained)) ? ev.meta.gained : 0);
                push(`労働石: 布石 +${gained}`);
                continue;
            }
            if (ev.type === 'WORK_REMOVED') {
                push('労働石: 効果終了');
                continue;
            }
            if (!ev || ev.type !== 'STATUS_TICK' || !ev.meta) continue;
            const special = String(ev.meta.special || '');
            const timer = ev.meta.timer;
            const key = `${special}:${ev.row},${ev.col}:${timer}`;
            if (seenStatusTick.has(key)) continue;
            seenStatusTick.add(key);
            if (special === 'TIME_BOMB' && Number.isFinite(timer)) {
                push(`時限爆弾: ${_toPosText(ev)} のカウント ${timer}`);
            } else if (special && Number.isFinite(timer)) {
                push(`${_specialLabelJa(special)}: ${_toPosText(ev)} の残り ${timer}`);
            }
        }

        // De-duplicate only consecutive identical entries.
        const compact = [];
        for (const line of logs) {
            if (!line) continue;
            if (compact.length > 0 && compact[compact.length - 1] === line) continue;
            compact.push(line);
        }
        return compact;
    }

    function mapNormalLogsFromPipeline(rawEvents, playerKey) {
        const logs = [];
        const actor = _playerLabel(playerKey);
        const events = Array.isArray(rawEvents) ? rawEvents : [];

        for (const ev of events) {
            if (!ev || !ev.type) continue;
            if (ev.type === 'place') {
                const flipCount = Array.isArray(ev.flips) ? ev.flips.length : 0;
                if (flipCount > 0) logs.push(`${actor}が${flipCount}枚反転！`);
            }
        }

        const compact = [];
        for (const line of logs) {
            if (!line) continue;
            if (compact.length > 0 && compact[compact.length - 1] === line) continue;
            compact.push(line);
        }
        return compact;
    }

    /**
     * Minimal adapter to run a placement via TurnPipeline and return both state and PlaybackEvents.
     */
    function runTurnWithAdapter(cardState, gameState, playerKey, action, turnPipeline) {
        if (!turnPipeline) throw new Error('TurnPipeline not available');

        // Build options for applyTurnSafe: include current state version and previous action ids if ActionManager is available
        const options = { skipTurnStart: true };
        if (typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
            try {
                if (typeof ActionManager.ActionManager.getRecentActionIds === 'function') {
                    options.previousActionIds = ActionManager.ActionManager.getRecentActionIds(200);
                } else if (typeof ActionManager.ActionManager.getActions === 'function') {
                    options.previousActionIds = ActionManager.ActionManager.getActions().map(a => a.actionId).filter(Boolean);
                }
            } catch (e) { /* ignore */ }
        }
        if (cardState && typeof cardState.turnIndex === 'number') {
            options.currentStateVersion = cardState.turnIndex;
        }

        // Attempt to pass the current game PRNG (when available in browser env) to ensure deterministic rule logic
        const runtimePrng = (typeof getGamePrng === 'function') ? getGamePrng() : (typeof globalThis !== 'undefined' && typeof globalThis.getGamePrng === 'function') ? globalThis.getGamePrng() : undefined;
        const result = (typeof turnPipeline.applyTurnSafe === 'function')
            ? turnPipeline.applyTurnSafe(cardState, gameState, playerKey, action, runtimePrng, options)
            : turnPipeline.applyTurn(cardState, gameState, playerKey, action, runtimePrng, options);

        if (result.ok === false) {
            return { ok: false, rejectedReason: result.rejectedReason || 'UNKNOWN', events: result.events };
        }

        // Prefer pipeline-produced presentationEvents when available
        const pres = result.presentationEvents || result.cardState && result.cardState.presentationEvents || [];
        const rawPlacePlaybackEvents = [];
        for (const ev of Array.isArray(result.events) ? result.events : []) {
            if (!ev || ev.type !== 'place') continue;
            if (!Number.isInteger(ev.row) || !Number.isInteger(ev.col)) continue;
            const ownerKey = _normalizePlayerKey(ev.owner || ev.player || playerKey) || _normalizePlayerKey(playerKey) || 'black';
            rawPlacePlaybackEvents.push({
                type: 'place_hand_animation',
                phase: 0,
                rawType: ev.type,
                actionId: ev.actionId || null,
                turnIndex: (typeof ev.turnIndex === 'number')
                    ? ev.turnIndex
                    : (result.cardState && typeof result.cardState.turnIndex === 'number' ? result.cardState.turnIndex : 0),
                targets: [{ r: ev.row, col: ev.col, player: ownerKey, owner: ownerKey }]
            });
        }
        const playbackEvents = rawPlacePlaybackEvents.concat(mapToPlaybackEvents(pres, result.cardState, result.gameState));
        let playbackWithSound = appendSoundEffectPlaybackEvents(playbackEvents, result.events, pres);
        const deferredGeneratedThrowChainPlayback = _processGeneratedThrowChainPlayback(playbackWithSound, action, playerKey);
        playbackWithSound = deferredGeneratedThrowChainPlayback.playbackEvents;
        const effectLogMessages = mapEffectLogsFromPipeline(result.events, pres, playerKey);
        const normalLogMessages = mapNormalLogsFromPipeline(result.events, playerKey);
        try {
            if (typeof emitEffectLog === 'function') {
                for (const msg of effectLogMessages) emitEffectLog(msg);
            } else if (typeof emitLogAdded === 'function') {
                for (const msg of effectLogMessages) emitLogAdded(msg, 'effect');
            }
            if (typeof emitNormalLog === 'function') {
                for (const msg of normalLogMessages) emitNormalLog(msg);
            } else if (typeof emitLogAdded === 'function') {
                for (const msg of normalLogMessages) emitLogAdded(msg, 'normal');
            }
        } catch (e) { /* ignore */ }

        return {
            ok: true,
            nextCardState: result.cardState,
            nextGameState: result.gameState,
            playbackEvents: playbackWithSound,
            deferredGeneratedThrowChainHandAdd: deferredGeneratedThrowChainPlayback.deferredGeneratedThrowChainHandAdd,            rawEvents: result.events,
            presentationEvents: pres,
            effectLogMessages
        };
    }

    return {
        mapToPlaybackEvents,
        appendSoundEffectPlaybackEvents,
        mapEffectLogsFromPipeline,
        mapNormalLogsFromPipeline,
        clearDeferredGeneratedThrowChainPlayback,
        runTurnWithAdapter
    };
}));


