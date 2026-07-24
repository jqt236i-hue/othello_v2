import * as fs from 'fs';
import * as path from 'path';
import * as CardUsageValidationStage from '../game/cards/card-usage-validation-stage';

describe('card usage validation stage', () => {
  test('preserves hand, cost, type, and precheck inputs before mutation', () => {
    const validateCardUsagePreconditions = jest.fn(() => ({
      ok: true,
      heavenOffers: [{ id: 'heaven' }],
      condemnOffers: [{ id: 'condemn' }],
      observerWillOffers: [{ id: 'observer' }]
    }));
    const getPoisonTargets = jest.fn(() => [{ row: 1, col: 2 }]);
    const cardState = { hands: { black: ['destroy_01'] }, charge: { black: 8 }, turnIndex: 7 };
    const result = CardUsageValidationStage.prepareCardUsageValidation({
      cardState,
      playerKey: 'black',
      cardId: 'destroy_01',
      deps: {
        gameState: { board: [] },
        getHandCopyIdAt: jest.fn(() => 'copy-1'),
        getEffectiveCardCostForCopy: jest.fn(() => 8),
        buildHeavenBlessingSeedHint: jest.fn(() => 'seed'),
        getPoisonTargets,
        CardUsagePrechecksModule: { validateCardUsagePreconditions }
      },
      getCardCost: jest.fn(() => 99),
      getCardType: jest.fn(() => 'DESTROY_ONE_STONE'),
      CardHandManagerModule: {
        canConsumeCardUseForTurn: jest.fn(() => true),
        resolveHandIndexForCard: jest.fn(() => 0)
      },
      CardMarkersModule: null,
      CardUsagePrechecksModule: null,
      PendingSelectionRegistryModule: { buildPendingSelectionTargetContext: jest.fn(() => ({ extraTarget: true })) },
      RIBO_WILL_UNLOCK_TURN_INDEX: 19,
      TIME_STOP_GOD_SELF_DESTROY_COUNT: 3
    });

    expect(result).toMatchObject({
      ok: true,
      gameState: { board: [] },
      handKey: 'black',
      handIndex: 0,
      cost: 8,
      cardType: 'DESTROY_ONE_STONE',
      heavenOffers: [{ id: 'heaven' }],
      condemnOffers: [{ id: 'condemn' }],
      observerWillOffers: [{ id: 'observer' }]
    });
    expect(validateCardUsagePreconditions).toHaveBeenCalledWith(expect.objectContaining({
      cardId: 'destroy_01',
      cardType: 'DESTROY_ONE_STONE',
      playerKey: 'black',
      handKey: 'black',
      heavenSeedHint: 'seed',
      extraTarget: true,
      getPoisonTargets,
      timeStopGodSelfDestroyCount: 3
    }));
  });

  test('rejects a second card use before hand, charge, or precheck mutation', () => {
    const validateCardUsagePreconditions = jest.fn(() => ({ ok: true }));
    const resolveHandIndexForCard = jest.fn(() => 0);
    const cardState = {
      hands: { black: ['work_01'] },
      charge: { black: 99 },
      discard: [],
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      lastUsedCardByPlayer: { black: 'hard_01', white: null }
    };
    const before = structuredClone(cardState);

    const result = CardUsageValidationStage.prepareCardUsageValidation({
      cardState,
      playerKey: 'black',
      cardId: 'work_01',
      deps: {},
      getCardCost: jest.fn(() => 1),
      getCardType: jest.fn(() => 'WORK_WILL'),
      CardHandManagerModule: {
        canConsumeCardUseForTurn: jest.fn(() => false),
        resolveHandIndexForCard
      },
      CardMarkersModule: null,
      CardUsagePrechecksModule: { validateCardUsagePreconditions },
      PendingSelectionRegistryModule: null,
      RIBO_WILL_UNLOCK_TURN_INDEX: 19,
      TIME_STOP_GOD_SELF_DESTROY_COUNT: 3
    });

    expect(result).toEqual({ ok: false });
    expect(cardState).toEqual(before);
    expect(resolveHandIndexForCard).not.toHaveBeenCalled();
    expect(validateCardUsagePreconditions).not.toHaveBeenCalled();
  });

  test('preserves the explicit debug noConsume card-use validation bypass', () => {
    const validateCardUsagePreconditions = jest.fn(() => ({ ok: true }));
    const result = CardUsageValidationStage.prepareCardUsageValidation({
      cardState: {
        hands: { black: ['work_01'] },
        charge: { black: 99 },
        hasUsedCardThisTurnByPlayer: { black: true, white: false }
      },
      playerKey: 'black',
      cardId: 'work_01',
      deps: { opts: { noConsume: true } },
      getCardCost: jest.fn(() => 1),
      getCardType: jest.fn(() => 'WORK_WILL'),
      CardHandManagerModule: {
        canConsumeCardUseForTurn: jest.fn(() => false),
        resolveHandIndexForCard: jest.fn(() => 0)
      },
      CardMarkersModule: null,
      CardUsagePrechecksModule: { validateCardUsagePreconditions },
      PendingSelectionRegistryModule: null,
      RIBO_WILL_UNLOCK_TURN_INDEX: 19,
      TIME_STOP_GOD_SELF_DESTROY_COUNT: 3
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, handIndex: 0 }));
    expect(validateCardUsagePreconditions).toHaveBeenCalledTimes(1);
  });

  test('does not let skipCostAndTurnLimit bypass the turn-use guard', () => {
    const validateCardUsagePreconditions = jest.fn(() => ({ ok: true }));
    const resolveHandIndexForCard = jest.fn(() => 0);
    const result = CardUsageValidationStage.prepareCardUsageValidation({
      cardState: {
        hands: { black: ['work_01'] },
        charge: { black: 99 },
        hasUsedCardThisTurnByPlayer: { black: true, white: false }
      },
      playerKey: 'black',
      cardId: 'work_01',
      deps: { opts: { skipCostAndTurnLimit: true } },
      getCardCost: jest.fn(() => 1),
      getCardType: jest.fn(() => 'WORK_WILL'),
      CardHandManagerModule: {
        canConsumeCardUseForTurn: jest.fn(() => false),
        resolveHandIndexForCard
      },
      CardMarkersModule: null,
      CardUsagePrechecksModule: { validateCardUsagePreconditions },
      PendingSelectionRegistryModule: null,
      RIBO_WILL_UNLOCK_TURN_INDEX: 19,
      TIME_STOP_GOD_SELF_DESTROY_COUNT: 3
    });

    expect(result).toEqual({ ok: false });
    expect(resolveHandIndexForCard).not.toHaveBeenCalled();
    expect(validateCardUsagePreconditions).not.toHaveBeenCalled();
  });

  test('rejects a locked card before running prechecks', () => {
    const validateCardUsagePreconditions = jest.fn(() => ({ ok: true }));
    const result = CardUsageValidationStage.prepareCardUsageValidation({
      cardState: { hands: { black: ['destroy_01'] }, charge: { black: 8 } },
      playerKey: 'black',
      cardId: 'destroy_01',
      deps: {},
      getCardCost: jest.fn(() => 8),
      getCardType: jest.fn(() => 'DESTROY_ONE_STONE'),
      CardHandManagerModule: {
        canConsumeCardUseForTurn: jest.fn(() => true),
        resolveHandIndexForCard: jest.fn(() => 0)
      },
      CardMarkersModule: { isCardPlayLockedForPlayer: jest.fn(() => true) },
      CardUsagePrechecksModule: { validateCardUsagePreconditions },
      PendingSelectionRegistryModule: null,
      RIBO_WILL_UNLOCK_TURN_INDEX: 19,
      TIME_STOP_GOD_SELF_DESTROY_COUNT: 3
    });
    expect(result).toEqual({ ok: false });
    expect(validateCardUsagePreconditions).not.toHaveBeenCalled();
  });

  test('keeps precondition resolution out of the effect resolver', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'cards', 'effect-resolver.ts'), 'utf8');
    expect(source).toContain('CardUsageValidationStage.prepareCardUsageValidation({');
    expect(source).not.toContain('validateCardUsagePreconditions({');
  });
});
