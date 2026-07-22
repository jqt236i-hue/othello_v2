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

const BoardVisualModel = _require('./model');

function cloneSemanticValue(value: any): any {
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) return value.map(cloneSemanticValue);
    if (typeof value !== 'object') return null;
    const result: Record<string, any> = {};
    for (const key of Object.keys(value).sort()) {
        const item = value[key];
        if (typeof item === 'function' || typeof item === 'symbol' || typeof item === 'undefined') continue;
        result[key] = cloneSemanticValue(item);
    }
    return result;
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
        normalizeViewerContext,
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
        boardViewerContext: typeof normalizeViewerContext === 'function'
            ? normalizeViewerContext(viewerContext)
            : (viewerContext === 'white' || viewerContext === 'spectator' ? viewerContext : 'black'),
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
    const expansionOwnerByKey = new Map<string, any>();
    for (const expansion of expansions) {
        if (!expansion || !Number.isInteger(expansion.row) || !Number.isInteger(expansion.col)) continue;
        expansionOwnerByKey.set(`${expansion.row},${expansion.col}`, expansion.owner);
    }
    const getBoardValueAt = (row: number, col: number) => {
        if (
            row >= 0 && row < boardShape.rows
            && col >= 0 && col < boardShape.cols
            && Array.isArray(gameState.board[row])
        ) {
            return gameState.board[row][col];
        }
        return expansionOwnerByKey.get(`${row},${col}`);
    };
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
                regenRemaining: (!isManifestType && _isFiniteTimedLabelValueForDiff(m.data.regenRemaining))
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
                            : (markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ? 2 : (markerTypeUpper === 'EXTREME_HYPERACTIVE' ? 5 : (markerTypeUpper === 'AFTERIMAGE_WILL' ? 6 : null)))
                    )
                    : null,
                flipEvadeRemaining: markerSupportsFlipEvade
                    ? (
                        _isFiniteTimedLabelValueForDiff(m.data.flipEvadeRemaining)
                            ? Math.max(0, Math.trunc(Number(m.data.flipEvadeRemaining)))
                            : (markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ? 5 : (markerTypeUpper === 'EXTREME_HYPERACTIVE' ? 5 : (markerTypeUpper === 'AFTERIMAGE_WILL' ? 6 : null)))
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
                if (getBoardValueAt(p.row, p.col) !== ownerVal) continue;
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
            breedingSprout: expVal !== EMPTY && sproutMap.has(expKey),
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

function normalizeExpansionSide(value: any): 'top' | 'right' | 'bottom' | 'left' | null {
    return value === 'top' || value === 'right' || value === 'bottom' || value === 'left' ? value : null;
}

function ownerName(value: any, black: any, white: any): 'black' | 'white' | null {
    if (value === 'black' || value === black || value === 1) return 'black';
    if (value === 'white' || value === white || value === 2 || value === -1) return 'white';
    return null;
}

function markerListFromLegacyState(cellState: any, black: any, white: any): any[] {
    const markers: any[] = [];
    const push = (kind: string, value: any) => {
        if (value == null || value === false) return;
        const cloned = cloneSemanticValue(value);
        const source = value && typeof value === 'object' ? value : null;
        markers.push({
            kind,
            owner: source ? ownerName(source.owner, black, white) : null,
            value: typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null,
            data: source ? cloned : { active: value === true }
        });
    };
    push('special', cellState.special);
    push('living-will-aura', cellState.livingWillAura);
    push('manifest-aura', cellState.manifestAura);
    push('guard', cellState.guard);
    push('bomb', cellState.bomb);
    push('blockade', cellState.blockade);
    push('frozen', cellState.frozen);
    push('seed', cellState.seed);
    push('poison-cell', cellState.poisonCell);
    push('poisoned', cellState.poisoned);
    push('breeding-sprout', cellState.breedingSprout);
    push('board-bonus', cellState.boardBonus);
    push('theory-number-cell', cellState.theoryNumberCell);
    return markers;
}

function buildBoardRenderModel(
    capabilities: any,
    preparedRenderProjection?: any,
    preparedCellState?: any,
    options?: { overlay?: unknown; visualRevision?: number }
) {
    const stateCapabilities = capabilities && capabilities.state ? capabilities.state : {};
    const projection = preparedRenderProjection || createBoardRenderProjection(capabilities);
    if (!projection || projection.valid !== true) {
        throw new Error('Cannot build a board render model without a valid visual state');
    }
    if (typeof stateCapabilities.buildBoardTopology !== 'function') {
        throw new Error('Board render model requires shared BoardTopology');
    }
    const legacyCellState = preparedCellState || buildCurrentCellState(capabilities, projection);
    const topology = stateCapabilities.buildBoardTopology(projection.gameState, {
        cardState: projection.cardState
    });
    const constants = stateCapabilities.constants || {};
    const expansionStates = new Map<string, any>();
    for (const cell of Array.isArray(legacyCellState._expansionCells) ? legacyCellState._expansionCells : []) {
        if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col)) {
            expansionStates.set(`${cell.row},${cell.col}`, cell);
        }
    }
    const markerMaps = legacyCellState._renderProjection && legacyCellState._renderProjection.markerMaps;
    const emptyValue = constants.EMPTY;
    const cells = topology.existingCoordinates.map((coord: any) => {
        const key = `${coord.row},${coord.col}`;
        let legacy = topology.baseKeys.has(key)
            && Array.isArray(legacyCellState[coord.row])
            ? legacyCellState[coord.row][coord.col]
            : expansionStates.get(key);
        if (!legacy) {
            const markerVisual = markerMaps && markerMaps.markerVisualMap instanceof Map
                ? markerMaps.markerVisualMap.get(key)
                : null;
            legacy = {
                value: emptyValue,
                blockade: markerVisual && markerVisual.blockade || null,
                frozen: markerVisual && markerVisual.frozen || null,
                seed: markerVisual && markerVisual.seed || null,
                poisonCell: markerVisual && markerVisual.poisonCell || null
            };
        }
        const hole = topology.holeKeys.has(key);
        const stoneOwner = hole ? null : ownerName(legacy.value, constants.BLACK, constants.WHITE);
        const boundary = topology.boundaryEdgesByKey.get(key) || {
            top: 'none', right: 'none', bottom: 'none', left: 'none'
        };
        const status = cloneSemanticValue({
            special: legacy.special || null,
            destroyEvadeRemaining: legacy.destroyEvadeRemaining ?? null,
            frozen: legacy.frozen || null,
            seed: legacy.seed || null,
            poisoned: legacy.poisoned || null
        });
        return {
            key,
            row: coord.row,
            col: coord.col,
            renderRow: coord.row + topology.renderRowOffset,
            renderCol: coord.col + topology.renderColOffset,
            kind: hole ? 'hole' as const : 'playable' as const,
            expansionSide: normalizeExpansionSide(topology.expansionSideByKey.get(key)),
            boundaryEdges: cloneSemanticValue(boundary),
            stone: stoneOwner ? {
                owner: stoneOwner,
                value: Number(legacy.value),
                specialType: legacy.special && legacy.special.type ? String(legacy.special.type) : null,
                status
            } : null,
            markers: markerListFromLegacyState(legacy, constants.BLACK, constants.WHITE),
            interaction: {
                legal: legacy.isLegal === true,
                legalFree: legacy.isLegalFree === true,
                tabooLegal: legacy.isTabooLegal === true,
                selectable: legacy.isSelectableFriendly === true || legacy.isExtendLifeTarget === true,
                interactionLocked: false,
                hovered: false,
                keyboardCursor: false,
                previewKinds: [],
                selected: false,
                selectionKinds: [
                    ...(legacy.isSelectableFriendly === true ? ['friendly'] : []),
                    ...(legacy.isExtendLifeTarget === true ? ['extend-life'] : [])
                ],
                directionHints: [],
                directionHintIds: [],
                localPendingHintIds: []
            }
        };
    });
    const model = BoardVisualModel.createBoardRenderModel({
        visualRevision: options && options.visualRevision,
        topology: {
            baseRows: topology.baseRows,
            baseCols: topology.baseCols,
            minRow: topology.renderBounds.minRow,
            maxRow: topology.renderBounds.maxRow,
            minCol: topology.renderBounds.minCol,
            maxCol: topology.renderBounds.maxCol,
            renderRowOffset: topology.renderRowOffset,
            renderColOffset: topology.renderColOffset,
            renderRows: topology.renderRows,
            renderCols: topology.renderCols,
            baseKeys: Array.from(topology.baseKeys),
            existingKeys: Array.from(topology.existingKeys),
            playableKeys: Array.from(topology.playableKeys),
            holeKeys: Array.from(topology.holeKeys)
        },
        cells,
        viewerContext: projection.boardViewerContext,
        currentPlayer: projection.playerKey === 'white' ? 'white' : 'black',
        canControlCurrentTurn: projection.canControlCurrentTurn === true,
        isHumanTurn: projection.isHumanTurn === true,
        overlay: options && options.overlay
    });
    return model;
}

