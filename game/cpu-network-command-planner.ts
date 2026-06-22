'use strict';

type PlannerInput = Record<string, any>;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire | null = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : (typeof require === 'function' ? require : null);

let coreLogicModule: any = null;

function normalizePlayerKey(value: any): 'black' | 'white' {
  return String(value || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
}

function createPassAction(playerKey: string, options?: { autoNoActionPass?: boolean }): any {
  const action: any = { type: 'pass', playerKey };
  if (!options || options.autoNoActionPass !== false) {
    action.autoNoActionPass = true;
  }
  return {
    actionType: 'pass',
    action
  };
}

function createPlaceAction(move: any): any {
  if (!move || !Number.isFinite(Number(move.row)) || !Number.isFinite(Number(move.col))) return null;
  return {
    actionType: 'place',
    action: {
      type: 'place',
      row: Math.trunc(Number(move.row)),
      col: Math.trunc(Number(move.col))
    }
  };
}

function readPending(cardState: any, playerKey: string): any | null {
  const pendingByPlayer = cardState && cardState.pendingEffectByPlayer;
  const pending = pendingByPlayer && pendingByPlayer[playerKey];
  return pending && typeof pending === 'object' ? pending : null;
}

function resolveCoreLogic(input: PlannerInput): any | null {
  if (input && input.CoreLogic) return input.CoreLogic;
  if (input && input.Core) return input.Core;
  if (!coreLogicModule && _require) {
    try {
      coreLogicModule = _require('./logic/core');
    } catch (e) {
      coreLogicModule = null;
    }
  }
  return coreLogicModule;
}

function resolveCardContext(input: PlannerInput): any {
  const logic = input && input.CardLogic;
  if (logic && typeof logic.getCardContext === 'function') {
    try {
      return logic.getCardContext(input.cardState);
    } catch (e) { /* fall through */ }
  }
  return {};
}

function isFreePlacementPending(input: PlannerInput, pendingType: string): boolean {
  const logic = input && input.CardLogic;
  if (!pendingType || !logic || typeof logic.isFreePlacementPendingType !== 'function') return false;
  try {
    return logic.isFreePlacementPendingType(pendingType) === true;
  } catch (e) {
    return false;
  }
}

function normalizePendingType(value: any): string {
  return String(value || '').trim().toUpperCase();
}

function cloneTarget(value: any): any | null {
  if (!value || !Number.isFinite(Number(value.row)) || !Number.isFinite(Number(value.col))) return null;
  return { row: Math.trunc(Number(value.row)), col: Math.trunc(Number(value.col)) };
}

function buildPendingSelectionState(pending: any, pendingType: string): any {
  const out: any = {
    type: pendingType,
    stage: typeof pending.stage === 'string' && pending.stage ? pending.stage : 'selectTarget'
  };
  if (typeof pending.cardId === 'string' && pending.cardId) out.cardId = pending.cardId;
  if (Number.isInteger(pending.sourceHandIndex)) out.sourceHandIndex = pending.sourceHandIndex;
  if (typeof pending.pendingEffectId === 'string' && pending.pendingEffectId) out.pendingEffectId = pending.pendingEffectId;
  const firstTarget = cloneTarget(pending.firstTarget);
  if (firstTarget) out.firstTarget = firstTarget;
  if (Array.isArray(pending.selectedTargets) && pending.selectedTargets.length > 0) {
    out.selectedTargets = pending.selectedTargets.map(cloneTarget).filter(Boolean);
  }
  if (Number.isFinite(Number(pending.selectedCount))) out.selectedCount = Math.max(0, Math.trunc(Number(pending.selectedCount)));
  if (Number.isFinite(Number(pending.maxSelections))) out.maxSelections = Math.max(0, Math.trunc(Number(pending.maxSelections)));
  return out;
}

function getCoreLegalMoves(input: PlannerInput, playerKey: string, pendingType: string): any[] {
  const core = resolveCoreLogic(input);
  if (!core || !input || !input.gameState) return [];
  const playerValue = playerKey === 'white' ? -1 : 1;
  const context = resolveCardContext(input);
  if (isFreePlacementPending(input, pendingType) && typeof core.getFreePlacementMoves === 'function') {
    try {
      const moves = core.getFreePlacementMoves(input.gameState, playerValue, context);
      if (Array.isArray(moves) && moves.length > 0) return moves;
    } catch (e) { /* fall through */ }
  }
  if (typeof core.getLegalMoves === 'function') {
    try {
      const moves = core.getLegalMoves(input.gameState, playerValue, context);
      if (Array.isArray(moves)) return moves;
    } catch (e) { /* fall through */ }
  }
  return [];
}

function getLegalMoves(input: PlannerInput, playerKey: string, pendingType: string): any[] {
  try {
    if (typeof input.getLegalMoves === 'function') {
      const moves = input.getLegalMoves(
        input.gameState,
        input.protectedStones || [],
        input.permaProtectedStones || [],
        input.cardState
      );
      if (Array.isArray(moves) && moves.length > 0) return moves;
    }
  } catch (e) { /* fall through */ }
  return getCoreLegalMoves(input, playerKey, pendingType);
}

function selectMove(input: PlannerInput, moves: any[], playerKey: string): any {
  try {
    if (typeof input.selectCpuMoveWithPolicy === 'function') {
      const selected = input.selectCpuMoveWithPolicy(moves, playerKey);
      if (selected && Number.isFinite(Number(selected.row)) && Number.isFinite(Number(selected.col))) return selected;
    }
  } catch (e) { /* fall through */ }
  return moves[0] || null;
}

function hasUsableCard(input: PlannerInput, playerKey: string): boolean {
  try {
    const logic = input.CardLogic;
    return !!(
      logic &&
      typeof logic.hasUsableCard === 'function' &&
      logic.hasUsableCard(input.cardState, input.gameState, playerKey) === true
    );
  } catch (e) {
    return false;
  }
}

function getUsableCardIds(input: PlannerInput, playerKey: string): string[] {
  const logic = input && input.CardLogic;
  try {
    if (logic && typeof logic.getUsableCardIds === 'function') {
      const usable = logic.getUsableCardIds(input.cardState, input.gameState, playerKey);
      if (Array.isArray(usable)) return usable.map((id: any) => String(id || '').trim()).filter(Boolean);
    }
  } catch (e) { /* fall through */ }
  try {
    const hand = input
      && input.cardState
      && input.cardState.hands
      && Array.isArray(input.cardState.hands[playerKey])
      ? input.cardState.hands[playerKey]
      : [];
    return hand.map((id: any) => String(id || '').trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function resolveCardDecision(input: PlannerInput, playerKey: string): any {
  try {
    if (typeof input.selectCardToUse === 'function') {
      const selected = input.selectCardToUse(playerKey);
      if (selected && selected.cardId) {
        return { type: 'useCard', cardId: selected.cardId, cardDef: selected.cardDef };
      }
    }
  } catch (e) { /* fall through */ }
  try {
    if (typeof input.computeCpuAction === 'function') return input.computeCpuAction(playerKey);
  } catch (e) { /* fall through */ }
  return null;
}

function planCardUse(input: PlannerInput, playerKey: string, options?: { allowFallback?: boolean }): any {
  if (!hasUsableCard(input, playerKey)) return null;
  const decision = resolveCardDecision(input, playerKey);
  const type = String(decision && (decision.type || decision.actionType) || '').trim();
  let cardId = String(decision && (decision.cardId || decision.useCardId) || '').trim();
  const allowFallback = !options || options.allowFallback !== false;
  if ((type !== 'useCard' && type !== 'use_card') || !cardId) {
    cardId = allowFallback ? (getUsableCardIds(input, playerKey)[0] || '') : '';
  }
  if (!cardId) return null;
  return {
    actionType: 'use_card',
    action: {
      type: 'use_card',
      playerKey,
      useCardId: cardId,
      useCardOwnerKey: playerKey
    }
  };
}

function resolvePendingField(input: PlannerInput, pendingType: string): string | null {
  const coordinator = input.PendingCoordinator;
  if (coordinator && typeof coordinator.resolvePendingSelectionActionField === 'function') {
    const field = coordinator.resolvePendingSelectionActionField(pendingType);
    if (typeof field === 'string' && field) return field;
  }
  const registry = input.PendingSelectionRegistry;
  if (registry && typeof registry.getPendingSelectionActionConfig === 'function') {
    const config = registry.getPendingSelectionActionConfig(pendingType);
    if (config && typeof config.field === 'string' && config.field) return config.field;
  }
  return null;
}

function resolvePendingTargetMethod(input: PlannerInput, pendingType: string): string | null {
  const registry = input.PendingSelectionRegistry;
  if (registry && typeof registry.getPendingSelectionTargetMethod === 'function') {
    const method = registry.getPendingSelectionTargetMethod(pendingType);
    if (typeof method === 'string' && method) return method;
  }
  return null;
}

function collectPendingTargets(input: PlannerInput, playerKey: string, pending: any, pendingType: string): any[] {
  const logic = input.CardLogic;
  const method = resolvePendingTargetMethod(input, pendingType);
  if (logic && method && typeof logic[method] === 'function') {
    const attempts = [
      () => logic[method](input.cardState, input.gameState, playerKey, pending),
      () => logic[method](input.cardState, input.gameState, playerKey),
      () => logic[method](input.cardState, input.gameState)
    ];
    for (const attempt of attempts) {
      try {
        const targets = attempt();
        if (Array.isArray(targets)) return targets;
      } catch (e) { /* try next */ }
    }
  }
  if (logic && typeof logic.getSelectableTargets === 'function') {
    try {
      const targets = logic.getSelectableTargets(input.cardState, input.gameState, playerKey);
      return Array.isArray(targets) ? targets : [];
    } catch (e) { /* fall through */ }
  }
  return [];
}

function planHandOverlayPending(input: PlannerInput, playerKey: string, pending: any, pendingType: string): any {
  const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
  if (!offers.length) return null;
  const action: any = {
    type: 'place',
    player: playerKey,
    pendingSelectionState: buildPendingSelectionState(pending, pendingType)
  };
  if (pendingType === 'HEAVEN_BLESSING') {
    const cardId = typeof offers[0] === 'string' ? offers[0] : offers[0] && offers[0].cardId;
    if (!cardId) return null;
    action.heavenBlessingCardId = String(cardId);
  } else if (pendingType === 'CONDEMN_WILL') {
    const offer = offers.find((item: any) => item && Number.isInteger(item.handIndex)) || offers[0];
    if (!offer || !Number.isInteger(offer.handIndex)) return null;
    action.condemnTargetIndex = offer.handIndex;
  } else if (pendingType === 'OBSERVER_WILL') {
    const offer = offers.find((item: any) => item && Number.isInteger(item.handIndex)) || offers[0];
    if (!offer || !Number.isInteger(offer.handIndex)) return null;
    action.observerWillTargetIndex = offer.handIndex;
  } else {
    return null;
  }
  if (Number.isFinite(Number(input.cardState && input.cardState.turnIndex))) {
    action.turnIndex = Math.trunc(Number(input.cardState.turnIndex));
  }
  return { actionType: 'place', action };
}

function planPendingSelection(input: PlannerInput, playerKey: string): any {
  const pending = readPending(input.cardState, playerKey);
  const pendingType = normalizePendingType(pending && pending.type);
  if (!pending || !pendingType || pending.stage !== 'selectTarget') return null;
  const overlay = planHandOverlayPending(input, playerKey, pending, pendingType);
  if (overlay) return overlay;
  const field = resolvePendingField(input, pendingType);
  if (!field) return null;
  const target = cloneTarget(collectPendingTargets(input, playerKey, pending, pendingType)[0]);
  if (!target) return null;
  const action: any = {
    type: 'place',
    player: playerKey,
    row: target.row,
    col: target.col,
    pendingSelectionState: buildPendingSelectionState(pending, pendingType)
  };
  action[field] = target;
  if (Number.isFinite(Number(input.cardState && input.cardState.turnIndex))) {
    action.turnIndex = Math.trunc(Number(input.cardState.turnIndex));
  }
  return { actionType: 'place', action };
}

function planCpuNetworkCommand(inputValue: PlannerInput): any {
  const input = inputValue && typeof inputValue === 'object' ? inputValue : {};
  const playerKey = normalizePlayerKey(input.playerKey);
  const unresolvedPending = readPending(input.cardState, playerKey);
  const unresolvedPendingType = normalizePendingType(unresolvedPending && unresolvedPending.type);
  const pending = planPendingSelection(input, playerKey);
  if (pending) return pending;
  const selectedCard = planCardUse(input, playerKey, { allowFallback: false });
  if (selectedCard) return selectedCard;
  const moves = getLegalMoves(input, playerKey, unresolvedPendingType);
  if (moves.length > 0) return createPlaceAction(selectMove(input, moves, playerKey));
  const card = planCardUse(input, playerKey);
  if (card) return card;
  if (hasUsableCard(input, playerKey)) return createPassAction(playerKey, { autoNoActionPass: false });
  if (unresolvedPending) return createPassAction(playerKey, { autoNoActionPass: false });
  return createPassAction(playerKey);
}

export = {
  planCpuNetworkCommand
};
