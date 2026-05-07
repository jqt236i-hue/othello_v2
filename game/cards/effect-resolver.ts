/**
 * Card effect resolver stub — implementation incomplete.
 * This module is required by game/logic/cards.ts but the full implementation
 * was lost during migration. Fallback logic in cards.ts handles most cases.
 */

function notImplemented(name: string) {
  return function() {
    throw new Error(`[effect-resolver] ${name} is not implemented`);
  };
}

export = {
  getCardHandManagerContext: notImplemented('getCardHandManagerContext'),
  applyCardUsage: notImplemented('applyCardUsage'),
  cancelPendingSelection: notImplemented('cancelPendingSelection'),
  getCardEffectTimingContext: notImplemented('getCardEffectTimingContext'),
  getCardContext: notImplemented('getCardContext')
};
