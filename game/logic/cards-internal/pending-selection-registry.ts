/**
 * @file pending-selection-registry.ts
 * @description Central registry for pending target-selection card contracts.
 */

interface PendingSelectionTargetConfig {
    method: string;
    argsKey: string;
    minimumCount?: number;
}

interface PendingSelectionActionConfig {
    policyMethod: string;
    field: string;
}

interface PendingSelectionRegistryEntry {
    kind: string;
    turnOutcome: string;
    deferNetworkPublish: boolean;
    waitForPlaybackIdle: boolean;
    needsTargetSelection: boolean;
    cancellable?: boolean;
    dispatchKey: string;
    target?: PendingSelectionTargetConfig;
    action?: PendingSelectionActionConfig;
    cpuHandlerNames?: string[];
}

const PENDING_SELECTION_REGISTRY: Record<string, PendingSelectionRegistryEntry> = Object.freeze({
    DESTROY_ONE_STONE: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        cancellable: true,
        dispatchKey: 'destroy',
        target: { method: 'getDestroyTargets', argsKey: 'board' },
        action: { policyMethod: 'chooseDestroyTarget', field: 'destroyTarget' },
        cpuHandlerNames: ['cpuSelectDestroyWithPolicy']
    },
    REVERSE_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'reverse_will',
        target: { method: 'getReverseWillTargets', argsKey: 'board' },
        action: { policyMethod: 'chooseReverseWillTarget', field: 'reverseWillTarget' },
        cpuHandlerNames: ['cpuSelectReverseWillWithPolicy']
    },
    STRONG_WIND_WILL: {
        kind: 'end_turn',
        turnOutcome: 'end_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'strong_wind',
        target: { method: 'getStrongWindTargets', argsKey: 'board' },
        action: { policyMethod: 'chooseStrongWindTarget', field: 'strongWindTarget' },
        cpuHandlerNames: ['cpuSelectStrongWindWillWithPolicy']
    },
    BUOYANCY_WILL: {
        kind: 'end_turn',
        turnOutcome: 'end_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'buoyancy',
        target: { method: 'getBuoyancyTargets', argsKey: 'board' },
        action: { policyMethod: 'chooseBuoyancyTarget', field: 'buoyancyTarget' },
        cpuHandlerNames: ['cpuSelectBuoyancyWillWithPolicy']
    },
    SUPER_BUOYANCY_WILL: {
        kind: 'end_turn',
        turnOutcome: 'end_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'super_buoyancy',
        target: { method: 'getSuperBuoyancyTargets', argsKey: 'board' },
        action: { policyMethod: 'chooseSuperBuoyancyTarget', field: 'superBuoyancyTarget' },
        cpuHandlerNames: ['cpuSelectSuperBuoyancyWillWithPolicy']
    },
    GRAVITY_WILL: {
        kind: 'end_turn',
        turnOutcome: 'end_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'gravity',
        target: { method: 'getGravityTargets', argsKey: 'board' },
        action: { policyMethod: 'chooseGravityTarget', field: 'gravityTarget' },
        cpuHandlerNames: ['cpuSelectGravityWillWithPolicy']
    },
    SUPER_GRAVITY_WILL: {
        kind: 'end_turn',
        turnOutcome: 'end_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'super_gravity',
        target: { method: 'getSuperGravityTargets', argsKey: 'board' },
        action: { policyMethod: 'chooseSuperGravityTarget', field: 'superGravityTarget' },
        cpuHandlerNames: ['cpuSelectSuperGravityWillWithPolicy']
    },
    SUPER_ATTRACTION_WILL: {
        kind: 'multi_stage',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'super_attraction',
        target: { method: 'getSuperAttractionTargets', argsKey: 'player_pending' },
        action: { policyMethod: 'chooseSuperAttractionTarget', field: 'superAttractionTarget' },
        cpuHandlerNames: ['cpuSelectSuperAttractionWillWithPolicy']
    },
    TELEPORT_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'teleport',
        target: { method: 'getTeleportTargets', argsKey: 'board' },
        action: { policyMethod: 'chooseTeleportTarget', field: 'teleportTarget' },
        cpuHandlerNames: ['cpuSelectTeleportWillWithPolicy']
    },
    CELL_TELEPORT_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'cell_teleport',
        target: { method: 'getCellTeleportTargets', argsKey: 'board' },
        action: { policyMethod: 'chooseCellTeleportTarget', field: 'teleportTarget' },
        cpuHandlerNames: ['cpuSelectCellTeleportWillWithPolicy']
    },
    TEMPT_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'tempt',
        target: { method: 'getTemptWillTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseTemptTarget', field: 'temptTarget' },
        cpuHandlerNames: ['cpuSelectTemptWillWithPolicy']
    },
    CAPTURE_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'capture',
        target: { method: 'getCaptureWillTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseCaptureTarget', field: 'captureTarget' },
        cpuHandlerNames: ['cpuSelectCaptureWillWithPolicy']
    },
    TRAP_WILL: {
        kind: 'end_turn',
        turnOutcome: 'end_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'trap',
        target: { method: 'getTrapTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseTrapTarget', field: 'trapTarget' },
        cpuHandlerNames: ['cpuSelectTrapWillWithPolicy']
    },
    GUARD_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'guard',
        target: { method: 'getGuardTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseGuardTarget', field: 'guardTarget' },
        cpuHandlerNames: ['cpuSelectGuardWillWithPolicy']
    },
    GUARDIAN_GOD: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'guard',
        target: { method: 'getGuardTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseGuardTarget', field: 'guardTarget' },
        cpuHandlerNames: ['cpuSelectGuardWillWithPolicy']
    },
    LIVING_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'living_will',
        target: { method: 'getLivingWillTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseLivingWillTarget', field: 'livingWillTarget' },
        cpuHandlerNames: ['cpuSelectLivingWillWithPolicy']
    },
    EXTEND_LIFE_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'extend_life',
        target: { method: 'getExtendLifeTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseExtendLifeTarget', field: 'extendTarget' },
        cpuHandlerNames: ['cpuSelectExtendLifeWillWithPolicy']
    },
    EXTEND_LIFE_GOD: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'extend_life',
        target: { method: 'getExtendLifeTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseExtendLifeTarget', field: 'extendTarget' },
        cpuHandlerNames: ['cpuSelectExtendLifeWillWithPolicy']
    },
    CORROSION_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'corrosion',
        target: { method: 'getCorrosionTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseCorrosionTarget', field: 'corrosionTarget' },
        cpuHandlerNames: ['cpuSelectCorrosionWillWithPolicy']
    },
    CLONE_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'clone',
        target: { method: 'getCloneTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseCloneTarget', field: 'cloneTarget' },
        cpuHandlerNames: ['cpuSelectCloneWillWithPolicy']
    },
    BLOCKADE_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        cancellable: true,
        dispatchKey: 'blockade',
        target: { method: 'getBlockadeTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseBlockadeTarget', field: 'blockadeTarget' },
        cpuHandlerNames: ['cpuSelectBlockadeWillWithPolicy']
    },
    BOARD_EXPANSION_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        cancellable: true,
        dispatchKey: 'board_expansion',
        target: { method: 'getBoardExpansionTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseBoardExpansionTarget', field: 'expansionTarget' },
        cpuHandlerNames: ['cpuSelectBoardExpansionWillWithPolicy']
    },
    BOARD_EXPANSION_GOD: {
        kind: 'multi_stage',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        cancellable: true,
        dispatchKey: 'board_expansion',
        target: { method: 'getBoardExpansionGodTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseBoardExpansionTarget', field: 'expansionTarget' },
        cpuHandlerNames: ['cpuSelectBoardExpansionWillWithPolicy']
    },
    BOARD_SHRINK_WILL: {
        kind: 'multi_stage',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        cancellable: true,
        dispatchKey: 'board_shrink',
        target: { method: 'getBoardShrinkTargets', argsKey: 'player', minimumCount: 3 },
        action: { policyMethod: 'chooseBoardShrinkTarget', field: 'shrinkTarget' },
        cpuHandlerNames: ['cpuSelectBoardShrinkWithPolicy']
    },
    BOARD_SHRINK_GOD: {
        kind: 'multi_stage',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        cancellable: true,
        dispatchKey: 'board_shrink',
        target: { method: 'getBoardShrinkGodTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseBoardShrinkTarget', field: 'shrinkTarget' },
        cpuHandlerNames: ['cpuSelectBoardShrinkWithPolicy']
    },
    FREEZE_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        cancellable: true,
        dispatchKey: 'freeze',
        target: { method: 'getFreezeTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseFreezeTarget', field: 'freezeTarget' },
        cpuHandlerNames: ['cpuSelectFreezeWillWithPolicy']
    },
    SEED_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        cancellable: true,
        dispatchKey: 'seed',
        target: { method: 'getSeedTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseSeedTarget', field: 'seedTarget' },
        cpuHandlerNames: ['cpuSelectSeedWillWithPolicy']
    },
    POSITION_SWAP_WILL: {
        kind: 'multi_stage',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        cancellable: true,
        dispatchKey: 'position_swap',
        target: { method: 'getPositionSwapTargets', argsKey: 'player_pending', minimumCount: 2 },
        action: { policyMethod: 'choosePositionSwapTarget', field: 'positionSwapTarget' },
        cpuHandlerNames: ['cpuSelectPositionSwapWillWithPolicy']
    },
    METEOR_WILL: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        cancellable: true,
        dispatchKey: 'meteor',
        target: { method: 'getMeteorTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseMeteorTarget', field: 'meteorTarget' },
        cpuHandlerNames: ['cpuSelectMeteorWillWithPolicy']
    },
    TIME_BOMB: {
        kind: 'continue_turn',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'time_bomb',
        target: { method: 'getTimeBombTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseTimeBombTarget', field: 'bombTarget' },
        cpuHandlerNames: ['cpuSelectTimeBombWithPolicy']
    },
    SWAP_WITH_ENEMY: {
        kind: 'end_turn',
        turnOutcome: 'end_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'swap_with_enemy',
        target: { method: 'getSwapTargets', argsKey: 'player' },
        action: { policyMethod: 'chooseSwapTarget', field: 'swapTarget' },
        cpuHandlerNames: ['cpuSelectSwapWithEnemyWithPolicy']
    },
    HEAVEN_BLESSING: {
        kind: 'hand_overlay',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'heaven_blessing',
        cpuHandlerNames: ['cpuSelectHeavenBlessingWithPolicy']
    },
    CONDEMN_WILL: {
        kind: 'hand_overlay',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'condemn',
        cpuHandlerNames: ['cpuSelectCondemnWillWithPolicy']
    },
    OBSERVER_WILL: {
        kind: 'hand_overlay',
        turnOutcome: 'continue_turn',
        deferNetworkPublish: true,
        waitForPlaybackIdle: true,
        needsTargetSelection: true,
        dispatchKey: 'observer_will',
        cpuHandlerNames: ['cpuSelectObserverWillWithPolicy']
    }
});

