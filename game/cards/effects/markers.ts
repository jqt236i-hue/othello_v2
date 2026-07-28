/**
 * @file markers.ts
 * @description Marker helpers wrapper (delegates to game/logic/cards/markers.js)
 */

import type { CardState, PlayerKey } from '../../../src/types';
import MarkersModule = require('../../logic/cards/markers');

interface MarkersExports {
  MARKER_KINDS: Record<string, string>;
  MARKER_CATEGORIES: Record<string, string>;
  ensureMarkers: (cardState: CardState) => void;
  getMarkers: (cardState: CardState) => any[];
  getMarkerCategory: (markerType: string) => string | null;
  getBombMarkerType: (markerType: string) => string | null;
  isBombCategoryMarker: (markerType: string) => boolean;
  isSpecialStoneMarker: (markerType: string) => boolean;
  getSpecialMarkers: (cardState: CardState) => any[];
  getBombMarkers: (cardState: CardState) => any[];
  getBlockadeMarkers: (cardState: CardState) => any[];
  getBlockingMarkers: (cardState: CardState) => any[];
  isFrozenCellForCard: (cardState: CardState, row: number, col: number) => boolean;
  isMeteorHoleCell: (cardState: CardState, row: number, col: number) => boolean;
  isGuardProtectedCell: (cardState: CardState, row: number, col: number) => boolean;
  findSpecialMarkerAt: (cardState: CardState, row: number, col: number) => any | null;
  findBombMarkerAt: (cardState: CardState, row: number, col: number) => any | null;
  removeMarkersAt: (cardState: CardState, row: number, col: number, filter?: any) => void;
  getSpecialMarkerAt: (cardState: CardState, row: number, col: number) => any | null;
  isSpecialStoneAt: (cardState: CardState, row: number, col: number) => boolean;
  getSpecialOwnerAt: (cardState: CardState, row: number, col: number) => PlayerKey | null;
  clearStoneIdAtForCard: (cardState: CardState, gameState: any, row: number, col: number) => void;
  getStoneIdAtForCard: (cardState: CardState, gameState: any, row: number, col: number) => string | null;
  setStoneIdAtForCard: (cardState: CardState, gameState: any, row: number, col: number, stoneId: string | null) => void;
  swapCellCoordinates: (cardState: CardState, gameState: any, posA: { row: number; col: number }, posB: { row: number; col: number }) => void;
  addMarker: (
    cardState: CardState,
    kind: string,
    row: number,
    col: number,
    owner: PlayerKey | null,
    data?: any,
    options?: { emitStatusApplied?: boolean }
  ) => any;
  removeMarkerById: (cardState: CardState, markerId: number) => boolean;
  applyExtendLifeWill: (cardState: CardState, gameState: any, playerKey: PlayerKey, row: number, col: number, deps?: any) => Record<string, unknown>;
  applyExtendLifeGod: (cardState: CardState, gameState: any, playerKey: PlayerKey, row: number, col: number, deps?: any) => Record<string, unknown>;
  applyCorrosionWill: (cardState: CardState, gameState: any, playerKey: PlayerKey, row: number, col: number, deps?: any) => Record<string, unknown>;
}

const _exports: MarkersExports = {
  MARKER_KINDS: MarkersModule.MARKER_KINDS,
  MARKER_CATEGORIES: MarkersModule.MARKER_CATEGORIES,
  ensureMarkers: MarkersModule.ensureMarkers,
  getMarkers: MarkersModule.getMarkers,
  getMarkerCategory: MarkersModule.getMarkerCategory,
  getBombMarkerType: MarkersModule.getBombMarkerType,
  isBombCategoryMarker: MarkersModule.isBombCategoryMarker,
  isSpecialStoneMarker: MarkersModule.isSpecialStoneMarker,
  getSpecialMarkers: MarkersModule.getSpecialMarkers,
  getBombMarkers: MarkersModule.getBombMarkers,
  getBlockadeMarkers: MarkersModule.getBlockadeMarkers,
  getBlockingMarkers: MarkersModule.getBlockingMarkers,
  isFrozenCellForCard: MarkersModule.isFrozenCellForCard,
  isMeteorHoleCell: MarkersModule.isMeteorHoleCell,
  isGuardProtectedCell: MarkersModule.isGuardProtectedCell,
  findSpecialMarkerAt: MarkersModule.findSpecialMarkerAt,
  findBombMarkerAt: MarkersModule.findBombMarkerAt,
  removeMarkersAt: MarkersModule.removeMarkersAt,
  getSpecialMarkerAt: MarkersModule.getSpecialMarkerAt,
  isSpecialStoneAt: MarkersModule.isSpecialStoneAt,
  getSpecialOwnerAt: MarkersModule.getSpecialOwnerAt,
  clearStoneIdAtForCard: MarkersModule.clearStoneIdAtForCard,
  getStoneIdAtForCard: MarkersModule.getStoneIdAtForCard,
  setStoneIdAtForCard: MarkersModule.setStoneIdAtForCard,
  swapCellCoordinates: MarkersModule.swapCellCoordinates,
  addMarker: MarkersModule.addMarker,
  removeMarkerById: MarkersModule.removeMarkerById,
  applyExtendLifeWill: MarkersModule.applyExtendLifeWill,
  applyExtendLifeGod: MarkersModule.applyExtendLifeGod,
  applyCorrosionWill: MarkersModule.applyCorrosionWill
};

export = _exports;
