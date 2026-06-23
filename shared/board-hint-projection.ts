'use strict';

interface BoardHintProjectionInput {
  gameState?: any;
  cardState?: any;
  playerKey?: any;
  boardShape?: { rows?: number; cols?: number };
  canControlCurrentTurn?: boolean;
  isHumanTurn?: boolean;
  expansions?: any[];
  cardLogic?: any;
  getLegalMoves?: any;
}

function normalizePointKey(target: any): string | null {
  const row = Number(target && target.row);
  const col = Number(target && target.col);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  return `${row},${col}`;
}

function addPendingSelectedTargetHighlightKey(out: Set<string>, target: any): void {
  const key = normalizePointKey(target);
  if (key) out.add(key);
}

function collectPendingSelectedTargetHighlightKeys(pending: any): Set<string> {
  const out = new Set<string>();
  if (!pending || pending.stage !== 'selectTarget') return out;

  const pendingType = String(pending.type || '').toUpperCase();
  if (
    pendingType === 'POSITION_SWAP_WILL' ||
    pendingType === 'SUPER_ATTRACTION_WILL' ||
    pendingType === 'BOARD_EXPANSION_GOD' ||
    pendingType === 'BOARD_SHRINK_GOD'
  ) {
    addPendingSelectedTargetHighlightKey(out, pending.firstTarget);
  }
  if (
    pendingType === 'BOARD_EXPANSION_GOD' ||
    pendingType === 'BOARD_SHRINK_WILL'
  ) {
    const selectedTargets = Array.isArray(pending.selectedTargets) ? pending.selectedTargets : [];
    for (const target of selectedTargets) {
      addPendingSelectedTargetHighlightKey(out, target);
    }
  }
  return out;
}

function resolveSelectedCardOwnerKeyForPreview(cardStateValue: any, fallbackPlayerKey: any): string | null {
  if (cardStateValue && (cardStateValue.selectedCardOwnerKey === 'white' || cardStateValue.selectedCardOwnerKey === 'black')) {
    return cardStateValue.selectedCardOwnerKey;
  }
  return fallbackPlayerKey === 'white' || fallbackPlayerKey === 'black'
    ? fallbackPlayerKey
    : null;
}

function hasSelectedOwnerUsedCardThisTurn(cardStateValue: any, ownerKey: string | null): boolean {
  if (!cardStateValue || !ownerKey) return false;
  const usedByPlayer = cardStateValue.hasUsedCardThisTurnByPlayer;
  return !!(usedByPlayer && usedByPlayer[ownerKey] === true);
}

function resolveRandomSpawnPreviewTargets(input: BoardHintProjectionInput): any[] {
  const cardLogic = input.cardLogic;
  const cardStateValue = input.cardState;
  const gameStateValue = input.gameState;
  const playerKey = input.playerKey;
  if (
    !cardLogic ||
    !cardStateValue ||
    !gameStateValue ||
    (playerKey !== 'black' && playerKey !== 'white')
  ) {
    return [];
  }
  const selectedCardId = cardStateValue.selectedCardId;
  if (!selectedCardId) return [];

  let selectedCardType = '';
  try {
    if (typeof cardLogic.getCardType === 'function') {
      selectedCardType = String(cardLogic.getCardType(selectedCardId) || '');
    }
  } catch (e) { /* ignore */ }
  if (!selectedCardType) {
    try {
      const selectedCardDef = typeof cardLogic.getCardDef === 'function'
        ? cardLogic.getCardDef(selectedCardId)
        : null;
      selectedCardType = String(selectedCardDef && selectedCardDef.type ? selectedCardDef.type : '');
    } catch (e) { /* ignore */ }
  }

  try {
    if (selectedCardType === 'REINFORCEMENT_WILL' && typeof cardLogic.getReinforcementWillTargets === 'function') {
      return cardLogic.getReinforcementWillTargets(cardStateValue, gameStateValue, playerKey) || [];
    }
    if (selectedCardType === 'SUPPORT_TROOPS_WILL' && typeof cardLogic.getSupportTroopsWillTargets === 'function') {
      return cardLogic.getSupportTroopsWillTargets(cardStateValue, gameStateValue, playerKey) || [];
    }
  } catch (e) { /* ignore */ }
  return [];
}

