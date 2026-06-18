type TheoryIncarnationBindingOptions = {
    MARKER_KINDS: any;
    BLACK: any;
    WHITE: any;
    EMPTY: any;
    CARD_DEFS: any;
    constants: any;
    SpecialStoneRegistry: any;
    ManifestStoneRegistry: any;
    SpecialStoneMarkerFactory: any;
    Core: any;
    BoardOps: any;
    spawnAndFlipPlacement: any;
    resolveSafeCardContext: any;
    resolveHyperactiveFlipEvasion: any;
    clearBombAt: any;
    clearHyperactiveAtPositions: any;
    addMarker: any;
    getMarkers: any;
    removeMarkerById: any;
    getCellValueForCard: any;
    setCellValueForCard: any;
    isBlockedCell: any;
    sampleRandomPositions: any;
    revertSpecialStoneWithPresentation: any;
    addChargeWithTotal: any;
    spawnAt: any;
};

function buildTheoryIncarnationResolutionDeps(options: TheoryIncarnationBindingOptions): any {
    const opts = (options && typeof options === 'object') ? options : ({} as TheoryIncarnationBindingOptions);
    return {
        MARKER_KINDS: opts.MARKER_KINDS,
        BLACK: opts.BLACK,
        WHITE: opts.WHITE,
        EMPTY: opts.EMPTY,
        CARD_DEFS: opts.CARD_DEFS,
        constants: opts.constants,
        SpecialStoneRegistry: opts.SpecialStoneRegistry,
        ManifestStoneRegistry: opts.ManifestStoneRegistry,
        SpecialStoneMarkerFactory: opts.SpecialStoneMarkerFactory,
        Core: opts.Core,
        BoardOps: opts.BoardOps,
        spawnAndFlipPlacement: opts.spawnAndFlipPlacement,
        resolveSafeCardContext: opts.resolveSafeCardContext,
        resolveHyperactiveFlipEvasion: opts.resolveHyperactiveFlipEvasion,
        clearBombAt: opts.clearBombAt,
        clearHyperactiveAtPositions: opts.clearHyperactiveAtPositions,
        addMarker: opts.addMarker,
        getMarkers: opts.getMarkers,
        removeMarkerById: opts.removeMarkerById,
        getCellValueForCard: opts.getCellValueForCard,
        setCellValueForCard: opts.setCellValueForCard,
        isBlockedCell: opts.isBlockedCell,
        sampleRandomPositions: opts.sampleRandomPositions,
        revertSpecialStoneWithPresentation: opts.revertSpecialStoneWithPresentation,
        addChargeWithTotal: opts.addChargeWithTotal,
        spawnAt: opts.spawnAt
    };
}

const CardTheoryIncarnationBindings = {
    buildTheoryIncarnationResolutionDeps
};

const theoryIncarnationBindingsRuntimeRoot = typeof self !== 'undefined'
    ? (self as any)
    : (typeof global !== 'undefined' ? (global as any) : null);

if (theoryIncarnationBindingsRuntimeRoot) {
    theoryIncarnationBindingsRuntimeRoot.CardTheoryIncarnationBindings = CardTheoryIncarnationBindings;
}

module.exports = CardTheoryIncarnationBindings;
