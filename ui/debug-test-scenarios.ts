export {};

const OBSERVER_WILL_READY = 'observer_will_ready';
const THEORY_INCARNATION_READY = 'theory_incarnation_ready';
const THEORY_INCARNATION_SPAWN_READY = 'theory_incarnation_spawn_ready';
const SPECIAL_CARDS_READY = 'special_cards_ready';
const OBSERVER_READY_TURN = 18;
const OBSERVER_READY_CHARGE = 99;
const OBSERVER_READY_BLACK_HAND = ['observer_will_01'];
const OBSERVER_READY_WHITE_HAND = ['rebuild_01', 'gold_stone', 'silver_stone'];
const THEORY_READY_BLACK_HAND = ['theory_incarnation_01'];
const SPECIAL_READY_BLACK_HAND = ['theory_incarnation_01', 'board_executor_01', 'observer_will_01'];
const SPECIAL_READY_WHITE_HAND = ['rebuild_01', 'gold_stone', 'silver_stone'];
const THEORY_SPAWN_SESSION_ID = 'debug_theory_spawn_black';

function normalizeScenarioId(value: any): string | null {
  const scenarioId = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  if (scenarioId === OBSERVER_WILL_READY) return OBSERVER_WILL_READY;
  if (scenarioId === THEORY_INCARNATION_READY) return THEORY_INCARNATION_READY;
  if (scenarioId === THEORY_INCARNATION_SPAWN_READY) return THEORY_INCARNATION_SPAWN_READY;
  if (scenarioId === SPECIAL_CARDS_READY) return SPECIAL_CARDS_READY;
  return null;
}

function isEnabledQueryParam(params: URLSearchParams, names: string[]): boolean {
  return names.some((name) => {
    const value = String(params.get(name) || '').trim().toLowerCase();
    return value === '1' || value === 'true';
  });
}

function resolveDebugTestScenarioFromQuery(query: any): string | null {
  const rawQuery = String(query || '');
  let params: URLSearchParams | null = null;
  try {
    params = new URLSearchParams(rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery);
  } catch (e) {
    return null;
  }
  const specialDebugEnabled = isEnabledQueryParam(params, ['specialDebug', 'special-debug']);
  if (specialDebugEnabled) return SPECIAL_CARDS_READY;
  const debugEnabled = isEnabledQueryParam(params, ['debug']);
  if (!debugEnabled) return null;
  return normalizeScenarioId(params.get('testScenario') || params.get('test-scenario'));
}

function readDebugTestScenarioFromLocation(rootRef?: any): string | null {
  const root = rootRef && typeof rootRef === 'object'
    ? rootRef
    : (typeof window !== 'undefined' ? window : null);
  const search = root && root.location && typeof root.location.search === 'string'
    ? root.location.search
    : (typeof location !== 'undefined' && typeof location.search === 'string' ? location.search : '');
  return resolveDebugTestScenarioFromQuery(search);
}

function assignHandCopyIds(cardState: any, playerKey: 'black' | 'white', copyIds: number[]) {
  if (!cardState._handCopyIdsByPlayer || typeof cardState._handCopyIdsByPlayer !== 'object') {
    cardState._handCopyIdsByPlayer = { black: [], white: [] };
  }
  cardState._handCopyIdsByPlayer[playerKey] = copyIds.slice();
}

