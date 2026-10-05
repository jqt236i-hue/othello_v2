type CardBoardConfigurationConfig = {
    boardUtils?: any;
};

export function createCardBoardConfiguration(config: CardBoardConfigurationConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CardBoardConfigurationConfig;
    const boardUtils = cfg.boardUtils;
    const requiredMethods = [
        'resolveBoardConfig',
        'createEmptyBoard',
        'getOpeningPlacements',
        'getOpeningCells',
        'collectMainBoardCoordinates'
    ];

    for (const method of requiredMethods) {
        if (!boardUtils || typeof boardUtils[method] !== 'function') {
            throw new Error(`[cards] SharedBoardUtils.${method} is required`);
        }
    }

    return {
        resolveCardBoardConfig: (boardOrConfig?: any) => boardUtils.resolveBoardConfig(boardOrConfig),
        createStoneIdBoard: (boardOrConfig: any) => (
            boardUtils.createEmptyBoard(boardUtils.resolveBoardConfig(boardOrConfig), null)
        ),
        getOpeningPlacementsForState: (boardOrConfig: any) => boardUtils.getOpeningPlacements(boardOrConfig),
        getOpeningCellsForState: (boardOrConfig: any) => boardUtils.getOpeningCells(boardOrConfig),
        getMainBoardCellCountForState: (boardOrConfig: any) => boardUtils.collectMainBoardCoordinates(boardOrConfig).length
    };
}

module.exports = {
    createCardBoardConfiguration
};
