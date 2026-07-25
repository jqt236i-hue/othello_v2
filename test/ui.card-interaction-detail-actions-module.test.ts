import { JSDOM } from 'jsdom';
import {
  createCardInteractionDetailActions,
  getPendingSelectionPrompt as getPendingSelectionPromptStatic,
  isHandOverlayPendingSelectionFallback,
  resolveConsecutivePassStatusModel
} from '../cards/card-interaction-detail-actions';

function createController(overrides?: Record<string, any>) {
  const dom = new JSDOM(`
      <!doctype html><html><body>
        <button id="reversi-pass-btn" hidden disabled>パス</button>
        <button id="board-frame-pass-btn" hidden disabled>パス</button>
        <button id="othello-pass-btn" hidden disabled>パス</button>
        <div id="consecutive-pass-status" hidden aria-hidden="true">
          <span class="pass-streak-label">連続パス</span><span class="pass-streak-current" data-pass-streak-current="true">0</span><span class="pass-streak-separator">/</span><span class="pass-streak-max">2</span><span class="pass-streak-note">(パスカウント2で終局)</span>
        </div>
      </body></html>
  `);
  const cardState = {
    charge: { black: 10, white: 8 },
    pendingEffectByPlayer: { black: null, white: null }
  } as any;
  const gameState = {
    currentPlayer: 1,
    consecutivePasses: 0,
    __resultShown: false
  } as any;
  const deps = {
    isAutoModeActive: jest.fn(() => false),
    canInputPlayerActNow: jest.fn(() => true),
    isDebugUnlimitedUsage: jest.fn(() => false),
    ensureHandDestroyFlags: jest.fn(),
    hasPlayerUsedCardThisActiveTurn: jest.fn(() => false),
    canInteractWithCardUi: jest.fn(() => true),
    getCardDef: jest.fn((cardId: any) => (cardId ? { id: cardId, cost: 3 } : null)),
    getCardStateValue: () => cardState,
    getGameStateValue: () => gameState,
    isGameOver: jest.fn(() => false),
    isSelectedCardUsableNow: jest.fn(() => true),
    getLegalMovesForCurrentPlayer: jest.fn(() => []),
    isPlacementLockedForPlayer: jest.fn(() => false),
    isVisualPlaybackRunningNow: jest.fn(() => false),
    isStaleVisualPlaybackLock: jest.fn(() => false),
    isReversiMode: jest.fn(() => false),
    getDocumentRef: () => dom.window.document,
    posToNotation: (row: any, col: any) => `${Number(row) + 1}-${Number(col) + 1}`
  };
  if (overrides) {
    if (overrides.cardState) Object.assign(cardState, overrides.cardState);
    if (overrides.gameState) Object.assign(gameState, overrides.gameState);
    Object.assign(deps, overrides.deps || {});
  }
  const controller = createCardInteractionDetailActions(deps as any);
  return { controller, dom, cardState, gameState, deps };
}

