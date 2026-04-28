// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file expansion.ts
 * @description Board Expansion helpers wrapper (delegates to game/logic/cards/expansion.js)
 */
const ExpansionModule = require("../../logic/cards/expansion");
const exports = {
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
module.exports = exports;

export {};