function applyObserverWillReadyScenario(gameState: any, cardState: any) {
  if (!gameState || typeof gameState !== 'object' || !cardState || typeof cardState !== 'object') {
    return { applied: false, reason: 'missing_state' };
  }

  gameState.currentPlayer = 1;
  gameState.turnNumber = Math.max(OBSERVER_READY_TURN, Number(gameState.turnNumber) || 0);
  gameState.consecutivePasses = 0;

  cardState.hands = {
    ...(cardState.hands && typeof cardState.hands === 'object' ? cardState.hands : {}),
    black: OBSERVER_READY_BLACK_HAND.slice(),
    white: OBSERVER_READY_WHITE_HAND.slice()
  };
  cardState.decks = {
    ...(cardState.decks && typeof cardState.decks === 'object' ? cardState.decks : {}),
    black: [],
    white: []
  };
  cardState.charge = {
    ...(cardState.charge && typeof cardState.charge === 'object' ? cardState.charge : {}),
    black: OBSERVER_READY_CHARGE,
    white: OBSERVER_READY_CHARGE
  };
  cardState.turnIndex = Math.max(OBSERVER_READY_TURN, Number(cardState.turnIndex) || 0);
  cardState.pendingEffectByPlayer = { black: null, white: null };
  cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };
  cardState.lastUsedCardByPlayer = { black: null, white: null };
  cardState.markers = [];
  cardState.selectedCardId = 'observer_will_01';
  cardState.selectedCardOwnerKey = 'black';
  cardState._deckCopyIdsByPlayer = { black: [], white: [] };
  cardState._discardCopyIds = [];
  cardState._revealedHandCopyIdsByViewer = { black: [], white: [] };
  assignHandCopyIds(cardState, 'black', [101]);
  assignHandCopyIds(cardState, 'white', [201, 202, 203]);
  cardState._nextCardCopySeq = 204;
  if (!cardState.cardCostOverridesByCopyId || typeof cardState.cardCostOverridesByCopyId !== 'object') {
    cardState.cardCostOverridesByCopyId = {};
  }
  if (!cardState.cardCostModifiersByCopyId || typeof cardState.cardCostModifiersByCopyId !== 'object') {
    cardState.cardCostModifiersByCopyId = {};
  }
  cardState.nextObserverWillStoneByPlayer = { black: null, white: null };
  cardState.observerWillRepaymentsByPlayer = { black: [], white: [] };

  return {
    applied: true,
    scenarioId: OBSERVER_WILL_READY,
    message: 'デバッグシナリオ: 盤理の観測者を使用可能な18手後状態へ移行'
  };
}

function applyTheoryIncarnationReadyScenario(gameState: any, cardState: any) {
  if (!gameState || typeof gameState !== 'object' || !cardState || typeof cardState !== 'object') {
    return { applied: false, reason: 'missing_state' };
  }

  gameState.currentPlayer = 1;
  gameState.consecutivePasses = 0;

  cardState.hands = {
    ...(cardState.hands && typeof cardState.hands === 'object' ? cardState.hands : {}),
    black: THEORY_READY_BLACK_HAND.slice(),
    white: []
  };
  cardState.decks = {
    ...(cardState.decks && typeof cardState.decks === 'object' ? cardState.decks : {}),
    black: [],
    white: []
  };
  cardState.charge = {
    ...(cardState.charge && typeof cardState.charge === 'object' ? cardState.charge : {}),
    black: OBSERVER_READY_CHARGE,
    white: OBSERVER_READY_CHARGE
  };
  cardState.pendingEffectByPlayer = { black: null, white: null };
  cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };
  cardState.lastUsedCardByPlayer = { black: null, white: null };
  cardState.markers = [];
  cardState.selectedCardId = 'theory_incarnation_01';
  cardState.selectedCardOwnerKey = 'black';
  cardState.numberCellCollectedTotalByPlayer = {
    ...(cardState.numberCellCollectedTotalByPlayer && typeof cardState.numberCellCollectedTotalByPlayer === 'object'
      ? cardState.numberCellCollectedTotalByPlayer
      : {}),
    black: 42,
    white: Number(cardState.numberCellCollectedTotalByPlayer && cardState.numberCellCollectedTotalByPlayer.white || 0)
  };
  cardState.theoryIncarnationStateByPlayer = { black: null, white: null };
  cardState.nextTheoryIncarnationStoneByPlayer = { black: null, white: null };
  cardState.theoryNumberCellsBySession = {};
  cardState.theoryNumberCellByCell = {};
  cardState._deckCopyIdsByPlayer = { black: [], white: [] };
  cardState._discardCopyIds = [];
  cardState._revealedHandCopyIdsByViewer = { black: [], white: [] };
  assignHandCopyIds(cardState, 'black', [101]);
  assignHandCopyIds(cardState, 'white', []);
  cardState._nextCardCopySeq = 102;

  return {
    applied: true,
    scenarioId: THEORY_INCARNATION_READY,
    message: 'デバッグシナリオ: 理論の化身を使用可能な数字マス合計42状態へ移行'
  };
}

function setBoardCell(gameState: any, row: number, col: number, value: number) {
  if (!gameState || !Array.isArray(gameState.board) || !Array.isArray(gameState.board[row])) return;
  gameState.board[row][col] = value;
}

function buildTheorySpawnDebugCell(row: number, col: number, value: number, spawnType: string, sourceCardId: string, sourceCardType: string) {
  return {
    row,
    col,
    value,
    originalValue: 0,
    originalConsumed: false,
    spawnType,
    sourceCardId,
    sourceCardType,
    sourceCardCost: value
  };
}

