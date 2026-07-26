/**
 * @file core.ts
 * @description Core Reversi Logic (Shared between Browser and Headless)
 * Pure functions only. No UI dependencies.
 */


declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

function getRuntimeGlobalValueOrDefault(key: string, fallbackValue: any): any {
    if (typeof self !== 'undefined' && (self as any)[key]) {
        return (self as any)[key];
    }
    return fallbackValue;
}

function resolveCoreModuleOrGlobal(id: string, globalKey: string, fallbackValue: any): any {
    if (typeof module === 'object' && module.exports) {
        const loaded = safeRequire(id);
        if (loaded) return loaded;
    }

    return getRuntimeGlobalValueOrDefault(globalKey, fallbackValue);
}

const SharedConstants = resolveCoreModuleOrGlobal('../../shared-constants', 'SharedConstants', undefined);
const SharedBoardUtils = resolveCoreModuleOrGlobal('../../shared/shared-board-utils', 'SharedBoardUtils', null);

const { BLACK, WHITE, EMPTY, DIRECTIONS } = SharedConstants || {};
const BoardUtils = SharedBoardUtils || null;

if (BLACK === undefined) {
    throw new Error('SharedConstants not loaded');
}
if (!BoardUtils) {
    throw new Error('SharedBoardUtils not loaded');
}

interface BoardConfig {
    rows: number;
    cols: number;
    shape: 'rectangle' | 'circle';
    standard8x8: boolean;
    baseBounds: { minRow: number; maxRow: number; minCol: number; maxCol: number };
    outerBounds: { minRow: number; maxRow: number; minCol: number; maxCol: number };
}

interface StonePlacement {
    row: number;
    col: number;
    owner: number;
}

interface ExpansionCell {
    side: string | null;
    row: number;
    col: number;
    owner: number;
}

interface RoundCompletion {
    black: boolean;
    white: boolean;
}

interface PendingRoundBonus {
    roundNumber: number;
    amount: number;
}

interface Move {
    row: number;
    col: number;
    flips: [number, number][];
}

interface DiscCount {
    black: number;
    white: number;
}

interface CoreBoardSource {
    gameState: any;
    cardState: unknown;
}

function resolveCoreBoardSource(stateOrContext: any, explicitCardState?: unknown): CoreBoardSource {
    if (
        typeof BoardUtils.isBoardContext === 'function' &&
        BoardUtils.isBoardContext(stateOrContext)
    ) {
        return {
            gameState: stateOrContext.gameState,
            cardState: stateOrContext.cardState
        };
    }
    const embeddedCardState = (
        stateOrContext &&
        typeof stateOrContext === 'object' &&
        Object.prototype.hasOwnProperty.call(stateOrContext, 'cardState')
    )
        ? stateOrContext.cardState
        : null;
    return {
        gameState: stateOrContext,
        cardState: explicitCardState === undefined ? embeddedCardState : explicitCardState
    };
}

function resolveGameBoardConfig(boardOrConfig: any): BoardConfig {
    if (typeof BoardUtils.resolveBoardConfig !== 'function') {
        throw new Error('SharedBoardUtils.resolveBoardConfig is required by GameCore');
    }
    return BoardUtils.resolveBoardConfig(boardOrConfig);
}

function createBoardMatrix(boardOrConfig: any): number[][] {
    if (typeof BoardUtils.createEmptyBoard !== 'function') {
        throw new Error('SharedBoardUtils.createEmptyBoard is required by GameCore');
    }
    return BoardUtils.createEmptyBoard(resolveGameBoardConfig(boardOrConfig), EMPTY);
}

function getOpeningPlacements(boardOrConfig: any): StonePlacement[] {
    if (typeof BoardUtils.getOpeningPlacements !== 'function') {
        throw new Error('SharedBoardUtils.getOpeningPlacements is required by GameCore');
    }
    return BoardUtils.getOpeningPlacements(boardOrConfig);
}

