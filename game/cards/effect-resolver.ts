/**
 * Card effect resolver stub — implementation incomplete.
 * This module is required by game/logic/cards.ts but the full implementation
 * was lost during migration. Fallback logic in cards.ts handles most cases.
 * These stubs return safe defaults to avoid hard crashes; behavior may be
 * incomplete until the canonical implementation is restored.
 */

export = {
  getCardHandManagerContext: function() {
    return {};
  },
  applyCardUsage: function() {
    return true;
  },
  cancelPendingSelection: function() {
    return { canceled: false };
  },
  getCardEffectTimingContext: function() {
    return {};
  },
  getCardContext: function() {
    return {
      protectedStones: [],
      permaProtectedStones: [],
      bombs: [],
      blockedCells: []
    };
  }
};
