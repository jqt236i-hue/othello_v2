import type { CardState, GameState, PlayerKey } from '../../../src/types';

(function (root: any, factory: any) {
    if (root && root.SharedConstants) {
        root.CardOwnershipEffects = factory(root.SharedConstants);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardOwnershipEffects = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants: any) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};

function unwrapMarkerEntry(markerEntry: any): any | null {
    if (!markerEntry || typeof markerEntry !== 'object') return null;
    if (markerEntry.marker && typeof markerEntry.marker === 'object') return markerEntry.marker;
    return markerEntry;
}

function normalizeMarkerType(marker: any): string {
    return String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
}

function findGhostMarkerAt(cardState: CardState, row: number, col: number, getSpecialMarkers: any): any | null {
    if (typeof getSpecialMarkers !== 'function') return null;
    const marker = getSpecialMarkers(cardState).find((entry: any) => (
        entry &&
        entry.row === row &&
        entry.col === col &&
        normalizeMarkerType(entry) === 'GHOST'
    ));
    return marker || null;
}

function transferCellMarkerOwnership(cardState: CardState, row: number, col: number, playerKey: PlayerKey, deps: any): Record<string, any> {
    const getMarkers = deps && deps.getMarkers;
    if (typeof getMarkers !== 'function') {
        return { transferred: false, hadWork: false, reason: 'deps_missing' };
    }

    const normalizedPlayerKey = playerKey === 'white' ? 'white' : 'black';
    const playerValue = normalizedPlayerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
    const markersAtCell = getMarkers(cardState).filter((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col
    ));
    let transferred = false;
    let hadWork = false;

    for (const marker of markersAtCell) {
        transferred = true;
        marker.owner = normalizedPlayerKey;
        const markerData = (marker.data && typeof marker.data === 'object') ? marker.data : null;
        if (!markerData) continue;
        if (String(markerData.type || '').toUpperCase() === 'WORK') {
            hadWork = true;
        }
        if (Object.prototype.hasOwnProperty.call(markerData, 'expiresForPlayer')) {
            markerData.expiresForPlayer = normalizedPlayerKey;
        }
        if (Object.prototype.hasOwnProperty.call(markerData, 'ownerColor')) {
            markerData.ownerColor = typeof markerData.ownerColor === 'number'
                ? playerValue
                : normalizedPlayerKey;
        }
    }

    return { transferred, hadWork };
}

function applyTemptWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const isTemptTargetableMarker = deps && deps.isTemptTargetableMarker;
    const blocksTemptAt = deps && deps.blocksTemptAt;
    const getCellValueForCard = deps && deps.getCellValueForCard;
    const getSpecialMarkers = deps && deps.getSpecialMarkers;
    const getMarkers = deps && deps.getMarkers;
    const isAbsoluteProtectedCell = deps && deps.isAbsoluteProtectedCell;
    const BoardOpsModule = deps && deps.BoardOpsModule;
    const setCellValueForCard = deps && deps.setCellValueForCard;
    const removeMarkersAt = deps && deps.removeMarkersAt;
    const emitPresentationEvent = deps && deps.emitPresentationEvent;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const MARKER_KINDS = deps && deps.MARKER_KINDS;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof isTemptTargetableMarker !== 'function' ||
        typeof blocksTemptAt !== 'function' ||
        typeof getCellValueForCard !== 'function' ||
        typeof getSpecialMarkers !== 'function' ||
        typeof getMarkers !== 'function' ||
        typeof removeMarkersAt !== 'function' ||
        typeof emitPresentationEvent !== 'function' ||
        typeof clearCardPendingEffect !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'TEMPT_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    if (getCellValueForCard(gameState, row, col) === EMPTY) return { applied: false, reason: 'empty' };
    if (typeof isAbsoluteProtectedCell === 'function' && isAbsoluteProtectedCell(cardState, row, col)) {
        return { applied: false, reason: 'absolute_protected' };
    }
    if (blocksTemptAt(cardState, row, col)) {
        return { applied: false, reason: 'guarded' };
    }
    const markersAtCell = getMarkers(cardState).filter((m: any) => m && m.row === row && m.col === col);
    const targetMarker = markersAtCell.find((m: any) => (
        m &&
        m.owner === opponentKey &&
        m.data &&
        isTemptTargetableMarker(m)
    )) || null;
    if (!targetMarker) {
        const hasOwnTargetable = markersAtCell.some((m: any) => m && m.owner !== opponentKey && isTemptTargetableMarker(m));
        return { applied: false, reason: hasOwnTargetable ? 'not_opponent_special' : 'not_special' };
    }

    if (BoardOpsModule && typeof BoardOpsModule.changeAt === 'function') {
        BoardOpsModule.changeAt(cardState, gameState, row, col, playerKey, 'TEMPT_WILL', 'tempt_applied');
    } else if (typeof setCellValueForCard === 'function') {
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        setCellValueForCard(gameState, row, col, playerVal);
    } else {
        return { applied: false, reason: 'deps_missing' };
    }

    const transferResult = transferCellMarkerOwnership(cardState, row, col, playerKey, deps);
    const wasWork = !!(transferResult && transferResult.hadWork);

    if (wasWork) {
        const cardStateAny = cardState as any;
        if (cardStateAny.workAnchorPosByPlayer && cardStateAny.workAnchorPosByPlayer[opponentKey]) {
            cardStateAny.workAnchorPosByPlayer[opponentKey] = null;
        }
        removeMarkersAt(cardState, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', type: 'WORK' });
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

    clearCardPendingEffect(cardState, playerKey);
    return { applied: true };
}

function applyCaptureWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const isTrueSpecialStoneAt = (deps && deps.isTrueSpecialStoneAt) || (deps && deps.isSpecialStoneAt);
    const getTrueSpecialStoneOwnerAt = (deps && deps.getTrueSpecialStoneOwnerAt) || (deps && deps.getSpecialOwnerAt);
    const getCellValueForCard = deps && deps.getCellValueForCard;
    const getSpecialMarkers = deps && deps.getSpecialMarkers;
    const isAbsoluteProtectedCell = deps && deps.isAbsoluteProtectedCell;
    const getTrueSpecialStoneMarkerAt = (deps && deps.getTrueSpecialStoneMarkerAt) || (deps && deps.getSpecialMarkerAt);
    const BoardOpsModule = deps && deps.BoardOpsModule;
    const resolveCaptureSourceInfo = deps && deps.resolveCaptureSourceInfo;
    const CardLivingWillModule = deps && deps.CardLivingWillModule;
    const addCardToHand = deps && deps.addCardToHand;
    const getStoneIdAtForCard = deps && deps.getStoneIdAtForCard;
    const clearStoneIdAtForCard = deps && deps.clearStoneIdAtForCard;
    const setCellValueForCard = deps && deps.setCellValueForCard;
    const removeMarkersAt = deps && deps.removeMarkersAt;
    const emitPresentationEvent = deps && deps.emitPresentationEvent;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;
    const getLivingWillModuleContext = deps && deps.getLivingWillModuleContext;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof isTrueSpecialStoneAt !== 'function' ||
        typeof getTrueSpecialStoneOwnerAt !== 'function' ||
        typeof getCellValueForCard !== 'function' ||
        typeof getSpecialMarkers !== 'function' ||
        typeof getTrueSpecialStoneMarkerAt !== 'function' ||
        typeof resolveCaptureSourceInfo !== 'function' ||
        typeof addCardToHand !== 'function' ||
        typeof getStoneIdAtForCard !== 'function' ||
        typeof clearStoneIdAtForCard !== 'function' ||
        typeof setCellValueForCard !== 'function' ||
        typeof removeMarkersAt !== 'function' ||
        typeof emitPresentationEvent !== 'function' ||
        typeof clearCardPendingEffect !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'CAPTURE_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const isOpponentTrueSpecial = isTrueSpecialStoneAt(cardState, row, col)
        && getTrueSpecialStoneOwnerAt(cardState, row, col) === opponentKey;
    const ghostMarker = findGhostMarkerAt(cardState, row, col, getSpecialMarkers);
    const isOpponentGhost = !!(ghostMarker && ghostMarker.owner === opponentKey);
    if (!isOpponentTrueSpecial && !isOpponentGhost) {
        if (isTrueSpecialStoneAt(cardState, row, col) || (ghostMarker && ghostMarker.owner !== opponentKey)) {
            return { applied: false, reason: 'not_opponent_special' };
        }
        return { applied: false, reason: 'not_special' };
    }
    if (getCellValueForCard(gameState, row, col) === EMPTY) return { applied: false, reason: 'empty' };
    const guarded = getSpecialMarkers(cardState).some((m: any) => (
        m &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === 'GUARD'
    ));
    if (guarded) return { applied: false, reason: 'guarded' };
    if (typeof isAbsoluteProtectedCell === 'function' && isAbsoluteProtectedCell(cardState, row, col)) {
        return { applied: false, reason: 'absolute_protected' };
    }

    const markerEntry = isOpponentGhost ? ghostMarker : getTrueSpecialStoneMarkerAt(cardState, row, col);
    const captureSource = resolveCaptureSourceInfo(markerEntry);
    if (!captureSource || !captureSource.sourceCardId) {
        return { applied: false, reason: 'missing_source_card' };
    }
    const livingWillMarker = CardLivingWillModule && typeof CardLivingWillModule.findLivingWillMarkerAt === 'function'
        ? CardLivingWillModule.findLivingWillMarkerAt(cardState, row, col)
        : null;

    const insertIndex = Number.isInteger(pending.sourceHandIndex)
        ? Math.max(0, pending.sourceHandIndex)
        : ((cardState && cardState.hands && Array.isArray(cardState.hands[playerKey])) ? cardState.hands[playerKey].length : 0);
    const added = !livingWillMarker
        ? addCardToHand(cardState, playerKey, captureSource.sourceCardId, {
            insertIndex,
            ignoreHandLimit: true
        })
        : null;
    if (!livingWillMarker && !added) return { applied: false, reason: 'hand_add_failed' };

    const stoneId = getStoneIdAtForCard(cardState, gameState, row, col);
    const targetValue = getCellValueForCard(gameState, row, col);
    const ownerBefore = targetValue === (BLACK || 1) ? 'black' : 'white';
    const markerRef = unwrapMarkerEntry(markerEntry);
    const wasWork = !!(markerRef && markerRef.data && markerRef.data.type === 'WORK');
    const removedSpecialType = captureSource.sourceSpecialType
        || (markerRef && markerRef.data && markerRef.data.type)
        || null;

    clearStoneIdAtForCard(cardState, gameState, row, col);
    setCellValueForCard(gameState, row, col, EMPTY);
    removeMarkersAt(cardState, row, col);

    if (!wasWork) {
        emitPresentationEvent(cardState, {
            type: 'STATUS_REMOVED',
            row,
            col,
            cause: 'CAPTURE_WILL',
            reason: 'captured_to_hand',
            meta: {
                special: removedSpecialType,
                owner: ownerBefore,
                reason: 'captured_to_hand'
            }
        });
    }

    if (wasWork) {
        const cardStateAny = cardState as any;
        if (cardStateAny.workAnchorPosByPlayer && cardStateAny.workAnchorPosByPlayer[opponentKey]) {
            cardStateAny.workAnchorPosByPlayer[opponentKey] = null;
        }
        emitPresentationEvent(cardState, {
            type: 'WORK_REMOVED',
            row,
            col,
            ownerBefore: opponentKey,
            ownerAfter: playerKey,
            cause: 'CAPTURE_WILL',
            reason: 'captured_to_hand',
            removed: true,
            meta: { reason: 'captured_to_hand' }
        });
    }

    if (livingWillMarker && CardLivingWillModule && typeof CardLivingWillModule.restoreFromLivingWillSnapshot === 'function') {
        const livingWillRestore = CardLivingWillModule.restoreFromLivingWillSnapshot(
            cardState,
            gameState,
            livingWillMarker,
            {
                triggerKind: 'capture',
                sourceRow: row,
                sourceCol: col,
                cause: 'CAPTURE_WILL',
                reason: 'captured_to_hand'
            },
            typeof getLivingWillModuleContext === 'function' ? getLivingWillModuleContext() : {}
        );
        clearCardPendingEffect(cardState, playerKey);
        return {
            applied: true,
            target: { row, col },
            livingWillRevived: !!(livingWillRestore && livingWillRestore.restored),
            sourceSpecialType: captureSource.sourceSpecialType || null,
            stoneId: stoneId || null
        };
    }

    emitPresentationEvent(cardState, {
        type: 'HAND_ADD',
        player: playerKey,
        cardId: captureSource.sourceCardId,
        count: 1,
        reason: 'capture_will',
        meta: {
            owner: playerKey,
            reason: 'capture_will',
            sourceType: captureSource.sourceCardType || null,
            sourceCardId: captureSource.sourceCardId,
            sourceName: captureSource.sourceCardName || null,
            sourceSpecialType: captureSource.sourceSpecialType || null,
            sourceRow: row,
            sourceCol: col,
            sourceOwner: ownerBefore,
            stoneId: stoneId || null,
            insertIndex: added.handIndex
        }
    });

    clearCardPendingEffect(cardState, playerKey);
    return {
        applied: true,
        target: { row, col },
        capturedCardId: captureSource.sourceCardId,
        capturedCardType: captureSource.sourceCardType || null,
        capturedCardName: captureSource.sourceCardName || null,
        sourceSpecialType: captureSource.sourceSpecialType || null,
        stoneId: stoneId || null,
        insertIndex: added.handIndex
    };
}

    return {
        applyTemptWill,
        transferCellMarkerOwnership,
        applyCaptureWill
    };
}));