function normalizeExpansionCells(expansion: any, boardOrConfig: any): ExpansionCell[] {
    if (typeof BoardUtils.collectExpansionDescriptors !== 'function') {
        throw new Error('SharedBoardUtils.collectExpansionDescriptors is required by GameCore');
    }
    return BoardUtils.collectExpansionDescriptors(expansion, boardOrConfig)
        .map((cell: ExpansionCell) => ({ ...cell }));
}

function syncLegacyExpansionFields(expansion: any): void {
    if (!expansion || typeof expansion !== 'object') return;
    if (!Array.isArray(expansion.cells)) expansion.cells = [];
    const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
    expansion.active = !!latest;
    expansion.side = latest ? latest.side : null;
    expansion.row = latest ? latest.row : null;
    expansion.col = latest ? latest.col : null;
    expansion.owner = latest ? latest.owner : EMPTY;
}

function createBoardExpansionState(sourceExpansion: any, boardOrConfig: any): any {
    const usedByPlayer = {
        black: !!(sourceExpansion && sourceExpansion.usedByPlayer && sourceExpansion.usedByPlayer.black),
        white: !!(sourceExpansion && sourceExpansion.usedByPlayer && sourceExpansion.usedByPlayer.white)
    };
    const cells = normalizeExpansionCells(sourceExpansion, boardOrConfig);
    const out = {
        active: false,
        side: null,
        row: null,
        owner: EMPTY,
        usedByPlayer,
        cells
    };
    syncLegacyExpansionFields(out);
    return out;
}

function ensureBoardExpansionState(state: any): any {
    if (!state.boardExpansion || typeof state.boardExpansion !== 'object') {
        state.boardExpansion = createBoardExpansionState(null, state);
        return state.boardExpansion;
    }
    const expansion = state.boardExpansion;
    if (!expansion.usedByPlayer || typeof expansion.usedByPlayer !== 'object') {
        expansion.usedByPlayer = { black: false, white: false };
    } else {
        expansion.usedByPlayer.black = !!expansion.usedByPlayer.black;
        expansion.usedByPlayer.white = !!expansion.usedByPlayer.white;
    }
    expansion.cells = normalizeExpansionCells(expansion, state);
    syncLegacyExpansionFields(expansion);
    return expansion;
}

function normalizeRoundNumber(value: any): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    const roundNumber = Math.trunc(numeric);
    return roundNumber >= 1 ? roundNumber : 1;
}

function normalizeRoundPlayerKey(player: any): string | null {
    if (player === BLACK || player === 'black' || player === 1 || player === '1' || player === '+1') return 'black';
    if (player === WHITE || player === 'white' || player === -1 || player === '-1') return 'white';
    return null;
}

function createRoundCompletionByPlayer(source: any): RoundCompletion {
    const value = (source && typeof source === 'object') ? source : {};
    return {
        black: !!value.black,
        white: !!value.white
    };
}

function clonePendingRoundBonus(source: any): PendingRoundBonus | null {
    if (!source || typeof source !== 'object') return null;
    const roundNumber = normalizeRoundNumber(source.roundNumber);
    const amountValue = Number(source.amount);
    const amount = Number.isFinite(amountValue) ? Math.max(0, Math.trunc(amountValue)) : 0;
    if (!(amount > 0)) return null;
    return { roundNumber, amount };
}

function ensureRoundState(state: any): any {
    if (!state || typeof state !== 'object') return state;
    state.roundNumber = normalizeRoundNumber(state.roundNumber);
    state.roundCompletionByPlayer = createRoundCompletionByPlayer(state.roundCompletionByPlayer);
    state.pendingRoundBonus = clonePendingRoundBonus(state.pendingRoundBonus);
    return state;
}

function resolveRoundBonusAmount(roundNumber: number): number {
    const normalizedRound = normalizeRoundNumber(roundNumber);
    if (normalizedRound % 10 !== 0) return 0;
    return Math.max(0, Math.floor(normalizedRound / 2));
}

