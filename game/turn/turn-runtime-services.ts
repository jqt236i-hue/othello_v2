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
    readonly setActionContext?: (...args: unknown[]) => unknown;
    readonly clearActionContext?: (...args: unknown[]) => unknown;
}

export interface TurnSubPlacementPort {
    readonly isSubPlacementTurnActive?: (...args: unknown[]) => boolean;
}

export interface TurnRuntimeServices {
    readonly cardLogic: TurnCardLogicPort;
    readonly core: TurnCorePort;
    readonly phases: TurnPhaseManifest;
    readonly boardOps?: TurnBoardOpsPort;
    readonly subPlacement?: TurnSubPlacementPort;
    readonly deepClone: (value: any) => any;
    readonly normalizePlayerKey: (player: unknown) => string | null;
    readonly validateState?: (gameState: unknown, cardState: unknown) => { valid: boolean; errors?: unknown };
    readonly computeStateHash: (gameState: unknown, cardState: unknown, prngState: unknown) => string | null;
}

const REQUIRED_METHODS = Object.freeze({
    cardLogic: Object.freeze(['flushPresentationEvents', 'getCardContext', 'hasUsableCard', 'applyCardUsage']),
    core: Object.freeze(['getLegalMoves']),
    phases: Object.freeze(['applyTurnStartPhase', 'applyCardUsagePhase', 'applyActionPhase'])
});

const REQUIRED_SERVICE_KEYS = Object.freeze([
    'cardLogic',
    'core',
    'phases',
    'deepClone',
    'normalizePlayerKey',
    'computeStateHash'
] as const);

const OPTIONAL_SERVICE_KEYS = Object.freeze([
    'boardOps',
    'subPlacement',
    'validateState'
] as const);

const ALLOWED_SERVICE_KEYS = new Set<string>([
    ...REQUIRED_SERVICE_KEYS,
    ...OPTIONAL_SERVICE_KEYS
]);

function unavailable(capability: string): never {
    throw createCardRuntimeUnavailableError(capability, 'turn-phases');
}

function readOwnKeys(value: object): PropertyKey[] {
    try {
        return Reflect.ownKeys(value);
    } catch (_error) {
        return unavailable('turn-runtime-services');
    }
}

function readOwnDataDescriptor(value: object, key: PropertyKey): PropertyDescriptor {
    let descriptor: PropertyDescriptor | undefined;
    try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch (_error) {
        return unavailable(typeof key === 'string' ? key : 'turn-runtime-services');
    }
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        return unavailable(typeof key === 'string' ? key : 'turn-runtime-services');
    }
    return descriptor;
}

function assertExactServiceKeys(value: object): PropertyKey[] {
    const keys = readOwnKeys(value);
    for (const key of keys) {
        if (typeof key !== 'string' || !ALLOWED_SERVICE_KEYS.has(key)) {
            unavailable('turn-runtime-services');
        }
    }
    for (const key of REQUIRED_SERVICE_KEYS) {
        if (!keys.includes(key)) unavailable(key);
    }
    return keys;
}

function snapshotServiceSlots(input: object): TurnRuntimeServices {
    const snapshot: Record<string, unknown> = {};
    for (const key of assertExactServiceKeys(input)) {
        snapshot[key as string] = readOwnDataDescriptor(input, key).value;
    }
    return snapshot as unknown as TurnRuntimeServices;
}

function assertMethods(value: unknown, capability: keyof typeof REQUIRED_METHODS): void {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
        throw createCardRuntimeUnavailableError(capability, 'turn-phases');
    }
    for (const method of REQUIRED_METHODS[capability]) {
        let descriptor: PropertyDescriptor | undefined;
        try {
            descriptor = Object.getOwnPropertyDescriptor(value, method);
        } catch (_error) {
            unavailable(`${capability}.${method}`);
        }
        if (
            !descriptor
            || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
            || typeof descriptor.value !== 'function'
        ) {
            throw createCardRuntimeUnavailableError(`${capability}.${method}`, 'turn-phases');
        }
    }
}

function assertCoreConstants(value: unknown): void {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
        unavailable('core');
    }
    const black = readOwnDataDescriptor(value, 'BLACK').value;
    const white = readOwnDataDescriptor(value, 'WHITE').value;
    if (typeof black === 'undefined' || typeof white === 'undefined' || Object.is(black, white)) {
        unavailable('core.player-constants');
    }
}

function assertServiceFunctions(services: TurnRuntimeServices): void {
    if (typeof services.deepClone !== 'function') {
        unavailable('deepClone');
    }
    if (typeof services.normalizePlayerKey !== 'function') {
        unavailable('normalizePlayerKey');
    }
    if (typeof services.computeStateHash !== 'function') {
        unavailable('computeStateHash');
    }
    if (typeof services.validateState !== 'undefined' && typeof services.validateState !== 'function') {
        unavailable('validateState');
    }
}

export function createTurnRuntimeServices(input: TurnRuntimeServices): TurnRuntimeServices {
    if (!input || typeof input !== 'object') {
        throw createCardRuntimeUnavailableError('turn-runtime-services', 'turn-phases');
    }
    const snapshot = snapshotServiceSlots(input);
    assertMethods(snapshot.cardLogic, 'cardLogic');
    assertMethods(snapshot.core, 'core');
    assertCoreConstants(snapshot.core);
    assertMethods(snapshot.phases, 'phases');
    assertServiceFunctions(snapshot);
    return Object.freeze(snapshot);
}

export function assertTurnRuntimeServices(value: unknown): asserts value is TurnRuntimeServices {
    if (!value || typeof value !== 'object') {
        throw createCardRuntimeUnavailableError('turn-runtime-services', 'turn-phases');
    }
    try {
        if (!Object.isFrozen(value)) unavailable('turn-runtime-services');
    } catch (error) {
        if (isCardRuntimeUnavailableError(error)) throw error;
        unavailable('turn-runtime-services');
    }
    const services = snapshotServiceSlots(value);
    assertMethods(services.cardLogic, 'cardLogic');
    assertMethods(services.core, 'core');
    assertCoreConstants(services.core);
    assertMethods(services.phases, 'phases');
    assertServiceFunctions(services);
}

export { isCardRuntimeUnavailableError };