function applySpecialCardsReadyScenario(gameState: any, cardState: any) {
  if (!gameState || typeof gameState !== 'object' || !cardState || typeof cardState !== 'object') {
    return { applied: false, reason: 'missing_state' };
  }

  gameState.currentPlayer = 1;
  gameState.turnNumber = Math.max(OBSERVER_READY_TURN, Number(gameState.turnNumber) || 0);
  gameState.consecutivePasses = 0;
  setBoardCell(gameState, 2, 3, 1);

  cardState.hands = {
    ...(cardState.hands && typeof cardState.hands === 'object' ? cardState.hands : {}),
    black: SPECIAL_READY_BLACK_HAND.slice(),
    white: SPECIAL_READY_WHITE_HAND.slice()
  };
  cardState.decks = {
    ...(cardState.decks && typeof cardState.decks === 'object' ? cardState.decks : {}),
    black: [],
    white: []
  };
  cardState.charge = {
    ...(cardState.charge && typeof cardState.charge === 'object' ? cardState.charge : {}),
    black: OBSERVER_READY_CHARGE,
    white: OBSERVER_READY_CHARGE
  };
  cardState.turnIndex = Math.max(OBSERVER_READY_TURN, Number(cardState.turnIndex) || 0);
  cardState.pendingEffectByPlayer = { black: null, white: null };
  cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };
  cardState.lastUsedCardByPlayer = { black: null, white: null };
  cardState.lastTurnStartedFor = null;
  cardState.markers = [{
    id: 'debug_special_ready_afterimage_black',
    kind: 'specialStone',
    row: 2,
    col: 3,
    owner: 'black',
    data: {
      type: 'AFTERIMAGE_WILL',
      flipEvadeRemaining: 6,
      destroyEvadeRemaining: 6,
      sourceType: 'SPECIAL_DEBUG',
      visualEffectKey: 'afterimageWill'
    }
  }];
  cardState.selectedCardId = 'theory_incarnation_01';
  cardState.selectedCardOwnerKey = 'black';
  cardState.numberCellCollectedTotalByPlayer = {
    ...(cardState.numberCellCollectedTotalByPlayer && typeof cardState.numberCellCollectedTotalByPlayer === 'object'
      ? cardState.numberCellCollectedTotalByPlayer
      : {}),
    black: 42,
    white: Number(cardState.numberCellCollectedTotalByPlayer && cardState.numberCellCollectedTotalByPlayer.white || 0)
  };
  cardState.theoryIncarnationStateByPlayer = { black: null, white: null };
  cardState.nextTheoryIncarnationStoneByPlayer = { black: null, white: null };
  cardState.theoryNumberCellsBySession = {};
  cardState.theoryNumberCellByCell = {};
  cardState.nextObserverWillStoneByPlayer = { black: null, white: null };
  cardState.observerWillRepaymentsByPlayer = { black: [], white: [] };
  cardState.nextBoardExecutorStoneByPlayer = { black: null, white: null };
  cardState._deckCopyIdsByPlayer = { black: [], white: [] };
  cardState._discardCopyIds = [];
  cardState._revealedHandCopyIdsByViewer = { black: [], white: [] };
  cardState.cardCostOverridesByCopyId = {};
  cardState.cardCostModifiersByCopyId = {};
  assignHandCopyIds(cardState, 'black', [101, 102, 103]);
  assignHandCopyIds(cardState, 'white', [201, 202, 203]);
  cardState._nextCardCopySeq = 204;

  return {
    applied: true,
    scenarioId: SPECIAL_CARDS_READY,
    message: 'デバッグシナリオ: 特殊カード3枚を最初から使用可能な状態へ移行'
  };
}