function advanceRoundAfterCompletedTurn(state: any, player: any, options?: any): { advanced: boolean; roundNumber: number; pendingRoundBonus: PendingRoundBonus | null } {
    const targetState = ensureRoundState(state);
    const playerKey = normalizeRoundPlayerKey(player);
    const opts = (options && typeof options === 'object') ? options : {};
    if (!targetState || !playerKey) {
        return {
            advanced: false,
            roundNumber: targetState ? targetState.roundNumber : 1,
            pendingRoundBonus: clonePendingRoundBonus(targetState && targetState.pendingRoundBonus)
        };
    }

    targetState.roundCompletionByPlayer[playerKey] = true;
    const completedBlack = !!targetState.roundCompletionByPlayer.black;
    const completedWhite = !!targetState.roundCompletionByPlayer.white;
    if (!completedBlack || !completedWhite) {
        return {
            advanced: false,
            roundNumber: targetState.roundNumber,
            pendingRoundBonus: clonePendingRoundBonus(targetState.pendingRoundBonus)
        };
    }

    const nextRoundNumber = normalizeRoundNumber(targetState.roundNumber + 1);
    targetState.roundNumber = nextRoundNumber;
    targetState.roundCompletionByPlayer = createRoundCompletionByPlayer(null);
    if (opts.scheduleBonus !== false) {
        const amount = resolveRoundBonusAmount(nextRoundNumber);
        targetState.pendingRoundBonus = amount > 0
            ? { roundNumber: nextRoundNumber, amount }
            : null;
    }
    return {
        advanced: true,
        roundNumber: targetState.roundNumber,
        pendingRoundBonus: clonePendingRoundBonus(targetState.pendingRoundBonus)
    };
}

function consumePendingRoundBonus(state: any): PendingRoundBonus | null {
    const targetState = ensureRoundState(state);
    if (!targetState) return null;
    const pending = clonePendingRoundBonus(targetState.pendingRoundBonus);
    targetState.pendingRoundBonus = null;
    return pending;
}

function getExpansionCells(state: any): ExpansionCell[] {
    if (!state || !state.boardExpansion || typeof state.boardExpansion !== 'object') return [];
    return normalizeExpansionCells(state.boardExpansion, state);
}

function createGameState(boardConfigInput?: any): any {
    const boardConfig = resolveGameBoardConfig(boardConfigInput);
    const board = createBoardMatrix(boardConfig);
    const openingPlacements = getOpeningPlacements(boardConfig);
    for (const stone of openingPlacements) {
        board[stone.row][stone.col] = stone.owner;
    }
    return {
        board: board,
        boardConfig,
        currentPlayer: BLACK,
        consecutivePasses: 0,
        turnNumber: 0,
        roundNumber: 1,
        roundCompletionByPlayer: createRoundCompletionByPlayer(null),
        pendingRoundBonus: null,
        boardExpansion: createBoardExpansionState(null, boardConfig)
    };
}

function copyGameState(state: any): any {
    const newBoard = state.board.map((row: number[]) => row.slice());
    const boardConfig = resolveGameBoardConfig(state);
    const sourceExpansion = (state && state.boardExpansion && typeof state.boardExpansion === 'object')
        ? state.boardExpansion
        : null;
    const nextState = {
        board: newBoard,
        boardConfig,
        currentPlayer: state.currentPlayer,
        consecutivePasses: state.consecutivePasses,
        turnNumber: state.turnNumber || 0,
        roundNumber: normalizeRoundNumber(state && state.roundNumber),
        roundCompletionByPlayer: createRoundCompletionByPlayer(state && state.roundCompletionByPlayer),
        pendingRoundBonus: clonePendingRoundBonus(state && state.pendingRoundBonus),
        boardExpansion: createBoardExpansionState(sourceExpansion, boardConfig)
    };
    return nextState;
}

function getExpansionCell(state: any): ExpansionCell | null {
    const cells = getExpansionCells(state);
    return cells.length > 0 ? cells[0] : null;
}

function getCellValue(stateOrContext: any, row: number, col: number, cardState?: unknown): number | null {
    if (!BoardUtils || typeof BoardUtils.getStateCellValue !== 'function') {
        throw new Error('SharedBoardUtils.getStateCellValue is required by GameCore');
    }
    const source = resolveCoreBoardSource(stateOrContext, cardState);
    return BoardUtils.getStateCellValue(source.gameState, row, col, source.cardState);
}

