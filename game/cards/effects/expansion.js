/**
 * @file expansion.js
 * @description Board Expansion helpers wrapper (delegates to game/logic/cards/expansion.js)
 */

'use strict';

const ExpansionModule = require('../../logic/cards/expansion');

module.exports = {
    isMainBoardCellForCard: ExpansionModule.isMainBoardCellForCard,
    resolveExpansionSideForCard: ExpansionModule.resolveExpansionSideForCard,
    normalizeExpansionOwnerForCard: ExpansionModule.normalizeExpansionOwnerForCard,
    isExpansionCoordinateForCard: ExpansionModule.isExpansionCoordinateForCard,
    getExpansionDescriptorsForCard: ExpansionModule.getExpansionDescriptorsForCard,
    syncLegacyExpansionFieldsForCard: ExpansionModule.syncLegacyExpansionFieldsForCard,
    ensureMutableBoardExpansionForCard: ExpansionModule.ensureMutableBoardExpansionForCard,
    writeExpansionDescriptorsForCard: ExpansionModule.writeExpansionDescriptorsForCard,
    getCellValueForCard: ExpansionModule.getCellValueForCard,
    setCellValueForCard: ExpansionModule.setCellValueForCard,
    getBoardExpansionGodCornerDescriptorsForCard: ExpansionModule.getBoardExpansionGodCornerDescriptorsForCard,
    getBoardExpansionGodPendingSelectionsForCard: ExpansionModule.getBoardExpansionGodPendingSelectionsForCard,
    getBoardExpansionGodAdditionsForCard: ExpansionModule.getBoardExpansionGodAdditionsForCard,
    getBoardExpansionWillCellDescriptorsForCard: ExpansionModule.getBoardExpansionWillCellDescriptorsForCard,
    ensureExpansionCellForCard: ExpansionModule.ensureExpansionCellForCard,
    buildInitialBoardBonusMap: ExpansionModule.buildInitialBoardBonusMap
};
