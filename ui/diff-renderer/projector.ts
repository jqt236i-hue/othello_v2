declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

// PR1: debug-only perf benchmark helper (window.__DEV_PERF__ === true or ?perf=1).
// OFF path is zero-cost: every helper early-returns after the internal flag check.
let PerfBenchmarks: any = null;
if (typeof _require === 'function') {
    try { PerfBenchmarks = _require('../perf-benchmarks'); } catch (e: any) { /* ignore */ }
}
if (!PerfBenchmarks && typeof globalThis !== 'undefined') {
    try {
        const globalPerf = (globalThis as any).PerfBenchmarks;
        if (globalPerf) PerfBenchmarks = globalPerf;
    } catch (e: any) { /* ignore */ }
}

function getOwnerValueForDiff(owner: any, BLACK: any, WHITE: any): any {
    if (owner === 'black' || owner === BLACK || owner === 1) return BLACK;
    return WHITE;
}

function specialSupportsFlipEvadeForDiff(special: any): boolean {
    if (!special) return false;
    const type = String(special.type || '').toUpperCase();
    return (
        type === 'HYPERACTIVE' ||
        type === 'EXTREME_HYPERACTIVE' ||
        type === 'ESCAPE_HYPERACTIVE' ||
        type === 'ULTIMATE_HYPERACTIVE' ||
        type === 'WILL_HUNTER_KING' ||
        type === 'AFTERIMAGE_WILL'
    );
}

function createBoardRenderProjection(capabilities: any, operationCounters?: any) {
    const {
        state: stateCapabilities,
        hints: hintCapabilities,
        debug: debugCapabilities
    } = capabilities || {};
    const {
        resolveGameState,
        resolveCardState,
        getBoardShape,
        cardLogic: CardLogic,
        getPlayerKey,
        resolveViewerContext,
        canLocalPlayerControlCurrentTurn,
        constants: { BLACK, WHITE } = {}
    } = stateCapabilities || {};
    const {
        getExpansionDescriptors,
        buildBoardHintProjection
    } = hintCapabilities || {};
    const {
        isDebugHumanVsHuman,
        warn
    } = debugCapabilities || {};
    const gameState = resolveGameState();
    const cardState = resolveCardState();
    const boardShape = getBoardShape(gameState);
    const valid = !!(gameState && Array.isArray(gameState.board) && gameState.board.length > 0 && Array.isArray(gameState.board[0]));
    if (!valid) return Object.freeze({ valid: false, gameState, cardState, boardShape, hintProjection: {} });

    let cardContext: any;
    if (cardState && Array.isArray(cardState.markers)) {
        cardContext = CardLogic.getCardContext(cardState);
        if (operationCounters) operationCounters.cardContextBuilds = Number(operationCounters.cardContextBuilds || 0) + 1;
    } else {
        warn('[DiffRenderer] cardState missing or incomplete — using empty CardContext to continue rendering');
        cardContext = { protectedStones: [], permaProtectedStones: [], bombs: [] };
    }
    const player = gameState.currentPlayer;
    const playerKey = getPlayerKey(player);
    const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
    const viewerContext = resolveViewerContext();
    const canControlCurrentTurn = canLocalPlayerControlCurrentTurn();
    const isFateWillControlledTurn = !!(
        cardState &&
        cardState.fateWillControllerByTurnOwner &&
        cardState.fateWillControllerByTurnOwner[playerKey]
    );
    const isHumanTurn = viewerContext.isNetworkMode === true
        ? canControlCurrentTurn
        : ((gameState.currentPlayer === BLACK) ||
            (isDebugHumanVsHuman() && gameState.currentPlayer === WHITE) ||
            isFateWillControlledTurn);
    const expansions = getExpansionDescriptors(gameState);
    const hintProjection = buildBoardHintProjection(
        gameState,
        cardState,
        playerKey,
        boardShape,
        canControlCurrentTurn,
        isHumanTurn,
        expansions,
        cardContext,
        operationCounters
    ) || {};
    return Object.freeze({
        valid: true,
        gameState,
        cardState,
        boardShape,
        player,
        playerKey,
        pending,
        viewerContext,
        canControlCurrentTurn,
        isHumanTurn,
        expansions,
        cardContext,
        hintProjection
    });
}