function collectRandomSpawnPreviewHighlightKeys(input: BoardHintProjectionInput, pending?: any, options?: any): Set<string> {
  const out = new Set<string>();
  if (options && options.enabled === false) return out;
  if (options && options.pending) return out;
  if (pending) return out;
  const selectedOwnerKey = resolveSelectedCardOwnerKeyForPreview(input.cardState, input.playerKey);
  if (!selectedOwnerKey || selectedOwnerKey !== input.playerKey) return out;
  if (hasSelectedOwnerUsedCardThisTurn(input.cardState, selectedOwnerKey)) return out;

  const targets = resolveRandomSpawnPreviewTargets(input);
  for (const target of Array.isArray(targets) ? targets : []) {
    const key = normalizePointKey(target);
    if (key) out.add(key);
  }
  return out;
}

function resolveBoardShrinkDirectionName(direction: any): string | null {
  const row = Number(direction && direction.row);
  const col = Number(direction && direction.col);
  if (Math.abs(col) >= Math.abs(row) && col !== 0) {
    return col > 0 ? 'right' : 'left';
  }
  if (row !== 0) {
    return row > 0 ? 'down' : 'up';
  }
  return null;
}

function resolveBoardShrinkGodDirection(firstTarget: any, target: any): string | null {
  const firstRow = Number(firstTarget && firstTarget.row);
  const firstCol = Number(firstTarget && firstTarget.col);
  const targetRow = Number(target && target.row);
  const targetCol = Number(target && target.col);
  if (!Number.isInteger(firstRow) || !Number.isInteger(firstCol) || !Number.isInteger(targetRow) || !Number.isInteger(targetCol)) {
    return null;
  }
  return resolveBoardShrinkDirectionName({
    row: targetRow - firstRow,
    col: targetCol - firstCol
  });
}

function buildBoardShrinkGodDirectionHintMap(pending: any, selectableTargets: any): Map<string, string> {
  const out = new Map<string, string>();
  if (!pending || pending.stage !== 'selectTarget' || String(pending.type || '').toUpperCase() !== 'BOARD_SHRINK_GOD') {
    return out;
  }
  if (!pending.firstTarget || !Array.isArray(selectableTargets) || selectableTargets.length === 0) {
    return out;
  }
  for (const target of selectableTargets) {
    const key = normalizePointKey(target);
    if (!key) continue;
    const direction = resolveBoardShrinkGodDirection(pending.firstTarget, target);
    if (!direction) continue;
    out.set(key, direction);
  }
  return out;
}