function normalizeCardType(cardType: any): string {
    return String(cardType || '').trim().toUpperCase();
}

function getPendingSelectionRegistry(): Record<string, PendingSelectionRegistryEntry> {
    return PENDING_SELECTION_REGISTRY;
}

function getPendingSelectionEntry(cardType: any): PendingSelectionRegistryEntry | null {
    const normalizedType = normalizeCardType(cardType);
    return normalizedType && PENDING_SELECTION_REGISTRY[normalizedType]
        ? PENDING_SELECTION_REGISTRY[normalizedType]
        : null;
}

function getPendingSelectionTargetMethod(cardType: any): string | null {
    const entry = getPendingSelectionEntry(cardType);
    return entry && entry.target && entry.target.method ? entry.target.method : null;
}

function buildPendingSelectionTargetContext(source: any): Record<string, any> {
    const targetContext: Record<string, any> = {};
    const sourceObject = (source && typeof source === 'object') ? source : {};
    Object.keys(PENDING_SELECTION_REGISTRY).forEach((cardType) => {
        const entry = PENDING_SELECTION_REGISTRY[cardType];
        const method = entry && entry.target && entry.target.method;
        if (method && typeof sourceObject[method] === 'function') {
            targetContext[method] = sourceObject[method];
        }
    });
    return targetContext;
}