function getSemanticMarker(cell: any, kind: string): any {
    const markers = cell && Array.isArray(cell.markers) ? cell.markers : [];
    return markers.find((marker: any) => marker && marker.kind === kind) || null;
}

function getSemanticMarkerData(cell: any, kind: string): any {
    const marker = getSemanticMarker(cell, kind);
    return marker && marker.data && typeof marker.data === 'object'
        ? cloneSemanticValue(marker.data)
        : null;
}

function createEmptyDomCompatibilityCellState(): any {
    return {
        value: 0,
        isLegal: false,
        isLegalFree: false,
        isTabooLegal: false,
        isRandomSpawnPreview: false,
        isSelectedTargetHighlighted: false,
        isSuperAttractionPathPreview: false,
        isSuperAttractionPreviewDestination: false,
        isSelectableFriendly: false,
        isExtendLifeTarget: false,
        isKeyboardCursor: false,
        breedingSprout: false,
        boardBonus: null,
        theoryNumberCell: false,
        special: null,
        livingWillAura: false,
        manifestAura: null,
        guard: null,
        bomb: null,
        blockade: null,
        frozen: null,
        seed: null,
        poisonCell: null,
        poisoned: null,
        destroyEvadeRemaining: null
    };
}

function createDomCompatibilityCellState(cell: any): any {
    const interaction = cell && cell.interaction ? cell.interaction : {};
    const previews = new Set(Array.isArray(interaction.previewKinds) ? interaction.previewKinds : []);
    const selectionKinds = new Set(Array.isArray(interaction.selectionKinds) ? interaction.selectionKinds : []);
    const markerValue = (kind: string) => {
        const marker = getSemanticMarker(cell, kind);
        return marker ? marker.value : null;
    };
    const special = cell && cell.stone ? getSemanticMarkerData(cell, 'special') : null;
    const blockade = getSemanticMarkerData(cell, 'blockade');
    const frozen = getSemanticMarkerData(cell, 'frozen');
    const seed = getSemanticMarkerData(cell, 'seed');
    const poisonCell = getSemanticMarkerData(cell, 'poison-cell');
    const poisoned = cell && cell.stone ? getSemanticMarkerData(cell, 'poisoned') : null;
    const stoneStatus = cell && cell.stone && cell.stone.status && typeof cell.stone.status === 'object'
        ? cell.stone.status
        : {};
    return {
        value: cell && cell.stone ? Number(cell.stone.value) : 0,
        isLegal: interaction.legal === true,
        isLegalFree: interaction.legalFree === true,
        isTabooLegal: interaction.tabooLegal === true,
        isRandomSpawnPreview: previews.has('random-spawn'),
        isSelectedTargetHighlighted: interaction.selected === true || previews.has('selected-target'),
        isSuperAttractionPathPreview: previews.has('super-attraction-path'),
        isSuperAttractionPreviewDestination: previews.has('super-attraction-destination'),
        isSelectableFriendly: interaction.selectable === true || selectionKinds.has('friendly'),
        isExtendLifeTarget: selectionKinds.has('extend-life'),
        isKeyboardCursor: interaction.keyboardCursor === true,
        breedingSprout: !!getSemanticMarker(cell, 'breeding-sprout'),
        boardBonus: markerValue('board-bonus'),
        theoryNumberCell: !!getSemanticMarker(cell, 'theory-number-cell'),
        special,
        livingWillAura: !!getSemanticMarker(cell, 'living-will-aura'),
        manifestAura: getSemanticMarkerData(cell, 'manifest-aura'),
        guard: getSemanticMarkerData(cell, 'guard'),
        bomb: getSemanticMarkerData(cell, 'bomb'),
        blockade: blockade || (cell && cell.kind === 'hole' ? {
            type: 'METEOR_HOLE',
            owner: 0,
            remainingOwnerTurns: null,
            visualVariant: null,
            innerBoundaryMask: null
        } : null),
        frozen,
        seed,
        poisonCell,
        poisoned,
        destroyEvadeRemaining: stoneStatus.destroyEvadeRemaining ?? null
    };
}