function resolveBoardShrinkWillDirection(pending: any, target: any): string | null {
  const selectedTargets = Array.isArray(pending && pending.selectedTargets) ? pending.selectedTargets : [];
  const targetRow = Number(target && target.row);
  const targetCol = Number(target && target.col);
  if (!Number.isInteger(targetRow) || !Number.isInteger(targetCol) || selectedTargets.length <= 0) {
    return null;
  }
  const explicitDirection = resolveBoardShrinkDirectionName(target && target.direction);
  if (explicitDirection) return explicitDirection;
  for (let i = selectedTargets.length - 1; i >= 0; i -= 1) {
    const selected = selectedTargets[i];
    const row = Number(selected && selected.row);
    const col = Number(selected && selected.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
    const rowDelta = targetRow - row;
    const colDelta = targetCol - col;
    if (Math.abs(rowDelta) + Math.abs(colDelta) !== 1) continue;
    return resolveBoardShrinkDirectionName({ row: rowDelta, col: colDelta });
  }
  return null;
}

function buildBoardShrinkWillDirectionHintMap(pending: any, selectableTargets: any): Map<string, string> {
  const out = new Map<string, string>();
  if (!pending || pending.stage !== 'selectTarget' || String(pending.type || '').toUpperCase() !== 'BOARD_SHRINK_WILL') {
    return out;
  }
  const selectedTargets = Array.isArray(pending.selectedTargets) ? pending.selectedTargets : [];
  if (selectedTargets.length <= 0 || !Array.isArray(selectableTargets) || selectableTargets.length === 0) {
    return out;
  }
  for (const target of selectableTargets) {
    const key = normalizePointKey(target);
    if (!key) continue;
    const direction = resolveBoardShrinkWillDirection(pending, target);
    if (!direction) continue;
    out.set(key, direction);
  }
  return out;
}

function normalizeBoardExpansionSide(side: any): string | null {
  const normalized = String(side || '').toLowerCase();
  if (normalized === 'top') return 'up';
  if (normalized === 'bottom') return 'down';
  return normalized === 'left' || normalized === 'right' || normalized === 'up' || normalized === 'down'
    ? normalized
    : null;
}

function resolveBoardExpansionGodDirection(target: any, boardShape: any): string | null {
  const row = Number(target && target.row);
  const col = Number(target && target.col);
  const rows = Number(boardShape && boardShape.rows);
  const cols = Number(boardShape && boardShape.cols);
  if (!Number.isInteger(row) || !Number.isInteger(col) || !Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
    return null;
  }
  const vertical = row === 0 ? 'up' : row === rows - 1 ? 'down' : null;
  const horizontal = col === 0 ? 'left' : col === cols - 1 ? 'right' : null;
  if (vertical && horizontal) return `${vertical}-${horizontal}`;
  return vertical || horizontal;
}

function resolveBoardExpansionDirection(pending: any, target: any, boardShape: any): string | null {
  const pendingType = String(pending && pending.type || '').toUpperCase();
  if (pendingType === 'BOARD_EXPANSION_WILL') {
    return normalizeBoardExpansionSide(target && target.side);
  }
  if (pendingType === 'BOARD_EXPANSION_GOD') {
    return resolveBoardExpansionGodDirection(target, boardShape);
  }
  return null;
}

function buildBoardExpansionDirectionHintMap(pending: any, selectableTargets: any, boardShape: any): Map<string, string> {
  const out = new Map<string, string>();
  const pendingType = String(pending && pending.type || '').toUpperCase();
  if (!pending || pending.stage !== 'selectTarget' || (pendingType !== 'BOARD_EXPANSION_WILL' && pendingType !== 'BOARD_EXPANSION_GOD')) {
    return out;
  }
  if (!Array.isArray(selectableTargets) || selectableTargets.length === 0) {
    return out;
  }
  for (const target of selectableTargets) {
    const key = normalizePointKey(target);
    if (!key) continue;
    const direction = resolveBoardExpansionDirection(pending, target, boardShape);
    if (!direction) continue;
    out.set(key, direction);
  }
  return out;
}

function collectBoardShrinkGodPreviewHighlightKeys(pending: any, selectableTargets: any): Set<string> {
  const out = new Set<string>();
  if (!pending || pending.stage !== 'selectTarget' || String(pending.type || '').toUpperCase() !== 'BOARD_SHRINK_GOD') {
    return out;
  }
  const firstRow = Number(pending.firstTarget && pending.firstTarget.row);
  const firstCol = Number(pending.firstTarget && pending.firstTarget.col);
  if (!Number.isInteger(firstRow) || !Number.isInteger(firstCol) || !Array.isArray(selectableTargets)) {
    return out;
  }
  for (const target of selectableTargets) {
    const lineCells = Array.isArray(target && target.lineCells) ? target.lineCells : [target];
    for (const cell of lineCells) {
      const key = normalizePointKey(cell);
      if (!key) continue;
      if (key === `${firstRow},${firstCol}`) continue;
      out.add(key);
    }
  }
  return out;
}

function buildTabooLegalSet(input: BoardHintProjectionInput, pending: any, showLegalHints: boolean): Set<string> {
  const out = new Set<string>();
  const cardLogic = input.cardLogic;
  if (!showLegalHints || !pending || pending.type !== 'TABOO_REVERSE_WILL') return out;
  if (!cardLogic || typeof cardLogic.getTabooReverseCandidates !== 'function') return out;
  const rows = input.boardShape && Number.isInteger(input.boardShape.rows) ? input.boardShape.rows as number : 8;
  const cols = input.boardShape && Number.isInteger(input.boardShape.cols) ? input.boardShape.cols as number : 8;
  const visit = (row: number, col: number) => {
    const candidates = cardLogic.getTabooReverseCandidates(input.cardState, input.gameState, input.playerKey, row, col);
    if (Array.isArray(candidates) && candidates.length > 0) out.add(`${row},${col}`);
  };
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (input.gameState && input.gameState.board && input.gameState.board[row] && input.gameState.board[row][col] === 0) {
        visit(row, col);
      }
    }
  }
  const expansions = Array.isArray(input.expansions) ? input.expansions : [];
  expansions.forEach((expansion) => {
    if (expansion && Number(expansion.owner) === 0) visit(Number(expansion.row), Number(expansion.col));
  });
  return out;
}

