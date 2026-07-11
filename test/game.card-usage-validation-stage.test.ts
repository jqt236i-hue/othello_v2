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
        CardUsagePrechecksModule: { validateCardUsagePreconditions }
      },
      getCardCost: jest.fn(() => 99),
      getCardType: jest.fn(() => 'DESTROY_ONE_STONE'),
      CardHandManagerModule: { resolveHandIndexForCard: jest.fn(() => 0) },
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
      timeStopGodSelfDestroyCount: 3
    }));
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
      CardHandManagerModule: { resolveHandIndexForCard: jest.fn(() => 0) },
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
