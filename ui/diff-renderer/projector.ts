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

function buildCurrentCellState(deps: any) {
    const {
        _resolveGameStateForDiffRender,
        _resolveCardStateForDiffRender,
        _getBoardShapeForDiff,
        _buildEmptyCellStateForDiffRender,
        CardLogic,
        getPlayerKey,
        _resolveViewerContextForDiff,
        _canLocalPlayerControlCurrentTurnForDiff,
        BLACK,
        WHITE,
        EMPTY,
        _getExpansionDescriptorsForDiff,
        _buildBoardHintProjectionForDiff,
        _getActiveSuperAttractionPreviewForDiff,
        _collectSuperAttractionPreviewKeys,
        MarkersAdapter,
        _isReversiModeForDiffRenderer,
        _isBombCategoryMarkerForDiff,
        _isBoardHiddenTrap,
        _isActiveManifestAuraMarkerForDiff,
        _isManifestStoneTypeForDiff,
        _resolveSpecialDisplayTurnsForDiff,
        _isFiniteTimedLabelValueForDiff,
        _resolveFlipEvadeDisplayForDiff,
        _resolveDestroyEvadeDisplayForDiff,
        isDebugWorkVisuals,
        isDebugHumanVsHuman,
        warn,
        debugLog
    } = deps;
    const gameState = _resolveGameStateForDiffRender();
    const cardState = _resolveCardStateForDiffRender();
    const boardShape = _getBoardShapeForDiff(gameState);
    if (!gameState || !Array.isArray(gameState.board) || gameState.board.length <= 0 || !Array.isArray(gameState.board[0])) {
        return _buildEmptyCellStateForDiffRender(boardShape);
    }

    const player = gameState.currentPlayer;
    // Minimal, single-site guard: if cardState is missing or incomplete, use an empty context
    // to avoid throwing inside CardLogic.getCardContext during early-init race.
    let context: any;
    if (cardState && Array.isArray(cardState.markers)) {
        context = CardLogic.getCardContext(cardState);
    } else {
        warn('[DiffRenderer] cardState missing or incomplete — using empty CardContext to continue rendering');
        context = { protectedStones: [], permaProtectedStones: [], bombs: [] };
    }
    const playerKey = getPlayerKey(player);
    const pending = (cardState && cardState.pendingEffectByPlayer) ? cardState.pendingEffectByPlayer[playerKey] : null;
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
    const isNetworkMode = _resolveViewerContextForDiff().isNetworkMode === true;
    const canControlCurrentTurn = _canLocalPlayerControlCurrentTurnForDiff();
    const isFateWillControlledTurn = !!(
        cardState &&
        cardState.fateWillControllerByTurnOwner &&
        cardState.fateWillControllerByTurnOwner[playerKey]
    );
    const isHumanTurn = isNetworkMode
        ? canControlCurrentTurn
        : ((gameState.currentPlayer === BLACK) ||
            (isDebugHumanVsHuman() && gameState.currentPlayer === WHITE) ||
            isFateWillControlledTurn);
    const expansions = _getExpansionDescriptorsForDiff(gameState);
    const hintProjection = _buildBoardHintProjectionForDiff(
        gameState,
        cardState,
        playerKey,
        boardShape,
        canControlCurrentTurn,
        isHumanTurn,
        expansions
    ) || {};
    const selectableTargets = Array.isArray(hintProjection.selectableTargets) ? hintProjection.selectableTargets : [];
    const selectableTargetSet = hintProjection.selectableTargetSet instanceof Set ? hintProjection.selectableTargetSet : new Set();
    const isSelectingTarget = hintProjection.isSelectingTarget === true;
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
    const sproutMap = new Map();
    for (const m of markers) {
        if (_isBombCategoryMarkerForDiff(m) && m.data) {
            bombMap.set(`${m.row},${m.col}`, {
                row: m.row,
                col: m.col,
                remainingTurns: m.data.remainingTurns,
                owner: m.owner
            });
            continue;
        }
        if ((m.kind === specialMarkerKind || m.kind === manifestMarkerKind) && m.data && m.data.type) {
            if (_isBoardHiddenTrap(m)) continue;
            if (_isActiveManifestAuraMarkerForDiff(m, manifestMarkerKind, specialMarkerKind)) {
                manifestAuraMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner
                });
            }
            if (m.data.type === 'LIVING_WILL') {
                livingWillMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner
                });
                continue;
            }
            if (m.data.type === 'BLOCKADE' || m.data.type === 'METEOR_HOLE') {
                blockadeMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    type: m.data.type,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns,
                    visualVariant: typeof m.data.visualVariant === 'string' ? m.data.visualVariant : null
                });
                continue;
            }
            if (m.data.type === 'FREEZE') {
                freezeMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                });
                continue;
            }
            if (m.data.type === 'SEED') {
                seedMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                });
                continue;
            }
            if (m.data.type === 'GUARD') {
                guardMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                });
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
            specialMap.set(`${m.row},${m.col}`, {
                row: m.row,
                col: m.col,
                type: m.data.type,
                owner: m.owner,
                remainingOwnerTurns: isManifestType
                    ? m.data.remainingOwnerTurns
                    : _resolveSpecialDisplayTurnsForDiff(m.data),
                regenRemaining: (!isManifestType && markerTypeUpper === 'REGEN' && _isFiniteTimedLabelValueForDiff(m.data.regenRemaining))
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
            });
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
            const blockade = blockadeMap.get(key) || null;
            const frozen = freezeMap.get(key) || null;
            const seed = seedMap.get(key) || null;
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
            const special = val !== EMPTY ? specialMap.get(key) : null;
            const guard = val !== EMPTY ? guardMap.get(key) : null;
            const livingWill = val !== EMPTY ? livingWillMap.get(key) : null;
            const manifestAura = val !== EMPTY ? manifestAuraMap.get(key) : null;
            const bomb = val !== EMPTY ? bombMap.get(key) : null;
            const flipEvadeDisplay = _resolveFlipEvadeDisplayForDiff(special);
            const destroyEvadeDisplay = _resolveDestroyEvadeDisplayForDiff(special);
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
        const blockade = blockadeMap.get(expKey) || null;
        const frozen = freezeMap.get(expKey) || null;
        const seed = seedMap.get(expKey) || null;
        const special = expVal !== EMPTY ? specialMap.get(expKey) : null;
        const guard = expVal !== EMPTY ? guardMap.get(expKey) : null;
        const livingWill = expVal !== EMPTY ? livingWillMap.get(expKey) : null;
        const manifestAura = expVal !== EMPTY ? manifestAuraMap.get(expKey) : null;
        const bomb = expVal !== EMPTY ? bombMap.get(expKey) : null;
        const flipEvadeDisplay = _resolveFlipEvadeDisplayForDiff(special);
        const destroyEvadeDisplay = _resolveDestroyEvadeDisplayForDiff(special);
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
    return state;
}

const DiffRendererProjector = {
  buildCurrentCellState
};

export = DiffRendererProjector;
