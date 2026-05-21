import type {
  StoryBattleDeckSource,
  StoryBattleStage,
  StoryInitialBoardSetup,
  StorySide
} from '../core/story-schema';
import type { StoryDeckPreset } from '../core/story-schema';
import { decodeStoryBoardCode } from '../core/story-board-codec';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const DeckCodecModule = _require('../../shared/deck-codec.js');
const DeckSpecHelpers = _require('../../shared/deck-spec.js');
const SharedConstants = _require('../../shared-constants.js');

const BLACK = Number(SharedConstants.BLACK);
const WHITE = Number(SharedConstants.WHITE);
const EMPTY = Number(SharedConstants.EMPTY);

export type StoryBattleDeckContext = {
  deckPresets: Record<string, StoryDeckPreset>;
  currentPlayerDeckSpec?: unknown;
};

export type StoryBattleDeckDeps = {
  decodeDeckCode?: (deckCode: string) => unknown;
  normalizeDeckSpec?: (deckSpec: unknown, options?: { requireFullDeck?: boolean }) => unknown;
  decodeBoardCode?: (boardCode: string) => StoryInitialBoardSetup;
};

export type StoryBattleGameInitOptions = {
  boardConfig: { rows: number; cols: number };
  initialBoardSetup?: {
    board: number[][];
    currentPlayer: StorySide;
  };
  initialDeckSpecByPlayer?: Partial<Record<StorySide, unknown>>;
};

export function buildStoryBattleGameInitOptions(
  stage: StoryBattleStage,
  context: StoryBattleDeckContext,
  deps: StoryBattleDeckDeps = {}
): StoryBattleGameInitOptions {
  const initialDeckSpecByPlayer: Partial<Record<StorySide, unknown>> = {};
  const protagonistSide = stage.protagonistSide ?? 'black';
  const enemySide = stage.enemySide ?? 'white';
  if (protagonistSide === enemySide) {
    throw new Error('Story battle protagonistSide and enemySide must be different.');
  }

  const protagonistDeck = resolveStoryBattleDeck(stage.protagonistDeck, context, deps);
  const enemyDeck = resolveStoryBattleDeck(stage.enemyDeck, context, deps);
  if (protagonistDeck) initialDeckSpecByPlayer[protagonistSide] = protagonistDeck;
  if (enemyDeck) initialDeckSpecByPlayer[enemySide] = enemyDeck;

  return {
    boardConfig: {
      rows: stage.boardSize.rows,
      cols: stage.boardSize.cols
    },
    ...(stage.initialBoardCode
      ? { initialBoardSetup: buildRuntimeInitialBoardSetup(stage.initialBoardCode, stage, deps) }
      : {}),
    ...(Object.keys(initialDeckSpecByPlayer).length > 0 ? { initialDeckSpecByPlayer } : {})
  };
}

function resolveStoryBattleDeck(
  deck: StoryBattleDeckSource | undefined,
  context: StoryBattleDeckContext,
  deps: StoryBattleDeckDeps
): unknown | null {
  if (!deck || deck.type === 'default') return null;
  if (deck.type === 'currentPlayerDeck') {
    if (context.currentPlayerDeckSpec) {
      return getNormalizeDeckSpec(deps)(context.currentPlayerDeckSpec, { requireFullDeck: false });
    }
    if (deck.fallback === 'error') {
      throw new Error('currentPlayerDeck is required for this story battle stage.');
    }
    return null;
  }
  if (deck.type === 'deckPreset') {
    const preset = context.deckPresets[deck.presetId];
    if (!preset) {
      throw new Error(`Unknown story deck preset: ${deck.presetId}`);
    }
    return getDecodeDeckCode(deps)(preset.deckCode);
  }
  if (deck.type === 'deckCode') {
    return getDecodeDeckCode(deps)(deck.deckCode);
  }
  return assertNever(deck);
}

function getDecodeDeckCode(deps: StoryBattleDeckDeps): (deckCode: string) => unknown {
  return deps.decodeDeckCode ?? DeckCodecModule.decodeDeckCode;
}

function getNormalizeDeckSpec(
  deps: StoryBattleDeckDeps
): (deckSpec: unknown, options?: { requireFullDeck?: boolean }) => unknown {
  return deps.normalizeDeckSpec ?? DeckSpecHelpers.normalizeDeckSpec;
}

function buildRuntimeInitialBoardSetup(
  boardCode: string,
  stage: StoryBattleStage,
  deps: StoryBattleDeckDeps
): { board: number[][]; currentPlayer: StorySide } {
  const decoded = (deps.decodeBoardCode ?? decodeStoryBoardCode)(boardCode);
  if (decoded.rows !== stage.boardSize.rows || decoded.cols !== stage.boardSize.cols) {
    throw new Error(
      `initialBoardCode size ${decoded.rows}x${decoded.cols} does not match stage boardSize ${stage.boardSize.rows}x${stage.boardSize.cols}.`
    );
  }
  return {
    currentPlayer: decoded.currentPlayer,
    board: decoded.cells.map((line) => line.map((cell) => {
      if (cell === 'black') return BLACK;
      if (cell === 'white') return WHITE;
      return EMPTY;
    }))
  };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported story battle deck source: ${JSON.stringify(value)}`);
}
