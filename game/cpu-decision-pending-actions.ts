type PendingActionsConfig = {
    choosePendingTargetWithPolicyAsync: (playerKey: any, pendingType: any, targets: any, pending: any) => Promise<any>;
    clearCpuPendingEffect: (playerKey: any) => any;
    cpuDebugLog: (...args: any[]) => void;
    emitCpuSelectionStateChange: () => any;
    getCardLogic: () => any;
    getCardState: () => any;
    getCpuRng: () => any;
    getGameState: () => any;
    handOffSelectionTurnInGameState: (playerKey: any) => any;
    maybeContinueCpuSelectionTurnHandoff: (playerKey: any, pendingType: any, playbackEvents: any, action?: any) => any;
    readCpuPendingEffect: (playerKey: any) => any;
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
        const pendingType = (pending && (pending.type === 'GUARD_WILL' || pending.type === 'GUARDIAN_GOD' || pending.type === 'HARD_WILL'))
            ? pending.type
            : 'GUARD_WILL';
        const isHardWill = pendingType === 'HARD_WILL';
        return runTargetAction({
            playerKey,
            pendingType,
            pending,
            targets: getSelectableTargets(playerKey),
            noTargetLabel: isHardWill ? '硬い意志対象なし' : '守る対象なし',
            targetLabel: isHardWill ? '硬い意志ターゲット' : '守るターゲット',
            payloadKey: 'guardTarget',
            applyMethodName: isHardWill ? 'applyHardWill' : 'applyGuardWill'
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

    return {
        cpuSelectBlockadeWillWithPolicy,
        cpuSelectBoardExpansionWillWithPolicy,
        cpuSelectBoardShrinkWithPolicy,
        cpuSelectBuoyancyWillWithPolicy,
        cpuSelectCaptureWillWithPolicy,
        cpuSelectCellTeleportWillWithPolicy,
        cpuSelectCorrosionWillWithPolicy,
        cpuSelectExtendLifeWillWithPolicy,
        cpuSelectFreezeWillWithPolicy,
        cpuSelectGravityWillWithPolicy,
        cpuSelectGuardWillWithPolicy,
        cpuSelectLivingWillWithPolicy,
        cpuSelectMeteorWillWithPolicy,
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
        cpuSelectTrapWillWithPolicy
    };
}

module.exports = {
    createCpuDecisionPendingActions
};
