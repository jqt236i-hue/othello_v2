type PendingActionsConfig = {
    buildCardUseDecisionContext: (playerKey: any, level: any, legalMovesCount: any, legalMoves?: any, usableCardIds?: any) => any;
    choosePendingTargetWithPolicyAsync: (playerKey: any, pendingType: any, targets: any, pending: any) => Promise<any>;
    chooseTimeBombTargetWithPolicy: (playerKey: any, targets: any[]) => any;
    clearCpuPendingEffect: (playerKey: any) => any;
    cpuDebugLog: (...args: any[]) => void;
    emitCpuEffectLog: (message: any) => any;
    emitCpuSelectionStateChange: () => any;
    filterCloneTargetsForLv6: (playerKey: any, targets: any[]) => any[];
    getActiveProtectionForPlayer: (playerValue: any) => any;
    getBoardCellValueSafe: (board: any, row: any, col: any) => any;
    getCardLogic: () => any;
    getCardState: () => any;
    getCpuPolicyCore: () => any;
    getCpuRng: () => any;
    getCurrentCpuBoard: () => any;
    getFlipBlockers: () => any[];
    getGameState: () => any;
    getLegalMoves: (gameStateValue: any, protection: any, perma: any) => any[];
    handOffSelectionTurnInGameState: (playerKey: any) => any;
    maybeContinueCpuSelectionTurnHandoff: (playerKey: any, pendingType: any, playbackEvents: any, action?: any) => any;
    readCpuPendingEffect: (playerKey: any) => any;
    resolveCpuDecisionLevelForPlayer: (playerKey: any) => number;
    resolvePlayerValue: (playerKey: any) => any;
    resolveSharedBoardUtilsModule: () => any;
    runCpuPendingSelectionViaPipeline: (playerKey: any, actionPayload: any, pendingType: any) => Promise<any>;
};

type TargetActionOptions = {
    playerKey: any;
    pendingType: any;
    pending?: any;
    targets: any[];
    noTargetLabel: string;
    targetLabel: string;
    payloadKey: string;
    applyMethodName: string;
    deferNetworkPublish?: boolean;
    fallbackOnPipelineReject?: boolean;
    extraApplyArgs?: (target: any) => any[];
    onApplied?: () => any;
    onMissingApply?: 'clear-and-emit' | 'noop';
};

function isAppliedResult(result: any): boolean {
    if (typeof result === 'boolean') return result === true;
    return !!(result && result.applied);
}

function isPendingPipelineHandled(result: any): boolean {
    return !!(result && result.ok === true);
}