function applyTheoryIncarnationSpawnReadyScenario(gameState: any, cardState: any) {
  if (!gameState || typeof gameState !== 'object' || !cardState || typeof cardState !== 'object') {
    return { applied: false, reason: 'missing_state' };
  }

  gameState.currentPlayer = 1;
  gameState.consecutivePasses = 0;
  setBoardCell(gameState, 2, 3, 1);

  const cells: Record<string, any> = {
    '0,0': buildTheorySpawnDebugCell(0, 0, 5, 'GHOST', 'ghost_01', 'GHOST_WILL'),
    '0,1': buildTheorySpawnDebugCell(0, 1, 7, 'BREEDING', 'breeding_01', 'BREEDING_WILL'),
    '0,2': buildTheorySpawnDebugCell(0, 2, 8, 'SNIPER', 'sniper_01', 'SNIPER_WILL'),
    '1,0': buildTheorySpawnDebugCell(1, 0, 11, 'HYPERACTIVE', 'hyperactive_01', 'HYPERACTIVE_WILL'),
    '1,1': buildTheorySpawnDebugCell(1, 1, 12, 'GLUTTONOUS', 'gluttonous_01', 'GLUTTONOUS_WILL')
  };

  cardState.hands = {
    ...(cardState.hands && typeof cardState.hands === 'object' ? cardState.hands : {}),
    black: [],
    white: []
  };
  cardState.decks = {
    ...(cardState.decks && typeof cardState.decks === 'object' ? cardState.decks : {}),
    black: [],
    white: []
  };
  cardState.charge = {
    ...(cardState.charge && typeof cardState.charge === 'object' ? cardState.charge : {}),
    black: OBSERVER_READY_CHARGE,
    white: OBSERVER_READY_CHARGE
  };
  cardState.pendingEffectByPlayer = { black: null, white: null };
  cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };
  cardState.lastUsedCardByPlayer = { black: null, white: null };
  cardState.lastTurnStartedFor = null;
  cardState.markers = [{
    id: 'debug_theory_manifest_black',
    kind: 'specialStone',
    row: 2,
    col: 3,
    owner: 'black',
    data: {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 4,
      inviolable: true,
      sourceType: 'THEORY_INCARNATION',
      visualEffectKey: 'theoryIncarnationStone'
    }
  }];
  cardState.selectedCardId = null;
  cardState.selectedCardOwnerKey = null;
  cardState.numberCellCollectedTotalByPlayer = {
    ...(cardState.numberCellCollectedTotalByPlayer && typeof cardState.numberCellCollectedTotalByPlayer === 'object'
      ? cardState.numberCellCollectedTotalByPlayer
      : {}),
    black: 42,
    white: Number(cardState.numberCellCollectedTotalByPlayer && cardState.numberCellCollectedTotalByPlayer.white || 0)
  };
  cardState.theoryIncarnationStateByPlayer = {
    black: { sessionId: THEORY_SPAWN_SESSION_ID, ownerKey: 'black', remainingSpawnCount: 4 },
    white: null
  };
  cardState.nextTheoryIncarnationStoneByPlayer = { black: null, white: null };
  cardState.theoryNumberCellsBySession = {
    [THEORY_SPAWN_SESSION_ID]: {
      ownerKey: 'black',
      cells
    }
  };
  cardState.theoryNumberCellByCell = Object.fromEntries(Object.keys(cells).map((key) => [
    key,
    { sessionId: THEORY_SPAWN_SESSION_ID, ownerKey: 'black' }
  ]));
  cardState._deckCopyIdsByPlayer = { black: [], white: [] };
  cardState._discardCopyIds = [];
  cardState._revealedHandCopyIdsByViewer = { black: [], white: [] };
  assignHandCopyIds(cardState, 'black', []);
  assignHandCopyIds(cardState, 'white', []);
  cardState._nextCardCopySeq = 101;

  return {
    applied: true,
    scenarioId: THEORY_INCARNATION_SPAWN_READY,
    message: 'デバッグシナリオ: 理論の化身の配置後出現を確認可能な状態へ移行'
  };
}

function applyDebugTestScenarioAfterReset(options: any) {
  const opts = options && typeof options === 'object' ? options : {};
  const scenarioId = normalizeScenarioId(opts.scenarioId);
  if (scenarioId === OBSERVER_WILL_READY) {
    return applyObserverWillReadyScenario(opts.gameState, opts.cardState);
  }
  if (scenarioId === THEORY_INCARNATION_READY) {
    return applyTheoryIncarnationReadyScenario(opts.gameState, opts.cardState);
  }
  if (scenarioId === THEORY_INCARNATION_SPAWN_READY) {
    return applyTheoryIncarnationSpawnReadyScenario(opts.gameState, opts.cardState);
  }
  if (scenarioId === SPECIAL_CARDS_READY) {
    return applySpecialCardsReadyScenario(opts.gameState, opts.cardState);
  }
  return { applied: false, reason: 'unknown_scenario' };
}

export = {
  OBSERVER_WILL_READY,
  THEORY_INCARNATION_READY,
  THEORY_INCARNATION_SPAWN_READY,
  SPECIAL_CARDS_READY,
  resolveDebugTestScenarioFromQuery,
  readDebugTestScenarioFromLocation,
  applyDebugTestScenarioAfterReset
};
