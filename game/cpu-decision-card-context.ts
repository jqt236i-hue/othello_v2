const MovementCornerSwing = require('./cpu-decision-movement-corner-swing');
const TemptValue = require('./cpu-decision-tempt-value');
import {
    measureCpuTurnSync,
    type CpuTurnPerformanceScope
} from './cpu-turn-performance';

type CardUsabilityAnalysisLike = Readonly<{
    usableCardIds: readonly string[];
    usableCardTypes?: readonly string[];
    selectorEvidence?: Readonly<Record<string, Readonly<{
        lane?: string;
        method?: string;
        cardState?: any;
        gameState?: any;
        playerKey?: any;
        cardType?: any;
        args?: readonly any[];
        available?: boolean;
        result?: any;
        resolver?: any;
    }>>>;
    usableSlots?: readonly Readonly<{
        cardId?: string;
        cardType?: string;
        handIndex?: number;
        cardCopyId?: number | null;
    }>[];
}>;

type CpuDecisionCardContextConfig = {
    getGameState: () => any;
    getCardState: () => any;
    getCardLogic?: () => any;
    resolvePlayerValue: (playerKey: any) => any;
    getShapeAwareBoard: (board: any, gameState: any, cardState: any) => any;
    countBoardStatsForPlayer: (playerValue: any) => any;
    countCornerControl: (board: any, playerValue: any) => any;
    countEdgeControl: (board: any, playerValue: any) => any;
    buildCornerPlanState: (playerKey: any, legalMoves?: any, usableCardIds?: any) => any;
    getBoardBonusValueAt: (row: any, col: any) => any;
    getBoardCellValueSafe: (board: any, row: any, col: any) => any;
    getCpuPolicyCore: () => any;
    getDeckMetricsForPlayer: (playerKey: any) => any;
    getHandCardIdsForPlayer: (playerKey: any) => any;
    isCornerCell: (row: any, col: any, board?: any) => any;
    isEdgeCell: (row: any, col: any, board?: any) => any;
    resolvePendingType: (playerKey: any) => any;
};