function isModelBaseCoordinate(model: any, cell: any): boolean {
    return !!(
        cell
        && Number.isInteger(cell.row)
        && Number.isInteger(cell.col)
        && cell.row >= 0
        && cell.row < model.topology.baseRows
        && cell.col >= 0
        && cell.col < model.topology.baseCols
        && cell.expansionSide == null
    );
}

function inferDomCompatibilityBaseShape(model: any): 'rectangle' | 'circle' {
    const rows = model.topology.baseRows;
    const cols = model.topology.baseCols;
    const baseKeys = new Set(model.topology.baseKeys || []);
    if (baseKeys.size === rows * cols) return 'rectangle';
    const centerRow = (rows - 1) / 2;
    const centerCol = (cols - 1) / 2;
    const radius = Math.min(rows, cols) / 2;
    const circleKeys = new Set<string>();
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const rowDistance = row - centerRow;
            const colDistance = col - centerCol;
            if ((rowDistance * rowDistance) + (colDistance * colDistance) <= radius * radius) {
                circleKeys.add(`${row},${col}`);
            }
        }
    }
    if (circleKeys.size === baseKeys.size && Array.from(circleKeys).every((key) => baseKeys.has(key))) {
        return 'circle';
    }
    // The compatibility renderer materializes the authoritative sparse model.
    // Rectangle is only the legacy geometry fallback for an unknown sparse base.
    return 'rectangle';
}

