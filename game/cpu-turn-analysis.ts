export type CpuTurnAnalysisPlayerKey = 'black' | 'white';

export type CpuTurnInvocationIdentity = Readonly<{
    runId: number;
    playerKey: CpuTurnAnalysisPlayerKey;
    turnNumber: number | null;
    decisionLevel: number;
    stateVersion: number | string | null;
    decisionEpoch: number;
    pendingEffectId: string | null;
    pendingStage: string | null;
    retryGeneration: number;
}>;

export type CpuTurnAnalysisSeed = Readonly<{
    identity: CpuTurnInvocationIdentity;
    protection: readonly unknown[];
    flipBlockers: readonly unknown[];
    cardUsability: Readonly<Record<string, any>>;
}>;

export type CpuCardDecisionAnalysis = Readonly<{
    identity: CpuTurnInvocationIdentity;
    cardLegalMoves: readonly any[];
    boardMetrics: Readonly<Record<string, any>>;
    moveScanEvidence: Readonly<Record<string, any>> | null;
}>;

export type CpuPlacementAnalysis = Readonly<{
    identity: CpuTurnInvocationIdentity;
    placementCandidates: readonly any[];
}>;

export type CpuCommentarySnapshotMoment = 'turn-start' | 'post-card' | 'post-move';

export type CpuCommentaryAnalysis = Readonly<{
    identity: CpuTurnInvocationIdentity;
    snapshotMoment: CpuCommentarySnapshotMoment;
    metrics: Readonly<Record<string, any>>;
}>;

type CpuTurnIdentityMatchOptions = {
    crossedAsyncBoundary?: boolean;
};

type CpuCardDecisionDerivationInput = {
    getCardLegalMoves: () => any[];
    buildBoardMetrics?: (cardLegalMoves: readonly any[]) => Record<string, any> | null | undefined;
    deriveEquivalentMoveScan?: () => any;
};

type CpuPlacementDerivationInput = {
    generatePlacementCandidates: () => any[];
    reuseMoveScanEvidence?: (evidence: Readonly<Record<string, any>>) => any[] | null;
};

type CpuCommentaryDerivationInput = {
    buildMetrics: () => Record<string, any> | null | undefined;
};

