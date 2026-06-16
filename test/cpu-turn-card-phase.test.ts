import { createCpuTurnCardPhase } from '../game/cpu-turn-card-phase.js';

function createConfig(overrides: Record<string, any> = {}) {
  return {
    emitCpuCommentary: jest.fn(),
    getAnimationRetryDelayMs: jest.fn(() => 0),
    getDestroyHandCardWithPolicyFn: jest.fn(() => null),
    getLastUsedCardIdSafe: jest.fn(() => 'theory_incarnation'),
    getCurrentPlayerKeySafe: jest.fn(() => 'white'),
    getCurrentTurnNumberSafe: jest.fn(() => 12),
    getUseCardWithPolicyFn: jest.fn(() => jest.fn(() => true)),
    isUiAnimationBusy: jest.fn(() => false),
    runCpuTurn: jest.fn(),
    scheduleRetry: jest.fn(() => false),
    scheduleRunCpuTurn: jest.fn(),
    setCpuProcessing: jest.fn(),
    shouldAbortCpuForHumanMode: jest.fn(() => false),
    shouldSkipCardPhaseForProfile: jest.fn(() => false),
    tryDestroyHighPriorityHandCardViaAdapter: jest.fn(() => false),
    ...overrides
  };
}

describe('cpu turn card phase', () => {
  test('falls back to scheduled CPU retry when card-use resume cannot schedule directly', async () => {
    const config = createConfig();
    const phase = createCpuTurnCardPhase(config as any);

    const result = await phase.runCpuTurnCardPhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      othelloMode: false,
      hasUsedCardThisTurn: false,
      hasPendingSelection: false
    });

    expect(result).toEqual({ status: 'handled' });
    expect(config.scheduleRetry).toHaveBeenCalledTimes(1);
    expect(config.scheduleRunCpuTurn).toHaveBeenCalledWith('white', { autoMode: false }, 0);
    expect(config.runCpuTurn).not.toHaveBeenCalled();
  });

  test('falls back to scheduled CPU retry when hand-destroy resume cannot schedule directly', async () => {
    const config = createConfig({
      getDestroyHandCardWithPolicyFn: jest.fn(() => jest.fn(() => true)),
      getUseCardWithPolicyFn: jest.fn(() => jest.fn(() => false))
    });
    const phase = createCpuTurnCardPhase(config as any);

    const result = await phase.runCpuTurnCardPhase({
      playerKey: 'white',
      autoMode: true,
      level: 6,
      othelloMode: false,
      hasUsedCardThisTurn: false,
      hasPendingSelection: false
    });

    expect(result).toEqual({ status: 'handled' });
    expect(config.scheduleRetry).toHaveBeenCalledTimes(1);
    expect(config.scheduleRunCpuTurn).toHaveBeenCalledWith('white', { autoMode: true }, 0);
    expect(config.runCpuTurn).not.toHaveBeenCalled();
  });

  test('skips a card-use resume when the turn changed before the retry fires', async () => {
    let retryCallback: any = null;
    let turnNumber = 12;
    const config = createConfig({
      getCurrentPlayerKeySafe: jest.fn(() => 'white'),
      getCurrentTurnNumberSafe: jest.fn(() => turnNumber),
      scheduleRetry: jest.fn((fn) => {
        retryCallback = fn;
        return true;
      })
    });
    const phase = createCpuTurnCardPhase(config as any);

    const result = await phase.runCpuTurnCardPhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      othelloMode: false,
      hasUsedCardThisTurn: false,
      hasPendingSelection: false
    });

    expect(result).toEqual({ status: 'handled' });
    expect(typeof retryCallback).toBe('function');

    turnNumber = 13;
    retryCallback();

    expect(config.runCpuTurn).not.toHaveBeenCalled();
    expect(config.scheduleRunCpuTurn).not.toHaveBeenCalled();
  });
});