function getPendingSelectionActionConfig(cardType: any): PendingSelectionActionConfig | null {
    const entry = getPendingSelectionEntry(cardType);
    return entry && entry.action ? entry.action : null;
}

function areCpuHandlerNameListsEqual(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) return false;
    }
    return true;
}

function buildPendingSelectionCpuHandlerNamesByDispatchKey(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    const firstCardTypeByDispatchKey: Record<string, string> = {};
    Object.keys(PENDING_SELECTION_REGISTRY).forEach((cardType) => {
        const entry = PENDING_SELECTION_REGISTRY[cardType];
        if (!entry || !entry.dispatchKey || !Array.isArray(entry.cpuHandlerNames)) return;
        const nextHandlerNames = entry.cpuHandlerNames.slice();
        if (!out[entry.dispatchKey]) {
            out[entry.dispatchKey] = nextHandlerNames;
            firstCardTypeByDispatchKey[entry.dispatchKey] = cardType;
            return;
        }
        if (!areCpuHandlerNameListsEqual(out[entry.dispatchKey], nextHandlerNames)) {
            throw new Error(
                `Pending selection dispatchKey "${entry.dispatchKey}" has inconsistent CPU handlers between `
                + `${firstCardTypeByDispatchKey[entry.dispatchKey]} and ${cardType}`
            );
        }
    });
    return Object.freeze(out);
}

const PENDING_SELECTION_CPU_HANDLER_NAMES_BY_DISPATCH_KEY = buildPendingSelectionCpuHandlerNamesByDispatchKey();

function getPendingSelectionCpuHandlerNamesByDispatchKey(): Record<string, string[]> {
    return PENDING_SELECTION_CPU_HANDLER_NAMES_BY_DISPATCH_KEY;
}

export = {
    PENDING_SELECTION_REGISTRY,
    getPendingSelectionRegistry,
    getPendingSelectionEntry,
    getPendingSelectionTargetMethod,
    buildPendingSelectionTargetContext,
    getPendingSelectionActionConfig,
    getPendingSelectionCpuHandlerNamesByDispatchKey
};