function setCellValue(stateOrContext: any, row: number, col: number, value: number, cardState?: unknown): boolean {
    if (!BoardUtils || typeof BoardUtils.setStateCellValue !== 'function') {
        throw new Error('SharedBoardUtils.setStateCellValue is required by GameCore');
    }
    const source = resolveCoreBoardSource(stateOrContext, cardState);
    return BoardUtils.setStateCellValue(source.gameState, row, col, value, source.cardState);
}

interface FlipContext {
    protectedStones?: { row: number; col: number }[];
    permaProtectedStones?: { row: number; col: number }[];
    blockedCells?: { row: number; col: number }[];
    perfCounters?: { flipContextCompiles?: number };
    cardState?: unknown;
}

const COMPILED_FLIP_CONTEXT: unique symbol = Symbol('compiledFlipContext');

type CompiledFlipContext = {
    source: FlipContext;
    protectedSet: Set<string> | null;
    permaSet: Set<string> | null;
    blockedSet: Set<string> | null;
    [COMPILED_FLIP_CONTEXT]: true;
};

function flipContextCellKey(row: number, col: number): string {
    return `${row},${col}`;
}

function compileFlipContext(context: FlipContext | CompiledFlipContext = {}): CompiledFlipContext {
    if (context && (context as CompiledFlipContext)[COMPILED_FLIP_CONTEXT] === true) {
        return context as CompiledFlipContext;
    }
    const source = (context && typeof context === 'object') ? context as FlipContext : {};
    const protectedStones = source.protectedStones || [];
    const permaProtectedStones = source.permaProtectedStones || [];
    const blockedCells = source.blockedCells || [];
    if (source.perfCounters && typeof source.perfCounters === 'object') {
        source.perfCounters.flipContextCompiles = Number(source.perfCounters.flipContextCompiles || 0) + 1;
    }
    return {
        source,
        protectedSet: protectedStones.length
            ? new Set(protectedStones.map((position) => flipContextCellKey(position.row, position.col)))
            : null,
        permaSet: permaProtectedStones.length
            ? new Set(permaProtectedStones.map((position) => flipContextCellKey(position.row, position.col)))
            : null,
        blockedSet: blockedCells.length
            ? new Set(blockedCells.map((position) => flipContextCellKey(position.row, position.col)))
            : null,
        [COMPILED_FLIP_CONTEXT]: true
    };
}

function getFlipsWithContext(state: any, row: number, col: number, player: number, context: FlipContext | CompiledFlipContext = {}): [number, number][] {
    const compiled = compileFlipContext(context);
    if (!BoardUtils || typeof BoardUtils.createBoardView !== 'function') {
        throw new Error('SharedBoardUtils.createBoardView is required by GameCore');
    }
    const sourceContext = (compiled.source && typeof compiled.source === 'object')
        ? compiled.source
        : {};
    const cardState = Object.prototype.hasOwnProperty.call(sourceContext, 'cardState')
        ? sourceContext.cardState
        : (state && Object.prototype.hasOwnProperty.call(state, 'cardState') ? state.cardState : null);
    const view = BoardUtils.createBoardView(state, { cardState, strict: false });
    return view.getFlips(row, col, player, {
        protectedKeys: compiled.protectedSet || undefined,
        permanentProtectedKeys: compiled.permaSet || undefined,
        blockedKeys: compiled.blockedSet || undefined
    }).map((cell: any) => [cell.row, cell.col] as [number, number]);
}

function applyMove(stateOrContext: any, move: Move, cardState?: unknown): any {
    const source = resolveCoreBoardSource(stateOrContext, cardState);
    const state = source.gameState;
    const newState = copyGameState(state);
    setCellValue(newState, move.row, move.col, state.currentPlayer, source.cardState);
    for (const [r, c] of move.flips) {
        setCellValue(newState, r, c, state.currentPlayer, source.cardState);
    }
    newState.currentPlayer = -state.currentPlayer;
    newState.consecutivePasses = 0;
    newState.turnNumber = (state.turnNumber || 0) + 1;
    return newState;
}