export function createCpuDecisionCardContext(config: CpuDecisionCardContextConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionCardContextConfig;

    function readGameState(): any {
        return cfg.getGameState ? cfg.getGameState() : null;
    }

    function readCardState(): any {
        return cfg.getCardState ? cfg.getCardState() : null;
    }

    function readCardLogic(): any {
        return cfg.getCardLogic ? cfg.getCardLogic() : null;
    }

    function normalizeUsabilityAnalysis(value: any): CardUsabilityAnalysisLike {
        const cardLogic = readCardLogic();
        const usableCardIds = Array.isArray(value && value.usableCardIds)
            ? value.usableCardIds.slice()
            : (Array.isArray(value) ? value.slice() : []);
        const suppliedTypes = Array.isArray(value && value.usableCardTypes)
            ? value.usableCardTypes.slice()
            : null;
        const usableCardTypes = suppliedTypes || usableCardIds.map((cardId: any) => {
            const def = cardLogic && typeof cardLogic.getCardDef === 'function'
                ? cardLogic.getCardDef(cardId)
                : null;
            return String(def && def.type || '');
        });
        return {
            usableCardIds: Object.freeze(usableCardIds),
            usableCardTypes: Object.freeze(usableCardTypes),
            selectorEvidence: value && value.selectorEvidence && typeof value.selectorEvidence === 'object'
                ? value.selectorEvidence
                : Object.freeze({}),
            usableSlots: Array.isArray(value && value.usableSlots)
                ? value.usableSlots.slice()
                : undefined
        };
    }

    function readPublicSelectorEvidence(
        analysis: CardUsabilityAnalysisLike,
        method: string,
        args: any[],
        acceptedCardTypes: ReadonlySet<string>
    ): { found: boolean; result: any } {
        const evidence = analysis && analysis.selectorEvidence;
        if (!evidence || typeof evidence !== 'object') return { found: false, result: null };
        const cs = readCardState();
        const gs = readGameState();
        const cardLogic = readCardLogic();
        const expectedResolver = cardLogic && cardLogic[method];
        const usableSlots: readonly any[] = Array.isArray(analysis && analysis.usableSlots)
            ? analysis.usableSlots as readonly any[]
            : [];
        for (const entry of Object.values(evidence)) {
            if (!entry || entry.lane !== 'public' || entry.method !== method || entry.available !== true) continue;
            if (entry.cardState !== cs || entry.gameState !== gs) continue;
            if (typeof expectedResolver === 'function' && entry.resolver !== expectedResolver) continue;
            if (!acceptedCardTypes.has(String(entry.cardType || ''))) continue;
            if (usableSlots.length > 0 && !usableSlots.some((slot: any) => (
                slot
                && slot.handIndex === (entry as any).handIndex
                && slot.cardCopyId === (entry as any).cardCopyId
                && slot.cardId === (entry as any).cardId
                && slot.cardType === entry.cardType
            ))) continue;
            const entryArgs = Array.isArray(entry.args) ? entry.args : [];
            if (entryArgs.length !== args.length) continue;
            if (!entryArgs.every((value: any, index: number) => Object.is(value, args[index]))) continue;
            return {
                found: true,
                result: Array.isArray(entry.result) ? entry.result.slice() : entry.result
            };
        }
        return { found: false, result: null };
    }

    function getEvidenceAwareTargets(
        analysis: CardUsabilityAnalysisLike,
        method: string,
        args: any[],
        acceptedCardTypes: ReadonlySet<string>
    ): any[] {
        const cached = readPublicSelectorEvidence(analysis, method, args, acceptedCardTypes);
        if (cached.found) return Array.isArray(cached.result) ? cached.result : [];
        const cardLogic = readCardLogic();
        if (!cardLogic || typeof cardLogic[method] !== 'function') return [];
        const result = cardLogic[method].apply(cardLogic, args);
        return Array.isArray(result) ? result : [];
    }

    function isEnemyOccupiedCornerTarget(board: any, playerValue: any, target: any): boolean {
        if (!target) return false;
        const row = Number(target.row);
        const col = Number(target.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (typeof cfg.isCornerCell !== 'function' || !cfg.isCornerCell(row, col, board)) return false;
        return cfg.getBoardCellValueSafe(board, row, col) === -playerValue;
    }

    function countEnemyOccupiedCornerTargets(board: any, playerValue: any, targets: any): number {
        if (!Array.isArray(targets)) return 0;
        let count = 0;
        for (const target of targets) {
            if (isEnemyOccupiedCornerTarget(board, playerValue, target)) count += 1;
        }
        return count;
    }

    function getBoardExpansionEnemyCornerTargetCounts(
        playerKey: any,
        board: any,
        playerValue: any,
        analysis: CardUsabilityAnalysisLike,
        usableTypes: ReadonlySet<string>
    ) {
        const cs = readCardState();
        const gs = readGameState();
        const willTargets = usableTypes.has('BOARD_EXPANSION_WILL')
            ? getEvidenceAwareTargets(
                analysis,
                'getBoardExpansionTargets',
                [cs, gs, playerKey],
                new Set(['BOARD_EXPANSION_WILL'])
            )
            : [];
        const godTargets = usableTypes.has('BOARD_EXPANSION_GOD')
            ? getEvidenceAwareTargets(
                analysis,
                'getBoardExpansionGodTargets',
                [cs, gs, playerKey],
                new Set(['BOARD_EXPANSION_GOD'])
            )
            : [];
        const will = countEnemyOccupiedCornerTargets(board, playerValue, willTargets);
        const god = countEnemyOccupiedCornerTargets(board, playerValue, godTargets);
        return {
            boardExpansionWillEnemyCornerTargetCount: will,
            boardExpansionGodEnemyCornerTargetCount: god,
            boardExpansionEnemyCornerTargetCount: Math.max(will, god)
        };
    }

    function getSwapEnemyNormalCornerTargetCount(
        playerKey: any,
        board: any,
        playerValue: any,
        analysis: CardUsabilityAnalysisLike
    ): number {
        const targets = getEvidenceAwareTargets(
            analysis,
            'getSwapTargets',
            [readCardState(), readGameState(), playerKey],
            new Set(['SWAP_WITH_ENEMY'])
        );
        return countEnemyOccupiedCornerTargets(board, playerValue, targets);
    }

    function getTemptHighValueTargetCount(playerKey: any, analysis: CardUsabilityAnalysisLike): number {
        const cardLogic = readCardLogic();
        if (!cardLogic) return 0;
        const targets = getEvidenceAwareTargets(
            analysis,
            'getTemptWillTargets',
            [readCardState(), readGameState(), playerKey],
            new Set(['TEMPT_WILL'])
        );
        return TemptValue && typeof TemptValue.countHighValueTemptTargetsForCpu === 'function'
            ? TemptValue.countHighValueTemptTargetsForCpu(playerKey, targets, {
                cardLogic,
                cardState: readCardState(),
                minSourceCost: TemptValue.CPU_TEMPT_MIN_SOURCE_COST
            })
            : 0;
    }

    function getMovementCornerSwingTargetCounts(
        playerKey: any,
        board: any,
        playerValue: any,
        analysis: CardUsabilityAnalysisLike,
        movementTypes: readonly string[]
    ): any {
        if (!MovementCornerSwing || typeof MovementCornerSwing.getMovementCornerSwingTargetCounts !== 'function') {
            return {};
        }
        const cardLogic = readCardLogic();
        const cs = readCardState();
        const gs = readGameState();
        const evidenceAwareCardLogic = cardLogic ? { ...cardLogic } : null;
        const methodByType: Record<string, string> = {
            BUOYANCY_WILL: 'getBuoyancyTargets',
            GRAVITY_WILL: 'getGravityTargets',
            SUPER_BUOYANCY_WILL: 'getSuperBuoyancyTargets',
            SUPER_GRAVITY_WILL: 'getSuperGravityTargets',
            SUPER_ATTRACTION_WILL: 'getSuperAttractionTargets'
        };
        if (evidenceAwareCardLogic) {
            for (const cardType of movementTypes) {
                const method = methodByType[cardType];
                if (!method) continue;
                evidenceAwareCardLogic[method] = (...args: any[]) => {
                    const cached = readPublicSelectorEvidence(
                        analysis,
                        method,
                        args,
                        new Set([cardType])
                    );
                    if (cached.found) return Array.isArray(cached.result) ? cached.result : [];
                    return cardLogic && typeof cardLogic[method] === 'function'
                        ? cardLogic[method].apply(cardLogic, args)
                        : [];
                };
            }
        }
        return MovementCornerSwing.getMovementCornerSwingTargetCounts({
            cardLogic: evidenceAwareCardLogic,
            cardState: cs,
            gameState: gs,
            playerKey,
            board,
            playerValue,
            cardTypes: movementTypes,
            getBoardCellValueSafe: cfg.getBoardCellValueSafe,
            isCornerCell: cfg.isCornerCell
        });
    }

    function buildCardUseDecisionContextImpl(
        playerKey: any,
        level: any,
        legalMovesCount: any,
        legalMoves?: any,
        usabilityInput?: any,
        performanceScope?: CpuTurnPerformanceScope | null
    ): any {
        const cs = readCardState();
        const gs = readGameState();
        const usability = normalizeUsabilityAnalysis(usabilityInput);
        const usableCardIds = usability.usableCardIds.slice();
        const usableTypes = new Set((usability.usableCardTypes || []).map((value) => String(value || '')));
        const board = cfg.getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
        const playerValue = cfg.resolvePlayerValue(playerKey);
        let boardExpansionTargetCounts = {
            boardExpansionWillEnemyCornerTargetCount: 0,
            boardExpansionGodEnemyCornerTargetCount: 0,
            boardExpansionEnemyCornerTargetCount: 0
        };
        if (usableTypes.has('BOARD_EXPANSION_WILL') || usableTypes.has('BOARD_EXPANSION_GOD')) {
            const buildBoardExpansionCounts = () => getBoardExpansionEnemyCornerTargetCounts(
                playerKey,
                board,
                playerValue,
                usability,
                usableTypes
            );
            boardExpansionTargetCounts = performanceScope
                ? measureCpuTurnSync(
                    performanceScope,
                    'card-context-feature:board-expansion',
                    buildBoardExpansionCounts
                )
                : buildBoardExpansionCounts();
        }
        let swapEnemyNormalCornerTargetCount = 0;
        if (usableTypes.has('SWAP_WITH_ENEMY')) {
            const buildSwapCount = () => getSwapEnemyNormalCornerTargetCount(
                playerKey,
                board,
                playerValue,
                usability
            );
            swapEnemyNormalCornerTargetCount = performanceScope
                ? measureCpuTurnSync(
                    performanceScope,
                    'card-context-feature:swap-enemy-corner',
                    buildSwapCount
                )
                : buildSwapCount();
        }
        let temptHighValueTargetCount = 0;
        if (usableTypes.has('TEMPT_WILL')) {
            const buildTemptCount = () => getTemptHighValueTargetCount(playerKey, usability);
            temptHighValueTargetCount = performanceScope
                ? measureCpuTurnSync(
                    performanceScope,
                    'card-context-feature:tempt-high-value',
                    buildTemptCount
                )
                : buildTemptCount();
        }
        const movementCardTypes = Array.isArray(MovementCornerSwing && MovementCornerSwing.MOVEMENT_CORNER_SWING_CARD_TYPES)
            ? MovementCornerSwing.MOVEMENT_CORNER_SWING_CARD_TYPES.filter((cardType: string) => usableTypes.has(cardType))
            : [];
        let movementCornerSwingTargetCounts: any = {};
        if (MovementCornerSwing && Array.isArray(MovementCornerSwing.MOVEMENT_CORNER_SWING_CARD_TYPES)) {
            for (const cardType of MovementCornerSwing.MOVEMENT_CORNER_SWING_CARD_TYPES) {
                movementCornerSwingTargetCounts[cardType] = 0;
            }
        }
        if (movementCardTypes.length > 0) {
            const buildMovementCounts = () => getMovementCornerSwingTargetCounts(
                playerKey,
                board,
                playerValue,
                usability,
                movementCardTypes
            );
            movementCornerSwingTargetCounts = performanceScope
                ? measureCpuTurnSync(
                    performanceScope,
                    'card-context-feature:movement-corner-swing',
                    buildMovementCounts
                )
                : buildMovementCounts();
        }
        const movementCornerSwingTargetCount = (
            MovementCornerSwing &&
            typeof MovementCornerSwing.getMaxMovementCornerSwingTargetCount === 'function'
        )
            ? MovementCornerSwing.getMaxMovementCornerSwingTargetCount(movementCornerSwingTargetCounts)
            : 0;
        const stats = cfg.countBoardStatsForPlayer(playerValue);
        const edgeControl = cfg.countEdgeControl(board, playerValue);
        const ownCharge = cs && cs.charge && Number.isFinite(cs.charge[playerKey])
            ? cs.charge[playerKey]
            : 0;
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const oppHandSize = cs && cs.hands && Array.isArray(cs.hands[opponentKey])
            ? cs.hands[opponentKey].length
            : 0;
        const oppCharge = cs && cs.charge && Number.isFinite(cs.charge[opponentKey])
            ? cs.charge[opponentKey]
            : 0;
        const handCardIds = cs && cs.hands && Array.isArray(cs.hands[playerKey])
            ? cs.hands[playerKey].slice()
            : [];
        const handSize = handCardIds.length;
        const deckRemaining = cs && cs.decks && Array.isArray(cs.decks[playerKey])
            ? cs.decks[playerKey].length
            : null;
        const hasDestroyedCardThisTurn = !!(cs && cs.hasDestroyedCardThisTurnByPlayer && cs.hasDestroyedCardThisTurnByPlayer[playerKey]);
        const planState = cfg.buildCornerPlanState(playerKey, legalMoves, usableCardIds);
        const safeLegalMoves = Array.isArray(legalMoves) ? legalMoves : [];
        const cpuPolicyCore = cfg.getCpuPolicyCore ? cfg.getCpuPolicyCore() : null;
        const legalMoveMetrics = (cpuPolicyCore && typeof cpuPolicyCore.computeLegalMoveMetrics === 'function')
            ? cpuPolicyCore.computeLegalMoveMetrics(safeLegalMoves, (row: any, col: any) => cfg.getBoardBonusValueAt(row, col))
            : {
                maxLegalFlips: 0,
                avgLegalFlips: 0,
                maxLegalGain: 0,
                maxLegalBoardBonus: 0
            };

        const markers = cs && Array.isArray(cs.markers) ? cs.markers : [];
        let ownSpecialCount = 0;
        let oppSpecialCount = 0;
        let ownGuardCount = 0;
        let oppGuardCount = 0;
        let ownBombCount = 0;
        let massFreezeOwnTargetCount = 0;
        let massFreezeOpponentTargetCount = 0;
        let cloneSplitEligibleSourceCount = 0;
        const cloneSplitEligibleSourceKeys = new Set();
        const shouldScanCloneSources = usableTypes.has('CLONE_WILL');
        for (const marker of markers) {
            if (!marker || (marker.kind !== 'specialStone' && marker.kind !== 'bomb')) continue;
            const row = Number(marker.row);
            const col = Number(marker.col);
            if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
            if (shouldScanCloneSources && cfg.getBoardCellValueSafe(board, row, col) === playerValue) {
                const sourceKey = `${row},${col}`;
                if (!cloneSplitEligibleSourceKeys.has(sourceKey)) {
                    cloneSplitEligibleSourceKeys.add(sourceKey);
                    cloneSplitEligibleSourceCount += 1;
                }
            }
            if (marker.kind === 'bomb') {
                if (marker.owner === playerKey) ownBombCount += 1;
                continue;
            }
            if (marker.kind !== 'specialStone') continue;
            const data = marker.data && typeof marker.data === 'object' ? marker.data : null;
            const type = data && typeof data.type === 'string' ? data.type : '';
            if (type === 'METEOR_HOLE') continue;
            if (marker.owner === playerKey) {
                ownSpecialCount += 1;
                if (type === 'GUARD') ownGuardCount += 1;
            } else if (marker.owner === opponentKey) {
                oppSpecialCount += 1;
                if (type === 'GUARD') oppGuardCount += 1;
            }
        }

        const cardLogic = readCardLogic();
        const collectMassFreezeCounts = () => {
            if (cardLogic && typeof cardLogic.collectMassFreezeWillTargets === 'function') {
                const massFreezeTargets = cardLogic.collectMassFreezeWillTargets(
                    cs,
                    gs,
                    playerKey,
                    { includeHiddenOpponentTraps: true }
                );
                for (const target of Array.isArray(massFreezeTargets) ? massFreezeTargets : []) {
                    const owners = new Set((Array.isArray(target && target.markers) ? target.markers : [])
                        .map((marker: any) => marker && marker.owner)
                        .filter(Boolean));
                    if (owners.has(playerKey)) massFreezeOwnTargetCount += 1;
                    if (owners.has(opponentKey)) massFreezeOpponentTargetCount += 1;
                }
            }
        };
        if (usableTypes.has('MASS_FREEZE_WILL')) {
            if (performanceScope) {
                measureCpuTurnSync(
                    performanceScope,
                    'card-context-feature:mass-freeze',
                    collectMassFreezeCounts
                );
            } else {
                collectMassFreezeCounts();
            }
        }

        return {
            level,
            whiteLv6Mode: level >= 6 && playerKey === 'white',
            playerValue,
            legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
            discDiff: stats.discDiff,
            empties: stats.empties,
            ownCharge,
            oppCharge,
            oppHandSize,
            handSize,
            handCardIds,
            deckRemaining,
            hasDestroyedCardThisTurn,
            forceUseCard: (Number.isFinite(legalMovesCount) ? legalMovesCount : 0) <= 0,
            ownCorners: planState.ownCorners,
            oppCorners: planState.oppCorners,
            swapEnemyNormalCornerTargetCount,
            temptHighValueTargetCount,
            boardExpansionEnemyCornerTargetCount: boardExpansionTargetCounts.boardExpansionEnemyCornerTargetCount,
            boardExpansionWillEnemyCornerTargetCount: boardExpansionTargetCounts.boardExpansionWillEnemyCornerTargetCount,
            boardExpansionGodEnemyCornerTargetCount: boardExpansionTargetCounts.boardExpansionGodEnemyCornerTargetCount,
            movementCornerSwingTargetCounts,
            movementCornerSwingTargetCount,
            ownEdges: edgeControl.ownEdges,
            oppEdges: edgeControl.oppEdges,
            hasCornerMoveNow: planState.hasCornerMoveNow,
            hasEdgeMoveNow: planState.hasEdgeMoveNow,
            cornerEmergency: planState.cornerEmergency,
            cornerHoldMode: planState.cornerHoldMode,
            recoveryCostGap: planState.recoveryCostGap,
            highBonusMoveAvailable: planState.highBonusMoveAvailable,
            maxLegalFlips: legalMoveMetrics.maxLegalFlips,
            avgLegalFlips: legalMoveMetrics.avgLegalFlips,
            maxLegalGain: legalMoveMetrics.maxLegalGain,
            maxLegalBoardBonus: legalMoveMetrics.maxLegalBoardBonus,
            cloneSplitEligibleSourceCount,
            ownSpecialCount,
            oppSpecialCount,
            ownBombCount,
            massFreezeOwnTargetCount,
            massFreezeOpponentTargetCount,
            ownGuardCount,
            oppGuardCount,
            usableCardIds: usableCardIds.slice(),
            cornerPlanState: planState
        };
    }

    function buildCardUseDecisionContext(
        playerKey: any,
        level: any,
        legalMovesCount: any,
        legalMoves?: any,
        usableCardIds?: any,
        performanceScope?: CpuTurnPerformanceScope | null
    ): any {
        return performanceScope
            ? measureCpuTurnSync(
                performanceScope,
                'card-context-base',
                () => buildCardUseDecisionContextImpl(
                    playerKey,
                    level,
                    legalMovesCount,
                    legalMoves,
                    usableCardIds,
                    performanceScope
                )
            )
            : buildCardUseDecisionContextImpl(
                playerKey,
                level,
                legalMovesCount,
                legalMoves,
                usableCardIds,
                null
            );
    }

    function buildOnnxContext(playerKey: any, level: any, legalMovesCount: any, handCardIds: any, usableCardIds: any, candidateMoves?: any): any {
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const moves = Array.isArray(candidateMoves)
            ? candidateMoves.filter((one) => one && Number.isFinite(one.row) && Number.isFinite(one.col))
            : [];
        let hasCornerMoveNow = false;
        let hasEdgeMoveNow = false;
        let maxLegalMoveBonus = 0;
        const gs = readGameState();
        const cs = readCardState();
        const deckMetrics = cfg.getDeckMetricsForPlayer ? cfg.getDeckMetricsForPlayer(playerKey) : {};
        const boardRef = cfg.getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
        const playerValue = cfg.resolvePlayerValue(playerKey);
        const cornerControl = cfg.countCornerControl ? cfg.countCornerControl(boardRef, playerValue) : null;
        const edgeControl = cfg.countEdgeControl ? cfg.countEdgeControl(boardRef, playerValue) : null;
        const ownCornersBefore = Number(cornerControl && cornerControl.ownCorners) || 0;
        const oppCornersBefore = Number(cornerControl && cornerControl.oppCorners) || 0;
        const ownEdgesBefore = Number(edgeControl && edgeControl.ownEdges) || 0;
        const oppEdgesBefore = Number(edgeControl && edgeControl.oppEdges) || 0;
        for (const move of moves) {
            if (!hasCornerMoveNow && cfg.isCornerCell(move.row, move.col, boardRef)) hasCornerMoveNow = true;
            if (!hasEdgeMoveNow && cfg.isEdgeCell(move.row, move.col, boardRef) && !cfg.isCornerCell(move.row, move.col, boardRef)) hasEdgeMoveNow = true;
            const bonus = cfg.getBoardBonusValueAt(move.row, move.col);
            if (bonus > maxLegalMoveBonus) maxLegalMoveBonus = bonus;
        }
        const cornerEmergency = (oppCornersBefore > ownCornersBefore || (hasCornerMoveNow === false && oppCornersBefore > 0));
        const cornerHoldMode = (cornerEmergency === false && ownCornersBefore > 0 && ownCornersBefore >= oppCornersBefore && ownEdgesBefore >= oppEdgesBefore);
        return {
            playerKey,
            level,
            board: boardRef,
            pendingType: cfg.resolvePendingType ? cfg.resolvePendingType(playerKey) : null,
            legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
            ownCharge: (cs && cs.charge && Number.isFinite(cs.charge[playerKey])) ? cs.charge[playerKey] : 0,
            oppCharge: (cs && cs.charge && Number.isFinite(cs.charge[opponentKey])) ? cs.charge[opponentKey] : 0,
            deckCount: Number.isFinite(deckMetrics.legacyDeckCount) ? deckMetrics.legacyDeckCount : 0,
            ownDeckCount: Number.isFinite(deckMetrics.ownDeckCount) ? deckMetrics.ownDeckCount : 0,
            initialDeckSize: Number.isFinite(deckMetrics.initialDeckSize) ? deckMetrics.initialDeckSize : 0,
            boardBonusByCell: (cs && cs.boardBonusByCell && typeof cs.boardBonusByCell === 'object')
                ? cs.boardBonusByCell
                : null,
            boardBonusConsumedByCell: (cs && cs.boardBonusConsumedByCell && typeof cs.boardBonusConsumedByCell === 'object')
                ? cs.boardBonusConsumedByCell
                : null,
            handCardIds: Array.isArray(handCardIds) ? handCardIds.slice() : (cfg.getHandCardIdsForPlayer ? cfg.getHandCardIdsForPlayer(playerKey) : []),
            usableCardIds: Array.isArray(usableCardIds) ? usableCardIds.slice() : null,
            candidateMoves: moves,
            ownCornersBefore,
            oppCornersBefore,
            ownEdgesBefore,
            oppEdgesBefore,
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerEmergency,
            cornerHoldMode,
            maxLegalMoveBonus,
            highBonusMoveAvailable: maxLegalMoveBonus >= 3
        };
    }

    return {
        buildCardUseDecisionContext,
        buildOnnxContext
    };
}

module.exports = {
    createCpuDecisionCardContext
};