function buildBoardHintProjection(inputValue: BoardHintProjectionInput): any {
  const input = (inputValue && typeof inputValue === 'object') ? inputValue : {};
  const cardState = input.cardState || {};
  const pendingByPlayer = cardState.pendingEffectByPlayer || {};
  const pending = pendingByPlayer[input.playerKey] || null;
  const cardLogic = input.cardLogic || {};
  const rawSelectableTargets = cardLogic && typeof cardLogic.getSelectableTargets === 'function'
    ? cardLogic.getSelectableTargets(input.cardState, input.gameState, input.playerKey)
    : [];
  const selectableTargets = Array.isArray(rawSelectableTargets) ? rawSelectableTargets : [];
  const selectableTargetSet = new Set<string>();
  selectableTargets.forEach((target: any) => {
    const key = normalizePointKey(target);
    if (key) selectableTargetSet.add(key);
  });
  const isSelectingTarget = !!(pending && pending.stage === 'selectTarget' && selectableTargets.length > 0);
  const randomSpawnPreviewSet = input.isHumanTurn
    ? collectRandomSpawnPreviewHighlightKeys(input, pending, {
      enabled: input.canControlCurrentTurn,
      pending
    })
    : new Set<string>();
  const showLegalHints = input.isHumanTurn === true
    && !isSelectingTarget
    && randomSpawnPreviewSet.size <= 0
    && input.canControlCurrentTurn === true;
  let normalLegalSet = new Set<string>();
  if (showLegalHints && typeof input.getLegalMoves === 'function') {
    let context = { protectedStones: [], permaProtectedStones: [] };
    if (cardLogic && typeof cardLogic.getCardContext === 'function') {
      try {
        context = cardLogic.getCardContext(input.cardState) || context;
      } catch (e) { /* ignore */ }
    }
    const legalMoves = input.getLegalMoves(input.gameState, (context as any).protectedStones, (context as any).permaProtectedStones) || [];
    normalLegalSet = new Set(legalMoves.map((move: any) => `${move.row},${move.col}`));
  }
  const tabooLegalSet = buildTabooLegalSet(input, pending, showLegalHints);
  const legalSet = new Set<string>([...normalLegalSet, ...tabooLegalSet]);
  return {
    pending,
    selectableTargets,
    selectableTargetSet,
    isSelectingTarget,
    showLegalHints,
    normalLegalSet,
    tabooLegalSet,
    legalSet,
    randomSpawnPreviewSet,
    selectedTargetHighlightSet: input.isHumanTurn ? collectPendingSelectedTargetHighlightKeys(pending) : new Set<string>(),
    boardShrinkGodPreviewHighlightSet: input.isHumanTurn ? collectBoardShrinkGodPreviewHighlightKeys(pending, selectableTargets) : new Set<string>(),
    boardExpansionDirectionHintMap: buildBoardExpansionDirectionHintMap(pending, selectableTargets, input.boardShape),
    boardShrinkGodDirectionHintMap: buildBoardShrinkGodDirectionHintMap(pending, selectableTargets),
    boardShrinkWillDirectionHintMap: buildBoardShrinkWillDirectionHintMap(pending, selectableTargets)
  };
}

export = {
  buildBoardHintProjection,
  collectPendingSelectedTargetHighlightKeys,
  collectRandomSpawnPreviewHighlightKeys,
  buildBoardExpansionDirectionHintMap,
  buildBoardShrinkGodDirectionHintMap,
  buildBoardShrinkWillDirectionHintMap,
  collectBoardShrinkGodPreviewHighlightKeys
};