function createCompatibilityMarker(cell: any, marker: any): any {
    if (!marker || typeof marker !== 'object') return null;
    const data = marker.data && typeof marker.data === 'object' ? cloneSemanticValue(marker.data) : {};
    const owner = marker.owner || (data && data.owner) || (cell && cell.stone && cell.stone.owner) || null;
    const base = { row: cell.row, col: cell.col, owner, data };
    if (marker.kind === 'special') {
        const type = String(data.type || (cell.stone && cell.stone.specialType) || '');
        if (!type) return null;
        const manifest = type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL';
        return { ...base, kind: manifest ? 'manifestStone' : 'specialStone', data: { ...data, type } };
    }
    if (marker.kind === 'living-will-aura') return { ...base, kind: 'specialStone', data: { ...data, type: 'LIVING_WILL' } };
    if (marker.kind === 'guard') return { ...base, kind: 'specialStone', data: { ...data, type: 'GUARD' } };
    if (marker.kind === 'bomb') return { ...base, kind: 'specialStone', data: { ...data, type: 'TIME_BOMB', category: 'bomb' } };
    if (marker.kind === 'blockade') return { ...base, kind: 'specialStone', data: { ...data, type: data.type || 'BLOCKADE' } };
    if (marker.kind === 'frozen') return { ...base, kind: 'specialStone', data: { ...data, type: 'FREEZE' } };
    if (marker.kind === 'seed') return { ...base, kind: 'specialStone', data: { ...data, type: 'SEED' } };
    if (marker.kind === 'poison-cell') return { ...base, kind: 'specialStone', data: { ...data, type: 'POISON_CELL' } };
    if (marker.kind === 'poisoned') return { ...base, kind: 'specialStone', data: { ...data, type: 'POISONED' } };
    return null;
}

/**
 * Build the temporary shape expected by the isolated legacy DOM patcher.
 * The semantic sparse model is the only authority: no canonical state,
 * callback, DOM node, or private side payload is retained by the model.
 */
