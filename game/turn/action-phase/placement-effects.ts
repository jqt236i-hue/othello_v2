type ResolvePlacementEffectsOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    action: any;
    flipCount: number;
    othelloMode: boolean;
    boardBonusGained: number;
    numberCellMultiplierConfig: any;
    events: any[];
};

function resolvePlacementEffects(options: ResolvePlacementEffectsOptions): any {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolvePlacementEffectsOptions);
    const action = opts.action || {};
    const effects = opts.othelloMode
        ? {}
        : opts.CardLogic.applyPlacementEffects(opts.cardState, opts.gameState, opts.playerKey, action.row, action.col, opts.flipCount);

    if (!opts.othelloMode && opts.numberCellMultiplierConfig && effects && opts.numberCellMultiplierConfig.gainField && opts.boardBonusGained > 0) {
        effects[opts.numberCellMultiplierConfig.effectFlag] = true;
        effects[opts.numberCellMultiplierConfig.gainField] = opts.boardBonusGained;
        const extraEffectFlags = Array.isArray(opts.numberCellMultiplierConfig.extraEffectFlags)
            ? opts.numberCellMultiplierConfig.extraEffectFlags
            : [];
        const extraGainFields = Array.isArray(opts.numberCellMultiplierConfig.extraGainFields)
            ? opts.numberCellMultiplierConfig.extraGainFields
            : [];
        for (const flag of extraEffectFlags) {
            if (flag) effects[flag] = true;
        }
        for (const field of extraGainFields) {
            if (field) effects[field] = opts.boardBonusGained;
        }
    }

    opts.events.push({
        type: 'placement_effects',
        player: opts.playerKey,
        row: action.row,
        col: action.col,
        effects
    });

    return effects;
}

const ActionPhasePlacementEffectsModule = {
    resolvePlacementEffects
};

export = ActionPhasePlacementEffectsModule;
