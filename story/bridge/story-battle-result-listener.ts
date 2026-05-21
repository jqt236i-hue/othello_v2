import type { StoryBattleResult, StorySide } from '../core/story-schema';
import {
  GAME_RESULT_EVENT,
  LEGACY_GAME_RESULT_EVENT,
  type GameResultEventDetail
} from '../../shared/game-result-event';

export type StoryBattleResultRoot = {
  gameState?: unknown;
  showResult?: (...args: unknown[]) => unknown;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
  ResultOverlayModule?: {
    showResult?: (...args: unknown[]) => unknown;
  };
};

export type StoryBattleResultListenerOptions = {
  root: StoryBattleResultRoot;
  stageId: string;
  protagonistSide: StorySide;
  resolve: (result: StoryBattleResult) => void;
};

export function installStoryBattleResultListener(
  options: StoryBattleResultListenerOptions
): () => void {
  const { root, stageId, protagonistSide, resolve } = options;
  let settled = false;
  const originalShowResult = root.showResult;
  const originalModuleShowResult = root.ResultOverlayModule?.showResult;
  let eventDetail: GameResultEventDetail | null = null;

  const restore = (): void => {
    if (typeof root.removeEventListener === 'function') {
      root.removeEventListener(GAME_RESULT_EVENT, onGameResult);
      root.removeEventListener(LEGACY_GAME_RESULT_EVENT, onGameResult);
    }
    if (typeof originalShowResult === 'function') {
      root.showResult = originalShowResult;
    }
    if (root.ResultOverlayModule && typeof originalModuleShowResult === 'function') {
      root.ResultOverlayModule.showResult = originalModuleShowResult;
    }
  };

  const complete = (): void => {
    if (settled) return;
    settled = true;
    restore();
    resolve({
      stageId,
      outcome: eventDetail
        ? resolveStoryBattleOutcomeFromWinner(eventDetail.winner, protagonistSide)
        : resolveStoryBattleOutcome(root.gameState, protagonistSide)
    });
  };

  const onGameResult: EventListener = (event) => {
    const detail = (event as CustomEvent<GameResultEventDetail>).detail;
    if (isGameResultEventDetail(detail)) {
      eventDetail = detail;
    }
    complete();
  };

  const wrapped = function storyShowResultWrapper(this: unknown, ...args: unknown[]) {
    try {
      if (typeof originalShowResult === 'function') {
        return originalShowResult.apply(this, args);
      }
      if (typeof originalModuleShowResult === 'function') {
        return originalModuleShowResult.apply(this, args);
      }
      return undefined;
    } finally {
      complete();
    }
  };

  if (typeof originalShowResult === 'function') {
    root.showResult = wrapped;
  }
  if (root.ResultOverlayModule && typeof root.ResultOverlayModule.showResult === 'function') {
    root.ResultOverlayModule.showResult = wrapped;
  }
  if (typeof root.addEventListener === 'function') {
    root.addEventListener(GAME_RESULT_EVENT, onGameResult);
    root.addEventListener(LEGACY_GAME_RESULT_EVENT, onGameResult);
  }

  return restore;
}

export function resolveStoryBattleOutcomeFromWinner(
  winner: GameResultEventDetail['winner'],
  protagonistSide: StorySide
): StoryBattleResult['outcome'] {
  if (winner === 'draw') return 'draw';
  return winner === protagonistSide ? 'win' : 'lose';
}

export function resolveStoryBattleOutcome(
  gameState: unknown,
  protagonistSide: StorySide
): StoryBattleResult['outcome'] {
  const counts = countDiscs(gameState);
  if (counts.black === counts.white) return 'draw';
  const winner: StorySide = counts.black > counts.white ? 'black' : 'white';
  return winner === protagonistSide ? 'win' : 'lose';
}

function isGameResultEventDetail(value: unknown): value is GameResultEventDetail {
  if (!value || typeof value !== 'object') return false;
  const detail = value as GameResultEventDetail;
  return (
    detail.source === 'showResult' &&
    (detail.winner === 'black' || detail.winner === 'white' || detail.winner === 'draw') &&
    !!detail.counts &&
    typeof detail.counts === 'object' &&
    Number.isFinite(Number(detail.counts.black)) &&
    Number.isFinite(Number(detail.counts.white))
  );
}

function countDiscs(gameState: unknown): { black: number; white: number } {
  const board = (gameState && typeof gameState === 'object' && Array.isArray((gameState as any).board))
    ? (gameState as any).board
    : [];
  let black = 0;
  let white = 0;
  board.forEach((row: unknown) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell) => {
      if (cell === 1 || cell === 'black') black += 1;
      if (cell === -1 || cell === 'white') white += 1;
    });
  });
  return { black, white };
}