function buildDomCompatibilityRenderState(model: any): Readonly<{
    renderProjection: any;
    cellState: any;
}> {
    if (!model || !model.topology || !Array.isArray(model.cells)) {
        throw new Error('DOM compatibility rendering requires a BoardRenderModel');
    }
    const rows = Math.max(1, Math.trunc(Number(model.topology.baseRows) || 0));
    const cols = Math.max(1, Math.trunc(Number(model.topology.baseCols) || 0));
    const board = Array.from({ length: rows }, () => Array(cols).fill(0));
    const cellState: any = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => createEmptyDomCompatibilityCellState())
    );
    const expansionCells: any[] = [];
    const expansionDescriptors: any[] = [];
    const compatibilityMarkers: any[] = [];
    const boardBonusByCell: Record<string, number> = Object.create(null);
    const theoryNumberCellByCell: Record<string, boolean> = Object.create(null);
    const breedingSproutByOwner: Record<'black' | 'white', any[]> = { black: [], white: [] };

    for (const cell of model.cells) {
        const state = createDomCompatibilityCellState(cell);
        if (isModelBaseCoordinate(model, cell)) {
            board[cell.row][cell.col] = state.value;
            cellState[cell.row][cell.col] = state;
        } else {
            expansionCells.push({
                ...state,
                row: cell.row,
                col: cell.col,
                side: cell.expansionSide
            });
            if (cell.kind !== 'hole' || cell.expansionSide != null) {
                expansionDescriptors.push({
                    row: cell.row,
                    col: cell.col,
                    side: cell.expansionSide,
                    owner: state.value
                });
            }
        }
        if (Number.isFinite(Number(state.boardBonus)) && Number(state.boardBonus) > 0) {
            boardBonusByCell[cell.key] = Number(state.boardBonus);
        }
        if (state.theoryNumberCell) theoryNumberCellByCell[cell.key] = true;
        if (state.breedingSprout && cell.stone) {
            const ownerKey: 'black' | 'white' = cell.stone.owner === 'white' ? 'white' : 'black';
            breedingSproutByOwner[ownerKey].push({ row: cell.row, col: cell.col });
        }
        for (const marker of cell.markers) {
            const compatibilityMarker = createCompatibilityMarker(cell, marker);
            if (compatibilityMarker) compatibilityMarkers.push(compatibilityMarker);
        }
        if (cell.kind === 'hole' && !cell.markers.some((marker: any) => marker.kind === 'blockade')) {
            compatibilityMarkers.push({
                kind: 'specialStone',
                row: cell.row,
                col: cell.col,
                owner: null,
                data: { type: 'METEOR_HOLE' }
            });
        }
    }

    cellState._boardShape = { rows, cols };
    cellState._expansionCells = expansionCells;
    cellState._expansionCell = expansionCells.length > 0 ? expansionCells[0] : null;
    const shape = inferDomCompatibilityBaseShape(model);
    const boardExpansion = {
        active: expansionDescriptors.length > 0,
        cells: expansionDescriptors
    };
    const gameState = {
        currentPlayer: model.currentPlayer === 'white' ? -1 : 1,
        board,
        boardConfig: { rows, cols, shape },
        boardExpansion
    };
    const cardState = {
        markers: compatibilityMarkers,
        boardBonusByCell,
        boardBonusConsumedByCell: Object.create(null),
        theoryNumberCellByCell,
        breedingSproutByOwner,
        pendingEffectByPlayer: { black: null, white: null },
        fateWillControllerByTurnOwner: {}
    };
    const boardShrinkGodDirectionHintMap = new Map<string, string>();
    const boardShrinkWillDirectionHintMap = new Map<string, string>();
    const boardExpansionDirectionHintMap = new Map<string, string[]>();
    for (const cell of model.cells) {
        const hints = cell && cell.interaction && Array.isArray(cell.interaction.directionHints)
            ? cell.interaction.directionHints
            : [];
        for (const hint of hints) {
            const directionKey = String(hint && hint.directionKey || '').trim();
            if (!directionKey) continue;
            if (hint.kind === 'board-shrink-god') {
                boardShrinkGodDirectionHintMap.set(cell.key, directionKey);
            } else if (hint.kind === 'board-shrink-will') {
                boardShrinkWillDirectionHintMap.set(cell.key, directionKey);
            } else if (hint.kind === 'board-expansion-god' || hint.kind === 'board-expansion-will') {
                const directions = boardExpansionDirectionHintMap.get(cell.key) || [];
                if (!directions.includes(directionKey)) directions.push(directionKey);
                boardExpansionDirectionHintMap.set(cell.key, directions);
            }
        }
    }
    const renderProjection = Object.freeze({
        valid: true,
        gameState,
        cardState,
        boardShape: { rows, cols },
        player: gameState.currentPlayer,
        playerKey: gameState.currentPlayer === -1 ? 'white' : 'black',
        pending: null,
        viewerContext: model.viewerContext,
        canControlCurrentTurn: model.canControlCurrentTurn === true,
        isHumanTurn: model.isHumanTurn === true,
        expansions: boardExpansion.cells,
        cardContext: { protectedStones: [], permaProtectedStones: [], bombs: [] },
        hintProjection: {
            isSelectingTarget: model.cells.some((cell: any) => cell.interaction && cell.interaction.selectable === true),
            boardShrinkGodDirectionHintMap,
            boardShrinkWillDirectionHintMap,
            boardExpansionDirectionHintMap
        }
    });
    return Object.freeze({ renderProjection, cellState });
}

const BoardVisualModelBuilder = {
  createBoardRenderProjection,
  buildCurrentCellState,
  buildBoardRenderModel,
  buildDomCompatibilityRenderState
};

export = BoardVisualModelBuilder;