function applyPass(state: any): any {
    const newState = copyGameState(state);
    newState.currentPlayer = -newState.currentPlayer;
    const previousPasses = Number.isFinite(Number(state.consecutivePasses))
        ? Math.max(0, Math.trunc(Number(state.consecutivePasses)))
        : 0;
    newState.consecutivePasses = previousPasses + 1;
    newState.turnNumber = (state.turnNumber || 0) + 1;
    advanceRoundAfterCompletedTurn(newState, state.currentPlayer);
    return newState;
}

function isGameOver(state: any): boolean {
    return state.consecutivePasses >= 2;
}

function countDiscs(stateOrContext: any, cardState?: unknown): DiscCount {
    if (!BoardUtils || typeof BoardUtils.countStateDiscs !== 'function') {
        throw new Error('SharedBoardUtils.countStateDiscs is required by GameCore');
    }
    const source = resolveCoreBoardSource(stateOrContext, cardState);
    return BoardUtils.countStateDiscs(source.gameState, source.cardState);
}

function getLegalMoves(state: any, player: number, context: FlipContext | CompiledFlipContext = {}): Move[] {
    const compiled = compileFlipContext(context);
    if (!BoardUtils || typeof BoardUtils.createBoardView !== 'function') {
        throw new Error('SharedBoardUtils.createBoardView is required by GameCore');
    }
    const cardState = Object.prototype.hasOwnProperty.call(compiled.source, 'cardState')
        ? compiled.source.cardState
        : (state && Object.prototype.hasOwnProperty.call(state, 'cardState') ? state.cardState : null);
    const view = BoardUtils.createBoardView(state, { cardState, strict: false });
    return view.getLegalMoves(player, {
        protectedKeys: compiled.protectedSet || undefined,
        permanentProtectedKeys: compiled.permaSet || undefined,
        blockedKeys: compiled.blockedSet || undefined
    }).map((move: any) => ({
        row: move.row,
        col: move.col,
        flips: move.flips.map((cell: any) => [cell.row, cell.col] as [number, number])
    }));
}

function getFreePlacementMoves(state: any, player: number, context: FlipContext | CompiledFlipContext = {}): Move[] {
    const compiled = compileFlipContext(context);
    const blockedSet = compiled.blockedSet;
    if (!BoardUtils || typeof BoardUtils.createBoardView !== 'function') {
        throw new Error('SharedBoardUtils.createBoardView is required by GameCore');
    }
    const cardState = Object.prototype.hasOwnProperty.call(compiled.source, 'cardState')
        ? compiled.source.cardState
        : (state && Object.prototype.hasOwnProperty.call(state, 'cardState') ? state.cardState : null);
    const view = BoardUtils.createBoardView(state, { cardState, strict: false });
    const moves: Move[] = [];
    for (const cell of view.coordinates) {
        const row = cell.row;
        const col = cell.col;
        const value = view.get(row, col);
        if (value !== EMPTY) continue;
        if (blockedSet && blockedSet.has(`${row},${col}`)) continue;
        const flips = getFlipsWithContext(state, row, col, player, compiled);
        moves.push({ row, col, flips });
    }
    return moves;
}

function hasLegalMove(state: any, player: number, context: FlipContext | CompiledFlipContext = {}): boolean {
    return getLegalMoves(state, player, context).length > 0;
}

export = {
    BLACK,
    WHITE,
    EMPTY,
    DIRECTIONS,
    createGameState,
    copyGameState,
    ensureRoundState,
    resolveRoundBonusAmount,
    advanceRoundAfterCompletedTurn,
    consumePendingRoundBonus,
    getExpansionCells,
    getCellValue,
    setCellValue,
    compileFlipContext,
    getFlipsWithContext,
    applyMove,
    applyPass,
    isGameOver,
    countDiscs,
    getLegalMoves,
    getFreePlacementMoves,
    hasLegalMove
};
