import {
    createCardRuntimeUnavailableError,
    isCardRuntimeUnavailableError
} from '../logic/card-runtime-errors';

export interface TurnCardLogicPort {
    readonly flushPresentationEvents: (cardState: unknown) => unknown[];
    readonly getCardContext: (...args: unknown[]) => unknown;
    readonly hasUsableCard: (...args: unknown[]) => boolean;
    readonly applyCardUsage: (...args: unknown[]) => unknown;
}

export interface TurnCorePort {
    readonly BLACK: unknown;
    readonly WHITE: unknown;
    readonly getLegalMoves: (...args: unknown[]) => unknown[];
}

export interface TurnPhaseManifest {
    readonly applyTurnStartPhase: (...args: any[]) => any;
    readonly applyCardUsagePhase: (...args: any[]) => any;
    readonly applyActionPhase: (...args: any[]) => any;
}

export interface TurnBoardOpsPort {
    readonly setActionContext: (...args: unknown[]) => unknown;
    readonly clearActionContext: (...args: unknown[]) => unknown;
}

export interface TurnSubPlacementPort {
    readonly isSubPlacementTurnActive: (...args: unknown[]) => boolean;
}

export interface TurnRuntimeServices {
    readonly cardLogic: TurnCardLogicPort;
    readonly core: TurnCorePort;
    readonly phases: TurnPhaseManifest;
    readonly boardOps: TurnBoardOpsPort;
    readonly subPlacement: TurnSubPlacementPort;
    readonly deepClone: (value: any) => any;
    readonly normalizePlayerKey: (player: unknown) => string | null;
    readonly validateState?: (gameState: unknown, cardState: unknown) => { valid: boolean; errors?: unknown };
    readonly computeStateHash: (gameState: unknown, cardState: unknown, prngState: unknown) => string | null;
}

const REQUIRED_METHODS = Object.freeze({
    cardLogic: Object.freeze(['flushPresentationEvents', 'getCardContext', 'hasUsableCard', 'applyCardUsage']),
    core: Object.freeze(['getLegalMoves']),
    phases: Object.freeze(['applyTurnStartPhase', 'applyCardUsagePhase', 'applyActionPhase']),
    boardOps: Object.freeze(['setActionContext', 'clearActionContext']),
    subPlacement: Object.freeze(['isSubPlacementTurnActive'])
});

function assertMethods(value: unknown, capability: keyof typeof REQUIRED_METHODS): void {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
        throw createCardRuntimeUnavailableError(capability, 'turn-phases');
    }
    for (const method of REQUIRED_METHODS[capability]) {
        if (typeof (value as Record<string, unknown>)[method] !== 'function') {
            throw createCardRuntimeUnavailableError(`${capability}.${method}`, 'turn-phases');
        }
    }
}

export function createTurnRuntimeServices(input: TurnRuntimeServices): TurnRuntimeServices {
    if (!input || typeof input !== 'object') {
        throw createCardRuntimeUnavailableError('turn-runtime-services', 'turn-phases');
    }
    assertMethods(input.cardLogic, 'cardLogic');
    assertMethods(input.core, 'core');
    assertMethods(input.phases, 'phases');
    assertMethods(input.boardOps, 'boardOps');
    assertMethods(input.subPlacement, 'subPlacement');
    if (typeof input.deepClone !== 'function') {
        throw createCardRuntimeUnavailableError('deepClone', 'turn-phases');
    }
    if (typeof input.normalizePlayerKey !== 'function') {
        throw createCardRuntimeUnavailableError('normalizePlayerKey', 'turn-phases');
    }
    if (typeof input.computeStateHash !== 'function') {
        throw createCardRuntimeUnavailableError('computeStateHash', 'turn-phases');
    }
    if (typeof input.validateState !== 'undefined' && typeof input.validateState !== 'function') {
        throw createCardRuntimeUnavailableError('validateState', 'turn-phases');
    }
    return Object.freeze({ ...input });
}

export function assertTurnRuntimeServices(value: unknown): asserts value is TurnRuntimeServices {
    if (!value || typeof value !== 'object' || !Object.isFrozen(value)) {
        throw createCardRuntimeUnavailableError('turn-runtime-services', 'turn-phases');
    }
    const services = value as TurnRuntimeServices;
    assertMethods(services.cardLogic, 'cardLogic');
    assertMethods(services.core, 'core');
    assertMethods(services.phases, 'phases');
    assertMethods(services.boardOps, 'boardOps');
    assertMethods(services.subPlacement, 'subPlacement');
    if (typeof services.deepClone !== 'function'
        || typeof services.normalizePlayerKey !== 'function'
        || typeof services.computeStateHash !== 'function') {
        throw createCardRuntimeUnavailableError('turn-runtime-function', 'turn-phases');
    }
}

export { isCardRuntimeUnavailableError };
