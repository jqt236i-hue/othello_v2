// @ts-nocheck
"use strict";
/**
 * @file shrink.ts
 * @description Board shrink helpers (Shared between Browser and Headless)
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const SharedConstants = _require('../../../shared-constants');

const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
  ? Number(SharedConstants.EMPTY)
  : 0;

const BOARD_SHRINK_SELECTION_COUNT = 3;
const BOARD_SHRINK_HOLE_VISUAL_VARIANT = 'BOARD_FRAME';

function cloneTarget(target: any) {
  if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col))
    return null;
  return { row: target.row, col: target.col };
}

function getBoardShrinkPendingSelectionsForCard(pending: any) {
  if (!pending || pending.type !== 'BOARD_SHRINK_WILL' || !Array.isArray(pending.selectedTargets))
    return [];
  const unique: any[] = [];
  const seen = new Set();
  for (const target of pending.selectedTargets) {
    const cloned = cloneTarget(target);
    if (!cloned)
      continue;
    const key = `${cloned.row},${cloned.col}`;
    if (seen.has(key))
      continue;
    seen.add(key);
    unique.push(cloned);
  }
  return unique;
}

function applyHoleAt(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: any, options: any) {
  const resolvedDeps = deps || {};
  const resolvedOptions = options || {};
  const getCellValueForCard = resolvedDeps.getCellValueForCard || (() => null);
  const destroyAt = resolvedDeps.destroyAt || null;
  const isDestroyResolved = resolvedDeps.isDestroyResolved || ((result: any) => !!(result && (result.destroyed || result.livingWillRevived)));
  const clearStoneIdAtForCard = resolvedDeps.clearStoneIdAtForCard || (() => { });
  const setCellValueForCard = resolvedDeps.setCellValueForCard || (() => false);
  const removeMarkersAt = resolvedDeps.removeMarkersAt || (() => { });
  const addMarker = resolvedDeps.addMarker || (() => false);
  const isAbsoluteProtectedCell = resolvedDeps.isAbsoluteProtectedCell || (() => false);
  const isFrozenCell = resolvedDeps.isFrozenCell || (() => false);
  const random = resolvedDeps.random || null;
  const cardType = typeof resolvedOptions.cardType === 'string' && resolvedOptions.cardType
    ? resolvedOptions.cardType
    : 'BOARD_SHRINK_WILL';
  const destroyReason = typeof resolvedOptions.destroyReason === 'string' && resolvedOptions.destroyReason
    ? resolvedOptions.destroyReason
    : 'board_shrink_cell_destroy';
  if (isFrozenCell(cardState, row, col)) {
    return { applied: false, reason: 'frozen_protected', row, col };
  }
  if (isAbsoluteProtectedCell(cardState, row, col)) {
    return { applied: false, reason: 'absolute_protected', row, col };
  }
  const cellValue = getCellValueForCard(gameState, row, col);
  if (cellValue === null)
    return { applied: false, reason: 'out_of_board', row, col };
  let destroyed = false;
  if (cellValue !== EMPTY) {
    if (typeof destroyAt === 'function') {
      const result = destroyAt(cardState, gameState, row, col, cardType, destroyReason, { ignoreGuard: true, ignoreRegen: true, random });
      destroyed = isDestroyResolved(result);
      if (result && (result.reason === 'out_of_board' || result.reason === 'absolute_protected' || result.reason === 'frozen_protected')) {
        return { applied: false, reason: result.reason, row, col };
      }
    }
    if (!destroyed) {
      clearStoneIdAtForCard(cardState, gameState, row, col);
      setCellValueForCard(gameState, row, col, EMPTY);
      removeMarkersAt(cardState, row, col);
      destroyed = true;
    }
  }
  else {
    clearStoneIdAtForCard(cardState, gameState, row, col);
    setCellValueForCard(gameState, row, col, EMPTY);
    removeMarkersAt(cardState, row, col);
  }
  removeMarkersAt(cardState, row, col);
  addMarker(cardState, 'specialStone', row, col, playerKey, {
    type: 'METEOR_HOLE',
    visualVariant: BOARD_SHRINK_HOLE_VISUAL_VARIANT
  });
  return { applied: true, row, col, destroyed };
}

function applyBoardShrinkWill(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: any) {
  const cs = cardState;
  const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
  if (!pending || pending.type !== 'BOARD_SHRINK_WILL' || pending.stage !== 'selectTarget') {
    return { applied: false, reason: 'not_pending' };
  }
  const getBoardShrinkTargets = deps && deps.getBoardShrinkTargets
    ? deps.getBoardShrinkTargets
    : (() => []);
  const targets = getBoardShrinkTargets(cardState, gameState, playerKey);
  const allowed = Array.isArray(targets) && targets.some((target: any) => target && target.row === row && target.col === col);
  if (!allowed)
    return { applied: false, reason: 'invalid_target' };
  const currentSelections = getBoardShrinkPendingSelectionsForCard(pending);
  const nextSelections = currentSelections.concat({ row, col }).map((target: any) => ({ row: target.row, col: target.col }));
  const maxSelections = Number.isFinite(Number(pending.maxSelections))
    ? Math.max(1, Math.trunc(Number(pending.maxSelections)))
    : BOARD_SHRINK_SELECTION_COUNT;
  if (nextSelections.length < maxSelections) {
    pending.selectedTargets = nextSelections;
    pending.selectedCount = pending.selectedTargets.length;
    pending.maxSelections = maxSelections;
    return {
      applied: true,
      completed: false,
      selectedCount: pending.selectedCount,
      maxSelections,
      remainingSelections: maxSelections - pending.selectedCount,
      target: { row, col },
      selectedTargets: pending.selectedTargets.map((target: any) => ({ row: target.row, col: target.col }))
    };
  }
  const changedTargets: any[] = [];
  const skippedTargets: any[] = [];
  for (const target of nextSelections) {
    const result = applyHoleAt(cardState, gameState, playerKey, target.row, target.col, deps, {
      cardType: 'BOARD_SHRINK_WILL',
      destroyReason: 'board_shrink_cell_destroy'
    });
    if (result && result.applied) {
      changedTargets.push({ row: target.row, col: target.col });
    }
    else {
      skippedTargets.push({
        row: target.row,
        col: target.col,
        reason: result && result.reason ? result.reason : 'invalid_target'
      });
    }
  }
  cs.pendingEffectByPlayer[playerKey] = null;
  return {
    applied: true,
    completed: true,
    source: { row, col },
    selectedTargets: nextSelections.map((target: any) => ({ row: target.row, col: target.col })),
    changedTargets,
    skippedTargets
  };
}

function applyBoardShrinkGod(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: any) {
  const cs = cardState;
  const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
  if (!pending || pending.type !== 'BOARD_SHRINK_GOD' || pending.stage !== 'selectTarget') {
    return { applied: false, reason: 'not_pending' };
  }
  const getBoardShrinkGodTargets = deps && deps.getBoardShrinkGodTargets
    ? deps.getBoardShrinkGodTargets
    : (() => []);
  const targets = getBoardShrinkGodTargets(cardState, gameState, playerKey);
  const selectedTarget = Array.isArray(targets)
    ? targets.find((target: any) => target && target.row === row && target.col === col)
    : null;
  if (!selectedTarget)
    return { applied: false, reason: 'invalid_target' };
  const firstTarget = cloneTarget(pending.firstTarget);
  if (!firstTarget) {
    pending.firstTarget = { row, col };
    return {
      applied: true,
      completed: false,
      target: { row, col },
      firstTarget: { row, col }
    };
  }
  const lineCells = Array.isArray(selectedTarget.lineCells)
    ? selectedTarget.lineCells.map(cloneTarget).filter((target: any) => !!target)
    : [];
  if (lineCells.length === 0)
    return { applied: false, reason: 'invalid_target' };
  const changedTargets: any[] = [];
  const skippedTargets: any[] = [];
  for (const target of lineCells) {
    const result = applyHoleAt(cardState, gameState, playerKey, target.row, target.col, deps, {
      cardType: 'BOARD_SHRINK_GOD',
      destroyReason: 'board_shrink_god_cell_destroy'
    });
    if (result && result.applied) {
      changedTargets.push({ row: target.row, col: target.col });
    }
    else {
      skippedTargets.push({
        row: target.row,
        col: target.col,
        reason: result && result.reason ? result.reason : 'invalid_target'
      });
    }
  }
  cs.pendingEffectByPlayer[playerKey] = null;
  return {
    applied: true,
    completed: true,
    firstTarget,
    target: { row, col },
    lineKey: selectedTarget.lineKey || null,
    lineTargets: lineCells,
    changedTargets,
    skippedTargets
  };
}

export = {
  BOARD_SHRINK_SELECTION_COUNT,
  getBoardShrinkPendingSelectionsForCard,
  applyBoardShrinkWill,
  applyBoardShrinkGod
};
