/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayRecordMetadataConfig = {
    isCorner?: (row: any, col: any, board?: any) => boolean;
    isEdge?: (row: any, col: any, board?: any) => boolean;
    countEmptiesInBoardKey?: (boardKey: any) => number;
    boardTargetKeys?: string[];
};

function fallbackCountEmptiesInBoardKey(boardKey: any) {
    if (typeof boardKey !== 'string' || !boardKey) return 0;
    let c = 0;
    for (let i = 0; i < boardKey.length; i++) if (boardKey[i] === '.') c++;
    return c;
}

function fallbackIsCorner(row: any, col: any) {
    const size = 8;
    return (row === 0 || row === size - 1) && (col === 0 || col === size - 1);
}

function fallbackIsEdge(row: any, col: any) {
    const size = 8;
    return row === 0 || row === size - 1 || col === 0 || col === size - 1;
}

export function createSelfplayRecordMetadata(config?: SelfplayRecordMetadataConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayRecordMetadataConfig;
    const isCorner = typeof cfg.isCorner === 'function' ? cfg.isCorner : fallbackIsCorner;
    const isEdge = typeof cfg.isEdge === 'function' ? cfg.isEdge : fallbackIsEdge;
    const countEmptiesInBoardKey = typeof cfg.countEmptiesInBoardKey === 'function'
        ? cfg.countEmptiesInBoardKey
        : fallbackCountEmptiesInBoardKey;
    const boardTargetKeys = Array.isArray(cfg.boardTargetKeys) && cfg.boardTargetKeys.length > 0
        ? cfg.boardTargetKeys.slice()
        : [
            'destroyTarget',
            'strongWindTarget',
            'buoyancyTarget',
            'superBuoyancyTarget',
            'gravityTarget',
            'superGravityTarget',
            'sacrificeTarget',
            'temptTarget',
            'captureTarget',
            'swapTarget',
            'positionSwapTarget',
            'guardTarget',
            'livingWillTarget',
            'extendTarget',
            'corrosionTarget',
            'bombTarget',
            'cloneTarget',
            'blockadeTarget',
            'meteorTarget',
            'causalReplayTarget',
            'freezeTarget',
            'seedTarget',
            'teleportTarget',
            'expansionTarget',
            'shrinkTarget',
            'trapTarget'
        ];

    function toFiniteStatNumber(value: any) {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    }

    function getDiscCountForPlayerFromRecord(rec: any, playerKey: any, phase: any) {
        if (!rec || !playerKey) return 0;
        const useAfter = phase === 'after';
        if (playerKey === 'black') {
            return useAfter
                ? toFiniteStatNumber(rec.blackCountAfter)
                : toFiniteStatNumber(rec.blackCountBefore);
        }
        return useAfter
            ? toFiniteStatNumber(rec.whiteCountAfter)
            : toFiniteStatNumber(rec.whiteCountBefore);
    }

    function getCornerCountForPlayerFromRecord(rec: any, playerKey: any, phase: any) {
        if (!rec || !playerKey) return 0;
        const useAfter = phase === 'after';
        const ownKey = useAfter ? 'ownCornersAfter' : 'ownCornersBefore';
        const oppKey = useAfter ? 'oppCornersAfter' : 'oppCornersBefore';
        return rec.player === playerKey
            ? toFiniteStatNumber(rec[ownKey])
            : toFiniteStatNumber(rec[oppKey]);
    }

    function annotateHorizonDecisionMetrics(gameRecords: any, horizonPlies: any) {
        if (!Array.isArray(gameRecords) || gameRecords.length <= 0) return;
        const horizon = Number.isFinite(horizonPlies)
            ? Math.max(1, Math.floor(horizonPlies))
            : 3;
        const lastIndex = gameRecords.length - 1;

        for (let i = 0; i < gameRecords.length; i++) {
            const rec = gameRecords[i];
            if (!rec || (rec.player !== 'black' && rec.player !== 'white')) continue;
            const actor = rec.player;
            const horizonIndex = Math.min(lastIndex, i + horizon);
            const horizonRec = gameRecords[horizonIndex] || rec;

            const ownDiscAfter = getDiscCountForPlayerFromRecord(rec, actor, 'after');
            const ownDiscAfterHorizon = getDiscCountForPlayerFromRecord(horizonRec, actor, 'after');
            const ownCornersAfterHorizon = getCornerCountForPlayerFromRecord(horizonRec, actor, 'after');

            let cornerHoldTurnsNext3Plies = 0;
            for (let j = i + 1; j <= horizonIndex; j++) {
                const futureRec = gameRecords[j];
                const ownCornersFuture = getCornerCountForPlayerFromRecord(futureRec, actor, 'after');
                if (ownCornersFuture > 0) cornerHoldTurnsNext3Plies += 1;
            }

            rec.futureDiscDelta3Ply = ownDiscAfterHorizon - ownDiscAfter;
            rec.ownCornersAfter3Ply = ownCornersAfterHorizon;
            rec.cornerHoldTurnsNext3Plies = cornerHoldTurnsNext3Plies;
            rec.horizonPliesUsed = horizonIndex - i;
        }
    }

    function classifySelectionSeat(row: any, col: any, board: any = null) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return 'unknown';
        if (isCorner(row, col, board)) return 'corner';
        if (isEdge(row, col, board)) return 'edge';
        return 'inner';
    }

    function cloneTargetCell(target: any) {
        if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return null;
        const cell: any = { row: target.row, col: target.col };
        if (typeof target.directionKey === 'string' && target.directionKey.trim()) {
            cell.directionKey = target.directionKey.trim();
        }
        if (typeof target.side === 'string' && target.side.trim()) {
            cell.side = target.side.trim();
        }
        if (Array.isArray(target.additions)) {
            cell.additions = target.additions
                .filter((one: any) => one && Number.isInteger(one.row) && Number.isInteger(one.col))
                .map((one: any) => ({ row: one.row, col: one.col }));
        }
        return cell;
    }

    function buildPendingSelectionRecord(action: any, pendingType: any, board: any = null) {
        if (!action || typeof action !== 'object' || action.type !== 'place') return null;

        for (const key of boardTargetKeys) {
            const cell = cloneTargetCell(action[key]);
            if (!cell) continue;
            const selection: any = {
                kind: 'board_cell',
                pendingType: pendingType || null,
                sourceKey: key,
                row: cell.row,
                col: cell.col
            };
            if (cell.directionKey) selection.directionKey = cell.directionKey;
            if (cell.side) selection.side = cell.side;
            if (Array.isArray(cell.additions)) selection.additions = cell.additions;
            if (board) selection.seat = classifySelectionSeat(cell.row, cell.col, board);
            return selection;
        }

        if (Number.isInteger(action.condemnTargetIndex)) {
            return {
                kind: 'hand_index',
                pendingType: pendingType || null,
                sourceKey: 'condemnTargetIndex',
                handIndex: action.condemnTargetIndex
            };
        }

        if (typeof action.heavenBlessingCardId === 'string' && action.heavenBlessingCardId.trim()) {
            return {
                kind: 'offer_card',
                pendingType: pendingType || null,
                sourceKey: 'heavenBlessingCardId',
                cardId: action.heavenBlessingCardId.trim()
            };
        }

        return null;
    }

    function buildPendingSelectionTrace(record: any) {
        if (!record || typeof record !== 'object') return null;
        const selection = record.pendingSelection;
        if (!selection || typeof selection !== 'object') return null;

        if (selection.kind === 'board_cell') {
            const trace: any = {
                kind: 'board_cell',
                pendingType: selection.pendingType || null,
                sourceKey: selection.sourceKey || null,
                row: Number.isFinite(selection.row) ? Number(selection.row) : null,
                col: Number.isFinite(selection.col) ? Number(selection.col) : null,
                seat: typeof selection.seat === 'string'
                    ? selection.seat
                    : classifySelectionSeat(selection.row, selection.col)
            };
            if (typeof selection.directionKey === 'string' && selection.directionKey) {
                trace.directionKey = selection.directionKey;
            }
            if (typeof selection.side === 'string' && selection.side) {
                trace.side = selection.side;
            }
            if (Array.isArray(selection.additions)) {
                trace.additions = selection.additions
                    .filter((one: any) => one && Number.isInteger(one.row) && Number.isInteger(one.col))
                    .map((one: any) => ({ row: one.row, col: one.col }));
            }
            return trace;
        }
        if (selection.kind === 'hand_index') {
            return {
                kind: 'hand_index',
                pendingType: selection.pendingType || null,
                sourceKey: selection.sourceKey || null,
                handIndex: Number.isFinite(selection.handIndex) ? Number(selection.handIndex) : null
            };
        }
        if (selection.kind === 'offer_card' || selection.kind === 'hand_card') {
            return {
                kind: selection.kind,
                pendingType: selection.pendingType || null,
                sourceKey: selection.sourceKey || null,
                cardId: selection.cardId || null
            };
        }
        return null;
    }

    function normalizeDecisionCandidate(candidate: any) {
        if (!candidate || typeof candidate !== 'object') return null;
        return {
            actionType: typeof candidate.actionType === 'string' ? candidate.actionType : null,
            decisionKind: typeof candidate.decisionKind === 'string' ? candidate.decisionKind : null,
            cardId: typeof candidate.cardId === 'string' ? candidate.cardId : null,
            cardType: typeof candidate.cardType === 'string' ? candidate.cardType : null,
            cardCost: Number.isFinite(candidate.cardCost) ? Number(candidate.cardCost) : null,
            score: Number.isFinite(candidate.score) ? Number(candidate.score) : null,
            policyScore: Number.isFinite(candidate.policyScore) ? Number(candidate.policyScore) : null,
            finalScore: Number.isFinite(candidate.finalScore) ? Number(candidate.finalScore) : null,
            committeeScore: Number.isFinite(candidate.committeeScore) ? Number(candidate.committeeScore) : null,
            committeeVotes: Number.isFinite(candidate.committeeVotes) ? Number(candidate.committeeVotes) : 0,
            minUseScore: Number.isFinite(candidate.minUseScore) ? Number(candidate.minUseScore) : null,
            shouldUse: typeof candidate.shouldUse === 'boolean' ? candidate.shouldUse : null,
            isSelected: candidate.isSelected === true
        };
    }

    function resolveCardDecisionKind(record: any, normalizedCandidates: any) {
        const selectedActionKey = typeof (record && record.selectedActionKey) === 'string'
            ? record.selectedActionKey.trim()
            : '';
        if (selectedActionKey.startsWith('use:')) return 'use';
        if (selectedActionKey.startsWith('destroy:')) return 'destroy';
        if (selectedActionKey === 'keep' || selectedActionKey.startsWith('keep:')) return 'keep';
        if (record && record.useCardId) return 'use';
        if (record && record.destroyCardId) return 'destroy';
        const selectedCandidate = Array.isArray(normalizedCandidates)
            ? normalizedCandidates.find((candidate: any) => candidate && candidate.isSelected && candidate.decisionKind)
            : null;
        if (selectedCandidate && selectedCandidate.decisionKind) return selectedCandidate.decisionKind;
        const firstCandidate = Array.isArray(normalizedCandidates)
            ? normalizedCandidates.find((candidate: any) => candidate && candidate.decisionKind)
            : null;
        if (firstCandidate && firstCandidate.decisionKind) return firstCandidate.decisionKind;
        const actionType = String(record && record.actionType ? record.actionType : '');
        if (actionType === 'use_card') return 'use';
        if (actionType === 'destroy_hand_card') return 'destroy';
        if (actionType === 'cancel_card') return 'keep';
        return null;
    }

    function buildCardSelectionTrace(record: any) {
        if (!record || typeof record !== 'object') return null;
        const candidates = Array.isArray(record.decisionCandidates)
            ? record.decisionCandidates.map((candidate: any) => normalizeDecisionCandidate(candidate)).filter(Boolean)
            : [];
        const decision = resolveCardDecisionKind(record, candidates);
        if (!decision) return null;
        const selectedCandidate = candidates.find((candidate: any) => candidate && candidate.isSelected) || null;
        const selectedCardId = (typeof record.useCardId === 'string' && record.useCardId)
            || (typeof record.destroyCardId === 'string' && record.destroyCardId)
            || (selectedCandidate && selectedCandidate.cardId)
            || null;
        const reasonTags = Array.isArray(record.decisionReasonTags)
            ? record.decisionReasonTags.map((tag: any) => String(tag || '').trim()).filter(Boolean)
            : [];
        const scoreSummary = record.decisionScoreSummary && typeof record.decisionScoreSummary === 'object'
            ? { ...record.decisionScoreSummary }
            : null;
        return {
            kind: 'card',
            decision,
            selectedCardId,
            selectedActionKey: typeof record.selectedActionKey === 'string' && record.selectedActionKey.trim()
                ? record.selectedActionKey.trim()
                : null,
            usableCardIds: Array.isArray(record.usableCardIds) ? record.usableCardIds.slice() : [],
            handCards: Array.isArray(record.handCards) ? record.handCards.slice() : [],
            reasonTags,
            scoreSummary,
            candidates,
            pendingSelection: buildPendingSelectionTrace(record)
        };
    }

    function buildSelectionTrace(record: any) {
        if (!record || typeof record !== 'object') return null;
        const cardTrace = buildCardSelectionTrace(record);
        if (cardTrace) return cardTrace;
        const actionType = String(record.actionType || '');
        if (actionType === 'place') {
            const topCandidates = Array.isArray(record.topPlacementCandidates)
                ? record.topPlacementCandidates.map((one: any) => ({
                    row: Number.isFinite(one && one.row) ? Number(one.row) : null,
                    col: Number.isFinite(one && one.col) ? Number(one.col) : null,
                    seat: String(one && one.seat ? one.seat : 'unknown'),
                    combinedScore: Number.isFinite(one && one.combinedScore) ? Number(one.combinedScore) : null,
                    tacticalScore: Number.isFinite(one && one.tacticalScore) ? Number(one.tacticalScore) : null,
                    heuristicScore: Number.isFinite(one && one.heuristicScore) ? Number(one.heuristicScore) : null,
                    policyScore: Number.isFinite(one && one.policyScore) ? Number(one.policyScore) : null,
                    committeeScore: Number.isFinite(one && one.committeeScore) ? Number(one.committeeScore) : null,
                    finalScore: Number.isFinite(one && one.finalScore) ? Number(one.finalScore) : null,
                    committeeVotes: Number.isFinite(one && one.committeeVotes) ? Number(one.committeeVotes) : 0
                }))
                : [];
            return {
                kind: 'place',
                selected: {
                    row: Number.isFinite(record.row) ? Number(record.row) : null,
                    col: Number.isFinite(record.col) ? Number(record.col) : null,
                    seat: typeof record.selectedSeat === 'string'
                        ? record.selectedSeat
                        : classifySelectionSeat(record.row, record.col),
                    selectedCompositeScore: Number.isFinite(record.selectedCompositeScore) ? Number(record.selectedCompositeScore) : null,
                    selectedTacticalScore: Number.isFinite(record.selectedTacticalScore) ? Number(record.selectedTacticalScore) : null,
                    selectedCommitteeScore: Number.isFinite(record.selectedCommitteeScore) ? Number(record.selectedCommitteeScore) : null,
                    selectedCommitteeVotes: Number.isFinite(record.selectedCommitteeVotes) ? Number(record.selectedCommitteeVotes) : 0,
                    selectedCellBonus: Number.isFinite(record.selectedCellBonus) ? Number(record.selectedCellBonus) : null
                },
                topCandidates,
                forcedPlacementCategory: record.forcedPlacementCategory || null,
                pendingSelection: buildPendingSelectionTrace(record)
            };
        }
        return {
            kind: 'other',
            actionType: actionType || null
        };
    }

    function getDeckStatsForPlayer(cardState: any, playerKey: any) {
        const decksByPlayer = cardState && cardState.decks && typeof cardState.decks === 'object'
            ? cardState.decks
            : null;
        const ownDeckCount = decksByPlayer && Array.isArray(decksByPlayer[playerKey])
            ? decksByPlayer[playerKey].length
            : ((cardState && Array.isArray(cardState.deck)) ? cardState.deck.length : 0);
        const initialDeckSizeByPlayer = cardState && cardState.initialDeckSizeByPlayer && typeof cardState.initialDeckSizeByPlayer === 'object'
            ? cardState.initialDeckSizeByPlayer
            : null;
        const initialDeckSize = initialDeckSizeByPlayer && Number.isFinite(initialDeckSizeByPlayer[playerKey])
            ? Number(initialDeckSizeByPlayer[playerKey])
            : ((cardState && Number.isFinite(cardState.initialDeckSize)) ? Number(cardState.initialDeckSize) : ownDeckCount);
        return {
            ownDeckCount,
            initialDeckSize
        };
    }

    function buildActorViewSnapshot(record: any) {
        if (!record || typeof record !== 'object') return null;
        return {
            board: record.board || '',
            player: record.player || null,
            pendingType: record.pendingType || null,
            legalMoves: Number.isFinite(record.legalMoves) ? Number(record.legalMoves) : 0,
            handCards: Array.isArray(record.handCards) ? record.handCards.slice() : [],
            usableCardIds: Array.isArray(record.usableCardIds) ? record.usableCardIds.slice() : [],
            handBlack: Number.isFinite(record.handBlack) ? Number(record.handBlack) : 0,
            handWhite: Number.isFinite(record.handWhite) ? Number(record.handWhite) : 0,
            chargeBlack: Number.isFinite(record.chargeBlack) ? Number(record.chargeBlack) : 0,
            chargeWhite: Number.isFinite(record.chargeWhite) ? Number(record.chargeWhite) : 0,
            deckCount: Number.isFinite(record.deckCount) ? Number(record.deckCount) : 0,
            ownDeckCount: Number.isFinite(record.ownDeckCount) ? Number(record.ownDeckCount) : 0,
            initialDeckSize: Number.isFinite(record.initialDeckSize) ? Number(record.initialDeckSize) : 0,
            discardCount: Number.isFinite(record.discardCount) ? Number(record.discardCount) : 0,
            blackCountBefore: Number.isFinite(record.blackCountBefore) ? Number(record.blackCountBefore) : 0,
            whiteCountBefore: Number.isFinite(record.whiteCountBefore) ? Number(record.whiteCountBefore) : 0,
            ownCornersBefore: Number.isFinite(record.ownCornersBefore) ? Number(record.ownCornersBefore) : 0,
            oppCornersBefore: Number.isFinite(record.oppCornersBefore) ? Number(record.oppCornersBefore) : 0,
            ownEdgesBefore: Number.isFinite(record.ownEdgesBefore) ? Number(record.ownEdgesBefore) : 0,
            oppEdgesBefore: Number.isFinite(record.oppEdgesBefore) ? Number(record.oppEdgesBefore) : 0,
            hasCornerMoveNow: record.hasCornerMoveNow ? 1 : 0,
            hasEdgeMoveNow: record.hasEdgeMoveNow ? 1 : 0,
            cornerEmergency: record.cornerEmergency ? 1 : 0,
            cornerHoldMode: record.cornerHoldMode ? 1 : 0,
            highBonusMoveAvailable: record.highBonusMoveAvailable ? 1 : 0,
            maxLegalMoveBonus: Number.isFinite(record.maxLegalMoveBonus) ? Number(record.maxLegalMoveBonus) : 0,
            selectedCellBonus: Number.isFinite(record.selectedCellBonus) ? Number(record.selectedCellBonus) : 0,
            pendingSelection: buildPendingSelectionTrace(record),
            selectionTrace: buildSelectionTrace(record)
        };
    }

    function computeHardcaseTags(record: any) {
        if (!record || typeof record !== 'object') return [];
        const tags: any[] = [];
        const pushUnique = (tag: any) => {
            const normalized = String(tag || '').trim();
            if (!normalized || tags.includes(normalized)) return;
            tags.push(normalized);
        };

        if (record.hasCornerMoveNow) pushUnique('corner_move_available');
        if (record.cornerEmergency) pushUnique('corner_emergency');
        if (Number(record.legalMoves || 0) <= 2) pushUnique('low_legal_moves');
        if (Array.isArray(record.handCards) && record.handCards.length >= 4) pushUnique('hand_pressure');
        if (record.pendingType) pushUnique('pending_target_selection');
        if (Number(record.futureDiscDelta3Ply || 0) < 0) pushUnique('negative_future_disc');
        if (Number(record.tacticalScoreMissRatio || 0) >= 0.08) pushUnique('tactical_miss_high');

        const edgeSwing = Math.abs(
            (Number(record.ownEdgesAfter || 0) - Number(record.ownEdgesBefore || 0)) -
            (Number(record.oppEdgesAfter || 0) - Number(record.oppEdgesBefore || 0))
        );
        if (edgeSwing >= 2) pushUnique('edge_balance_swing');

        const emptyCountBefore = (typeof record.board === 'string' && record.board)
            ? countEmptiesInBoardKey(record.board)
            : (64 - Number(record.blackCountBefore || 0) - Number(record.whiteCountBefore || 0));
        if (emptyCountBefore <= 40) pushUnique('endgame_mode');

        return tags;
    }

    function annotateSelfplayV2Metadata(gameRecords: any, options: any) {
        if (!Array.isArray(gameRecords) || gameRecords.length <= 0) return;
        const seedFamily = options && typeof options.seedFamily === 'string' && options.seedFamily.trim()
            ? options.seedFamily.trim()
            : 'train';
        const dataLane = options && typeof options.dataLane === 'string' && options.dataLane.trim()
            ? options.dataLane.trim()
            : 'selfplay-games';

        for (const rec of gameRecords) {
            if (!rec || typeof rec !== 'object') continue;
            rec.visibilityScope = 'actor';
            rec.seedFamily = seedFamily;
            rec.dataLane = dataLane;
            rec.actorView = buildActorViewSnapshot(rec);
            rec.hardcaseTags = computeHardcaseTags(rec);
            rec.isHardcase = rec.hardcaseTags.length > 0;
            rec.hardcasePrimaryTag = rec.hardcaseTags.length > 0 ? rec.hardcaseTags[0] : null;
        }
    }

    return {
        toFiniteStatNumber,
        getDiscCountForPlayerFromRecord,
        getCornerCountForPlayerFromRecord,
        annotateHorizonDecisionMetrics,
        classifySelectionSeat,
        cloneTargetCell,
        buildPendingSelectionRecord,
        buildPendingSelectionTrace,
        normalizeDecisionCandidate,
        resolveCardDecisionKind,
        buildCardSelectionTrace,
        buildSelectionTrace,
        getDeckStatsForPlayer,
        buildActorViewSnapshot,
        computeHardcaseTags,
        annotateSelfplayV2Metadata
    };
}
