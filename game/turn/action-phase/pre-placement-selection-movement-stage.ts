type MovementSelectionStageOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    action: any;
    prng: any;
    events: any[];
    pending: any;
    applyTrapEffectsAfterSelection: () => void;
};

type BasicMovementSelection = {
    targetField: string;
    methodName: string;
    eventType: string;
    errorMessage: string;
    usesPrng?: boolean;
    includesDestroyed?: boolean;
};

const BASIC_MOVEMENT_SELECTIONS: Record<string, BasicMovementSelection> = {
    STRONG_WIND_WILL: {
        targetField: 'strongWindTarget', methodName: 'applyStrongWindWill', eventType: 'strong_wind_selected',
        errorMessage: 'STRONG_WIND_WILL requires strongWindTarget before placement', usesPrng: true
    },
    BUOYANCY_WILL: {
        targetField: 'buoyancyTarget', methodName: 'applyBuoyancyWill', eventType: 'buoyancy_selected',
        errorMessage: 'BUOYANCY_WILL requires buoyancyTarget before placement', includesDestroyed: true
    },
    SUPER_BUOYANCY_WILL: {
        targetField: 'superBuoyancyTarget', methodName: 'applySuperBuoyancyWill', eventType: 'super_buoyancy_selected',
        errorMessage: 'SUPER_BUOYANCY_WILL requires superBuoyancyTarget before placement', includesDestroyed: true
    },
    GRAVITY_WILL: {
        targetField: 'gravityTarget', methodName: 'applyGravityWill', eventType: 'gravity_selected',
        errorMessage: 'GRAVITY_WILL requires gravityTarget before placement', includesDestroyed: true
    },
    SUPER_GRAVITY_WILL: {
        targetField: 'superGravityTarget', methodName: 'applySuperGravityWill', eventType: 'super_gravity_selected',
        errorMessage: 'SUPER_GRAVITY_WILL requires superGravityTarget before placement', includesDestroyed: true
    }
};

function resolveBasicMovementSelection(options: MovementSelectionStageOptions): any {
    const pendingType = options.pending && options.pending.type;
    const config = BASIC_MOVEMENT_SELECTIONS[pendingType];
    if (!config) return null;

    const target = options.action && options.action[config.targetField];
    if (target == null) {
        throw new Error(config.errorMessage);
    }
    if (!target) return { matched: true, result: false };

    const args = [options.cardState, options.gameState, options.playerKey, target.row, target.col];
    if (config.usesPrng) args.push(options.prng || undefined);
    const result = options.CardLogic[config.methodName](...args);
    const event: any = {
        type: config.eventType,
        player: options.playerKey,
        target,
        applied: !!(result && result.applied),
        from: result && result.from ? result.from : null,
        to: result && result.to ? result.to : null
    };
    if (config.includesDestroyed) {
        event.destroyed = result && Array.isArray(result.destroyed) ? result.destroyed.slice() : [];
    }
    options.events.push(event);
    options.applyTrapEffectsAfterSelection();
    return { matched: true, result: true };
}

function resolveSuperAttractionSelection(options: MovementSelectionStageOptions): any {
    const pending = options.pending;
    if (!pending || pending.type !== 'SUPER_ATTRACTION_WILL') return null;

    const target = options.action && options.action.superAttractionTarget;
    if (target == null) {
        throw new Error('SUPER_ATTRACTION_WILL requires superAttractionTarget before placement');
    }
    if (!target) return { matched: true, result: false };

    const result = options.CardLogic.applySuperAttractionWill(
        options.cardState,
        options.gameState,
        options.playerKey,
        target.row,
        target.col,
        options.prng || undefined
    );
    options.events.push({
        type: result && result.completed === false ? 'super_attraction_first_selected' : 'super_attraction_selected',
        player: options.playerKey,
        target,
        applied: !!(result && result.applied),
        completed: result && result.completed === false ? false : !!(result && result.applied),
        firstTarget: result && result.firstTarget ? result.firstTarget : null,
        from: result && result.from ? result.from : null,
        to: result && result.to ? result.to : null,
        destroyed: result && Array.isArray(result.destroyed) ? result.destroyed.slice() : [],
        selectedPathVariant: result && result.selectedPathVariant ? result.selectedPathVariant : null,
        pathCells: result && Array.isArray(result.pathCells) ? result.pathCells.slice() : [],
        segments: result && Array.isArray(result.segments) ? result.segments.slice() : [],
        waypoints: result && Array.isArray(result.waypoints) ? result.waypoints.slice() : []
    });
    options.applyTrapEffectsAfterSelection();
    return { matched: true, result: true };
}

function resolveTeleportSelection(options: MovementSelectionStageOptions): any {
    const pending = options.pending;
    if (!pending || (pending.type !== 'TELEPORT_WILL' && pending.type !== 'CELL_TELEPORT_WILL')) return null;

    const target = options.action && options.action.teleportTarget;
    if (target == null) {
        throw new Error(`${pending.type} requires teleportTarget before placement`);
    }
    if (!target) return { matched: true, result: false };

    const result = pending.type === 'CELL_TELEPORT_WILL'
        ? options.CardLogic.applyCellTeleportWill(
            options.cardState,
            options.gameState,
            options.playerKey,
            target.row,
            target.col,
            options.prng || undefined
        )
        : options.CardLogic.applyTeleportWill(
            options.cardState,
            options.gameState,
            options.playerKey,
            target.row,
            target.col,
            options.prng || undefined
        );
    options.events.push({
        type: 'teleport_selected',
        player: options.playerKey,
        cardType: pending.type,
        target,
        applied: !!(result && result.applied),
        from: result && result.from ? result.from : null,
        to: result && result.to ? result.to : null,
        createdDestination: !!(result && result.createdDestination)
    });
    options.applyTrapEffectsAfterSelection();
    return { matched: true, result: true };
}

function resolveMovementSelection(options: MovementSelectionStageOptions): any {
    return resolveBasicMovementSelection(options)
        || resolveSuperAttractionSelection(options)
        || resolveTeleportSelection(options);
}

export = {
    resolveMovementSelection
};