export function createCpuDecisionPendingActions(config: PendingActionsConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as PendingActionsConfig;

    function getCardLogic(): any {
        return cfg.getCardLogic ? cfg.getCardLogic() : null;
    }

    function getSelectableTargets(playerKey: any): any[] {
        const cardLogic = getCardLogic();
        return (cardLogic && typeof cardLogic.getSelectableTargets === 'function')
            ? cardLogic.getSelectableTargets(cfg.getCardState(), cfg.getGameState(), playerKey)
            : [];
    }

    function getTargetsByMethod(playerKey: any, methodName: string, fallbackToSelectable = true): any[] {
        const cardLogic = getCardLogic();
        if (cardLogic && typeof cardLogic[methodName] === 'function') {
            if (methodName === 'getReverseWillTargets') {
                return cardLogic[methodName](cfg.getCardState(), cfg.getGameState());
            }
            return cardLogic[methodName](cfg.getCardState(), cfg.getGameState(), playerKey);
        }
        return fallbackToSelectable ? getSelectableTargets(playerKey) : [];
    }

    function getPlayerHand(playerKey: any): any[] {
        const state = cfg.getCardState();
        return (state && state.hands && Array.isArray(state.hands[playerKey]))
            ? state.hands[playerKey].slice()
            : [];
    }

    function buildOfferDecisionContext(playerKey: any, level: any): any {
        const playerValue = cfg.resolvePlayerValue(playerKey);
        const protection = typeof cfg.getActiveProtectionForPlayer === 'function'
            ? cfg.getActiveProtectionForPlayer(playerValue)
            : null;
        const perma = typeof cfg.getFlipBlockers === 'function' ? cfg.getFlipBlockers() : [];
        const legalMoves = typeof cfg.getLegalMoves === 'function'
            ? (cfg.getLegalMoves(cfg.getGameState(), protection, perma) || [])
            : [];
        const usableCards = getPlayerHand(playerKey);
        return cfg.buildCardUseDecisionContext(playerKey, level, legalMoves.length, legalMoves, usableCards);
    }

    function filterOccupiedDestroyTargets(board: any, targets: any[]): any[] {
        return Array.isArray(targets)
            ? targets.filter((target) => {
                if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return false;
                const value = cfg.getBoardCellValueSafe(board, target.row, target.col);
                return value !== null && value !== 0;
            })
            : [];
    }

    function collectOccupiedDestroyTargetsFromBoard(board: any): any[] {
        if (!Array.isArray(board)) return [];
        const boardUtils = typeof cfg.resolveSharedBoardUtilsModule === 'function'
            ? cfg.resolveSharedBoardUtilsModule()
            : null;
        if (boardUtils && typeof boardUtils.collectBoardCoordinates === 'function') {
            return boardUtils.collectBoardCoordinates(board)
                .filter((cell: any) => cfg.getBoardCellValueSafe(board, cell.row, cell.col) !== 0);
        }

        const targets: any[] = [];
        for (let row = 0; row < board.length; row++) {
            const line = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < line.length; col++) {
                if (line[col] === 0) continue;
                targets.push({ row, col });
            }
        }
        return targets;
    }

    async function runTargetAction(options: TargetActionOptions): Promise<any> {
        const opts = options || {} as TargetActionOptions;
        const targets = Array.isArray(opts.targets) ? opts.targets : [];
        if (!targets.length) {
            cfg.cpuDebugLog(`[CPU] ${opts.playerKey}: ${opts.noTargetLabel}`);
            cfg.clearCpuPendingEffect(opts.playerKey);
            return;
        }

        const target = await cfg.choosePendingTargetWithPolicyAsync(opts.playerKey, opts.pendingType, targets, opts.pending) || targets[0];
        cfg.cpuDebugLog(`[CPU] ${opts.playerKey}: ${opts.targetLabel} (${target.row}, ${target.col})`);

        const payload: any = {
            [opts.payloadKey]: { row: target.row, col: target.col }
        };
        if (opts.deferNetworkPublish === true) payload.deferNetworkPublish = true;

        const pipelineResult = await cfg.runCpuPendingSelectionViaPipeline(
            opts.playerKey,
            payload,
            opts.pendingType
        );
        if (isPendingPipelineHandled(pipelineResult)) return;
        if (pipelineResult && pipelineResult.ok === false && opts.fallbackOnPipelineReject === false) return;

        const cardLogic = getCardLogic();
        const applyFn = cardLogic && typeof cardLogic[opts.applyMethodName] === 'function'
            ? cardLogic[opts.applyMethodName]
            : null;
        if (typeof applyFn === 'function') {
            const extra = typeof opts.extraApplyArgs === 'function' ? opts.extraApplyArgs(target) : [];
            const result = applyFn(cfg.getCardState(), cfg.getGameState(), opts.playerKey, target.row, target.col, ...extra);
            if (!isAppliedResult(result)) {
                cfg.clearCpuPendingEffect(opts.playerKey);
            } else if (typeof opts.onApplied === 'function') {
                opts.onApplied();
            }
            cfg.emitCpuSelectionStateChange();
            return;
        }

        if (opts.onMissingApply === 'clear-and-emit') {
            cfg.clearCpuPendingEffect(opts.playerKey);
            cfg.emitCpuSelectionStateChange();
        }
    }

    async function cpuSelectStrongWindWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'STRONG_WIND_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '強風対象なし',
            targetLabel: '強風ターゲット',
            payloadKey: 'strongWindTarget',
            applyMethodName: 'applyStrongWindWill',
            deferNetworkPublish: true,
            extraApplyArgs: () => [cfg.getCpuRng()]
        });
    }

    async function cpuSelectSuperBuoyancyWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'SUPER_BUOYANCY_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '超浮力対象なし',
            targetLabel: '超浮力ターゲット',
            payloadKey: 'superBuoyancyTarget',
            applyMethodName: 'applySuperBuoyancyWill',
            deferNetworkPublish: true
        });
    }

    async function cpuSelectBuoyancyWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'BUOYANCY_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '浮力対象なし',
            targetLabel: '浮力ターゲット',
            payloadKey: 'buoyancyTarget',
            applyMethodName: 'applyBuoyancyWill',
            deferNetworkPublish: true
        });
    }

    async function cpuSelectSuperGravityWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'SUPER_GRAVITY_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '超重力対象なし',
            targetLabel: '超重力ターゲット',
            payloadKey: 'superGravityTarget',
            applyMethodName: 'applySuperGravityWill',
            deferNetworkPublish: true
        });
    }

    async function cpuSelectGravityWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'GRAVITY_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '重力対象なし',
            targetLabel: '重力ターゲット',
            payloadKey: 'gravityTarget',
            applyMethodName: 'applyGravityWill',
            deferNetworkPublish: true
        });
    }

    async function cpuSelectSuperAttractionWillWithPolicy(playerKey: any): Promise<any> {
        const pending = cfg.readCpuPendingEffect(playerKey);
        return runTargetAction({
            playerKey,
            pendingType: 'SUPER_ATTRACTION_WILL',
            pending,
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '超引力対象なし',
            targetLabel: '超引力ターゲット',
            payloadKey: 'superAttractionTarget',
            applyMethodName: 'applySuperAttractionWill',
            deferNetworkPublish: true,
            extraApplyArgs: () => {
                const cardState = cfg.getCardState();
                const randomSource = (
                    cardState &&
                    cardState._defaultRandomSource &&
                    typeof cardState._defaultRandomSource.random === 'function'
                ) ? cardState._defaultRandomSource : undefined;
                return [randomSource];
            }
        });
    }

    async function cpuSelectSwapWithEnemyWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'SWAP_WITH_ENEMY',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '交換対象なし',
            targetLabel: '交換ターゲット',
            payloadKey: 'swapTarget',
            applyMethodName: 'applySwapEffect',
            fallbackOnPipelineReject: false,
            onApplied: () => {
                cfg.handOffSelectionTurnInGameState(playerKey);
                cfg.maybeContinueCpuSelectionTurnHandoff(playerKey, 'SWAP_WITH_ENEMY', []);
            },
            onMissingApply: 'clear-and-emit'
        });
    }

    async function cpuSelectPositionSwapWillWithPolicy(playerKey: any): Promise<any> {
        const pending = cfg.readCpuPendingEffect(playerKey);
        return runTargetAction({
            playerKey,
            pendingType: 'POSITION_SWAP_WILL',
            pending,
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '入替対象なし',
            targetLabel: '入替ターゲット',
            payloadKey: 'positionSwapTarget',
            applyMethodName: 'applyPositionSwapWill',
            onMissingApply: 'clear-and-emit'
        });
    }

    async function cpuSelectTrapWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'TRAP_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '罠対象なし',
            targetLabel: '罠ターゲット',
            payloadKey: 'trapTarget',
            applyMethodName: 'applyTrapWill',
            onApplied: () => {
                cfg.handOffSelectionTurnInGameState(playerKey);
                cfg.maybeContinueCpuSelectionTurnHandoff(playerKey, 'TRAP_WILL', []);
            }
        });
    }

    async function cpuSelectGuardWillWithPolicy(playerKey: any): Promise<any> {
        const pending = cfg.readCpuPendingEffect(playerKey);
        const pendingType = (pending && (pending.type === 'GUARD_WILL' || pending.type === 'GUARDIAN_GOD'))
            ? pending.type
            : 'GUARD_WILL';
        return runTargetAction({
            playerKey,
            pendingType,
            pending,
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '守る対象なし',
            targetLabel: '守るターゲット',
            payloadKey: 'guardTarget',
            applyMethodName: 'applyGuardWill'
        });
    }

    async function cpuSelectLivingWillWithPolicy(playerKey: any): Promise<any> {
        const pending = cfg.readCpuPendingEffect(playerKey);
        const pendingType = (pending && pending.type === 'LIVING_WILL') ? pending.type : 'LIVING_WILL';
        return runTargetAction({
            playerKey,
            pendingType,
            pending,
            targets: getTargetsByMethod(playerKey, 'getLivingWillTargets'),
            noTargetLabel: '生きる意志対象なし',
            targetLabel: '生きる意志ターゲット',
            payloadKey: 'livingWillTarget',
            applyMethodName: 'applyLivingWill'
        });
    }

    async function cpuSelectExtendLifeWillWithPolicy(playerKey: any): Promise<any> {
        const pending = cfg.readCpuPendingEffect(playerKey);
        const pendingType = pending && pending.type === 'EXTEND_LIFE_GOD'
            ? 'EXTEND_LIFE_GOD'
            : 'EXTEND_LIFE_WILL';
        return runTargetAction({
            playerKey,
            pendingType,
            pending,
            targets: getTargetsByMethod(playerKey, 'getExtendLifeTargets'),
            noTargetLabel: pendingType === 'EXTEND_LIFE_GOD' ? '延命神対象なし' : '延命対象なし',
            targetLabel: pendingType === 'EXTEND_LIFE_GOD' ? '延命神ターゲット' : '延命ターゲット',
            payloadKey: 'extendTarget',
            applyMethodName: pendingType === 'EXTEND_LIFE_GOD' ? 'applyExtendLifeGod' : 'applyExtendLifeWill'
        });
    }

    async function cpuSelectCorrosionWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'CORROSION_WILL',
            targets: getTargetsByMethod(playerKey, 'getCorrosionTargets'),
            noTargetLabel: '腐食対象なし',
            targetLabel: '腐食ターゲット',
            payloadKey: 'corrosionTarget',
            applyMethodName: 'applyCorrosionWill'
        });
    }

    async function cpuSelectBoardExpansionWillWithPolicy(playerKey: any): Promise<any> {
        const pending = cfg.readCpuPendingEffect(playerKey);
        const pendingType = pending && typeof pending.type === 'string' ? pending.type : 'BOARD_EXPANSION_WILL';
        const isGodExpansion = pendingType === 'BOARD_EXPANSION_GOD';
        return runTargetAction({
            playerKey,
            pendingType,
            pending,
            targets: getSelectableTargets(playerKey),
            noTargetLabel: isGodExpansion ? '盤面拡張神対象なし' : '盤面拡張対象なし',
            targetLabel: isGodExpansion ? '盤面拡張神ターゲット' : '盤面拡張ターゲット',
            payloadKey: 'expansionTarget',
            applyMethodName: isGodExpansion ? 'applyBoardExpansionGod' : 'applyBoardExpansionWill'
        });
    }

    async function cpuSelectBoardShrinkWithPolicy(playerKey: any): Promise<any> {
        const pending = cfg.readCpuPendingEffect(playerKey);
        const pendingType = pending && typeof pending.type === 'string' ? pending.type : 'BOARD_SHRINK_WILL';
        const isGodShrink = pendingType === 'BOARD_SHRINK_GOD';
        return runTargetAction({
            playerKey,
            pendingType,
            pending,
            targets: getSelectableTargets(playerKey),
            noTargetLabel: isGodShrink ? '盤面縮小神対象なし' : '盤面縮小対象なし',
            targetLabel: isGodShrink ? '盤面縮小神ターゲット' : '盤面縮小ターゲット',
            payloadKey: 'shrinkTarget',
            applyMethodName: isGodShrink ? 'applyBoardShrinkGod' : 'applyBoardShrinkWill'
        });
    }

    async function cpuSelectBlockadeWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'BLOCKADE_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '封鎖対象なし',
            targetLabel: '封鎖ターゲット',
            payloadKey: 'blockadeTarget',
            applyMethodName: 'applyBlockadeWill'
        });
    }

    async function cpuSelectMeteorWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'METEOR_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '因果抹消対象なし',
            targetLabel: '因果抹消ターゲット',
            payloadKey: 'meteorTarget',
            applyMethodName: 'applyMeteorWill',
            extraApplyArgs: () => [cfg.getCpuRng()]
        });
    }

    async function cpuSelectFreezeWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'FREEZE_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '凍結対象なし',
            targetLabel: '凍結ターゲット',
            payloadKey: 'freezeTarget',
            applyMethodName: 'applyFreezeWill'
        });
    }

    async function cpuSelectSeedWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'SEED_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '種まき対象なし',
            targetLabel: '種まきターゲット',
            payloadKey: 'seedTarget',
            applyMethodName: 'applySeedWill'
        });
    }

    async function cpuSelectReverseWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'REVERSE_WILL',
            targets: getTargetsByMethod(playerKey, 'getReverseWillTargets'),
            noTargetLabel: '反転の意志の対象なし',
            targetLabel: '反転の意志ターゲット',
            payloadKey: 'reverseWillTarget',
            applyMethodName: 'applyReverseWill',
            onMissingApply: 'clear-and-emit'
        });
    }

    async function cpuSelectTeleportWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'TELEPORT_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: 'テレポート対象なし',
            targetLabel: 'テレポートターゲット',
            payloadKey: 'teleportTarget',
            applyMethodName: 'applyTeleportWill',
            extraApplyArgs: () => [cfg.getCpuRng()]
        });
    }

    async function cpuSelectCellTeleportWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'CELL_TELEPORT_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: 'マステレポート対象なし',
            targetLabel: 'マステレポートターゲット',
            payloadKey: 'teleportTarget',
            applyMethodName: 'applyCellTeleportWill',
            extraApplyArgs: () => [cfg.getCpuRng()]
        });
    }

    async function cpuSelectTemptWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'TEMPT_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '誘惑対象なし',
            targetLabel: '誘惑ターゲット',
            payloadKey: 'temptTarget',
            applyMethodName: 'applyTemptWill',
            onMissingApply: 'clear-and-emit'
        });
    }

    async function cpuSelectDestroyWithPolicy(playerKey: any): Promise<any> {
        const level = cfg.resolveCpuDecisionLevelForPlayer(playerKey);
        const board = cfg.getCurrentCpuBoard();
        const cardLogic = getCardLogic();
        const selectorTargets = (cardLogic && typeof cardLogic.getSelectableTargets === 'function')
            ? cardLogic.getSelectableTargets(cfg.getCardState(), cfg.getGameState(), playerKey)
            : [];
        let targets = filterOccupiedDestroyTargets(board, selectorTargets);
        let resolvedDestroyTargets = false;

        if (targets.length <= 0 && cardLogic && typeof cardLogic.getDestroyTargets === 'function') {
            const destroyTargets = cardLogic.getDestroyTargets(cfg.getCardState(), cfg.getGameState(), playerKey);
            resolvedDestroyTargets = true;
            targets = filterOccupiedDestroyTargets(board, destroyTargets);
        }
        if (targets.length <= 0 && !resolvedDestroyTargets && Array.isArray(board)) {
            targets = collectOccupiedDestroyTargetsFromBoard(board);
        }

        if (targets.length === 0) {
            cfg.cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 破壊対象なし`);
            cfg.clearCpuPendingEffect(playerKey);
            return;
        }

        const target = await cfg.choosePendingTargetWithPolicyAsync(playerKey, 'DESTROY_ONE_STONE', targets, null) || targets[0];

        cfg.cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 破壊ターゲット (${target.row}, ${target.col})`);

        const pipelineResult = await cfg.runCpuPendingSelectionViaPipeline(
            playerKey,
            { destroyTarget: { row: target.row, col: target.col } },
            'DESTROY_ONE_STONE'
        );
        if (isPendingPipelineHandled(pipelineResult)) return;

        const applyFn = cardLogic && typeof cardLogic.applyDestroyEffect === 'function'
            ? cardLogic.applyDestroyEffect
            : null;
        if (typeof applyFn === 'function') {
            const applied = !!applyFn(cfg.getCardState(), cfg.getGameState(), playerKey, target.row, target.col);
            if (!applied) {
                cfg.clearCpuPendingEffect(playerKey);
            }
            cfg.emitCpuSelectionStateChange();
            return;
        }
        cfg.clearCpuPendingEffect(playerKey);
        cfg.emitCpuSelectionStateChange();
    }

    async function cpuSelectHeavenBlessingWithPolicy(playerKey: any): Promise<any> {
        const pending = cfg.readCpuPendingEffect(playerKey);
        const offers = (pending && Array.isArray(pending.offers)) ? pending.offers.slice() : [];
        if (!offers.length) {
            cfg.cpuDebugLog(`[CPU] ${playerKey}: 天の恵み候補なし`);
            cfg.clearCpuPendingEffect(playerKey);
            return;
        }

        let targetCardId = offers[0];
        let bestCost = -Infinity;
        let bestScore = Number.NEGATIVE_INFINITY;
        const level = cfg.resolveCpuDecisionLevelForPlayer(playerKey);
        const cardLogic = getCardLogic();
        const policyCore = typeof cfg.getCpuPolicyCore === 'function' ? cfg.getCpuPolicyCore() : null;
        const decisionContext = buildOfferDecisionContext(playerKey, level);

        for (const cardId of offers) {
            const cost = (cardLogic && typeof cardLogic.getCardCost === 'function')
                ? (cardLogic.getCardCost(cardId) || 0)
                : 0;
            let score = cost * 0.35;
            if (
                policyCore &&
                typeof policyCore.scoreCardUseDecision === 'function' &&
                cardLogic &&
                typeof cardLogic.getCardDef === 'function' &&
                typeof cardLogic.getCardCost === 'function'
            ) {
                const useDecision = policyCore.scoreCardUseDecision(
                    cardId,
                    cardLogic.getCardCost,
                    cardLogic.getCardDef,
                    decisionContext
                );
                const retention = (typeof policyCore.scoreCardRetentionPriority === 'function')
                    ? policyCore.scoreCardRetentionPriority(
                        cardId,
                        cardLogic.getCardCost,
                        cardLogic.getCardDef,
                        decisionContext
                    )
                    : null;
                if (useDecision && Number.isFinite(useDecision.score)) {
                    score += Number(useDecision.score) * 0.95;
                    if (useDecision.shouldUse === true) score += 18;
                }
                if (retention && Number.isFinite(retention.score)) score += Number(retention.score) * 0.8;
            }
            if (score > bestScore || (score === bestScore && cost > bestCost)) {
                bestScore = score;
                bestCost = cost;
                targetCardId = cardId;
            }
        }
        cfg.cpuDebugLog(`[CPU] ${playerKey}: 天の恵み選択 ${targetCardId} (score=${bestScore.toFixed(1)} cost=${bestCost})`);

        const pipelineResult = await cfg.runCpuPendingSelectionViaPipeline(
            playerKey,
            { heavenBlessingCardId: targetCardId },
            'HEAVEN_BLESSING'
        );
        if (isPendingPipelineHandled(pipelineResult)) return;

        const applyFn = cardLogic && typeof cardLogic.applyHeavenBlessingChoice === 'function'
            ? cardLogic.applyHeavenBlessingChoice
            : null;
        if (typeof applyFn === 'function') {
            const res = applyFn(cfg.getCardState(), playerKey, targetCardId);
            if (!res || !res.applied) {
                cfg.clearCpuPendingEffect(playerKey);
            } else {
                const actor = playerKey === 'black' ? '黒' : '白';
                cfg.emitCpuEffectLog(`${actor}: 天の恵みでカード獲得`);
            }
            cfg.emitCpuSelectionStateChange();
        }
    }

    async function cpuSelectCondemnWillWithPolicy(playerKey: any): Promise<any> {
        const pending = cfg.readCpuPendingEffect(playerKey);
        const offers = (pending && Array.isArray(pending.offers)) ? pending.offers.slice() : [];
        if (!offers.length) {
            cfg.cpuDebugLog(`[CPU] ${playerKey}: 断罪候補なし`);
            cfg.clearCpuPendingEffect(playerKey);
            return;
        }

        let target = offers[0];
        let bestCost = -Infinity;
        let bestScore = Number.NEGATIVE_INFINITY;
        const level = cfg.resolveCpuDecisionLevelForPlayer(playerKey);
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const cardLogic = getCardLogic();
        const policyCore = typeof cfg.getCpuPolicyCore === 'function' ? cfg.getCpuPolicyCore() : null;
        const opponentContext = buildOfferDecisionContext(opponentKey, level);

        for (const offer of offers) {
            if (!offer || !offer.cardId) continue;
            const cost = (cardLogic && typeof cardLogic.getCardCost === 'function')
                ? (cardLogic.getCardCost(offer.cardId) || 0)
                : 0;
            let score = cost * 0.45;
            if (
                policyCore &&
                typeof policyCore.scoreCardRetentionPriority === 'function' &&
                cardLogic &&
                typeof cardLogic.getCardDef === 'function' &&
                typeof cardLogic.getCardCost === 'function'
            ) {
                const retention = policyCore.scoreCardRetentionPriority(
                    offer.cardId,
                    cardLogic.getCardCost,
                    cardLogic.getCardDef,
                    opponentContext
                );
                const useDecision = (typeof policyCore.scoreCardUseDecision === 'function')
                    ? policyCore.scoreCardUseDecision(
                        offer.cardId,
                        cardLogic.getCardCost,
                        cardLogic.getCardDef,
                        opponentContext
                    )
                    : null;
                if (retention && Number.isFinite(retention.score)) score += Number(retention.score) * 0.9;
                if (useDecision && Number.isFinite(useDecision.score)) {
                    score += Number(useDecision.score) * 0.75;
                    if (useDecision.shouldUse === true) score += 16;
                }
            }
            if (score > bestScore || (score === bestScore && cost > bestCost)) {
                bestScore = score;
                bestCost = cost;
                target = offer;
            }
        }
        if (!target || !Number.isInteger(target.handIndex)) {
            cfg.clearCpuPendingEffect(playerKey);
            return;
        }
        cfg.cpuDebugLog(`[CPU] ${playerKey}: 断罪選択 index=${target.handIndex} card=${target.cardId} (score=${bestScore.toFixed(1)} cost=${bestCost})`);

        const pipelineResult = await cfg.runCpuPendingSelectionViaPipeline(
            playerKey,
            { condemnTargetIndex: target.handIndex },
            'CONDEMN_WILL'
        );
        if (isPendingPipelineHandled(pipelineResult)) return;

        const applyFn = cardLogic && typeof cardLogic.applyCondemnWill === 'function'
            ? cardLogic.applyCondemnWill
            : null;
        if (typeof applyFn === 'function') {
            const res = applyFn(cfg.getCardState(), playerKey, target.handIndex);
            if (!res || !res.applied) {
                cfg.clearCpuPendingEffect(playerKey);
            }
            cfg.emitCpuSelectionStateChange();
        }
    }

    async function cpuSelectTimeBombWithPolicy(playerKey: any): Promise<any> {
        const targets = getTargetsByMethod(playerKey, 'getTimeBombTargets', false);
        if (!targets.length) {
            cfg.cpuDebugLog(`[CPU] ${playerKey}: 時限爆弾対象なし`);
            cfg.clearCpuPendingEffect(playerKey);
            return;
        }

        const target = typeof cfg.chooseTimeBombTargetWithPolicy === 'function'
            ? cfg.chooseTimeBombTargetWithPolicy(playerKey, targets)
            : targets[0];
        if (!target) {
            cfg.clearCpuPendingEffect(playerKey);
            return;
        }
        cfg.cpuDebugLog(`[CPU] ${playerKey}: 時限爆弾ターゲット (${target.row}, ${target.col})`);

        const pipelineResult = await cfg.runCpuPendingSelectionViaPipeline(
            playerKey,
            { bombTarget: { row: target.row, col: target.col } },
            'TIME_BOMB'
        );
        if (isPendingPipelineHandled(pipelineResult)) return;

        const cardLogic = getCardLogic();
        const applyFn = cardLogic && typeof cardLogic.applyTimeBombWill === 'function'
            ? cardLogic.applyTimeBombWill
            : null;
        if (typeof applyFn === 'function') {
            const res = applyFn(cfg.getCardState(), cfg.getGameState(), playerKey, target.row, target.col);
            if (!res || !res.applied) {
                cfg.clearCpuPendingEffect(playerKey);
            }
            cfg.emitCpuSelectionStateChange();
        }
    }

    async function cpuSelectCaptureWillWithPolicy(playerKey: any): Promise<any> {
        return runTargetAction({
            playerKey,
            pendingType: 'CAPTURE_WILL',
            targets: getSelectableTargets(playerKey),
            noTargetLabel: '捕獲対象なし',
            targetLabel: '捕獲ターゲット',
            payloadKey: 'captureTarget',
            applyMethodName: 'applyCaptureWill',
            onMissingApply: 'clear-and-emit'
        });
    }

    async function cpuSelectCloneWillWithPolicy(playerKey: any): Promise<any> {
        const targets = getSelectableTargets(playerKey);
        if (!targets.length) {
            cfg.cpuDebugLog(`[CPU] ${playerKey}: 複製対象なし`);
            cfg.clearCpuPendingEffect(playerKey);
            return;
        }

        const eligibleTargets = typeof cfg.filterCloneTargetsForLv6 === 'function'
            ? cfg.filterCloneTargetsForLv6(playerKey, targets)
            : targets;
        if (!eligibleTargets.length) {
            cfg.cpuDebugLog(`[CPU] ${playerKey}: 複製対象なし (通常石は除外)`);
            cfg.clearCpuPendingEffect(playerKey);
            return;
        }

        const target = await cfg.choosePendingTargetWithPolicyAsync(playerKey, 'CLONE_WILL', eligibleTargets, null) || eligibleTargets[0];
        cfg.cpuDebugLog(`[CPU] ${playerKey}: 複製ターゲット (${target.row}, ${target.col})`);

        const pipelineResult = await cfg.runCpuPendingSelectionViaPipeline(
            playerKey,
            { cloneTarget: { row: target.row, col: target.col } },
            'CLONE_WILL'
        );
        if (isPendingPipelineHandled(pipelineResult)) return;

        const cardLogic = getCardLogic();
        const applyFn = cardLogic && typeof cardLogic.applyCloneWill === 'function'
            ? cardLogic.applyCloneWill
            : null;
        if (typeof applyFn === 'function') {
            const res = applyFn(cfg.getCardState(), cfg.getGameState(), playerKey, target.row, target.col);
            if (!res || !res.applied) {
                cfg.clearCpuPendingEffect(playerKey);
            }
            cfg.emitCpuSelectionStateChange();
        }
    }

    async function cpuSelectObserverWillWithPolicy(playerKey: any): Promise<any> {
        const pending = cfg.readCpuPendingEffect(playerKey);
        const offers = (pending && Array.isArray(pending.offers)) ? pending.offers.slice() : [];
        if (!offers.length) {
            cfg.cpuDebugLog(`[CPU] ${playerKey}: 観測者候補なし`);
            cfg.clearCpuPendingEffect(playerKey);
            return;
        }

        const cardLogic = getCardLogic();
        let target = offers[0];
        let bestCost = Number.NEGATIVE_INFINITY;
        for (const offer of offers) {
            if (!offer || !offer.cardId) continue;
            const cost = cardLogic && typeof cardLogic.getCardCost === 'function'
                ? (cardLogic.getCardCost(offer.cardId) || 0)
                : 0;
            if (cost > bestCost) {
                bestCost = cost;
                target = offer;
            }
        }
        if (!target || !Number.isInteger(target.handIndex)) {
            cfg.clearCpuPendingEffect(playerKey);
            return;
        }

        const pipelineResult = await cfg.runCpuPendingSelectionViaPipeline(
            playerKey,
            { observerWillTargetIndex: target.handIndex },
            'OBSERVER_WILL'
        );
        if (isPendingPipelineHandled(pipelineResult)) return;

        const applyFn = cardLogic && typeof cardLogic.applyObserverWillChoice === 'function'
            ? cardLogic.applyObserverWillChoice
            : null;
        if (typeof applyFn === 'function') {
            const res = applyFn(cfg.getCardState(), cfg.getGameState(), playerKey, target.handIndex);
            if (!res || !res.applied) {
                cfg.clearCpuPendingEffect(playerKey);
            }
            cfg.emitCpuSelectionStateChange();
        }
    }

    return {
        cpuSelectBlockadeWillWithPolicy,
        cpuSelectBoardExpansionWillWithPolicy,
        cpuSelectBoardShrinkWithPolicy,
        cpuSelectBuoyancyWillWithPolicy,
        cpuSelectCaptureWillWithPolicy,
        cpuSelectCellTeleportWillWithPolicy,
        cpuSelectCondemnWillWithPolicy,
        cpuSelectCloneWillWithPolicy,
        cpuSelectCorrosionWillWithPolicy,
        cpuSelectDestroyWithPolicy,
        cpuSelectExtendLifeWillWithPolicy,
        cpuSelectFreezeWillWithPolicy,
        cpuSelectGravityWillWithPolicy,
        cpuSelectGuardWillWithPolicy,
        cpuSelectHeavenBlessingWithPolicy,
        cpuSelectLivingWillWithPolicy,
        cpuSelectMeteorWillWithPolicy,
        cpuSelectObserverWillWithPolicy,
        cpuSelectPositionSwapWillWithPolicy,
        cpuSelectReverseWillWithPolicy,
        cpuSelectSeedWillWithPolicy,
        cpuSelectStrongWindWillWithPolicy,
        cpuSelectSuperAttractionWillWithPolicy,
        cpuSelectSuperBuoyancyWillWithPolicy,
        cpuSelectSuperGravityWillWithPolicy,
        cpuSelectSwapWithEnemyWithPolicy,
        cpuSelectTeleportWillWithPolicy,
        cpuSelectTemptWillWithPolicy,
        cpuSelectTimeBombWithPolicy,
        cpuSelectTrapWillWithPolicy
    };
}

module.exports = {
    createCpuDecisionPendingActions
};