describe('card interaction detail actions module', () => {
  test('pass status model hides at zero when pass is not available', () => {
    expect(resolveConsecutivePassStatusModel({
      gameState: { consecutivePasses: 0 },
      canShowPass: false
    })).toEqual({
      shouldShow: false,
      count: 0,
      max: 2,
      text: ''
    });
  });

  test('pass status model shows zero only when pass is currently available', () => {
    expect(resolveConsecutivePassStatusModel({
      gameState: { consecutivePasses: 0 },
      canShowPass: true
    })).toEqual({
      shouldShow: true,
      count: 0,
      max: 2,
      text: '連続パス0/2(パスカウント2で終局)'
    });
  });

  test('pass status model keeps one-pass warning even when current player can move', () => {
    expect(resolveConsecutivePassStatusModel({
      gameState: { consecutivePasses: 1 },
      canShowPass: false
    })).toEqual({
      shouldShow: true,
      count: 1,
      max: 2,
      text: '連続パス1/2(パスカウント2で終局)'
    });
  });

  test('pass status model hides while result is shown', () => {
    expect(resolveConsecutivePassStatusModel({
      gameState: { consecutivePasses: 2, __resultShown: true },
      canShowPass: true
    })).toEqual({
      shouldShow: false,
      count: 2,
      max: 2,
      text: ''
    });
  });

  test('sync pass status element from action state', () => {
    const ctx = createController({
      gameState: { consecutivePasses: 1 },
      deps: {
        getLegalMovesForCurrentPlayer: jest.fn(() => [{ row: 2, col: 3, flips: [[3, 3]] }])
      }
    });

    const actionState = ctx.controller.resolveCardDetailActionState({
      playerKey: 'black',
      hasSelection: false,
      selectedId: null
    });
    ctx.controller.syncConsecutivePassStatus(actionState);

    const status = ctx.dom.window.document.getElementById('consecutive-pass-status') as HTMLElement;
    const current = status.querySelector('[data-pass-streak-current="true"]') as HTMLElement;
    expect(status.hidden).toBe(false);
    expect(status.getAttribute('aria-hidden')).toBe('false');
    expect(status.getAttribute('aria-label')).toBe('連続パス1/2(パスカウント2で終局)');
    expect(status.textContent?.replace(/\s+/g, '')).toBe('連続パス1/2(パスカウント2で終局)');
    expect(current.textContent).toBe('1');
  });

  test('resolve action state allows pass through stale playback lock', () => {
    const ctx = createController({
      deps: {
        canInteractWithCardUi: jest.fn(() => false),
        isVisualPlaybackRunningNow: jest.fn(() => true),
        isStaleVisualPlaybackLock: jest.fn(() => true)
      }
    });

    const actionState = ctx.controller.resolveCardDetailActionState({
      playerKey: 'black',
      hasSelection: false,
      selectedId: null
    });

    expect(actionState.canShowPass).toBe(true);
    expect(actionState.canPass).toBe(true);
    expect(actionState.reason).toBe('');
  });

  test('resolve action state allows pass when placement lock makes normal moves unusable', () => {
    const ctx = createController({
      deps: {
        getLegalMovesForCurrentPlayer: jest.fn(() => [{ row: 2, col: 3, flips: [[3, 3]] }]),
        isPlacementLockedForPlayer: jest.fn(() => true)
      }
    });

    const actionState = ctx.controller.resolveCardDetailActionState({
      playerKey: 'black',
      hasSelection: false,
      selectedId: null
    });

    expect(actionState.canShowPass).toBe(true);
    expect(actionState.canPass).toBe(true);
  });

  test('resolve action state locks pass and card actions after the game is over', () => {
    const ctx = createController({
      deps: {
        isGameOver: jest.fn(() => true)
      }
    });

    const actionState = ctx.controller.resolveCardDetailActionState({
      playerKey: 'black',
      hasSelection: true,
      selectedId: 'card_01'
    });

    expect(actionState.canActThisTurn).toBe(false);
    expect(actionState.canShowPass).toBe(false);
    expect(actionState.canPass).toBe(false);
    expect(actionState.canUse).toBe(false);
    expect(actionState.canDestroy).toBe(false);
  });

  test('resolve action state marks heaven selection and debug unlimited bypasses normal limits', () => {
    const ctx = createController({
      cardState: {
        charge: { black: 0, white: 0 },
        pendingEffectByPlayer: {
          black: { type: 'HEAVEN_BLESSING', stage: 'selectTarget' },
          white: null
        }
      },
      deps: {
        isDebugUnlimitedUsage: jest.fn(() => true),
        canInputPlayerActNow: jest.fn(() => false),
        canInteractWithCardUi: jest.fn(() => false),
        isSelectedCardUsableNow: jest.fn(() => true)
      }
    });

    const actionState = ctx.controller.resolveCardDetailActionState({
      playerKey: 'black',
      hasSelection: true,
      selectedId: 'card_01'
    });

    expect(actionState.isHeavenSelecting).toBe(true);
    expect(actionState.canUse).toBe(true);
    expect(actionState.canDestroy).toBe(true);
    expect(actionState.canAfford).toBe(true);
  });

  test('sync reversi pass buttons mirror show and disabled state', () => {
    const ctx = createController({
      deps: {
        isReversiMode: jest.fn(() => true)
      }
    });

    ctx.controller.syncReversiPassButton({
      canShowPass: true,
      canPass: false
    });

    const passBtn = ctx.dom.window.document.getElementById('reversi-pass-btn') as HTMLButtonElement;
    const framePassBtn = ctx.dom.window.document.getElementById('board-frame-pass-btn') as HTMLButtonElement;
    expect(passBtn.hidden).toBe(false);
    expect(passBtn.getAttribute('aria-hidden')).toBe('false');
    expect(passBtn.disabled).toBe(true);
    expect(framePassBtn.hidden).toBe(false);
    expect(framePassBtn.getAttribute('aria-hidden')).toBe('false');
    expect(framePassBtn.disabled).toBe(true);
  });

  test('board frame pass button follows card pass visibility outside reversi mode', () => {
    const ctx = createController({
      deps: {
        isReversiMode: jest.fn(() => false)
      }
    });

    ctx.controller.syncReversiPassButton({
      canShowPass: true,
      canPass: true
    });

    const reversiPassBtn = ctx.dom.window.document.getElementById('reversi-pass-btn') as HTMLButtonElement;
    const framePassBtn = ctx.dom.window.document.getElementById('board-frame-pass-btn') as HTMLButtonElement;
    expect(reversiPassBtn.hidden).toBe(true);
    expect(reversiPassBtn.disabled).toBe(true);
    expect(framePassBtn.hidden).toBe(false);
    expect(framePassBtn.getAttribute('aria-hidden')).toBe('false');
    expect(framePassBtn.disabled).toBe(false);
  });

  test('pending prompt formats multi-step selections', () => {
    const ctx = createController();

    expect(ctx.controller.getPendingSelectionPrompt({
      type: 'POSITION_SWAP_WILL',
      stage: 'selectTarget',
      firstTarget: { row: 2, col: 5 }
    })).toBe('2つ目の石を選んでください（1つ目: 3-6）');

    expect(ctx.controller.getPendingSelectionPrompt({
      type: 'BOARD_SHRINK_WILL',
      stage: 'selectTarget',
      selectedCount: 1,
      maxSelections: 3
    })).toBe('盤面縮小: つながる外周マスをあと2つ選んでください');
  });

  test('standalone pending helpers preserve fallback behavior', () => {
    expect(isHandOverlayPendingSelectionFallback('HEAVEN_BLESSING')).toBe(true);
    expect(isHandOverlayPendingSelectionFallback('SEED_WILL')).toBe(false);
    expect(getPendingSelectionPromptStatic({ type: 'UNKNOWN_PENDING', stage: 'selectTarget' })).toBe('破壊対象を選んでください（キャンセル可）');
  });
});