function normalizeNullableInteger(value: any): number | null {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeStateVersion(value: any): number | string | null {
    if (Number.isSafeInteger(value) && Number(value) >= 0) return Number(value);
    if (typeof value === 'string' && value.length > 0 && value.length <= 160) return value;
    return null;
}

function normalizeIdentity(input: any): CpuTurnInvocationIdentity {
    const source = input && typeof input === 'object' ? input : {};
    const playerKey: CpuTurnAnalysisPlayerKey = source.playerKey === 'white' ? 'white' : 'black';
    return Object.freeze({
        runId: Math.max(0, normalizeNullableInteger(source.runId) || 0),
        playerKey,
        turnNumber: normalizeNullableInteger(source.turnNumber),
        decisionLevel: Math.max(1, Math.floor(Number(source.decisionLevel) || 1)),
        stateVersion: normalizeStateVersion(source.stateVersion),
        decisionEpoch: Math.max(0, normalizeNullableInteger(source.decisionEpoch) || 0),
        pendingEffectId: source.pendingEffectId === null || typeof source.pendingEffectId === 'undefined'
            ? null
            : String(source.pendingEffectId),
        pendingStage: source.pendingStage === null || typeof source.pendingStage === 'undefined'
            ? null
            : String(source.pendingStage),
        retryGeneration: Math.max(0, normalizeNullableInteger(source.retryGeneration) || 0)
    });
}

function freezeArray<T>(value: readonly T[] | null | undefined): readonly T[] {
    return Object.freeze(Array.isArray(value) ? value.slice() : []);
}

function freezeRecord(value: Record<string, any> | null | undefined): Readonly<Record<string, any>> {
    return Object.freeze(value && typeof value === 'object' ? { ...value } : {});
}

export function buildCpuTurnAnalysisSeed(input: any): CpuTurnAnalysisSeed {
    const source = input && typeof input === 'object' ? input : {};
    const cardUsability = source.cardUsability && typeof source.cardUsability === 'object'
        ? source.cardUsability
        : {};
    return Object.freeze({
        identity: normalizeIdentity(source.identity),
        protection: freezeArray(source.protection),
        flipBlockers: freezeArray(source.flipBlockers),
        cardUsability
    });
}

export function isCpuTurnInvocationIdentityCurrent(
    expectedInput: CpuTurnInvocationIdentity,
    currentInput: CpuTurnInvocationIdentity,
    options: CpuTurnIdentityMatchOptions = {}
): boolean {
    const expected = normalizeIdentity(expectedInput);
    const current = normalizeIdentity(currentInput);
    if (options.crossedAsyncBoundary === true && expected.stateVersion === null) return false;
    return expected.runId === current.runId
        && expected.playerKey === current.playerKey
        && expected.turnNumber === current.turnNumber
        && expected.decisionLevel === current.decisionLevel
        && expected.stateVersion === current.stateVersion
        && expected.decisionEpoch === current.decisionEpoch
        && expected.pendingEffectId === current.pendingEffectId
        && expected.pendingStage === current.pendingStage
        && expected.retryGeneration === current.retryGeneration;
}

export function deriveCardDecisionAnalysis(
    seed: CpuTurnAnalysisSeed,
    input: CpuCardDecisionDerivationInput
): CpuCardDecisionAnalysis {
    const source = input && typeof input === 'object' ? input : {} as CpuCardDecisionDerivationInput;
    let cardLegalMoves: any[] = [];
    let moveScanEvidence: Readonly<Record<string, any>> | null = null;
    if (typeof source.deriveEquivalentMoveScan === 'function') {
        const scan = source.deriveEquivalentMoveScan();
        if (scan && Array.isArray(scan.cardLegalMoves)) {
            cardLegalMoves = scan.cardLegalMoves;
            moveScanEvidence = freezeRecord(scan.moveScanEvidence || scan.evidence || scan);
        }
    }
    if (!moveScanEvidence) {
        cardLegalMoves = typeof source.getCardLegalMoves === 'function'
            ? source.getCardLegalMoves()
            : [];
    }
    const frozenMoves = freezeArray(cardLegalMoves);
    const boardMetrics = typeof source.buildBoardMetrics === 'function'
        ? source.buildBoardMetrics(frozenMoves)
        : {};
    return Object.freeze({
        identity: seed.identity,
        cardLegalMoves: frozenMoves,
        boardMetrics: freezeRecord(boardMetrics),
        moveScanEvidence
    });
}

export function derivePlacementAnalysis(
    seed: CpuTurnAnalysisSeed,
    priorCardAnalysis: CpuCardDecisionAnalysis | null | undefined,
    input: CpuPlacementDerivationInput
): CpuPlacementAnalysis {
    const source = input && typeof input === 'object' ? input : {} as CpuPlacementDerivationInput;
    let placementCandidates: any[] | null = null;
    if (
        priorCardAnalysis
        && isCpuTurnInvocationIdentityCurrent(seed.identity, priorCardAnalysis.identity)
        && priorCardAnalysis.moveScanEvidence
        && typeof source.reuseMoveScanEvidence === 'function'
    ) {
        const reused = source.reuseMoveScanEvidence(priorCardAnalysis.moveScanEvidence);
        if (Array.isArray(reused)) placementCandidates = reused;
    }
    if (!placementCandidates) {
        placementCandidates = typeof source.generatePlacementCandidates === 'function'
            ? source.generatePlacementCandidates()
            : [];
    }
    return Object.freeze({
        identity: seed.identity,
        placementCandidates: freezeArray(placementCandidates)
    });
}

export function deriveCommentaryAnalysis(
    seed: CpuTurnAnalysisSeed,
    snapshotMoment: CpuCommentarySnapshotMoment,
    input: CpuCommentaryDerivationInput
): CpuCommentaryAnalysis {
    const source = input && typeof input === 'object' ? input : {} as CpuCommentaryDerivationInput;
    const metrics = typeof source.buildMetrics === 'function' ? source.buildMetrics() : {};
    return Object.freeze({
        identity: seed.identity,
        snapshotMoment,
        metrics: freezeRecord(metrics)
    });
}

export function createCpuTurnAnalysisInvocation(
    seed: CpuTurnAnalysisSeed,
    derivationInputs: {
        card: CpuCardDecisionDerivationInput;
        placement: CpuPlacementDerivationInput;
        commentary?: Partial<Record<CpuCommentarySnapshotMoment, CpuCommentaryDerivationInput>>;
    }
) {
    let cardAnalysis: CpuCardDecisionAnalysis | null = null;
    let placementAnalysis: CpuPlacementAnalysis | null = null;
    const commentaryByMoment = new Map<CpuCommentarySnapshotMoment, CpuCommentaryAnalysis>();

    return Object.freeze({
        seed,
        deriveCardDecisionAnalysis(): CpuCardDecisionAnalysis {
            if (!cardAnalysis) cardAnalysis = deriveCardDecisionAnalysis(seed, derivationInputs.card);
            return cardAnalysis;
        },
        derivePlacementAnalysis(priorCardAnalysis?: CpuCardDecisionAnalysis | null): CpuPlacementAnalysis {
            if (!placementAnalysis) {
                placementAnalysis = derivePlacementAnalysis(
                    seed,
                    priorCardAnalysis || cardAnalysis,
                    derivationInputs.placement
                );
            }
            return placementAnalysis;
        },
        deriveCommentaryAnalysis(snapshotMoment: CpuCommentarySnapshotMoment): CpuCommentaryAnalysis {
            const existing = commentaryByMoment.get(snapshotMoment);
            if (existing) return existing;
            const input = derivationInputs.commentary && derivationInputs.commentary[snapshotMoment];
            const derived = deriveCommentaryAnalysis(seed, snapshotMoment, input || { buildMetrics: () => ({}) });
            commentaryByMoment.set(snapshotMoment, derived);
            return derived;
        },
        peekCardDecisionAnalysis(): CpuCardDecisionAnalysis | null {
            return cardAnalysis;
        }
    });
}

module.exports = {
    buildCpuTurnAnalysisSeed,
    createCpuTurnAnalysisInvocation,
    deriveCardDecisionAnalysis,
    derivePlacementAnalysis,
    deriveCommentaryAnalysis,
    isCpuTurnInvocationIdentityCurrent
};