function buildCurrentCellState(capabilities: any, preparedRenderProjection?: any) {
    if (PerfBenchmarks) PerfBenchmarks.perfStart('buildCurrentCellState');
    try {
        const {
            state: stateCapabilities,
            hints: hintCapabilities,
            markers: markerCapabilities,
            debug: debugCapabilities
        } = capabilities || {};
        const {
            resolveGameState: _resolveGameStateForDiffRender,
            resolveCardState: _resolveCardStateForDiffRender,
            getBoardShape: _getBoardShapeForDiff,
            buildEmptyCellState: _buildEmptyCellStateForDiffRender,
            cardLogic: CardLogic,
            getPlayerKey,
            resolveViewerContext: _resolveViewerContextForDiff,
            canLocalPlayerControlCurrentTurn: _canLocalPlayerControlCurrentTurnForDiff,
            constants: { BLACK, WHITE, EMPTY } = {}
        } = stateCapabilities || {};
        const {
            getExpansionDescriptors: _getExpansionDescriptorsForDiff,
            buildBoardHintProjection: _buildBoardHintProjectionForDiff,
            getActiveSuperAttractionPreview: _getActiveSuperAttractionPreviewForDiff,
            collectSuperAttractionPreviewKeys: _collectSuperAttractionPreviewKeys
        } = hintCapabilities || {};
        const {
            adapter: MarkersAdapter,
            isReversiMode: _isReversiModeForDiffRenderer,
            isBombCategory: _isBombCategoryMarkerForDiff,
            isBoardHiddenTrap: _isBoardHiddenTrap,
            isActiveManifestAura: _isActiveManifestAuraMarkerForDiff,
            isManifestStoneType: _isManifestStoneTypeForDiff,
            resolveSpecialDisplayTurns: _resolveSpecialDisplayTurnsForDiff,
            isFiniteTimedLabelValue: _isFiniteTimedLabelValueForDiff,
            resolveFlipEvadeDisplay: _resolveFlipEvadeDisplayForDiff,
            resolveDestroyEvadeDisplay: _resolveDestroyEvadeDisplayForDiff
        } = markerCapabilities || {};
        const {
            isDebugWorkVisuals,
            isDebugHumanVsHuman,
            warn,
            log: debugLog
        } = debugCapabilities || {};
    const renderProjection = preparedRenderProjection || createBoardRenderProjection(capabilities);
    const gameState = renderProjection.gameState;
    const cardState = renderProjection.cardState;
    const boardShape = renderProjection.boardShape;
    if (renderProjection.valid !== true) {
        return _buildEmptyCellStateForDiffRender(boardShape);
    }

    const player = renderProjection.player;
    const pending = renderProjection.pending;
    const freePlacementActive = !!(pending && (
        (typeof CardLogic !== 'undefined' &&
            CardLogic &&
            typeof CardLogic.isFreePlacementPendingType === 'function' &&
            CardLogic.isFreePlacementPendingType(pending.type)) ||
        pending.type === 'FREE_PLACEMENT' ||
        pending.type === 'SNIPER_WILL' ||
        pending.type === 'LAST_RESORT'
    ));
    const isTabooReversePending = !!(pending && pending.type === 'TABOO_REVERSE_WILL');
    const isHumanTurn = renderProjection.isHumanTurn;
    const expansions = renderProjection.expansions;
    const hintProjection = renderProjection.hintProjection || {};
    const selectableTargetSet = hintProjection.selectableTargetSet instanceof Set ? hintProjection.selectableTargetSet : new Set();
    const isExtendLifeSelection = !!(
        pending &&
        (pending.type === 'EXTEND_LIFE_WILL' || pending.type === 'EXTEND_LIFE_GOD') &&
        (pending.stage === 'selectTarget' || pending.stage == null)
    );
    const randomSpawnPreviewSet = hintProjection.randomSpawnPreviewSet instanceof Set ? hintProjection.randomSpawnPreviewSet : new Set();
    const showLegalHints = hintProjection.showLegalHints === true;
    const legalSet = hintProjection.legalSet instanceof Set ? hintProjection.legalSet : new Set();
    const tabooLegalSet = hintProjection.tabooLegalSet instanceof Set ? hintProjection.tabooLegalSet : new Set();
    if (isDebugWorkVisuals()) {
        debugLog('[DiffRenderer] legal hint cells:', legalSet.size, 'player:', player, 'taboo:', isTabooReversePending, 'tabooCells:', tabooLegalSet.size);
    }
    const selectedTargetHighlightSet = hintProjection.selectedTargetHighlightSet instanceof Set ? hintProjection.selectedTargetHighlightSet : new Set();
    const boardShrinkGodPreviewHighlightSet = hintProjection.boardShrinkGodPreviewHighlightSet instanceof Set ? hintProjection.boardShrinkGodPreviewHighlightSet : new Set();
    const superAttractionPreview = isHumanTurn
        ? _getActiveSuperAttractionPreviewForDiff(pending)
        : null;
    const superAttractionPreviewKeys = _collectSuperAttractionPreviewKeys(superAttractionPreview);

    // Build unified special/bomb maps from markers (primary)
    const markerKinds = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', MANIFEST_STONE: 'manifestStone', BOMB: 'bomb' };
    const specialMarkerKind = markerKinds.SPECIAL_STONE || 'specialStone';
    const manifestMarkerKind = markerKinds.MANIFEST_STONE || 'manifestStone';
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const suppressBoardBonus = _isReversiModeForDiffRenderer();
    const boardBonusByCell = (!suppressBoardBonus && cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
        ? cardState.boardBonusByCell
        : {};
    const boardBonusConsumedByCell = (!suppressBoardBonus && cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
        ? cardState.boardBonusConsumedByCell
        : {};
    const theoryNumberCellByCell = (!suppressBoardBonus && cardState && cardState.theoryNumberCellByCell && typeof cardState.theoryNumberCellByCell === 'object')
        ? cardState.theoryNumberCellByCell
        : {};
    const specialMap = new Map();
    const guardMap = new Map();
    const livingWillMap = new Map();
    const manifestAuraMap = new Map();
    const bombMap = new Map();
    const blockadeMap = new Map();
    const freezeMap = new Map();
    const seedMap = new Map();
    const poisonCellMap = new Map();
    const poisonedMap = new Map();
    const sproutMap = new Map();
    const markerVisualMap = new Map<string, any>();
    const setMarkerVisual = (row: any, col: any, field: string, value: any) => {
        const key = `${row},${col}`;
        let visual = markerVisualMap.get(key);
        if (!visual) {
            visual = {};
            markerVisualMap.set(key, visual);
        }
        visual[field] = value;
    };
    for (const m of markers) {
        if (_isBombCategoryMarkerForDiff(m) && m.data) {
            const bombVisual = {
                row: m.row,
                col: m.col,
                remainingTurns: m.data.remainingTurns,
                owner: m.owner
            };
            bombMap.set(`${m.row},${m.col}`, bombVisual);
            setMarkerVisual(m.row, m.col, 'bomb', bombVisual);
            continue;
        }
        if ((m.kind === specialMarkerKind || m.kind === manifestMarkerKind) && m.data && m.data.type) {
            if (_isBoardHiddenTrap(m)) continue;
            if (_isActiveManifestAuraMarkerForDiff(m, manifestMarkerKind, specialMarkerKind)) {
                const manifestAuraVisual = {
                    row: m.row,
                    col: m.col,
                    owner: m.owner
                };
                manifestAuraMap.set(`${m.row},${m.col}`, manifestAuraVisual);
                setMarkerVisual(m.row, m.col, 'manifestAura', manifestAuraVisual);
            }
            if (m.data.type === 'LIVING_WILL') {
                const livingWillVisual = {
                    row: m.row,
                    col: m.col,
                    owner: m.owner
                };
                livingWillMap.set(`${m.row},${m.col}`, livingWillVisual);
                setMarkerVisual(m.row, m.col, 'livingWill', livingWillVisual);
                continue;
            }
            if (m.data.type === 'BLOCKADE' || m.data.type === 'METEOR_HOLE') {
                const blockadeVisual = {
                    row: m.row,
                    col: m.col,
                    type: m.data.type,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns,
                    visualVariant: typeof m.data.visualVariant === 'string' ? m.data.visualVariant : null
                };
                blockadeMap.set(`${m.row},${m.col}`, blockadeVisual);
                setMarkerVisual(m.row, m.col, 'blockade', blockadeVisual);
                continue;
            }
            if (m.data.type === 'FREEZE') {
                const freezeVisual = {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                };
                freezeMap.set(`${m.row},${m.col}`, freezeVisual);
                setMarkerVisual(m.row, m.col, 'frozen', freezeVisual);
                continue;
            }
            if (m.data.type === 'SEED') {
                const seedVisual = {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                };
                seedMap.set(`${m.row},${m.col}`, seedVisual);
                setMarkerVisual(m.row, m.col, 'seed', seedVisual);
                continue;
            }
            if (m.data.type === 'POISON_CELL') {
                const visual = { row: m.row, col: m.col, remainingTurns: m.data.remainingTurns };
                poisonCellMap.set(`${m.row},${m.col}`, visual);
                setMarkerVisual(m.row, m.col, 'poisonCell', visual);
                continue;
            }
            if (m.data.type === 'POISONED') {
                const visual = { row: m.row, col: m.col, remainingTurns: m.data.remainingTurns };
                poisonedMap.set(`${m.row},${m.col}`, visual);
                setMarkerVisual(m.row, m.col, 'poisoned', visual);
                continue;
            }
            if (m.data.type === 'GUARD') {
                const guardVisual = {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                };
                guardMap.set(`${m.row},${m.col}`, guardVisual);
                setMarkerVisual(m.row, m.col, 'guard', guardVisual);
                continue;
            }
            const markerTypeUpper = String(m.data.type || '').toUpperCase();
            const isManifestType = _isManifestStoneTypeForDiff(markerTypeUpper);
            const isManifestKind = m.kind === manifestMarkerKind || m.kind === 'manifestStone';
            if (isManifestType && !isManifestKind) {
                continue;
            }
            const markerSupportsFlipEvade = (
                markerTypeUpper === 'HYPERACTIVE' ||
                markerTypeUpper === 'EXTREME_HYPERACTIVE' ||
                markerTypeUpper === 'ESCAPE_HYPERACTIVE' ||
                markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
                markerTypeUpper === 'WILL_HUNTER_KING' ||
                markerTypeUpper === 'AFTERIMAGE_WILL'
            );
            const specialVisual = {
                row: m.row,
                col: m.col,
                type: m.data.type,
                owner: m.owner,
                remainingOwnerTurns: isManifestType
                    ? m.data.remainingOwnerTurns
                    : _resolveSpecialDisplayTurnsForDiff(m.data),
                regenRemaining: (!isManifestType && (markerTypeUpper === 'REGEN' || markerTypeUpper === 'ZOMBIE') && _isFiniteTimedLabelValueForDiff(m.data.regenRemaining))
                    ? Math.max(0, Math.trunc(Number(m.data.regenRemaining)))
                    : null,
                destroyEvadeRemaining: (!isManifestType && (
                    markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
                    markerTypeUpper === 'EXTREME_HYPERACTIVE' ||
                    markerTypeUpper === 'WILL_HUNTER_KING' ||
                    markerTypeUpper === 'AFTERIMAGE_WILL'
                ))
                    ? (
                        _isFiniteTimedLabelValueForDiff(m.data.destroyEvadeRemaining)
                            ? Math.max(0, Math.trunc(Number(m.data.destroyEvadeRemaining)))
                            : (markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ? 2 : (markerTypeUpper === 'EXTREME_HYPERACTIVE' ? 5 : (markerTypeUpper === 'AFTERIMAGE_WILL' ? 3 : null)))
                    )
                    : null,
                flipEvadeRemaining: markerSupportsFlipEvade
                    ? (
                        _isFiniteTimedLabelValueForDiff(m.data.flipEvadeRemaining)
                            ? Math.max(0, Math.trunc(Number(m.data.flipEvadeRemaining)))
                            : (markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ? 5 : (markerTypeUpper === 'EXTREME_HYPERACTIVE' ? 5 : (markerTypeUpper === 'AFTERIMAGE_WILL' ? 3 : null)))
                    )
                    : 0
            };
            specialMap.set(`${m.row},${m.col}`, specialVisual);
            setMarkerVisual(m.row, m.col, 'special', specialVisual);
        }
    }
    try {
        const sproutByOwner = (cardState && cardState.breedingSproutByOwner && typeof cardState.breedingSproutByOwner === 'object')
            ? cardState.breedingSproutByOwner
            : { black: [], white: [] };
        const addSprout = (ownerKey: any, positions: any) => {
            const ownerVal = ownerKey === 'black' ? BLACK : WHITE;
            if (!Array.isArray(positions)) return;
            for (const p of positions) {
                if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col)) continue;
                if (p.row < 0 || p.row >= boardShape.rows || p.col < 0 || p.col >= boardShape.cols) continue;
                if (gameState.board[p.row][p.col] !== ownerVal) continue;
                sproutMap.set(`${p.row},${p.col}`, true);
            }
        };
        addSprout('black', sproutByOwner.black);
        addSprout('white', sproutByOwner.white);
    } catch (e: any) { /* ignore */ }

    const existingCellKeySet = new Set();
    for (let r = 0; r < boardShape.rows; r++) {
        for (let c = 0; c < boardShape.cols; c++) {
            existingCellKeySet.add(`${r},${c}`);
        }
    }
    for (const expansion of expansions) {
        if (!expansion || !Number.isInteger(expansion.row) || !Number.isInteger(expansion.col)) continue;
        existingCellKeySet.add(`${expansion.row},${expansion.col}`);
    }

    const holeKeySet = new Set();
    blockadeMap.forEach((blocked, key) => {
        if (String(blocked && blocked.type ? blocked.type : '').toUpperCase() === 'METEOR_HOLE') {
            holeKeySet.add(key);
        }
    });

    const playableKeySet = new Set(existingCellKeySet);
    for (const holeKey of holeKeySet) {
        playableKeySet.delete(holeKey);
    }

    const getBoardShrinkInnerBoundaryMask = (row: any, col: any, visualVariant: any) => {
        if (String(visualVariant || '').toUpperCase() !== 'BOARD_FRAME') return null;
        const edges = [];
        const neighbors = [
            ['top', row - 1, col],
            ['right', row, col + 1],
            ['bottom', row + 1, col],
            ['left', row, col - 1]
        ];
        for (const [edgeName, neighborRow, neighborCol] of neighbors) {
            const neighborKey = `${neighborRow},${neighborCol}`;
            if (!playableKeySet.has(neighborKey)) continue;
            edges.push(edgeName);
        }
        return edges.length ? edges.join(',') : null;
    };

    const state: any = [];
    for (let r = 0; r < boardShape.rows; r++) {
        state[r] = [];
        for (let c = 0; c < boardShape.cols; c++) {
            const key = r + ',' + c;
            const val = gameState.board[r][c];
            const markerVisual = markerVisualMap.get(key) || null;
            const blockade = markerVisual ? markerVisual.blockade || null : null;
            const frozen = markerVisual ? markerVisual.frozen || null : null;
            const seed = markerVisual ? markerVisual.seed || null : null;
            const poisonCell = markerVisual ? markerVisual.poisonCell || null : null;
            const poisoned = val !== EMPTY && markerVisual ? markerVisual.poisoned || null : null;
            const isLegal = showLegalHints && val === EMPTY && legalSet.has(key);
            const isTabooLegal = showLegalHints && val === EMPTY && tabooLegalSet.has(key);
            const isLegalFree = showLegalHints && val === EMPTY && freePlacementActive;
            const isRandomSpawnPreview = isHumanTurn && randomSpawnPreviewSet.has(key);
            const isSelectedTargetHighlighted = isHumanTurn && selectedTargetHighlightSet.has(key);
            const isSuperAttractionPathPreview = isHumanTurn && superAttractionPreviewKeys.pathKeys.has(key);
            const isSuperAttractionPreviewDestination = isHumanTurn && superAttractionPreviewKeys.destinationKeys.has(key);
            const isSelectableFriendly = isHumanTurn && (selectableTargetSet.has(key) || boardShrinkGodPreviewHighlightSet.has(key));
            const isExtendLifeTarget = isSelectableFriendly && isExtendLifeSelection;
            const bonusValueRaw = (val === EMPTY && !blockade && !frozen && !seed && boardBonusConsumedByCell[key] !== true)
                ? Number(boardBonusByCell[key] || 0)
                : 0;
            const boardBonus = Number.isFinite(bonusValueRaw) && bonusValueRaw > 0 ? bonusValueRaw : null;
            const theoryNumberCell = boardBonus !== null && !!theoryNumberCellByCell[key];

            // Get special stone at this position
            const special = val !== EMPTY && markerVisual ? markerVisual.special || null : null;
            const guard = val !== EMPTY && markerVisual ? markerVisual.guard || null : null;
            const livingWill = val !== EMPTY && markerVisual ? markerVisual.livingWill || null : null;
            const manifestAura = val !== EMPTY && markerVisual ? markerVisual.manifestAura || null : null;
            const bomb = val !== EMPTY && markerVisual ? markerVisual.bomb || null : null;
            const flipEvadeDisplay = special ? _resolveFlipEvadeDisplayForDiff(special) : 0;
            const destroyEvadeDisplay = special ? _resolveDestroyEvadeDisplayForDiff(special) : null;
            const specialSupportsFlipEvade = specialSupportsFlipEvadeForDiff(special);

            state[r][c] = {
                value: val,
                isLegal: isLegal && !isLegalFree,
                isLegalFree,
                isTabooLegal,
                isRandomSpawnPreview,
                isSelectedTargetHighlighted,
                isSuperAttractionPathPreview,
                isSuperAttractionPreviewDestination,
                isSelectableFriendly,
                isExtendLifeTarget,
                breedingSprout: (val !== EMPTY) && sproutMap.has(key),
                boardBonus,
                theoryNumberCell,
                // Unified special stone field
                special: special ? {
                    type: special.type,
                    owner: getOwnerValueForDiff(special.owner, BLACK, WHITE),
                    remainingOwnerTurns: special.remainingOwnerTurns,
                    regenRemaining: special.regenRemaining,
                    flipEvadeRemaining: specialSupportsFlipEvade ? flipEvadeDisplay : 0,
                    destroyEvadeRemaining: destroyEvadeDisplay
                } : null,
                livingWillAura: !!livingWill,
                manifestAura: manifestAura ? {
                    owner: getOwnerValueForDiff(manifestAura.owner, BLACK, WHITE)
                } : null,
                guard: guard ? {
                    owner: getOwnerValueForDiff(guard.owner, BLACK, WHITE),
                    remainingOwnerTurns: guard.remainingOwnerTurns
                } : null,
                bomb: bomb ? { remainingTurns: bomb.remainingTurns, owner: getOwnerValueForDiff(bomb.owner, BLACK, WHITE) } : null,
                blockade: blockade ? {
                    type: blockade.type,
                    owner: getOwnerValueForDiff(blockade.owner, BLACK, WHITE),
                    remainingOwnerTurns: blockade.remainingOwnerTurns,
                    visualVariant: blockade.visualVariant,
                    innerBoundaryMask: getBoardShrinkInnerBoundaryMask(r, c, blockade.visualVariant)
                } : null,
                frozen: frozen ? {
                    owner: getOwnerValueForDiff(frozen.owner, BLACK, WHITE),
                    remainingOwnerTurns: frozen.remainingOwnerTurns
                } : null,
                seed: seed ? {
                    owner: getOwnerValueForDiff(seed.owner, BLACK, WHITE),
                    remainingOwnerTurns: seed.remainingOwnerTurns
                } : null,
                poisonCell: poisonCell ? { remainingTurns: poisonCell.remainingTurns } : null,
                poisoned: poisoned ? { remainingTurns: poisoned.remainingTurns } : null,
                destroyEvadeRemaining: destroyEvadeDisplay
            };
        }
    }

    state._boardShape = boardShape;
    state._expansionCells = [];
    for (const expansion of expansions) {
        if (!expansion) continue;
        const expKey = `${expansion.row},${expansion.col}`;
        const expVal = expansion.owner;
        const isLegal = showLegalHints && expVal === EMPTY && legalSet.has(expKey);
        const isTabooLegal = showLegalHints && expVal === EMPTY && tabooLegalSet.has(expKey);
        const isLegalFree = showLegalHints && expVal === EMPTY && freePlacementActive;
        const isRandomSpawnPreview = isHumanTurn && randomSpawnPreviewSet.has(expKey);
        const isSelectedTargetHighlighted = isHumanTurn && selectedTargetHighlightSet.has(expKey);
        const isSuperAttractionPathPreview = isHumanTurn && superAttractionPreviewKeys.pathKeys.has(expKey);
        const isSuperAttractionPreviewDestination = isHumanTurn && superAttractionPreviewKeys.destinationKeys.has(expKey);
        const isSelectableFriendly = isHumanTurn && (selectableTargetSet.has(expKey) || boardShrinkGodPreviewHighlightSet.has(expKey));
        const isExtendLifeTarget = isSelectableFriendly && isExtendLifeSelection;
        const markerVisual = markerVisualMap.get(expKey) || null;
        const blockade = markerVisual ? markerVisual.blockade || null : null;
        const frozen = markerVisual ? markerVisual.frozen || null : null;
        const seed = markerVisual ? markerVisual.seed || null : null;
        const poisonCell = markerVisual ? markerVisual.poisonCell || null : null;
        const poisoned = expVal !== EMPTY && markerVisual ? markerVisual.poisoned || null : null;
        const special = expVal !== EMPTY && markerVisual ? markerVisual.special || null : null;
        const guard = expVal !== EMPTY && markerVisual ? markerVisual.guard || null : null;
        const livingWill = expVal !== EMPTY && markerVisual ? markerVisual.livingWill || null : null;
        const manifestAura = expVal !== EMPTY && markerVisual ? markerVisual.manifestAura || null : null;
        const bomb = expVal !== EMPTY && markerVisual ? markerVisual.bomb || null : null;
        const flipEvadeDisplay = special ? _resolveFlipEvadeDisplayForDiff(special) : 0;
        const destroyEvadeDisplay = special ? _resolveDestroyEvadeDisplayForDiff(special) : null;
        const specialSupportsFlipEvade = specialSupportsFlipEvadeForDiff(special);

        state._expansionCells.push({
            row: expansion.row,
            col: expansion.col,
            side: expansion.side,
            value: expVal,
            isLegal: isLegal && !isLegalFree,
            isLegalFree,
            isTabooLegal,
            isRandomSpawnPreview,
            isSelectedTargetHighlighted,
            isSuperAttractionPathPreview,
            isSuperAttractionPreviewDestination,
            isSelectableFriendly,
            isExtendLifeTarget,
            breedingSprout: false,
            boardBonus: null,
            theoryNumberCell: false,
            frozen: frozen ? {
                owner: getOwnerValueForDiff(frozen.owner, BLACK, WHITE),
                remainingOwnerTurns: frozen.remainingOwnerTurns
            } : null,
            seed: seed ? {
                owner: getOwnerValueForDiff(seed.owner, BLACK, WHITE),
                remainingOwnerTurns: seed.remainingOwnerTurns
            } : null,
            poisonCell: poisonCell ? { remainingTurns: poisonCell.remainingTurns } : null,
            poisoned: poisoned ? { remainingTurns: poisoned.remainingTurns } : null,
            special: special ? {
                type: special.type,
                owner: getOwnerValueForDiff(special.owner, BLACK, WHITE),
                remainingOwnerTurns: special.remainingOwnerTurns,
                regenRemaining: special.regenRemaining,
                flipEvadeRemaining: specialSupportsFlipEvade ? flipEvadeDisplay : 0,
                destroyEvadeRemaining: destroyEvadeDisplay
            } : null,
            livingWillAura: !!livingWill,
            manifestAura: manifestAura ? {
                owner: getOwnerValueForDiff(manifestAura.owner, BLACK, WHITE)
            } : null,
            guard: guard ? {
                owner: getOwnerValueForDiff(guard.owner, BLACK, WHITE),
                remainingOwnerTurns: guard.remainingOwnerTurns
            } : null,
            bomb: bomb ? { remainingTurns: bomb.remainingTurns, owner: getOwnerValueForDiff(bomb.owner, BLACK, WHITE) } : null,
            blockade: blockade ? {
                type: blockade.type,
                owner: getOwnerValueForDiff(blockade.owner, BLACK, WHITE),
                remainingOwnerTurns: blockade.remainingOwnerTurns,
                visualVariant: blockade.visualVariant,
                innerBoundaryMask: getBoardShrinkInnerBoundaryMask(expansion.row, expansion.col, blockade.visualVariant)
            } : null,
            destroyEvadeRemaining: destroyEvadeDisplay
        });
    }
        state._expansionCell = state._expansionCells.length > 0 ? state._expansionCells[0] : null;
        Object.defineProperty(state, '_renderProjection', {
            value: Object.freeze({
                ...renderProjection,
                markerMaps: Object.freeze({
                    specialMap,
                    guardMap,
                    livingWillMap,
                    manifestAuraMap,
                    bombMap,
                    blockadeMap,
                    freezeMap,
                    seedMap,
                    poisonCellMap,
                    poisonedMap,
                    sproutMap,
                    markerVisualMap
                })
            }),
            enumerable: false,
            configurable: true
        });
        return state;
    } finally {
        if (PerfBenchmarks) PerfBenchmarks.perfEnd('buildCurrentCellState');
    }
}

const DiffRendererProjector = {
  createBoardRenderProjection,
  buildCurrentCellState
};

export = DiffRendererProjector;
