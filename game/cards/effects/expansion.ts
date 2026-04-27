/**
 * @file expansion.ts
 * @description Board Expansion helpers wrapper (delegates to game/logic/cards/expansion.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as ExpansionModule from '../../logic/cards/expansion';

interface ExpansionExports {
  isMainBoardCellForCard: (row: number, col: number, gameState: GameState) => boolean;
  resolveExpansionSideForCard: (side: string | null, row: number, col: number, gameState: GameState) => string | null;
  normalizeExpansionOwnerForCard: (owner: number) => number;
  isExpansionCoordinateForCard: (row: number, col: number, gameState: GameState) => boolean;
  getExpansionDescriptorsForCard: (gameState: GameState) => any[];
  syncLegacyExpansionFieldsForCard: (boardExpansion: any) => void;
  ensureMutableBoardExpansionForCard: (gameState: GameState) => any;
  writeExpansionDescriptorsForCard: (gameState: GameState, cells: any[]) => void;
  getCellValueForCard: (gameState: GameState, row: number, col: number) => number | null;
  setCellValueForCard: (gameState: GameState, row: number, col: number, value: number) => boolean;
  getBoardExpansionGodCornerDescriptorsForCard: (gameState: GameState) => any[];
  getBoardExpansionGodPendingSelectionsForCard: (pending: any) => any[];
  getBoardExpansionGodAdditionsForCard: (row: number, col: number, boardOrConfig?: any) => any[] | null;
  getBoardExpansionWillCellDescriptorsForCard: (gameState: GameState) => any[];
  ensureExpansionCellForCard: (gameState: GameState, row: number, col: number, value: number) => boolean;
  buildInitialBoardBonusMap: () => any;
}

const exports: ExpansionExports = {
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

export = exports;
