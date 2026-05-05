/**
 * @file expansion.ts
 * @description Board Expansion helpers wrapper (delegates to game/logic/cards/expansion.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import ExpansionModule = require('../../logic/cards/expansion');


const _exports: any = {
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

export = _exports;
